import { untrack } from "svelte";
import { getDatabase, listenForChanges } from "./database.js";
import type { HistoryEntry } from "./history.js";
import {
  completePlan,
  createInitialState,
  finishFocus,
  getElapsedMs,
  getPlannedMs,
  getStatus,
  insertPlannedSession,
  isPaused,
  movePlannedSession,
  pause,
  quitPlan,
  removePlannedSession,
  resume,
  startNextFocus,
  startPlan,
  updateNextSession,
  updatePlannedSession,
  type ActivePlan,
  type FocusEnding,
  type SessionPlan,
  type SessionPlanPatch,
  type SessionStart,
  type TimerState,
  type TimerStatus,
  type Transition,
} from "./model.js";
import { readTimerState, writeTimerState } from "./storage.js";
import { getClientTimeZone } from "./time-zone.js";

/**
 * 타이머 상태를 들고 있는 반응형 객체.
 * 상태가 바뀔 때마다 IndexedDB에 기록하고, 다른 탭에서 바뀐 상태도 받아 온다.
 * 세션을 끝내는 전이는 상태와 그 세션의 이력을 한 트랜잭션으로 저장한다.
 */
export class FocusTimer {
  /** null이면 IndexedDB를 쓸 수 없어 이 탭의 메모리에서만 상태를 유지한다. */
  #db: IDBDatabase | null;
  #state: TimerState;
  /** 이 탭에서 상태를 바꿀 때마다 늘린다. 저장소에서 읽는 사이에 상태를 바꿨는지 알아낸다. */
  #revision = 0;
  /** 경과 시간을 계산하는 기준 시각. 세션이 흘러가는 동안에만 주기적으로 갱신한다. */
  #now = $state(Date.now());

