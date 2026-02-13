import React, { useEffect, useState } from 'react';
import { DataService } from '../services/data';
import { ViewState } from '../types';
import { Users, Calendar, ShoppingBag, AlertTriangle, TrendingUp, Clock, Loader2 } from 'lucide-react';

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

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const [clients, appointments, sales, products] = await Promise.all([
                DataService.getClients(),
                DataService.getAppointments(),
                DataService.getSales(),
                DataService.getProducts(),
            ]);
            const todayStr = new Date().toISOString().split('T')[0];
            const todayAppointments = appointments.filter(a => a.fecha === todayStr && a.estado !== 'cancelada');
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

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Acciones Rápidas</h3>
                    <div className="space-y-3">
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
    );
};

export default Dashboard;