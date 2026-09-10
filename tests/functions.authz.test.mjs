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
});
