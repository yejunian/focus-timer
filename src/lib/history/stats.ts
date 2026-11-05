// 기록 페이지에 보여 줄 일간 목록과 주간 통계를 이력에서 계산한다.
// 이력은 `localizeEntry`로 현지 시각을 붙여 둔 것을 받고, 날짜는 하루 시작 시각을 적용해 정한다.

import type { Concentration, HistoryEntry } from "#lib/timer/history.js";
import { getElapsedMs, getPausedMs } from "#lib/timer/model.js";
import {
  DAYS_PER_WEEK,
  getLogicalDay,
  type DayNumber,
  type LocalizedEntry,
} from "./day.js";

/** 일시정지한 시간을 뺀 실제 진행 시간. 휴식에는 일시정지가 없다. */
export function getEntryElapsedMs(entry: HistoryEntry): number {
  return entry.kind === "focus"
    ? getElapsedMs(entry, entry.endedAt)
    : Math.max(0, entry.endedAt - entry.startedAt);
}

// ---------- 일간 목록 ----------

interface DayRowBase {
  id: string;
  /** 현지 시작 시각 (`HH:mm`) */
  startTime: string;
  elapsedMs: number;
  /** 설정한 시간(분) */
  plannedMinutes: number;
}

export interface FocusDayRow extends DayRowBase {
  kind: "focus";
  /** 일시정지한 시간의 합과 횟수. 일시정지하지 않았으면 null */
  pause: { ms: number; count: number } | null;
  goal: string;
  outcome: string;
  concentration: Concentration;
}

export interface BreakDayRow extends DayRowBase {
  kind: "break";
}

export type DayRow = FocusDayRow | BreakDayRow;

/** `day`에 넣은 세션을 시작한 순서대로 나열한다. */
export function buildDayRows(
  entries: readonly LocalizedEntry[],
  day: DayNumber,
  dayStartHour: number,
): DayRow[] {
  return entries
    .filter(({ start }) => getLogicalDay(start, dayStartHour) === day)
    .sort(
      (a, b) =>
        a.entry.startedAt - b.entry.startedAt ||
        a.entry.endedAt - b.entry.endedAt,
    )
    .map(({ entry, start }) => {
      const base: DayRowBase = {
        id: entry.id,
        startTime: `${pad(start.hour)}:${pad(start.minute)}`,
        elapsedMs: getEntryElapsedMs(entry),
        plannedMinutes: entry.plannedMinutes,
      };
      if (entry.kind === "break") return { ...base, kind: "break" };
      return {
        ...base,
        kind: "focus",
        pause:
          entry.pauses.length > 0
            ? {
                ms: getPausedMs(entry, entry.endedAt),
                count: entry.pauses.length,
              }
            : null,
        goal: entry.goal,
        outcome: entry.outcome,
        concentration: entry.concentration,
      };
    });
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

// ---------- 주간 통계 ----------

export interface WeekDayCell {
  day: DayNumber;
  /** 집중 세션의 진행 시간 합 */
  focusMs: number;
  /** 집중이든 휴식이든 이 날에 넣은 세션이 있는지 */
  hasEntries: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export interface WeekRow {
  /** 월요일 */
  start: DayNumber;
  /** 집중 세션의 진행 시간 합 */
  focusMs: number;
  /** 집중이든 휴식이든 이 주에 넣은 세션이 있는지 */
  hasEntries: boolean;
  /**
   * 날짜별 집중도를 그날 집중 시간으로 가중 평균한 값(소수 첫째 자리까지 반올림).
   * 날짜별 집중도도 세션 진행 시간으로 가중 평균하므로, 그 주 집중 세션 전체의 가중 평균과 같다.
   * 집중 시간이 없으면 null
   */
  concentration: number | null;
  /** 월요일부터 일요일까지 */
  days: WeekDayCell[];
}

/** `firstWeekStart`(월요일)부터 `weekCount`주의 주간 통계 */
export function buildWeekRows(
  entries: readonly LocalizedEntry[],
  firstWeekStart: DayNumber,
  weekCount: number,
  dayStartHour: number,
  today: DayNumber,
): WeekRow[] {
  const dayCount = weekCount * DAYS_PER_WEEK;
  const focusMs = new Array<number>(dayCount).fill(0);
  /** 날짜별 Σ(집중도 × 진행 시간) */
  const weightedConcentration = new Array<number>(dayCount).fill(0);
  const hasEntries = new Array<boolean>(dayCount).fill(false);

  for (const { entry, start } of entries) {
    const index = getLogicalDay(start, dayStartHour) - firstWeekStart;
    if (index < 0 || index >= dayCount) continue;
    hasEntries[index] = true;
    if (entry.kind !== "focus") continue;
    const elapsedMs = getEntryElapsedMs(entry);
    focusMs[index] += elapsedMs;
    weightedConcentration[index] += entry.concentration * elapsedMs;
  }

  const rows: WeekRow[] = [];
  for (let week = 0; week < weekCount; week += 1) {
    const start = firstWeekStart + week * DAYS_PER_WEEK;
    const days: WeekDayCell[] = [];
    let weekFocusMs = 0;
    let weekWeighted = 0;
    for (let weekday = 0; weekday < DAYS_PER_WEEK; weekday += 1) {
      const index = week * DAYS_PER_WEEK + weekday;
      const day = start + weekday;
      days.push({
        day,
        focusMs: focusMs[index],
        hasEntries: hasEntries[index],
        isToday: day === today,
        isFuture: day > today,
      });
      weekFocusMs += focusMs[index];
      weekWeighted += weightedConcentration[index];
    }
    rows.push({
      start,
      focusMs: weekFocusMs,
      hasEntries: days.some((cell) => cell.hasEntries),
      concentration:
        weekFocusMs > 0
          ? // 10배 한 값을 반올림한다. 평균을 먼저 구해 toFixed로 반올림하면
            // 3.85 같은 경계값이 이진 소수 오차로 3.8이 될 수 있다.
            Math.round((weekWeighted * 10) / weekFocusMs) / 10
          : null,
      days,
    });
  }
  return rows;
}
