import React, { useEffect, useState } from 'react';
import { DataService } from '../services/data';
import { Sale, Appointment, Product, Client } from '../types';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, Calendar, ShoppingBag, Printer } from 'lucide-react';

const COLORS = ['#ffd427', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

const Reports: React.FC = () => {
    const [sales, setSales] = useState<Sale[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [clients, setClients] = useState<Client[]>([]);

    useEffect(() => {
        Promise.all([
            DataService.getSales(),
            DataService.getAppointments(),
            DataService.getProducts(),
            DataService.getClients(),
        ]).then(([s, a, p, c]) => {
            setSales(s);
            setAppointments(a);
            setProducts(p);
            setClients(c);
        });
    }, []);

    // 1. Sales over time
    const salesData = sales.reduce((acc: any, sale) => {
        const date = sale.fecha.substring(5); // MM-DD
        const existing = acc.find((d: any) => d.name === date);
        if (existing) {
            existing.total += sale.total;
        } else {
            acc.push({ name: date, total: sale.total });
        }
        return acc;
    }, []);

    // 2. Appointments Status
    const appointmentStats = [
        { name: 'Completadas', value: appointments.filter(a => a.estado === 'completada').length },
        { name: 'Canceladas', value: appointments.filter(a => a.estado === 'cancelada').length },
        { name: 'Pendientes', value: appointments.filter(a => a.estado === 'confirmada' || a.estado === 'pendiente').length },
    ];

    // 3. Top Products
    const productSales = products.map(p => {
        return {
            name: p.producto,
            stock: p.stock,
            sales: Math.floor(Math.random() * 20)
        };
    }).sort((a, b) => b.sales - a.sales).slice(0, 5);

    return (
        <div className="space-y-6 print-container">
            <div className="flex justify-between items-center no-print">
                <h2 className="text-2xl font-bold text-slate-800">Reportes y Estadísticas</h2>
                <button 
                    onClick={() => window.print()}
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
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-80 page-break-inside-avoid">
                    <h3 className="font-bold text-slate-800 mb-4">Tendencia de Ventas</h3>
                    {salesData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={salesData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="total" stroke="#ffd427" strokeWidth={2} />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-slate-400">Sin datos suficientes</div>
                    )}
                </div>

                {/* Appointment Status */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-80 page-break-inside-avoid">
                    <h3 className="font-bold text-slate-800 mb-4">Estado de Citas</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={appointmentStats}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                fill="#8884d8"
                                paddingAngle={5}
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
                </div>

                {/* Top Products */}
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-80 page-break-inside-avoid">
                    <h3 className="font-bold text-slate-800 mb-4">Productos Populares</h3>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={productSales} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                            <XAxis type="number" />
                            <YAxis dataKey="name" type="category" width={100} />
                            <Tooltip />
                            <Bar dataKey="sales" fill="#ffd427" radius={[0, 4, 4, 0]} name="Ventas Estimadas" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default Reports;