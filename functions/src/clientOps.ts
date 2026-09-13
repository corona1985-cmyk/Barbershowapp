import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onValueCreated } from "firebase-functions/v2/database";
import {
  ROOT,
  MIN_PHONE_DIGITS,
  assertAppCheck,
  bumpPlatformStat,
  consumeRateLimit,
  db,
  digitsOnly,
  generateUniqueId,
  indexClientPhone,
  ipHash,
  isPlatformRole,
  requireAuth,
  sanitizePublicShop,
  syncUserClaims,
  canClientOrderAtPos,
  canListDirectoryUsers,
  toDirectoryUser,
  appendRecentSales,
  normalizeRecentSales,
  writeSaleIndexes,
  releaseAppointmentSlot,
  assertStoredPhotoUrl,
  publicAssetUrl,
  writeClientLite,
  writeDirectoryUserRecord,
  writePublicShopRecord,
  writeAppointmentIndexes,
  isStaffRole,
  type DirectoryUser,
  type RecentSaleSummary,
} from "./lib";
import {
  assertBookingPayload,
  assertPosAndBarber,
  createPendingAppointment,
  ensureClientForBooking,
  resolveServicesFromIds,
} from "./booking";

const callableOpts = { region: "us-central1" as const };

export const updateMyClientProfile = onCall(callableOpts, async (request) => {
  const { claims } = requireAuth(request);
  if (claims.role !== "cliente") throw new HttpsError("permission-denied", "Solo clientes.");
  if (claims.clientId == null) throw new HttpsError("failed-precondition", "No tienes un perfil de cliente vinculado.");
  const data = request.data as { nombre?: string; telefono?: string; photoUrl?: string | null } | undefined;
  const snap = await db().ref(`${ROOT}/clients/${claims.clientId}`).get();
  if (!snap.exists()) throw new HttpsError("not-found", "Perfil de cliente no encontrado.");
  const current = snap.val() as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  if (data?.nombre !== undefined) {
    const nombre = String(data.nombre).trim();
    if (!nombre || nombre.length > 120) throw new HttpsError("invalid-argument", "Nombre inválido.");
    updates.nombre = nombre;
  }
  if (data?.telefono !== undefined) {
    const telefono = String(data.telefono).trim();
    if (digitsOnly(telefono).length < MIN_PHONE_DIGITS) throw new HttpsError("invalid-argument", "Teléfono inválido.");
    updates.telefono = telefono;
  }
  if (data?.photoUrl !== undefined) {
    updates.photoUrl = assertStoredPhotoUrl(data.photoUrl);
  }
  if (Object.keys(updates).length) {
    await db().ref(`${ROOT}/clients/${claims.clientId}`).update(updates);
  }
  if (updates.telefono) {
    const posId = Number(current.posId);
    if (Number.isFinite(posId)) {
      await indexClientPhone(posId, String(current.telefono || ""), null);
      await indexClientPhone(posId, String(updates.telefono), claims.clientId);
    }
  }
  const userUpdates: Record<string, unknown> = {};
  if (updates.nombre) userUpdates.name = updates.nombre;
  if (data?.photoUrl !== undefined) userUpdates.photoUrl = updates.photoUrl;
  if (Object.keys(userUpdates).length) {
    await db().ref(`${ROOT}/users/${claims.username}`).update(userUpdates);
  }
  const fresh = { ...current, ...updates };
  await writeClientLite(fresh);
  return { success: true as const, client: fresh };
});

