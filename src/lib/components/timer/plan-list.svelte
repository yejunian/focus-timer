<script lang="ts">
  import { tick } from "svelte";
  import { prefersReducedMotion } from "svelte/motion";
  import type { FocusTimer } from "#lib/timer/focus-timer.svelte.js";
  import { cn } from "#lib/utils.js";
  import AddSessionButton from "./add-session-button.svelte";
  import PlanItem from "./plan-item.svelte";

  interface Props {
    timer: FocusTimer;
  }

  let { timer }: Props = $props();

  /** 놓은 항목이 제자리로 미끄러져 들어가는 시간. 아래 `duration-150`과 맞춘다. */
  const SETTLE_MS = 150;
  /** 화면 위아래 가장자리에서 이만큼 안쪽까지 끌고 가면 자동으로 스크롤한다. */
  const SCROLL_EDGE = 64;
  /** 자동 스크롤의 최대 속도 (프레임당 px) */
  const SCROLL_SPEED = 16;

  const HANDLE_DESCRIPTION_ID = "plan-reorder-description";

  /** 세션이 둘 이상이면 순서를 바꾸거나 지울 수 있다. */
  const editable = $derived(timer.plan.length > 1);

  let root = $state<HTMLElement | null>(null);
  let announcement = $state("");

  interface DragState {
    id: number;
    from: number;
    /** 지금 놓으면 들어갈 자리 */
    to: number;
    pointerId: number;
    /** 끌기 시작할 때 포인터의 문서 기준 y 좌표 */
    startY: number;
    /** 마지막으로 받은 포인터의 화면 기준 y 좌표 */
    clientY: number;
    /** 끄는 항목을 원래 자리에서 옮겨 그린 거리 */
    offset: number;
    /** 끌기 시작할 때 각 항목의 문서 기준 위쪽 좌표와 높이 */
    tops: number[];
    heights: number[];
    /** 놓은 뒤 제자리로 들어가는 중인지 */
    settling: boolean;
  }

  let drag = $state<DragState | null>(null);
  let scrollFrame = 0;
  let settleTimeout: ReturnType<typeof setTimeout> | undefined;

  $effect(() => () => {
    cancelAnimationFrame(scrollFrame);
    clearTimeout(settleTimeout);
  });

  function getAddLabel(slot: number, count: number): string {
    if (slot === 0) return "맨 앞에 세션 추가";
    if (slot === count) return "맨 뒤에 세션 추가";
    return `세션 ${slot}, ${slot + 1} 사이에 세션 추가`;
  }

  async function announce(message: string) {
    // 같은 문장을 다시 넣어도 읽어 주도록 한 번 비운다.
    announcement = "";
    await tick();
    announcement = message;
  }

  async function addSession(slot: number) {
    timer.addSession(slot);
    await tick();
    const session = timer.plan[slot];
    if (session) document.getElementById(`session-${session.id}-goal`)?.focus();
  }

  async function removeSession(id: number, index: number) {
    timer.removeSession(id);
    announce("세션을 삭제했습니다.");
    await tick();
    // 지운 세션이 있던 자리의 "세션 추가" 버튼으로 초점을 옮긴다.
    root
      ?.querySelector<HTMLElement>(`[data-add-slot="${index}"]`)
      ?.focus({ preventScroll: true });
  }

  async function moveSession(id: number, to: number, scrollIntoView: boolean) {
    // 항목의 DOM 위치가 바뀌면 그 안에 있던 초점이 풀릴 수 있어서 다시 맞춘다.
    const focused = document.activeElement;
    timer.moveSession(id, to);
    announce(`세션을 ${to + 1}번째로 옮겼습니다.`);
    await tick();
    if (
      focused instanceof HTMLElement &&
      focused.isConnected &&
      document.activeElement !== focused
    ) {
      focused.focus({ preventScroll: true });
    }
    if (scrollIntoView) {
      document
        .getElementById(`session-${id}-handle`)
        ?.scrollIntoView({ block: "nearest" });
    }
  }

  function handleHandleKeyDown(
    event: KeyboardEvent,
    id: number,
    index: number,
  ) {
    const step =
      event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
    if (step === 0 || drag) return;
    event.preventDefault();
    const to = index + step;
    if (to >= 0 && to < timer.plan.length) moveSession(id, to, true);
  }

  // ---------- 끌어서 순서 바꾸기 ----------
  // 마우스와 터치를 함께 다루려고 Pointer Events로 직접 구현한다.
  // 끄는 동안에는 transform으로 보이는 위치만 옮기고, 놓을 때 한 번만 상태를 바꾼다.

  function getItemElements(): HTMLElement[] {
    return timer.plan.flatMap((session) => {
      const item = root?.querySelector<HTMLElement>(
        `[data-session-id="${session.id}"]`,
      );
      return item ? [item] : [];
    });
  }

  function handleHandlePointerDown(
    event: PointerEvent,
    id: number,
    index: number,
  ) {
    if (drag || !event.isPrimary || event.button !== 0) return;
    const items = getItemElements();
    if (items.length !== timer.plan.length) return;

    // 글자가 선택되지 않게 한다.
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);

    const rects = items.map((item) => item.getBoundingClientRect());
    drag = {
      id,
      from: index,
      to: index,
      pointerId: event.pointerId,
      startY: event.clientY + window.scrollY,
      clientY: event.clientY,
      offset: 0,
      tops: rects.map((rect) => rect.top + window.scrollY),
      heights: rects.map((rect) => rect.height),
      settling: false,
    };
    scrollFrame = requestAnimationFrame(autoScroll);
  }

  function isDragPointer(event: PointerEvent): boolean {
    return (
      drag !== null && !drag.settling && event.pointerId === drag.pointerId
    );
  }

  function handlePointerMove(event: PointerEvent) {
    if (!isDragPointer(event)) return;
    drag!.clientY = event.clientY;
    updateDrag();
  }

  function handlePointerUp(event: PointerEvent) {
    if (isDragPointer(event)) drop(false);
  }

  function handlePointerCancel(event: PointerEvent) {
    if (isDragPointer(event)) drop(true);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key !== "Escape" || !drag || drag.settling) return;
    event.preventDefault();
    drop(true);
  }

  function handleScroll() {
    if (drag && !drag.settling) updateDrag();
  }

  /** 포인터 위치에 맞춰 끄는 항목을 옮기고, 놓으면 들어갈 자리를 계산한다. */
  function updateDrag() {
    if (!drag) return;
    const { from, tops, heights } = drag;
    const last = tops.length - 1;

    // 목록의 위아래 끝을 넘어가지 않게 한다.
    const minOffset = tops[0] - tops[from];
    const maxOffset = tops[last] + heights[last] - (tops[from] + heights[from]);
    const offset = Math.min(
      maxOffset,
      Math.max(minOffset, drag.clientY + window.scrollY - drag.startY),
    );

    // 아래로 끌 때는 끄는 항목의 아래 끝이, 위로 끌 때는 위 끝이 이웃 항목의 가운데를 넘으면
    // 자리를 바꾼다. 가운데끼리 비교하면 높이가 다른 항목을 맨 끝까지 옮기지 못할 수 있다.
    const top = tops[from] + offset;
    const bottom = top + heights[from];
    const middle = (index: number) => tops[index] + heights[index] / 2;
    let to = from;
    if (offset > 0) {
      while (to < last && bottom > middle(to + 1)) to += 1;
    } else {
      while (to > 0 && top < middle(to - 1)) to -= 1;
    }

    drag.offset = offset;
    drag.to = to;
  }

  /** 화면 가장자리 가까이 끌고 가면 그쪽으로 스크롤한다. */
  function autoScroll() {
    if (!drag || drag.settling) return;
    const { clientY } = drag;
    const bottomEdge = window.innerHeight - SCROLL_EDGE;
    const depth =
      clientY < SCROLL_EDGE
        ? clientY - SCROLL_EDGE
        : clientY > bottomEdge
          ? clientY - bottomEdge
          : 0;
    if (depth !== 0) {
      const ratio = Math.max(-1, Math.min(1, depth / SCROLL_EDGE));
      window.scrollBy(0, Math.round(ratio * SCROLL_SPEED) || Math.sign(ratio));
      updateDrag();
    }
    scrollFrame = requestAnimationFrame(autoScroll);
  }

  /** 끄는 항목을 `from`에서 `to`로 옮겼을 때 원래 자리에서 떨어지는 거리 */
  function getSettledOffset({ from, to, heights }: DragState): number {
    let distance = 0;
    for (let i = Math.min(from, to); i <= Math.max(from, to); i += 1) {
      if (i !== from) distance += heights[i];
    }
    return to > from ? distance : -distance;
  }

  function drop(cancel: boolean) {
    if (!drag) return;
    cancelAnimationFrame(scrollFrame);
    if (cancel) drag.to = drag.from;

    const target = getSettledOffset(drag);
    if (prefersReducedMotion.current || Math.abs(target - drag.offset) < 1) {
      finishDrag();
      return;
    }
    drag.settling = true;
    drag.offset = target;
    settleTimeout = setTimeout(finishDrag, SETTLE_MS);
  }

  function finishDrag() {
    clearTimeout(settleTimeout);
    if (!drag) return;
    const { id, from, to } = drag;
    drag = null;
    // 끄는 동안 다른 탭에서 계획이 바뀌었으면 옮기지 않는다.
    if (from !== to && timer.plan[from]?.id === id) moveSession(id, to, false);
  }

  /** 끄는 동안 각 항목을 그릴 위치 */
  function getShift(index: number): number {
    if (!drag) return 0;
    const { from, to, heights } = drag;
    if (index === from) return drag.offset;
    if (from < index && index <= to) return -heights[from];
    if (to <= index && index < from) return heights[from];
    return 0;
  }
