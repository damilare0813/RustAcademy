// BA-040: duplicate records must not inflate progress.
export interface ProgressRecord {
  lessonId?: string;
  taskId?: string;
  required: boolean;
}

/** Counts each required lesson and task once and keeps the percentage within 0-100. */
export function dedupedPercent(records: ProgressRecord[], requiredTotal: number): number {
  if (requiredTotal <= 0) return 0;
  const seen = new Set<string>();
  for (const r of records) {
    if (!r.required) continue;
    const key = r.lessonId ? `lesson:${r.lessonId}` : r.taskId ? `task:${r.taskId}` : '';
    if (key) seen.add(key);
  }
  const pct = Math.round((seen.size / requiredTotal) * 100);
  return Math.max(0, Math.min(100, pct));
}
