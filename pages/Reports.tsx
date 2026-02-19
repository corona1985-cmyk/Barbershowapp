import React, { useEffect, useState } from 'react';
import { DataService } from '../services/data';
import { Sale, Appointment, Product, Client, Barber, AccountTier, PointOfSale } from '../types';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, Calendar, ShoppingBag, Printer, Scissors, MapPin, Loader2 } from 'lucide-react';
import { handlePrint } from '../utils/print';

const COLORS = ['#ffd427', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

interface ReportsProps {
    accountTier?: AccountTier;
    posListForOwner?: PointOfSale[];
}

const Reports: React.FC<ReportsProps> = ({ accountTier = 'solo', posListForOwner = [] }) => {
    const [sales, setSales] = useState<Sale[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [salesByPos, setSalesByPos] = useState<{ posId: number; posName: string; total: number; count: number }[]>([]);
    const [activePosId, setActivePosId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);

    const isSolo = accountTier === 'solo';
    const showPorBarbero = accountTier === 'barberia' || accountTier === 'multisede';
    const showPorSede = accountTier === 'multisede' && posListForOwner.length > 1;
    const noSedeActiva = activePosId === null;

    const loadMainData = React.useCallback(() => {
        setLoadError(null);
        setLoading(true);
        setActivePosId(DataService.getActivePosId());
        const barberId = DataService.getCurrentUserRole() === 'barbero' ? DataService.getCurrentBarberId() ?? undefined : undefined;
        Promise.all([
            DataService.getSales(),
            DataService.getAppointments(),
            DataService.getProducts(barberId),
            DataService.getClients(),
        ])
            .then(([s, a, p, c]) => {
                setSales(s);
                setAppointments(a);
                setProducts(p);
                setClients(c);
                setActivePosId(DataService.getActivePosId());
            })
            .catch((err) => {
                setLoadError(err instanceof Error ? err.message : 'No se pudieron cargar los reportes.');
            })
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        loadMainData();
    }, [loadMainData]);

    useEffect(() => {
        if (showPorBarbero) {
            DataService.getBarbers().then(setBarbers).catch(() => {});
        }
    }, [showPorBarbero]);

    useEffect(() => {
        if (!showPorSede || posListForOwner.length === 0) return;
        (async () => {
            try {
                const rows = await Promise.all(
                    posListForOwner.map(async (pos) => {
                        const [s, a] = await Promise.all([
                            DataService.getSalesForPos(pos.id),
                            DataService.getAppointmentsForPos(pos.id),
                        ]);
                        const total = s.reduce((sum, sale) => sum + sale.total, 0);
                        return { posId: pos.id, posName: pos.name, total, count: s.length };
                    })
                );
                setSalesByPos(rows);
            } catch {
                // Mantener salesByPos anterior si falla
            }
        })();
    }, [showPorSede, posListForOwner.length]);

    // 1. Sales over time (solo ventas con fecha válida para evitar errores)
    const salesData = sales
        .filter((sale) => sale.fecha && typeof sale.fecha === 'string' && sale.fecha.length >= 10)
        .reduce((acc: any, sale) => {
            const date = sale.fecha.substring(5, 10); // MM-DD
            const existing = acc.find((d: any) => d.name === date);
            if (existing) {
                existing.total += sale.total;
            } else {
                acc.push({ name: date, total: sale.total });
            }
            return acc;
        }, [])
        .sort((a, b) => a.name.localeCompare(b.name));

    // 2. Appointments Status
    const appointmentStats = [
        { name: 'Completadas', value: appointments.filter(a => a.estado === 'completada').length },
        { name: 'Canceladas', value: appointments.filter(a => a.estado === 'cancelada').length },
        { name: 'Pendientes', value: appointments.filter(a => a.estado === 'confirmada' || a.estado === 'pendiente').length },
    ];
    const hasAppointmentData = appointmentStats.some((s) => s.value > 0);

    // 3. Top Products (ventas reales: unidades vendidas por producto)
    const productUnitsSold: Record<number, number> = {};
    sales.forEach(sale => {
        (sale.items || []).forEach(item => {
            if (item.type === 'producto') {
                productUnitsSold[item.id] = (productUnitsSold[item.id] || 0) + item.quantity;
            }
        });
    });
    const productSales = products
        .map(p => ({
            name: p.producto,
            stock: p.stock,
            sales: productUnitsSold[p.id] || 0
        }))
        .sort((a, b) => b.sales - a.sales)
        .slice(0, 5);

    const barberStats = showPorBarbero && barbers.length > 0
        ? barbers.map(b => ({
            name: b.name,
            total: sales.filter(s => (s.barberoId ?? null) === b.id).reduce((sum, s) => sum + s.total, 0),
            citas: appointments.filter(a => a.barberoId === b.id).length,
        })).filter(x => x.total > 0 || x.citas > 0)
        : [];

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                <Loader2 className="animate-spin mb-4" size={48} />
                <p className="font-medium">Cargando reportes...</p>
            </div>
        );
    }
    if (loadError) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-slate-600 max-w-md mx-auto text-center px-4">
                <p className="font-medium mb-2">No se pudieron cargar los reportes.</p>
                <p className="text-sm text-slate-500 mb-6">{loadError}</p>
                <button type="button" onClick={loadMainData} className="bg-[#ffd427] hover:bg-[#e6be23] text-slate-900 font-semibold px-6 py-3 rounded-xl transition-colors">
                    Reintentar
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6 print-container">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 no-print">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800">Reportes y Estadísticas</h2>
                <button 
                    onClick={() => handlePrint({
                        name: 'Reporte',
                        shareText: noSedeActiva
                            ? 'Reporte BarberShow – Sin sede seleccionada.'
                            : `Reporte BarberShow – ${new Date().toLocaleDateString('es-ES')}\nVentas del periodo, citas por estado, productos más vendidos. (Abre en navegador para imprimir completo.)`,
                    })}
                    className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors shadow-sm"
                >
                    <Printer size={18} />
                    <span>Imprimir Reporte</span>
                </button>
            </div>

            <div className="print-header hidden">
                <h1 className="text-3xl font-bold text-slate-800 mb-2">BarberShow - Reporte General</h1>
                <p className="text-slate-500 mb-6">Generado el: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
            </div>

            {noSedeActiva && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl mb-4 no-print">
                    <p className="font-medium">No hay sede seleccionada</p>
                    <p className="text-sm mt-1">Selecciona una sede en el menú superior para ver ventas, citas y reportes de esa ubicación.</p>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:grid-cols-2">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center space-x-3 text-slate-500 mb-2">
                        <TrendingUp size={20} />
                        <span className="font-medium">Ventas Totales</span>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800">
                        ${sales.reduce((acc, s) => acc + s.total, 0).toFixed(2)}
                    </h3>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center space-x-3 text-slate-500 mb-2">
                        <Calendar size={20} />
                        <span className="font-medium">Total Citas</span>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800">{appointments.length}</h3>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center space-x-3 text-slate-500 mb-2">
                        <Users size={20} />
                        <span className="font-medium">Clientes Activos</span>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800">{clients.length}</h3>
                </div>
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex items-center space-x-3 text-slate-500 mb-2">
                        <ShoppingBag size={20} />
                        <span className="font-medium">Productos en Stock</span>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-800">{products.reduce((acc, p) => acc + p.stock, 0)}</h3>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:grid-cols-1">
                {/* Sales Chart */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[320px] page-break-inside-avoid">
                    <h3 className="font-bold text-slate-800 mb-4 flex-shrink-0">Tendencia de Ventas</h3>
                    <div className="flex-1 min-h-[220px] w-full">
                        {salesData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={salesData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <Tooltip />
                                    <Legend />
                                    <Line type="monotone" dataKey="total" stroke="#ffd427" strokeWidth={2} name="Total" />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full min-h-[220px] flex items-center justify-center text-slate-400 text-center px-4">
                                {noSedeActiva ? 'Selecciona una sede para ver la tendencia de ventas.' : 'No hay ventas en el periodo para mostrar.'}
                            </div>
                        )}
                    </div>
                </div>

                {/* Appointment Status */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[320px] page-break-inside-avoid">
                    <h3 className="font-bold text-slate-800 mb-4 flex-shrink-0">Estado de Citas</h3>
                    <div className="flex-1 min-h-[220px] w-full">
                        {hasAppointmentData ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={appointmentStats}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        paddingAngle={2}
                                        dataKey="value"
                                    >
                                        {appointmentStats.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full min-h-[220px] flex items-center justify-center text-slate-400 text-center px-4">
                                Sin citas registradas para mostrar.
                            </div>
                        )}
                    </div>
                </div>

                {/* Top Products */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-[320px] page-break-inside-avoid lg:col-span-2">
                    <h3 className="font-bold text-slate-800 mb-4 flex-shrink-0">Productos Populares</h3>
                    <div className="flex-1 min-h-[220px] w-full">
                        {productSales.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={productSales} margin={{ top: 8, right: 16, left: 8, bottom: 48 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 14, fill: '#334155', fontWeight: 500 }}
                                        angle={-35}
                                        textAnchor="end"
                                        height={72}
                                        interval={0}
                                    />
                                    <YAxis type="number" tick={{ fontSize: 12 }} />
                                    <Tooltip />
                                    <Bar dataKey="sales" fill="#ffd427" radius={[4, 4, 0, 0]} name="Unidades vendidas" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full min-h-[220px] flex items-center justify-center text-slate-400 text-center px-4">
                                No hay ventas de productos en el periodo.
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Por barbero (plan Barbería / Multi-Sede) */}
            {showPorBarbero && barberStats.length > 0 && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm page-break-inside-avoid">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                        <Scissors size={20} className="mr-2 text-[#ffd427]" /> Ventas y Citas por Barbero
                    </h3>
                    <div className="overflow-x-auto table-wrapper">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-slate-500 text-sm border-b border-slate-200">
                                    <th className="py-2">Barbero</th>
                                    <th className="py-2 text-right">Ventas ($)</th>
                                    <th className="py-2 text-right">Citas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {barberStats.map((row, i) => (
                                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                                        <td className="py-3 font-medium text-slate-800">{row.name}</td>
                                        <td className="py-3 text-right text-slate-700">${row.total.toFixed(2)}</td>
                                        <td className="py-3 text-right text-slate-700">{row.citas}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Por sede (plan Multi-Sede) */}
            {showPorSede && salesByPos.length > 0 && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm page-break-inside-avoid">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center">
                        <MapPin size={20} className="mr-2 text-[#ffd427]" /> Ventas por Sede
                    </h3>
                    <div className="overflow-x-auto table-wrapper">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-slate-500 text-sm border-b border-slate-200">
                                    <th className="py-2">Sede</th>
                                    <th className="py-2 text-right">Total Ventas ($)</th>
                                    <th className="py-2 text-right">Nº Ventas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {salesByPos.map((row) => (
                                    <tr key={row.posId} className="border-b border-slate-50 hover:bg-slate-50">
                                        <td className="py-3 font-medium text-slate-800">{row.posName}</td>
                                        <td className="py-3 text-right text-slate-700">${row.total.toFixed(2)}</td>
                                        <td className="py-3 text-right text-slate-700">{row.count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Reports;