export const ensureMyClientProfile = onCall(callableOpts, async (request) => {
  const { uid, claims } = requireAuth(request);
  if (claims.role !== "cliente") throw new HttpsError("permission-denied", "Solo clientes.");

  const returnExisting = async (clientId: number, claimsUpdated: boolean) => {
    const snap = await db().ref(`${ROOT}/clients/${clientId}`).get();
    if (!snap.exists()) return null;
    return { success: true as const, client: snap.val() as Record<string, unknown>, claimsUpdated };
  };

  if (claims.clientId != null) {
    const existing = await returnExisting(Number(claims.clientId), false);
    if (existing) return existing;
  }

  const userRef = db().ref(`${ROOT}/users/${claims.username}`);
  const userSnap = await userRef.get();
  if (!userSnap.exists()) throw new HttpsError("not-found", "Usuario no encontrado.");
  const user = userSnap.val() as Record<string, unknown>;
  const linkedId = Number(user.clientId);
  if (Number.isFinite(linkedId) && linkedId > 0) {
    const existing = await returnExisting(linkedId, false);
    if (existing) {
      if (Number(claims.clientId) !== linkedId) {
        await syncUserClaims(uid, user, claims.username);
        return { ...existing, claimsUpdated: true };
      }
      return existing;
    }
  }

  await consumeRateLimit("ensure-client-profile", claims.username, 8, 60 * 60 * 1000);

  const posId = Number(user.posId ?? claims.posId);
  if (!Number.isFinite(posId) || posId <= 0) {
    throw new HttpsError("failed-precondition", "No hay sede vinculada para crear el perfil.");
  }

  const reservedId = Number.isFinite(linkedId) && linkedId > 0 ? linkedId : generateUniqueId();
  const tx = await userRef.child("clientId").transaction((cur) => {
    const n = Number(cur);
    if (Number.isFinite(n) && n > 0) return n;
    return reservedId;
  });
  const clientId = Number(tx.snapshot.val());
  if (!Number.isFinite(clientId) || clientId <= 0) {
    throw new HttpsError("internal", "No se pudo asignar el perfil.");
  }

  const raced = await returnExisting(clientId, false);
  if (raced) {
    if (Number(claims.clientId) !== clientId) {
      await syncUserClaims(uid, { ...user, clientId }, claims.username);
      return { ...raced, claimsUpdated: true };
    }
    return raced;
  }

  const client = {
    id: clientId,
    posId,
    nombre: String(user.name || claims.username),
    telefono: "",
    email: "",
    ultimaVisita: "N/A",
    notas: "Perfil de cuenta",
    fechaRegistro: new Date().toISOString().split("T")[0],
    puntos: 0,
    status: "active",
    whatsappOptIn: false,
  };
  await db().ref(`${ROOT}/clients/${clientId}`).set(client);
  await writeClientLite(client);
  await syncUserClaims(uid, { ...user, clientId }, claims.username);
  return { success: true as const, client, claimsUpdated: true };
});

export const createClientAppointment = onCall(callableOpts, async (request) => {
  const { claims } = requireAuth(request);
  if (claims.role !== "cliente") throw new HttpsError("permission-denied", "Solo clientes.");
  await consumeRateLimit("client-book", claims.username, 12, 60 * 60 * 1000);
  const parsed = assertBookingPayload(request.data as Parameters<typeof assertBookingPayload>[0]);
  await assertPosAndBarber(parsed.posId, parsed.barberoId);
  const servicios = await resolveServicesFromIds(parsed.posId, (request.data as { servicios?: Array<{ id?: number }> })?.servicios);
  const clientId = await ensureClientForBooking({
    posId: parsed.posId,
    nombre: parsed.nombre || String(claims.username),
    telefono: parsed.telefono,
    notas: "Reserva con cuenta",
    existingClientId: claims.clientId,
  });
  const appointmentId = await createPendingAppointment({
    posId: parsed.posId,
    barberoId: parsed.barberoId,
    fecha: parsed.fecha,
    hora: parsed.hora,
    clienteId: clientId,
    servicios,
  });
  return { success: true as const, appointmentId };
});

