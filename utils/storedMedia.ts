/** Límites de blobs en RTDB. Deben coincidir con functions/src/lib.ts y database.rules.json. */
export const MEDIA_LIMITS = {
  maxStoredPhotoChars: 80_000,
  maxHttpsUrlChars: 2048,
  maxUploadBytes: 4 * 1024 * 1024,
  maxGalleryPhotos: 24,
  maxCaptionChars: 120,
  maxNotesChars: 500,
  maxEmailChars: 120,
  profileMaxPx: 400,
  galleryMaxPx: 500,
  profileQuality: 0.82,
  galleryQuality: 0.75,
} as const;

const DATA_IMAGE_PREFIXES = ['data:image/jpeg', 'data:image/png', 'data:image/webp'] as const;

export function isAllowedStoredPhotoUrl(value: string): boolean {
  if (DATA_IMAGE_PREFIXES.some((prefix) => value.startsWith(prefix))) return true;
  return /^https:\/\//i.test(value) && value.length <= MEDIA_LIMITS.maxHttpsUrlChars && !/\s/.test(value);
}

export function assertStoredPhotoUrl(raw: unknown, required = false): string | null {
  if (raw == null || raw === '') {
    if (required) throw new Error('Indica una imagen (sube un archivo o pega una URL).');
    return null;
  }
  const value = String(raw).trim();
  if (!value) {
    if (required) throw new Error('Indica una imagen (sube un archivo o pega una URL).');
    return null;
  }
  if (value.length > MEDIA_LIMITS.maxStoredPhotoChars) {
    throw new Error('Imagen demasiado grande. Usa una foto más liviana o una URL https.');
  }
  if (!isAllowedStoredPhotoUrl(value)) {
    throw new Error('URL de imagen no válida. Usa https o un archivo jpeg/png/webp.');
  }
  return value;
}

/** Quita fotos inválidas o infladas para no bloquear updates de otros campos. */
export function sanitizeOptionalPhotoUrl(raw: unknown): string | undefined {
  try {
    return assertStoredPhotoUrl(raw) ?? undefined;
  } catch {
    return undefined;
  }
}

export function isFirebaseStorageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname === 'firebasestorage.googleapis.com'
        || parsed.hostname.endsWith('.firebasestorage.app')
        || parsed.hostname === 'firebasestorage.app')
    );
  } catch {
    return false;
  }
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error('No se pudo leer la imagen comprimida.');
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: match[1] || 'image/jpeg' });
}

function scaleSize(width: number, height: number, maxPx: number): { w: number; h: number } {
  let w = width;
  let h = height;
  if (w > maxPx || h > maxPx) {
    if (w > h) {
      h = Math.round((h * maxPx) / w);
      w = maxPx;
    } else {
      w = Math.round((w * maxPx) / h);
      h = maxPx;
    }
  }
  return { w: Math.max(1, w), h: Math.max(1, h) };
}

function drawCompressed(img: HTMLImageElement, maxPx: number, quality: number): string {
  const { w, h } = scaleSize(img.width, img.height, maxPx);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo comprimir la imagen.');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer la imagen.'));
    };
    img.src = objectUrl;
  });
}

/** Comprime a JPEG y garantiza el tope de caracteres de RTDB. Nunca guarda el archivo original. */
export async function compressImageFile(
  file: File,
  opts?: { maxPx?: number; quality?: number }
): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('El archivo no es una imagen.');
  if (file.size > MEDIA_LIMITS.maxUploadBytes) {
    throw new Error('El archivo supera 4 MB. Elige una foto más liviana.');
  }
  const img = await loadImage(file);
  let maxPx = opts?.maxPx ?? MEDIA_LIMITS.profileMaxPx;
  let quality = opts?.quality ?? MEDIA_LIMITS.profileQuality;
  for (let attempt = 0; attempt < 5; attempt++) {
    const dataUrl = drawCompressed(img, maxPx, quality);
    if (dataUrl.length <= MEDIA_LIMITS.maxStoredPhotoChars) return dataUrl;
    quality = Math.max(0.45, quality * 0.75);
    maxPx = Math.max(160, Math.round(maxPx * 0.82));
  }
  throw new Error('Imagen demasiado grande. Usa una foto más liviana o una URL https.');
}
