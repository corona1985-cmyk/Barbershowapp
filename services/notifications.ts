import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { DataService } from './data';
import { Appointment, Client, Barber } from '../types';
import { translate } from '../i18n';

/**
 * Notificaciones locales de citas (sin servidor / sin plan Blaze).
 *
 * - Recordatorio 30 min antes: lo programa el sistema operativo, llega aunque la app esté cerrada.
 * - Aviso de cita nueva: solo barbero/admin, y solo mientras la app esté abierta o en segundo plano
 *   (se detecta por polling al comparar con los IDs ya vistos).
 *
 * Solo actúa en plataformas nativas (iOS/Android). En web no hace nada.
 */

const MINUTES_BEFORE = 30;
const ANDROID_CHANNEL_ID = 'citas';

/** Rango de IDs para recordatorios programados (entero de 32 bits que exige el plugin). */
const REMINDER_ID_MOD = 1_000_000_000;
/** Offset para IDs de avisos inmediatos, sin colisionar con los recordatorios. */
const INSTANT_ID_OFFSET = 1_000_000_000;

const STORAGE_SCHEDULED_IDS = 'notif_scheduled_reminder_ids';
const seenStorageKey = (posId: number | null) => `notif_seen_appts_${posId ?? 'none'}`;

export interface NotificationContext {
    role: string;
    posId: number | null;
    barberId: number | null;
    clientId: number | null;
}

let permissionGranted = false;

function reminderNotificationId(appointmentId: number): number {
    return Math.abs(appointmentId) % REMINDER_ID_MOD;
}

function instantNotificationId(appointmentId: number): number {
    return (Math.abs(appointmentId) % REMINDER_ID_MOD) + INSTANT_ID_OFFSET;
}

/** Fecha/hora de la cita en hora local a partir de "YYYY-MM-DD" y "HH:mm". */
function appointmentDate(apt: Appointment): Date | null {
    if (!apt.fecha || !apt.hora) return null;
    const d = new Date(`${apt.fecha}T${apt.hora}:00`);
    return Number.isNaN(d.getTime()) ? null : d;
}

function readScheduledIds(): number[] {
    try {
        const raw = localStorage.getItem(STORAGE_SCHEDULED_IDS);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed.filter((n) => typeof n === 'number') : [];
    } catch {
        return [];
    }
}

function writeScheduledIds(ids: number[]): void {
    try {
        localStorage.setItem(STORAGE_SCHEDULED_IDS, JSON.stringify(ids));
    } catch {
        /* almacenamiento no disponible: ignorar */
    }
}

function readSeenIds(posId: number | null): Set<number> | null {
    try {
        const raw = localStorage.getItem(seenStorageKey(posId));
        if (raw == null) return null;
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? new Set(parsed.filter((n) => typeof n === 'number')) : new Set();
    } catch {
        return new Set();
    }
}

function writeSeenIds(posId: number | null, ids: Set<number>): void {
    try {
        localStorage.setItem(seenStorageKey(posId), JSON.stringify([...ids]));
    } catch {
        /* ignorar */
    }
}

/** Pide permiso de notificaciones y crea el canal Android. Seguro de llamar varias veces. */
export async function initLocalNotifications(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return false;
    try {
        let perm = await LocalNotifications.checkPermissions();
        if (perm.display !== 'granted') {
            perm = await LocalNotifications.requestPermissions();
        }
        permissionGranted = perm.display === 'granted';
        if (permissionGranted) {
            try {
                await LocalNotifications.createChannel({
                    id: ANDROID_CHANNEL_ID,
                    name: 'Citas',
                    description: 'Recordatorios y avisos de citas',
                    importance: 5,
                    visibility: 1,
                });
            } catch {
                /* createChannel solo aplica en Android; ignorar en iOS */
            }
        }
        return permissionGranted;
    } catch (err) {
        console.warn('[notifications] init error:', err);
        return false;
    }
}

/** Filtra las citas relevantes para el usuario actual. */
function relevantAppointments(appointments: Appointment[], ctx: NotificationContext): Appointment[] {
    if (ctx.role === 'cliente') {
        return ctx.clientId == null ? [] : appointments.filter((a) => a.clienteId === ctx.clientId);
    }
    if (ctx.role === 'barbero') {
        // getAppointments ya filtra por barbero, pero reforzamos por si acaso.
        return ctx.barberId == null ? [] : appointments.filter((a) => a.barberoId === ctx.barberId);
    }
    // admin / superadmin: todas las de la sede.
    return appointments;
}

function clientName(clients: Client[], id: number): string {
    return clients.find((c) => c.id === id)?.nombre ?? 'Cliente';
}

function barberName(barbers: Barber[], id: number): string | null {
    return barbers.find((b) => b.id === id)?.name ?? null;
}

