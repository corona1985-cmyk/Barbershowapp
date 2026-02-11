import React, { useState, useEffect } from 'react';
import { DataService } from '../services/data';
import { Appointment, Barber, Client, NotificationLog } from '../types';
import { MessageCircle, Send, CheckCircle, AlertCircle, Clock } from 'lucide-react';

const WhatsAppConsole: React.FC = () => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [logs, setLogs] = useState<NotificationLog[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [selectedBarberId, setSelectedBarberId] = useState<number>(0);
    const [sending, setSending] = useState(false);

    const refreshLogs = async () => {
        const list = await DataService.getNotificationLogs();
        setLogs(list.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
    };

    useEffect(() => {
        (async () => {
            const user = DataService.getCurrentUser();
            setCurrentUser(user);
            const [clientsList, barbersList] = await Promise.all([DataService.getClients(), DataService.getBarbers()]);
            setClients(clientsList);
            setBarbers(barbersList);
            if (user && user.role === 'empleado') {
                const barber = barbersList.find(b => b.name === user.name);
                if (barber) setSelectedBarberId(barber.id);
            }
            await refreshLogs();
        })();
    }, []);

    useEffect(() => {
        (async () => {
            const today = new Date().toISOString().split('T')[0];
            const all = await DataService.getAppointments();
            const filtered = all.filter(a =>
                a.fecha === today && a.estado === 'confirmada' && (selectedBarberId === 0 || a.barberoId === selectedBarberId)
            );
            setAppointments(filtered);
        })();
    }, [selectedBarberId]);

    const handleSendBatch = async () => {
        if (!confirm(`¿Enviar recordatorios a ${appointments.length} clientes?`)) return;
        setSending(true);
        let sentCount = 0;
        for (const apt of appointments) {
            const client = clients.find(c => c.id === apt.clienteId);
            if (!client || !client.whatsappOptIn) continue;
            const msg = `Hola ${client.nombre}, recordatorio de su cita hoy a las ${apt.hora} en BarberShow.`;
            await new Promise(r => setTimeout(r, 500));
            await DataService.logNotification({
                posId: DataService.getActivePosId() || 0,
                barberId: apt.barberoId,
                clientId: apt.clienteId,
                type: 'whatsapp',
                status: 'sent',
                timestamp: new Date().toISOString(),
                message: msg
            });
            sentCount++;
        }
        setSending(false);
        await refreshLogs();
        alert(`Se enviaron ${sentCount} recordatorios exitosamente.`);
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                <MessageCircle className="mr-2" /> Consola de WhatsApp (Beta)
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Control Panel */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                        <Send size={20} className="mr-2 text-[#ffd427]" /> Envío Masivo
                    </h3>
                    
                    <div className="mb-6">
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

                    <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 mb-6">
                        <p className="text-yellow-800 font-medium">Citas para hoy encontradas: <span className="text-2xl font-bold block mt-1">{appointments.length}</span></p>
                    </div>

                    <button 
                        onClick={handleSendBatch}
                        disabled={sending || appointments.length === 0}
                        className={`w-full py-3 rounded-lg font-bold shadow-md transition-all flex justify-center items-center ${
                            sending || appointments.length === 0 
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed' 
                            : 'bg-[#ffd427] hover:bg-[#e6be23] text-slate-900'
                        }`}
                    >
                        {sending ? 'Enviando...' : 'Enviar Recordatorios Ahora'}
                    </button>
                    <p className="text-xs text-slate-400 mt-2 text-center">Solo se enviará a clientes con Opt-In activado.</p>
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
        </div>
    );
};

export default WhatsAppConsole;