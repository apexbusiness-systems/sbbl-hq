/**
 * use-whip-ingest.ts
 *
 * WebRTC-HTTP Ingestion Protocol (WHIP) publisher for browser → MediaMTX.
 *
 * The admin captures a MediaStream (webcam, screen share, or an HTMLMediaElement
 * via element.captureStream()) and the hook publishes it to a WHIP endpoint.
 * MediaMTX re-emits the feed as WHEP so all viewers receive it via the existing
 * WhepPlayer component — no client changes needed.
 *
 * WHIP wire protocol (IETF draft-ietf-wish-whip):
 *   1. Browser creates RTCPeerConnection and adds tracks from the MediaStream.
 *   2. Browser POSTs SDP offer to <whipUrl> with Content-Type: application/sdp.
 *   3. Server replies 201 Created with the SDP answer as the response body
 *      and a Location header pointing at the resource to DELETE on shutdown.
 *   4. Browser DELETEs the location on unmount to release the ingest slot.
 *
 * Compatible servers: MediaMTX 1.0+, Janus, simple-whep-server, AWS Kinesis
 * Video Streams (WHIP), Millicast, Cloudflare Realtime WHIP.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export type WhipIngestStatus =
  | 'idle'
  | 'connecting'
  | 'publishing'
  | 'stopping'
  | 'error';

export interface UseWhipIngestOptions {
  /** Full WHIP endpoint (e.g. https://stream.sbbl-hq.icu/whip/live). */
  whipUrl: string | null;
  /** The MediaStream to publish. Passing null keeps the hook idle. */
  stream: MediaStream | null;
  /** Optional bearer token for WHIP endpoints that require auth. */
  bearerToken?: string | null;
  /** Called with the SDP answer for diagnostics (optional). */
  onAnswer?: (sdp: string) => void;
}

export interface UseWhipIngestResult {
  status: WhipIngestStatus;
  error: string | null;
  /** Stop publishing and release the WHIP resource. Idempotent. */
  stop: () => Promise<void>;
  /** Peer connection (exposed for tests and advanced diagnostics). */
  peerConnection: RTCPeerConnection | null;
}

/**
 * Headers for a WHIP POST. WHIP mandates application/sdp and allows an
 * Authorization bearer per draft-ietf-wish-whip §4.4.
 */
function whipHeaders(bearerToken: string | null | undefined): Headers {
  const h = new Headers({ 'content-type': 'application/sdp' });
  if (bearerToken) h.set('authorization', `Bearer ${bearerToken}`);
  return h;
}

export function useWhipIngest({
  whipUrl,
  stream,
  bearerToken,
  onAnswer,
}: UseWhipIngestOptions): UseWhipIngestResult {
  const [status, setStatus] = useState<WhipIngestStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const resourceUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const stop = useCallback(async () => {
    const resourceUrl = resourceUrlRef.current;
    resourceUrlRef.current = null;
    if (pcRef.current) {
      setStatus('stopping');
      try {
        pcRef.current.getSenders().forEach((s) => s.track?.stop());
      } catch {
        /* best-effort */
      }
      try {
        pcRef.current.close();
      } catch {
        /* already closed */
      }
      pcRef.current = null;
    }
    if (resourceUrl) {
      try {
        // Release the ingest slot on the server. Non-fatal if the request
        // fails — MediaMTX GCs dead sessions after its idle timeout anyway.
        await fetch(resourceUrl, {
          method: 'DELETE',
          headers: bearerToken ? { authorization: `Bearer ${bearerToken}` } : undefined,
        });
      } catch {
        /* ignore */
      }
    }
    if (mountedRef.current) setStatus('idle');
  }, [bearerToken]);

  useEffect(() => {
    mountedRef.current = true;
    // Guard: the hook is idle until both a stream AND endpoint are supplied.
    if (!whipUrl || !stream) return;

    let cancelled = false;
    const start = async () => {
      setError(null);
      setStatus('connecting');
      // STUN is sufficient for most ingest scenarios; MediaMTX also supports
      // TURN via its config, but the browser side only needs to know about the
      // STUN server to generate server-reflexive candidates.
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      // Add every track from the MediaStream as a sendonly transceiver so
      // MediaMTX negotiates in ingest mode and rejects RTCP feedback loops.
      for (const track of stream.getTracks()) {
        pc.addTransceiver(track, { direction: 'sendonly', streams: [stream] });
      }

      pc.onconnectionstatechange = () => {
        if (cancelled) return;
        const state = pc.connectionState;
        if (state === 'connected') setStatus('publishing');
        else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
          setStatus('error');
          setError(`WebRTC connection ${state}`);
        }
      };

      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        // Trickle ICE lite: wait for ICE gathering to complete so the offer
        // we POST is self-contained. WHIP servers that don't support trickle
        // (including MediaMTX today) require the full candidate list upfront.
        await new Promise<void>((resolve) => {
          if (pc.iceGatheringState === 'complete') return resolve();
          const onChange = () => {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', onChange);
              resolve();
            }
          };
          pc.addEventListener('icegatheringstatechange', onChange);
          // Hard cap so we never hang indefinitely on a broken network.
          setTimeout(() => {
            pc.removeEventListener('icegatheringstatechange', onChange);
            resolve();
          }, 3000);
        });

        if (cancelled) return;

        const sdp = pc.localDescription?.sdp ?? offer.sdp;
        if (!sdp) throw new Error('no_local_sdp');

        const res = await fetch(whipUrl, {
          method: 'POST',
          headers: whipHeaders(bearerToken ?? null),
          body: sdp,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`whip_${res.status}${text ? `: ${text.slice(0, 120)}` : ''}`);
        }

        const answerSdp = await res.text();
        if (!answerSdp.includes('v=0')) {
          throw new Error('invalid_sdp_answer');
        }

        const location = res.headers.get('location');
        if (location) {
          try {
            resourceUrlRef.current = new URL(location, whipUrl).toString();
          } catch {
            resourceUrlRef.current = location;
          }
        }

        onAnswer?.(answerSdp);
        if (cancelled) return;
        await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
      } catch (err: unknown) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        setStatus('error');
        try {
          pc.close();
        } catch {
          /* ignore */
        }
        pcRef.current = null;
      }
    };

    void start();

    return () => {
      cancelled = true;
      void stop();
    };
  }, [whipUrl, stream, bearerToken, onAnswer, stop]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { status, error, stop, peerConnection: pcRef.current };
}
