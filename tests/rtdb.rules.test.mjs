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

  it('permite lectura pública de globalSettings y publicShops', async () => {
    const db = testEnv.unauthenticatedContext().database();
    await assertSucceeds(db.ref('barbershow/globalSettings').get());
    await assertSucceeds(db.ref('barbershow/publicShops').get());
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

  it('cliente no lee ventas ni citas ajenas aunque el token tenga posId', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.database().ref('barbershow/sales/70').set({
        id: 70, posId: 5, total: 40, estado: 'completada',
      });
      await ctx.database().ref('barbershow/appointments/71').set({
        id: 71, posId: 5, clienteId: 999, barberoId: 1, fecha: '2026-09-11', hora: '10:00', estado: 'pendiente',
      });
      await ctx.database().ref('barbershow/clients/80').set({
        id: 80, posId: 5, nombre: 'Ana', status: 'active', puntos: 10, notas: 'vip', telefono: '8091111111',
      });
    });
    const client = authed('c1', { username: 'carla', role: 'cliente', posId: 5, clientId: 80 });
    await assertFails(client.ref('barbershow/sales/70').get());
    await assertFails(client.ref('barbershow/appointments/71').get());
    await assertSucceeds(client.ref('barbershow/clients/80').get());
    await assertFails(client.ref('barbershow/clients/80').set({
      id: 80, posId: 5, nombre: 'Ana', status: 'active', puntos: 999, notas: 'hack',
    }));
  });

  it('cliente puede cancelar su cita pendiente', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.database().ref('barbershow/appointments/72').set({
        id: 72, posId: 5, clienteId: 80, barberoId: 1, fecha: '2026-09-12', hora: '11:00', estado: 'pendiente',
      });
    });
    const client = authed('c1', { username: 'carla', role: 'cliente', posId: 5, clientId: 80 });
    await assertSucceeds(client.ref('barbershow/appointments/72').update({
      id: 72, posId: 5, clienteId: 80, barberoId: 1, fecha: '2026-09-12', hora: '11:00', estado: 'cancelada',
    }));
  });

  it('staff lee el índice de ventas de su sede por fecha, no el de otra sede', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.database().ref('barbershow/salesByPosDate/5/2026-09-12/88').set(true);
      await ctx.database().ref('barbershow/salesByPosDate/9/2026-09-12/99').set(true);
    });
    const admin = authed('u1', { username: 'alice', role: 'admin', posId: 5 });
    await assertSucceeds(admin.ref('barbershow/salesByPosDate/5/2026-09-12').get());
    await assertFails(admin.ref('barbershow/salesByPosDate/9/2026-09-12').get());
    await assertFails(admin.ref('barbershow/salesByPosDate/5').get());
  });

  it('staff lee el índice de citas de su sede por fecha, no el de otra sede', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.database().ref('barbershow/appointmentsByPosDate/5/2026-09-12/71').set(true);
      await ctx.database().ref('barbershow/appointmentsByPosDate/9/2026-09-12/99').set(true);
    });
    const admin = authed('u1', { username: 'alice', role: 'admin', posId: 5 });
    await assertSucceeds(admin.ref('barbershow/appointmentsByPosDate/5/2026-09-12').get());
    await assertFails(admin.ref('barbershow/appointmentsByPosDate/9/2026-09-12').get());
    await assertFails(admin.ref('barbershow/appointmentsByPosDate/5').get());
  });

  it('cliente lee su propia cita y no productos de la sede', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.database().ref('barbershow/appointments/73').set({
        id: 73, posId: 5, clienteId: 80, barberoId: 1, fecha: '2026-09-12', hora: '12:00', estado: 'pendiente',
      });
      await ctx.database().ref('barbershow/products/1').set({
        id: 1, posId: 5, producto: 'Gel', precioVenta: 10,
      });
    });
    const client = authed('c1', { username: 'carla', role: 'cliente', posId: 5, clientId: 80 });
    await assertSucceeds(client.ref('barbershow/appointments/73').get());
    await assertFails(client.ref('barbershow/products/1').get());
  });

  it('staff lee clientsLite de su sede y no de otra', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.database().ref('barbershow/clientsLite/5/_ready').set(true);
      await ctx.database().ref('barbershow/clientsLite/5/10').set({
        id: 10, posId: 5, nombre: 'Ana', status: 'active',
      });
      await ctx.database().ref('barbershow/clientsLite/9/11').set({
        id: 11, posId: 9, nombre: 'Bob', status: 'active',
      });
    });
    const admin = authed('u1', { username: 'alice', role: 'admin', posId: 5 });
    await assertSucceeds(admin.ref('barbershow/clientsLite/5').get());
    await assertFails(admin.ref('barbershow/clientsLite/9').get());
  });

  it('staff lee indexMeta de su sede; cliente no escribe ni lee', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ctx.database().ref('barbershow/indexMeta/5/ready').set(true);
    });
    const admin = authed('u1', { username: 'alice', role: 'admin', posId: 5 });
    const client = authed('c1', { username: 'carla', role: 'cliente', posId: 5, clientId: 80 });
    await assertSucceeds(admin.ref('barbershow/indexMeta/5/ready').get());
    await assertFails(admin.ref('barbershow/indexMeta/5/ready').set(true));
    await assertFails(client.ref('barbershow/indexMeta/5').get());
  });

  it('directoryUsers sigue deny-all; publicShops es lectura pública', async () => {
    const admin = authed('u1', { username: 'alice', role: 'admin', posId: 5 });
    await assertSucceeds(admin.ref('barbershow/publicShops').get());
    await assertFails(admin.ref('barbershow/directoryUsers').get());
    await assertFails(admin.ref('barbershow/directoryMeta/ready').get());
  });
});