export const cancelMyAppointment = onCall(callableOpts, async (request) => {
  const { claims } = requireAuth(request);
  if (claims.role !== "cliente") throw new HttpsError("permission-denied", "Solo clientes.");
  const id = Number((request.data as { appointmentId?: number })?.appointmentId);
  if (!Number.isFinite(id)) throw new HttpsError("invalid-argument", "Cita inválida.");
  const snap = await db().ref(`${ROOT}/appointments/${id}`).get();
  if (!snap.exists()) throw new HttpsError("not-found", "Cita no encontrada.");
  const apt = snap.val() as { clienteId?: number; estado?: string; posId?: number; barberoId?: number; fecha?: string; hora?: string; duracionTotal?: number; id?: number };
  if (Number(apt.clienteId) !== claims.clientId) throw new HttpsError("permission-denied", "No autorizado.");
  if (apt.estado !== "pendiente" && apt.estado !== "confirmada") {
    throw new HttpsError("failed-precondition", "Esa cita ya no se puede cancelar.");
  }
  await db().ref(`${ROOT}/appointments/${id}`).update({ estado: "cancelada" });
  await writeAppointmentIndexes({
    id,
    posId: Number(apt.posId),
    barberoId: Number(apt.barberoId),
    fecha: String(apt.fecha),
    hora: String(apt.hora),
    duracionTotal: Number(apt.duracionTotal || 30),
    estado: "cancelada",
  });
  await releaseAppointmentSlot(Number(apt.posId), Number(apt.barberoId), String(apt.fecha), String(apt.hora));
  return { success: true as const };
});

export const getShopCatalog = onCall(callableOpts, async (request) => {
  assertAppCheck(request);
  await consumeRateLimit("shop-catalog", ipHash(request), 40, 15 * 60 * 1000);
  const posId = Number((request.data as { posId?: number })?.posId);
  if (!Number.isFinite(posId)) throw new HttpsError("invalid-argument", "Sede inválida.");
  const posSnap = await db().ref(`${ROOT}/pointsOfSale/${posId}`).get();
  const shop = sanitizePublicShop(posSnap.val() as Record<string, unknown>);
  if (!shop) throw new HttpsError("not-found", "Barbería no encontrada.");
  const [productsSnap, settingsSnap] = await Promise.all([
    db().ref(`${ROOT}/products`).orderByChild("posId").equalTo(posId).get(),
    db().ref(`${ROOT}/settings/${posId}`).get(),
  ]);
  const products = Object.values((productsSnap.val() || {}) as Record<string, Record<string, unknown>>).map((p) => ({
    id: Number(p.id),
    posId,
    producto: String(p.producto || ""),
    precioVenta: Number(p.precioVenta || 0),
    stock: Number(p.stock || 0),
    photoUrl: publicAssetUrl(p.photoUrl),
  }));
  const settings = settingsSnap.exists() ? settingsSnap.val() as { taxRate?: number; currencySymbol?: string } : {};
  return {
    shop,
    products,
    taxRate: Number(settings.taxRate || 0),
    currencySymbol: String(settings.currencySymbol || "$"),
  };
});

