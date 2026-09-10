import { readFileSync } from 'node:fs';
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';

const rules = readFileSync(new URL('../database.rules.json', import.meta.url), 'utf8');

let testEnv;

function authed(uid, token) {
  return testEnv.authenticatedContext(uid, token).database();
}

describe('RTDB rules', () => {
  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-barbershow',
      database: { rules, host: '127.0.0.1', port: 9000 },
    });
  });

  after(async () => {
    await testEnv?.cleanup();
  });

  it('anónimo no lee users ni clients', async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(db.ref('barbershow/users').get());
    await assertFails(db.ref('barbershow/clients/1').get());
    await assertFails(db.ref('barbershow/users/alice').set({ role: 'admin' }));
  });

  it('permite lectura pública solo de globalSettings', async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(db.ref('barbershow/globalSettings').get());
    await assertFails(db.ref('barbershow/pointsOfSale').get());
  });

  it('staff de otra sede no lee clientes ajenos', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.database().ref('barbershow/clients/10').set({
        id: 10, posId: 1, nombre: 'Ana', status: 'active', telefono: '8090000000',
      });
    });
    const other = authed('u2', { username: 'bob', role: 'admin', posId: 2 });
    await assertFails(other.ref('barbershow/clients/10').get());
  });

  it('admin de la sede puede leer su cliente', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.database().ref('barbershow/clients/11').set({
        id: 11, posId: 5, nombre: 'Luis', status: 'active',
      });
    });
    const admin = authed('u1', { username: 'alice', role: 'admin', posId: 5 });
    await assertSucceeds(admin.ref('barbershow/clients/11').get());
  });

  it('nadie escribe rol/plan desde cliente en users', async () => {
    const self = authed('u1', { username: 'alice', role: 'admin', posId: 5 });
    await assertFails(self.ref('barbershow/users/alice').set({ username: 'alice', role: 'platform_owner' }));
  });

  it('congela tier/plan en pointsOfSale', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.database().ref('barbershow/pointsOfSale/5').set({
        id: 5, name: 'Shop', address: 'A', ownerId: 'alice', isActive: true, tier: 'solo', plan: 'basic',
      });
    });
    const admin = authed('u1', { username: 'alice', role: 'admin', posId: 5 });
    await assertFails(admin.ref('barbershow/pointsOfSale/5').set({
      id: 5, name: 'Shop', address: 'A', ownerId: 'alice', isActive: true, tier: 'multisede', plan: 'pro',
    }));
  });

  it('authSecrets es deny-all', async () => {
    const admin = authed('u1', { username: 'alice', role: 'admin', posId: 5 });
    await assertFails(admin.ref('barbershow/authSecrets/alice').get());
    await assertFails(admin.ref('barbershow/authSecrets/alice').set({ passwordHash: 'x' }));
  });

  it('no se puede escribir password en users desde el cliente', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.database().ref('barbershow/users/alice').set({
        username: 'alice', role: 'admin', posId: 5, name: 'Alice',
      });
    });
    const self = authed('u1', { username: 'alice', role: 'admin', posId: 5 });
    await assertSucceeds(self.ref('barbershow/users/alice/name').get());
    await assertFails(self.ref('barbershow/users/alice').set({
      username: 'alice', role: 'platform_owner', password: 'x',
    }));
  });

  it('anónimo no escribe globalSettings', async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertFails(db.ref('barbershow/globalSettings').set({
      appName: 'X', supportEmail: 'a@b.c',
    }));
  });

  it('staff no escribe ventas de otra sede', async () => {
    const admin = authed('u1', { username: 'alice', role: 'admin', posId: 5 });
    await assertFails(admin.ref('barbershow/sales/99').set({
      id: 99, posId: 9, total: 100, estado: 'completada',
    }));
  });
});
