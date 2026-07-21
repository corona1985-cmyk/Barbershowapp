import React, { useEffect, useState, useCallback } from 'react';
import { DataService } from '../services/data';
import { ViewState, Appointment, Client, PointOfSale } from '../types';
import { Users, Calendar, ShoppingBag, AlertTriangle, TrendingUp, Clock, Loader2, MessageCircle } from 'lucide-react';
import { useTranslation } from '../i18n';

function phoneToWa(phone: string | number | null | undefined): string {
    return String(phone ?? '').replace(/\D/g, '');
}

function buildWaLink(phone: string | number | null | undefined, message: string): string {
    const num = phoneToWa(phone);
    if (!num || num.length < 10) return '';
    return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

interface DashboardProps {
    onChangeView: (view: ViewState) => void;
}

const LOAD_TIMEOUT_MS = 22000;

const Dashboard: React.FC<DashboardProps> = ({ onChangeView }) => {
    const { t, formatDate } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [stats, setStats] = useState({
        clients: 0,
        appointmentsToday: 0,
        salesToday: 0,
        lowStock: 0
    });
    const [activities, setActivities] = useState<any[]>([]);
    const [nextAppointment, setNextAppointment] = useState<{ apt: Appointment; client: Client } | null>(null);
    const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([]);

    const loadData = useCallback(async () => {
        setLoadError(false);
        setLoading(true);
        try {
            const barberId = DataService.getCurrentBarberId();
            const productsLoader = barberId != null ? DataService.getProducts(barberId) : DataService.getProducts();
            const loadPromise = Promise.all([
                DataService.getClients(),
                DataService.getAppointments(),
                DataService.getSales(),
                productsLoader,
                DataService.getPointsOfSale(),
            ]);
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(t('common.timeout'))), LOAD_TIMEOUT_MS)
            );
            const [clients, appointments, sales, products, posList] = await Promise.race([loadPromise, timeoutPromise]);
            const clientsSafe = Array.isArray(clients) ? clients : [];
            const appointmentsSafe = Array.isArray(appointments) ? appointments : [];
            const salesSafe = Array.isArray(sales) ? sales : [];
            const productsSafe = Array.isArray(products) ? products : [];
            const posListSafe = Array.isArray(posList) ? posList : [];
            setPointsOfSale(posListSafe);
            const todayStr = new Date().toISOString().split('T')[0];
            const todayAppointments = appointmentsSafe
                .filter(a => a.fecha === todayStr && a.estado !== 'cancelada' && a.estado !== 'completada')
                .sort((a, b) => a.hora.localeCompare(b.hora));
            const now = new Date();
            const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            const listForUser = barberId != null ? todayAppointments.filter(a => a.barberoId === barberId) : todayAppointments;
            const next = listForUser.find(a => a.hora >= currentTime) || listForUser[0] || null;
            if (next) {
                const client = clientsSafe.find(c => c.id === next.clienteId);
                if (client) setNextAppointment({ apt: next, client });
                else setNextAppointment(null);
            } else setNextAppointment(null);

            const todaySales = salesSafe.filter(s => s.fecha === todayStr).reduce((sum, s) => sum + s.total, 0);
            const lowStock = productsSafe.filter(p => p.stock < 5).length;
            setStats({
                clients: clientsSafe.length,
                appointmentsToday: todayAppointments.length,
                salesToday: todaySales,
                lowStock
            });
            const recentSales = salesSafe.slice(-3).map(s => ({
                type: 'sale',
                text: t('dashboard.saleNumber', { number: s.numeroVenta }),
                time: s.hora,
                amount: s.total
            }));
            setActivities(recentSales.reverse());
        } catch (err) {
            console.error('Error cargando panel:', err);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, [t]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const openReminder = () => {
        if (!nextAppointment) return;
        const posName = pointsOfSale.find(p => p.id === nextAppointment.apt.posId)?.name || t('common.barberShow');
        const fechaStr = formatDate(nextAppointment.apt.fecha + 'T12:00:00', { weekday: 'long', day: 'numeric', month: 'long' });
        const msg = t('dashboard.reminderMessage', {
            name: nextAppointment.client.nombre,
            date: fechaStr,
            time: nextAppointment.apt.hora,
            shop: posName,
        });
        const url = buildWaLink(nextAppointment.client.telefono, msg);
        if (url) window.open(url, '_blank', 'noopener,noreferrer');
        else alert(t('dashboard.invalidWhatsApp'));
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                <Loader2 className="animate-spin mb-4" size={48} />
                <p className="font-medium">{t('dashboard.loading')}</p>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-slate-600 max-w-md mx-auto text-center px-4">
                <p className="font-medium mb-2">{t('dashboard.loadFailed')}</p>
                <p className="text-sm text-slate-500 mb-6">{t('common.connectionHint')}</p>
                <button
                    type="button"
                    onClick={() => loadData()}
                    className="bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-semibold px-6 py-3 rounded-xl"
                >
                    {t('common.retry')}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800">{t('dashboard.title')}</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4 hover:shadow-md transition-shadow">
                    <div className="p-3 bg-yellow-100 text-yellow-700 rounded-full">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">{t('dashboard.totalClients')}</p>
                        <h3 className="text-2xl font-bold text-slate-800">{stats.clients}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4 hover:shadow-md transition-shadow">
                    <div className="p-3 bg-orange-100 text-orange-600 rounded-full">
                        <Calendar size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">{t('dashboard.appointmentsToday')}</p>
                        <h3 className="text-2xl font-bold text-slate-800">{stats.appointmentsToday}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4 hover:shadow-md transition-shadow">
                    <div className="p-3 bg-amber-100 text-amber-600 rounded-full">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">{t('dashboard.salesToday')}</p>
                        <h3 className="text-2xl font-bold text-slate-800">${stats.salesToday.toFixed(2)}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center space-x-4 hover:shadow-md transition-shadow">
                    <div className="p-3 bg-red-100 text-red-600 rounded-full">
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <p className="text-sm text-slate-500 font-medium">{t('dashboard.lowStock')}</p>
                        <h3 className="text-2xl font-bold text-slate-800">{stats.lowStock}</h3>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">{t('dashboard.recentActivity')}</h3>
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
                            <p className="text-slate-500 text-sm">{t('dashboard.noActivity')}</p>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
                    {nextAppointment && (
                        <div className="pb-4 border-b border-slate-100">
                            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">{t('dashboard.nextAppointment')}</h3>
                            <p className="font-semibold text-slate-800">{nextAppointment.client.nombre}</p>
                            <p className="text-sm text-slate-600 flex items-center mt-1">
                                <Clock size={14} className="mr-1.5" /> {nextAppointment.apt.hora}
                            </p>
                            <button
                                type="button"
                                onClick={openReminder}
                                disabled={!nextAppointment.client.telefono || phoneToWa(nextAppointment.client.telefono).length < 10}
                                className="mt-3 w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-bold bg-green-600 text-white hover:bg-green-700 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
                            >
                                <MessageCircle size={20} />
                                {t('dashboard.sendReminder')}
                            </button>
                            <p className="text-xs text-slate-500 mt-2">{t('dashboard.reminderHint')}</p>
                        </div>
                    )}
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 mb-4">{t('dashboard.quickActions')}</h3>
                        <div className="space-y-3">
                            <button
                                type="button"
                                onClick={openReminder}
                                disabled={!nextAppointment || !nextAppointment.client.telefono || phoneToWa(nextAppointment.client.telefono).length < 10}
                                className="w-full flex items-center justify-between p-4 bg-green-50 hover:bg-green-100 text-green-800 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-green-50"
                            >
                                <span>{t('dashboard.sendReminder')}</span>
                                <MessageCircle size={20} />
                            </button>
                            <button onClick={() => onChangeView('sales')} className="w-full flex items-center justify-between p-4 bg-yellow-50 hover:bg-yellow-100 text-yellow-800 rounded-lg transition-colors font-medium">
                                <span>{t('dashboard.newSale')}</span>
                                <ShoppingBag size={20} />
                            </button>
                            <button onClick={() => onChangeView('appointments')} className="w-full flex items-center justify-between p-4 bg-orange-50 hover:bg-orange-100 text-orange-800 rounded-lg transition-colors font-medium">
                                <span>{t('dashboard.bookAppointment')}</span>
                                <Calendar size={20} />
                            </button>
                            <button onClick={() => onChangeView('clients')} className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg transition-colors font-medium">
                                <span>{t('dashboard.registerClient')}</span>
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
