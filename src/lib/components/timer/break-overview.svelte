<script lang="ts">
  import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
  import CheckIcon from "@lucide/svelte/icons/check";
  import type { FocusTimer } from "#lib/timer/focus-timer.svelte.js";
  import { formatClock, formatSpokenDuration } from "#lib/timer/format.js";
  import {
    DURATION_LIMITS,
    getCurrentSession,
    getElapsedMs,
    getLastFocusRecord,
    getNextSession,
    type ActivePlan,
  } from "#lib/timer/model.js";
  import { cn } from "#lib/utils.js";
  import DurationField from "./duration-field.svelte";
  import GoalField from "./goal-field.svelte";

  interface Props {
    timer: FocusTimer;
    active: ActivePlan;
  }

  let { timer, active }: Props = $props();

  // 휴식은 같은 세션의 집중 바로 뒤에 오므로, 지난 집중의 계획은 지금 세션의 계획이다.
  const previous = $derived(getCurrentSession(active));
  const next = $derived(getNextSession(active));

  /** 지난 집중의 진행 시간과, 설정한 시간 대비 비율(5% 단위로 반올림) */
  const previousResult = $derived.by(() => {
    const record = getLastFocusRecord(active);
    if (record?.endedAt == null) return null;
    const elapsedMs = getElapsedMs(record, record.endedAt);
    // 화면의 m:ss와 맞추려고 초 단위로 내린 뒤 비교한다.
    // 정수로 계산해야 102.5% 같은 경계값이 소수 오차 없이 105%로 올라간다.
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const plannedSeconds = previous.focusMinutes * 60;
    const percent = Math.round((elapsedSeconds * 20) / plannedSeconds) * 5;
    return { elapsedMs, percent };
  });

  const headingClass =
    "flex items-center gap-1.5 text-sm font-medium text-muted-foreground";
</script>

<div
  class={cn(
    "grid w-full gap-6 short:gap-3",
    // 다음 세션 입력란이 있으면 그 왼쪽 끝에 맞추고, 지난 집중만 있으면 가운데에 둔다.
    next ? "max-w-xl text-left sm:short:max-w-md" : "max-w-sm text-center",
  )}
>
  <section class="flex flex-col gap-1.5">
    <div
      class={cn(
        "flex flex-wrap items-center gap-x-1 text-sm text-muted-foreground",
        !next && "justify-center",
      )}
    >
      <h2 class={headingClass}>
        <CheckIcon class="size-4 text-session-focus" />
        지난 집중
      </h2>
      {#if previousResult}
        <p class="tabular-nums">
          <span aria-hidden="true">
            · {formatClock(previousResult.elapsedMs)} / {previous.focusMinutes}분
            ({previousResult.percent}%)
          </span>
          <span class="sr-only">
            {formatSpokenDuration(previousResult.elapsedMs)} 진행, 설정한 {previous.focusMinutes}분의
            {previousResult.percent}%
          </span>
        </p>
      {/if}
    </div>
    {#if previous.goal}
      <p class="font-medium wrap-break-word break-keep">
        <span class="sr-only">목표:</span>
        {previous.goal}
      </p>
    {/if}
  </section>

  {#if next}
    <section class="flex flex-col gap-3 short:gap-2">
      <h2 class={headingClass}>
        <ArrowRightIcon class="size-4 text-session-focus" />
        다음 세션
      </h2>
      <div class="grid grid-cols-2 gap-3 sm:gap-4 short:gap-y-2">
        <div class="col-span-2">
          <GoalField
            id="next-session-goal"
            value={next.goal}
            enterkeyhint="done"
            onValueChange={(goal) => timer.updateNextSession({ goal })}
          />
        </div>
        <DurationField
          id="next-session-focus-minutes"
          label="집중 시간"
          value={next.focusMinutes}
          min={DURATION_LIMITS.focus.min}
          max={DURATION_LIMITS.focus.max}
          step={5}
          onValueChange={(focusMinutes) =>
            timer.updateNextSession({ focusMinutes })}
        />
        <DurationField
          id="next-session-break-minutes"
          label="휴식 시간"
          value={next.breakMinutes}
          min={DURATION_LIMITS.break.min}
          max={DURATION_LIMITS.break.max}
          step={1}
          onValueChange={(breakMinutes) =>
            timer.updateNextSession({ breakMinutes })}
        />
      </div>
    </section>
  {/if}
</div>
