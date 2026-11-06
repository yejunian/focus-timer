// 타이머 상태와 세션 이력을 IndexedDB에 저장하고 불러온다.
// 저장된 값은 이전 버전이 남긴 값일 수도 있고 개발자 도구로 고친 값일 수도 있으므로,
// 불러올 때 모양을 검사하고 맞지 않으면 초기 상태로 되돌리거나 버린다.

import {
  HISTORY_STARTED_AT_INDEX,
  HISTORY_STORE,
  notifyChange,
  requestResult,
  STATE_STORE,
  transactionDone,
} from "./database.js";
import {
  isConcentration,
  type ClosedPause,
  type HistoryEntry,
} from "./history.js";
import {
  clampMinutes,
  createInitialState,
  GOAL_MAX_LENGTH,
  type ActivePlan,
  type EndedSessionRecord,
  type PauseRecord,
  type SessionPlan,
  type SessionRecord,
  type TimerState,
} from "./model.js";
import { getClientTimeZone } from "./time-zone.js";

/** state 저장소에서 타이머 상태를 두는 키 */
const TIMER_STATE_KEY = "timer";

/** 저장된 타이머 상태를 읽는다. 저장된 값이 없으면 초기 상태다. 읽지 못하면 거부한다. */
export async function readTimerState(db: IDBDatabase): Promise<TimerState> {
  const transaction = db.transaction(STATE_STORE, "readonly");
  const value = await requestResult(
    transaction.objectStore(STATE_STORE).get(TIMER_STATE_KEY),
  );
  return parseState(value);
}

/**
 * 타이머 상태를 저장하고 다른 탭에 알린다. `entry`가 있으면 같은 트랜잭션에서 이력에 더한다.
 * 같은 세션의 이력이 이미 있으면(다른 탭에서 먼저 끝낸 경우) ConstraintError로 거부하고, 상태도 저장하지 않는다.
 */
export async function writeTimerState(
  db: IDBDatabase,
  state: TimerState,
  entry: HistoryEntry | null,
): Promise<void> {
  const stores = entry ? [STATE_STORE, HISTORY_STORE] : [STATE_STORE];
  const transaction = db.transaction(stores, "readwrite");
  const done = transactionDone(transaction);
  try {
    transaction.objectStore(STATE_STORE).put(state, TIMER_STATE_KEY);
    if (entry) transaction.objectStore(HISTORY_STORE).add(entry);
  } catch (error) {
    // 값을 복제하지 못하는 등 요청을 넣지 못하면, 상태와 이력 중 하나만 저장되지 않도록 모두 취소한다.
    done.catch(() => {});
    transaction.abort();
    throw error;
  }
  await done;
  notifyChange();
}

/**
 * 시작 시각이 `[startMs, endMs)`인 이력을 시작 시각 순으로 읽는다. 깨진 이력은 빼고 돌려준다.
 * 읽지 못하면 거부한다.
 */
export async function readHistoryEntries(
  db: IDBDatabase,
  startMs: number,
  endMs: number,
): Promise<HistoryEntry[]> {
  const transaction = db.transaction(HISTORY_STORE, "readonly");
  const values = await requestResult(
    transaction
      .objectStore(HISTORY_STORE)
      .index(HISTORY_STARTED_AT_INDEX)
      .getAll(IDBKeyRange.bound(startMs, endMs, false, true)),
  );
  const entries: HistoryEntry[] = [];
  for (const value of values) {
    const entry = parseHistoryEntry(value);
    if (entry) entries.push(entry);
  }
  return entries;
}

/**
 * 저장된 이력 하나. 깨져 있으면 null
 * 시간대가 없으면(시간대를 기록하기 전의 이력) 읽는 지금 이 브라우저의 시간대로 채운다.
 * 목표나 한 일이 없으면 빈 문자열로 채운다.
 */
