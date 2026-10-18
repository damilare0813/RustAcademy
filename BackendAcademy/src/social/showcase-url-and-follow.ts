// BA-051 (showcase URL validation) and BA-052 (idempotent follow).
/** Accepts only well-formed http(s) URLs; rejects unsafe schemes such as javascript: (BA-051). */
export function validateShowcaseUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed');
  }
  return url;
}

/** Repeated follow requests never create duplicate relationships (BA-052). */
export function follow(follows: Set<string>, followerId: string, followeeId: string): { created: boolean } {
  if (followerId === followeeId) throw new Error('Cannot follow yourself');
  const key = `${followerId}->${followeeId}`;
  if (follows.has(key)) return { created: false };
  follows.add(key);
  return { created: true };
}
