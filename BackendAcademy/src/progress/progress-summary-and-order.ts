// BA-036 (courses with no required lessons) and BA-039 (stable lesson ordering).
export interface ProgressSummary {
  requiredTotal: number;
  requiredCompleted: number;
  percent: number;
}

/** Defined zero-progress state when a course has no required lessons; no division by zero (BA-036). */
export function summarizeProgress(requiredTotal: number, requiredCompleted: number): ProgressSummary {
  if (requiredTotal <= 0) return { requiredTotal: 0, requiredCompleted: 0, percent: 0 };
  const done = Math.min(requiredCompleted, requiredTotal);
  return { requiredTotal, requiredCompleted: done, percent: Math.round((done / requiredTotal) * 100) };
}

/** Sorts progress rows by the course's lesson order, regardless of persistence ordering (BA-039). */
export function sortByLessonOrder<T extends { lessonId: string }>(rows: T[], lessonOrder: string[]): T[] {
  const index = new Map(lessonOrder.map((id, i) => [id, i] as const));
  return [...rows].sort(
    (a, b) => (index.get(a.lessonId) ?? Number.MAX_SAFE_INTEGER) - (index.get(b.lessonId) ?? Number.MAX_SAFE_INTEGER),
  );
}
