<script lang="ts">
  import XIcon from "@lucide/svelte/icons/x";
  import * as AlertDialog from "#lib/components/ui/alert-dialog/index.js";
  import { buttonVariants } from "#lib/components/ui/button/index.js";
  import type { SessionKind } from "#lib/timer/model.js";
  import { cn } from "#lib/utils.js";

  interface Props {
    /** 여는 버튼에 붙일 클래스 */
    class?: string;
    /** 진행 중인 세션의 종류 */
    kind: SessionKind;
    /** 이 계획에서 이미 끝낸 세션이 있는지. 있으면 그 이력은 남는다고 알려 준다. */
    hasFinished: boolean;
    onConfirm: () => void;
  }

  let { class: className, kind, hasFinished, onConfirm }: Props = $props();
</script>

<!-- 진행 중인 집중/휴식은 이력에 남지 않으므로 한 번 더 확인한다. -->
<AlertDialog.Root>
  <AlertDialog.Trigger
    class={cn(buttonVariants({ variant: "ghost" }), className)}
  >
    <XIcon />
    그만두기
  </AlertDialog.Trigger>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>저장하지 않고 그만둘까요?</AlertDialog.Title>
      <AlertDialog.Description class="break-keep">
        진행 중인 {kind === "focus" ? "집중" : "휴식"} 세션을 기록하지 않고 대기 화면으로
        돌아갑니다.
        {#if hasFinished}
          앞서 마친 세션의 기록은 그대로 남습니다.
        {/if}
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>취소</AlertDialog.Cancel>
      <AlertDialog.Action variant="destructive" onclick={onConfirm}>
        그만두기
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
