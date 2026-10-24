<script lang="ts">
  import PlusIcon from "@lucide/svelte/icons/plus";
  import { Button } from "#lib/components/ui/button/index.js";
  import { cn } from "#lib/utils.js";

  interface Props {
    /** 새 세션이 들어갈 자리 (0이면 맨 앞) */
    slot: number;
    /** 스크린 리더용 이름. 보이는 글자("세션 추가")를 포함해야 한다. */
    label: string;
    /** 세션을 끄는 동안에는 감춘다. */
    hidden?: boolean;
    onclick: () => void;
  }

  let { slot, label, hidden = false, onclick }: Props = $props();
</script>

<div
  class={cn(
    "flex items-center gap-3 py-2 transition-opacity",
    hidden && "pointer-events-none opacity-0",
  )}
>
  <div class="h-px flex-1 bg-border"></div>
  <Button
    variant="ghost"
    size="sm"
    class="text-muted-foreground"
    data-add-slot={slot}
    aria-label={label}
    {onclick}
  >
    <PlusIcon />
    세션 추가
  </Button>
  <div class="h-px flex-1 bg-border"></div>
</div>
