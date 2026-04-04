/**
 * Resizes an image File to fit within target dimensions using canvas without cropping.
 * Uses "contain" semantics (padding with transparent/black instead of cropping).
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

      // Contain-fill matching CSS `object-fit: contain`
      const srcAspect = img.width / img.height;
      const dstAspect = targetWidth / targetHeight;

      let dw = targetWidth, dh = targetHeight;
      let dx = 0, dy = 0;

      if (srcAspect > dstAspect) {
        // Source is wider — fit to width, pad top/bottom
        dh = targetWidth / srcAspect;
        dy = (targetHeight - dh) / 2;
      } else {
        // Source is taller — fit to height, pad sides
        dw = targetHeight * srcAspect;
        dx = (targetWidth - dw) / 2;
      }

      // Draw image fitting within the canvas without cropping
      ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, dw, dh);

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
