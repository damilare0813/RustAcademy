// BA-032 (idempotent completion) and BA-033 (reject unknown courses).
export class CourseNotFoundError extends Error {
  constructor(courseId: string) {
    super(`Course not found: ${courseId}`);
  }
}

/** Throws before any progress is touched if the course is unknown (BA-033). */
export function assertCourseExists(knownCourseIds: ReadonlySet<string>, courseId: string): void {
  if (!knownCourseIds.has(courseId)) throw new CourseNotFoundError(courseId);
}

/** Marks a task complete once; repeated calls change nothing and award nothing extra (BA-032). */
export function completeTaskOnce(
  completed: Set<string>,
  taskId: string,
): { alreadyCompleted: boolean; rewardGranted: boolean } {
  if (completed.has(taskId)) return { alreadyCompleted: true, rewardGranted: false };
  completed.add(taskId);
  return { alreadyCompleted: false, rewardGranted: true };
}
