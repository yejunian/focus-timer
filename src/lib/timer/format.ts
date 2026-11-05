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

function splitMinutes(ms: number): { hours: number; minutes: number } {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

/** 밀리초를 `h:mm` 형태로 바꾼다. 1분이 안 되는 나머지는 버린다. (예: 1:05, 0:40) */
export function formatHoursMinutes(ms: number): string {
  const { hours, minutes } = splitMinutes(ms);
  return `${hours}:${String(minutes).padStart(2, "0")}`;
}

/** `h:mm`을 스크린 리더가 읽기 좋은 형태로 바꾼다. (예: "1시간 5분", "40분", "0분") */
export function formatSpokenHoursMinutes(ms: number): string {
  const { hours, minutes } = splitMinutes(ms);
  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

/** 일시정지 시간을 분 단위로 반올림한다. 30초가 안 되면 0분이다. */
function roundPauseMinutes(ms: number): number {
  return Math.max(0, Math.round(ms / 60_000));
}

/** 일시정지한 시간의 합과 횟수 (예: "3분(2회) 중단") */
export function formatPauseSummary(pausedMs: number, count: number): string {
  return `${roundPauseMinutes(pausedMs)}분(${count}회) 중단`;
}

/** 일시정지 요약을 스크린 리더가 읽기 좋은 형태로 바꾼다. (예: "2회 중단, 합계 3분") */
export function formatSpokenPauseSummary(
  pausedMs: number,
  count: number,
): string {
  return `${count}회 중단, 합계 ${roundPauseMinutes(pausedMs)}분`;
}
