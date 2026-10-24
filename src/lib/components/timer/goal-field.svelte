<script lang="ts">
  import * as Field from "#lib/components/ui/field/index.js";
  import { Input } from "#lib/components/ui/input/index.js";
  import { GOAL_MAX_LENGTH } from "#lib/timer/model.js";

  interface Props {
    id: string;
    label?: string;
    value: string;
    /** 모바일 키보드의 Enter 키에 표시할 동작 */
    enterkeyhint?: "go" | "done";
    onValueChange: (value: string) => void;
  }

  let {
    id,
    label = "집중 목표",
    value,
    enterkeyhint = "go",
    onValueChange,
  }: Props = $props();
</script>

<!-- 입력값은 받은 그대로 넘긴다. 바로 다듬어 다시 쓰면 한글 IME 조합이 깨진다. -->
<Field.Field>
  <Field.Label for={id}>{label}</Field.Label>
  <Input
    {id}
    class="h-11 text-base"
    placeholder="무엇에 집중할까요?"
    maxlength={GOAL_MAX_LENGTH}
    autocomplete="off"
    {enterkeyhint}
    bind:value={() => value, (next) => onValueChange(next ?? "")}
  />
</Field.Field>
