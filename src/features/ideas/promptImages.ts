import type { PromptImage } from './generator/types';

// Claude reads images up to 2576px at full size and bills by area (one token per
// 28×28 patch), so this cap is what holds a 16:9 screenshot to about 1,800 tokens.
const MAX_EDGE = 1568;

/** Downscales an image attached to the prompt and encodes it as base64 JPEG for Claude. */
export async function toPromptImage(file: Blob): Promise<PromptImage> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = canvas.getContext('2d')!;
  // JPEG has no transparency; keep see-through pixels white rather than black.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Could not read that image.'))), 'image/jpeg', 0.85));
  const dataUrl = await new Promise<string>((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => res(reader.result as string);
    reader.onerror = () => rej(reader.error);
    reader.readAsDataURL(blob);
  });
  return { mediaType: 'image/jpeg', data: dataUrl.slice(dataUrl.indexOf(',') + 1), width: canvas.width, height: canvas.height };
}
