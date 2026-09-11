"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertPosAndBarber = exports.assertBookingPayload = exports.createPendingAppointment = exports.ensureClientForBooking = exports.loadBusySlotsForPos = exports.resolveServicesFromIds = void 0;
const https_1 = require("firebase-functions/v2/https");
const lib_1 = require("./lib");
async function resolveServicesFromIds(posId, requested) {
    var _a;
    const ids = (Array.isArray(requested) ? requested : [])
        .map((s) => Number(s === null || s === void 0 ? void 0 : s.id))
        .filter((id) => Number.isFinite(id))
        .slice(0, 10);
    if (!ids.length)
        return [];
    const snap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/services`).orderByChild("posId").equalTo(posId).get();
    const byId = new Map();
    if (snap.exists()) {
        for (const row of Object.values(snap.val())) {
            const id = Number(row.id);
            if (Number.isFinite(id))
                byId.set(id, row);
        }
    }
    const resolved = [];
    for (const id of ids) {
        const svc = byId.get(id);
        if (!svc || Number(svc.posId) !== posId) {
            throw new https_1.HttpsError("invalid-argument", "Un servicio no pertenece a esta barbería.");
        }
        resolved.push({
            id,
            posId,
            name: String(svc.name || ""),
            price: Number(svc.price || 0),
            duration: Number(svc.duration || 30),
            barberId: (_a = svc.barberId) !== null && _a !== void 0 ? _a : null,
        });
    }
    return resolved;
}
exports.resolveServicesFromIds = resolveServicesFromIds;
async function loadBusySlotsForPos(posId) {
    const start = (0, lib_1.isoDateOffset)(-1);
    const end = (0, lib_1.isoDateOffset)(lib_1.PUBLIC_SLOT_DAYS);
    const dates = [];
    const cursor = new Date(`${start}T00:00:00Z`);
    const last = new Date(`${end}T00:00:00Z`);
    while (cursor <= last) {
        dates.push(cursor.toISOString().slice(0, 10));
        cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    const snaps = await Promise.all(dates.map((fecha) => (0, lib_1.db)().ref(`${lib_1.ROOT}/busySlots/${posId}/${fecha}`).get()));
    const out = [];
    for (const snap of snaps) {
        if (!snap.exists())
            continue;
        for (const row of Object.values(snap.val())) {
            if (!row || row.estado === "cancelada")
                continue;
            out.push({
                barberoId: Number(row.barberoId),
                fecha: String(row.fecha),
                hora: String(row.hora),
                duracionTotal: Number(row.duracionTotal || 30),
                estado: String(row.estado || "pendiente"),
            });
        }
    }
    return out;
}
exports.loadBusySlotsForPos = loadBusySlotsForPos;
async function ensureClientForBooking(params) {
    var _a;
    if (params.existingClientId != null) {
        const existing = await (0, lib_1.db)().ref(`${lib_1.ROOT}/clients/${params.existingClientId}`).get();
        if (existing.exists() && Number((_a = existing.val()) === null || _a === void 0 ? void 0 : _a.posId) === params.posId) {
            return params.existingClientId;
        }
    }
    const indexed = await (0, lib_1.findClientIdByPhone)(params.posId, params.telefono);
    if (indexed != null)
        return indexed;
    const clientId = (0, lib_1.generateUniqueId)();
    await (0, lib_1.db)().ref(`${lib_1.ROOT}/clients/${clientId}`).set({
        id: clientId,
        posId: params.posId,
        nombre: params.nombre,
        telefono: params.telefono,
        email: "",
        ultimaVisita: "N/A",
        notas: params.notas,
        fechaRegistro: new Date().toISOString().split("T")[0],
        puntos: 0,
        status: "active",
        whatsappOptIn: false,
    });
    await (0, lib_1.indexClientPhone)(params.posId, params.telefono, clientId);
    return clientId;
}
exports.ensureClientForBooking = ensureClientForBooking;
async function createPendingAppointment(params) {
    const duracionTotal = params.servicios.reduce((acc, s) => acc + Number(s.duration || 0), 0) || 30;
    const total = params.servicios.reduce((acc, s) => acc + Number(s.price || 0), 0);
    await (0, lib_1.lockAppointmentSlot)(params.posId, params.barberoId, params.fecha, params.hora);
    try {
        const busy = await (0, lib_1.db)().ref(`${lib_1.ROOT}/busySlots/${params.posId}/${params.fecha}/${params.barberoId}_${params.hora.replace(/[.#$\[\]]/g, "_")}`).get();
        if (busy.exists()) {
            throw new https_1.HttpsError("already-exists", "Ese horario ya no está disponible.");
        }
        const id = (0, lib_1.generateUniqueId)();
        const appointment = {
            id,
            posId: params.posId,
            clienteId: params.clienteId,
            barberoId: params.barberoId,
            fecha: params.fecha,
            hora: params.hora,
            servicios: params.servicios,
            notas: "",
            duracionTotal,
            total,
            estado: "pendiente",
            fechaCreacion: new Date().toISOString(),
        };
        await (0, lib_1.db)().ref(`${lib_1.ROOT}/appointments/${id}`).set(appointment);
        await (0, lib_1.writeAppointmentIndexes)(appointment);
        return id;
    }
    finally {
        // El mutex solo cubre la carrera; la ocupación queda en busySlots.
        await (0, lib_1.releaseAppointmentSlot)(params.posId, params.barberoId, params.fecha, params.hora);
    }
}
exports.createPendingAppointment = createPendingAppointment;
function assertBookingPayload(data) {
    const posId = Number(data.posId);
    const barberoId = Number(data.barberoId);
    const fecha = String(data.fecha || "");
    const hora = String(data.hora || "");
    const nombre = String(data.nombre || "").trim();
    const telefono = String(data.telefono || "").trim();
    if (!Number.isFinite(posId) || !Number.isFinite(barberoId) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora) || !nombre || (0, lib_1.digitsOnly)(telefono).length < lib_1.MIN_PHONE_DIGITS) {
        throw new https_1.HttpsError("invalid-argument", "Datos de reserva inválidos.");
    }
    return { posId, barberoId, fecha, hora, nombre, telefono };
}
exports.assertBookingPayload = assertBookingPayload;
async function assertPosAndBarber(posId, barberoId) {
    var _a, _b, _c;
    const posSnap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/pointsOfSale/${posId}`).get();
    if (!posSnap.exists() || ((_a = posSnap.val()) === null || _a === void 0 ? void 0 : _a.isActive) === false)
        throw new https_1.HttpsError("not-found", "Barbería no encontrada.");
    const barberSnap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/barbers/${barberoId}`).get();
    if (!barberSnap.exists() || Number((_b = barberSnap.val()) === null || _b === void 0 ? void 0 : _b.posId) !== posId || ((_c = barberSnap.val()) === null || _c === void 0 ? void 0 : _c.active) === false) {
        throw new https_1.HttpsError("failed-precondition", "Barbero no disponible.");
    }
}
exports.assertPosAndBarber = assertPosAndBarber;
//# sourceMappingURL=booking.js.map