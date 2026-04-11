import type { MediaLayoutSaveState } from '../types/types';

type Props = {
  state: MediaLayoutSaveState;
  onSave: () => void;
  onCancel: () => void;
  onReset: () => void;
};

export function MediaLayoutSaveBar({ state, onSave, onCancel, onReset }: Props) {
  const label = state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : state === 'failed' ? 'Failed' : state === 'dirty' ? 'Unsaved changes' : 'Idle';
  const dirty = state === 'dirty' || state === 'failed';
  return (
    <div className="panel mb-4 flex items-center justify-between gap-3 p-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">Layout state: <span className="text-[#C9A84C]">{label}</span></p>
      <div className="flex items-center gap-2">
        <button type="button" className="rounded-sm border border-border bg-secondary px-3 py-1.5 text-xs" onClick={onCancel} disabled={!dirty}>Cancel</button>
        <button type="button" className="rounded-sm border border-border bg-secondary px-3 py-1.5 text-xs" onClick={onReset}>Reset</button>
        <button type="button" className="rounded-sm bg-primary px-3 py-1.5 text-xs text-primary-foreground" onClick={onSave} disabled={!dirty}>Save</button>
      </div>
    </div>
  );
}
