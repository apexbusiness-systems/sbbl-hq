export const IDEMPOTENCY_HEADER = 'x-idempotency-key';

export function readIdempotencyKey(headers: Headers) {
  const key = headers.get(IDEMPOTENCY_HEADER)?.trim();
  if (!key || key.length < 12) {
    throw new Error('Missing or invalid idempotency key');
  }

  return key;
}

export function createIdempotencyKey(scope: string, deterministicPayload?: unknown) {
  if (deterministicPayload) {
      const bodyStr = typeof deterministicPayload === 'string' ? deterministicPayload : JSON.stringify(deterministicPayload);
      let bodyHash = 0;
      for (let i = 0; i < bodyStr.length; i++) {
        bodyHash = ((bodyHash << 5) - bodyHash) + bodyStr.charCodeAt(i);
        bodyHash |= 0;
      }
      return `${scope}-hash-${bodyHash}`;
  }
  return `${scope}-${Date.now()}-${crypto.randomUUID()}`;
}