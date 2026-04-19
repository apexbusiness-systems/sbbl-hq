/**
 * Dual (1v1 / 2v2) biometric overlay — sits over the video frame.
 *
 * If no snapshots exist for any player within the fresh window (60s),
 * renders nothing. Zero placeholder, zero skeleton — matches the spec's
 * "only render when data is live" rule.
 */
import { memo, useMemo } from 'react';
import { BiometricStatusBar } from './BiometricStatusBar';
import type { BiometricSnapshot } from '@/lib/biometrics/types';

interface PlayerSlot {
  playerId: string;
  label: string;
}

interface Props {
  snapshots: BiometricSnapshot[];
  leftPlayer: PlayerSlot;
  rightPlayer: PlayerSlot;
  /** ms freshness window; snapshots older than this are treated as absent. */
  freshnessMs?: number;
  /** Optional extra players for 2v2 rendering. */
  additionalPlayers?: PlayerSlot[];
}

const FRESHNESS_MS_DEFAULT = 60_000;

function BiometricDualOverlayImpl({
  snapshots,
  leftPlayer,
  rightPlayer,
  freshnessMs = FRESHNESS_MS_DEFAULT,
  additionalPlayers,
}: Props) {
  const index = useMemo(() => {
    const now = Date.now();
    const byPlayer = new Map<string, BiometricSnapshot>();
    for (const s of snapshots) {
      const ts = s.recordedAt ? Date.parse(s.recordedAt) : 0;
      if (now - ts > freshnessMs) continue;
      byPlayer.set(s.playerId, s);
    }
    return byPlayer;
  }, [snapshots, freshnessMs]);

  const anyFresh = index.size > 0;
  if (!anyFresh) return null;

  const extras = additionalPlayers ?? [];

  return (
    <div
      data-testid="biometric-dual-overlay"
      className={[
        'absolute left-0 right-0 bottom-0',
        'px-4 pb-3 pt-6',
        'bg-gradient-to-t from-[hsl(var(--background)/0.92)] to-transparent',
      ].join(' ')}
    >
      <div className="flex items-end justify-between gap-4 max-w-5xl mx-auto">
        <BiometricStatusBar
          snapshot={index.get(leftPlayer.playerId) ?? null}
          playerLabel={leftPlayer.label}
          align="left"
        />
        {extras.length > 0 && (
          <div className="flex flex-col gap-2">
            {extras.map((p) => (
              <BiometricStatusBar
                key={p.playerId}
                snapshot={index.get(p.playerId) ?? null}
                playerLabel={p.label}
                align="left"
              />
            ))}
          </div>
        )}
        <div className="shrink-0 font-display uppercase tracking-[0.3em] text-[12px] text-muted-foreground self-center">VS</div>
        <BiometricStatusBar
          snapshot={index.get(rightPlayer.playerId) ?? null}
          playerLabel={rightPlayer.label}
          align="right"
        />
      </div>
    </div>
  );
}

export const BiometricDualOverlay = memo(BiometricDualOverlayImpl);
