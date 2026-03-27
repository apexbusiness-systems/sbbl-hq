export const IDEMPOTENCY_HEADER = 'x-idempotency-key';

export function readIdempotencyKey(headers: Headers) {
  const key = headers.get(IDEMPOTENCY_HEADER)?.trim();
  if (!key || key.length < 12) {
    throw new Error('Missing or invalid idempotency key');
  }

  return key;
}
