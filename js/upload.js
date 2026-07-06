/**
 * Image upload — native Canvas compression → R2 signed URL → direct PUT.
 * No external libraries. Backend never handles image bytes.
 */

import { getR2UploadUrls } from './api.js';
import { AppState } from './state.js';

/**
 * Compress a File to a WebP Blob using the browser's native Canvas API.
 * @param {File} file
 * @param {number} maxWidth   default 1200px
 * @param {number} quality    0–1, default 0.75
 * @returns {Promise<Blob>}
 */
export function compressImageToWebP(file, maxWidth = 1200, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null')),
          'image/webp',
          quality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Full upload flow for addItem:
 * 1. Compress all files client-side.
 * 2. Request signed R2 URLs from Edge Function.
 * 3. PUT each blob directly to R2.
 * 4. Return array of public CDN URLs.
 *
 * @param {File[]} files  up to 3
 * @returns {Promise<string[]>} public R2 URLs
 */
export async function uploadItemPhotos(blobs) {
  const limited = Array.from(blobs).slice(0, 3);

  // blobs are already compressed WebP (done at photo-pick time via compressImageToWebP)
  // Step 1 — get signed URLs
  const { data: urls, error } = await getR2UploadUrls(limited.length, AppState.user.id);
  if (error) throw new Error(`Signed URL request failed: ${error.message}`);

  // Step 2 — PUT directly to R2
  const publicUrls = [];
  await Promise.all(limited.map(async (blob, i) => {
    const res = await fetch(urls[i].putUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/webp' },
      body: blob,
    });
    if (!res.ok) throw new Error(`R2 upload failed for image ${i + 1}: ${res.status}`);
    publicUrls[i] = urls[i].publicUrl;
  }));

  return publicUrls;
}
