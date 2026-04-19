/**
 * BiometricAdminPanel — manual-entry UI for ops.
 *
 * Composes the same visual components used in the viewer overlay as a
 * live preview, so the admin sees exactly what they are about to publish.
 */
import { memo, useState } from 'react';
import { StaminaBar } from './StaminaBar';
import { HeartRateDisplay } from './HeartRateDisplay';
import { FatigueIndicator } from './FatigueIndicator';
import type { FatigueLevel } from '@/lib/biometrics/types';

interface Props {
  gameId: string;
  players: { id: string; label: string }[];
  busy?: boolean;
  onSubmit: (args: {
    gameId: string;
    playerId: string;
    staminaPct: number;
    fatigueLevel: FatigueLevel;
    heartRateBpm: number | null;
  }) => Promise<void>;
}

const FATIGUE_OPTIONS: FatigueLevel[] = ['fresh', 'moderate', 'tired', 'gassed'];

function BiometricAdminPanelImpl({ gameId, players, busy = false, onSubmit }: Props) {
  const [playerId, setPlayerId] = useState(players[0]?.id ?? '');
  const [stamina, setStamina] = useState(80);
  const [fatigue, setFatigue] = useState<FatigueLevel>('fresh');
  const [hrStr, setHrStr] = useState('140');
  const [error, setError] = useState<string | null>(null);

  const hr = hrStr.trim() === '' ? null : Number(hrStr);
  const hrValid = hr == null || (Number.isFinite(hr) && hr >= 20 && hr <= 260);

  async function submit() {
    if (!playerId || !hrValid) {
      setError('Fill in player + valid BPM (20–260) or leave BPM blank.');
      return;
    }
    setError(null);
    try {
      await onSubmit({
        gameId,
        playerId,
        staminaPct: stamina,
        fatigueLevel: fatigue,
        heartRateBpm: hr,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ingest failed');
    }
  }

  return (
    <div
      data-testid="biometric-admin-panel"
      className="flex flex-col gap-4 p-4 rounded-md border border-border bg-card"
    >
      <h3 className="font-display uppercase tracking-wide text-base text-foreground">
        Biometric entry
      </h3>

      {/* Player select */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
          Player
        </label>
        <select
          value={playerId}
          onChange={(e) => setPlayerId(e.target.value)}
          className="w-full px-2 py-1.5 rounded-sm border border-border bg-background text-sm text-foreground"
        >
          {players.map((p) => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>

      {/* Stamina slider */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Stamina</label>
          <span className="text-xs font-display tabular-nums text-foreground">{stamina}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={stamina}
          onChange={(e) => setStamina(Number(e.target.value))}
          className="w-full accent-primary"
          data-testid="biometric-stamina-input"
        />
      </div>

      {/* Fatigue dropdown */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
          Fatigue
        </label>
        <div className="flex flex-wrap gap-1.5">
          {FATIGUE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => setFatigue(opt)}
              className={[
                'px-2.5 py-1 rounded-full border text-xs font-semibold uppercase tracking-wider transition-colors',
                fatigue === opt
                  ? 'border-primary bg-[hsl(var(--primary)/0.15)] text-primary'
                  : 'border-border bg-background text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Heart rate (optional) */}
      <div>
        <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
          Heart rate (optional)
        </label>
        <input
          type="number"
          min={20}
          max={260}
          step={1}
          value={hrStr}
          onChange={(e) => setHrStr(e.target.value)}
          className={[
            'w-full px-2 py-1.5 rounded-sm border bg-background text-sm text-foreground tabular-nums',
            hrValid ? 'border-border' : 'border-destructive',
          ].join(' ')}
          data-testid="biometric-hr-input"
        />
      </div>

      {/* Live preview */}
      <div className="rounded-md border border-border bg-background p-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          Preview
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <StaminaBar pct={stamina} />
          <HeartRateDisplay bpm={hr} size={14} />
          <FatigueIndicator level={fatigue} />
        </div>
      </div>

      {error && <div role="alert" className="text-xs text-destructive">{error}</div>}

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        data-testid="biometric-submit"
        className={[
          'w-full inline-flex items-center justify-center px-4 py-2 rounded-sm',
          'text-sm font-semibold uppercase tracking-wider',
          'bg-primary text-primary-foreground',
          'hover:bg-[hsl(var(--primary)/0.9)] transition-colors',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        ].join(' ')}
      >
        Publish snapshot
      </button>
    </div>
  );
}

export const BiometricAdminPanel = memo(BiometricAdminPanelImpl);
