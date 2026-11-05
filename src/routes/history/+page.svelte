<script lang="ts">
  import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
  import { tick } from "svelte";
  import { resolve } from "$app/paths";
  import DayStartSelect from "#lib/components/history/day-start-select.svelte";
  import DayView from "#lib/components/history/day-view.svelte";
  import WeeksView from "#lib/components/history/weeks-view.svelte";
  import { Button } from "#lib/components/ui/button/index.js";
  import * as Tabs from "#lib/components/ui/tabs/index.js";
  import type { DayNumber } from "#lib/history/day.js";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  const viewer = $derived(data.viewer);

  let view = $state("day");
  let dayHeading = $state<HTMLElement | null>(null);

  // 누른 날짜 칸은 숨겨지는 4주 보기에 있으므로, 일간 보기의 날짜 제목으로 초점을 옮긴다.
  async function openDay(day: DayNumber) {
    await viewer.showDay(day);
    view = "day";
    await tick();
    dayHeading?.focus();
  }
</script>

<svelte:head>
  <title>지난 기록 · 집중 타이머</title>
</svelte:head>

<main
  class="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10 short:gap-4 short:py-4"
>
  <header
    class="flex flex-col items-start gap-2 short:flex-row short:items-center short:gap-3"
  >
    <Button
      variant="ghost"
      href={resolve("/")}
      class="-ml-2.5 text-muted-foreground"
    >
      <ArrowLeftIcon />
      타이머
    </Button>
    <h1 class="text-2xl font-semibold sm:text-3xl short:text-xl">지난 기록</h1>
  </header>

  <!-- 숨긴 보기도 DOM에 남는다. 보기 안에 초점을 받는 버튼이 있으므로 보기 자체는 탭 순서에서 뺀다. -->
  <Tabs.Root bind:value={view} class="gap-4">
    <Tabs.List class="w-full sm:w-64">
      <Tabs.Trigger value="day">일간</Tabs.Trigger>
      <Tabs.Trigger value="weeks">4주</Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content value="day" tabindex={-1}>
      <DayView {viewer} bind:heading={dayHeading} />
    </Tabs.Content>
    <Tabs.Content value="weeks" tabindex={-1}>
      <WeeksView {viewer} onSelectDay={openDay} />
    </Tabs.Content>
  </Tabs.Root>

  <footer class="mt-auto border-t pt-6 short:pt-4">
    <DayStartSelect
      value={viewer.dayStartHour}
      onValueChange={(hour) => viewer.setDayStartHour(hour)}
    />
  </footer>
</main>
