// 타이머의 자료구조와 상태 전이 함수.
// 모든 함수는 순수 함수이며 원본을 바꾸지 않고 새 객체를 돌려준다.
// 시간은 모두 Unix epoch 밀리초(Date.now())로 기록한다. 그래야 브라우저를 다시 열어도
// 저장된 시각만으로 경과 시간을 다시 계산할 수 있다.
// 지금 시각과 새 세션의 id처럼 바깥에서 정하는 값은 인자로 받는다.

import {
  createBreakEntry,
  createFocusEntry,
  isConcentration,
  type FocusReview,
  type HistoryEntry,
} from "./history.js";

export type SessionKind = "focus" | "break";

/** 대기(idle), 집중 세션(focus), 휴식 세션(break) */
export type TimerStatus = "idle" | SessionKind;

export interface PauseRecord {
  startedAt: number;
  /** 아직 일시정지 중이면 null */
  endedAt: number | null;
}

/** 실제로 진행한 집중 세션 또는 휴식 세션 하나의 기록 */
export interface SessionRecord {
  /** 세션을 시작할 때 매기는 고유한 id. 끝난 뒤 이력에도 같은 id로 남는다. */
  id: string;
  kind: SessionKind;
  startedAt: number;
  /** 아직 진행 중이면 null */
  endedAt: number | null;
  pauses: PauseRecord[];
}

/** 끝난 세션의 기록. 일시정지도 모두 닫혀 있다. */
export interface EndedSessionRecord extends SessionRecord {
  endedAt: number;
}

/** 계획한 세션 하나. 세션은 집중 세션과 그 뒤의 휴식 세션 한 쌍으로 이루어진다. */
export interface SessionPlan {
  /** 목록 안에서 세션을 구분하는 번호. 순서를 바꿔도 그대로다. */
  id: number;
  goal: string;
  focusMinutes: number;
  breakMinutes: number;
}

/** 세션 계획에서 고칠 수 있는 값 */
export type SessionPlanPatch = Partial<Omit<SessionPlan, "id">>;

/**
 * 진행 중인 계획.
 * 시작할 때 대기 화면의 계획을 복사해 두므로, 진행 중에 고친 값은 대기 화면의 계획에 영향을 주지 않는다.
 * 세션은 "세션 1 집중 → 세션 1 휴식 → 세션 2 집중 → …" 순서로 진행한다.
 */
export interface ActivePlan {
  sessions: SessionPlan[];
  /** 지금 진행 중인 세션의 위치 (`sessions`의 인덱스) */
  index: number;
  /** 이미 끝난 집중/휴식 세션 기록 (시간순) */
  finished: EndedSessionRecord[];
  current: SessionRecord;
}

export interface TimerState {
  /** 대기 화면에서 계획한 세션 목록. 항상 하나 이상이다. */
  plan: SessionPlan[];
  /** null이면 대기 상태 */
  active: ActivePlan | null;
}

/** 집중/휴식 세션을 끝내는 전이의 결과 */
export interface Transition {
  state: TimerState;
  /** 이 전이로 끝나 이력에 남길 세션. 전이할 수 없으면 null */
  entry: HistoryEntry | null;
}

/** 집중 세션을 끝내는 데 필요한 값 */
export interface FocusEnding {
  /** 끝낼 집중 세션의 id. 그사이 다른 탭에서 세션이 바뀌었으면 끝내지 않는다. */
  sessionId: string;
  review: FocusReview;
}

export const GOAL_MAX_LENGTH = 100;

export const DURATION_LIMITS: Record<
  SessionKind,
  { min: number; max: number }
> = {
  focus: { min: 5, max: 300 },
  break: { min: 1, max: 120 },
};

export const DEFAULT_SESSION: Readonly<Omit<SessionPlan, "id">> = {
  goal: "",
  focusMinutes: 25,
  breakMinutes: 5,
};

export function createInitialState(): TimerState {
  return { plan: [{ id: 1, ...DEFAULT_SESSION }], active: null };
}

export function clampMinutes(kind: SessionKind, minutes: number): number {
  const { min, max } = DURATION_LIMITS[kind];
  if (!Number.isFinite(minutes)) {
    return kind === "focus"
      ? DEFAULT_SESSION.focusMinutes
      : DEFAULT_SESSION.breakMinutes;
  }
  return Math.min(max, Math.max(min, Math.round(minutes)));
}