</script>

<svelte:window
  onpointermove={handlePointerMove}
  onpointerup={handlePointerUp}
  onpointercancel={handlePointerCancel}
  onkeydown={handleKeyDown}
  onscroll={handleScroll}
/>

<div bind:this={root} class={cn(drag && "select-none")}>
  {#if editable}
    <p id={HANDLE_DESCRIPTION_ID} class="sr-only">
      끌어서 놓거나 위, 아래 화살표 키를 눌러 순서를 바꿀 수 있습니다.
    </p>
  {/if}
  <p class="sr-only" aria-live="polite">{announcement}</p>

  <ol role="list" aria-label="세션 계획">
    {#each timer.plan as session, index (session.id)}
      {@const dragging = drag?.id === session.id}
      <li
        data-session-id={session.id}
        class={cn(
          "relative",
          dragging && "z-10",
          drag &&
            (!dragging || drag.settling) &&
            "transition-transform duration-150 ease-out",
        )}
        style:transform={drag ? `translateY(${getShift(index)}px)` : undefined}
      >
        <AddSessionButton
          slot={index}
          label={getAddLabel(index, timer.plan.length)}
          hidden={drag !== null}
          onclick={() => addSession(index)}
        />
        <PlanItem
          {session}
          number={index + 1}
          {editable}
          {dragging}
          handleDescription={editable ? HANDLE_DESCRIPTION_ID : undefined}
          onChange={(patch) => timer.updateSession(session.id, patch)}
          onRemove={() => removeSession(session.id, index)}
          onHandlePointerDown={(event) =>
            handleHandlePointerDown(event, session.id, index)}
          onHandleKeyDown={(event) =>
            handleHandleKeyDown(event, session.id, index)}
        />
      </li>
    {/each}
  </ol>

  <AddSessionButton
    slot={timer.plan.length}
    label={getAddLabel(timer.plan.length, timer.plan.length)}
    hidden={drag !== null}
    onclick={() => addSession(timer.plan.length)}
  />
</div>
