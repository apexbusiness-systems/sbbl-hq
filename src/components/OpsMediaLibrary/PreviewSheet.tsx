import { Image as ImageIcon } from 'lucide-react';
import { getLeagueConfig } from '@/lib/leagues';
import type { OpsMediaPublication } from '@/lib/api/ops';
import type { LeagueId } from '@/types';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

export type PreviewSheetProps = {
  publication: OpsMediaPublication | null;
  isOpen: boolean;
  onClose: () => void;
};

const statusColors: Record<string, string> = {
  published: 'text-success',
  draft: 'text-muted-foreground',
  scheduled: 'text-warning',
  archived: 'text-destructive',
};

export function PreviewSheet({ publication, isOpen, onClose }: PreviewSheetProps) {
  const leagueConfig = publication?.leagueId
    ? getLeagueConfig(publication.leagueId as LeagueId)
    : null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg flex flex-col gap-0 p-0 overflow-y-auto"
        aria-label="Preview Media"
      >
        <SheetHeader className="p-6 pb-4 border-b border-border flex-shrink-0">
          <SheetTitle className="text-base font-semibold normal-case tracking-normal">
            Preview
          </SheetTitle>
        </SheetHeader>

        {publication && (
          <div className="flex-1 p-6 space-y-6">
            {/* Large thumbnail */}
            <div className="w-full bg-secondary rounded-sm overflow-hidden border border-border/50 aspect-video flex items-center justify-center">
              {publication.thumbnail ? (
                <img
                  src={publication.thumbnail}
                  alt={publication.title}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              ) : (
                <ImageIcon className="w-12 h-12 text-muted-foreground" />
              )}
            </div>

            {/* Title */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Title
              </p>
              <p className="font-semibold text-base">
                {publication.title || <span className="text-muted-foreground italic">(untitled)</span>}
              </p>
            </div>

            {/* Grid meta */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Surface
                </p>
                <p className="font-medium capitalize text-sm">{publication.surface}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Status
                </p>
                <p className={`font-semibold capitalize text-sm ${statusColors[publication.status] ?? ''}`}>
                  {publication.status}
                </p>
              </div>
            </div>

            {leagueConfig && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  League
                </p>
                <div className="flex items-center gap-2">
                  <img
                    src={leagueConfig.logo}
                    alt={leagueConfig.name}
                    className="w-4 h-4 opacity-80"
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                  />
                  <p className="font-medium text-sm">{leagueConfig.name}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {publication.createdAt && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    Created
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {new Date(publication.createdAt).toLocaleDateString('en-CA', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                </div>
              )}
              {publication.publishedAt && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                    Published
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {new Date(publication.publishedAt).toLocaleDateString('en-CA', {
                      month: 'short', day: 'numeric', year: 'numeric',
                    })}
                  </p>
                </div>
              )}
            </div>

            {/* ID */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                Publication ID
              </p>
              <p className="font-mono text-[10px] text-muted-foreground break-all bg-secondary/50 p-2 rounded-sm">
                {publication.id}
              </p>
            </div>

            {/* Parser confidence */}
            {publication.parserConfidence != null && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Parser Confidence
                </p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.round(publication.parserConfidence * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">
                    {Math.round(publication.parserConfidence * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
