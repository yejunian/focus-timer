<script lang="ts">
  import { onMount } from "svelte";
  import IdleView from "#lib/components/timer/idle-view.svelte";
  import SessionView from "#lib/components/timer/session-view.svelte";
  import { FocusTimer } from "#lib/timer/focus-timer.svelte.js";
  import { formatClock } from "#lib/timer/format.js";
  import { getBrowserStorage } from "#lib/timer/storage.js";

  const timer = new FocusTimer(getBrowserStorage());

  $effect(() => timer.connect());

  // 페이지를 처음 열었을 때는 초점을 건드리지 않고,
  // 그 뒤 화면이 바뀔 때만 새 화면의 주요 버튼으로 초점을 옮긴다.
  let mounted = $state(false);
  onMount(() => {
    mounted = true;
  });

  const title = $derived.by(() => {
    if (!timer.active) return "집중 타이머";
    const label = timer.status === "focus" ? "집중" : "휴식";
    const paused = timer.paused ? " (일시정지)" : "";
    return `${formatClock(timer.elapsedMs)} ${label}${paused} · 집중 타이머`;
  });
</script>

<svelte:head>
  <title>{title}</title>
</svelte:head>

{#if timer.active}
  <SessionView {timer} active={timer.active} autofocus={mounted} />
{:else}
  <IdleView {timer} autofocus={mounted} />
{/if}
