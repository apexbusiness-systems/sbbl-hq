import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BiometricAdminPanel } from '@/components/biometrics/BiometricAdminPanel';
import { fetchPublicHome } from '@/lib/api/public';
import { ingestBiometric } from '@/lib/api/biometrics';
import { postOverlayEvent } from '@/lib/api/overlay';
import { toast } from 'sonner';

export default function OpsBiometricsPage() {
  const [selectedGameId, setSelectedGameId] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const homeQuery = useQuery({
    queryKey: ['ops-biometrics-home'],
    queryFn: () => fetchPublicHome(),
    staleTime: 60_000,
  });

  const games = useMemo(() => {
    const rows = [
      ...((homeQuery.data?.data?.liveGames ?? []) as Array<Record<string, unknown>>),
      ...((homeQuery.data?.data?.upcomingGames ?? []) as Array<Record<string, unknown>>),
    ];
    return rows.map((row) => ({
      id: String(row.id),
      label: `${String((row.home_team as { name?: string } | null)?.name ?? 'Home')} vs ${String((row.away_team as { name?: string } | null)?.name ?? 'Away')}`,
      players: [
        { id: String(row.home_team_id ?? 'home'), label: String((row.home_team as { name?: string } | null)?.name ?? 'Home') },
        { id: String(row.away_team_id ?? 'away'), label: String((row.away_team as { name?: string } | null)?.name ?? 'Away') },
      ],
    }));
  }, [homeQuery.data]);

  const selectedGame = games.find((g) => g.id === selectedGameId) ?? games[0] ?? null;

  const onPublish = async (args: Parameters<typeof ingestBiometric>[0]) => {
    setBusy(true);
    try {
      await ingestBiometric(args);
      toast.success('Biometric snapshot published');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Publish failed');
    } finally {
      setBusy(false);
    }
  };

  const triggerTrashTalk = async () => {
    if (!selectedGame) return;
    setBusy(true);
    try {
      await postOverlayEvent(selectedGame.id, { eventType: 'trash_talk', payload: { label: 'TRASH TALK DETECTED' } });
      toast.success('Trash talk banner triggered');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Trigger failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container py-6 space-y-4">
      <h1 className="font-display text-xl text-foreground">Biometric + Mic Up Ops</h1>
      <div className="panel p-4 space-y-3">
        <label className="text-xs uppercase tracking-wider text-muted-foreground">Game</label>
        <select
          value={selectedGameId || selectedGame?.id || ''}
          onChange={(e) => setSelectedGameId(e.target.value)}
          className="w-full bg-secondary border border-border rounded-sm px-3 py-2 text-sm"
        >
          {games.map((game) => (
            <option key={game.id} value={game.id}>{game.label}</option>
          ))}
        </select>
      </div>

      {!selectedGame && (
        <div className="panel p-4 text-sm text-muted-foreground">No live/upcoming games available.</div>
      )}

      {selectedGame && (
        <>
          <BiometricAdminPanel
            gameId={selectedGame.id}
            players={selectedGame.players}
            busy={busy}
            onSubmit={onPublish}
          />
          <div className="panel p-4">
            <button
              type="button"
              onClick={() => void triggerTrashTalk()}
              disabled={busy}
              className="px-4 py-2 rounded-sm bg-primary text-primary-foreground text-xs font-semibold uppercase tracking-wider disabled:opacity-50"
            >
              Trigger trash-talk banner
            </button>
          </div>
        </>
      )}
    </div>
  );
}
