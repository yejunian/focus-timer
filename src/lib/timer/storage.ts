// 타이머 상태를 localStorage에 저장하고 불러온다.
// 저장된 값은 사용자가 고칠 수도 있고 이전 버전이 남긴 값일 수도 있으므로,
// 불러올 때 모양을 검사하고 맞지 않으면 초기 상태로 되돌린다.

import {
  clampMinutes,
  createInitialState,
  GOAL_MAX_LENGTH,
  type ActivePlan,
  type PauseRecord,
  type SessionPlan,
  type SessionRecord,
  type TimerState,
} from "./model.js";

export const STORAGE_KEY = "focus-timer:state";
const STORAGE_VERSION = 2;

interface StoredState extends TimerState {
  version: typeof STORAGE_VERSION;
}

export function loadState(storage: Storage | null): TimerState {
  try {
    return parseState(storage?.getItem(STORAGE_KEY) ?? null);
  } catch {
    return createInitialState();
  }
}

export function saveState(storage: Storage | null, state: TimerState): void {
  const stored: StoredState = { version: STORAGE_VERSION, ...state };
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // 저장 공간이 없거나 막혀 있으면 이번 탭 안에서만 상태를 유지한다.
  }
}

export function parseState(raw: string | null): TimerState {
  if (raw === null) return createInitialState();

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return createInitialState();
  }

  if (!isRecord(value)) return createInitialState();
  if (value.version === 1) return parseVersion1(value);
  if (value.version !== STORAGE_VERSION) return createInitialState();

  const plan = parseSessions(value.plan);
  if (!plan) return createInitialState();

  const active = value.active === null ? null : parseActivePlan(value.active);
  // 진행 중인 계획이 깨져 있으면 그것만 버리고 대기 화면의 계획은 살린다.
  return { plan, active };
}

/**
 * 세션을 하나만 계획할 수 있던 버전 1의 값을 바꾼다.
 * `{ settings: { goal, focusMinutes, breakMinutes }, active: { goal, focusMinutes, breakMinutes, finished, current } }`
 */
function parseVersion1(value: Record<string, unknown>): TimerState {
  const plan = parseSessions([value.settings]);
  if (!plan) return createInitialState();

  let active: ActivePlan | null = null;
  if (isRecord(value.active)) {
    const { goal, focusMinutes, breakMinutes, finished, current } =
      value.active;
    active = parseActivePlan({
      sessions: [{ goal, focusMinutes, breakMinutes }],
      index: 0,
      finished,
      current,
    });
  }
  return { plan, active };
}

function parseActivePlan(value: unknown): ActivePlan | null {
  if (!isRecord(value)) return null;
  const sessions = parseSessions(value.sessions);
  if (
    !sessions ||
    !isIndex(value.index, sessions.length) ||
    !Array.isArray(value.finished) ||
    !value.finished.every(isFinishedSession) ||
    !isSession(value.current) ||
    value.current.endedAt !== null
  ) {
    return null;
  }
  return {
    sessions,
    index: value.index,
    finished: value.finished,
    current: value.current,
  };
}

/** 세션 계획 목록. 비어 있거나 하나라도 깨져 있으면 null */
function parseSessions(value: unknown): SessionPlan[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const sessions: SessionPlan[] = [];
  for (const item of value) {
    if (
      !isRecord(item) ||
      typeof item.goal !== "string" ||
      !isFiniteNumber(item.focusMinutes) ||
      !isFiniteNumber(item.breakMinutes)
    ) {
      return null;
    }
    sessions.push({
      id: isId(item.id) ? item.id : 0,
      goal: item.goal.slice(0, GOAL_MAX_LENGTH),
      focusMinutes: clampMinutes("focus", item.focusMinutes),
      breakMinutes: clampMinutes("break", item.breakMinutes),
    });
  }

  // 번호가 없거나 겹치면 처음부터 다시 매긴다.
  const ids = new Set(sessions.map((session) => session.id));
  if (ids.has(0) || ids.size !== sessions.length) {
    return sessions.map((session, index) => ({ ...session, id: index + 1 }));
  }
  return sessions;
}

function isFinishedSession(value: unknown): value is SessionRecord {
  return isSession(value) && value.endedAt !== null;
}

function isSession(value: unknown): value is SessionRecord {
  if (
    !isRecord(value) ||
    (value.kind !== "focus" && value.kind !== "break") ||
    !isFiniteNumber(value.startedAt) ||
    !isNullableNumber(value.endedAt) ||
    !Array.isArray(value.pauses) ||
    !value.pauses.every(isPause)
  ) {
    return false;
  }
  // 열린 일시정지는 마지막 하나만 허용한다.
  const openIndex = value.pauses.findIndex((pause) => pause.endedAt === null);
  return openIndex === -1 || openIndex === value.pauses.length - 1;
}

function isPause(value: unknown): value is PauseRecord {
  return (
    isRecord(value) &&
    isFiniteNumber(value.startedAt) &&
    isNullableNumber(value.endedAt)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isId(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function isIndex(value: unknown, length: number): value is number {
  return (
    Number.isSafeInteger(value) &&
    (value as number) >= 0 &&
    (value as number) < length
  );
}

/** localStorage에 접근할 수 없는 환경(서버, 차단된 브라우저)이면 null */
export function getBrowserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
