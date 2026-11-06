// 끝난 집중/휴식 세션 하나의 이력.
// IndexedDB의 history 저장소에 세션마다 하나씩 쌓고, 저장한 뒤에는 고치지 않는다.
//
// 배포한 뒤에는 이미 저장된 이력을 그대로 읽을 수 있어야 한다.
// 필드를 지우거나 이름, 뜻, 단위를 바꾸지 말고, 필요하면 새 필드를 더한다.
// 새 필드는 예전 이력에 없으므로 읽는 쪽에서 없는 경우를 처리한다.

import type { EndedSessionRecord, SessionPlan } from "./model.js";

/** 목표 수행 결과의 최대 길이 */
export const OUTCOME_MAX_LENGTH = 500;

/** 집중도. 1(낮음)부터 5(높음)까지의 정수 */
export type Concentration = 1 | 2 | 3 | 4 | 5;

export const CONCENTRATION_LEVELS: readonly Concentration[] = [1, 2, 3, 4, 5];

/** 집중 세션을 마칠 때 사용자가 돌아본 내용 */
export interface FocusReview {
  /** 목표 수행 결과. 집중하는 동안 한 일 */
  outcome: string;
  concentration: Concentration;
}

export interface ClosedPause {
  startedAt: number;
  endedAt: number;
}

interface HistoryEntryBase {
  /** 세션을 시작할 때 매긴 id(`SessionRecord.id`). history 저장소의 키다. */
  id: string;
  /** 세션을 시작한 시각 (Unix epoch 밀리초) */
  startedAt: number;
  /** 세션을 끝낸 시각 (Unix epoch 밀리초) */
  endedAt: number;
  /**
   * 세션을 시작할 때 클라이언트의 IANA 시간대 이름 (예: "Asia/Seoul").
   * 시작, 종료, 일시정지 시각을 진행 당시의 현지 시각으로 나타낼 때 모두 이 시간대를 쓴다.
   * 기록한 브라우저가 알려 준 이름 그대로이므로, 읽는 브라우저가 모르는 이름일 수도 있다.
   * 그때도 이 값은 바꾸지 않고, 표시할 때만 `getDisplayTimeZone`으로 읽는 브라우저의 시간대를 쓴다.
   */
  timeZone: string;
  /** 원래 목표로 정한 시간(분) */
  plannedMinutes: number;
}

export interface FocusHistoryEntry extends HistoryEntryBase {
  kind: "focus";
  /** 일시정지한 구간 (시간순) */
  pauses: ClosedPause[];
  /** 세션을 시작하기 전에 정한 목표. 없으면 빈 문자열 */
  goal: string;
  /** 목표 수행 결과. 없으면 빈 문자열 */
  outcome: string;
  concentration: Concentration;
}

export interface BreakHistoryEntry extends HistoryEntryBase {
  kind: "break";
}

export type HistoryEntry = FocusHistoryEntry | BreakHistoryEntry;

export function isConcentration(value: unknown): value is Concentration {
  return CONCENTRATION_LEVELS.includes(value as Concentration);
}

/** 끝난 집중 세션의 이력 */
export function createFocusEntry(
  plan: SessionPlan,
  record: EndedSessionRecord,
  review: FocusReview,
): FocusHistoryEntry {
  return {
    id: record.id,
    kind: "focus",
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    timeZone: record.timeZone,
    plannedMinutes: plan.focusMinutes,
    pauses: record.pauses.map((pause) => ({
      startedAt: pause.startedAt,
      endedAt: pause.endedAt ?? record.endedAt,
    })),
    goal: plan.goal,
    outcome: review.outcome.trim().slice(0, OUTCOME_MAX_LENGTH),
    concentration: review.concentration,
  };
}

/** 끝난 휴식 세션의 이력 */
export function createBreakEntry(
  plan: SessionPlan,
  record: EndedSessionRecord,
): BreakHistoryEntry {
  return {
    id: record.id,
    kind: "break",
    startedAt: record.startedAt,
    endedAt: record.endedAt,
    timeZone: record.timeZone,
    plannedMinutes: plan.breakMinutes,
  };
}
