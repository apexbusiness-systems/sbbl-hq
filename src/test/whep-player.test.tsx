/**
 * whep-player.test.tsx
 *
 * Regression shield for WhepPlayer covering all 5 critical fixes:
 *   Fix #1 — single retry scheduling path (no duplicate timers)
 *   Fix #3 — manualRetry resets retryCount and clears pending timer
 *   Fix #4 — mountedRef prevents state updates after unmount
 *   Fix #5 — ICE recovery clears pending retry timer (no zombie reconnect)
 *   CORS  — probe surfaces actionable hint when origin blocks preflight
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react';

// ── @eyevinn/webrtc-player mock ───────────────────────────────────────────
// Captures handlers + exposes a fake internal RTCPeerConnection so tests can
// drive no-media / media-recovered / ICE state transitions deterministically.

type Handler = (arg?: unknown) => void;

interface FakePeerConnection {
  iceConnectionState: RTCIceConnectionState;
  oniceconnectionstatechange: (() => void) | null;
}

interface FakePlayerInstance {
  load: (url: URL) => Promise<void>;
  on: (event: string, cb: Handler) => void;
  destroy: () => void;
  _pc: FakePeerConnection;
  emit: (event: string, arg?: unknown) => void;
  setIceState: (state: RTCIceConnectionState) => void;
  loadResolver: () => void;
  loadRejecter: (err: unknown) => void;
  destroyed: boolean;
}

let lastPlayer: FakePlayerInstance | null = null;
let loadShouldReject: Error | null = null;

vi.mock('@eyevinn/webrtc-player', () => {
  return {
    WebRTCPlayer: class {
      private handlers = new Map<string, Handler>();
      _pc: FakePeerConnection = {
        iceConnectionState: 'new',
        oniceconnectionstatechange: null,
      };
      loadResolver: () => void = () => {};
      loadRejecter: (err: unknown) => void = () => {};
      destroyed = false;

      load(_url: URL): Promise<void> {
        if (loadShouldReject) {
          const err = loadShouldReject;
          loadShouldReject = null;
          return Promise.reject(err);
        }
        return new Promise<void>((resolve, reject) => {
          this.loadResolver = resolve;
          this.loadRejecter = reject;
        });
      }
      on(event: string, cb: Handler) { this.handlers.set(event, cb); }
      destroy() { this.destroyed = true; }

      emit(event: string, arg?: unknown) { this.handlers.get(event)?.(arg); }
      setIceState(state: RTCIceConnectionState) {
        this._pc.iceConnectionState = state;
        this._pc.oniceconnectionstatechange?.();
      }

      constructor() {
        lastPlayer = this as unknown as FakePlayerInstance;
      }
    },
  };
});

// ── whep-probe mock — default: CORS probe passes ──────────────────────────
vi.mock('@/lib/stream/whep-probe', () => ({
  probeWhepCors: vi.fn(async () => ({ ok: true, reason: 'ok' })),
}));

import { WhepPlayer } from '@/components/WhepPlayer';
import * as probeModule from '@/lib/stream/whep-probe';

async function tick(ms = 0) {
  await act(async () => {
    if (ms > 0) {
      vi.advanceTimersByTime(ms);
    } else {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    }
  });
}

/** Finish the in-flight player.load() successfully and flush promise queue. */
async function finishLoad() {
  await act(async () => {
    lastPlayer?.loadResolver();
    // Yield to microtasks so the post-load state updates settle.
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  lastPlayer = null;
  loadShouldReject = null;
  vi.mocked(probeModule.probeWhepCors).mockResolvedValue({ ok: true, reason: 'ok' });
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('WhepPlayer — rendering + mount/unmount lifecycle', () => {
  it('renders a connecting overlay on mount', async () => {
    render(<WhepPlayer whepUrl="https://stream.example.com/whep/live" />);
    expect(screen.getByText(/Connecting to stream/i)).toBeInTheDocument();
  });

  it('transitions to live after player.load resolves', async () => {
    const onStatus = vi.fn();
    render(
      <WhepPlayer whepUrl="https://stream.example.com/whep/live" onStatusChange={onStatus} />
    );
    await tick();
    await finishLoad();
    expect(onStatus).toHaveBeenCalledWith('connecting');
    expect(onStatus).toHaveBeenCalledWith('live');
  });

  it('Fix #4 — does NOT call onStatusChange after unmount', async () => {
    const onStatus = vi.fn();
    const { unmount } = render(
      <WhepPlayer whepUrl="https://stream.example.com/whep/live" onStatusChange={onStatus} />
    );
    await tick();
    // Unmount while player.load() is still pending.
    unmount();
    onStatus.mockClear();
    // Now resolve the load — mountedRef should block any further setState.
    await finishLoad();
    expect(onStatus).not.toHaveBeenCalled();
  });

  it('Fix #4 — destroys player and nulls ICE handler on unmount', async () => {
    const { unmount } = render(
      <WhepPlayer whepUrl="https://stream.example.com/whep/live" />
    );
    await tick();
    await finishLoad();
    const player = lastPlayer!;
    expect(player._pc.oniceconnectionstatechange).not.toBeNull();
    unmount();
    expect(player.destroyed).toBe(true);
    expect(player._pc.oniceconnectionstatechange).toBeNull();
  });
});

describe('WhepPlayer — Fix #1 single retry path (dedup)', () => {
  it('collapses a burst of no-media events into a single scheduled retry', async () => {
    render(
      <WhepPlayer
        whepUrl="https://stream.example.com/whep/live"
        retryIntervalMs={10_000}
        maxRetries={5}
      />
    );
    await tick();
    await finishLoad();
    const player = lastPlayer!;

    // Fire three bursty no-media events. Only one retry should be scheduled.
    await act(async () => {
      player.emit('no-media');
      player.emit('no-media');
      player.emit('no-media');
    });

    // setTimeout mock: count pending timers. vi.getTimerCount reports all
    // timers; we expect exactly one retry timer.
    expect(vi.getTimerCount()).toBe(1);
  });
});

describe('WhepPlayer — Fix #3 manual retry', () => {
  it('clicking "Retry now" resets retryCount and re-invokes connect', async () => {
    loadShouldReject = new Error('initial failure');
    render(
      <WhepPlayer
        whepUrl="https://stream.example.com/whep/live"
        retryIntervalMs={0}
        maxRetries={1}
      />
    );
    await tick();
    await tick();
    // After one failure with maxRetries=1, status should be offline.
    const retryBtn = await screen.findByRole('button', { name: /Retry now/i });
    expect(retryBtn).toBeInTheDocument();

    // Next connect should succeed.
    fireEvent.click(retryBtn);
    await tick();
    await finishLoad();
    expect(screen.queryByText(/Stream offline|Playback error/i)).not.toBeInTheDocument();
  });
});

describe('WhepPlayer — Fix #5 zombie retry after ICE recovery', () => {
  it('clears pending retry timer when ICE transitions to connected', async () => {
    render(
      <WhepPlayer
        whepUrl="https://stream.example.com/whep/live"
        retryIntervalMs={10_000}
        maxRetries={5}
      />
    );
    await tick();
    await finishLoad();
    const player = lastPlayer!;

    // Simulate transient ICE disconnect → retry scheduled.
    await act(async () => player.setIceState('disconnected'));
    expect(vi.getTimerCount()).toBeGreaterThanOrEqual(1);

    // ICE recovers BEFORE the retry timer fires. The fix must cancel it.
    await act(async () => player.setIceState('connected'));
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears pending retry when media-recovered event fires', async () => {
    render(
      <WhepPlayer
        whepUrl="https://stream.example.com/whep/live"
        retryIntervalMs={10_000}
      />
    );
    await tick();
    await finishLoad();
    const player = lastPlayer!;

    await act(async () => player.emit('no-media'));
    expect(vi.getTimerCount()).toBeGreaterThanOrEqual(1);
    await act(async () => player.emit('media-recovered'));
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('WhepPlayer — CORS probe error surfacing', () => {
  it('renders actionable CORS hint when probe reports cors_blocked', async () => {
    vi.mocked(probeModule.probeWhepCors).mockResolvedValueOnce({
      ok: false,
      reason: 'cors_blocked',
      hint: 'WHEP origin likely missing Access-Control-Allow-Origin.',
    });
    render(
      <WhepPlayer whepUrl="https://stream.example.com/whep/live" retryIntervalMs={0} />
    );
    await tick();
    const hint = await screen.findByTestId('whep-cors-hint');
    expect(hint).toHaveTextContent(/Access-Control-Allow-Origin/i);
  });

  it('does NOT block playback when probe returns ok', async () => {
    render(
      <WhepPlayer whepUrl="https://stream.example.com/whep/live" />
    );
    await tick();
    await finishLoad();
    expect(screen.queryByTestId('whep-cors-hint')).not.toBeInTheDocument();
  });
});
