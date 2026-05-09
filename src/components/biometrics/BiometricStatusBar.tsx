/**
 * Single-player biometric bar — composes stamina + heart rate + fatigue.
 */
import { memo } from 'react';
import { StaminaBar } from './StaminaBar';
import { HeartRateDisplay } from './HeartRateDisplay';
import { FatigueIndicator } from './FatigueIndicator';
import type { BiometricSnapshot } from '@/lib/biometrics/types';

interface Props {
  snapshot: BiometricSnapshot | null;
  playerLabel: string;
  align?: 'left' | 'right';
}

function BiometricStatusBarImpl({ snapshot, playerLabel, align = 'left' }: Props) {
  return (
    <div
      data-testid="biometric-status-bar"
      data-align={align}
      className={[
        'flex flex-col gap-1 text-xs',
        align === 'right' ? 'items-end text-right' : 'items-start text-left',
      ].join(' ')}
    >
      <div className="font-display uppercase tracking-wider text-[12px] text-foreground">
        {playerLabel}
      </div>
      <StaminaBar pct={snapshot?.staminaPct ?? null} />
      <div className={[
        'flex items-center gap-3 mt-0.5',
        align === 'right' ? 'flex-row-reverse' : 'flex-row',
      ].join(' ')}>
        <HeartRateDisplay bpm={snapshot?.heartRateBpm ?? null} size={14} />
        <FatigueIndicator level={snapshot?.fatigueLevel ?? null} />
      </div>
    </div>
  );
}

export const BiometricStatusBar = memo(BiometricStatusBarImpl);
