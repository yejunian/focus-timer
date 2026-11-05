import { getDatabase } from "#lib/timer/database.js";
import { readHistoryEntries } from "#lib/timer/storage.js";
import {
  DAYS_PER_WEEK,
  getQueryRange,
  getToday,
  getWeekStart,
  localizeEntry,
  type DayNumber,
  type LocalizedEntry,
} from "./day.js";
import {
  createDefaultSettings,
  isDayStartHour,
  readSettings,
  writeSettings,
  type Settings,
} from "./settings.js";
import {
  buildDayRows,
  buildWeekRows,
  type DayRow,
  type WeekRow,
} from "./stats.js";

/** 4주 보기에서 한 번에 보여 주는 주 수 */
export const WEEK_COUNT = 4;

const WEEKS_SPAN = WEEK_COUNT * DAYS_PER_WEEK;

interface DayView {
  day: DayNumber;
  entries: readonly LocalizedEntry[];
}

interface WeeksView {
  /** 맨 위 행인 주의 월요일 */
  start: DayNumber;
  entries: readonly LocalizedEntry[];
}

/**
 * 기록 페이지의 상태. 일간 보기와 4주 보기에 보여 줄 이력을 함께 들고 있다.
 *
 * 사용자가 날짜를 옮기거나 설정을 바꿀 때만 이력을 다시 읽고 "오늘"을 다시 계산한다.
 * 다른 탭에서 기록이 바뀌거나 날짜가 넘어가도 저절로 바뀌지 않는다.
 *
 * 새 날짜를 고르면 그 날짜의 이력을 다 읽은 뒤에 날짜와 이력을 한꺼번에 바꾼다.
 * 그래서 제목만 먼저 바뀌거나 빈 목록이 잠깐 보이지 않는다.
 */
export class HistoryViewer {
  /** null이면 IndexedDB를 쓸 수 없어 기록이 없는 것으로 보이고, 설정은 메모리에서만 유지한다. */
  #db: IDBDatabase | null;
  #settings: Settings;
  #today: DayNumber;
  #dayView: DayView;
  #weeksView: WeeksView;

  // 보려고 고른 날짜와 주. 읽기가 끝나야 보이는 상태가 이 값으로 바뀐다.
  // 버튼을 빠르게 여러 번 눌러도 이 값을 기준으로 옮기므로 날짜를 건너뛰지 않는다.
  #targetDay: DayNumber;
  #targetWeeksStart: DayNumber;
  // 읽기를 시작할 때마다 늘린다. 늦게 끝난 예전 읽기의 결과는 버린다.
  #dayRequest = 0;
  #weeksRequest = 0;

