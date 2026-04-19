import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

interface OverlayEvent {
  id: string;
  event_type: string;
  payload: Record<string, any>;
  triggered_at: string;
}

export function MicUpOverlay() {
  const { gameId } = useParams<{ gameId: string }>();
  const [activeEvent, setActiveEvent] = useState<OverlayEvent | null>(null);

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    let lastEventId: string | null = null;

    const poll = async () => {
      try {
        // Need to add this endpoint to the worker!
        const res = await fetch(`/api/streams/${gameId}/overlay/events/latest`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.ok && data.event) {
          const ev = data.event as OverlayEvent;
          if (ev.id !== lastEventId) {
            lastEventId = ev.id;
            setActiveEvent(ev);
            // Clear event after 5 seconds
            setTimeout(() => {
              if (!cancelled) setActiveEvent(null);
            }, 5000);
          }
        }
      } catch (err) {
        // ignore
      }
    };

    poll();
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [gameId]);

  if (!activeEvent) return null;

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingBottom: '10%'
    }}>
      {activeEvent.event_type === 'intro_sting' && (
        <IntroSting />
      )}
      {activeEvent.event_type === 'trash_talk' && (
        <TrashTalkPopup payload={activeEvent.payload} />
      )}
    </div>
  );
}

function IntroSting() {
  return (
    <div style={{
      animation: 'sting-in 2.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
      background: 'linear-gradient(45deg, #000, #333)',
      border: '4px solid #ffb020',
      padding: '20px 40px',
      borderRadius: '8px',
      transform: 'scale(0)',
      boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      gap: '20px'
    }}>
      <div style={{ color: '#ffb020', fontSize: '48px', fontWeight: '900', fontStyle: 'italic', letterSpacing: '0.05em' }}>
        MIC UP
      </div>
      <div style={{ width: '4px', height: '50px', background: '#fff' }} />
      <div style={{ color: '#fff', fontSize: '32px', fontWeight: '700', letterSpacing: '0.1em' }}>
        SERIES
      </div>
      <style>{`
        @keyframes sting-in {
          0% { transform: scale(0) rotate(-10deg); opacity: 0; }
          20% { transform: scale(1.1) rotate(2deg); opacity: 1; }
          30% { transform: scale(1) rotate(0deg); opacity: 1; }
          80% { transform: scale(1) rotate(0deg); opacity: 1; filter: blur(0px); }
          100% { transform: scale(1.5); opacity: 0; filter: blur(10px); }
        }
      `}</style>
    </div>
  );
}

function TrashTalkPopup({ payload }: { payload: any }) {
  return (
    <div style={{
      animation: 'slide-up 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards, fade-out 0.5s 4.5s forwards',
      background: 'rgba(10, 12, 18, 0.95)',
      borderLeft: '8px solid #ff0055',
      padding: '16px 24px',
      borderRadius: '4px',
      maxWidth: '600px',
      color: '#fff',
      boxShadow: '0 10px 30px rgba(0,0,0,0.5)'
    }}>
      <div style={{ fontSize: '14px', color: '#ff0055', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>
        {payload.player_name || 'Player'}
      </div>
      <div style={{ fontSize: '24px', fontWeight: '800', fontStyle: 'italic' }}>
        "{payload.message || 'Trash talk message'}"
      </div>
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes fade-out {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `}</style>
    </div>
  );
}