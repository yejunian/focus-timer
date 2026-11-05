// 기록 페이지의 날짜 계산.
//
// 날짜는 1970-01-01부터 센 날 수(`DayNumber`)로 다룬다. 시간대와 관계없는 달력의 날짜이므로
// UTC 기준의 Date 산술로 더하고 빼고 요일을 구한다.
//
// 세션은 시작 시각을 그 세션의 시간대로 바꾼 현지 날짜에 통째로 넣는다.
// 날짜 구분 시각(`dayStartHour`)보다 이른 시(hour)에 시작한 세션은 전날로 센다.

import type { HistoryEntry } from "#lib/timer/history.js";
import { getClientTimeZone, getDisplayTimeZone } from "#lib/timer/time-zone.js";

/** 1970-01-01부터 센 날 수 */
export type DayNumber = number;

const DAY_MS = 86_400_000;

export const DAYS_PER_WEEK = 7;

/** 월요일부터 시작하는 요일 이름 */
export const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

/** 현지 날짜와 시각 */
export interface LocalTime {
  day: DayNumber;
  hour: number;
  minute: number;
}

/** 시작 시각을 현지 시각으로 바꿔 둔 이력. 날짜 구분 시각을 바꿔도 다시 계산하지 않는다. */
export interface LocalizedEntry {
  entry: HistoryEntry;
  start: LocalTime;
}

/** 저장된 시간대 이름마다 만든 포매터. 만드는 비용이 커서 다시 쓴다. */
const formatters = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    // 숫자만 뽑아 쓰므로 형식이 단순한 en-US를 쓴다.
    // hour12: false는 엔진에 따라 자정을 24로 내므로 hourCycle을 정한다.
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: getDisplayTimeZone(timeZone),
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** `ms` 시각을 `timeZone`의 현지 날짜와 시각으로 바꾼다. 모르는 시간대면 이 브라우저의 시간대를 쓴다. */
export function getLocalTime(ms: number, timeZone: string): LocalTime {
  const values: Partial<Record<Intl.DateTimeFormatPartTypes, number>> = {};
  for (const part of getFormatter(timeZone).formatToParts(ms)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return {
    day: toDayNumber(values.year ?? 1970, values.month ?? 1, values.day ?? 1),
    hour: values.hour ?? 0,
    minute: values.minute ?? 0,
  };
}

export function localizeEntry(entry: HistoryEntry): LocalizedEntry {
  return { entry, start: getLocalTime(entry.startedAt, entry.timeZone) };
}

/** 날짜 구분 시각을 적용한 날짜. 그 시각보다 이르면 전날이다. */
export function getLogicalDay(
  time: LocalTime,
  dayStartHour: number,
): DayNumber {
  return time.hour < dayStartHour ? time.day - 1 : time.day;
}

/** 이 브라우저의 지금 시간대로 본 오늘 */
export function getToday(now: number, dayStartHour: number): DayNumber {
  return getLogicalDay(getLocalTime(now, getClientTimeZone()), dayStartHour);
}

export function toDayNumber(
  year: number,
  month: number,
  day: number,
): DayNumber {
  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
}

function toDate(day: DayNumber): { year: number; month: number; date: number } {
  const value = new Date(day * DAY_MS);
  return {
    year: value.getUTCFullYear(),
    month: value.getUTCMonth() + 1,
    date: value.getUTCDate(),
  };
}

/** 요일. 월요일이 0, 일요일이 6이다. */
export function getWeekday(day: DayNumber): number {
  // 1970-01-01은 목요일(3)이다.
  return (((day + 3) % 7) + 7) % 7;
}

/** 그 날짜가 든 주의 월요일 */
export function getWeekStart(day: DayNumber): DayNumber {
  return day - getWeekday(day);
}

/**
 * `first`부터 `last`까지의 날짜에 들 수 있는 이력의 시작 시각 범위 `[startMs, endMs)`.
 * 현지 날짜는 UTC 날짜보다 최대 14시간 빠르거나 12시간 늦고, 날짜 구분 시각만큼 더 늦어질 수 있다(최대 6시간).
 * 앞뒤로 하루씩 넉넉히 읽으므로 날짜 구분 시각이 바뀌어도 이 범위를 다시 읽지 않아도 된다.
 * 읽은 이력은 `getLogicalDay`로 다시 걸러야 한다.
 */
export function getQueryRange(
  first: DayNumber,
  last: DayNumber,
): { startMs: number; endMs: number } {
  return { startMs: (first - 1) * DAY_MS, endMs: (last + 2) * DAY_MS };
}

// ---------- 표시 문구 ----------

/** 일간 보기의 제목 (예: "11월 5일 (목)", 올해가 아니면 "2025년 11월 5일 (수)") */
export function formatDayTitle(day: DayNumber, today: DayNumber): string {
  const { year, month, date } = toDate(day);
  const prefix = year === toDate(today).year ? "" : `${year}년 `;
  return `${prefix}${month}월 ${date}일 (${WEEKDAY_LABELS[getWeekday(day)]})`;
}

/** 스크린 리더가 읽을 날짜 (예: "11월 3일 월요일") */
export function formatSpokenDay(day: DayNumber): string {
  const { month, date } = toDate(day);
  return `${month}월 ${date}일 ${WEEKDAY_LABELS[getWeekday(day)]}요일`;
}

/** 한 주의 기간 (예: "10/26 ~ 11/1") */
export function formatWeekPeriod(weekStart: DayNumber): string {
  const start = toDate(weekStart);
  const end = toDate(weekStart + DAYS_PER_WEEK - 1);
  return `${start.month}/${start.date} ~ ${end.month}/${end.date}`;
}

/** 스크린 리더가 읽을 한 주의 기간 (예: "10월 26일부터 11월 1일까지") */
export function formatSpokenWeekPeriod(weekStart: DayNumber): string {
  const start = toDate(weekStart);
  const end = toDate(weekStart + DAYS_PER_WEEK - 1);
  return `${start.month}월 ${start.date}일부터 ${end.month}월 ${end.date}일까지`;
}

/**
 * 여러 날에 걸친 기간의 제목 (예: "10월 12일 (월) ~ 11월 8일 (일)").
 * 해가 바뀌면 양쪽에, 올해가 아니면 앞쪽에 연도를 붙인다.
 */
export function formatRangeTitle(
  first: DayNumber,
  last: DayNumber,
  today: DayNumber,
): string {
  const start = toDate(first);
  const end = toDate(last);
  const thisYear = toDate(today).year;
  const crossesYear = start.year !== end.year;
  const startPrefix =
    crossesYear || start.year !== thisYear ? `${start.year}년 ` : "";
  const endPrefix = crossesYear ? `${end.year}년 ` : "";
  const startWeekday = WEEKDAY_LABELS[getWeekday(first)];
  const endWeekday = WEEKDAY_LABELS[getWeekday(last)];
  return `${startPrefix}${start.month}월 ${start.date}일 (${startWeekday}) ~ ${endPrefix}${end.month}월 ${end.date}일 (${endWeekday})`;
}
