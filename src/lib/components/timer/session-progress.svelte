<script lang="ts">
  import { Progress } from "#lib/components/ui/progress/index.js";
  import { formatClock, formatSpokenDuration } from "#lib/timer/format.js";
  import type { SessionKind } from "#lib/timer/model.js";
  import { cn } from "#lib/utils.js";

  interface Props {
    kind: SessionKind;
    elapsedMs: number;
    plannedMs: number;
  }

  let { kind, elapsedMs, plannedMs }: Props = $props();

  // 화면에 보이는 m:ss와 어긋나지 않도록 초 단위로 내림해서 비교한다.
  const elapsedSeconds = $derived(Math.floor(elapsedMs / 1000));
  const plannedSeconds = $derived(Math.floor(plannedMs / 1000));
  const overtime = $derived(elapsedSeconds > plannedSeconds);
  /** 남은 시간, 또는 설정한 시간을 넘긴 만큼의 시간 */
  const gapMs = $derived(Math.abs(plannedSeconds - elapsedSeconds) * 1000);
  const percent = $derived(
    plannedMs > 0 ? Math.min(100, (elapsedMs / plannedMs) * 100) : 0,
  );

  const indicatorColor = $derived(
    overtime
      ? "*:data-[slot=progress-indicator]:bg-session-overtime"
      : kind === "focus"
        ? "*:data-[slot=progress-indicator]:bg-session-focus"
        : "*:data-[slot=progress-indicator]:bg-session-break",
  );
</script>

<div class="flex flex-col gap-2.5">
  <Progress
    value={percent}
    max={100}
    aria-label={kind === "focus" ? "집중 진행률" : "휴식 진행률"}
    aria-valuetext={overtime
      ? `설정한 시간보다 ${formatSpokenDuration(gapMs)} 더 진행함`
      : `${formatSpokenDuration(gapMs)} 남음`}
    class={cn("h-2", indicatorColor)}
  />
  <div
    class="flex items-center justify-between text-sm text-muted-foreground tabular-nums"
    aria-hidden="true"
  >
    <span>{overtime ? "초과 시간" : "남은 시간"}</span>
    <span class={cn(overtime && "font-medium text-session-overtime")}>
      {overtime ? "+" : ""}{formatClock(gapMs)}
    </span>
  </div>
</div>
