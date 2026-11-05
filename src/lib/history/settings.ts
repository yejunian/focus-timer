// 기록 페이지의 설정. IndexedDB `state` 저장소의 `settings` 키에 둔다.
// 저장된 값은 다른 버전의 앱이 남긴 값일 수도 있으므로, 읽을 때 모양을 검사하고 모르는 필드는 남긴다.
//
// 기록 페이지는 다른 탭의 변경 알림을 듣지 않으므로 저장해도 알리지 않는다.
// 알리면 메인 화면 탭들이 쓸데없이 타이머 상태를 다시 읽는다.

import {
  requestResult,
  STATE_STORE,
  transactionDone,
} from "#lib/timer/database.js";

const SETTINGS_KEY = "settings";

/** 고를 수 있는 날짜 구분 시각 (자정부터 오전 6시까지) */
export const DAY_START_HOURS: readonly number[] = [0, 1, 2, 3, 4, 5, 6];

export const DEFAULT_DAY_START_HOUR = 4;

export interface Settings {
  /** 날짜 구분 시각(시). 이 시각보다 이르게 시작한 세션은 전날 기록으로 센다. */
  dayStartHour: number;
}

export function createDefaultSettings(): Settings {
  return { dayStartHour: DEFAULT_DAY_START_HOUR };
}

export function isDayStartHour(value: unknown): value is number {
  return DAY_START_HOURS.includes(value as number);
}

export function parseSettings(value: unknown): Settings {
  const record =
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  return {
    // 다른 버전의 앱이 더한 필드도 지우지 않고 남긴다.
    ...record,
    dayStartHour: isDayStartHour(record.dayStartHour)
      ? record.dayStartHour
      : DEFAULT_DAY_START_HOUR,
  };
}

/** 저장된 설정을 읽는다. 저장된 값이 없으면 기본값이다. 읽지 못하면 거부한다. */
export async function readSettings(db: IDBDatabase): Promise<Settings> {
  const transaction = db.transaction(STATE_STORE, "readonly");
  const value = await requestResult(
    transaction.objectStore(STATE_STORE).get(SETTINGS_KEY),
  );
  return parseSettings(value);
}

export async function writeSettings(
  db: IDBDatabase,
  settings: Settings,
): Promise<void> {
  const transaction = db.transaction(STATE_STORE, "readwrite");
  const done = transactionDone(transaction);
  try {
    transaction.objectStore(STATE_STORE).put(settings, SETTINGS_KEY);
  } catch (error) {
    done.catch(() => {});
    transaction.abort();
    throw error;
  }
  await done;
}
