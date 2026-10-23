<script lang="ts">
  import CheckIcon from "@lucide/svelte/icons/check";
  import CoffeeIcon from "@lucide/svelte/icons/coffee";
  import PauseIcon from "@lucide/svelte/icons/pause";
  import PlayIcon from "@lucide/svelte/icons/play";
  import TargetIcon from "@lucide/svelte/icons/target";
  import XIcon from "@lucide/svelte/icons/x";
  import { onMount } from "svelte";
  import { Button } from "#lib/components/ui/button/index.js";
  import type { FocusTimer } from "#lib/timer/focus-timer.svelte.js";
  import { formatClock } from "#lib/timer/format.js";
  import type { SessionSet } from "#lib/timer/model.js";
  import { cn } from "#lib/utils.js";
  import SessionProgress from "./session-progress.svelte";

  interface Props {
    timer: FocusTimer;
    session: SessionSet;
    /** 처음 그려질 때 일시정지 버튼에 초점을 줄지 */
    autofocus?: boolean;
  }

  let { timer, session, autofocus = false }: Props = $props();

  // 집중과 휴식은 같은 컴포넌트로 그린다. 버튼 요소가 그대로 남으므로
  // "휴식 시작"을 누른 뒤에도 키보드 초점이 같은 자리("집중 시작")에 머문다.
  const isFocus = $derived(session.current.kind === "focus");
  const plannedMinutes = $derived(
    isFocus ? session.focusMinutes : session.breakMinutes,
  );

  const actionButtonClass = "h-12 min-w-36 px-5 text-base short:h-10";

  let pauseButton = $state<HTMLElement | null>(null);

  onMount(() => {
    if (autofocus) pauseButton?.focus();
  });
</script>

<main class="relative flex min-h-dvh flex-col">
  <div
    class="absolute top-3 right-3 sm:top-6 sm:right-6 short:top-2 short:right-2"
  >
    <Button
      variant="ghost"
      class="text-muted-foreground hover:text-destructive dark:hover:text-destructive"
      onclick={() => timer.discard()}
    >
      <XIcon />
      세션 폐기
    </Button>
  </div>

  <section
    class="flex flex-1 flex-col items-center justify-center gap-10 px-6 pt-20 pb-10 text-center sm:gap-12 short:gap-5 short:pt-12 short:pb-5"
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

      <div class="mt-2 flex max-w-xl flex-col items-center gap-1.5 short:mt-0">
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

      <Button
        size="lg"
        class={actionButtonClass}
        onclick={() => (isFocus ? timer.startBreak() : timer.startFocus())}
      >
        {#if isFocus}
          <CoffeeIcon />
          휴식 시작
        {:else}
          <TargetIcon />
          집중 시작
        {/if}
      </Button>

      {#if !isFocus}
        <Button
          variant="secondary"
          size="lg"
          class={actionButtonClass}
          onclick={() => timer.complete()}
        >
          <CheckIcon />
          세션 완료
        </Button>
      {/if}
    </div>
  </section>

  <div class="mx-auto w-full max-w-2xl px-6 pb-10 sm:pb-16 short:pb-5">
    <SessionProgress
      kind={session.current.kind}
      elapsedMs={timer.elapsedMs}
      plannedMs={timer.plannedMs}
    />
  </div>
</main>
