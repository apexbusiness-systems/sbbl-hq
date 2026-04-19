/**
 * One row in the preflight checklist. Stateless — props drive everything.
 *
 * Visual states:
 *   - pending: grey dot, neutral label
 *   - pass:    green check + pass label
 *   - warn:    amber warning + detail
 *   - fail:    destructive red + detail + optional CTA
 *   - skipped: muted dot, "not applicable" copy
 */
import type { CheckResult } from '@/lib/preflight/types';
import { AlertCircle, Check, CircleDot, Info, XCircle } from 'lucide-react';

interface Props {
  result: CheckResult;
  /** Staggered animation delay in ms. Driven by the orchestrator. */
  revealDelayMs?: number;
  /** Renders the remediation CTA button when present. */
  onRemediate?: (result: CheckResult) => void;
}

const STATUS_META = {
  pending: { Icon: CircleDot, iconClass: 'text-muted-foreground', ringClass: 'border-border' },
  pass:    { Icon: Check,     iconClass: 'text-[hsl(var(--success))]', ringClass: 'border-[hsl(var(--success))/0.4]' },
  warn:    { Icon: AlertCircle, iconClass: 'text-[hsl(var(--warning))]', ringClass: 'border-[hsl(var(--warning))/0.4]' },
  fail:    { Icon: XCircle,   iconClass: 'text-destructive', ringClass: 'border-destructive/40' },
  skipped: { Icon: Info,      iconClass: 'text-muted-foreground/60', ringClass: 'border-border/50' },
} as const;

export function PreflightCheckItem({ result, revealDelayMs = 0, onRemediate }: Props) {
  const meta = STATUS_META[result.status];
  const { Icon } = meta;

  return (
    <div
      data-testid={`preflight-check-${result.id}`}
      data-status={result.status}
      className={[
        'flex items-start gap-3 p-3 rounded-md border bg-card/60',
        meta.ringClass,
        'opacity-0 translate-y-2',
        'animate-[sbbl-preflight-reveal_280ms_cubic-bezier(0.16,1,0.3,1)_forwards]',
        'motion-reduce:animate-none motion-reduce:opacity-100 motion-reduce:translate-y-0',
      ].join(' ')}
      style={{ animationDelay: `${revealDelayMs}ms` }}
    >
      <div
        className={[
          'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center',
          'bg-background border',
          meta.ringClass,
        ].join(' ')}
      >
        <Icon className={`w-3.5 h-3.5 ${meta.iconClass}`} aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground">{result.label}</div>
        {result.detail && (
          <div className="text-xs text-muted-foreground mt-0.5">{result.detail}</div>
        )}
        {result.remediation && onRemediate && (
          <button
            type="button"
            onClick={() => onRemediate(result)}
            className={[
              'mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm',
              'text-xs font-semibold uppercase tracking-wider',
              'bg-primary text-primary-foreground',
              'hover:bg-[hsl(var(--primary)/0.9)] transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            ].join(' ')}
          >
            {result.remediation.cta}
          </button>
        )}
      </div>
      <style>{`
        @keyframes sbbl-preflight-reveal {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
