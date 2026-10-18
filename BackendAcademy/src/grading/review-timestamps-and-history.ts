// BA-046 (immutable submission timestamps) and BA-047 (chronological review history).
export interface SubmissionTimes {
  submittedAt: Date;
  reviewedAt?: Date;
}

/** Records review time separately; the original submission time is never overwritten (BA-046). */
export function markReviewed(times: SubmissionTimes, now: Date = new Date()): SubmissionTimes {
  return { submittedAt: times.submittedAt, reviewedAt: now };
}

export interface ReviewEntry {
  id: string;
  createdAt: Date;
}

/** Chronological order; timestamp ties are broken deterministically by id (BA-047). */
export function sortReviews<T extends ReviewEntry>(reviews: T[]): T[] {
  return [...reviews].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
}
