"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onPosCreated = exports.onUserCreated = exports.onAppointmentCreated = exports.onSaleCreated = exports.listDirectoryUsers = exports.getPlatformStats = exports.createClientShopOrder = exports.getShopCatalog = exports.cancelMyAppointment = exports.createClientAppointment = exports.updateMyClientProfile = void 0;
const https_1 = require("firebase-functions/v2/https");
const database_1 = require("firebase-functions/v2/database");
const lib_1 = require("./lib");
const booking_1 = require("./booking");
const callableOpts = { region: "us-central1" };
exports.updateMyClientProfile = (0, https_1.onCall)(callableOpts, async (request) => {
    const { claims } = (0, lib_1.requireAuth)(request);
    if (claims.role !== "cliente")
        throw new https_1.HttpsError("permission-denied", "Solo clientes.");
    if (claims.clientId == null)
        throw new https_1.HttpsError("failed-precondition", "No tienes un perfil de cliente vinculado.");
    const data = request.data;
    const snap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/clients/${claims.clientId}`).get();
    if (!snap.exists())
        throw new https_1.HttpsError("not-found", "Perfil de cliente no encontrado.");
    const current = snap.val();
    const updates = {};
    if ((data === null || data === void 0 ? void 0 : data.nombre) !== undefined) {
        const nombre = String(data.nombre).trim();
        if (!nombre || nombre.length > 120)
            throw new https_1.HttpsError("invalid-argument", "Nombre inválido.");
        updates.nombre = nombre;
    }
    if ((data === null || data === void 0 ? void 0 : data.telefono) !== undefined) {
        const telefono = String(data.telefono).trim();
        if ((0, lib_1.digitsOnly)(telefono).length < lib_1.MIN_PHONE_DIGITS)
            throw new https_1.HttpsError("invalid-argument", "Teléfono inválido.");
        updates.telefono = telefono;
    }
    if ((data === null || data === void 0 ? void 0 : data.photoUrl) !== undefined) {
        if (data.photoUrl && String(data.photoUrl).length > 500000)
            throw new https_1.HttpsError("invalid-argument", "Imagen demasiado grande.");
        updates.photoUrl = data.photoUrl || null;
    }
    if (Object.keys(updates).length) {
        await (0, lib_1.db)().ref(`${lib_1.ROOT}/clients/${claims.clientId}`).update(updates);
    }
    if (updates.telefono) {
        const posId = Number(current.posId);
        if (Number.isFinite(posId)) {
            await (0, lib_1.indexClientPhone)(posId, String(current.telefono || ""), null);
            await (0, lib_1.indexClientPhone)(posId, String(updates.telefono), claims.clientId);
        }
    }
    const userUpdates = {};
    if (updates.nombre)
        userUpdates.name = updates.nombre;
    if ((data === null || data === void 0 ? void 0 : data.photoUrl) !== undefined)
        userUpdates.photoUrl = updates.photoUrl;
    if (Object.keys(userUpdates).length) {
        await (0, lib_1.db)().ref(`${lib_1.ROOT}/users/${claims.username}`).update(userUpdates);
    }
    const fresh = { ...current, ...updates };
    return { success: true, client: fresh };
});
exports.createClientAppointment = (0, https_1.onCall)(callableOpts, async (request) => {
    var _a;
    const { claims } = (0, lib_1.requireAuth)(request);
    if (claims.role !== "cliente")
        throw new https_1.HttpsError("permission-denied", "Solo clientes.");
    await (0, lib_1.consumeRateLimit)("client-book", claims.username, 12, 60 * 60 * 1000);
    const parsed = (0, booking_1.assertBookingPayload)(request.data);
    await (0, booking_1.assertPosAndBarber)(parsed.posId, parsed.barberoId);
    const servicios = await (0, booking_1.resolveServicesFromIds)(parsed.posId, (_a = request.data) === null || _a === void 0 ? void 0 : _a.servicios);
    const clientId = await (0, booking_1.ensureClientForBooking)({
        posId: parsed.posId,
        nombre: parsed.nombre || String(claims.username),
        telefono: parsed.telefono,
        notas: "Reserva con cuenta",
        existingClientId: claims.clientId,
    });
    const appointmentId = await (0, booking_1.createPendingAppointment)({
        posId: parsed.posId,
        barberoId: parsed.barberoId,
        fecha: parsed.fecha,
        hora: parsed.hora,
        clienteId: clientId,
        servicios,
    });
    return { success: true, appointmentId };
});
exports.cancelMyAppointment = (0, https_1.onCall)(callableOpts, async (request) => {
    var _a;
    const { claims } = (0, lib_1.requireAuth)(request);
    if (claims.role !== "cliente")
        throw new https_1.HttpsError("permission-denied", "Solo clientes.");
    const id = Number((_a = request.data) === null || _a === void 0 ? void 0 : _a.appointmentId);
    if (!Number.isFinite(id))
        throw new https_1.HttpsError("invalid-argument", "Cita inválida.");
    const snap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/appointments/${id}`).get();
    if (!snap.exists())
        throw new https_1.HttpsError("not-found", "Cita no encontrada.");
    const apt = snap.val();
    if (Number(apt.clienteId) !== claims.clientId)
        throw new https_1.HttpsError("permission-denied", "No autorizado.");
    if (apt.estado !== "pendiente" && apt.estado !== "confirmada") {
        throw new https_1.HttpsError("failed-precondition", "Esa cita ya no se puede cancelar.");
    }
    await (0, lib_1.db)().ref(`${lib_1.ROOT}/appointments/${id}`).update({ estado: "cancelada" });
    await (0, lib_1.writeAppointmentIndexes)({
        id,
        posId: Number(apt.posId),
        barberoId: Number(apt.barberoId),
        fecha: String(apt.fecha),
        hora: String(apt.hora),
        duracionTotal: Number(apt.duracionTotal || 30),
        estado: "cancelada",
    });
    await (0, lib_1.releaseAppointmentSlot)(Number(apt.posId), Number(apt.barberoId), String(apt.fecha), String(apt.hora));
    return { success: true };
});
exports.getShopCatalog = (0, https_1.onCall)(callableOpts, async (request) => {
    var _a;
    (0, lib_1.assertAppCheck)(request);
    await (0, lib_1.consumeRateLimit)("shop-catalog", (0, lib_1.ipHash)(request), 60, 15 * 60 * 1000);
    const posId = Number((_a = request.data) === null || _a === void 0 ? void 0 : _a.posId);
    if (!Number.isFinite(posId))
        throw new https_1.HttpsError("invalid-argument", "Sede inválida.");
    const posSnap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/pointsOfSale/${posId}`).get();
    const shop = (0, lib_1.sanitizePublicShop)(posSnap.val());
    if (!shop)
        throw new https_1.HttpsError("not-found", "Barbería no encontrada.");
    const [productsSnap, settingsSnap] = await Promise.all([
        (0, lib_1.db)().ref(`${lib_1.ROOT}/products`).orderByChild("posId").equalTo(posId).get(),
        (0, lib_1.db)().ref(`${lib_1.ROOT}/settings/${posId}`).get(),
    ]);
    const products = Object.values((productsSnap.val() || {})).map((p) => ({
        id: Number(p.id),
        posId,
        producto: String(p.producto || ""),
        precioVenta: Number(p.precioVenta || 0),
        stock: Number(p.stock || 0),
        photoUrl: typeof p.photoUrl === "string" ? p.photoUrl : null,
    }));
    const settings = settingsSnap.exists() ? settingsSnap.val() : {};
    return {
        shop,
        products,
        taxRate: Number(settings.taxRate || 0),
        currencySymbol: String(settings.currencySymbol || "$"),
    };
});
exports.createClientShopOrder = (0, https_1.onCall)(callableOpts, async (request) => {
    var _a, _b, _c;
    const { claims } = (0, lib_1.requireAuth)(request);
    if (claims.role !== "cliente")
        throw new https_1.HttpsError("permission-denied", "Solo clientes.");
    await (0, lib_1.consumeRateLimit)("shop-order", claims.username, 10, 60 * 60 * 1000);
    const data = request.data;
    const posId = Number(data === null || data === void 0 ? void 0 : data.posId);
    const items = Array.isArray(data === null || data === void 0 ? void 0 : data.items) ? data.items.slice(0, 30) : [];
    if (!Number.isFinite(posId) || !items.length)
        throw new https_1.HttpsError("invalid-argument", "Pedido inválido.");
    const [prefSnap, clientPosSnap] = await Promise.all([
        (0, lib_1.db)().ref(`${lib_1.ROOT}/clientPreferences/${claims.username}/preferredPosId`).get(),
        claims.clientId != null
            ? (0, lib_1.db)().ref(`${lib_1.ROOT}/clients/${claims.clientId}/posId`).get()
            : Promise.resolve(null),
    ]);
    if (!(0, lib_1.canClientOrderAtPos)({
        preferredPosId: prefSnap.val(),
        clientRecordPosId: clientPosSnap ? clientPosSnap.val() : null,
        claimsPosId: claims.posId,
        targetPosId: posId,
    })) {
        throw new https_1.HttpsError("permission-denied", "Solo puedes comprar en tu barbería seleccionada.");
    }
    const posSnap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/pointsOfSale/${posId}`).get();
    if (!posSnap.exists() || ((_a = posSnap.val()) === null || _a === void 0 ? void 0 : _a.isActive) === false)
        throw new https_1.HttpsError("not-found", "Barbería no encontrada.");
    const productsSnap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/products`).orderByChild("posId").equalTo(posId).get();
    const catalog = new Map();
    if (productsSnap.exists()) {
        for (const p of Object.values(productsSnap.val())) {
            catalog.set(Number(p.id), {
                id: Number(p.id),
                producto: String(p.producto || ""),
                precioVenta: Number(p.precioVenta || 0),
                stock: Number(p.stock || 0),
            });
        }
    }
    const lines = [];
    let subtotal = 0;
    for (const item of items) {
        const id = Number(item.id);
        const quantity = Math.floor(Number(item.quantity));
        const product = catalog.get(id);
        if (!product || !Number.isFinite(quantity) || quantity <= 0)
            throw new https_1.HttpsError("invalid-argument", "Producto inválido.");
        if (product.stock < quantity)
            throw new https_1.HttpsError("failed-precondition", `Sin stock suficiente de ${product.producto}.`);
        lines.push({ id, name: product.producto, price: product.precioVenta, quantity, type: "producto" });
        subtotal += product.precioVenta * quantity;
    }
    const settingsSnap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/settings/${posId}`).get();
    const taxRate = Number(((_b = settingsSnap.val()) === null || _b === void 0 ? void 0 : _b.taxRate) || 0);
    const tax = subtotal * taxRate;
    const total = subtotal + tax;
    const saleId = (0, lib_1.generateUniqueId)();
    const saleNumber = `ORD${String(saleId).padStart(6, "0")}`;
    const now = new Date();
    const decremented = [];
    try {
        for (const line of lines) {
            const result = await (0, lib_1.db)().ref(`${lib_1.ROOT}/products/${line.id}/stock`).transaction((cur) => {
                const n = typeof cur === "number" ? cur : 0;
                if (n < line.quantity)
                    return;
                return n - line.quantity;
            });
            if (!result.committed) {
                throw new https_1.HttpsError("failed-precondition", `Sin stock suficiente de ${line.name}.`);
            }
            decremented.push({ id: line.id, quantity: line.quantity });
        }
        await (0, lib_1.db)().ref(`${lib_1.ROOT}/sales/${saleId}`).set({
            id: saleId,
            posId,
            numeroVenta: saleNumber,
            clienteId: (_c = claims.clientId) !== null && _c !== void 0 ? _c : null,
            items: lines,
            metodoPago: "online",
            subtotal,
            iva: tax,
            total,
            fecha: now.toISOString().split("T")[0],
            hora: now.toISOString().slice(11, 16),
            notas: "Pedido online",
            estado: "completada",
        });
    }
    catch (err) {
        for (const line of decremented) {
            await (0, lib_1.db)().ref(`${lib_1.ROOT}/products/${line.id}/stock`).transaction((cur) => {
                const n = typeof cur === "number" ? cur : 0;
                return n + line.quantity;
            });
        }
        throw err;
    }
    if (claims.clientId != null) {
        const points = Math.max(0, Math.floor(total / 10));
        if (points > 0) {
            await (0, lib_1.db)().ref(`${lib_1.ROOT}/clients/${claims.clientId}/puntos`).transaction((cur) => (typeof cur === "number" ? cur : 0) + points);
        }
    }
    return { success: true, saleNumber, total };
});
exports.getPlatformStats = (0, https_1.onCall)(callableOpts, async (request) => {
    const { claims } = (0, lib_1.requireAuth)(request);
    if (!(0, lib_1.isPlatformRole)(claims.role) && claims.role !== "financial") {
        throw new https_1.HttpsError("permission-denied", "No autorizado.");
    }
    const snap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/platformStats`).get();
    const stats = (snap.exists() ? snap.val() : {});
    const revenueByPos = {};
    const rawPos = stats.revenueByPos;
    if (rawPos && typeof rawPos === "object") {
        for (const [key, val] of Object.entries(rawPos)) {
            const n = Number(val);
            if (Number.isFinite(n) && n > 0)
                revenueByPos[key] = n;
        }
    }
    return {
        totalRevenue: Number(stats.totalRevenue || 0),
        totalUsers: Number(stats.totalUsers || 0),
        totalSedes: Number(stats.totalSedes || 0),
        totalAppointments: Number(stats.totalAppointments || 0),
        revenueByPos,
        recentSales: (0, lib_1.normalizeRecentSales)(stats.recentSales),
    };
});
exports.listDirectoryUsers = (0, https_1.onCall)(callableOpts, async (request) => {
    const { claims } = (0, lib_1.requireAuth)(request);
    if (!(0, lib_1.canListDirectoryUsers)(claims.role)) {
        throw new https_1.HttpsError("permission-denied", "No autorizado.");
    }
    await (0, lib_1.consumeRateLimit)("list-users", claims.username, 20, 15 * 60 * 1000);
    const snap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/users`).get();
    const users = [];
    snap.forEach((child) => {
        const raw = (child.val() || {});
        users.push((0, lib_1.toDirectoryUser)(String(child.key), raw));
        return users.length >= 2000;
    });
    return { users };
});
exports.onSaleCreated = (0, database_1.onValueCreated)({ ref: "/barbershow/sales/{id}", region: "us-central1" }, async (event) => {
    const sale = event.data.val();
    await (0, lib_1.bumpPlatformStat)("totalSales", 1);
    const total = Number(sale === null || sale === void 0 ? void 0 : sale.total);
    const posId = Number(sale === null || sale === void 0 ? void 0 : sale.posId);
    if (Number.isFinite(total) && total > 0) {
        await (0, lib_1.bumpPlatformStat)("totalRevenue", total);
        if (Number.isFinite(posId) && posId > 0) {
            await (0, lib_1.bumpPlatformStat)(`revenueByPos/${posId}`, total);
        }
    }
    const summary = {
        id: Number((sale === null || sale === void 0 ? void 0 : sale.id) || event.params.id || Date.now()),
        posId: Number.isFinite(posId) && posId > 0 ? posId : 0,
        total: Number.isFinite(total) ? total : 0,
        fecha: String((sale === null || sale === void 0 ? void 0 : sale.fecha) || new Date().toISOString().slice(0, 10)),
    };
    if (sale === null || sale === void 0 ? void 0 : sale.hora)
        summary.hora = String(sale.hora);
    if (sale === null || sale === void 0 ? void 0 : sale.numeroVenta)
        summary.numeroVenta = String(sale.numeroVenta);
    if (sale === null || sale === void 0 ? void 0 : sale.metodoPago)
        summary.metodoPago = String(sale.metodoPago);
    await (0, lib_1.db)().ref(`${lib_1.ROOT}/platformStats/recentSales`).transaction((cur) => (0, lib_1.appendRecentSales)(cur, summary));
});
exports.onAppointmentCreated = (0, database_1.onValueCreated)({ ref: "/barbershow/appointments/{id}", region: "us-central1" }, async () => {
    await (0, lib_1.bumpPlatformStat)("totalAppointments", 1);
});
exports.onUserCreated = (0, database_1.onValueCreated)({ ref: "/barbershow/users/{username}", region: "us-central1" }, async () => {
    await (0, lib_1.bumpPlatformStat)("totalUsers", 1);
});
exports.onPosCreated = (0, database_1.onValueCreated)({ ref: "/barbershow/pointsOfSale/{id}", region: "us-central1" }, async () => {
    await (0, lib_1.bumpPlatformStat)("totalSedes", 1);
});
//# sourceMappingURL=clientOps.js.map