/**
 * 집중 시간에 맞춘 기본 휴식 시간. 집중 시간의 1/5을 5분 단위로 반올림한다. (25분 → 5분, 50분 → 10분)
 * 휴식 시간 범위를 벗어나면 범위 안으로 맞춘다. (10분 → 0분이므로 1분)
 */
export function getDefaultBreakMinutes(focusMinutes: number): number {
  return clampMinutes("break", Math.round(focusMinutes / 5 / 5) * 5);
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

/** 지금 진행 중인 세션의 계획 */
export function getCurrentSession(active: ActivePlan): SessionPlan {
  return active.sessions[active.index];
}

/** 다음 세션의 계획. 마지막 세션이면 null */
export function getNextSession(active: ActivePlan): SessionPlan | null {
  return active.sessions[active.index + 1] ?? null;
}

export function isLastSession(active: ActivePlan): boolean {
  return active.index >= active.sessions.length - 1;
}

/** 진행 중인 집중/휴식 세션에 설정된 시간 */
export function getPlannedMs(active: ActivePlan): number {
  const session = getCurrentSession(active);
  const minutes =
    active.current.kind === "focus"
      ? session.focusMinutes
      : session.breakMinutes;
  return minutes * 60_000;
}

/** 가장 최근에 끝난 집중 세션의 기록. 휴식 중이면 바로 앞의 집중 세션이다. */
export function getLastFocusRecord(
  active: ActivePlan,
): EndedSessionRecord | null {
  return active.finished.findLast((record) => record.kind === "focus") ?? null;
}

function createSession(
  kind: SessionKind,
  now: number,
  id: string,
): SessionRecord {
  return { id, kind, startedAt: now, endedAt: null, pauses: [] };
}

function closePause(session: SessionRecord, now: number): SessionRecord {
  if (!isPaused(session)) return session;
  const pauses = session.pauses.slice();
  pauses[pauses.length - 1] = { ...pauses[pauses.length - 1], endedAt: now };
  return { ...session, pauses };
}

/** 세션을 끝낸다. 열린 일시정지는 같은 시각에 닫는다. */
function endSession(session: SessionRecord, now: number): EndedSessionRecord {
  return { ...closePause(session, now), endedAt: now };
}

function unchanged(state: TimerState): Transition {
  return { state, entry: null };
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

/** 목표 앞뒤 공백을 지우고 시간을 범위 안으로 맞춘다. 세션을 시작할 때 쓴다. */
function normalizeSession(session: SessionPlan): SessionPlan {
  return {
    ...session,
    goal: session.goal.trim(),
    focusMinutes: clampMinutes("focus", session.focusMinutes),
    breakMinutes: clampMinutes("break", session.breakMinutes),
  };
}

function clampIndex(index: number, max: number): number {
  if (!Number.isFinite(index)) return max;
  return Math.min(max, Math.max(0, Math.trunc(index)));
}

// ---------- 대기 화면의 계획 고치기 ----------

/**
 * 계획한 세션의 값을 고친다.
 * 목표는 받은 그대로 저장한다. 바로 다듬으면 한글 IME 조합이 깨지므로 세션을 시작할 때 다듬는다.
 */
export function updatePlannedSession(
  state: TimerState,
  id: number,
  patch: SessionPlanPatch,
): TimerState {
  const index = state.plan.findIndex((session) => session.id === id);
  if (index === -1) return state;
  const plan = state.plan.slice();
  plan[index] = { ...plan[index], ...patch, id };
  return { ...state, plan };
}

/**
 * `index` 자리에 새 세션을 넣는다. (0이면 맨 앞, 세션 수와 같으면 맨 뒤)
 * 목표는 비워 두고, 시간은 바로 앞의 세션(맨 앞이면 바로 뒤의 세션)을 따른다.
 */
export function insertPlannedSession(
  state: TimerState,
  index: number,
): TimerState {
  const at = clampIndex(index, state.plan.length);
  const neighbor = state.plan[at - 1] ?? state.plan[at] ?? DEFAULT_SESSION;
  const session: SessionPlan = {
    id: Math.max(0, ...state.plan.map((planned) => planned.id)) + 1,
    goal: "",
    focusMinutes: clampMinutes("focus", neighbor.focusMinutes),
    breakMinutes: clampMinutes("break", neighbor.breakMinutes),
  };
  return {
    ...state,
    plan: [...state.plan.slice(0, at), session, ...state.plan.slice(at)],
  };
}

/** 계획한 세션을 지운다. 세션이 하나만 남아 있으면 지우지 않는다. */
export function removePlannedSession(
  state: TimerState,
  id: number,
): TimerState {
  if (state.plan.length <= 1) return state;
  const plan = state.plan.filter((session) => session.id !== id);
  return plan.length === state.plan.length ? state : { ...state, plan };
}

/** 계획한 세션을 `to` 자리로 옮긴다. */
export function movePlannedSession(
  state: TimerState,
  id: number,
  to: number,
): TimerState {
  const from = state.plan.findIndex((session) => session.id === id);
  const target = clampIndex(to, state.plan.length - 1);
  if (from === -1 || from === target) return state;
  const plan = state.plan.slice();
  const [session] = plan.splice(from, 1);
  plan.splice(target, 0, session);
  return { ...state, plan };
}

// ---------- 계획 진행 ----------

/** 대기 → 첫 세션의 집중 */
export function startPlan(
  state: TimerState,
  now: number,
  focusId: string,
): TimerState {
  if (state.active) return state;
  return {
    ...state,
    active: {
      sessions: state.plan.map(normalizeSession),
      index: 0,
      finished: [],
      current: createSession("focus", now, focusId),
    },
  };
}

/** 집중 세션만 일시정지할 수 있다. */
export function pause(state: TimerState, now: number): TimerState {
  if (state.active?.current.kind !== "focus") return state;
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

/**
 * 집중을 끝내고 같은 세션의 휴식을 시작한다. 끝낸 집중은 돌아본 내용과 함께 이력에 남긴다.
 * 돌아본 내용을 입력하는 시간도 집중에 넣으므로, 저장한 때(`now`)에 집중을 끝내고 바로 휴식을 시작한다.
 */
export function finishFocus(
  state: TimerState,
  ending: FocusEnding,
  now: number,
  breakId: string,
): Transition {
  const { active } = state;
  if (
    active?.current.kind !== "focus" ||
    active.current.id !== ending.sessionId ||
    !isConcentration(ending.review.concentration)
  ) {
    return unchanged(state);
  }

  const ended = endSession(active.current, now);
  return {
    state: {
      ...state,
      active: {
        ...active,
        finished: [...active.finished, ended],
        current: createSession("break", now, breakId),
      },
    },
    entry: createFocusEntry(getCurrentSession(active), ended, ending.review),
  };
}

/** 휴식을 끝내고 다음 세션의 집중을 시작한다. 끝낸 휴식은 이력에 남긴다. 마지막 세션이면 할 수 없다. */
export function startNextFocus(
  state: TimerState,
  now: number,
  focusId: string,
): Transition {
  const { active } = state;
  if (active?.current.kind !== "break" || isLastSession(active)) {
    return unchanged(state);
  }

  const ended = endSession(active.current, now);
  const index = active.index + 1;
  return {
    state: {
      ...state,
      active: {
        // 휴식 중에 고친 목표와 시간을 이제 다듬는다.
        sessions: active.sessions.map((session, i) =>
          i === index ? normalizeSession(session) : session,
        ),
        index,
        finished: [...active.finished, ended],
        current: createSession("focus", now, focusId),
      },
    },
    entry: createBreakEntry(getCurrentSession(active), ended),
  };
}

/**
 * 휴식 중에 다음 세션의 값을 고친다. 대기 화면의 계획은 바뀌지 않는다.
 * 목표는 받은 그대로 두고, 그 세션의 집중을 시작할 때 다듬는다.
 */
export function updateNextSession(
  state: TimerState,
  patch: SessionPlanPatch,
): TimerState {
  const { active } = state;
  if (active?.current.kind !== "break" || isLastSession(active)) return state;
  const sessions = active.sessions.slice();
  const index = active.index + 1;
  sessions[index] = { ...sessions[index], ...patch, id: sessions[index].id };
  return { ...state, active: { ...active, sessions } };
}

/** 마지막 세션의 휴식을 끝내고 계획을 마친다. (휴식 → 대기) 끝낸 휴식은 이력에 남긴다. */
export function completePlan(state: TimerState, now: number): Transition {
  const { active } = state;
  if (active?.current.kind !== "break" || !isLastSession(active)) {
    return unchanged(state);
  }
  return {
    state: { ...state, active: null },
    entry: createBreakEntry(
      getCurrentSession(active),
      endSession(active.current, now),
    ),
  };
}

/**
 * 진행 중인 계획을 그만둔다. (집중/휴식 → 대기)
 * 진행 중이던 집중/휴식은 이력에 남기지 않는다. 이미 끝낸 세션의 이력은 그대로 남는다.
 */
export function quitPlan(state: TimerState): TimerState {
  if (!state.active) return state;
  return { ...state, active: null };
}
