/**
 * Remediation CTA block — rendered once at the bottom of the preflight
 * panel when the aggregate verdict is `blocked`. Shows the highest-
 * priority remediation action (first failing check wins).
 */
import type { CheckResult } from '@/lib/preflight/types';

interface Props {
  result: CheckResult;
  onRemediate: (result: CheckResult) => void;
}

export function PreflightRemediation({ result, onRemediate }: Props) {
  if (!result.remediation) return null;
  return (
    <div className="mt-4 p-4 rounded-md border border-destructive/30 bg-destructive/5">
      <div className="text-sm font-medium text-destructive-foreground mb-1">
        {result.label}
      </div>
      {result.detail && (
        <div className="text-xs text-muted-foreground mb-3">{result.detail}</div>
      )}
      <button
        type="button"
        onClick={() => onRemediate(result)}
        data-testid="preflight-remediation-cta"
        data-action={result.remediation.action}
        className={[
          'w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-sm',
          'text-sm font-semibold uppercase tracking-wider',
          'bg-primary text-primary-foreground',
          'hover:bg-[hsl(var(--primary)/0.9)] transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        ].join(' ')}
      >
        {result.remediation.cta}
      </button>
    </div>
  );
}