export const createClientShopOrder = onCall(callableOpts, async (request) => {
  const { claims } = requireAuth(request);
  if (claims.role !== "cliente") throw new HttpsError("permission-denied", "Solo clientes.");
  await consumeRateLimit("shop-order", claims.username, 10, 60 * 60 * 1000);
  const data = request.data as { posId?: number; items?: Array<{ id?: number; quantity?: number }> } | undefined;
  const posId = Number(data?.posId);
  const items = Array.isArray(data?.items) ? data!.items.slice(0, 30) : [];
  if (!Number.isFinite(posId) || !items.length) throw new HttpsError("invalid-argument", "Pedido inválido.");
  const [prefSnap, clientPosSnap] = await Promise.all([
    db().ref(`${ROOT}/clientPreferences/${claims.username}/preferredPosId`).get(),
    claims.clientId != null
      ? db().ref(`${ROOT}/clients/${claims.clientId}/posId`).get()
      : Promise.resolve(null),
  ]);
  if (!canClientOrderAtPos({
    preferredPosId: prefSnap.val() as number | null,
    clientRecordPosId: clientPosSnap ? (clientPosSnap.val() as number | null) : null,
    claimsPosId: claims.posId,
    targetPosId: posId,
  })) {
    throw new HttpsError("permission-denied", "Solo puedes comprar en tu barbería seleccionada.");
  }
  const posSnap = await db().ref(`${ROOT}/pointsOfSale/${posId}`).get();
  if (!posSnap.exists() || posSnap.val()?.isActive === false) throw new HttpsError("not-found", "Barbería no encontrada.");
  const productsSnap = await db().ref(`${ROOT}/products`).orderByChild("posId").equalTo(posId).get();
  const catalog = new Map<number, { id: number; producto: string; precioVenta: number; stock: number }>();
  if (productsSnap.exists()) {
    for (const p of Object.values(productsSnap.val() as Record<string, Record<string, unknown>>)) {
      catalog.set(Number(p.id), {
        id: Number(p.id),
        producto: String(p.producto || ""),
        precioVenta: Number(p.precioVenta || 0),
        stock: Number(p.stock || 0),
      });
    }
  }
  const lines: Array<{ id: number; name: string; price: number; quantity: number; type: "producto" }> = [];
  let subtotal = 0;
  for (const item of items) {
    const id = Number(item.id);
    const quantity = Math.floor(Number(item.quantity));
    const product = catalog.get(id);
    if (!product || !Number.isFinite(quantity) || quantity <= 0) throw new HttpsError("invalid-argument", "Producto inválido.");
    if (product.stock < quantity) throw new HttpsError("failed-precondition", `Sin stock suficiente de ${product.producto}.`);
    lines.push({ id, name: product.producto, price: product.precioVenta, quantity, type: "producto" });
    subtotal += product.precioVenta * quantity;
  }
  const settingsSnap = await db().ref(`${ROOT}/settings/${posId}`).get();
  const taxRate = Number(settingsSnap.val()?.taxRate || 0);
  const tax = subtotal * taxRate;
  const total = subtotal + tax;
  const saleId = generateUniqueId();
  const saleNumber = `ORD${String(saleId).padStart(6, "0")}`;
  const now = new Date();
  const saleFecha = now.toISOString().split("T")[0];
  const decremented: Array<{ id: number; quantity: number }> = [];
  try {
    for (const line of lines) {
      const result = await db().ref(`${ROOT}/products/${line.id}/stock`).transaction((cur: number | null) => {
        const n = typeof cur === "number" ? cur : 0;
        if (n < line.quantity) return;
        return n - line.quantity;
      });
      if (!result.committed) {
        throw new HttpsError("failed-precondition", `Sin stock suficiente de ${line.name}.`);
      }
      decremented.push({ id: line.id, quantity: line.quantity });
    }
    await db().ref(`${ROOT}/sales/${saleId}`).set({
      id: saleId,
      posId,
      numeroVenta: saleNumber,
      clienteId: claims.clientId ?? null,
      items: lines,
      metodoPago: "online",
      subtotal,
      iva: tax,
      total,
      fecha: saleFecha,
      hora: now.toISOString().slice(11, 16),
      notas: "Pedido online",
      estado: "completada",
    });
  } catch (err) {
    for (const line of decremented) {
      await db().ref(`${ROOT}/products/${line.id}/stock`).transaction((cur: number | null) => {
        const n = typeof cur === "number" ? cur : 0;
        return n + line.quantity;
      });
    }
    throw err;
  }
  await writeSaleIndexes({ id: saleId, posId, fecha: saleFecha });
  if (claims.clientId != null) {
    const points = Math.max(0, Math.floor(total / 10));
    if (points > 0) {
      await db().ref(`${ROOT}/clients/${claims.clientId}/puntos`).transaction((cur) => (typeof cur === "number" ? cur : 0) + points);
    }
  }
  return { success: true as const, saleNumber, total };
});

