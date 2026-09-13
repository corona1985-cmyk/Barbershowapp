import { HttpsError } from "firebase-functions/v2/https";
import {
  ROOT,
  MIN_PHONE_DIGITS,
  PUBLIC_SLOT_DAYS,
  db,
  digitsOnly,
  generateUniqueId,
  indexClientPhone,
  findClientIdByPhone,
  isoDateOffset,
  lockAppointmentSlot,
  releaseAppointmentSlot,
  writeAppointmentIndexes,
  writeClientLite,
} from "./lib";

type ServiceRow = { id: number; posId?: number; name?: string; price?: number; duration?: number; barberId?: number | null };

export async function resolveServicesFromIds(posId: number, requested: Array<{ id?: number }> | undefined): Promise<ServiceRow[]> {
  const ids = (Array.isArray(requested) ? requested : [])
    .map((s) => Number(s?.id))
    .filter((id) => Number.isFinite(id))
    .slice(0, 10);
  if (!ids.length) return [];
  const snap = await db().ref(`${ROOT}/services`).orderByChild("posId").equalTo(posId).get();
  const byId = new Map<number, ServiceRow>();
  if (snap.exists()) {
    for (const row of Object.values(snap.val() as Record<string, ServiceRow>)) {
      const id = Number(row.id);
      if (Number.isFinite(id)) byId.set(id, row);
    }
  }
  const resolved: ServiceRow[] = [];
  for (const id of ids) {
    const svc = byId.get(id);
    if (!svc || Number(svc.posId) !== posId) {
      throw new HttpsError("invalid-argument", "Un servicio no pertenece a esta barbería.");
    }
    resolved.push({
      id,
      posId,
      name: String(svc.name || ""),
      price: Number(svc.price || 0),
      duration: Number(svc.duration || 30),
      barberId: svc.barberId ?? null,
    });
  }
  return resolved;
}

export async function loadBusySlotsForPos(posId: number): Promise<Array<{ barberoId: number; fecha: string; hora: string; duracionTotal: number; estado: string }>> {
  const start = isoDateOffset(-1);
  const end = isoDateOffset(PUBLIC_SLOT_DAYS);
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const snaps = await Promise.all(dates.map((fecha) => db().ref(`${ROOT}/busySlots/${posId}/${fecha}`).get()));
  const out: Array<{ barberoId: number; fecha: string; hora: string; duracionTotal: number; estado: string }> = [];
  for (const snap of snaps) {
    if (!snap.exists()) continue;
    for (const row of Object.values(snap.val() as Record<string, Record<string, unknown>>)) {
      if (!row || row.estado === "cancelada") continue;
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

export async function ensureClientForBooking(params: {
  posId: number;
  nombre: string;
  telefono: string;
  notas: string;
  existingClientId?: number | null;
}): Promise<number> {
  if (params.existingClientId != null) {
    const existing = await db().ref(`${ROOT}/clients/${params.existingClientId}`).get();
    if (existing.exists() && Number(existing.val()?.posId) === params.posId) {
      return params.existingClientId;
    }
  }
  const indexed = await findClientIdByPhone(params.posId, params.telefono);
  if (indexed != null) return indexed;
  const clientId = generateUniqueId();
  await db().ref(`${ROOT}/clients/${clientId}`).set({
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
  await writeClientLite({
    id: clientId,
    posId: params.posId,
    nombre: params.nombre,
    telefono: params.telefono,
    email: "",
    ultimaVisita: "N/A",
    puntos: 0,
    status: "active",
    whatsappOptIn: false,
    fechaRegistro: new Date().toISOString().split("T")[0],
  });
  await indexClientPhone(params.posId, params.telefono, clientId);
  return clientId;
}

export async function createPendingAppointment(params: {
  posId: number;
  barberoId: number;
  fecha: string;
  hora: string;
  clienteId: number;
  servicios: ServiceRow[];
}): Promise<number> {
  const duracionTotal = params.servicios.reduce((acc, s) => acc + Number(s.duration || 0), 0) || 30;
  const total = params.servicios.reduce((acc, s) => acc + Number(s.price || 0), 0);
  await lockAppointmentSlot(params.posId, params.barberoId, params.fecha, params.hora);
  try {
    const busy = await db().ref(`${ROOT}/busySlots/${params.posId}/${params.fecha}/${params.barberoId}_${params.hora.replace(/[.#$\[\]]/g, "_")}`).get();
    if (busy.exists()) {
      throw new HttpsError("already-exists", "Ese horario ya no está disponible.");
    }
    const id = generateUniqueId();
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
    await db().ref(`${ROOT}/appointments/${id}`).set(appointment);
    await writeAppointmentIndexes(appointment);
    return id;
  } finally {
    // El mutex solo cubre la carrera; la ocupación queda en busySlots.
    await releaseAppointmentSlot(params.posId, params.barberoId, params.fecha, params.hora);
  }
}

export function assertBookingPayload(data: {
  posId?: number;
  barberoId?: number;
  fecha?: string;
  hora?: string;
  nombre?: string;
  telefono?: string;
}): { posId: number; barberoId: number; fecha: string; hora: string; nombre: string; telefono: string } {
  const posId = Number(data.posId);
  const barberoId = Number(data.barberoId);
  const fecha = String(data.fecha || "");
  const hora = String(data.hora || "");
  const nombre = String(data.nombre || "").trim();
  const telefono = String(data.telefono || "").trim();
  if (!Number.isFinite(posId) || !Number.isFinite(barberoId) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora) || !nombre || digitsOnly(telefono).length < MIN_PHONE_DIGITS) {
    throw new HttpsError("invalid-argument", "Datos de reserva inválidos.");
  }
  return { posId, barberoId, fecha, hora, nombre, telefono };
}

export async function assertPosAndBarber(posId: number, barberoId: number): Promise<void> {
  const posSnap = await db().ref(`${ROOT}/pointsOfSale/${posId}`).get();
  if (!posSnap.exists() || posSnap.val()?.isActive === false) throw new HttpsError("not-found", "Barbería no encontrada.");
  const barberSnap = await db().ref(`${ROOT}/barbers/${barberoId}`).get();
  if (!barberSnap.exists() || Number(barberSnap.val()?.posId) !== posId || barberSnap.val()?.active === false) {
    throw new HttpsError("failed-precondition", "Barbero no disponible.");
  }
}
