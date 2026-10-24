import { untrack } from "svelte";
import {
  completePlan,
  discardPlan,
  getElapsedMs,
  getPlannedMs,
  getStatus,
  insertPlannedSession,
  isPaused,
  movePlannedSession,
  pause,
  removePlannedSession,
  resume,
  startPlan,
  switchSession,
  updateNextSession,
  updatePlannedSession,
  type ActivePlan,
  type SessionPlan,
  type SessionPlanPatch,
  type TimerState,
  type TimerStatus,
} from "./model.js";
import { loadState, parseState, saveState, STORAGE_KEY } from "./storage.js";

/**
 * 타이머 상태를 들고 있는 반응형 객체.
 * 상태가 바뀔 때마다 저장소에 기록하고, 다른 탭에서 바뀐 상태도 받아 온다.
 */
export class FocusTimer {
  #storage: Storage | null;
  #state: TimerState;
  /** 경과 시간을 계산하는 기준 시각. 세션이 흘러가는 동안에만 주기적으로 갱신한다. */
  #now = $state(Date.now());

  #elapsedMs = $derived.by(() => {
    const session = this.#state.active?.current;
    return session ? getElapsedMs(session, this.#now) : 0;
  });

  #ticking = $derived(this.active !== null && !this.paused);

  constructor(storage: Storage | null) {
    this.#storage = storage;
    this.#state = $state.raw(loadState(storage));
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
    this.#transition(startPlan);
  }

  togglePause(): void {
    this.#transition(this.paused ? resume : pause);
  }

  startBreak(): void {
    this.#transition((state, now) => switchSession(state, "break", now));
  }

  /** 휴식을 마치고 다음 세션의 집중을 시작한다. */
  startFocus(): void {
    this.#transition((state, now) => switchSession(state, "focus", now));
  }

  complete(): void {
    this.#transition(completePlan);
  }

  discard(): void {
    this.#transition(discardPlan);
  }

  /**
   * 시계와 탭 간 동기화를 켠다. 컴포넌트의 `$effect` 안에서 호출하고, 돌려받은 함수로 정리한다.
   * @example $effect(() => timer.connect());
   */
  connect(): () => void {
    const onStorage = (event: StorageEvent) => {
      // key가 null이면 저장소 전체가 비워진 경우다.
      if (event.storageArea !== this.#storage) return;
      if (event.key !== null && event.key !== STORAGE_KEY) return;
      this.#now = Date.now();
      this.#state = parseState(event.newValue);
    };
    window.addEventListener("storage", onStorage);

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

    return () => window.removeEventListener("storage", onStorage);
  }

  #transition(update: (state: TimerState, now: number) => TimerState): void {
    const now = Date.now();
    this.#now = now;
    this.#commit(update(this.#state, now));
  }

  #commit(next: TimerState): void {
    if (next === this.#state) return;
    this.#state = next;
    saveState(this.#storage, next);
  }
}
