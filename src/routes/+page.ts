import { FocusTimer } from "#lib/timer/focus-timer.svelte.js";
import type { PageLoad } from "./$types";

// 저장된 상태를 다 불러온 뒤에 화면을 그린다. 대기 화면이 잠깐 보였다가 바뀌는 일이 없고,
// 처음 그린 화면이 곧 저장된 상태의 화면이므로 첫 화면에서 초점을 건드리지 않는 규칙도 그대로 지킬 수 있다.
// 서버 렌더링을 껐으므로(+layout.ts) 브라우저에서만 실행된다.
export const load: PageLoad = async () => ({ timer: await FocusTimer.load() });
