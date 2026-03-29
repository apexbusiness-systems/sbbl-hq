export type SyncPacket = {
  packet_id: string;
  trace_id: string;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  league_id: string | null;
  payload: Record<string, unknown>;
  emitted_at: string;
};

function encodeBase64Url(value: ArrayBuffer) {
  const bytes = new Uint8Array(value);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export async function signSyncPacket(packet: SyncPacket, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const rawPayload = JSON.stringify(packet);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawPayload));
  return {
    packet,
    signature: encodeBase64Url(signature),
  };
}
