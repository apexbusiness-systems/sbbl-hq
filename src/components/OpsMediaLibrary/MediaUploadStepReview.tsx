import type { MediaParserOutput } from '@/lib/media/mediaParserSchema';
import { CONFIDENCE_THRESHOLDS } from '@/lib/media/mediaParserSchema';
import { AlertTriangle, Check, Edit2 } from 'lucide-react';

export type MediaParserReviewPanelProps = {
  parserResult: MediaParserOutput | null;
  fieldOverrides: Record<string, unknown>;
  onOverrideField: (field: string, value: unknown) => void;
  disabled?: boolean;
};

const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  subtitle: 'Subtitle',
  leagueCode: 'League',
  surface: 'Surface',
};

export function MediaParserReviewPanel({
  parserResult,
  fieldOverrides,
  onOverrideField,
  disabled,
}: MediaParserReviewPanelProps) {
  if (!parserResult) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No parser results yet.
      </div>
    );
  }

  const fieldEntries = Object.entries(FIELD_LABELS).filter(
    ([key]) => parserResult[key as keyof MediaParserOutput] !== null || fieldOverrides[key] !== undefined,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">Parser Results</h3>
        {parserResult.needsReview && (
          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-amber-500/20 text-amber-500 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            Review Needed
          </span>
        )}
      </div>

      {/* Overall confidence bar */}
      {parserResult.confidence !== null && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Overall Confidence</span>
            <span className={`font-semibold ${
              parserResult.confidence >= CONFIDENCE_THRESHOLDS.HIGH ? 'text-success' :
              parserResult.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM ? 'text-amber-500' :
              'text-destructive'
            }`}>
              {Math.round(parserResult.confidence * 100)}%
            </span>
          </div>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                parserResult.confidence >= CONFIDENCE_THRESHOLDS.HIGH ? 'bg-success' :
                parserResult.confidence >= CONFIDENCE_THRESHOLDS.MEDIUM ? 'bg-amber-500' :
                'bg-destructive'
              }`}
              style={{ width: `${Math.round(parserResult.confidence * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Field-by-field review */}
      <div className="space-y-3">
        {fieldEntries.map(([key, label]) => {
          const parsedValue = parserResult[key as keyof MediaParserOutput];
          const overridden = fieldOverrides[key] !== undefined;
          const displayValue = overridden ? fieldOverrides[key] : parsedValue;
          const fieldConf = parserResult.fieldConfidence[key] ?? null;
          const isLow = fieldConf !== null && fieldConf < CONFIDENCE_THRESHOLDS.LOW;

          return (
            <div key={key} className="space-y-1">
              <div className="flex items-center gap-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {label}
                </label>
                {isLow && (
                  <span className="text-[10px] text-destructive flex items-center gap-0.5">
                    <AlertTriangle className="w-3 h-3" />
                    Low
                  </span>
                )}
                {overridden && (
                  <span className="text-[10px] text-primary flex items-center gap-0.5">
                    <Edit2 className="w-3 h-3" />
                    Overridden
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={String(displayValue ?? '')}
                  onChange={(e) => onOverrideField(key, e.target.value)}
                  disabled={disabled}
                  className={`flex-1 min-h-[44px] bg-secondary border rounded-sm px-3 text-sm disabled:opacity-50 ${
                    isLow ? 'border-destructive/50' :
                    overridden ? 'border-primary/50' :
                    'border-border'
                  }`}
                />
                {fieldConf !== null && (
                  <span className={`text-[10px] font-mono w-10 text-right ${
                    fieldConf >= CONFIDENCE_THRESHOLDS.MEDIUM ? 'text-success' :
                    fieldConf >= CONFIDENCE_THRESHOLDS.LOW ? 'text-amber-500' :
                    'text-destructive'
                  }`}>
                    {Math.round(fieldConf * 100)}%
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Uncertain fields list */}
      {parserResult.uncertainFields.length > 0 && (
        <div className="text-xs text-muted-foreground">
          Uncertain fields: {parserResult.uncertainFields.join(', ')}
        </div>
      )}
    </div>
  );
}
