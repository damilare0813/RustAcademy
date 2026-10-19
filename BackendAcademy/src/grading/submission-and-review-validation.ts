// BA-041 (submission content), BA-042 (no self-review), BA-043 (review score/feedback validation).
export interface FieldError {
  field: string;
  message: string;
}

/** Rejects empty or whitespace-only submission content with a field-level error (BA-041). */
export function validateSubmissionContent(content: unknown): FieldError[] {
  if (typeof content !== 'string' || content.trim() === '') {
    return [{ field: 'content', message: 'content must not be empty' }];
  }
  return [];
}

/** A tutor cannot review their own submission; a different tutor can (BA-042). */
export function canReview(tutorId: string, submissionAuthorId: string): boolean {
  return tutorId !== submissionAuthorId;
}

export const MIN_SCORE = 0;
export const MAX_SCORE = 100;

/** Score must be within bounds; feedback is required (BA-043). */
export function validateReview(score: unknown, feedback: unknown): FieldError[] {
  const errors: FieldError[] = [];
  if (typeof score !== 'number' || !Number.isFinite(score) || score < MIN_SCORE || score > MAX_SCORE) {
    errors.push({ field: 'score', message: `score must be between ${MIN_SCORE} and ${MAX_SCORE}` });
  }
  if (typeof feedback !== 'string' || feedback.trim() === '') {
    errors.push({ field: 'feedback', message: 'feedback is required' });
  }
  return errors;
}
