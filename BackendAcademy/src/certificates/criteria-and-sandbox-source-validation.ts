// BA-075 (certificate criteria thresholds) and BA-101 (sandbox source validation).
/** Rejects invalid score cutoffs (must be 0-100) and nonpositive required task counts (BA-075). */
export function validateCertificateCriteria(minScore: number, requiredTasks: number): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(minScore) || minScore < 0 || minScore > 100) {
    errors.push('minScore must be between 0 and 100');
  }
  if (!Number.isInteger(requiredTasks) || requiredTasks <= 0) {
    errors.push('requiredTasks must be a positive integer');
  }
  return errors;
}

/** Documented maximum sandbox source size: 64 KiB. */
export const MAX_SOURCE_BYTES = 64 * 1024;

/** Rejects blank source and source above the maximum size (BA-101). */
export function validateSandboxSource(source: unknown): string {
  if (typeof source !== 'string' || source.trim() === '') throw new Error('source must not be blank');
  if (Buffer.byteLength(source, 'utf8') > MAX_SOURCE_BYTES) {
    throw new Error(`source exceeds ${MAX_SOURCE_BYTES} bytes`);
  }
  return source;
}