  #dayRows = $derived.by(() =>
    buildDayRows(
      this.#dayView.entries,
      this.#dayView.day,
      this.#settings.dayStartHour,
    ),
  );

  #weekRows = $derived.by(() =>
    buildWeekRows(
      this.#weeksView.entries,
      this.#weeksView.start,
      WEEK_COUNT,
      this.#settings.dayStartHour,
      this.#today,
    ),
  );

  /** 저장된 설정과 오늘, 최근 4주의 이력을 읽어 만든다. */
  static async load(): Promise<HistoryViewer> {
    const db = await getDatabase();
    let settings = createDefaultSettings();
    if (db) {
      try {
        settings = await readSettings(db);
      } catch {
        // 읽지 못하면 기본 설정을 쓴다.
      }
    }
    const today = getToday(Date.now(), settings.dayStartHour);
    const weeksStart = getLatestWeeksStart(today);
    const [dayEntries, weeksEntries] = await Promise.all([
      readEntries(db, today, today),
      readEntries(db, weeksStart, weeksStart + WEEKS_SPAN - 1),
    ]);
    return new HistoryViewer(
      db,
      settings,
      today,
      { day: today, entries: dayEntries },
      { start: weeksStart, entries: weeksEntries },
    );
  }

  private constructor(
    db: IDBDatabase | null,
    settings: Settings,
    today: DayNumber,
    dayView: DayView,
    weeksView: WeeksView,
  ) {
    this.#db = db;
    this.#settings = $state.raw(settings);
    this.#today = $state(today);
    this.#dayView = $state.raw(dayView);
    this.#weeksView = $state.raw(weeksView);
    this.#targetDay = dayView.day;
    this.#targetWeeksStart = weeksView.start;
  }

  get dayStartHour(): number {
    return this.#settings.dayStartHour;
  }

  /** 마지막으로 계산한 오늘. 사용자가 조작할 때만 다시 계산한다. */
  get today(): DayNumber {
    return this.#today;
  }

  /** 일간 보기에 보이는 날짜 */
  get day(): DayNumber {
    return this.#dayView.day;
  }

  get dayRows(): DayRow[] {
    return this.#dayRows;
  }

  /** 4주 보기의 맨 위 행인 주의 월요일 */
  get weeksStart(): DayNumber {
    return this.#weeksView.start;
  }

  get weekRows(): WeekRow[] {
    return this.#weekRows;
  }

  /** 다음 날로 갈 수 있는지. 오늘보다 뒤로는 갈 수 없다. */
  get canShowNextDay(): boolean {
    return this.#dayView.day < this.#today;
  }

  /** 다음 4주로 갈 수 있는지. 이번 주가 맨 아래 행이면 더 갈 수 없다. */
  get canShowNextWeeks(): boolean {
    return this.#weeksView.start < getLatestWeeksStart(this.#today);
  }

  /** 일간 보기를 `day`로 옮긴다. 그 날짜의 이력을 다 읽으면 이행한다. */
  async showDay(day: DayNumber): Promise<void> {
    this.#updateToday();
    this.#targetDay = day;
    const request = ++this.#dayRequest;
    const entries = await readEntries(this.#db, day, day);
    if (request !== this.#dayRequest) return;
    this.#dayView = { day, entries };
  }

  showPreviousDay(): void {
    void this.showDay(this.#targetDay - 1);
  }

  showNextDay(): void {
    this.#updateToday();
    if (this.#targetDay >= this.#today) return;
    void this.showDay(this.#targetDay + 1);
  }

  showToday(): void {
    this.#updateToday();
    void this.showDay(this.#today);
  }

  showPreviousWeeks(): void {
    void this.#showWeeks(this.#targetWeeksStart - WEEKS_SPAN);
  }

  showNextWeeks(): void {
    this.#updateToday();
    const latest = getLatestWeeksStart(this.#today);
    if (this.#targetWeeksStart >= latest) return;
    void this.#showWeeks(Math.min(this.#targetWeeksStart + WEEKS_SPAN, latest));
  }

  /** 이번 주를 맨 아래 행으로 하는 4주를 보여 준다. */
  showLatestWeeks(): void {
    this.#updateToday();
    void this.#showWeeks(getLatestWeeksStart(this.#today));
  }

  /**
   * 하루 시작 시각을 바꾼다. 화면은 바로 바꾸고 저장은 기다리지 않는다.
   * 오늘이 바뀔 수 있으므로, 오늘이나 최근 4주를 보고 있었으면 새 오늘을 따라간다.
   */
  setDayStartHour(hour: number): void {
    if (!isDayStartHour(hour) || hour === this.#settings.dayStartHour) return;

    const followDay = this.#targetDay === this.#today;
    const followWeeks =
      this.#targetWeeksStart === getLatestWeeksStart(this.#today);

    this.#settings = { ...this.#settings, dayStartHour: hour };
    if (this.#db) {
      // 저장하지 못하면 이 페이지에서만 바뀐 시각을 쓴다.
      writeSettings(this.#db, this.#settings).catch(() => {});
    }

    // 읽어 둔 이력은 하루 시작 시각과 관계없이 넉넉한 범위라서 바로 다시 나눌 수 있다.
    // 사용자가 조작한 때이므로 새 이력도 다시 읽어 온다.
    this.#updateToday();
    void this.showDay(followDay ? this.#today : this.#targetDay);
    void this.#showWeeks(
      followWeeks ? getLatestWeeksStart(this.#today) : this.#targetWeeksStart,
    );
  }

  async #showWeeks(start: DayNumber): Promise<void> {
    this.#targetWeeksStart = start;
    const request = ++this.#weeksRequest;
    const entries = await readEntries(this.#db, start, start + WEEKS_SPAN - 1);
    if (request !== this.#weeksRequest) return;
    this.#weeksView = { start, entries };
  }

  #updateToday(): void {
    this.#today = getToday(Date.now(), this.#settings.dayStartHour);
  }
}

/** 이번 주를 맨 아래 행으로 하는 4주의 첫 월요일 */
function getLatestWeeksStart(today: DayNumber): DayNumber {
  return getWeekStart(today) - (WEEK_COUNT - 1) * DAYS_PER_WEEK;
}

/** `first`부터 `last`까지의 날짜에 들 수 있는 이력. 읽지 못하면 빈 목록이다. */
async function readEntries(
  db: IDBDatabase | null,
  first: DayNumber,
  last: DayNumber,
): Promise<LocalizedEntry[]> {
  if (!db) return [];
  const { startMs, endMs } = getQueryRange(first, last);
  try {
    const entries = await readHistoryEntries(db, startMs, endMs);
    return entries.map(localizeEntry);
  } catch {
    return [];
  }
}
