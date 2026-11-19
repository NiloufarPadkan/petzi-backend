/** Iran has used a fixed UTC+03:30 offset since 2022 (no daylight saving). */
const TEHRAN_OFFSET = '+03:30';
export const TEHRAN_TIME_ZONE = 'Asia/Tehran';

/** Today's calendar date in Tehran as YYYY-MM-DD. */
export function tehranToday(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: TEHRAN_TIME_ZONE });
}

/** UTC instants bounding the Tehran calendar day `ymd` (end is exclusive). */
export function tehranDayRange(ymd: string): { start: Date; end: Date } {
  const start = new Date(`${ymd}T00:00:00${TEHRAN_OFFSET}`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

/** `ymd` shifted by a number of days, still as YYYY-MM-DD. */
export function addDays(ymd: string, days: number): string {
  const date = new Date(`${ymd}T12:00:00${TEHRAN_OFFSET}`);
  date.setUTCDate(date.getUTCDate() + days);
  return tehranToday(date);
}
