import { ArrowLeft, Loader2, X, Check } from 'lucide-react';
import type { UploadStep } from '@/hooks/useMediaUploadFlow';
import type { MediaParserOutput } from '@/lib/media/mediaParserSchema';
import { MediaUploadStepLeague } from './MediaUploadStepLeague';
import { MediaUploadStepSurface } from './MediaUploadStepSurface';
import { MediaUploadStepStatus } from './MediaUploadStepStatus';
import { MediaUploadStepDrop } from './MediaUploadStepDrop';
import { MediaParserReviewPanel } from './MediaUploadStepReview';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

export type MediaUploadFlowProps = {
  isOpen: boolean;
  step: UploadStep;
  leagueId: string | null;
  surface: string | null;
  publishStatus: 'draft' | 'published' | 'needs_review';
  parserResult: MediaParserOutput | null;
  fieldOverrides: Record<string, unknown>;
  isUploading: boolean;
  uploadError: Error | null;
  onSetLeague: (leagueId: string) => void;
  onSetSurface: (surface: string) => void;
  onSetPublishStatus: (status: 'draft' | 'published' | 'needs_review') => void;
  onFileSelected: (file: File) => void;
  onOverrideField: (field: string, value: unknown) => void;
  onGoBack: () => void;
  onReset: () => void;
  onClose: () => void;
};

const STEPS: UploadStep[] = ['league', 'surface', 'status', 'drop', 'review', 'complete'];
const STEP_LABELS: Record<UploadStep, string> = {
  league: 'League',
  surface: 'Surface',
  status: 'Status',
  drop: 'Upload',
  review: 'Review',
  complete: 'Done',
};

export function MediaUploadFlow({
  isOpen,
  step,
  leagueId,
  surface,
  publishStatus,
  parserResult,
  fieldOverrides,
  isUploading,
  uploadError,
  onSetLeague,
  onSetSurface,
  onSetPublishStatus,
  onFileSelected,
  onOverrideField,
  onGoBack,
  onReset,
  onClose,
}: MediaUploadFlowProps) {
  const currentStepIndex = STEPS.indexOf(step);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Upload Media</SheetTitle>
          <SheetDescription>Guided upload for new media publications</SheetDescription>
        </SheetHeader>

        {/* Progress indicator */}
        <div className="flex items-center gap-1 my-4">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= currentStepIndex ? 'bg-primary' : 'bg-secondary'
              }`}
              title={STEP_LABELS[s]}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="space-y-6 pb-20">
          {step === 'league' && (
            <MediaUploadStepLeague
              selectedLeagueId={leagueId}
              onSelect={onSetLeague}
            />
          )}
          {step === 'surface' && (
            <>
              <button
                type="button"
                onClick={onGoBack}
                className="min-h-[44px] flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <MediaUploadStepSurface
                selectedSurface={surface}
                onSelect={onSetSurface}
              />
            </>
          )}
          {step === 'status' && (
            <>
              <button
                type="button"
                onClick={onGoBack}
                className="min-h-[44px] flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <MediaUploadStepStatus
                selectedStatus={publishStatus}
                onSelect={onSetPublishStatus}
              />
            </>
          )}
          {step === 'drop' && (
            <>
              <button
                type="button"
                onClick={onGoBack}
                className="min-h-[44px] flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <MediaUploadStepDrop
                onFileSelected={onFileSelected}
                isUploading={isUploading}
              />
            </>
          )}
          {step === 'review' && (
            <>
              <button
                type="button"
                onClick={onGoBack}
                className="min-h-[44px] flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <MediaParserReviewPanel
                parserResult={parserResult}
                fieldOverrides={fieldOverrides}
                onOverrideField={onOverrideField}
              />
            </>
          )}
          {step === 'complete' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-success" />
              </div>
              <h3 className="text-lg font-semibold">Upload Complete</h3>
              <p className="text-sm text-muted-foreground">
                Your media has been submitted for processing.
              </p>
              <button
                type="button"
                onClick={onReset}
                className="min-h-[44px] px-6 py-2 text-sm font-semibold bg-primary text-primary-foreground rounded-sm hover:bg-primary/90 transition-colors"
              >
                Upload Another
              </button>
            </div>
          )}

          {uploadError && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-sm">
              Upload failed: {uploadError.message}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
