import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface BiometricSnapshot {
  player_id: string;
  heart_rate_bpm: number | null;
  stamina_pct: number | null;
  fatigue_level: 'fresh' | 'moderate' | 'tired' | 'gassed' | null;
}

export function BiometricsOverlay() {
  const { gameId } = useParams<{ gameId: string }>();
  const [snapshots, setSnapshots] = useState<BiometricSnapshot[]>([]);

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/streams/${gameId}/biometrics/latest`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.ok) {
          setSnapshots(data.snapshots);
        }
      } catch (err) {
        // ignore network errors
      }
    };

    poll();
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [gameId]);

  if (snapshots.length === 0) return null;

  return (
    <div style={{
      position: 'absolute',
      right: 32,
      top: 100,
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }}>
      {snapshots.map((snap) => (
        <BiometricCard key={snap.player_id} data={snap} />
      ))}
    </div>
  );
}

function BiometricCard({ data }: { data: BiometricSnapshot }) {
  const isGassed = data.fatigue_level === 'gassed';
  const color = isGassed ? '#ff3333' : data.fatigue_level === 'tired' ? '#ffaa00' : '#00ffaa';

  return (
    <div style={{
      background: 'rgba(10, 12, 18, 0.85)',
      backdropFilter: 'blur(10px)',
      border: `1px solid ${color}`,
      boxShadow: `0 0 15px ${color}40`,
      borderRadius: 8,
      padding: '12px 16px',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      minWidth: 200,
      transform: isGassed ? 'scale(1.05)' : 'scale(1)',
      transition: 'transform 0.3s ease'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: 40,
        height: 40
      }}>
        {/* Simple Heart SVG with Pulse Animation */}
        <svg viewBox="0 0 32 32" width="32" height="32" style={{
          animation: data.heart_rate_bpm ? `pulse ${60 / data.heart_rate_bpm}s infinite` : 'none'
        }}>
          <path d="M16 28 C16 28 4 18 4 10 C4 5 10 3 16 9 C22 3 28 5 28 10 C28 18 16 28 16 28 Z" fill={color} />
        </svg>
        <span style={{ fontSize: 12, fontWeight: 'bold', marginTop: 4 }}>
          {data.heart_rate_bpm ? `${data.heart_rate_bpm} BPM` : '--'}
        </span>
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7 }}>
          Stamina
        </div>
        <div style={{
          width: '100%',
          height: 8,
          background: 'rgba(255,255,255,0.1)',
          borderRadius: 4,
          overflow: 'hidden',
          marginTop: 4
        }}>
          <div style={{
            width: `${data.stamina_pct ?? 0}%`,
            height: '100%',
            background: color,
            transition: 'width 0.5s ease-out'
          }} />
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); }
          15% { transform: scale(1.2); }
          30% { transform: scale(1); }
          45% { transform: scale(1.2); }
          60% { transform: scale(1); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}