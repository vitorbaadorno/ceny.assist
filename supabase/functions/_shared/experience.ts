export type Period = { inicio: string | null; fim: string | null; atual: boolean };
// Month precision: inclusive calendar months, never sum overlapping employments.
export function experienceMonths(periods: Period[], today = new Date()) {
  const current = today.getUTCFullYear() * 12 + today.getUTCMonth();
  const month = (value: string | null) =>
    value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
      ? Number(value.slice(0, 4)) * 12 + Number(value.slice(5)) - 1
      : null;
  const intervals: number[][] = [];
  const uncertain: number[] = [];
  periods.forEach((p, index) => {
    const start = month(p.inicio),
      end = p.atual ? current : month(p.fim);
    if (
      start === null ||
      end === null ||
      start > end ||
      end > current ||
      start < 1900 * 12 ||
      (p.atual && p.fim !== null)
    ) {
      uncertain.push(index);
      return;
    }
    intervals.push([start, end + 1]);
  });
  intervals.sort((a, b) => a[0]! - b[0]!);
  let months = 0,
    lastStart = -1,
    lastEnd = -1;
  for (const [start, end] of intervals) {
    if (start! > lastEnd) {
      if (lastStart >= 0) months += lastEnd - lastStart;
      lastStart = start!;
      lastEnd = end!;
    } else lastEnd = Math.max(lastEnd, end!);
  }
  if (lastStart >= 0) months += lastEnd - lastStart;
  return {
    months: intervals.length ? months : null,
    uncertain,
    complete: periods.length > 0 && uncertain.length === 0,
  };
}