export const getPlatformStats = onCall(callableOpts, async (request) => {
  const { claims } = requireAuth(request);
  if (!isPlatformRole(claims.role) && claims.role !== "financial") {
    throw new HttpsError("permission-denied", "No autorizado.");
  }
  const snap = await db().ref(`${ROOT}/platformStats`).get();
  const stats = (snap.exists() ? snap.val() : {}) as Record<string, unknown>;
  const revenueByPos: Record<string, number> = {};
  const rawPos = stats.revenueByPos;
  if (rawPos && typeof rawPos === "object") {
    for (const [key, val] of Object.entries(rawPos as Record<string, unknown>)) {
      const n = Number(val);
      if (Number.isFinite(n) && n > 0) revenueByPos[key] = n;
    }
  }
  return {
    totalRevenue: Number(stats.totalRevenue || 0),
    totalUsers: Number(stats.totalUsers || 0),
    totalSedes: Number(stats.totalSedes || 0),
    totalAppointments: Number(stats.totalAppointments || 0),
    revenueByPos,
    recentSales: normalizeRecentSales(stats.recentSales),
  };
});

export const listDirectoryUsers = onCall(callableOpts, async (request) => {
  const { claims } = requireAuth(request);
  if (!canListDirectoryUsers(claims.role)) {
    throw new HttpsError("permission-denied", "No autorizado.");
  }
  await consumeRateLimit("list-users", claims.username, 20, 15 * 60 * 1000);
  const readySnap = await db().ref(`${ROOT}/directoryMeta/ready`).get();
  if (readySnap.val() === true) {
    const snap = await db().ref(`${ROOT}/directoryUsers`).get();
    const users: DirectoryUser[] = [];
    snap.forEach((child) => {
      users.push(toDirectoryUser(String(child.key), (child.val() || {}) as Record<string, unknown>));
      return users.length >= 2000;
    });
    return { users };
  }
  const snap = await db().ref(`${ROOT}/users`).get();
  const users: DirectoryUser[] = [];
  const payload: Record<string, DirectoryUser> = {};
  snap.forEach((child) => {
    const raw = (child.val() || {}) as Record<string, unknown>;
    const row = toDirectoryUser(String(child.key), raw);
    users.push(row);
    payload[row.username] = row;
    return users.length >= 2000;
  });
  if (Object.keys(payload).length) {
    await db().ref(`${ROOT}/directoryUsers`).update(payload);
  }
  await db().ref(`${ROOT}/directoryMeta/ready`).set(true);
  return { users };
});

