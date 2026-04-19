/**
 * use-whip-ingest.test.ts
 *
 * Regression shield for the WHIP ingest hook (src/hooks/use-whip-ingest.ts).
 * Tests exercise the SDP handshake, Location-header capture, DELETE cleanup,
 * and idle-state guards that the real RTCPeerConnection path depends on.
 * No real WebRTC is exercised — a fake RTCPeerConnection double drives the
 * negotiation deterministically.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useWhipIngest } from '@/hooks/use-whip-ingest';

type FakePC = {
  localDescription: { sdp: string } | null;
  getSenders: ReturnType<typeof vi.fn>;
  addTransceiver: ReturnType<typeof vi.fn>;
  createOffer: ReturnType<typeof vi.fn>;
  setLocalDescription: ReturnType<typeof vi.fn>;
  setRemoteDescription: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  iceGatheringState: 'complete';
  connectionState: 'new' | 'connected' | 'failed' | 'disconnected' | 'closed';
  onconnectionstatechange?: () => void;
};

function makeFakeStream(): MediaStream {
  const track = {
    stop: vi.fn(),
    kind: 'video',
    id: 't1',
  } as unknown as MediaStreamTrack;
  return {
    getTracks: () => [track],
    getVideoTracks: () => [track],
    getAudioTracks: () => [],
  } as unknown as MediaStream;
}

function makeFakePC(): FakePC {
  return {
    localDescription: { sdp: 'v=0\r\no=- 1 1 IN IP4 127.0.0.1\r\ns=-\r\n' },
    getSenders: vi.fn(() => []),
    addTransceiver: vi.fn(),
    createOffer: vi.fn(async () => ({ type: 'offer', sdp: 'v=0\r\n' })),
    setLocalDescription: vi.fn(async () => {}),
    setRemoteDescription: vi.fn(async () => {}),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    iceGatheringState: 'complete',
    connectionState: 'new',
  };
}

describe('useWhipIngest', () => {
  let fakePC: FakePC;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fakePC = makeFakePC();
    // @ts-expect-error — assigning a fake constructor for the hook to pick up.
    globalThis.RTCPeerConnection = vi.fn(() => fakePC);
    fetchSpy = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        return new Response('', { status: 204 });
      }
      return new Response(
        'v=0\r\no=- 2 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=sendrecv\r\n',
        { status: 201, headers: { Location: '/whip/resource/abc' } },
      );
    });
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('stays idle when whipUrl or stream is null', async () => {
    const { result } = renderHook(() =>
      useWhipIngest({ whipUrl: null, stream: null }),
    );
    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('POSTs the SDP offer to the WHIP endpoint with application/sdp', async () => {
    const stream = makeFakeStream();
    renderHook(() =>
      useWhipIngest({ whipUrl: 'https://stream.sbbl-hq.icu/whip/live', stream }),
    );
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const call = fetchSpy.mock.calls.find((c) => c[1]?.method === 'POST');
    expect(call).toBeTruthy();
    const [url, init] = call!;
    expect(url).toBe('https://stream.sbbl-hq.icu/whip/live');
    expect(init!.method).toBe('POST');
    const headers = new Headers(init!.headers as HeadersInit);
    expect(headers.get('content-type')).toBe('application/sdp');
  });

  it('attaches the bearer token when provided', async () => {
    const stream = makeFakeStream();
    renderHook(() =>
      useWhipIngest({
        whipUrl: 'https://stream.sbbl-hq.icu/whip/live',
        stream,
        bearerToken: 'tok-123',
      }),
    );
    await waitFor(() => {
      const call = fetchSpy.mock.calls.find((c) => c[1]?.method === 'POST');
      expect(call).toBeTruthy();
      const headers = new Headers(call![1]!.headers as HeadersInit);
      expect(headers.get('authorization')).toBe('Bearer tok-123');
    });
  });

  it('sets the remote description with the SDP answer', async () => {
    const stream = makeFakeStream();
    renderHook(() =>
      useWhipIngest({ whipUrl: 'https://stream.sbbl-hq.icu/whip/live', stream }),
    );
    await waitFor(() => expect(fakePC.setRemoteDescription).toHaveBeenCalled());
    const arg = fakePC.setRemoteDescription.mock.calls[0]?.[0] as { type: string; sdp: string };
    expect(arg.type).toBe('answer');
    expect(arg.sdp).toMatch(/^v=0/);
  });

  it('surfaces error status when WHIP server rejects the offer', async () => {
    fetchSpy.mockImplementationOnce(
      async () => new Response('bad', { status: 400 }),
    );
    const stream = makeFakeStream();
    const { result } = renderHook(() =>
      useWhipIngest({ whipUrl: 'https://stream.sbbl-hq.icu/whip/live', stream }),
    );
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toMatch(/whip_400/);
  });

  it('stops gracefully and DELETEs the WHIP resource', async () => {
    const stream = makeFakeStream();
    const { result } = renderHook(() =>
      useWhipIngest({ whipUrl: 'https://stream.sbbl-hq.icu/whip/live', stream }),
    );
    await waitFor(() => expect(fakePC.setRemoteDescription).toHaveBeenCalled());
    await act(async () => {
      await result.current.stop();
    });
    const deleteCall = fetchSpy.mock.calls.find((c) => c[1]?.method === 'DELETE');
    expect(deleteCall).toBeTruthy();
    expect(String(deleteCall![0])).toMatch(/\/whip\/resource\/abc$/);
    expect(fakePC.close).toHaveBeenCalled();
  });
});
