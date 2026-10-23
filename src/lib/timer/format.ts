function splitSeconds(ms: number): { minutes: number; seconds: number } {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  return {
    minutes: Math.floor(totalSeconds / 60),
    seconds: totalSeconds % 60,
  };
}

/** 밀리초를 `m:ss` 형태로 바꾼다. 60분을 넘기면 분 자리가 그대로 커진다. (예: 75:03) */
export function formatClock(ms: number): string {
  const { minutes, seconds } = splitSeconds(ms);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** 스크린 리더가 읽기 좋은 형태로 바꾼다. (예: "12분 3초", "25분", "0초") */
export function formatSpokenDuration(ms: number): string {
  const { minutes, seconds } = splitSeconds(ms);
  if (minutes === 0) return `${seconds}초`;
  if (seconds === 0) return `${minutes}분`;
  return `${minutes}분 ${seconds}초`;
}
