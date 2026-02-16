import React, { useState, useEffect } from 'react';
import { DataService } from '../services/data';
import { sendWhatsAppFromApp } from '../services/firebase';
import { Appointment, Barber, Client, NotificationLog } from '../types';
import { MessageCircle, Send, CheckCircle, AlertCircle, Clock, Calendar, ExternalLink, Smartphone } from 'lucide-react';

/** Normaliza teléfono para enlace wa.me: solo dígitos; si tiene 10 dígitos (México) añade 52 */
function phoneToWaNumber(phone: string): string {
    const digits = (phone || '').replace(/\D/g, '');
    if (digits.length === 10 && !phone?.startsWith('+')) return '52' + digits;
    return digits;
}

/** Genera enlace WhatsApp con mensaje prellenado */
function buildWhatsAppLink(phone: string, message: string): string {
    const num = phoneToWaNumber(phone);
    if (!num || num.length < 10) return '';
    return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
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
    const [sending, setSending] = useState(false);
    const [sendingViaApi, setSendingViaApi] = useState(false);
    const [apiError, setApiError] = useState<string | null>(null);

    const refreshLogs = async () => {
        const list = await DataService.getNotificationLogs();
        setLogs(list.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
    };

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
            if (user && user.role === 'barbero') {
                const barber = barbersList.find(b => b.name === user.name);
                if (barber) setSelectedBarberId(barber.id);
            }
            await refreshLogs();
        })();
    }, []);

    useEffect(() => {
        (async () => {
            const all = await DataService.getAppointments();
            const filtered = all.filter(a => {
                if (a.fecha !== selectedDate) return false;
                if (a.estado === 'cancelada' || a.estado === 'completada') return false;
                if (selectedBarberId !== 0 && a.barberoId !== selectedBarberId) return false;
                return true;
            });
            setAppointments(filtered);
        })();
    }, [selectedBarberId, selectedDate]);

    const getPosName = (posId: number) => pointsOfSale.find(p => p.id === posId)?.name || 'BarberShow';

    const buildMessage = (apt: Appointment, client: Client): string => {
        const posName = getPosName(apt.posId);
        const fechaStr = new Date(apt.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        return `Hola ${client.nombre}, recordatorio: tienes cita el ${fechaStr} a las ${apt.hora} en ${posName}. ¡Te esperamos!`;
    };

    const handleOpenWhatsApp = (apt: Appointment) => {
        const client = clients.find(c => c.id === apt.clienteId);
        if (!client?.telefono) {
            alert(`${client?.nombre || 'Cliente'} no tiene número de teléfono registrado.`);
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

    const handleOpenAllWhatsApp = () => {
        const withPhone = appointments.filter(apt => {
            const client = clients.find(c => c.id === apt.clienteId);
            return client?.telefono && phoneToWaNumber(client.telefono).length >= 10;
        });
        if (withPhone.length === 0) {
            alert('Ningún cliente con cita tiene número de WhatsApp válido.');
            return;
        }
        withPhone.forEach((apt, i) => {
            const client = clients.find(c => c.id === apt.clienteId)!;
            const url = buildWhatsAppLink(client.telefono!, buildMessage(apt, client));
            setTimeout(() => window.open(url, '_blank', 'noopener,noreferrer'), i * 1500);
        });
        alert(`Se abrirán ${withPhone.length} conversaciones de WhatsApp (una cada 1.5 s para evitar bloqueos). Acepta las ventanas emergentes si el navegador lo pide.`);
    };

    const handleSendBatch = async () => {
        if (!confirm(`¿Abrir WhatsApp y registrar recordatorios para las citas del día? (Se abrirá una ventana por cada cliente con teléfono)`)) return;
        setSending(true);
        let sentCount = 0;
        for (const apt of appointments) {
            const client = clients.find(c => c.id === apt.clienteId);
            if (!client?.telefono) continue;
            const msg = buildMessage(apt, client);
            const url = buildWhatsAppLink(client.telefono, msg);
            if (url) {
                window.open(url, '_blank', 'noopener,noreferrer');
                sentCount++;
                await new Promise(r => setTimeout(r, 800));
                await DataService.logNotification({
                    posId: DataService.getActivePosId() || 0,
                    barberId: apt.barberoId,
                    clientId: apt.clienteId,
                    type: 'whatsapp',
                    status: 'sent',
                    timestamp: new Date().toISOString(),
                    message: msg
                });
            }
        }
        setSending(false);
        await refreshLogs();
        alert(sentCount ? `Se abrieron ${sentCount} chats de WhatsApp y se registró el envío. Envía el mensaje en cada ventana.` : 'Ningún cliente con cita tiene teléfono registrado.');
    };

    /** Envía los recordatorios directamente desde la app (Cloud Function + Twilio). */
    const handleSendViaApi = async () => {
        const withPhone = appointments.filter(apt => {
            const client = clients.find(c => c.id === apt.clienteId);
            return client?.telefono && phoneToWaNumber(client.telefono).length >= 10;
        });
        if (withPhone.length === 0) {
            alert('Ningún cliente con cita tiene teléfono válido.');
            return;
        }
        if (!confirm(`¿Enviar ${withPhone.length} recordatorios por WhatsApp desde la app? (Requiere tener Twilio configurado)`)) return;
        setApiError(null);
        setSendingViaApi(true);
        let ok = 0;
        let fail = 0;
        for (const apt of withPhone) {
            const client = clients.find(c => c.id === apt.clienteId)!;
            const msg = buildMessage(apt, client);
            try {
                await sendWhatsAppFromApp(client.telefono!, msg);
                ok++;
                await DataService.logNotification({
                    posId: DataService.getActivePosId() || 0,
                    barberId: apt.barberoId,
                    clientId: apt.clienteId,
                    type: 'whatsapp',
                    status: 'sent',
                    timestamp: new Date().toISOString(),
                    message: msg
                });
            } catch (e: unknown) {
                fail++;
                const errMsg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : String(e);
                setApiError(errMsg);
                await DataService.logNotification({
                    posId: DataService.getActivePosId() || 0,
                    barberId: apt.barberoId,
                    clientId: apt.clienteId,
                    type: 'whatsapp',
                    status: 'failed',
                    timestamp: new Date().toISOString(),
                    message: msg
                });
            }
            await new Promise(r => setTimeout(r, 300));
        }
        setSendingViaApi(false);
        await refreshLogs();
        if (fail === 0) alert(`Se enviaron ${ok} mensajes por WhatsApp desde la app.`);
        else alert(`Enviados: ${ok}. Fallos: ${fail}. Revisa la consola o configuración de Twilio.`);
    };

    const appointmentsWithClient = appointments.map(apt => ({
        apt,
        client: clients.find(c => c.id === apt.clienteId),
        barber: barbers.find(b => b.id === apt.barberoId),
    })).filter(x => x.client);

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                <MessageCircle className="mr-2" /> Consola de WhatsApp
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Opción C: Enviar a todos y registrar en historial */}
                <div className="bg-white p-6 rounded-xl shadow-sm border-2 border-green-200 border-t-4 border-t-green-500">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center">
                            <Send size={20} className="mr-2 text-green-600" /> Enviar recordatorios a todos
                        </h3>
                        <span className="text-xs font-bold uppercase tracking-wider text-green-600 bg-green-50 px-2 py-1 rounded">Desde tu número</span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center">
                                <Calendar size={16} className="mr-1" /> Día de las citas
                            </label>
                            <input
                                type="date"
                                className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-[#ffd427] focus:border-[#ffd427]"
                                value={selectedDate}
                                onChange={e => setSelectedDate(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Filtrar por Barbero</label>
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
                        </div>
                    </div>

                    <div className="bg-green-50 p-4 rounded-lg border border-green-100 mb-6">
                        <p className="text-green-800 font-medium">
                            Citas del día: <span className="text-2xl font-bold block mt-1">{appointments.length}</span>
                        </p>
                        <p className="text-xs text-green-700 mt-1">Se abre WhatsApp con el mensaje listo. Tú envías desde <strong>tu número</strong> (el cliente recibe el mensaje de tu WhatsApp).</p>
                    </div>

                    <button 
                        onClick={handleSendBatch}
                        disabled={sending || appointments.length === 0}
                        className={`w-full py-4 rounded-xl font-bold shadow-lg transition-all flex justify-center items-center gap-2 ${
                            sending || appointments.length === 0 
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                            : 'bg-green-600 hover:bg-green-700 text-white hover:shadow-green-300/50'
                        }`}
                    >
                        <MessageCircle size={22} />
                        {sending ? 'Abriendo WhatsApp...' : 'Abrir mi WhatsApp y enviar a todos'}
                    </button>
                    <p className="text-xs text-slate-500 mt-2 text-center">
                        Se abrirá una ventana por cada cliente. Solo tienes que pulsar Enviar en tu WhatsApp.
                    </p>

                    {/* Opcional: envío desde número de negocio (Twilio) */}
                    <div className="mt-6 pt-6 border-t border-slate-200">
                        <h4 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                            <Smartphone size={18} className="text-slate-500" /> Opcional: desde número de negocio (Twilio)
                        </h4>
                        <p className="text-xs text-slate-500 mb-3">
                            Los mensajes se envían solos desde un número de negocio. Requiere configurar Twilio y la Cloud Function.
                        </p>
                        {apiError && (
                            <p className="text-xs text-red-600 mb-2 bg-red-50 p-2 rounded">{apiError}</p>
                        )}
                        <button
                            type="button"
                            onClick={handleSendViaApi}
                            disabled={sendingViaApi || appointments.length === 0}
                            className={`w-full py-3 rounded-lg font-bold shadow-md transition-all flex justify-center items-center gap-2 ${
                                sendingViaApi || appointments.length === 0
                                    ? 'bg-slate-200 text-slate-500 cursor-not-allowed'
                                    : 'bg-slate-700 hover:bg-slate-800 text-white'
                            }`}
                        >
                            <Send size={18} />
                            {sendingViaApi ? 'Enviando...' : 'Enviar desde número de negocio'}
                        </button>
                    </div>
                </div>

                {/* Log Viewer */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col h-96">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                        <Clock size={20} className="mr-2 text-slate-500" /> Historial de Envíos
                    </h3>
                    <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                        {logs.length === 0 ? (
                            <div className="text-center text-slate-400 mt-10">Sin registros recientes</div>
                        ) : (
                            logs.map(log => {
                                const client = clients.find(c => c.id === log.clientId);
                                return (
                                    <div key={log.id} className="flex items-start p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <div className={`mt-1 mr-3 ${log.status === 'sent' ? 'text-green-500' : 'text-red-500'}`}>
                                            {log.status === 'sent' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-slate-800">Para: {client?.nombre || 'Desconocido'}</p>
                                            <p className="text-xs text-slate-500 mb-1">{new Date(log.timestamp).toLocaleString()}</p>
                                            <p className="text-xs text-slate-600 italic">"{log.message}"</p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* Lista de citas del día: abrir WhatsApp por cliente */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                    <MessageCircle size={20} className="mr-2 text-green-600" /> Citas del día – Enviar desde tu WhatsApp
                </h3>
                {appointmentsWithClient.length === 0 ? (
                    <p className="text-slate-500 text-center py-6">No hay citas agendadas para el día seleccionado (pendientes o confirmadas).</p>
                ) : (
                    <>
                        <div className="flex flex-wrap gap-2 mb-4">
                            <button
                                type="button"
                                onClick={handleOpenAllWhatsApp}
                                disabled={appointmentsWithClient.filter(x => x.client?.telefono && phoneToWaNumber(x.client.telefono).length >= 10).length === 0}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
                            >
                                <ExternalLink size={18} />
                                Abrir mi WhatsApp para todos (uno por uno)
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 text-slate-600 font-semibold text-left">
                                        <th className="py-3 pr-4">Cliente</th>
                                        <th className="py-3 pr-4">Teléfono</th>
                                        <th className="py-3 pr-4">Hora</th>
                                        <th className="py-3 pr-4">Barbero</th>
                                        <th className="py-3 text-right">Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {appointmentsWithClient
                                        .sort((a, b) => a.apt.hora.localeCompare(b.apt.hora))
                                        .map(({ apt, client, barber }) => {
                                            const hasPhone = client?.telefono && phoneToWaNumber(client.telefono).length >= 10;
                                            return (
                                                <tr key={apt.id} className="border-b border-slate-100 hover:bg-slate-50">
                                                    <td className="py-3 pr-4 font-medium text-slate-800">{client?.nombre}</td>
                                                    <td className="py-3 pr-4 text-slate-600">{client?.telefono || '—'}</td>
                                                    <td className="py-3 pr-4">{apt.hora}</td>
                                                    <td className="py-3 pr-4">{barber?.name || '—'}</td>
                                                    <td className="py-3 text-right">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenWhatsApp(apt)}
                                                            disabled={!hasPhone}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors text-xs"
                                                        >
                                                            <ExternalLink size={14} />
                                                            Abrir mi WhatsApp
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default WhatsAppConsole;