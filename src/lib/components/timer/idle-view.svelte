<script lang="ts">
  import PlayIcon from "@lucide/svelte/icons/play";
  import { onMount } from "svelte";
  import { Button } from "#lib/components/ui/button/index.js";
  import type { FocusTimer } from "#lib/timer/focus-timer.svelte.js";
  import PlanList from "./plan-list.svelte";

  interface Props {
    timer: FocusTimer;
    /** 처음 그려질 때 시작 버튼에 초점을 줄지 */
    autofocus?: boolean;
  }

  let { timer, autofocus = false }: Props = $props();

  let startButton = $state<HTMLElement | null>(null);

  /** 세션이 여러 개일 때 보여 줄 전체 계획 요약 */
  const summary = $derived.by(() => {
    const { plan } = timer;
    if (plan.length < 2) return null;
    let focusMinutes = 0;
    let breakMinutes = 0;
    for (const session of plan) {
      focusMinutes += session.focusMinutes;
      breakMinutes += session.breakMinutes;
    }
    return `세션 ${plan.length}개 · 집중 ${focusMinutes}분 · 휴식 ${breakMinutes}분`;
  });

  onMount(() => {
    if (autofocus) startButton?.focus();
  });

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    timer.start();
  }
</script>

<main
  class="flex min-h-dvh items-center justify-center px-6 py-10 short:items-start short:py-6"
>
  <form
    class="flex w-full max-w-md flex-col gap-6 short:gap-4"
    onsubmit={handleSubmit}
  >
    <header class="flex flex-col gap-2 text-center">
      <h1 class="text-2xl font-semibold sm:text-3xl">집중 타이머</h1>
      <p class="text-muted-foreground">
        목표와 시간을 정하고 집중 세션을 시작하세요.
      </p>
    </header>

    <PlanList {timer} />

    <div class="flex flex-col gap-3">
      {#if summary}
        <p class="text-center text-sm text-muted-foreground tabular-nums">
          {summary}
        </p>
      {/if}
      <Button
        type="submit"
        size="lg"
        class="h-12 w-full text-base"
        bind:ref={startButton}
      >
        <PlayIcon />
        집중 시작
      </Button>
    </div>
  </form>
</main>
