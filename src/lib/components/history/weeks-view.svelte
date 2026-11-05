<script lang="ts">
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import { Button } from "#lib/components/ui/button/index.js";
  import {
    DAYS_PER_WEEK,
    formatRangeTitle,
    formatSpokenDay,
    formatSpokenWeekPeriod,
    formatWeekPeriod,
    WEEKDAY_LABELS,
    type DayNumber,
  } from "#lib/history/day.js";
  import {
    WEEK_COUNT,
    type HistoryViewer,
  } from "#lib/history/history-viewer.svelte.js";
  import type { WeekDayCell } from "#lib/history/stats.js";
  import {
    formatHoursMinutes,
    formatSpokenHoursMinutes,
  } from "#lib/timer/format.js";
  import { cn } from "#lib/utils.js";
  import ConcentrationStars from "./concentration-stars.svelte";
  import { headerRowClass, rowBorderClass } from "./table-styles.js";

  interface Props {
    viewer: HistoryViewer;
    /** 기록이 있는 날짜 칸을 누르면 그 날짜로 부른다. */
    onSelectDay: (day: DayNumber) => void;
  }

  let { viewer, onSelectDay }: Props = $props();

  const title = $derived(
    formatRangeTitle(
      viewer.weeksStart,
      viewer.weeksStart + WEEK_COUNT * DAYS_PER_WEEK - 1,
      viewer.today,
    ),
  );
  const rows = $derived(viewer.weekRows);

  // 열 너비는 내용과 관계없이 정해 두어 기간을 옮겨도 열이 흔들리지 않게 한다.
  // 넓은 화면에서는 기간, 합계, 집중도를 고정 폭으로 두고, 요일 칸은 남은 폭을 똑같이 나눈다.
  // 좁은 화면에서는 한 주를 두 줄로 놓는다. 윗줄은 기간, 합계, 집중도이고 아랫줄은 요일 칸이다.
  const periodColumnClass = "min-w-0 flex-1 sm:w-28 sm:flex-none";
  const totalColumnClass = "w-12 shrink-0 text-right sm:w-14 sm:text-center";
  const concentrationColumnClass =
    "flex w-18 shrink-0 justify-end sm:w-20 sm:justify-center";
  const dayColumnClass = "min-w-0 flex-1 basis-0 text-center";
</script>

