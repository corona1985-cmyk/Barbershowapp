import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { auth, storage } from './firebase';
import { assertStoredPhotoUrl, dataUrlToBlob, isFirebaseStorageUrl } from '../utils/storedMedia';

export type MediaCategory = 'clients' | 'gallery' | 'profiles';

export type PhotoDest = {
  category: MediaCategory;
  ownerId: string;
  posId: number;
  fileId?: string;
};

function safeSegment(value: string, fallback: string): string {
  const cleaned = String(value || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  return cleaned || fallback;
}

function storagePath(dest: PhotoDest): string {
  const posId = Number.isFinite(dest.posId) && dest.posId > 0 ? String(dest.posId) : '0';
  const fileId = safeSegment(dest.fileId || 'avatar', 'avatar');
  return `media/${posId}/${dest.category}/${safeSegment(dest.ownerId, 'x')}/${fileId}.jpg`;
}

/** Sube data URLs a Cloud Storage y deja las https como están. */
export async function persistPhotoToStorage(raw: string | null | undefined, dest: PhotoDest): Promise<string | null> {
  const value = assertStoredPhotoUrl(raw);
  if (!value) return null;
  if (value.startsWith('https://')) return value;
  if (!auth.currentUser) {
    throw new Error('Inicia sesión para guardar la imagen.');
  }
  const blob = dataUrlToBlob(value);
  if (blob.size > 400 * 1024) {
    throw new Error('Imagen demasiado grande. Usa una foto más liviana.');
  }
  const path = storagePath(dest);
  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, blob, {
    contentType: 'image/jpeg',
    cacheControl: 'public,max-age=31536000',
  });
  return getDownloadURL(fileRef);
}

export async function deleteStoredPhoto(url: string | null | undefined): Promise<void> {
  if (!url || !isFirebaseStorageUrl(url)) return;
  try {
    await deleteObject(storageRef(storage, url));
  } catch {
    // El archivo puede haber sido borrado ya o no existir en este entorno.
  }
}
