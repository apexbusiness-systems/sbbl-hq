/**
 * HighlightMarker — admin button for the overlay console.
 *
 * Drops an inline panel onto OverlayControl that lets an operator mark the
 * current moment as a highlight with an optional title/description. Score,
 * period, and clock are sampled server-side from overlay_game_state.
 *
 * The compact recent-highlights list is intentionally minimal — this is a
 * mid-broadcast control surface, not a library browser.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Star, X } from 'lucide-react';
import {
  fetchHighlights,
  markHighlight,
  deleteHighlight,
  type Highlight,
} from '@/lib/api/highlights';

function fmtClock(seconds: number | null): string {
  if (seconds == null) return '--:--';
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

function periodLabel(period: number | null): string {
  if (period == null) return '—';
  if (period <= 4) return `Q${period}`;
  const ot = period - 4;
  return ot === 1 ? 'OT' : `${ot}OT`;
}

export default function HighlightMarker({ gameId }: { gameId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const query = useQuery<{ ok: boolean; data: Highlight[] }>({
    queryKey: ['highlights', gameId],
    queryFn: () => fetchHighlights(gameId),
    enabled: !!gameId,
  });

  const recent = Array.isArray(query.data?.data) ? query.data!.data.slice(0, 5) : [];

  const reset = () => {
    setTitle('');
    setDescription('');
    setOpen(false);
  };

  const onSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await markHighlight({
        game_id: gameId,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
      });
      toast.success('Highlight marked');
      reset();
      await query.refetch();
    } catch (err) {
      toast.error(`Mark failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    try {
      await deleteHighlight(id);
      toast.success('Highlight removed');
      await query.refetch();
    } catch (err) {
      toast.error(`Delete failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {!open ? (
        <button
          className="px-3 py-2 border border-border rounded-sm text-sm hover:bg-secondary inline-flex items-center gap-2 self-start"
          onClick={() => setOpen(true)}
        >
          <Star className="h-4 w-4" />
          Mark Highlight
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            className="px-3 py-2 bg-background border border-border rounded-sm text-sm"
            placeholder="Title (optional, e.g., 'Buzzer-beater three')"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving}
          />
          <textarea
            className="px-3 py-2 bg-background border border-border rounded-sm text-sm resize-none"
            placeholder="Description (optional)"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={saving}
          />
          <div className="flex gap-2">
            <button
              className="px-4 py-2 bg-primary text-primary-foreground rounded-sm text-sm font-bold disabled:opacity-50"
              onClick={onSave}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              className="px-4 py-2 border border-border rounded-sm text-sm"
              onClick={reset}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {recent.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {recent.map((h) => (
            <li
              key={h.id}
              className="flex items-center justify-between gap-2 text-xs px-2 py-1 border border-border rounded-sm bg-background/40"
            >
              <span className="truncate">
                <span className="font-medium">{h.title ?? '(untitled)'}</span>
                <span className="text-muted-foreground">
                  {' · '}
                  {periodLabel(h.period)} {fmtClock(h.clock_seconds)}
                  {' · '}
                  {h.home_score ?? 0}-{h.away_score ?? 0}
                </span>
              </span>
              <button
                className="p-1 rounded-sm hover:bg-secondary text-muted-foreground"
                onClick={() => onDelete(h.id)}
                aria-label="Delete highlight"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
