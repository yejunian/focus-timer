<script lang="ts">
  import GripVerticalIcon from "@lucide/svelte/icons/grip-vertical";
  import Trash2Icon from "@lucide/svelte/icons/trash-2";
  import { Button } from "#lib/components/ui/button/index.js";
  import * as Field from "#lib/components/ui/field/index.js";
  import type { SessionPlan, SessionPlanPatch } from "#lib/timer/model.js";
  import { cn } from "#lib/utils.js";
  import GoalField from "./goal-field.svelte";
  import SessionDurationFields from "./session-duration-fields.svelte";

  interface Props {
    session: SessionPlan;
    /** 목록에서의 순서 (1부터) */
    number: number;
    /** 순서 바꾸기 손잡이와 삭제 버튼을 보여 줄지. 세션이 둘 이상일 때만 켠다. */
    editable: boolean;
    /** 끌고 있는 중인지 */
    dragging?: boolean;
    /** 손잡이 버튼을 설명하는 요소의 id */
    handleDescription?: string;
    onChange: (patch: SessionPlanPatch) => void;
    onRemove: () => void;
    onHandlePointerDown: (event: PointerEvent) => void;
    onHandleKeyDown: (event: KeyboardEvent) => void;
  }

  let {
    session,
    number,
    editable,
    dragging = false,
    handleDescription,
    onChange,
    onRemove,
    onHandlePointerDown,
    onHandleKeyDown,
  }: Props = $props();

  const titleId = $derived(`session-${session.id}-title`);
</script>

<div
  role="group"
  aria-labelledby={titleId}
  class={cn(
    "flex flex-col gap-4 rounded-xl border bg-background p-4 transition-shadow",
    dragging && "bg-card shadow-xl ring-2 ring-ring/60",
  )}
>
  <div class="-my-1 flex min-h-8 items-center gap-1">
    {#if editable}
      <Button
        id="session-{session.id}-handle"
        variant="ghost"
        size="icon"
        class={cn(
          "-ml-2 cursor-grab touch-none text-muted-foreground",
          dragging && "cursor-grabbing",
        )}
        aria-label="세션 {number} 순서 바꾸기"
        aria-describedby={handleDescription}
        onpointerdown={onHandlePointerDown}
        onkeydown={onHandleKeyDown}
      >
        <GripVerticalIcon />
      </Button>
    {/if}
    <h2 id={titleId} class="flex-1 text-sm font-medium">세션 {number}</h2>
    {#if editable}
      <Button
        variant="ghost"
        size="icon"
        class="-mr-2 text-muted-foreground hover:text-destructive dark:hover:text-destructive"
        aria-label="세션 {number} 삭제"
        onclick={onRemove}
      >
        <Trash2Icon />
      </Button>
    {/if}
  </div>

  <Field.Group>
    <GoalField
      id="session-{session.id}-goal"
      value={session.goal}
      onValueChange={(goal) => onChange({ goal })}
    />
    <div class="grid grid-cols-2 gap-3 sm:gap-4">
      <SessionDurationFields
        idPrefix="session-{session.id}"
        {session}
        {onChange}
      />
    </div>
  </Field.Group>
</div>