export function parseHistoryEntry(value: unknown): HistoryEntry | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    !isFiniteNumber(value.startedAt) ||
    !isFiniteNumber(value.endedAt) ||
    !isFiniteNumber(value.plannedMinutes)
  ) {
    return null;
  }
  const base = {
    id: value.id,
    startedAt: value.startedAt,
    endedAt: value.endedAt,
    timeZone:
      typeof value.timeZone === "string" ? value.timeZone : getClientTimeZone(),
    plannedMinutes: value.plannedMinutes,
  };

  if (value.kind === "break") return { ...base, kind: "break" };
  if (
    value.kind !== "focus" ||
    !Array.isArray(value.pauses) ||
    !value.pauses.every(isClosedPause) ||
    !isConcentration(value.concentration)
  ) {
    return null;
  }
  return {
    ...base,
    kind: "focus",
    pauses: value.pauses,
    goal: typeof value.goal === "string" ? value.goal : "",
    outcome: typeof value.outcome === "string" ? value.outcome : "",
    concentration: value.concentration,
  };
}

export function parseState(value: unknown): TimerState {
  if (!isRecord(value)) return createInitialState();

  const plan = parseSessions(value.plan);
  if (!plan) return createInitialState();

  const active = value.active === null ? null : parseActivePlan(value.active);
  // 진행 중인 계획이 깨져 있으면 그것만 버리고 대기 화면의 계획은 살린다.
  return { plan, active };
}

function parseActivePlan(value: unknown): ActivePlan | null {
  if (!isRecord(value)) return null;
  const sessions = parseSessions(value.sessions);
  const finished = parseSessionRecords(value.finished);
  const current = parseSessionRecord(value.current);
  if (
    !sessions ||
    !isIndex(value.index, sessions.length) ||
    !finished?.every(isEnded) ||
    !current ||
    current.endedAt !== null
  ) {
    return null;
  }
  return { sessions, index: value.index, finished, current };
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

/** 집중/휴식 세션 기록 목록. 하나라도 깨져 있으면 null */
function parseSessionRecords(value: unknown): SessionRecord[] | null {
  if (!Array.isArray(value)) return null;
  const records = value.map(parseSessionRecord);
  return records.every((record) => record !== null) ? records : null;
}

/**
 * 집중/휴식 세션 기록. 깨져 있으면 null
 * 시간대가 없으면(시간대를 기록하기 전의 값) 불러오는 지금 이 브라우저의 시간대로 채운다.
 * 시간대가 문자열이면 이 브라우저가 모르는 이름이어도 그대로 둔다.
 */
function parseSessionRecord(value: unknown): SessionRecord | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    (value.kind !== "focus" && value.kind !== "break") ||
    !isFiniteNumber(value.startedAt) ||
    !isNullableNumber(value.endedAt) ||
    !Array.isArray(value.pauses) ||
    !value.pauses.every(isPause)
  ) {
    return null;
  }
  // 열린 일시정지는 마지막 하나만 허용한다.
  const openIndex = value.pauses.findIndex((pause) => pause.endedAt === null);
  if (openIndex !== -1 && openIndex !== value.pauses.length - 1) return null;

  return {
    // 다른 버전의 앱이 더한 필드도 지우지 않고 남긴다.
    ...value,
    id: value.id,
    kind: value.kind,
    startedAt: value.startedAt,
    endedAt: value.endedAt,
    pauses: value.pauses,
    timeZone:
      typeof value.timeZone === "string" ? value.timeZone : getClientTimeZone(),
  };
}

function isEnded(record: SessionRecord): record is EndedSessionRecord {
  return record.endedAt !== null;
}

function isPause(value: unknown): value is PauseRecord {
  return (
    isRecord(value) &&
    isFiniteNumber(value.startedAt) &&
    isNullableNumber(value.endedAt)
  );
}

function isClosedPause(value: unknown): value is ClosedPause {
  return (
    isRecord(value) &&
    isFiniteNumber(value.startedAt) &&
    isFiniteNumber(value.endedAt)
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
