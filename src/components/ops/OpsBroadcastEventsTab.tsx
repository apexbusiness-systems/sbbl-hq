import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Radio, Loader2, CheckCircle2, AlertCircle, ChevronRight, X } from 'lucide-react';
import {
  adminListBroadcastEvents,
  adminCreateBroadcastEvent,
  adminUpdateBroadcastEvent,
  adminTransitionBroadcastStatus,
} from '@/lib/api/broadcast-events';
import type { BroadcastEventStatus, LivestreamBroadcastEvent } from '@/types';

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<BroadcastEventStatus, string> = {
  live:      'text-[#E63946] border-[#E63946]/30 bg-[#E63946]/10',
  scheduled: 'text-[#C9A84C] border-[#C9A84C]/30 bg-[#C9A84C]/10',
  draft:     'text-muted-foreground border-border bg-transparent',
  ended:     'text-muted-foreground border-border bg-transparent',
  cancelled: 'text-muted-foreground border-border bg-transparent',
  archived:  'text-muted-foreground border-border bg-transparent',
};

function StatusBadge({ status }: { status: BroadcastEventStatus }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm border text-[10px] font-bold uppercase tracking-widest ${STATUS_COLORS[status] ?? STATUS_COLORS.draft}`}>
      {status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-[#E63946] animate-pulse mr-1" />}
      {status}
    </span>
  );
}

// ── Allowed transitions from each status ──────────────────────────────────────

const TRANSITIONS: Record<BroadcastEventStatus, BroadcastEventStatus[]> = {
  draft:     ['scheduled', 'cancelled'],
  scheduled: ['live', 'cancelled'],
  live:      ['ended', 'cancelled'],
  ended:     ['archived'],
  cancelled: ['archived'],
  archived:  [],
};

// ── Create/Edit form ──────────────────────────────────────────────────────────

type FormMode = 'create' | 'edit';

interface FormState {
  title: string;
  description: string;
  scheduled_start_at: string;
  stream_url: string;
  embed_url: string;
  thumbnail_url: string;
  visibility: 'public' | 'private' | 'unlisted';
}

const BLANK_FORM: FormState = {
  title: '',
  description: '',
  scheduled_start_at: '',
  stream_url: '',
  embed_url: '',
  thumbnail_url: '',
  visibility: 'public',
};

function BroadcastForm({
  mode,
  initial,
  eventId,
  onSuccess,
  onCancel,
}: {
  mode: FormMode;
  initial?: FormState;
  eventId?: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(initial ?? BLANK_FORM);

  const createMutation = useMutation({
    mutationFn: () =>
      adminCreateBroadcastEvent({
        title: form.title,
        description: form.description || undefined,
        scheduled_start_at: form.scheduled_start_at || undefined,
        stream_url: form.stream_url || undefined,
        embed_url: form.embed_url || undefined,
        thumbnail_url: form.thumbnail_url || undefined,
        visibility: form.visibility,
      }),
    onSuccess,
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      adminUpdateBroadcastEvent(eventId!, {
        title: form.title,
        description: form.description || undefined,
        scheduled_start_at: form.scheduled_start_at || undefined,
        stream_url: form.stream_url || undefined,
        embed_url: form.embed_url || undefined,
        thumbnail_url: form.thumbnail_url || undefined,
        visibility: form.visibility,
      }),
    onSuccess,
  });

  const mutation = mode === 'create' ? createMutation : updateMutation;
  const isLoading = mutation.isPending;
  const error = mutation.error instanceof Error ? mutation.error.message : null;

  function set(key: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const inputClass =
    'w-full bg-[#0d0d0d] border border-border rounded-sm px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/40';
  const labelClass = 'block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1';

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate();
      }}
      className="space-y-4"
    >
      <div>
        <label className={labelClass}>Title *</label>
        <input
          className={inputClass}
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          placeholder="Game 5 — WBL Championship Broadcast"
          required
        />
      </div>

      <div>
        <label className={labelClass}>Description</label>
        <textarea
          className={`${inputClass} resize-none h-20`}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Optional description shown on the event page"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Scheduled Start</label>
          <input
            type="datetime-local"
            className={inputClass}
            value={form.scheduled_start_at}
            onChange={(e) => set('scheduled_start_at', e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Visibility</label>
          <select
            className={inputClass}
            value={form.visibility}
            onChange={(e) => set('visibility', e.target.value as FormState['visibility'])}
          >
            <option value="public">Public</option>
            <option value="unlisted">Unlisted</option>
            <option value="private">Private</option>
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>Stream URL (HTTPS only)</label>
        <input
          className={inputClass}
          type="url"
          value={form.stream_url}
          onChange={(e) => set('stream_url', e.target.value)}
          placeholder="https://stream.example.com/live.m3u8"
        />
      </div>

      <div>
        <label className={labelClass}>Embed URL (HTTPS only)</label>
        <input
          className={inputClass}
          type="url"
          value={form.embed_url}
          onChange={(e) => set('embed_url', e.target.value)}
          placeholder="https://www.youtube.com/embed/abc123"
        />
      </div>

      <div>
        <label className={labelClass}>Thumbnail URL (HTTPS only)</label>
        <input
          className={inputClass}
          type="url"
          value={form.thumbnail_url}
          onChange={(e) => set('thumbnail_url', e.target.value)}
          placeholder="https://cdn.example.com/thumb.jpg"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 text-xs text-destructive">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {mutation.isSuccess && (
        <div className="flex items-center gap-2 text-xs text-success">
          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
          {mode === 'create' ? 'Broadcast created.' : 'Broadcast updated.'}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={isLoading || !form.title.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {mode === 'create' ? 'Create Broadcast' : 'Save Changes'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Event row ─────────────────────────────────────────────────────────────────

function EventRow({
  event,
  onStatusChange,
  onEdit,
}: {
  event: LivestreamBroadcastEvent;
  onStatusChange: (id: string, status: BroadcastEventStatus) => void;
  onEdit: (event: LivestreamBroadcastEvent) => void;
}) {
  const transitions = TRANSITIONS[event.status] ?? [];

  return (
    <div className="panel p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <StatusBadge status={event.status} />
            <span className="text-[10px] text-muted-foreground font-mono">{event.slug}</span>
          </div>
          <p className="text-sm font-semibold text-foreground truncate">{event.title}</p>
          {event.scheduled_start_at && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(event.scheduled_start_at).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          )}
        </div>
        <button
          onClick={() => onEdit(event)}
          className="flex-shrink-0 text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
        >
          Edit <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {transitions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {transitions.map((target) => (
            <button
              key={target}
              onClick={() => onStatusChange(event.id, target)}
              className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest border border-border rounded-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
            >
              → {target}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function OpsBroadcastEventsTab({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingEvent, setEditingEvent] = useState<LivestreamBroadcastEvent | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['ops-broadcast-events'],
    queryFn: () => adminListBroadcastEvents({ limit: 50 }),
    enabled,
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: BroadcastEventStatus }) =>
      adminTransitionBroadcastStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ops-broadcast-events'] });
    },
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['ops-broadcast-events'] });
  }

  const events = data?.data ?? [];

  if (!enabled) {
    return (
      <div className="panel p-6 text-sm text-muted-foreground text-center">
        Admin access required.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg uppercase tracking-wide text-foreground flex items-center gap-2">
            <Radio className="w-5 h-5 text-primary" />
            Broadcast Events
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Create and manage public livestream broadcast events.
          </p>
        </div>
        <button
          onClick={() => { setEditingEvent(null); setShowCreate((v) => !v); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          New Broadcast
        </button>
      </div>

      {/* Create form */}
      {showCreate && !editingEvent && (
        <div className="panel p-5 border-primary/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">
              New Broadcast
            </h3>
            <button onClick={() => setShowCreate(false)}>
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
          <BroadcastForm
            mode="create"
            onSuccess={() => { setShowCreate(false); refresh(); }}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}

      {/* Edit form */}
      {editingEvent && (
        <div className="panel p-5 border-primary/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">
              Edit: {editingEvent.title}
            </h3>
            <button onClick={() => setEditingEvent(null)}>
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
          <BroadcastForm
            mode="edit"
            eventId={editingEvent.id}
            initial={{
              title: editingEvent.title,
              description: editingEvent.description ?? '',
              scheduled_start_at: editingEvent.scheduled_start_at
                ? new Date(editingEvent.scheduled_start_at).toISOString().slice(0, 16)
                : '',
              stream_url: editingEvent.stream_url ?? '',
              embed_url: editingEvent.embed_url ?? '',
              thumbnail_url: editingEvent.thumbnail_url ?? '',
              visibility: editingEvent.visibility,
            }}
            onSuccess={() => { setEditingEvent(null); refresh(); }}
            onCancel={() => setEditingEvent(null)}
          />
        </div>
      )}

      {/* List */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((k) => (
            <div key={k} className="panel p-4 animate-pulse">
              <div className="h-3 w-16 bg-[#1a1a1a] rounded-sm mb-2" />
              <div className="h-4 w-1/2 bg-[#1a1a1a] rounded-sm" />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="panel p-4 border-destructive/30 text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Could not load broadcasts.
        </div>
      )}

      {!isLoading && !isError && events.length === 0 && (
        <div className="panel p-10 text-center space-y-2">
          <Radio className="w-8 h-8 text-muted-foreground/30 mx-auto" />
          <p className="text-sm text-muted-foreground">No broadcast events yet. Create one above.</p>
        </div>
      )}

      {!isLoading && !isError && events.length > 0 && (
        <div className="space-y-3">
          {events.map((e) => (
            <EventRow
              key={e.id}
              event={e}
              onStatusChange={(id, status) => statusMutation.mutate({ id, status })}
              onEdit={(event) => { setShowCreate(false); setEditingEvent(event); }}
            />
          ))}
        </div>
      )}

      {statusMutation.isError && (
        <div className="text-xs text-destructive flex items-center gap-1.5 mt-2">
          <AlertCircle className="w-3.5 h-3.5" />
          Status transition failed:{' '}
          {statusMutation.error instanceof Error
            ? statusMutation.error.message
            : 'unknown error'}
        </div>
      )}
    </div>
  );
}
