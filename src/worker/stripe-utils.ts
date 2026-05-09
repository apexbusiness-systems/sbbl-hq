/**
 * Manually parse Stripe webhook signature header.
 * Format: t=1612345678,v1=signature_string_here
 */
export function parseStripeSignature(header: string) {
  const fields = header.split(",").map((part) => part.trim());
  const timestamp = fields.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = fields
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3))
    .filter(Boolean);
  return {
    timestamp: timestamp ? Number(timestamp) : NaN,
    signatures,
  };
}

/**
 * Constant-time hex string comparison.
 */
export function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
