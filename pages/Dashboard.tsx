import React, { useEffect, useState } from 'react';
import { DataService } from '../services/data';
import { ViewState, Appointment, Client, PointOfSale } from '../types';
import { Users, Calendar, ShoppingBag, AlertTriangle, TrendingUp, Clock, Loader2, MessageCircle } from 'lucide-react';

/** Teléfono a formato wa.me (solo dígitos; 10 dígitos sin + → prefijo 52) */
function phoneToWa(phone: string): string {
    const d = (phone || '').replace(/\D/g, '');
    if (d.length === 10 && !phone?.startsWith('+')) return '52' + d;
    return d;
}

function buildWaLink(phone: string, message: string): string {
    const num = phoneToWa(phone);
    if (!num || num.length < 10) return '';
    return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

interface DashboardProps {
    onChangeView: (view: ViewState) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onChangeView }) => {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        clients: 0,
        appointmentsToday: 0,
        salesToday: 0,
        lowStock: 0
    });
    const [activities, setActivities] = useState<any[]>([]);
    const [nextAppointment, setNextAppointment] = useState<{ apt: Appointment; client: Client } | null>(null);
    const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([]);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const barberId = DataService.getCurrentBarberId();
                const productsLoader = barberId != null ? DataService.getProducts(barberId) : DataService.getProducts();
                const [clients, appointments, sales, products, posList] = await Promise.all([
                    DataService.getClients(),
                    DataService.getAppointments(),
                    DataService.getSales(),
                    productsLoader,
                    DataService.getPointsOfSale(),
                ]);
                setPointsOfSale(posList);
                const todayStr = new Date().toISOString().split('T')[0];
                const todayAppointments = appointments
                    .filter(a => a.fecha === todayStr && a.estado !== 'cancelada' && a.estado !== 'completada')
                    .sort((a, b) => a.hora.localeCompare(b.hora));
                const now = new Date();
                const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                const listForUser = barberId != null ? todayAppointments.filter(a => a.barberoId === barberId) : todayAppointments;
                const next = listForUser.find(a => a.hora >= currentTime) || listForUser[0] || null;
                if (next) {
                    const client = clients.find(c => c.id === next.clienteId);
                    if (client) setNextAppointment({ apt: next, client });
                    else setNextAppointment(null);
                } else setNextAppointment(null);

                const todaySales = sales.filter(s => s.fecha === todayStr).reduce((sum, s) => sum + s.total, 0);
                const lowStock = products.filter(p => p.stock < 5).length;
                setStats({
                    clients: clients.length,
                    appointmentsToday: todayAppointments.length,
                    salesToday: todaySales,
                    lowStock
                });
                const recentSales = sales.slice(-3).map(s => ({
                    type: 'sale',
                    text: `Venta #${s.numeroVenta}`,
                    time: s.hora,
                    amount: s.total
                }));
                setActivities(recentSales.reverse());
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                <Loader2 className="animate-spin mb-4" size={48} />
                <p className="font-medium">Cargando panel...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">Panel de Control</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4 hover:shadow-md transition-shadow">
                    <div className="p-3 bg-yellow-100 text-yellow-700 rounded-full">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Clientes Totales</p>
                        <h3 className="text-2xl font-bold text-slate-800">{stats.clients}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4 hover:shadow-md transition-shadow">
                    <div className="p-3 bg-orange-100 text-orange-600 rounded-full">
                        <Calendar size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Citas Hoy</p>
                        <h3 className="text-2xl font-bold text-slate-800">{stats.appointmentsToday}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4 hover:shadow-md transition-shadow">
                    <div className="p-3 bg-amber-100 text-amber-600 rounded-full">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Ventas Hoy</p>
                        <h3 className="text-2xl font-bold text-slate-800">${stats.salesToday.toFixed(2)}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4 hover:shadow-md transition-shadow">
                    <div className="p-3 bg-red-100 text-red-600 rounded-full">
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">Stock Bajo</p>
                        <h3 className="text-2xl font-bold text-slate-800">{stats.lowStock}</h3>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Actividad Reciente</h3>
                    <div className="space-y-4">
                        {activities.length > 0 ? activities.map((act, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                <div className="flex items-center space-x-3">
                                    <div className="p-2 bg-yellow-100 text-yellow-700 rounded-full">
                                        <ShoppingBag size={18} />
                                    </div>
                                    <div>
                                        <p className="font-medium text-slate-800">{act.text}</p>
                                        <p className="text-xs text-slate-500 flex items-center"><Clock size={12} className="mr-1"/> {act.time}</p>
                                    </div>
                                </div>
                                <span className="font-bold text-green-600">+${act.amount.toFixed(2)}</span>
                            </div>
                        )) : (
                            <p className="text-slate-500 text-sm">No hay actividad reciente.</p>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
                    {nextAppointment && (
                        <div className="pb-4 border-b border-slate-100">
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Siguiente cita</h3>
                            <p className="font-semibold text-slate-800">{nextAppointment.client.nombre}</p>
                            <p className="text-sm text-slate-600 flex items-center mt-1">
                                <Clock size={14} className="mr-1.5" /> {nextAppointment.apt.hora}
                            </p>
                            <button
                                type="button"
                                onClick={() => {
                                    const posName = pointsOfSale.find(p => p.id === nextAppointment.apt.posId)?.name || 'BarberShow';
                                    const fechaStr = new Date(nextAppointment.apt.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
                                    const msg = `Hola ${nextAppointment.client.nombre}, recordatorio: tienes cita el ${fechaStr} a las ${nextAppointment.apt.hora} en ${posName}. ¡Te esperamos!`;
                                    const url = buildWaLink(nextAppointment.client.telefono, msg);
                                    if (url) window.open(url, '_blank', 'noopener,noreferrer');
                                    else alert('Este cliente no tiene un número de WhatsApp válido.');
                                }}
                                disabled={!nextAppointment.client.telefono || phoneToWa(nextAppointment.client.telefono).length < 10}
                                className="mt-3 w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold bg-green-600 text-white hover:bg-green-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
                            >
                                <MessageCircle size={20} />
                                Enviar recordatorio al próximo cliente
                            </button>
                            <p className="text-xs text-slate-500 mt-2">Se abrirá WhatsApp con el mensaje listo. Envías desde tu número.</p>
                        </div>
                    )}
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 mb-4">Acciones Rápidas</h3>
                        <div className="space-y-3">
                            <button
                                type="button"
                                onClick={() => {
                                    if (!nextAppointment) return;
                                    const posName = pointsOfSale.find(p => p.id === nextAppointment.apt.posId)?.name || 'BarberShow';
                                    const fechaStr = new Date(nextAppointment.apt.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
                                    const msg = `Hola ${nextAppointment.client.nombre}, recordatorio: tienes cita el ${fechaStr} a las ${nextAppointment.apt.hora} en ${posName}. ¡Te esperamos!`;
                                    const url = buildWaLink(nextAppointment.client.telefono, msg);
                                    if (url) window.open(url, '_blank', 'noopener,noreferrer');
                                    else alert('Este cliente no tiene un número de WhatsApp válido.');
                                }}
                                disabled={!nextAppointment || !nextAppointment.client.telefono || phoneToWa(nextAppointment.client.telefono).length < 10}
                                className="w-full flex items-center justify-between p-4 bg-green-50 hover:bg-green-100 text-green-800 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-green-50"
                            >
                                <span>Enviar recordatorio al próximo cliente</span>
                                <MessageCircle size={20} />
                            </button>
                            <button onClick={() => onChangeView('sales')} className="w-full flex items-center justify-between p-4 bg-yellow-50 hover:bg-yellow-100 text-yellow-800 rounded-lg transition-colors font-medium">
                                <span>Nueva Venta</span>
                                <ShoppingBag size={20} />
                            </button>
                            <button onClick={() => onChangeView('appointments')} className="w-full flex items-center justify-between p-4 bg-orange-50 hover:bg-orange-100 text-orange-800 rounded-lg transition-colors font-medium">
                                <span>Agendar Cita</span>
                                <Calendar size={20} />
                            </button>
                            <button onClick={() => onChangeView('clients')} className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors font-medium">
                                <span>Registrar Cliente</span>
                                <Users size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;