<section class="flex flex-col gap-3" aria-labelledby="weeks-view-title">
  <!-- 좁은 화면에서는 기간 제목이 길어지므로 이동 버튼을 아래 줄로 내린다. -->
  <div
    class="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between"
  >
    <h2
      id="weeks-view-title"
      class="text-lg font-semibold break-keep tabular-nums"
      aria-live="polite"
    >
      {title}
    </h2>
    <div class="flex shrink-0 items-center gap-1 self-end">
      <Button
        variant="outline"
        size="icon"
        aria-label="이전 4주"
        onclick={() => viewer.showPreviousWeeks()}
      >
        <ChevronLeftIcon />
      </Button>
      <!-- 이미 최근 4주여도 누르면 기록을 다시 읽는다. -->
      <Button variant="outline" onclick={() => viewer.showLatestWeeks()}>
        최근
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="다음 4주"
        aria-disabled={!viewer.canShowNextWeeks || undefined}
        onclick={() => viewer.showNextWeeks()}
      >
        <ChevronRightIcon />
      </Button>
    </div>
  </div>

  <div
    role="table"
    aria-labelledby="weeks-view-title"
    class="text-sm tabular-nums"
  >
    <!-- 좁은 화면에서는 머리글을 숨기고 요일 칸마다 요일을 쓴다. 스크린 리더는 계속 머리글을 읽는다. -->
    <div
      role="row"
      class={cn(
        "sr-only sm:not-sr-only sm:flex sm:items-center sm:border-b",
        headerRowClass,
      )}
    >
      <div role="columnheader" class={cn(periodColumnClass, "pb-2")}>기간</div>
      <div role="columnheader" class={cn(totalColumnClass, "pb-2")}>합계</div>
      <div role="columnheader" class={cn(concentrationColumnClass, "pb-2")}>
        집중도
      </div>
      {#each WEEKDAY_LABELS as label (label)}
        <div role="columnheader" class={cn(dayColumnClass, "pb-2")}>
          {label}
        </div>
      {/each}
    </div>

    {#each rows as week (week.start)}
      <div
        role="row"
        class={cn(
          "flex flex-col gap-1.5 py-2 sm:flex-row sm:items-center sm:gap-0",
          rowBorderClass,
        )}
      >
        <!-- 넓은 화면에서는 두 묶음을 풀어(display: contents) 모든 칸을 한 줄에 놓는다. -->
        <div role="none" class="flex items-center gap-3 sm:contents">
          <div
            role="rowheader"
            class={cn(periodColumnClass, "font-medium whitespace-nowrap")}
          >
            <span aria-hidden="true">{formatWeekPeriod(week.start)}</span>
            <span class="sr-only">{formatSpokenWeekPeriod(week.start)}</span>
          </div>
          <div role="cell" class={cn(totalColumnClass, "font-semibold")}>
            {#if week.hasEntries}
              <span aria-hidden="true">{formatHoursMinutes(week.focusMs)}</span>
              <span class="sr-only">
                {formatSpokenHoursMinutes(week.focusMs)}
              </span>
            {:else}
              <span class="text-muted-foreground/60" aria-hidden="true">–</span>
              <span class="sr-only">기록 없음</span>
            {/if}
          </div>
          <div role="cell" class={concentrationColumnClass}>
            {#if week.concentration === null}
              <span class="text-muted-foreground/60" aria-hidden="true">–</span>
              <span class="sr-only">없음</span>
            {:else}
              <ConcentrationStars value={week.concentration} />
            {/if}
          </div>
        </div>

        <div role="none" class="flex sm:contents">
          {#each week.days as cell, weekday (cell.day)}
            <div role="cell" class={cn(dayColumnClass, "px-0.5")}>
              {@render dayCell(cell, WEEKDAY_LABELS[weekday])}
            </div>
          {/each}
        </div>
      </div>
    {/each}
  </div>
</section>

{#snippet dayCell(cell: WeekDayCell, weekdayLabel: string)}
  <!-- 좁은 화면에서는 시간 위에 요일을 쓴다. 오늘은 배경과 굵은 글씨로 표시한다. -->
  {@const boxClass = cn(
    "flex w-full flex-col items-center gap-0.5 rounded-md py-1",
    cell.isToday && "bg-muted font-semibold",
  )}
  {@const weekdayClass = "text-xs font-normal text-muted-foreground sm:hidden"}
  {#if cell.hasEntries}
    <button
      type="button"
      class={cn(
        boxClass,
        "transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
      )}
      aria-current={cell.isToday ? "date" : undefined}
      aria-label="{formatSpokenDay(cell.day)}, 집중 {formatSpokenHoursMinutes(
        cell.focusMs,
      )}"
      onclick={() => onSelectDay(cell.day)}
    >
      <span class={weekdayClass} aria-hidden="true">{weekdayLabel}</span>
      <span>{formatHoursMinutes(cell.focusMs)}</span>
    </button>
  {:else}
    <!-- 기록이 없는 날. 아직 오지 않은 날은 시간 자리를 비워 둔다. -->
    <span class={boxClass} aria-current={cell.isToday ? "date" : undefined}>
      <span class={weekdayClass} aria-hidden="true">{weekdayLabel}</span>
      {#if cell.isFuture}
        <span aria-hidden="true">&nbsp;</span>
      {:else}
        <span class="text-muted-foreground/60" aria-hidden="true">–</span>
        <span class="sr-only">기록 없음</span>
      {/if}
    </span>
  {/if}
{/snippet}
