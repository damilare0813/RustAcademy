// BA-037 (validate course identifiers) and BA-038 (lesson and task progress stay independent).
const COURSE_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/i;

/** Rejects blank or malformed course ids before any progress mutation (BA-037). */
export function validateCourseId(courseId: unknown): string {
  if (typeof courseId !== 'string' || courseId.trim() === '') {
    throw new Error('courseId must be a non-empty string');
  }
  const id = courseId.trim();
  if (!COURSE_ID_PATTERN.test(id)) throw new Error('courseId is malformed');
  return id;
}

export interface LearnerProgress {
  lessons: Set<string>;
  tasks: Set<string>;
}

/** Completing a task only records the task; its lesson is never implicitly completed (BA-038). */
export function completeTask(progress: LearnerProgress, taskId: string): LearnerProgress {
  return { lessons: progress.lessons, tasks: new Set(progress.tasks).add(taskId) };
}

export function completeLesson(progress: LearnerProgress, lessonId: string): LearnerProgress {
  return { lessons: new Set(progress.lessons).add(lessonId), tasks: progress.tasks };
}
