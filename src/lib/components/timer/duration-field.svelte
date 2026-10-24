<script lang="ts">
  import MinusIcon from "@lucide/svelte/icons/minus";
  import PlusIcon from "@lucide/svelte/icons/plus";
  import * as Field from "#lib/components/ui/field/index.js";
  import * as InputGroup from "#lib/components/ui/input-group/index.js";

  interface Props {
    id: string;
    label: string;
    /** 확정된 값(분) */
    value: number;
    min: number;
    max: number;
    /** -/+ 버튼 한 번에 바뀌는 분 */
    step: number;
    onValueChange: (value: number) => void;
  }

  let { id, label, value, min, max, step, onValueChange }: Props = $props();

  // 입력 중인 값. 범위를 벗어난 값도 잠시 보여 줄 수 있도록 확정된 값과 따로 둔다.
  // 확정된 값이 바뀌면 다시 그 값을 따라간다.
  let draft = $derived<number | null>(value);
  const invalid = $derived(!isValid(draft));

  function isValid(minutes: number | null): minutes is number {
    return (
      minutes !== null &&
      Number.isInteger(minutes) &&
      minutes >= min &&
      minutes <= max
    );
  }

  function clamp(minutes: number): number {
    return Math.min(max, Math.max(min, Math.round(minutes)));
  }

  function handleInput(next: number | null) {
    draft = next;
    if (isValid(next)) onValueChange(next);
  }

  // 입력을 마치면 범위 안으로 맞추고, 비어 있으면 원래 값으로 되돌린다.
  function handleBlur() {
    const next =
      draft !== null && Number.isFinite(draft) ? clamp(draft) : value;
    draft = next;
    onValueChange(next);
  }

  const atMin = $derived(value <= min);
  const atMax = $derived(value >= max);

  // step 단위로 맞춰 움직인다. (5분 단위일 때 23 → 25, 23 → 20)
  function stepBy(direction: 1 | -1) {
    if (direction > 0 ? atMax : atMin) return;
    const snapped =
      direction > 0
        ? Math.floor(value / step) * step + step
        : Math.ceil(value / step) * step - step;
    onValueChange(clamp(snapped));
  }
</script>

<!-- 범위 끝에 닿은 -/+ 버튼은 disabled 대신 aria-disabled로 표시한다.
     흐리게 보이지 않고, 누르고 있던 버튼의 초점도 풀리지 않는다. 눌러도 값은 그대로다. -->
<Field.Field>
  <Field.Label for={id}>
    <span
      >{label} <span class="font-normal text-muted-foreground">(분)</span></span
    >
  </Field.Label>
  <InputGroup.Root class="h-11">
    <InputGroup.Addon align="inline-start">
      <InputGroup.Button
        size="icon-sm"
        aria-label="{label} {step}분 줄이기"
        aria-disabled={atMin || undefined}
        onclick={() => stepBy(-1)}
      >
        <MinusIcon />
      </InputGroup.Button>
    </InputGroup.Addon>
    <InputGroup.Input
      {id}
      type="number"
      inputmode="numeric"
      {min}
      {max}
      step={1}
      required
      aria-invalid={invalid || undefined}
      class="[appearance:textfield] text-center text-base tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      bind:value={() => draft, handleInput}
      onblur={handleBlur}
    />
    <InputGroup.Addon align="inline-end">
      <InputGroup.Button
        size="icon-sm"
        aria-label="{label} {step}분 늘리기"
        aria-disabled={atMax || undefined}
        onclick={() => stepBy(1)}
      >
        <PlusIcon />
      </InputGroup.Button>
    </InputGroup.Addon>
  </InputGroup.Root>
</Field.Field>
