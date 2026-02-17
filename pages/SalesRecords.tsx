import React, { useEffect, useState } from 'react';
import { DataService } from '../services/data';
import { Sale, Client, Barber, AccountTier } from '../types';
import { Scissors, Loader2, Calendar, ChevronDown, ChevronUp, User, Clock, Package } from 'lucide-react';

interface SalesRecordsProps {
    accountTier?: AccountTier;
}

const formatDate = (iso: string) => {
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
};

const SalesRecords: React.FC<SalesRecordsProps> = ({ accountTier = 'solo' }) => {
    const [sales, setSales] = useState<Sale[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [expandedId, setExpandedId] = useState<number | null>(null);

    const showBarbero = accountTier === 'barberia' || accountTier === 'multisede';

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const [s, c, b] = await Promise.all([
                    DataService.getSales(),
                    DataService.getClients(),
                    showBarbero ? DataService.getBarbers() : Promise.resolve([]),
                ]);
                setSales(s.filter((sale) => sale.estado === 'completada'));
                setClients(c);
                setBarbers(b);
            } finally {
                setLoading(false);
            }
        })();
    }, [showBarbero]);

    const getClientName = (clienteId: number | null) => {
        if (clienteId == null) return 'Cliente ocasional';
        const c = clients.find((x) => x.id === clienteId);
        return c ? c.nombre : `Cliente #${clienteId}`;
    };

    const getBarberName = (barberoId?: number | null) => {
        if (barberoId == null) return '—';
        const b = barbers.find((x) => x.id === barberoId);
        return b ? b.name : `Barbero #${barberoId}`;
    };

    const filtered = sales
        .filter((s) => {
            if (dateFrom && s.fecha < dateFrom) return false;
            if (dateTo && s.fecha > dateTo) return false;
            return true;
        })
        .sort((a, b) => {
            const d = a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora);
            return -d;
        });

    const totalInPeriod = filtered.reduce((sum, s) => sum + s.total, 0);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                <Loader2 className="animate-spin mb-4 text-[#ffd427]" size={48} />
                <p className="font-medium">Cargando registros...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:gap-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-[#ffd427]/15 text-[#c9a000]">
                        <Scissors size={26} strokeWidth={2} />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">Registros de cortes</h1>
                        <p className="text-sm text-slate-500 mt-0.5">Ventas completadas por fecha</p>
                    </div>
                </div>
            </div>

            {/* Filtros en card */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-600 text-sm font-medium">
                        <Calendar size={18} className="text-slate-400" />
                        Rango de fechas
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                            <span className="hidden sm:inline">Desde</span>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 bg-slate-50/80 focus:bg-white focus:ring-2 focus:ring-[#ffd427]/40 focus:border-[#ffd427]/50 transition-all"
                            />
                        </label>
                        <span className="text-slate-400 font-medium">a</span>
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                            <span className="hidden sm:inline">Hasta</span>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 bg-slate-50/80 focus:bg-white focus:ring-2 focus:ring-[#ffd427]/40 focus:border-[#ffd427]/50 transition-all"
                            />
                        </label>
                    </div>
                </div>
                {filtered.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-4 text-sm">
                        <span className="text-slate-600">
                            <strong className="text-slate-800">{filtered.length}</strong> registro{filtered.length !== 1 ? 's' : ''}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-600">
                            Total en período: <strong className="text-[#c9a000]">${totalInPeriod.toFixed(2)}</strong>
                        </span>
                    </div>
                )}
            </div>

            {/* Lista: cards en móvil, tabla en desktop */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                {filtered.length === 0 ? (
                    <div className="py-16 px-6 text-center">
                        <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                            <Scissors size={28} className="text-slate-400" />
                        </div>
                        <p className="text-slate-600 font-medium">No hay registros en el rango seleccionado</p>
                        <p className="text-slate-500 text-sm mt-1">Ajusta las fechas o espera nuevas ventas</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop: tabla */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50/90 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                                        <th className="py-4 px-5">Fecha</th>
                                        <th className="py-4 px-5">Hora</th>
                                        <th className="py-4 px-5">Cliente</th>
                                        {showBarbero && <th className="py-4 px-5">Barbero</th>}
                                        <th className="py-4 px-5">Servicios / Productos</th>
                                        <th className="py-4 px-5 text-right">Total</th>
                                        <th className="py-4 px-3 w-12" aria-label="Detalle" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtered.map((sale) => (
                                        <React.Fragment key={sale.id}>
                                            <tr className="hover:bg-amber-50/30 transition-colors">
                                                <td className="py-4 px-5 text-slate-700 font-medium">{formatDate(sale.fecha)}</td>
                                                <td className="py-4 px-5 text-slate-600 flex items-center gap-1.5">
                                                    <Clock size={14} className="text-slate-400 shrink-0" />
                                                    {sale.hora}
                                                </td>
                                                <td className="py-4 px-5">
                                                    <span className="font-medium text-slate-800">{getClientName(sale.clienteId)}</span>
                                                </td>
                                                {showBarbero && (
                                                    <td className="py-4 px-5 text-slate-600">{getBarberName(sale.barberoId)}</td>
                                                )}
                                                <td className="py-4 px-5">
                                                    <span className="text-slate-600">
                                                        {(sale.items || []).slice(0, 2).map((i) => i.name).join(', ')}
                                                        {(sale.items?.length ?? 0) > 2 && (
                                                            <span className="text-slate-400"> +{(sale.items?.length ?? 0) - 2} más</span>
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-5 text-right">
                                                    <span className="font-semibold text-slate-800">${sale.total.toFixed(2)}</span>
                                                </td>
                                                <td className="py-4 px-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedId(expandedId === sale.id ? null : sale.id)}
                                                        className="p-2 rounded-lg text-slate-400 hover:bg-[#ffd427]/20 hover:text-[#c9a000] transition-colors"
                                                        title={expandedId === sale.id ? 'Ocultar detalle' : 'Ver detalle'}
                                                    >
                                                        {expandedId === sale.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                    </button>
                                                </td>
                                            </tr>
                                            {expandedId === sale.id && (
                                                <tr className="bg-amber-50/40">
                                                    <td colSpan={showBarbero ? 7 : 6} className="py-4 px-5">
                                                        <div className="rounded-xl bg-white/80 border border-amber-100 p-4 text-sm">
                                                            <p className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                                                <Package size={16} className="text-[#c9a000]" />
                                                                Detalle — {sale.numeroVenta}
                                                            </p>
                                                            <div className="flex flex-wrap gap-2 mb-3">
                                                                {(sale.items || []).map((item, idx) => (
                                                                    <span
                                                                        key={idx}
                                                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${item.type === 'servicio' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}
                                                                    >
                                                                        {item.name} × {item.quantity} — ${(item.price * item.quantity).toFixed(2)}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                            <p className="text-slate-500 border-t border-slate-100 pt-3">
                                                                Subtotal ${sale.subtotal.toFixed(2)} · IVA ${sale.iva.toFixed(2)} · Total ${sale.total.toFixed(2)} · {sale.metodoPago}
                                                            </p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Móvil: cards */}
                        <div className="md:hidden divide-y divide-slate-100">
                            {filtered.map((sale) => (
                                <div key={sale.id} className="p-4">
                                    <button
                                        type="button"
                                        onClick={() => setExpandedId(expandedId === sale.id ? null : sale.id)}
                                        className="w-full text-left"
                                    >
                                        <div className="flex justify-between items-start gap-3">
                                            <div className="min-w-0">
                                                <p className="font-semibold text-slate-800 truncate">{getClientName(sale.clienteId)}</p>
                                                <p className="text-sm text-slate-500 mt-0.5">{formatDate(sale.fecha)} · {sale.hora}</p>
                                                <p className="text-sm text-slate-600 mt-1">
                                                    {(sale.items || []).slice(0, 2).map((i) => i.name).join(', ')}
                                                    {(sale.items?.length ?? 0) > 2 && ` +${(sale.items?.length ?? 0) - 2}`}
                                                </p>
                                                {showBarbero && (
                                                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                                        <User size={12} /> {getBarberName(sale.barberoId)}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="font-bold text-slate-800">${sale.total.toFixed(2)}</span>
                                                {expandedId === sale.id ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                                            </div>
                                        </div>
                                    </button>
                                    {expandedId === sale.id && (
                                        <div className="mt-3 rounded-xl bg-slate-50 border border-slate-100 p-3 text-sm">
                                            <p className="font-medium text-slate-700 mb-2">{sale.numeroVenta}</p>
                                            <ul className="space-y-1.5">
                                                {(sale.items || []).map((item, idx) => (
                                                    <li key={idx} className="flex justify-between text-slate-600">
                                                        <span>{item.name} × {item.quantity}</span>
                                                        <span>${(item.price * item.quantity).toFixed(2)}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                            <p className="text-slate-500 text-xs mt-2 pt-2 border-t border-slate-200">
                                                Subtotal ${sale.subtotal.toFixed(2)} · IVA ${sale.iva.toFixed(2)} · {sale.metodoPago}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default SalesRecords;
