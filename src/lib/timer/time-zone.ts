// 세션 기록과 이력에 남기는 시간대.
// 기록한 브라우저가 알려 준 IANA 시간대 이름을 그대로 저장한다.
// 다른 브라우저나 이후 버전의 브라우저는 그 이름을 모를 수도 있다. 그래도 저장된 값은 바꾸지 않고,
// 현지 시각을 표시할 때만 이 브라우저의 시간대로 대신한다.

/** 이 브라우저의 지금 시간대 (IANA 이름, 예: "Asia/Seoul") */
export function getClientTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** 이 브라우저의 `Intl`이 아는 시간대 이름인지 */
export function isSupportedTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    // 모르는 이름이면 RangeError가 난다.
    return false;
  }
}

/**
 * 기록한 시간대로 현지 시각을 표시할 때 쓸 시간대.
 * 이 브라우저가 모르는 이름이면 이 브라우저의 시간대로 대신한다.
 */
export function getDisplayTimeZone(timeZone: string): string {
  return isSupportedTimeZone(timeZone) ? timeZone : getClientTimeZone();
}
