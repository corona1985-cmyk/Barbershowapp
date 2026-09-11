import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const lib = require('../functions/lib/lib.js');

describe('security helpers', () => {
  it('niega roles de plataforma autoasignados', () => {
    assert.equal(lib.canCallerAssignRole('admin', 'platform_owner', 1, 1), false);
    assert.equal(lib.canCallerAssignRole('admin', 'barbero', 1, 1), true);
    assert.equal(lib.canCallerAssignRole('admin', 'barbero', 1, 2), false);
    assert.equal(lib.canCallerAssignRole('cliente', 'admin', 1, 1), false);
    assert.equal(lib.canCallerAssignRole('platform_owner', 'superadmin', null, null), true);
  });

  it('sanitiza sedes públicas sin ownerId ni plan', () => {
    const pub = lib.sanitizePublicShop({
      id: 9,
      name: 'Corte',
      address: 'Calle 1',
      ownerId: 'secreto',
      plan: 'pro',
      tier: 'barberia',
      subscriptionExpiresAt: '2099-01-01',
      isActive: true,
      city: 'Santo Domingo',
      about: 'Fade y barba',
      highlights: ['Fade', 'Barba'],
      certifications: [{ id: 'c1', title: 'Barbería clásica', issuer: 'Academia', year: 2020 }],
    });
    assert.ok(pub);
    assert.equal(pub.ownerId, undefined);
    assert.equal(pub.plan, undefined);
    assert.equal(pub.tier, undefined);
    assert.equal(pub.name, 'Corte');
    assert.equal(pub.about, 'Fade y barba');
    assert.deepEqual(pub.highlights, ['Fade', 'Barba']);
    assert.equal(pub.certifications[0].title, 'Barbería clásica');
    assert.equal(lib.sanitizePublicShop({ id: 1, isActive: false }), null);
    const barber = lib.sanitizePublicBarber({
      id: 3,
      name: 'Luis',
      specialty: 'Fade',
      active: true,
      bio: '8 años en silla',
      yearsExperience: 8,
      certifications: [{ id: 'c2', title: 'Colorimetría' }],
    }, 9);
    assert.ok(barber);
    assert.equal(barber.bio, '8 años en silla');
    assert.equal(barber.yearsExperience, 8);
    assert.equal(lib.sanitizePublicBarber({ id: 3, active: false }, 9), null);
  });

  it('mapea product IDs de IAP', () => {
    assert.deepEqual(lib.resolveTierFromProductId('plan_barberia_monthly'), { tier: 'barberia', plan: 'pro' });
    assert.equal(lib.resolveTierFromProductId('unknown_sku'), null);
  });

  it('verifica PBKDF2 y rechaza contraseña incorrecta', () => {
    const hash = lib.hashPasswordNode('correct-horse');
    assert.equal(lib.verifyPasswordNode('correct-horse', hash), true);
    assert.equal(lib.verifyPasswordNode('wrong', hash), false);
    assert.equal(lib.verifyPasswordNode('correct-horse', ''), false);
  });

  it('valida username seguro', () => {
    assert.equal(lib.assertUsername('barbero01'), 'barbero01');
    assert.throws(() => lib.assertUsername('master'));
    assert.throws(() => lib.assertUsername('A B'));
  });

  it('lee hash legado en users.password si authSecrets está vacío', () => {
    const legacy = lib.resolvePasswordHashFromSources(null, 'salt:hashvalue');
    assert.equal(legacy.source, 'users.password');
    assert.equal(legacy.hash, 'salt:hashvalue');
  });

  it('caduca slotLocks viejos y trata null como libre', () => {
    assert.equal(lib.isSlotLockActive(null), false);
    assert.equal(lib.isSlotLockActive({ at: Date.now() }), true);
    assert.equal(lib.isSlotLockActive({ at: Date.now() - lib.SLOT_LOCK_TTL_MS - 1 }), false);
    assert.equal(lib.isSlotLockActive({}), true);
  });

  it('prioriza authSecrets sobre users.password', () => {
    const migrated = lib.resolvePasswordHashFromSources('secret-hash', 'legacy-password');
    assert.equal(migrated.source, 'authSecrets');
    assert.equal(migrated.hash, 'secret-hash');
    assert.equal(lib.resolvePasswordHashFromSources(null, '').source, 'none');
    assert.equal(lib.resolvePasswordHashFromSources(undefined, null).hash, null);
  });

  it('directorio de usuarios omite photoUrl y password', () => {
    const listed = lib.toDirectoryUser('ana', {
      username: 'ana',
      name: 'Ana',
      role: 'admin',
      posId: 12,
      photoUrl: 'data:image/jpeg;base64,xxxx',
      password: 'secret',
    });
    assert.equal(listed.username, 'ana');
    assert.equal(listed.posId, 12);
    assert.equal('photoUrl' in listed, false);
    assert.equal('password' in listed, false);
  });

  it('recorta recentSales a 20 y acepta objeto de RTDB', () => {
    const many = Array.from({ length: 21 }, (_, i) => ({ id: i + 1, posId: 1, total: 10, fecha: '2026-09-11' }));
    const next = lib.appendRecentSales(many, { id: 99, posId: 2, total: 5, fecha: '2026-09-11' });
    assert.equal(next.length, 20);
    assert.equal(next[next.length - 1].id, 99);
    const fromObject = lib.normalizeRecentSales({ a: { id: 1, posId: 1, total: 3, fecha: '2026-09-01' } });
    assert.equal(fromObject.length, 1);
    assert.equal(fromObject[0].id, 1);
  });
});
