<script lang="ts">
  import CheckIcon from "@lucide/svelte/icons/check";
  import CoffeeIcon from "@lucide/svelte/icons/coffee";
  import PauseIcon from "@lucide/svelte/icons/pause";
  import PlayIcon from "@lucide/svelte/icons/play";
  import TargetIcon from "@lucide/svelte/icons/target";
  import { onMount } from "svelte";
  import { Button } from "#lib/components/ui/button/index.js";
  import type { FocusTimer } from "#lib/timer/focus-timer.svelte.js";
  import { formatClock } from "#lib/timer/format.js";
  import {
    getCurrentSession,
    isLastSession,
    type ActivePlan,
  } from "#lib/timer/model.js";
  import { cn } from "#lib/utils.js";
  import BreakOverview from "./break-overview.svelte";
  import DiscardSessionDialog from "./discard-session-dialog.svelte";
  import SessionProgress from "./session-progress.svelte";

  interface Props {
    timer: FocusTimer;
    active: ActivePlan;
    /** 처음 그려질 때 일시정지 버튼에 초점을 줄지 */
    autofocus?: boolean;
  }

  let { timer, active, autofocus = false }: Props = $props();

  // 집중과 휴식은 같은 컴포넌트로 그린다. 버튼 요소가 그대로 남으므로
  // "휴식 시작"을 누른 뒤에도 키보드 초점이 같은 자리("집중 시작")에 머문다.
  const isFocus = $derived(active.current.kind === "focus");
  const session = $derived(getCurrentSession(active));
  const isLast = $derived(isLastSession(active));
  const sessionCount = $derived(active.sessions.length);
  const plannedMinutes = $derived(
    isFocus ? session.focusMinutes : session.breakMinutes,
  );

  function handleMainAction() {
    if (isFocus) timer.startBreak();
    else if (isLast) timer.complete();
    else timer.startFocus();
  }

  const actionButtonClass = "h-12 min-w-36 px-5 text-base short:h-10";
  const cornerButtonClass = "text-muted-foreground";

  let pauseButton = $state<HTMLElement | null>(null);

  onMount(() => {
    if (autofocus) pauseButton?.focus();
  });
</script>

<main class="relative flex min-h-dvh flex-col">
  <div
    class="absolute top-3 right-3 sm:top-6 sm:right-6 short:top-2 short:right-2"
  >
    <!-- 집중 중에는 계획을 버릴 수 있고, 휴식 중에는 남은 세션을 건너뛰고 마칠 수 있다.
         마지막 휴식에서는 가운데의 "세션 완료" 버튼과 겹치므로 표시하지 않는다. -->
    {#if isFocus}
      <DiscardSessionDialog
        class={cn(
          cornerButtonClass,
          "hover:text-destructive dark:hover:text-destructive",
        )}
        onConfirm={() => timer.discard()}
      />
    {:else if !isLast}
      <Button
        variant="ghost"
        class={cornerButtonClass}
        onclick={() => timer.complete()}
      >
        <CheckIcon />
        세션 완료
      </Button>
    {/if}
  </div>

  <section
    class={cn(
      "flex flex-1 flex-col items-center justify-center gap-10 px-6 pt-20 pb-10 text-center sm:gap-12 short:gap-5 short:pt-12 short:pb-5",
      // 휴식 화면은 지난 집중, 다음 세션 정보까지 들어가므로 간격을 줄이고,
      // 높이가 낮은 가로 화면에서는 그 정보를 타이머 오른쪽에 둔다.
      !isFocus &&
        "gap-8 pt-16 sm:gap-8 short:pt-10 sm:short:flex-row sm:short:gap-8",
    )}
  >
    <div
      class={cn(
        "flex w-full flex-col items-center gap-10 sm:gap-12 short:gap-5",
        !isFocus && "gap-8 sm:gap-8 sm:short:w-auto sm:short:shrink-0",
      )}
    >
      <div class="flex w-full flex-col items-center gap-3 short:gap-2">
        <div class="flex items-center gap-2 text-sm font-medium">
          <h1
            class={cn(
              "flex items-center gap-1.5",
              isFocus ? "text-session-focus" : "text-session-break",
            )}
          >
            {#if isFocus}
              <TargetIcon class="size-4" />
              집중 세션
            {:else}
              <CoffeeIcon class="size-4" />
              휴식 세션
            {/if}
            {#if sessionCount > 1}
              <span class="text-muted-foreground tabular-nums">
                <span aria-hidden="true">{active.index + 1}/{sessionCount}</span
                >
                <span class="sr-only">
                  (세션 {sessionCount}개 중 {active.index + 1}번째)
                </span>
              </span>
            {/if}
          </h1>
          <p aria-live="polite" class="text-muted-foreground">
            {#if timer.paused}
              · 일시정지됨
            {/if}
          </p>
        </div>

        <p
          role="timer"
          class={cn(
            "text-7xl leading-none font-semibold tracking-tight tabular-nums transition-colors sm:text-8xl md:text-9xl short:text-6xl",
            timer.paused && "text-muted-foreground motion-safe:animate-pulse",
          )}
        >
          <span class="sr-only">진행 시간</span>
          {formatClock(timer.elapsedMs)}
        </p>

        <div
          class="mt-2 flex max-w-xl flex-col items-center gap-1.5 short:mt-0"
        >
          {#if isFocus && session.goal}
            <p
              class="text-lg font-medium text-balance wrap-break-word break-keep sm:text-xl"
            >
              <span class="sr-only">목표:</span>
              {session.goal}
            </p>
          {/if}
          <p class="text-muted-foreground">
            {isFocus ? "집중" : "휴식"} 시간 {plannedMinutes}분
          </p>
        </div>
      </div>

      <div class="flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="outline"
          size="lg"
          class={actionButtonClass}
          bind:ref={pauseButton}
          onclick={() => timer.togglePause()}
        >
          {#if timer.paused}
            <PlayIcon />
            재개
          {:else}
            <PauseIcon />
            일시정지
          {/if}
        </Button>

        <Button size="lg" class={actionButtonClass} onclick={handleMainAction}>
          {#if isFocus}
            <CoffeeIcon />
            휴식 시작
          {:else if isLast}
            <CheckIcon />
            세션 완료
          {:else}
            <TargetIcon />
            집중 시작
          {/if}
        </Button>
      </div>
    </div>

    {#if !isFocus}
      <BreakOverview {timer} {active} />
    {/if}
  </section>

  <div class="mx-auto w-full max-w-2xl px-6 pb-10 sm:pb-16 short:pb-5">
    <SessionProgress
      kind={active.current.kind}
      elapsedMs={timer.elapsedMs}
      plannedMs={timer.plannedMs}
    />
  </div>
</main>
