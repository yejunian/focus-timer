import { HistoryViewer } from "#lib/history/history-viewer.svelte.js";
import type { PageLoad } from "./$types";

// 오늘과 최근 4주의 기록을 다 읽은 뒤에 화면을 그린다.
export const load: PageLoad = async () => ({
  viewer: await HistoryViewer.load(),
});