export const rebuildPosIndexes = onCall(
  { region: "us-central1", timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
    const { claims } = requireAuth(request);
    if (!isStaffRole(claims.role) && !isPlatformRole(claims.role)) {
      throw new HttpsError("permission-denied", "No autorizado.");
    }
    const posId = Number((request.data as { posId?: number })?.posId ?? claims.posId);
    if (!Number.isFinite(posId) || posId <= 0) throw new HttpsError("invalid-argument", "Sede inválida.");
    if (!isPlatformRole(claims.role) && Number(claims.posId) !== posId) {
      throw new HttpsError("permission-denied", "No autorizado.");
    }
    const metaRef = db().ref(`${ROOT}/indexMeta/${posId}`);
    if ((await metaRef.child("ready").get()).val() === true) {
      return { success: true as const, skipped: true };
    }
    await consumeRateLimit("rebuild-pos-indexes", `${claims.username}:${posId}`, 4, 60 * 60 * 1000);
    const lock = await metaRef.child("building").transaction((cur) => {
      if (cur === true) return;
      return true;
    });
    if (!lock.committed) return { success: true as const, skipped: true };
    try {
      if ((await metaRef.child("ready").get()).val() === true) {
        return { success: true as const, skipped: true };
      }
      const [apptsSnap, salesSnap] = await Promise.all([
        db().ref(`${ROOT}/appointments`).orderByChild("posId").equalTo(posId).get(),
        db().ref(`${ROOT}/sales`).orderByChild("posId").equalTo(posId).get(),
      ]);
      const appts = apptsSnap.exists() ? Object.values(apptsSnap.val() as Record<string, Record<string, unknown>>) : [];
      const sales = salesSnap.exists() ? Object.values(salesSnap.val() as Record<string, Record<string, unknown>>) : [];
      for (let i = 0; i < appts.length; i += 25) {
        await Promise.all(appts.slice(i, i + 25).map((apt) => writeAppointmentIndexes({
          id: Number(apt.id),
          posId: Number(apt.posId),
          barberoId: Number(apt.barberoId),
          fecha: String(apt.fecha || ""),
          hora: String(apt.hora || ""),
          duracionTotal: Number(apt.duracionTotal || 30),
          estado: String(apt.estado || "pendiente"),
        })));
      }
      for (let i = 0; i < sales.length; i += 25) {
        await Promise.all(sales.slice(i, i + 25).map((sale) => writeSaleIndexes({
          id: Number(sale.id),
          posId: Number(sale.posId),
          fecha: String(sale.fecha || ""),
        })));
      }
      await metaRef.update({ ready: true, rebuiltAt: new Date().toISOString() });
      return { success: true as const, appointments: appts.length, sales: sales.length };
    } finally {
      await metaRef.child("building").remove();
    }
  }
);

export const onSaleCreated = onValueCreated(
  { ref: "/barbershow/sales/{id}", region: "us-central1" },
  async (event) => {
    const sale = event.data.val() as {
      id?: number;
      posId?: number;
      total?: number;
      fecha?: string;
      hora?: string;
      numeroVenta?: string;
      metodoPago?: string;
    } | null;
    await bumpPlatformStat("totalSales", 1);
    const total = Number(sale?.total);
    const posId = Number(sale?.posId);
    if (Number.isFinite(total) && total > 0) {
      await bumpPlatformStat("totalRevenue", total);
      if (Number.isFinite(posId) && posId > 0) {
        await bumpPlatformStat(`revenueByPos/${posId}`, total);
      }
    }
    const summary: RecentSaleSummary = {
      id: Number(sale?.id || event.params.id || Date.now()),
      posId: Number.isFinite(posId) && posId > 0 ? posId : 0,
      total: Number.isFinite(total) ? total : 0,
      fecha: String(sale?.fecha || new Date().toISOString().slice(0, 10)),
    };
    if (sale?.hora) summary.hora = String(sale.hora);
    if (sale?.numeroVenta) summary.numeroVenta = String(sale.numeroVenta);
    if (sale?.metodoPago) summary.metodoPago = String(sale.metodoPago);
    await writeSaleIndexes({
      id: Number(sale?.id || event.params.id),
      posId,
      fecha: String(sale?.fecha || ""),
    });
    await db().ref(`${ROOT}/platformStats/recentSales`).transaction((cur) => appendRecentSales(cur, summary));
  }
);

export const onAppointmentCreated = onValueCreated(
  { ref: "/barbershow/appointments/{id}", region: "us-central1" },
  async () => {
    await bumpPlatformStat("totalAppointments", 1);
  }
);

export const onUserCreated = onValueCreated(
  { ref: "/barbershow/users/{username}", region: "us-central1" },
  async (event) => {
    await bumpPlatformStat("totalUsers", 1);
    await writeDirectoryUserRecord(event.params.username, event.data.val() as Record<string, unknown>);
  }
);

export const onPosCreated = onValueCreated(
  { ref: "/barbershow/pointsOfSale/{id}", region: "us-central1" },
  async (event) => {
    await bumpPlatformStat("totalSedes", 1);
    const val = (event.data.val() || {}) as Record<string, unknown>;
    await writePublicShopRecord({ ...val, id: Number(event.params.id) });
  }
);