  #elapsedMs = $derived.by(() => {
    const session = this.#state.active?.current;
    return session ? getElapsedMs(session, this.#now) : 0;
  });

  #ticking = $derived(this.active !== null && !this.paused);

  /** 저장된 상태를 불러와 타이머를 만든다. */
  static async load(): Promise<FocusTimer> {
    const db = await getDatabase();
    let state = createInitialState();
    if (db) {
      try {
        state = await readTimerState(db);
      } catch {
        // 읽지 못하면 초기 상태로 시작한다.
      }
    }
    return new FocusTimer(db, state);
  }

  private constructor(db: IDBDatabase | null, state: TimerState) {
    this.#db = db;
    this.#state = $state.raw(state);
  }

  get status(): TimerStatus {
    return getStatus(this.#state);
  }

  /** 대기 화면에서 계획한 세션 목록 */
  get plan(): SessionPlan[] {
    return this.#state.plan;
  }

  /** 진행 중인 계획. 대기 상태면 null */
  get active(): ActivePlan | null {
    return this.#state.active;
  }

  get paused(): boolean {
    const session = this.#state.active?.current;
    return session ? isPaused(session) : false;
  }

  /** 현재 집중/휴식 세션에서 일시정지한 시간을 뺀 진행 시간 */
  get elapsedMs(): number {
    return this.#elapsedMs;
  }

  /** 현재 집중/휴식 세션에 설정된 시간 */
  get plannedMs(): number {
    return this.#state.active ? getPlannedMs(this.#state.active) : 0;
  }

  /** `index` 자리에 새 세션을 계획한다. (0이면 맨 앞, 세션 수와 같으면 맨 뒤) */
  addSession(index: number): void {
    this.#commit(insertPlannedSession(this.#state, index));
  }

  removeSession(id: number): void {
    this.#commit(removePlannedSession(this.#state, id));
  }

  moveSession(id: number, to: number): void {
    this.#commit(movePlannedSession(this.#state, id, to));
  }

  updateSession(id: number, patch: SessionPlanPatch): void {
    this.#commit(updatePlannedSession(this.#state, id, patch));
  }

  /** 휴식 중에 다음 세션의 목표와 시간을 고친다. */
  updateNextSession(patch: SessionPlanPatch): void {
    this.#commit(updateNextSession(this.#state, patch));
  }

  start(): void {
    this.#transition((state, now) =>
      startPlan(state, now, createSessionStart()),
    );
  }

  togglePause(): void {
    this.#transition(this.paused ? resume : pause);
  }

  /** 집중을 마치고 휴식을 시작한다. 마친 집중은 돌아본 내용과 함께 이력에 남긴다. */
  finishFocus(ending: FocusEnding): void {
    this.#endSession((state, now) =>
      finishFocus(state, ending, now, createSessionStart()),
    );
  }

  /** 휴식을 마치고 다음 세션의 집중을 시작한다. 마친 휴식은 이력에 남긴다. */
  startFocus(): void {
    this.#endSession((state, now) =>
      startNextFocus(state, now, createSessionStart()),
    );
  }

  /** 마지막 세션의 휴식을 마치고 대기 상태로 돌아간다. 마친 휴식은 이력에 남긴다. */
  complete(): void {
    this.#endSession(completePlan);
  }

  /** 그만두고 대기 상태로 돌아간다. 진행 중이던 집중/휴식은 이력에 남기지 않는다. */
  quit(): void {
    this.#commit(quitPlan(this.#state));
  }

  /**
   * 시계와 탭 간 동기화를 켠다. 컴포넌트의 `$effect` 안에서 호출하고, 돌려받은 함수로 정리한다.
   * @example $effect(() => timer.connect());
   */
  connect(): () => void {
    const stopListening = listenForChanges(() => void this.#reload());

    $effect(() => {
      if (!this.#ticking) return;

      let timeout: ReturnType<typeof setTimeout> | undefined;
      const tick = () => {
        clearTimeout(timeout);
        this.#now = Date.now();
        // 화면의 초 자리가 바뀌는 순간에 맞춰 다음 갱신을 예약한다.
        // 타이머가 조금 일찍 깨어나도 남은 몇 ms 뒤에 다시 깨어나므로 스스로 보정된다.
        const elapsedMs = untrack(() => this.#elapsedMs);
        timeout = setTimeout(tick, 1000 - (elapsedMs % 1000));
      };
      tick();
      // 백그라운드 탭에서는 타이머가 늦게 깨어나므로 다시 보일 때 바로 맞춘다.
      document.addEventListener("visibilitychange", tick);

      return () => {
        clearTimeout(timeout);
        document.removeEventListener("visibilitychange", tick);
      };
    });

    return stopListening;
  }

  #transition(update: (state: TimerState, now: number) => TimerState): void {
    this.#commit(update(this.#state, this.#updateNow()));
  }

  #endSession(update: (state: TimerState, now: number) => Transition): void {
    const { state, entry } = update(this.#state, this.#updateNow());
    this.#commit(state, entry);
  }

  #updateNow(): number {
    const now = Date.now();
    this.#now = now;
    return now;
  }

  #commit(next: TimerState, entry: HistoryEntry | null = null): void {
    if (next === this.#state) return;
    this.#state = next;
    this.#revision += 1;
    if (!this.#db) return;

    writeTimerState(this.#db, next, entry).catch((error: unknown) => {
      // 다른 탭에서 이미 끝낸 세션을 이 탭에서 또 끝내면, 같은 id의 이력이 있어 저장이 통째로 거부된다.
      // 이 탭의 상태가 뒤처져 있던 것이므로 저장된 상태를 다시 읽어 온다.
      if (error instanceof DOMException && error.name === "ConstraintError") {
        void this.#reload();
      }
      // 그 밖의 실패(용량 초과 등)는 무시하고 이 탭의 메모리에서만 상태를 유지한다.
    });
  }

  /** 저장된 상태를 다시 읽어 온다. 다른 탭에서 상태를 바꿨을 때 쓴다. */
  async #reload(): Promise<void> {
    if (!this.#db) return;
    const revision = this.#revision;
    let state: TimerState;
    try {
      state = await readTimerState(this.#db);
    } catch {
      return;
    }
    // 읽는 사이에 이 탭에서 상태를 바꿨으면 읽은 값이 더 오래된 것이므로 버린다.
    // 이 탭의 저장이 끝나면 다른 탭이 그 값을 다시 읽어 가므로 결국 같아진다.
    if (revision !== this.#revision) return;
    this.#now = Date.now();
    this.#state = state;
  }
}

/** 지금 시작하는 세션의 id와, 이 브라우저의 지금 시간대 */
function createSessionStart(): SessionStart {
  return {
    id: createId(),
    timeZone: getClientTimeZone(),
  };
}

/**
 * 무작위 UUID(v4)를 만든다.
 * `crypto.randomUUID()`는 HTTPS나 localhost에서만 쓸 수 있으므로,
 * 같은 네트워크의 휴대폰에서 http로 개발 서버를 열 때도 동작하도록 직접 만든다.
 */
function createId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
