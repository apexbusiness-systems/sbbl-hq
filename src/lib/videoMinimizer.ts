const MB = 1024 * 1024;
const MAX_UPLOAD_BYTES = 50 * MB;

export type VideoMinimizerResult = {
  file: File;
  minimized: boolean;
  warning?: string;
};

function hasVideoCompressionSupport() {
  return (
    typeof document !== 'undefined' &&
    typeof HTMLVideoElement !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    typeof URL !== 'undefined'
  );
}

export async function minimizeVideoForUpload(input: File): Promise<VideoMinimizerResult> {
  if (input.size <= 35 * MB) return { file: input, minimized: false };
  if (!hasVideoCompressionSupport()) {
    return { file: input, minimized: false, warning: 'Browser compression not supported; uploading original file.' };
  }

  const sourceUrl = URL.createObjectURL(input);
  const video = document.createElement('video');
  video.src = sourceUrl;
  video.muted = true;
  video.playsInline = true;

  try {
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('video_metadata_failed'));
    });

    const ratio = (video.videoWidth || 1280) / (video.videoHeight || 720);
    const targetWidth = Math.min(video.videoWidth || 1280, 1280);
    const targetHeight = Math.round(targetWidth / Math.max(ratio, 0.1));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = Math.max(targetHeight, 360);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas_context_failed');

    const stream = canvas.captureStream(30);
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : 'video/webm';

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 1_800_000,
    });

    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    const drawFrame = () => {
      if (video.paused || video.ended) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      requestAnimationFrame(drawFrame);
    };

    await video.play();
    drawFrame();
    recorder.start(400);

    await new Promise<void>((resolve, reject) => {
      video.onended = () => resolve();
      video.onerror = () => reject(new Error('video_playback_failed'));
    });

    await new Promise<void>((resolve) => {
      recorder.onstop = () => resolve();
      recorder.stop();
    });

    const minimizedBlob = new Blob(chunks, { type: 'video/webm' });
    if (!minimizedBlob.size || minimizedBlob.size >= input.size) {
      return { file: input, minimized: false, warning: 'Compression produced no savings; uploading original file.' };
    }

    const minimizedFile = new File([minimizedBlob], input.name.replace(/\.[^.]+$/, '.webm'), {
      type: 'video/webm',
      lastModified: Date.now(),
    });

    if (minimizedFile.size > MAX_UPLOAD_BYTES) {
      return { file: minimizedFile, minimized: true, warning: 'Compressed file still exceeds 50MB; adjust source duration/quality.' };
    }

    return { file: minimizedFile, minimized: true };
  } catch {
    return { file: input, minimized: false, warning: 'Compression failed; uploading original file.' };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export { MAX_UPLOAD_BYTES };
