import React, { useState, useEffect } from 'react';
import { DataService } from '../services/data';
import { Appointment, Barber, Client, NotificationLog } from '../types';
import { MessageCircle, CheckCircle, AlertCircle, Clock, Calendar, ExternalLink, User, Scissors, Trash2, ChevronDown, ChevronUp } from 'lucide-react';

/** Normaliza teléfono para enlace wa.me: solo dígitos. No se añade prefijo de país; guarda los números con su código (ej. +52 55…) si quieres México. */
function phoneToWaNumber(phone: string | number | null | undefined): string {
    const s = String(phone ?? '');
    return s.replace(/\D/g, '');
}

/** Genera enlace WhatsApp con mensaje prellenado */
function buildWhatsAppLink(phone: string | number | null | undefined, message: string): string {
    const num = phoneToWaNumber(phone);
    if (!num || num.length < 10) return '';
    return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

/** True si la cita (fecha + hora) fue hace más de 30 minutos (no mostrar en consola WhatsApp). */
function isAppointmentPastThreshold(apt: Appointment): boolean {
    const aptTime = new Date(apt.fecha + 'T' + (apt.hora || '00:00'));
    const now = new Date();
    return (now.getTime() - aptTime.getTime()) > 30 * 60 * 1000;
}

const WhatsAppConsole: React.FC = () => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [logs, setLogs] = useState<NotificationLog[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [pointsOfSale, setPointsOfSale] = useState<{ id: number; name: string }[]>([]);
    const [selectedBarberId, setSelectedBarberId] = useState<number>(0);
    const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    /** Clientes resueltos por ID cuando no están en la lista (ej. eliminados); evita "Desconocido". */
    const [resolvedClients, setResolvedClients] = useState<Record<number, Client | null>>({});
    /** Historial de envíos: abierto/cerrado. */
    const [historyOpen, setHistoryOpen] = useState(true);

    const refreshLogs = async () => {
        const list = await DataService.getNotificationLogs();
        setLogs(list.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
    };

    const isBarberUser = (currentUser?.role === 'barbero' || currentUser?.role === 'empleado');

    useEffect(() => {
        (async () => {
            const user = DataService.getCurrentUser();
            setCurrentUser(user);
            const [clientsList, barbersList, posList] = await Promise.all([
                DataService.getClients(),
                DataService.getBarbers(),
                DataService.getPointsOfSale(),
            ]);
            setClients(clientsList);
            setBarbers(barbersList);
            setPointsOfSale(posList);
            if (user && (user.role === 'barbero' || user.role === 'empleado')) {
                const myId = DataService.getCurrentBarberId() ?? barbersList.find(b => b.name === user.name)?.id;
                if (myId != null) setSelectedBarberId(myId);
            }
            await refreshLogs();
        })();
    }, []);

    useEffect(() => {
        (async () => {
            const all = await DataService.getAppointments();
            const filtered = all.filter(a => {
                if (a.fecha !== selectedDate) return false;
                if (selectedBarberId !== 0 && a.barberoId !== selectedBarberId) return false;
                return true;
            });
            setAppointments(filtered);
        })();
    }, [selectedBarberId, selectedDate]);

    // Resolver nombres de clientes que no están en la lista (cita o log con cliente eliminado)
    useEffect(() => {
        const aptIds = appointments.map(a => a.clienteId).filter(Boolean);
        const logIds = logs.map(l => l.clientId).filter(Boolean);
        const missingIds = [...new Set([...aptIds, ...logIds])].filter(id => !clients.some(c => c.id === id));
        if (missingIds.length === 0) {
            setResolvedClients(prev => (Object.keys(prev).length === 0 ? prev : {}));
            return;
        }
        (async () => {
            const results = await Promise.all(missingIds.map(id => DataService.getClientById(id)));
            setResolvedClients(prev => {
                const next = { ...prev };
                missingIds.forEach((id, i) => { next[id] = results[i] ?? null; });
                return next;
            });
        })();
    }, [appointments, logs, clients]);

    const getPosName = (posId: number) => pointsOfSale.find(p => p.id === posId)?.name || 'BarberShow';

    const buildMessage = (apt: Appointment, client: Client): string => {
        const posName = getPosName(apt.posId);
        const fechaStr = new Date(apt.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        return `Hola ${client.nombre}, recordatorio: tienes cita el ${fechaStr} a las ${apt.hora} en ${posName}. ¡Te esperamos!`;
    };

    const handleOpenWhatsApp = (apt: Appointment) => {
        const client = clients.find(c => c.id === apt.clienteId) ?? resolvedClients[apt.clienteId] ?? null;
        if (!client?.telefono) {
            alert(`${client?.nombre || 'Cliente desconocido'} no tiene número de teléfono registrado.`);
            return;
        }
        const msg = buildMessage(apt, client);
        const url = buildWhatsAppLink(client.telefono, msg);
        if (!url) {
            alert('Número de teléfono inválido.');
            return;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const handleCancelAppointment = async (apt: Appointment) => {
        if (!confirm('¿Cancelar esta cita?')) return;
        await DataService.updateAppointment({ ...apt, estado: 'cancelada' });
        const all = await DataService.getAppointments();
        const filtered = all.filter(a => {
            if (a.fecha !== selectedDate) return false;
            if (selectedBarberId !== 0 && a.barberoId !== selectedBarberId) return false;
            return true;
        });
        setAppointments(filtered);
    };

    const handleDeleteAppointment = async (apt: Appointment) => {
        if (!confirm('¿Eliminar esta cita de forma permanente?')) return;
        await DataService.deleteAppointment(apt.id);
        setAppointments(prev => prev.filter(a => a.id !== apt.id));
    };

    const estadoLabel: Record<string, string> = { pendiente: 'PENDIENTE', confirmada: 'CONFIRMADA', cancelada: 'CANCELADA', completada: 'COMPLETADA' };
    const estadoClass: Record<string, string> = {
        pendiente: 'bg-amber-100 text-amber-800',
        confirmada: 'bg-green-100 text-green-800',
        cancelada: 'bg-red-100 text-red-700',
        completada: 'bg-slate-100 text-slate-600',
    };

    const appointmentsWithClient = appointments
        .filter(apt => !isAppointmentPastThreshold(apt))
        .map(apt => ({
            apt,
            client: clients.find(c => c.id === apt.clienteId) ?? resolvedClients[apt.clienteId] ?? null,
            barber: barbers.find(b => b.id === apt.barberoId),
        }));

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                <MessageCircle className="mr-2" /> Consola de WhatsApp
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Filtros: día y barbero */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                        <Calendar size={20} className="mr-2 text-slate-500" /> Filtros
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Día</label>
                            <input
                                type="date"
                                className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-[#ffd427] focus:border-[#ffd427]"
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                            />
                        </div>
                        <div>
                            {isBarberUser ? (
                                <>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Envío por barbero</label>
                                    <div className="w-full border border-slate-200 rounded-lg p-2.5 bg-slate-50 text-slate-700 font-medium">
                                        Mis clientes agendados (solo citas conmigo)
                                    </div>
                                </>
                            ) : (
                                <>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Barbero</label>
                                    <select 
                                        className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-[#ffd427] focus:border-[#ffd427]"
                                        value={selectedBarberId}
                                        onChange={e => setSelectedBarberId(Number(e.target.value))}
                                    >
                                        <option value="0">Todos</option>
                                        {barbers.map(b => (
                                            <option key={b.id} value={b.id}>{b.name}</option>
                                        ))}
                                    </select>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Log Viewer - colapsable */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setHistoryOpen(prev => !prev)}
                        className="w-full p-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
                    >
                        <h3 className="text-lg font-bold text-slate-800 flex items-center">
                            <Clock size={20} className="mr-2 text-slate-500" /> Historial de Envíos
                            {logs.length > 0 && (
                                <span className="ml-2 text-sm font-normal text-slate-500">({logs.length})</span>
                            )}
                        </h3>
                        {historyOpen ? <ChevronUp size={20} className="text-slate-500" /> : <ChevronDown size={20} className="text-slate-500" />}
                    </button>
                    {historyOpen && (
                        <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar px-4 pb-4 min-h-[12rem] max-h-96">
                            {logs.length === 0 ? (
                                <div className="text-center text-slate-400 py-10">Sin registros recientes</div>
                            ) : (
                                logs.map(log => {
                                    const client = clients.find(c => c.id === log.clientId) ?? resolvedClients[log.clientId] ?? null;
                                    return (
                                        <div key={log.id} className="flex items-start p-3 bg-slate-50 rounded-lg border border-slate-100">
                                            <div className={`mt-1 mr-3 ${log.status === 'sent' ? 'text-green-500' : 'text-red-500'}`}>
                                                {log.status === 'sent' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-slate-800">Para: {client?.nombre || 'Cliente desconocido'}</p>
                                                <p className="text-xs text-slate-500 mb-1">{new Date(log.timestamp).toLocaleString()}</p>
                                                <p className="text-xs text-slate-600 italic">"{log.message}"</p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Lista de citas del día: abrir WhatsApp por cliente */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                    <MessageCircle size={20} className="mr-2 text-green-600" />
                    {isBarberUser ? 'Mis clientes agendados – Enviar desde tu WhatsApp' : 'Citas del día – Enviar desde tu WhatsApp'}
                </h3>
                {appointmentsWithClient.length === 0 ? (
                    <p className="text-slate-500 text-center py-6">
                        {isBarberUser ? 'No tienes citas agendadas para el día seleccionado.' : 'No hay citas para el día seleccionado.'}
                    </p>
                ) : (
                    <ul className="space-y-3">
                        {appointmentsWithClient
                            .sort((a, b) => a.apt.hora.localeCompare(b.apt.hora))
                            .map(({ apt, client, barber }) => {
                                const hasPhone = client?.telefono && phoneToWaNumber(client.telefono).length >= 10;
                                const serviceNames = (apt.servicios && apt.servicios.length)
                                    ? apt.servicios.map(s => s.name).join(', ')
                                    : '—';
                                const estado = apt.estado || 'pendiente';
                                return (
                                    <li
                                        key={apt.id}
                                        className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2 mb-2">
                                                    <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium">
                                                        <Clock size={16} className="text-slate-500 shrink-0" />
                                                        {apt.hora}
                                                    </span>
                                                    <span className={`text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded ${estadoClass[estado] || estadoClass.pendiente}`}>
                                                        {estadoLabel[estado] || estado}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-slate-800 font-medium">
                                                    <User size={16} className="text-slate-500 shrink-0" />
                                                    {client?.nombre ?? 'Cliente desconocido'}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-slate-600 text-sm mt-0.5">
                                                    <Scissors size={14} className="text-slate-400 shrink-0" />
                                                    {serviceNames}
                                                </div>
                                                <p className="text-sm text-slate-500 mt-0.5">Barbero: {barber?.name ?? '—'}</p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenWhatsApp(apt)}
                                                    disabled={!hasPhone}
                                                    title={hasPhone ? 'Abrir WhatsApp' : 'Sin teléfono'}
                                                    className="p-2.5 rounded-lg border-2 border-green-400 text-green-600 hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400 transition-colors"
                                                >
                                                    <MessageCircle size={22} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => apt.estado === 'cancelada' ? handleDeleteAppointment(apt) : handleCancelAppointment(apt)}
                                                    title={apt.estado === 'cancelada' ? 'Eliminar cita' : 'Cancelar cita'}
                                                    className="p-2.5 rounded-lg border-2 border-slate-200 text-slate-500 hover:bg-slate-100 hover:border-slate-300 transition-colors"
                                                >
                                                    <Trash2 size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    </li>
                                );
                            })}
                    </ul>
                )}
            </div>
        </div>
    );
};

export default WhatsAppConsole;