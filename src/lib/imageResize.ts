/**
 * Resizes and centre-crops an image File to target dimensions using canvas.
 * Crops to fill the target box using cover semantics, biased toward the top
 * (matching `object-cover object-top` used in POTG and player-card slots).
 *
 * @param file         Source image File
 * @param targetWidth  Output width in pixels
 * @param targetHeight Output height in pixels
 * @param quality      JPEG quality 0–1 (default 0.92)
 */
export async function resizeImageToFit(
  file: File,
  targetWidth: number,
  targetHeight: number,
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

      // Cover-fill crop matching CSS `object-cover object-top`
      const srcAspect = img.width / img.height;
      const dstAspect = targetWidth / targetHeight;

      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (srcAspect > dstAspect) {
        // Source is wider — crop sides, keep centre horizontal
        sw = img.height * dstAspect;
        sx = (img.width - sw) / 2;
      } else {
        // Source is taller — crop from bottom, keep top (object-top)
        sh = img.width / dstAspect;
        sy = 0;
      }

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetWidth, targetHeight);

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
