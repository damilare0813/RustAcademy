// BA-044 (valid status transitions) and BA-045 (resubmission restricted to owner).
export type SubmissionStatus = 'submitted' | 'reviewed' | 'returned' | 'resubmitted';

const ALLOWED: Record<SubmissionStatus, SubmissionStatus[]> = {
  submitted: ['reviewed'],
  reviewed: ['returned'],
  returned: ['resubmitted'],
  resubmitted: ['reviewed'],
};

/** Throws on invalid transitions across submit, review, return and resubmit flows (BA-044). */
export function assertTransition(from: SubmissionStatus, to: SubmissionStatus): void {
  if (!ALLOWED[from].includes(to)) throw new Error(`Invalid status transition: ${from} -> ${to}`);
}

/** Only the owner may replace an existing submission (BA-045). */
export function assertSubmissionOwner(ownerId: string, requesterId: string): void {
  if (ownerId !== requesterId) throw new Error('Only the submission owner can resubmit');
}
