import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MEDIA_LIMITS,
  assertStoredPhotoUrl,
  isAllowedStoredPhotoUrl,
  sanitizeOptionalPhotoUrl,
  dataUrlToBlob,
  isFirebaseStorageUrl,
} from '../utils/storedMedia.ts';

describe('storedMedia', () => {
  it('acepta https y data jpeg/png/webp dentro del tope', () => {
    assert.equal(assertStoredPhotoUrl(null), null);
    assert.equal(assertStoredPhotoUrl(''), null);
    assert.equal(assertStoredPhotoUrl('https://cdn.example.com/a.jpg'), 'https://cdn.example.com/a.jpg');
    assert.equal(assertStoredPhotoUrl('data:image/jpeg;base64,abc'), 'data:image/jpeg;base64,abc');
    assert.equal(assertStoredPhotoUrl('data:image/png;base64,abc'), 'data:image/png;base64,abc');
    assert.equal(assertStoredPhotoUrl('data:image/webp;base64,abc'), 'data:image/webp;base64,abc');
  });

  it('rechaza blobs inflados, html embebido y http inseguro', () => {
    assert.throws(() => assertStoredPhotoUrl(`data:image/jpeg,${'a'.repeat(MEDIA_LIMITS.maxStoredPhotoChars)}`), /grande/i);
    assert.throws(() => assertStoredPhotoUrl('data:text/html,<script>'), /válida/i);
    assert.throws(() => assertStoredPhotoUrl('http://cdn.example.com/a.jpg'), /válida/i);
    assert.throws(() => assertStoredPhotoUrl('javascript:alert(1)'), /válida/i);
    assert.throws(() => assertStoredPhotoUrl('https://cdn.example.com/a.jpg with space'), /válida/i);
    assert.throws(() => assertStoredPhotoUrl(null, true), /imagen/i);
  });

  it('sanitizeOptionalPhotoUrl descarta inflado en vez de lanzar', () => {
    assert.equal(sanitizeOptionalPhotoUrl(`data:image/jpeg,${'a'.repeat(90_000)}`), undefined);
    assert.equal(sanitizeOptionalPhotoUrl('https://cdn.example.com/ok.png'), 'https://cdn.example.com/ok.png');
    assert.equal(isAllowedStoredPhotoUrl('https://x.test/a'), true);
    assert.equal(isAllowedStoredPhotoUrl('data:image/gif;base64,xx'), false);
  });

  it('convierte data URL a blob y reconoce URLs de Storage', () => {
    const blob = dataUrlToBlob('data:image/jpeg;base64,QQ==');
    assert.equal(blob.type, 'image/jpeg');
    assert.ok(blob.size > 0);
    assert.equal(isFirebaseStorageUrl('https://firebasestorage.googleapis.com/v0/b/x/o/y'), true);
    assert.equal(isFirebaseStorageUrl('https://cdn.example.com/a.jpg'), false);
    assert.equal(isFirebaseStorageUrl('http://firebasestorage.googleapis.com/v0/b/x/o/y'), false);
  });
});
