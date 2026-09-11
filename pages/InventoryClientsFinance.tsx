import React, { useState, useEffect } from 'react';
import { DataService } from '../services/data';
import { Product, FinanceRecord, Sale } from '../types';
import { Plus, X, Edit2, Loader2, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

export { default as Clients } from './Clients';

const PRODUCT_CATEGORIES = [
    'Cuidado capilar',
    'Cuidado de barba',
    'Afeitado',
    'Styling',
    'Accesorios',
    'Fragancias',
    'Tratamientos',
    'Higiene',
    'Otros',
];

const CUSTOM_CATEGORY_VALUE = '__custom__';

// --- Inventory Component ---
export const Inventory: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isCustomCategory, setIsCustomCategory] = useState(false);
    
    // Form State
    const [currentProduct, setCurrentProduct] = useState<Partial<Product>>({
        producto: '',
        categoria: '',
        stock: 0,
        precioCompra: 0,
        precioVenta: 0,
        estado: 'activo'
    });

    const categoryOptions = Array.from(
        new Set([
            ...PRODUCT_CATEGORIES,
            ...products.map((p) => p.categoria).filter((c): c is string => Boolean(c && c.trim())),
        ])
    );
    
    const barberIdForProducts = DataService.getCurrentUserRole() === 'barbero' ? DataService.getCurrentBarberId() ?? undefined : undefined;
    useEffect(() => {
        DataService.getProducts(barberIdForProducts).then(setProducts);
    }, [barberIdForProducts]);

    const handleCreateClick = () => {
        setCurrentProduct({
            producto: '',
            categoria: '',
            stock: 0,
            precioCompra: 0,
            precioVenta: 0,
            estado: 'activo'
        });
        setIsCustomCategory(false);
        setIsEditing(false);
        setShowModal(true);
    };

    const handleEditClick = (product: Product) => {
        const known = categoryOptions.includes(product.categoria);
        setCurrentProduct(product);
        setIsCustomCategory(Boolean(product.categoria) && !known);
        setIsEditing(true);
        setShowModal(true);
    };

    const handleSaveProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentProduct.producto || !currentProduct.precioVenta) return;
        try {
            if (isEditing && currentProduct.id) {
                await DataService.updateProduct(currentProduct as Product);
                const list = await DataService.getProducts(barberIdForProducts);
                setProducts(list);
            } else {
                const product = await DataService.addProduct({
                    ...currentProduct as any
                });
                setProducts([...products, product]);
            }
            setShowModal(false);
        } catch (err) {
            alert(err instanceof Error ? err.message : 'No se pudo guardar el producto. Revisa tu conexión.');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Inventario</h2>
                <button onClick={handleCreateClick} className="bg-[#ffd427] hover:bg-[#e6be23] text-slate-900 px-4 py-2 rounded-lg font-bold flex items-center space-x-2 transition-colors shadow-sm">
                    <Plus size={18} />
                    <span>Nuevo Producto</span>
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
                {/* Estado vacío: mismo en móvil y escritorio */}
                {products.length === 0 ? (
                    <div className="p-8 md:p-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                            <Package size={32} className="text-slate-400" />
                        </div>
                        <p className="text-slate-600 font-medium">No hay productos en el inventario</p>
                        <p className="text-slate-500 text-sm mt-1">Pulsa &quot;Nuevo Producto&quot; para agregar el primero.</p>
                        <button
                            type="button"
                            onClick={handleCreateClick}
                            className="mt-6 inline-flex items-center gap-2 bg-[#ffd427] hover:bg-[#e6be23] text-slate-900 px-5 py-2.5 rounded-xl font-bold transition-colors"
                        >
                            <Plus size={18} /> Nuevo Producto
                        </button>
                    </div>
                ) : (
                <>
                {/* Vista tarjetas — solo en móvil */}
                <div className="md:hidden p-4 space-y-4">
                    {
                        products.map(p => (
                            <div
                                key={p.id}
                                className="bg-white rounded-2xl border border-slate-200/80 shadow-md shadow-slate-200/50 overflow-hidden transition-shadow hover:shadow-lg hover:shadow-slate-200/60"
                            >
                                {/* Barra de acento superior */}
                                <div className="h-1 bg-gradient-to-r from-[#ffd427] to-amber-400" />
                                <div className="p-4">
                                    <div className="flex justify-between items-start gap-3 mb-4">
                                        <div className="min-w-0 flex-1">
                                            <span className="inline-block text-xs font-medium text-slate-500 uppercase tracking-wide mb-0.5">{p.categoria}</span>
                                            <h3 className="font-bold text-slate-900 text-lg leading-tight truncate">{p.producto}</h3>
                                        </div>
                                        <button
                                            onClick={() => handleEditClick(p)}
                                            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-[#ffd427] hover:text-slate-900 transition-all duration-200"
                                            title="Editar Producto"
                                        >
                                            <Edit2 size={16} />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                                        <div className="flex flex-col">
                                            <span className="text-slate-400 text-xs font-medium">Stock</span>
                                            <span className={`font-bold text-base tabular-nums ${p.stock < 5 ? 'text-red-500' : 'text-slate-800'}`}>{p.stock} und</span>
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-slate-400 text-xs font-medium">Estado</span>
                                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${p.stock > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                                                {p.stock > 0 ? 'Activo' : 'Sin Stock'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-baseline">
                                        <div>
                                            <span className="text-slate-400 text-xs block">Compra</span>
                                            <span className="text-slate-600 font-medium">${p.precioCompra.toFixed(2)}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-slate-400 text-xs block">Venta</span>
                                            <span className="text-slate-900 font-bold text-lg">${p.precioVenta.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                </div>

                {/* Vista tabla — solo en escritorio */}
                <div className="hidden md:block overflow-x-auto table-wrapper">
                <table className="w-full min-w-[640px]">
                    <thead className="bg-slate-50 text-slate-600 text-sm font-semibold uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-4 text-left">Producto</th>
                            <th className="px-6 py-4 text-left">Categoría</th>
                            <th className="px-6 py-4 text-left">Stock</th>
                            <th className="px-6 py-4 text-right">Precio Compra</th>
                            <th className="px-6 py-4 text-right">Precio Venta</th>
                            <th className="px-6 py-4 text-center">Estado</th>
                            <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {products.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-semibold text-slate-800">{p.producto}</td>
                                <td className="px-6 py-4 text-slate-600">{p.categoria}</td>
                                <td className={`px-6 py-4 font-bold ${p.stock < 5 ? 'text-red-500' : 'text-slate-700'}`}>{p.stock}</td>
                                <td className="px-6 py-4 text-right text-slate-500">${p.precioCompra.toFixed(2)}</td>
                                <td className="px-6 py-4 text-right font-bold text-slate-800">${p.precioVenta.toFixed(2)}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${p.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {p.stock > 0 ? 'Activo' : 'Sin Stock'}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <button onClick={() => handleEditClick(p)} className="text-slate-400 hover:text-blue-600 p-2 hover:bg-blue-50 rounded-lg transition-colors" title="Editar Producto">
                                        <Edit2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
                </>
                )}
            </div>

            {/* Product Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-xl font-bold text-slate-800">{isEditing ? 'Editar Producto' : 'Agregar Nuevo Producto'}</h3>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                        </div>
                        <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Producto *</label>
                                <input type="text" required className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427]" value={currentProduct.producto} onChange={e => setCurrentProduct({...currentProduct, producto: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Categoría</label>
                                    <select
                                        className="w-full border border-slate-300 rounded-lg p-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#ffd427]"
                                        value={isCustomCategory ? CUSTOM_CATEGORY_VALUE : (currentProduct.categoria || '')}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === CUSTOM_CATEGORY_VALUE) {
                                                setIsCustomCategory(true);
                                                setCurrentProduct({ ...currentProduct, categoria: '' });
                                                return;
                                            }
                                            setIsCustomCategory(false);
                                            setCurrentProduct({ ...currentProduct, categoria: value });
                                        }}
                                    >
                                        <option value="">Seleccionar categoría</option>
                                        {categoryOptions.map((category) => (
                                            <option key={category} value={category}>{category}</option>
                                        ))}
                                        <option value={CUSTOM_CATEGORY_VALUE}>Otra...</option>
                                    </select>
                                    {isCustomCategory && (
                                        <input
                                            type="text"
                                            className="mt-2 w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427]"
                                            placeholder="Escribe la categoría"
                                            value={currentProduct.categoria}
                                            onChange={(e) => setCurrentProduct({ ...currentProduct, categoria: e.target.value })}
                                        />
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Stock Actual</label>
                                    <input
                                        type="number"
                                        min={0}
                                        required
                                        className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427] placeholder:text-gray-400"
                                        value={currentProduct.stock === 0 ? '' : currentProduct.stock}
                                        placeholder="0"
                                        onChange={e => {
                                            const v = e.target.value;
                                            setCurrentProduct({ ...currentProduct, stock: v === '' ? 0 : Number(v) });
                                        }}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Precio Compra ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min={0}
                                        className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427] placeholder:text-gray-400"
                                        value={currentProduct.precioCompra === 0 ? '' : currentProduct.precioCompra}
                                        placeholder="0"
                                        onChange={e => {
                                            const v = e.target.value;
                                            setCurrentProduct({ ...currentProduct, precioCompra: v === '' ? 0 : Number(v) });
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Precio Venta ($) *</label>
                                    <input
                                        type="number"
                                        required
                                        step="0.01"
                                        min={0}
                                        className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427] placeholder:text-gray-400"
                                        value={currentProduct.precioVenta === 0 ? '' : currentProduct.precioVenta}
                                        placeholder="0"
                                        onChange={e => {
                                            const v = e.target.value;
                                            setCurrentProduct({ ...currentProduct, precioVenta: v === '' ? 0 : Number(v) });
                                        }}
                                    />
                                </div>
                            </div>
                            
                            <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100 mt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors">Cancelar</button>
                                <button type="submit" className="px-6 py-2 bg-[#ffd427] text-slate-900 font-bold rounded-lg hover:bg-[#e6be23] transition-colors shadow-lg shadow-yellow-500/20">
                                    {isEditing ? 'Actualizar Producto' : 'Guardar Producto'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Finance Component ---
const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function buildChartData(sales: Sale[], financeRecords: FinanceRecord[], days: number = 7): { name: string; ingresos: number; egresos: number }[] {
    const today = new Date();
    const result: { name: string; ingresos: number; egresos: number }[] = [];
    const ingresosByDate: Record<string, number> = {};
    const egresosByDate: Record<string, number> = {};
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        ingresosByDate[key] = 0;
        egresosByDate[key] = 0;
    }
    sales.filter((s) => s.estado === 'completada').forEach((s) => {
        if (ingresosByDate[s.fecha] !== undefined) ingresosByDate[s.fecha] += s.total;
    });
    financeRecords.forEach((f) => {
        if (egresosByDate[f.fecha] !== undefined) egresosByDate[f.fecha] = f.egresos || 0;
    });
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        result.push({
            name: DAY_NAMES[d.getDay()] + ' ' + key.slice(5),
            ingresos: ingresosByDate[key] || 0,
            egresos: egresosByDate[key] || 0,
        });
    }
    return result;
}

export const Finance: React.FC = () => {
    const [sales, setSales] = useState<Sale[]>([]);
    const [financeRecords, setFinanceRecords] = useState<FinanceRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [showGastoModal, setShowGastoModal] = useState(false);
    const [gastoFecha, setGastoFecha] = useState(() => new Date().toISOString().split('T')[0]);
    const [gastoDescripcion, setGastoDescripcion] = useState('');
    const [gastoMonto, setGastoMonto] = useState('');

    const loadData = async () => {
        setLoading(true);
        try {
            const [s, f] = await Promise.all([DataService.getSales(), DataService.getFinances()]);
            setSales(s);
            setFinanceRecords(f);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).toISOString().split('T')[0];
    const lastDay = new Date(year, month + 1, 0).toISOString().split('T')[0];

    const salesThisMonth = sales.filter((s) => s.estado === 'completada' && s.fecha >= firstDay && s.fecha <= lastDay);
    const ingresosMes = salesThisMonth.reduce((sum, s) => sum + s.total, 0);
    const recordsThisMonth = financeRecords.filter((r) => r.fecha >= firstDay && r.fecha <= lastDay);
    const egresosMes = recordsThisMonth.reduce((sum, r) => sum + (r.egresos || 0), 0);
    const beneficioNeto = ingresosMes - egresosMes;

    const chartData = buildChartData(sales, financeRecords, 7);

    const handleAddGasto = async (e: React.FormEvent) => {
        e.preventDefault();
        const monto = Number.parseFloat(gastoMonto);
        if (!gastoDescripcion.trim() || Number.isNaN(monto) || monto <= 0) {
            alert('Indica descripción y monto mayor a 0.');
            return;
        }
        const posId = DataService.getActivePosId();
        if (posId == null) {
            alert('No hay sede activa.');
            return;
        }
        const existing = financeRecords.find((r) => r.fecha === gastoFecha);
        const newGasto = { descripcion: gastoDescripcion.trim(), monto };
        if (existing) {
            const gastos = [...(existing.gastos || []), newGasto];
            const egresos = gastos.reduce((s, g) => s + (typeof g === 'object' && 'monto' in g ? Number(g.monto) : 0), 0);
            const updatedRecord = { ...existing, gastos, egresos };
            await DataService.updateFinanceRecord(updatedRecord);
            setFinanceRecords((prev) => prev.map((r) => (r.fecha === gastoFecha ? updatedRecord : r)));
        } else {
            const saved = await DataService.addFinanceRecord({
                posId,
                fecha: gastoFecha,
                ingresos: 0,
                egresos: monto,
                ventas: [],
                gastos: [newGasto],
            });
            setFinanceRecords((prev) => [...prev, saved]);
        }
        setShowGastoModal(false);
        setGastoDescripcion('');
        setGastoMonto('');
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                <Loader2 className="animate-spin mb-4" size={48} />
                <p className="font-medium">Cargando finanzas...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-2xl font-bold text-slate-800">Finanzas</h2>
                <button
                    type="button"
                    onClick={() => setShowGastoModal(true)}
                    className="bg-[#ffd427] hover:bg-[#e6be23] text-slate-900 px-4 py-2 rounded-lg font-bold flex items-center justify-center space-x-2 transition-colors shadow-sm"
                >
                    <Plus size={18} />
                    <span>Registrar gasto</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-slate-500 text-sm font-medium mb-1">Ingresos (este mes)</p>
                    <h3 className="text-3xl font-bold text-emerald-600 flex items-center">
                        <TrendingUp className="mr-2" /> ${ingresosMes.toFixed(2)}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Por ventas registradas en el POS</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-slate-500 text-sm font-medium mb-1">Gastos operativos (este mes)</p>
                    <h3 className="text-3xl font-bold text-red-500 flex items-center">
                        <TrendingDown className="mr-2" /> ${egresosMes.toFixed(2)}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">Gastos registrados manualmente</p>
                </div>
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <p className="text-slate-500 text-sm font-medium mb-1">Beneficio neto</p>
                    <h3 className={`text-3xl font-bold flex items-center ${beneficioNeto >= 0 ? 'text-[#e6be23]' : 'text-red-500'}`}>
                        <DollarSign className="mr-2" /> ${beneficioNeto.toFixed(2)}
                    </h3>
                </div>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-xl border border-slate-200 shadow-sm min-h-[320px]">
                <h3 className="text-lg font-bold text-slate-800 mb-4 sm:mb-6">Últimos 7 días (ingresos por ventas vs egresos)</h3>
                <div className="w-full min-h-[280px] h-[300px] sm:h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} />
                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '12px' }} />
                            <Legend wrapperStyle={{ paddingTop: '12px' }} />
                            <Bar dataKey="ingresos" fill="#ffd427" radius={[4, 4, 0, 0]} name="Ingresos" />
                            <Bar dataKey="egresos" fill="#ef4444" radius={[4, 4, 0, 0]} name="Egresos" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {recordsThisMonth.length > 0 && (
                <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Gastos del mes</h3>
                    <div className="overflow-x-auto table-wrapper">
                        <table className="w-full text-left border-collapse min-w-0">
                            <thead>
                                <tr className="text-slate-500 text-sm border-b border-slate-200">
                                    <th className="py-2">Fecha</th>
                                    <th className="py-2">Descripción</th>
                                    <th className="py-2 text-right">Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recordsThisMonth.flatMap((r) =>
                                    (r.gastos || []).map((g: any, i: number) => (
                                        <tr key={`${r.fecha}-${i}`} className="border-b border-slate-50">
                                            <td className="py-2 text-slate-700">{r.fecha}</td>
                                            <td className="py-2 text-slate-700">{typeof g === 'object' && g.descripcion != null ? g.descripcion : String(g)}</td>
                                            <td className="py-2 text-right font-medium text-red-600">${(typeof g === 'object' && g.monto != null ? Number(g.monto) : 0).toFixed(2)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {showGastoModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                            <h3 className="text-xl font-bold text-slate-800">Registrar gasto</h3>
                            <button type="button" onClick={() => setShowGastoModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleAddGasto} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                                <input type="date" required className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#ffd427]" value={gastoFecha} onChange={(e) => setGastoFecha(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción</label>
                                <input type="text" required className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#ffd427]" placeholder="Ej: Alquiler, insumos, servicios" value={gastoDescripcion} onChange={(e) => setGastoDescripcion(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Monto ($)</label>
                                <input type="number" step="0.01" min="0.01" required className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-[#ffd427]" value={gastoMonto} onChange={(e) => setGastoMonto(e.target.value)} />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={() => setShowGastoModal(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">Cancelar</button>
                                <button type="submit" className="px-4 py-2 bg-[#ffd427] text-slate-900 font-bold rounded-lg hover:bg-[#e6be23]">Guardar gasto</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};