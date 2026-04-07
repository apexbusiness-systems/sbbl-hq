/**
 * Resizes an image File to target dimensions.
 *
 * mode = 'contain' (default): scale to fit within bounds, pad remainder transparent (CSS object-fit: contain)
 * mode = 'cover': scale to fill, center-crop excess (CSS object-fit: cover)
 *
 * @param file         Source image File
 * @param targetWidth  Output width in pixels
 * @param targetHeight Output height in pixels
 * @param mode         'contain' | 'cover' (default: 'contain')
 * @param quality      JPEG quality 0–1 (default 0.92)
 */
export async function resizeImageToFit(
  file: File,
  targetWidth: number,
  targetHeight: number,
  mode: 'contain' | 'cover' = 'contain',
  quality = 0.92,
): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas context unavailable')); return; }

      const srcAspect = img.width / img.height;
      const dstAspect = targetWidth / targetHeight;

      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      let dx = 0, dy = 0, dw = targetWidth, dh = targetHeight;

      if (mode === 'cover') {
        // Scale so the image fills the canvas; center-crop any excess
        if (srcAspect > dstAspect) {
          // Source is wider — match height, crop sides
          sw = img.height * dstAspect;
          sx = (img.width - sw) / 2;
        } else {
          // Source is taller — match width, crop top/bottom
          sh = img.width / dstAspect;
          sy = (img.height - sh) / 2;
        }
      } else if (srcAspect > dstAspect) {
          dh = targetWidth / srcAspect;
          dy = (targetHeight - dh) / 2;
        } else {
          dw = targetHeight * srcAspect;
          dx = (targetWidth - dw) / 2;
        }

      ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);

      canvas.toBlob(
        (blob) => {
          if (!blob) { reject(new Error('Canvas toBlob failed')); return; }
          const outName = file.name.replace(/\.[^.]+$/, '.jpg');
          resolve(new File([blob], outName, { type: 'image/jpeg', lastModified: Date.now() }));
        },
        'image/jpeg',
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Image failed to load for resize'));
    };
    img.src = url;
  });
}

/**
 * Convenience: returns the correct target dimensions for SBBL media cards.
 * Portrait POTG cards → 560 × 747
 * Landscape event/matchup graphics → 747 × 560
 */
export function inferTargetDimensions(file: File): Promise<{ width: number; height: number; mode: 'contain' | 'cover' }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const isLandscape = img.width > img.height;
      resolve(
        isLandscape
          ? { width: 747, height: 560, mode: 'cover' }
          : { width: 560, height: 747, mode: 'cover' },
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to read image dimensions')); };
    img.src = url;
  });
}
