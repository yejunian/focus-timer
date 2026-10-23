// 타이머의 자료구조와 상태 전이 함수.
// 모든 함수는 순수 함수이며 원본을 바꾸지 않고 새 객체를 돌려준다.
// 시간은 모두 Unix epoch 밀리초(Date.now())로 기록한다. 그래야 브라우저를 다시 열어도
// 저장된 시각만으로 경과 시간을 다시 계산할 수 있다.

export type SessionKind = "focus" | "break";

/** 대기(idle), 집중 세션(focus), 휴식 세션(break) */
export type TimerStatus = "idle" | SessionKind;

export interface PauseRecord {
  startedAt: number;
  /** 아직 일시정지 중이면 null */
  endedAt: number | null;
}

export interface SessionRecord {
  kind: SessionKind;
  startedAt: number;
  /** 아직 진행 중이면 null */
  endedAt: number | null;
  pauses: PauseRecord[];
}

/** 대기 상태에서 사용자가 입력하는 값 */
export interface TimerSettings {
  goal: string;
  focusMinutes: number;
  breakMinutes: number;
}

/**
 * 진행 중인 집중-휴식 세션 세트.
 * 시작할 때의 설정을 그대로 복사해 두므로, 진행 중에 대기 화면의 입력값이 바뀌어도 영향을 받지 않는다.
 */
export interface SessionSet {
  goal: string;
  focusMinutes: number;
  breakMinutes: number;
  /** 이 세트에서 이미 끝난 세션들 (시간순) */
  finished: SessionRecord[];
  current: SessionRecord;
}

export interface TimerState {
  settings: TimerSettings;
  /** null이면 대기 상태 */
  active: SessionSet | null;
}

export const GOAL_MAX_LENGTH = 100;

export const DURATION_LIMITS: Record<
  SessionKind,
  { min: number; max: number }
> = {
  focus: { min: 5, max: 300 },
  break: { min: 1, max: 120 },
};

export const DEFAULT_SETTINGS: TimerSettings = {
  goal: "",
  focusMinutes: 25,
  breakMinutes: 5,
};

export function createInitialState(): TimerState {
  return { settings: { ...DEFAULT_SETTINGS }, active: null };
}

export function clampMinutes(kind: SessionKind, minutes: number): number {
  const { min, max } = DURATION_LIMITS[kind];
  if (!Number.isFinite(minutes)) return kind === "focus" ? 25 : 5;
  return Math.min(max, Math.max(min, Math.round(minutes)));
}

export function getStatus(state: TimerState): TimerStatus {
  return state.active?.current.kind ?? "idle";
}

export function isPaused(session: SessionRecord): boolean {
  return session.pauses.at(-1)?.endedAt === null;
}

/** 일시정지한 시간을 뺀 실제 진행 시간 */
export function getElapsedMs(session: SessionRecord, now: number): number {
  const end = session.endedAt ?? now;
  let pausedMs = 0;
  for (const pause of session.pauses) {
    const pauseEnd = Math.min(pause.endedAt ?? end, end);
    pausedMs += Math.max(0, pauseEnd - pause.startedAt);
  }
  return Math.max(0, end - session.startedAt - pausedMs);
}

export function getPlannedMs(set: SessionSet): number {
  const minutes =
    set.current.kind === "focus" ? set.focusMinutes : set.breakMinutes;
  return minutes * 60_000;
}

function createSession(kind: SessionKind, now: number): SessionRecord {
  return { kind, startedAt: now, endedAt: null, pauses: [] };
}

function closePause(session: SessionRecord, now: number): SessionRecord {
  if (!isPaused(session)) return session;
  const pauses = session.pauses.slice();
  pauses[pauses.length - 1] = { ...pauses[pauses.length - 1], endedAt: now };
  return { ...session, pauses };
}

function endSession(session: SessionRecord, now: number): SessionRecord {
  return { ...closePause(session, now), endedAt: now };
}

function updateCurrent(
  state: TimerState,
  update: (session: SessionRecord) => SessionRecord,
): TimerState {
  if (!state.active) return state;
  return {
    ...state,
    active: { ...state.active, current: update(state.active.current) },
  };
}

export function updateSettings(
  state: TimerState,
  patch: Partial<TimerSettings>,
): TimerState {
  return { ...state, settings: { ...state.settings, ...patch } };
}

/** 대기 → 집중 세션 */
export function startSet(state: TimerState, now: number): TimerState {
  if (state.active) return state;
  const { goal, focusMinutes, breakMinutes } = state.settings;
  return {
    ...state,
    active: {
      goal: goal.trim(),
      focusMinutes: clampMinutes("focus", focusMinutes),
      breakMinutes: clampMinutes("break", breakMinutes),
      finished: [],
      current: createSession("focus", now),
    },
  };
}

export function pause(state: TimerState, now: number): TimerState {
  return updateCurrent(state, (session) =>
    isPaused(session)
      ? session
      : {
          ...session,
          pauses: [...session.pauses, { startedAt: now, endedAt: null }],
        },
  );
}

export function resume(state: TimerState, now: number): TimerState {
  return updateCurrent(state, (session) => closePause(session, now));
}

/** 현재 세션을 끝내고 다른 종류의 세션을 시작한다. (집중 → 휴식, 휴식 → 집중) */
export function switchSession(
  state: TimerState,
  next: SessionKind,
  now: number,
): TimerState {
  const { active } = state;
  if (!active || active.current.kind === next) return state;
  return {
    ...state,
    active: {
      ...active,
      finished: [...active.finished, endSession(active.current, now)],
      current: createSession(next, now),
    },
  };
}

/**
 * 휴식 세션을 마치면서 세트를 완료한다. (휴식 → 대기)
 * 완료한 세트를 어딘가에 남기는 기능은 아직 없으므로 지금은 대기 상태로 돌아가기만 한다.
 */
export function completeSet(state: TimerState): TimerState {
  if (state.active?.current.kind !== "break") return state;
  return { ...state, active: null };
}

/** 진행 중인 세트를 버린다. (집중/휴식 → 대기) */
export function discardSet(state: TimerState): TimerState {
  return { ...state, active: null };
}
