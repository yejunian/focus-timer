<script lang="ts">
  import CoffeeIcon from "@lucide/svelte/icons/coffee";
  import { Button, buttonVariants } from "#lib/components/ui/button/index.js";
  import * as Dialog from "#lib/components/ui/dialog/index.js";
  import * as Field from "#lib/components/ui/field/index.js";
  import { Textarea } from "#lib/components/ui/textarea/index.js";
  import { formatClock, formatSpokenDuration } from "#lib/timer/format.js";
  import {
    CONCENTRATION_LEVELS,
    OUTCOME_MAX_LENGTH,
    type Concentration,
    type FocusReview,
  } from "#lib/timer/history.js";

  interface Props {
    open: boolean;
    /** 마치려는 집중 세션의 목표 */
    goal: string;
    /** 지금까지의 진행 시간. 저장하기 전까지는 집중이 이어지므로 계속 흐른다. */
    elapsedMs: number;
    plannedMinutes: number;
    onSubmit: (review: FocusReview) => void;
  }

  let {
    open = $bindable(false),
    goal,
    elapsedMs,
    plannedMinutes,
    onSubmit,
  }: Props = $props();

  // 창을 닫았다 다시 열어도 입력한 내용은 남겨 둔다.
  // 다른 집중 세션을 마칠 때는 부모가 이 컴포넌트를 새로 만들어 비운다.
  let concentration = $state<Concentration | null>(null);
  let outcome = $state("");

  /** 양 끝 단계의 뜻. 스크린 리더는 숫자와 함께 읽는다. */
  const levelMeanings: Partial<Record<Concentration, string>> = {
    1: "낮음",
    5: "높음",
  };

  // 집중도는 필수다. 고르지 않으면 브라우저 기본 검증이 제출을 막는다.
  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (concentration === null) return;
    onSubmit({ outcome, concentration });
  }

  // 한 일은 여러 줄로 쓸 수 있으므로 Enter는 줄바꿈이고, Ctrl/Cmd+Enter로 저장한다.
  function handleOutcomeKeydown(
    event: KeyboardEvent & { currentTarget: HTMLTextAreaElement },
  ) {
    if (event.key !== "Enter" || event.isComposing) return;
    if (!event.metaKey && !event.ctrlKey) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }
</script>

<Dialog.Root bind:open>
  <!-- 높이가 낮은 가로 화면에서는 창을 넓혀 입력란을 두 칸으로 놓는다.
       그래도 화면보다 길어지면 창 안에서 스크롤한다. -->
  <Dialog.Content
    showCloseButton={false}
    class="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:short:max-w-2xl"
  >
    <form class="grid gap-5 short:gap-4" onsubmit={handleSubmit}>
      <Dialog.Header>
        <Dialog.Title>집중 세션 마무리</Dialog.Title>
        <Dialog.Description class="flex flex-col gap-1">
          {#if goal}
            <span
              class="font-medium wrap-break-word break-keep text-foreground"
            >
              <span class="sr-only">목표:</span>
              {goal}
            </span>
          {/if}
          <span class="tabular-nums">
            <span aria-hidden="true">
              집중 {formatClock(elapsedMs)} / {plannedMinutes}분
            </span>
            <span class="sr-only">
              {formatSpokenDuration(elapsedMs)} 집중, 설정한 시간 {plannedMinutes}분
            </span>
          </span>
        </Dialog.Description>
      </Dialog.Header>

      <div class="grid gap-5 short:gap-4 sm:short:grid-cols-2 sm:short:gap-6">
        <Field.Set class="gap-2">
          <!-- 필수 항목에는 *를 붙인다. 스크린 리더는 라디오 버튼의 required로 필수임을 읽는다. -->
          <Field.Legend variant="label">
            집중도<span class="ml-0.5 text-destructive" aria-hidden="true"
              >*</span
            >
          </Field.Legend>
          <div class="grid grid-cols-5 gap-2">
            {#each CONCENTRATION_LEVELS as level (level)}
              <!-- 기본 라디오 버튼을 투명하게 덮어 씌워 키보드 조작, 필수 검증을 그대로 쓴다. -->
              <label
                class="relative flex h-11 items-center justify-center rounded-lg border text-base font-medium tabular-nums transition-colors select-none not-has-checked:border-input not-has-checked:hover:bg-muted has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50 dark:not-has-checked:bg-input/30 dark:not-has-checked:hover:bg-input/50 short:h-10"
              >
                <input
                  type="radio"
                  name="concentration"
                  value={level}
                  required
                  class="absolute inset-0 cursor-pointer appearance-none opacity-0"
                  bind:group={concentration}
                />
                {level}
                {#if levelMeanings[level]}
                  <span class="sr-only">({levelMeanings[level]})</span>
                {/if}
              </label>
            {/each}
          </div>
          <div
            class="flex justify-between text-xs text-muted-foreground"
            aria-hidden="true"
          >
            <span>{levelMeanings[1]}</span>
            <span>{levelMeanings[5]}</span>
          </div>
        </Field.Set>

        <Field.Field>
          <Field.Label for="focus-outcome">한 일</Field.Label>
          <!-- 입력값은 받은 그대로 둔다. 바로 다듬어 다시 쓰면 한글 IME 조합이 깨지므로 저장할 때 다듬는다. -->
          <Textarea
            id="focus-outcome"
            class="max-h-40"
            placeholder="이번 집중에서 무엇을 했나요?"
            maxlength={OUTCOME_MAX_LENGTH}
            bind:value={outcome}
            onkeydown={handleOutcomeKeydown}
          />
        </Field.Field>
      </div>

      <Dialog.Footer>
        <Dialog.Close class={buttonVariants({ variant: "outline" })}>
          취소
        </Dialog.Close>
        <Button type="submit">
          <CoffeeIcon />
          저장하고 휴식 시작
        </Button>
      </Dialog.Footer>
    </form>
  </Dialog.Content>
</Dialog.Root>
