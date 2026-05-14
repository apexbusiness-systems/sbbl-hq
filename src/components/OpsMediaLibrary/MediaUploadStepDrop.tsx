import { useRef, useCallback, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';

export type MediaUploadStepDropProps = {
  onFileSelected: (file: File) => void;
  isUploading?: boolean;
  disabled?: boolean;
  acceptedTypes?: string;
};

export function MediaUploadStepDrop({
  onFileSelected,
  isUploading,
  disabled,
  acceptedTypes = 'image/*,video/*',
}: MediaUploadStepDropProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      onFileSelected(file);
    },
    [onFileSelected],
  );

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Upload Media</h3>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !isUploading) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (!disabled && !isUploading) handleFiles(e.dataTransfer.files);
        }}
        className={`min-h-[200px] flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-sm transition-colors ${
          isDragOver
            ? 'border-primary bg-primary/10'
            : 'border-border bg-secondary/30 hover:border-primary/50'
        } ${disabled || isUploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
        onClick={() => !disabled && !isUploading && inputRef.current?.click()}
        role="button"
        aria-label="Upload media file"
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptedTypes}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled || isUploading}
        />
        {isUploading ? (
          <>
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Uploading…</p>
          </>
        ) : (
          <>
            <Upload className="w-8 h-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Drop file here or click to browse</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Images and videos accepted</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