/**
 * Sincroniza las notificaciones locales con el estado actual de las citas:
 * (1) reprograma los recordatorios de 30 min y (2) avisa de citas nuevas (barbero/admin).
 */
export async function syncAppointmentNotifications(ctx: NotificationContext): Promise<void> {
    if (!Capacitor.isNativePlatform() || !permissionGranted) return;

    let appointments: Appointment[];
    try {
        appointments = await DataService.getAppointments();
    } catch (err) {
        console.warn('[notifications] no se pudieron leer las citas:', err);
        return;
    }

    const relevant = relevantAppointments(appointments, ctx);
    const isStaff = ctx.role === 'barbero' || ctx.role === 'admin' || ctx.role === 'superadmin';

    let clients: Client[] = [];
    let barbers: Barber[] = [];
    try {
        [clients, barbers] = await Promise.all([DataService.getClients(), DataService.getBarbers()]);
    } catch {
        /* sin nombres: se usan textos genéricos */
    }

    await rescheduleReminders(relevant, ctx, clients, barbers);

    if (isStaff) {
        await notifyNewAppointments(relevant, ctx, clients);
    }
}

/** Cancela los recordatorios previos y programa los de las citas futuras. */
async function rescheduleReminders(
    relevant: Appointment[],
    ctx: NotificationContext,
    clients: Client[],
    barbers: Barber[],
): Promise<void> {
    const previousIds = readScheduledIds();
    if (previousIds.length > 0) {
        try {
            await LocalNotifications.cancel({ notifications: previousIds.map((id) => ({ id })) });
        } catch {
            /* ignorar */
        }
    }

    const now = Date.now();
    const toSchedule = [] as { id: number; title: string; body: string; schedule: { at: Date }; channelId: string }[];

    for (const apt of relevant) {
        if (apt.estado !== 'pendiente' && apt.estado !== 'confirmada') continue;
        const when = appointmentDate(apt);
        if (!when) continue;
        const fireAt = new Date(when.getTime() - MINUTES_BEFORE * 60_000);
        if (fireAt.getTime() <= now) continue;

        let body: string;
        if (ctx.role === 'cliente') {
            const bName = barberName(barbers, apt.barberoId);
            body = bName
                ? translate('notifications.upcomingClientWithBarber', { time: apt.hora, barber: bName, minutes: MINUTES_BEFORE })
                : translate('notifications.upcomingClientBody', { time: apt.hora, minutes: MINUTES_BEFORE });
        } else {
            body = translate('notifications.upcomingStaffBody', {
                client: clientName(clients, apt.clienteId),
                time: apt.hora,
                minutes: MINUTES_BEFORE,
            });
        }

        toSchedule.push({
            id: reminderNotificationId(apt.id),
            title: translate('notifications.upcomingTitle'),
            body,
            schedule: { at: fireAt },
            channelId: ANDROID_CHANNEL_ID,
        });
    }

    if (toSchedule.length > 0) {
        try {
            await LocalNotifications.schedule({ notifications: toSchedule });
        } catch (err) {
            console.warn('[notifications] error programando recordatorios:', err);
        }
    }
    writeScheduledIds(toSchedule.map((n) => n.id));
}

/** Dispara avisos inmediatos para citas nuevas no vistas antes (solo personal de la sede). */
async function notifyNewAppointments(
    relevant: Appointment[],
    ctx: NotificationContext,
    clients: Client[],
): Promise<void> {
    const currentIds = new Set(relevant.map((a) => a.id));
    const seen = readSeenIds(ctx.posId);

    // Primer arranque: sembrar sin notificar para no inundar con citas existentes.
    if (seen == null) {
        writeSeenIds(ctx.posId, currentIds);
        return;
    }

    const newAppts = relevant.filter((a) => !seen.has(a.id) && a.estado !== 'cancelada');
    const notifications = newAppts.map((apt) => ({
        id: instantNotificationId(apt.id),
        title: translate('notifications.newTitle'),
        body: translate('notifications.newBody', {
            client: clientName(clients, apt.clienteId),
            date: apt.fecha,
            time: apt.hora,
        }),
        channelId: ANDROID_CHANNEL_ID,
    }));

    if (notifications.length > 0) {
        try {
            await LocalNotifications.schedule({ notifications });
        } catch (err) {
            console.warn('[notifications] error avisando cita nueva:', err);
        }
    }

    // Marcar todas las actuales como vistas (unión, para no re-notificar).
    const union = new Set<number>(seen);
    currentIds.forEach((id) => union.add(id));
    writeSeenIds(ctx.posId, union);
}

/** Cancela los recordatorios pendientes (uso en logout). */
export async function stopAppointmentNotifications(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    const ids = readScheduledIds();
    if (ids.length > 0) {
        try {
            await LocalNotifications.cancel({ notifications: ids.map((id) => ({ id })) });
        } catch {
            /* ignorar */
        }
    }
    writeScheduledIds([]);
}
