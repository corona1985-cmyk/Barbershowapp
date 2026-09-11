import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const lib = require('../functions/lib/lib.js');

describe('autorización de Functions (política)', () => {
  it('solo plataforma o admin de la misma sede gestiona usuarios', () => {
    assert.equal(lib.canManagePosUsers('admin'), true);
    assert.equal(lib.canManagePosUsers('barbero'), false);
    assert.equal(lib.canManagePosUsers('cliente'), false);
    assert.equal(lib.isPlatformRole('platform_owner'), true);
    assert.equal(lib.isStaffRole('barbero'), true);
    assert.equal(lib.isStaffRole('cliente'), false);
  });

  it('no permite impersonar master por username', () => {
    assert.throws(() => lib.assertUsername('MASTER'));
  });

  it('exige contraseña de 10 caracteres', () => {
    assert.throws(() => lib.assertPassword('short'));
    assert.equal(lib.assertPassword('longenough1'), 'longenough1');
  });

  it('genera claves de anti-reuso IAP', () => {
    const keys = lib.iapReuseKeys({ orderId: 'GPA.1', purchaseTokenHash: 'abc', originalTransactionId: 'GPA.1' });
    assert.deepEqual(keys, ['GPA_1', 'abc']);
    assert.deepEqual(lib.iapReuseKeys({}), []);
  });

    it('cliente no reescribe posId del token al cambiar de sede', () => {
    assert.equal(lib.canRewritePosClaim({
      role: 'cliente', claimsPosId: 5, targetPosId: 9, ownerId: 'alice', username: 'carla',
    }), false);
    assert.equal(lib.canRewritePosClaim({
      role: 'admin', claimsPosId: 5, targetPosId: 5, ownerId: 'alice', username: 'bob',
    }), true);
    assert.equal(lib.canRewritePosClaim({
      role: 'admin', claimsPosId: 5, targetPosId: 9, ownerId: 'alice', username: 'bob',
    }), false);
    assert.equal(lib.canRewritePosClaim({
      role: 'admin', claimsPosId: 5, targetPosId: 9, ownerId: 'bob', username: 'bob',
    }), true);
  });

  it('solo admin o dueño activa plan IAP', () => {
    assert.equal(lib.canActivatePosPlan('admin'), true);
    assert.equal(lib.canActivatePosPlan('dueno'), true);
    assert.equal(lib.canActivatePosPlan('barbero'), false);
    assert.equal(lib.canActivatePosPlan('cliente'), false);
    assert.equal(lib.canActivatePosPlan('platform_owner'), false);
  });

  it('cliente solo compra en sede preferida, ficha o token', () => {
    assert.equal(lib.canClientOrderAtPos({
      preferredPosId: 3, clientRecordPosId: 1, claimsPosId: 1, targetPosId: 3,
    }), true);
    assert.equal(lib.canClientOrderAtPos({
      preferredPosId: 3, clientRecordPosId: 1, claimsPosId: 1, targetPosId: 9,
    }), false);
    assert.equal(lib.canClientOrderAtPos({
      preferredPosId: null, clientRecordPosId: null, claimsPosId: null, targetPosId: 1,
    }), false);
    assert.equal(lib.canClientOrderAtPos({
      preferredPosId: null, clientRecordPosId: null, claimsPosId: null, targetPosId: 0,
    }), false);
  });

  it('GLOBAL_FREE_MODE: prod false por defecto, emulador true', () => {
    assert.equal(lib.parseGlobalFreeMode(undefined, false), false);
    assert.equal(lib.parseGlobalFreeMode(undefined, true), true);
    assert.equal(lib.parseGlobalFreeMode('true', false), true);
    assert.equal(lib.parseGlobalFreeMode('false', true), false);
  });

  it('solo roles de plataforma listan el directorio de usuarios', () => {
    assert.equal(lib.canListDirectoryUsers('platform_owner'), true);
    assert.equal(lib.canListDirectoryUsers('support'), true);
    assert.equal(lib.canListDirectoryUsers('admin'), false);
    assert.equal(lib.canListDirectoryUsers('cliente'), false);
  });
});
