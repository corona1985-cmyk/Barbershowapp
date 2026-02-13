import React, { useEffect, useState } from 'react';
import { DataService } from '../services/data';
import { Sale, Client, Barber, AccountTier } from '../types';
import { Scissors, Loader2, Calendar, ChevronDown, ChevronUp } from 'lucide-react';

interface SalesRecordsProps {
    accountTier?: AccountTier;
}

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

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                <Loader2 className="animate-spin mb-4" size={48} />
                <p className="font-medium">Cargando registros...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Scissors size={28} className="text-[#ffd427]" />
                    Registros de cortes
                </h2>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Calendar size={18} className="text-slate-500" />
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white"
                        />
                    </div>
                    <span className="text-slate-400">a</span>
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-slate-600 text-sm border-b border-slate-200">
                                <th className="py-3 px-4 font-semibold">Fecha</th>
                                <th className="py-3 px-4 font-semibold">Hora</th>
                                <th className="py-3 px-4 font-semibold">Cliente</th>
                                {showBarbero && <th className="py-3 px-4 font-semibold">Barbero</th>}
                                <th className="py-3 px-4 font-semibold">Servicios / Productos</th>
                                <th className="py-3 px-4 font-semibold text-right">Total</th>
                                <th className="py-3 px-4 w-10" aria-label="Detalle" />
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={showBarbero ? 7 : 6} className="py-12 text-center text-slate-500">
                                        No hay registros en el rango seleccionado.
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((sale) => (
                                    <React.Fragment key={sale.id}>
                                        <tr className="border-b border-slate-100 hover:bg-slate-50/80">
                                            <td className="py-3 px-4 text-slate-700">{sale.fecha}</td>
                                            <td className="py-3 px-4 text-slate-700">{sale.hora}</td>
                                            <td className="py-3 px-4 font-medium text-slate-800">{getClientName(sale.clienteId)}</td>
                                            {showBarbero && (
                                                <td className="py-3 px-4 text-slate-600">{getBarberName(sale.barberoId)}</td>
                                            )}
                                            <td className="py-3 px-4 text-slate-600">
                                                {(sale.items || []).slice(0, 2).map((i) => i.name).join(', ')}
                                                {(sale.items?.length ?? 0) > 2 && (
                                                    <span className="text-slate-400"> +{(sale.items?.length ?? 0) - 2} más</span>
                                                )}
                                            </td>
                                            <td className="py-3 px-4 text-right font-semibold text-slate-800">${sale.total.toFixed(2)}</td>
                                            <td className="py-3 px-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedId(expandedId === sale.id ? null : sale.id)}
                                                    className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                                    title={expandedId === sale.id ? 'Ocultar detalle' : 'Ver detalle'}
                                                >
                                                    {expandedId === sale.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                </button>
                                            </td>
                                        </tr>
                                        {expandedId === sale.id && (
                                            <tr className="bg-amber-50/50 border-b border-slate-100">
                                                <td colSpan={showBarbero ? 7 : 6} className="py-3 px-4">
                                                    <div className="text-sm text-slate-700 space-y-1">
                                                        <p className="font-medium text-slate-800 mb-2">Detalle de la venta #{sale.numeroVenta}</p>
                                                        <ul className="list-disc list-inside space-y-0.5">
                                                            {(sale.items || []).map((item, idx) => (
                                                                <li key={idx}>
                                                                    {item.name} — {item.type === 'servicio' ? 'Servicio' : 'Producto'} × {item.quantity} — ${(item.price * item.quantity).toFixed(2)}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                        <p className="pt-1 border-t border-amber-200 mt-2">
                                                            Subtotal: ${sale.subtotal.toFixed(2)} · IVA: ${sale.iva.toFixed(2)} · Total: ${sale.total.toFixed(2)} · {sale.metodoPago}
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default SalesRecords;
