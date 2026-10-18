// BA-048 (unknown tasks) and BA-049 (cross-course grading).
export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Task not found: ${taskId}`);
  }
}

/** Not-found check that must run before a submission is created or changed (BA-048). */
export function assertTaskExists(knownTaskIds: ReadonlySet<string>, taskId: string): void {
  if (!knownTaskIds.has(taskId)) throw new TaskNotFoundError(taskId);
}

export interface SubmissionRef {
  id: string;
  taskId: string;
  courseId: string;
}

/** Verifies task, course and submission associations before a review is saved (BA-049). */
export function assertSubmissionBelongsTo(
  submission: SubmissionRef,
  expected: { taskId: string; courseId: string },
): void {
  if (submission.taskId !== expected.taskId || submission.courseId !== expected.courseId) {
    throw new Error('Submission does not belong to the given task/course');
  }
}
