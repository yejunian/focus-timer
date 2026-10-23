// 타이머 상태를 localStorage에 저장하고 불러온다.
// 저장된 값은 사용자가 고칠 수도 있고 이전 버전이 남긴 값일 수도 있으므로,
// 불러올 때 모양을 검사하고 맞지 않으면 초기 상태로 되돌린다.

import {
  clampMinutes,
  createInitialState,
  GOAL_MAX_LENGTH,
  type PauseRecord,
  type SessionRecord,
  type SessionSet,
  type TimerSettings,
  type TimerState,
} from "./model.js";

export const STORAGE_KEY = "focus-timer:state";
const STORAGE_VERSION = 1;

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

  if (!isRecord(value) || value.version !== STORAGE_VERSION) {
    return createInitialState();
  }

  const settings = parseSettings(value.settings);
  if (!settings) return createInitialState();

  const active = value.active === null ? null : parseSessionSet(value.active);
  // 진행 중인 세트가 깨져 있으면 세트만 버리고 입력값은 살린다.
  return { settings, active };
}

function parseSettings(value: unknown): TimerSettings | null {
  if (
    !isRecord(value) ||
    typeof value.goal !== "string" ||
    !isFiniteNumber(value.focusMinutes) ||
    !isFiniteNumber(value.breakMinutes)
  ) {
    return null;
  }
  return {
    goal: value.goal.slice(0, GOAL_MAX_LENGTH),
    focusMinutes: clampMinutes("focus", value.focusMinutes),
    breakMinutes: clampMinutes("break", value.breakMinutes),
  };
}

function parseSessionSet(value: unknown): SessionSet | null {
  if (
    !isRecord(value) ||
    typeof value.goal !== "string" ||
    !isFiniteNumber(value.focusMinutes) ||
    !isFiniteNumber(value.breakMinutes) ||
    !Array.isArray(value.finished) ||
    !value.finished.every(isFinishedSession) ||
    !isSession(value.current) ||
    value.current.endedAt !== null
  ) {
    return null;
  }
  return {
    goal: value.goal.slice(0, GOAL_MAX_LENGTH),
    focusMinutes: clampMinutes("focus", value.focusMinutes),
    breakMinutes: clampMinutes("break", value.breakMinutes),
    finished: value.finished,
    current: value.current,
  };
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

/** localStorage에 접근할 수 없는 환경(서버, 차단된 브라우저)이면 null */
export function getBrowserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
