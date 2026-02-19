/**
 * Hash de contraseñas con PBKDF2 (Web Crypto API).
 * Las contraseñas no se guardan en texto plano; se almacena "salt:hash" en hex.
 * Si crypto.subtle no está disponible (ej. contexto no seguro), se usa comparación legacy.
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BITS = 256;

const webCrypto = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
const hasSubtle = webCrypto?.subtle != null;

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes.buffer;
}

/** Indica si el valor almacenado es un hash nuestro (salt:hash en hex). */
export function isStoredHash(stored: string | null | undefined): boolean {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [saltHex, hashHex] = parts;
  return /^[0-9a-f]+$/i.test(saltHex) && saltHex.length === SALT_BYTES * 2 && /^[0-9a-f]+$/i.test(hashHex) && hashHex.length === HASH_BITS / 4;
}

/**
 * Genera un hash seguro de la contraseña (salt:hash en hex).
 * Usar al guardar o cambiar contraseña.
 * Si Web Crypto no está disponible, devuelve la contraseña en texto plano (entorno sin HTTPS).
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  if (!plainPassword || typeof plainPassword !== 'string') return '';
  if (!hasSubtle || !webCrypto) return plainPassword;
  const salt = webCrypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await webCrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(plainPassword),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await webCrypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    key,
    HASH_BITS
  );
  return bufferToHex(salt) + ':' + bufferToHex(bits);
}

/**
 * Verifica la contraseña en texto plano contra el valor almacenado (hash o texto plano legacy).
 * Devuelve true si coincide.
 */
export async function verifyPassword(plainPassword: string, stored: string | null | undefined): Promise<boolean> {
  if (!plainPassword || stored == null || stored === '') return false;
  if (hasSubtle && isStoredHash(stored)) {
    const [saltHex, hashHex] = stored.split(':');
    const salt = hexToBuffer(saltHex);
    const key = await webCrypto!.subtle.importKey(
      'raw',
      new TextEncoder().encode(plainPassword),
      'PBKDF2',
      false,
      ['deriveBits']
    );
    const bits = await webCrypto!.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      key,
      HASH_BITS
    );
    return bufferToHex(bits) === hashHex;
  }
  // Legacy o sin crypto.subtle: comparación en texto plano
  return plainPassword === stored;
}
