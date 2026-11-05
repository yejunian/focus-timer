<script lang="ts">
  import StarIcon from "@lucide/svelte/icons/star";
  import { CONCENTRATION_LEVELS } from "#lib/timer/history.js";
  import { cn } from "#lib/utils.js";

  interface Props {
    /** 집중도. 주간 평균처럼 소수일 수 있다. */
    value: number;
    class?: string;
  }

  let { value, class: className }: Props = $props();

  /** 별마다 채울 비율 (0–1). 3.4면 별 셋을 다 채우고 넷째 별을 40% 채운다. */
  const fills = $derived(
    CONCENTRATION_LEVELS.map((level) =>
      Math.min(1, Math.max(0, value - (level - 1))),
    ),
  );
</script>

<span class={cn("inline-flex items-center gap-0.5", className)}>
  {#each fills as fill, index (index)}
    <!-- 빈 별 위에 채운 별을 왼쪽부터 비율만큼만 보이게 겹친다. -->
    <span class="relative size-3" aria-hidden="true">
      <StarIcon class="absolute inset-0 size-3 text-muted-foreground/30" />
      {#if fill > 0}
        <span
          class="absolute inset-y-0 left-0 overflow-hidden"
          style:width="{fill * 100}%"
        >
          <StarIcon class="size-3 fill-current text-muted-foreground" />
        </span>
      {/if}
    </span>
  {/each}
  <span class="sr-only">{CONCENTRATION_LEVELS.length}점 중 {value}점</span>
</span>
