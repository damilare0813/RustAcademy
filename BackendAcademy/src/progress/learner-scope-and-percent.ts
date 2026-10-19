// BA-034 (scope reads to authenticated learner) and BA-035 (optional lessons excluded from percentages).
export class ForbiddenProgressAccessError extends Error {
  constructor() {
    super('Cannot read another learner\'s progress');
  }
}

/** The requested user id must equal the authenticated user id (BA-034). */
export function resolveLearnerId(authenticatedUserId: string, requestedUserId?: string): string {
  if (requestedUserId && requestedUserId !== authenticatedUserId) throw new ForbiddenProgressAccessError();
  return authenticatedUserId;
}

export interface LessonRef {
  id: string;
  optional?: boolean;
}

/** Percentage of required lessons completed; optional lessons are ignored (BA-035). */
export function requiredCompletionPercent(lessons: LessonRef[], completedIds: ReadonlySet<string>): number {
  const required = lessons.filter((l) => !l.optional);
  if (required.length === 0) return 0;
  const done = required.filter((l) => completedIds.has(l.id)).length;
  return Math.round((done / required.length) * 100);
}
