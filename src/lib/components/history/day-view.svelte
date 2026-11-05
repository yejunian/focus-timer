<script lang="ts">
  import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
  import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
  import { Button } from "#lib/components/ui/button/index.js";
  import { formatDayTitle } from "#lib/history/day.js";
  import type { HistoryViewer } from "#lib/history/history-viewer.svelte.js";
  import {
    formatClock,
    formatPauseSummary,
    formatSpokenDuration,
    formatSpokenPauseSummary,
  } from "#lib/timer/format.js";
  import { cn } from "#lib/utils.js";
  import ConcentrationStars from "./concentration-stars.svelte";
  import { headerRowClass, rowBorderClass } from "./table-styles.js";

  interface Props {
    viewer: HistoryViewer;
    /** 날짜 제목. 4주 보기에서 날짜를 골라 넘어올 때 초점을 준다. */
    heading?: HTMLElement | null;
  }

  let { viewer, heading = $bindable(null) }: Props = $props();

  const title = $derived(formatDayTitle(viewer.day, viewer.today));
  const rows = $derived(viewer.dayRows);

  // 열 너비는 고정해 두어 행마다 내용이 달라도 열이 흔들리지 않게 한다.
  // 목표와 한 일은 넓은 화면에서만 "세션" 열 너비만큼 들여쓴다.
  const sessionColumnClass = "w-22 shrink-0";
  const detailsIndentClass = "sm:pl-42";
  const concentrationColumnClass = "w-20 shrink-0";
</script>

<section class="flex flex-col gap-3" aria-labelledby="day-view-title">
  <div class="flex items-center justify-between gap-2">
    <!-- 이전/다음 버튼으로 날짜를 옮기면 초점은 버튼에 남으므로 바뀐 날짜를 읽어 준다. -->
    <h2
      id="day-view-title"
      class="text-lg font-semibold tabular-nums outline-none"
      tabindex="-1"
      aria-live="polite"
      bind:this={heading}
    >
      {title}
    </h2>
    <div class="flex items-center gap-1">
      <Button
        variant="outline"
        size="icon"
        aria-label="이전 날"
        onclick={() => viewer.showPreviousDay()}
      >
        <ChevronLeftIcon />
      </Button>
      <!-- 이미 오늘이어도 누르면 기록을 다시 읽는다. -->
      <Button variant="outline" onclick={() => viewer.showToday()}>오늘</Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="다음 날"
        aria-disabled={!viewer.canShowNextDay || undefined}
        onclick={() => viewer.showNextDay()}
      >
        <ChevronRightIcon />
      </Button>
    </div>
  </div>

  {#if rows.length === 0}
    <p class="py-10 text-center text-muted-foreground">
      이날은 기록이 없습니다.
    </p>
  {:else}
    <div role="table" aria-labelledby="day-view-title" class="text-sm">
      <div role="row" class={cn("flex border-b pb-2", headerRowClass)}>
        <div role="columnheader" class={sessionColumnClass}>세션</div>
        <div role="columnheader" class={concentrationColumnClass}>집중도</div>
        <div role="columnheader" class="min-w-0 flex-1">진행 시간 / 목표 시간</div>
      </div>
      {#each rows as row (row.id)}
        <!-- 목표와 한 일은 같은 행의 마지막 칸으로 두고, 줄을 바꿔 아래에 놓는다. -->
        <div
          role="row"
          class={cn("flex flex-wrap items-baseline py-2.5", rowBorderClass)}
        >
          <div
            role="rowheader"
            class={cn(sessionColumnClass, "flex items-baseline gap-1.5")}
          >
            <span class="text-xs text-muted-foreground tabular-nums">
              <span aria-hidden="true">{row.startTime}~</span>
              <span class="sr-only">{row.startTime} 시작</span>
            </span>
            <span
              class={cn(
                "font-medium",
                row.kind === "focus"
                  ? "text-session-focus"
                  : "text-session-break",
              )}
            >
              {row.kind === "focus" ? "집중" : "휴식"}
            </span>
          </div>
          <div role="cell" class={concentrationColumnClass}>
            {#if row.kind === "focus"}
              <ConcentrationStars value={row.concentration} />
            {/if}
          </div>
          <div
            role="cell"
            class="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 tabular-nums"
          >
            <span class="whitespace-nowrap" aria-hidden="true">
              <span class="text-base font-semibold"
                >{formatClock(row.elapsedMs)}</span
              >
              / {row.plannedMinutes}분
            </span>
            <span class="sr-only">
              {formatSpokenDuration(row.elapsedMs)} 진행, 목표 {row.plannedMinutes}분{row.kind ===
                "focus" && row.pause
                ? ","
                : ""}
            </span>
            {#if row.kind === "focus" && row.pause}
              <!-- 좁은 화면에서는 진행 시간 아래 줄로 넘어간다. -->
              <span class="text-xs whitespace-nowrap text-muted-foreground">
                <span aria-hidden="true">
                  {formatPauseSummary(row.pause.ms, row.pause.count)}
                </span>
                <span class="sr-only">
                  {formatSpokenPauseSummary(row.pause.ms, row.pause.count)}
                </span>
              </span>
            {/if}
          </div>
          {#if row.kind === "focus" && (row.goal || row.outcome)}
            <div role="cell" class={cn("mt-2 basis-full", detailsIndentClass)}>
              <dl class="flex flex-col gap-1 wrap-break-word break-keep">
                {#if row.goal}
                  <div class="flex items-baseline gap-2">
                    <dt class="w-8 shrink-0 text-xs text-muted-foreground">
                      목표
                    </dt>
                    <dd class="min-w-0 flex-1 font-medium">{row.goal}</dd>
                  </div>
                {/if}
                {#if row.outcome}
                  <div class="flex items-baseline gap-2">
                    <dt class="w-8 shrink-0 text-xs text-muted-foreground">
                      결과
                    </dt>
                    <dd class="min-w-0 flex-1 whitespace-pre-line">
                      {row.outcome}
                    </dd>
                  </div>
                {/if}
              </dl>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</section>
