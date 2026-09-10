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
    });
    assert.ok(pub);
    assert.equal(pub.ownerId, undefined);
    assert.equal(pub.plan, undefined);
    assert.equal(pub.tier, undefined);
    assert.equal(pub.name, 'Corte');
    assert.equal(lib.sanitizePublicShop({ id: 1, isActive: false }), null);
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

  it('prioriza authSecrets sobre users.password', () => {
    const migrated = lib.resolvePasswordHashFromSources('secret-hash', 'legacy-password');
    assert.equal(migrated.source, 'authSecrets');
    assert.equal(migrated.hash, 'secret-hash');
    assert.equal(lib.resolvePasswordHashFromSources(null, '').source, 'none');
    assert.equal(lib.resolvePasswordHashFromSources(undefined, null).hash, null);
  });
});
