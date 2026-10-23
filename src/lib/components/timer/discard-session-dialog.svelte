<script lang="ts">
  import XIcon from "@lucide/svelte/icons/x";
  import * as AlertDialog from "#lib/components/ui/alert-dialog/index.js";
  import { buttonVariants } from "#lib/components/ui/button/index.js";
  import { cn } from "#lib/utils.js";

  interface Props {
    /** 여는 버튼에 붙일 클래스 */
    class?: string;
    onConfirm: () => void;
  }

  let { class: className, onConfirm }: Props = $props();
</script>

<!-- 되돌릴 수 없는 동작이므로 한 번 더 확인한다. -->
<AlertDialog.Root>
  <AlertDialog.Trigger
    class={cn(buttonVariants({ variant: "ghost" }), className)}
  >
    <XIcon />
    세션 폐기
  </AlertDialog.Trigger>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>세션을 폐기할까요?</AlertDialog.Title>
      <AlertDialog.Description class="break-keep">
        지금까지 진행한 세션을 버리고 대기 화면으로 돌아갑니다. 폐기한 세션은
        되돌릴 수 없습니다.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>취소</AlertDialog.Cancel>
      <AlertDialog.Action variant="destructive" onclick={onConfirm}>
        폐기
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
