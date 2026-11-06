<script lang="ts">
  import { Label } from "#lib/components/ui/label/index.js";
  import * as Select from "#lib/components/ui/select/index.js";
  import { DAY_START_HOURS } from "#lib/history/settings.js";

  interface Props {
    value: number;
    onValueChange: (hour: number) => void;
  }

  let { value, onValueChange }: Props = $props();

  function formatHour(hour: number): string {
    return hour === 0 ? "자정" : `오전 ${hour}시`;
  }
</script>

<div
  class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
>
  <div class="flex flex-col gap-1.5">
    <Label for="day-start-hour">날짜 구분 시각</Label>
    <p
      id="day-start-hour-description"
      class="text-sm break-keep text-muted-foreground"
    >
      {formatHour(value)} 기준으로 날짜를 구분합니다.
    </p>
  </div>
  <Select.Root
    type="single"
    bind:value={() => String(value), (next) => onValueChange(Number(next))}
  >
    <Select.Trigger
      id="day-start-hour"
      class="w-32 shrink-0"
      aria-describedby="day-start-hour-description"
    >
      {formatHour(value)}
    </Select.Trigger>
    <Select.Content>
      {#each DAY_START_HOURS as hour (hour)}
        <Select.Item value={String(hour)} label={formatHour(hour)} />
      {/each}
    </Select.Content>
  </Select.Root>
</div>
