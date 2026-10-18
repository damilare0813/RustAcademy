// BA-095 (bounded retry of transient Horizon failures) and BA-096 (payment amount validation).
export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  isTransient?: (err: unknown) => boolean;
}

const defaultTransient = (err: unknown): boolean =>
  /timeout|ETIMEDOUT|ECONNRESET|429|502|503|504/i.test(String((err as Error)?.message ?? err));

/** Retries transient errors only, caps attempts, and rethrows the final failure (BA-095). */
export async function withHorizonRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 3, baseDelayMs = 200, isTransient = defaultTransient } = opts;
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxAttempts || !isTransient(err)) throw err;
      await new Promise((r) => setTimeout(r, baseDelayMs * 2 ** (attempt - 1)));
    }
  }
}

export const MAX_PAYMENT_AMOUNT = 1_000_000;

/** Rejects malformed, nonpositive or excessive amounts before building payment operations (BA-096). */
export function validatePaymentAmount(amount: string): string {
  if (!/^\d+(\.\d{1,7})?$/.test(amount)) throw new Error('Malformed amount');
  const n = Number(amount);
  if (n <= 0) throw new Error('Amount must be positive');
  if (n > MAX_PAYMENT_AMOUNT) throw new Error(`Amount exceeds maximum of ${MAX_PAYMENT_AMOUNT}`);
  return amount;
}
