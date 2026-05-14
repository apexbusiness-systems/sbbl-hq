import { Pin, PinOff } from 'lucide-react';

export type MediaPinToggleProps = {
  isPinned: boolean;
  isPinning?: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

export function MediaPinToggle({ isPinned, isPinning, onToggle, disabled }: MediaPinToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isPinning || disabled}
      className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-sm border transition-colors ${
        isPinned
          ? 'border-primary/50 bg-primary/10 text-primary hover:bg-primary/20'
          : 'border-border text-muted-foreground hover:text-foreground hover:bg-secondary'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
      aria-label={isPinned ? 'Unpin publication' : 'Pin publication'}
      title={isPinned ? 'Unpin' : 'Pin'}
    >
      {isPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
    </button>
  );
}
