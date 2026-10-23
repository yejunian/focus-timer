<script lang="ts">
  import PlayIcon from "@lucide/svelte/icons/play";
  import { onMount } from "svelte";
  import { Button } from "#lib/components/ui/button/index.js";
  import * as Field from "#lib/components/ui/field/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import type { FocusTimer } from "#lib/timer/focus-timer.svelte.js";
  import { DURATION_LIMITS, GOAL_MAX_LENGTH } from "#lib/timer/model.js";
  import DurationField from "./duration-field.svelte";

  interface Props {
    timer: FocusTimer;
    /** 처음 그려질 때 시작 버튼에 초점을 줄지 */
    autofocus?: boolean;
  }

  let { timer, autofocus = false }: Props = $props();

  let startButton = $state<HTMLElement | null>(null);

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
    class="flex w-full max-w-md flex-col gap-8 short:gap-5"
    onsubmit={handleSubmit}
  >
    <header class="flex flex-col gap-2 text-center">
      <h1 class="text-2xl font-semibold sm:text-3xl">집중 타이머</h1>
      <p class="text-muted-foreground">
        목표와 시간을 정하고 집중 세션을 시작하세요.
      </p>
    </header>

    <Field.Group>
      <Field.Field>
        <Field.Label for="goal">집중 목표</Field.Label>
        <Input
          id="goal"
          class="h-11 text-base"
          placeholder="무엇에 집중할까요?"
          maxlength={GOAL_MAX_LENGTH}
          autocomplete="off"
          enterkeyhint="go"
          bind:value={
            () => timer.settings.goal,
            (goal) => timer.updateSettings({ goal: goal ?? "" })
          }
        />
      </Field.Field>

      <div class="grid grid-cols-2 gap-3 sm:gap-4">
        <DurationField
          id="focus-minutes"
          label="집중 시간"
          value={timer.settings.focusMinutes}
          min={DURATION_LIMITS.focus.min}
          max={DURATION_LIMITS.focus.max}
          step={5}
          onValueChange={(focusMinutes) =>
            timer.updateSettings({ focusMinutes })}
        />
        <DurationField
          id="break-minutes"
          label="휴식 시간"
          value={timer.settings.breakMinutes}
          min={DURATION_LIMITS.break.min}
          max={DURATION_LIMITS.break.max}
          step={1}
          onValueChange={(breakMinutes) =>
            timer.updateSettings({ breakMinutes })}
        />
      </div>
    </Field.Group>

    <Button
      type="submit"
      size="lg"
      class="h-12 w-full text-base"
      bind:ref={startButton}
    >
      <PlayIcon />
      집중 시작
    </Button>
  </form>
</main>
