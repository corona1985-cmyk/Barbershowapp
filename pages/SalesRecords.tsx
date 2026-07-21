import React, { useEffect, useState } from 'react';
import { DataService } from '../services/data';
import { Sale, Client, Barber, AccountTier } from '../types';
import { Scissors, Loader2, Calendar, ChevronDown, ChevronUp, User, Clock, Package } from 'lucide-react';
import { useTranslation } from '../i18n';

interface SalesRecordsProps {
    accountTier?: AccountTier;
}

const SalesRecords: React.FC<SalesRecordsProps> = ({ accountTier = 'solo' }) => {
    const { t, formatDate } = useTranslation();
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
        if (clienteId == null) return t('salesRecords.walkInClient');
        const c = clients.find((x) => x.id === clienteId);
        return c ? c.nombre : t('salesRecords.clientFallback', { id: clienteId });
    };

    const getBarberName = (barberoId?: number | null) => {
        if (barberoId == null) return '—';
        const b = barbers.find((x) => x.id === barberoId);
        return b ? b.name : t('salesRecords.barberFallback', { id: barberoId });
    };

    const getPaymentMethodLabel = (method: string) => {
        const labels: Record<string, string> = {
            efectivo: t('sales.cash'),
            tarjeta: t('sales.card'),
            transferencia: t('sales.transfer'),
        };
        return labels[method] ?? method;
    };

    const formatSaleDate = (iso: string) =>
        formatDate(iso + 'T12:00:00', { day: 'numeric', month: 'short', year: 'numeric' });

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
                <p className="font-medium">{t('salesRecords.loading')}</p>
            </div>
        );
    }

    return (
        <div className="min-h-[60vh] bg-gradient-to-b from-slate-50/80 to-white">
            <div className="space-y-6 max-w-6xl mx-auto px-1">
                {/* Header con mejor jerarquía */}
                <div className="flex flex-col gap-4 sm:gap-0 sm:flex-row sm:items-center sm:justify-between pt-1">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-[#ffd427] to-[#e6bf1a] text-white shadow-lg shadow-amber-200/50">
                            <Scissors size={28} strokeWidth={2.2} />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 tracking-tight">{t('salesRecords.title')}</h1>
                            <p className="text-sm text-slate-500 mt-1">{t('salesRecords.subtitle')}</p>
                        </div>
                    </div>
                </div>

                {/* Filtros: card con acento y total destacado */}
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-md shadow-slate-200/50 overflow-hidden">
                    <div className="p-5 sm:p-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div className="flex items-center gap-2.5 text-slate-700">
                                <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
                                    <Calendar size={20} strokeWidth={2} />
                                </div>
                                <span className="font-semibold">{t('salesRecords.dateRange')}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <label className="flex items-center gap-2 text-sm text-slate-600">
                                    <span className="hidden sm:inline font-medium">{t('salesRecords.from')}</span>
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                        className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-300/60 focus:border-amber-400 transition-all shadow-sm"
                                    />
                                </label>
                                <span className="text-slate-400 font-medium">{t('salesRecords.toConnector')}</span>
                                <label className="flex items-center gap-2 text-sm text-slate-600">
                                    <span className="hidden sm:inline font-medium">{t('salesRecords.to')}</span>
                                    <input
                                        type="date"
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                        className="border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-700 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-300/60 focus:border-amber-400 transition-all shadow-sm"
                                    />
                                </label>
                            </div>
                        </div>
                        {filtered.length > 0 && (
                            <div className="mt-5 pt-5 border-t border-slate-100 flex flex-wrap items-center gap-4">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-700 text-sm font-medium">
                                    {filtered.length} {filtered.length !== 1 ? t('salesRecords.recordMany') : t('salesRecords.recordOne')}
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-50 to-amber-100/80 text-amber-800 font-bold text-base border border-amber-200/60">
                                    {t('salesRecords.periodTotal', { amount: totalInPeriod.toFixed(2) })}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Lista: cards en móvil, tabla en desktop */}
                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-md shadow-slate-200/50 overflow-hidden">
                    {filtered.length === 0 ? (
                        <div className="py-20 px-6 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center mx-auto mb-5 border border-slate-100">
                                <Scissors size={32} className="text-slate-400" />
                            </div>
                            <p className="text-slate-700 font-semibold text-lg">{t('salesRecords.emptyTitle')}</p>
                            <p className="text-slate-500 text-sm mt-2">{t('salesRecords.emptyHint')}</p>
                        </div>
                    ) : (
                    <>
                        {/* Desktop: tabla */}
                        <div className="hidden md:block overflow-x-auto table-wrapper">
                            <table className="w-full text-left min-w-[640px]">
                                <thead>
                                    <tr className="bg-gradient-to-r from-slate-50 to-slate-50/80 text-slate-600 text-xs font-semibold uppercase tracking-wider border-b-2 border-slate-200">
                                        <th className="py-4 px-5">{t('salesRecords.dateColumn')}</th>
                                        <th className="py-4 px-5">{t('salesRecords.timeColumn')}</th>
                                        <th className="py-4 px-5">{t('salesRecords.clientColumn')}</th>
                                        {showBarbero && <th className="py-4 px-5">{t('salesRecords.barberColumn')}</th>}
                                        <th className="py-4 px-5">{t('salesRecords.itemsColumn')}</th>
                                        <th className="py-4 px-5 text-right">{t('salesRecords.totalColumn')}</th>
                                        <th className="py-4 px-3 w-12" aria-label={t('salesRecords.detailColumn')} />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filtered.map((sale) => (
                                        <React.Fragment key={sale.id}>
                                            <tr className="hover:bg-amber-50/40 transition-colors group">
                                                <td className="py-4 px-5 text-slate-700 font-medium">{formatSaleDate(sale.fecha)}</td>
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
                                                            <span className="text-slate-400"> {t('salesRecords.moreItems', { count: (sale.items?.length ?? 0) - 2 })}</span>
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="py-4 px-5 text-right">
                                                    <span className="font-bold text-slate-800 tabular-nums">${sale.total.toFixed(2)}</span>
                                                </td>
                                                <td className="py-4 px-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setExpandedId(expandedId === sale.id ? null : sale.id)}
                                                        className="p-2 rounded-xl text-slate-400 hover:bg-amber-100 hover:text-amber-700 transition-colors"
                                                        title={expandedId === sale.id ? t('salesRecords.hideDetail') : t('salesRecords.showDetail')}
                                                    >
                                                        {expandedId === sale.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                                    </button>
                                                </td>
                                            </tr>
                                            {expandedId === sale.id && (
                                                <tr className="bg-amber-50/50">
                                                    <td colSpan={showBarbero ? 7 : 6} className="py-4 px-5">
                                                        <div className="rounded-xl bg-white border border-amber-200/60 shadow-sm p-4 text-sm">
                                                            <p className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
                                                                <Package size={16} className="text-amber-600" />
                                                                {t('salesRecords.detailTitle', { number: sale.numeroVenta })}
                                                            </p>
                                                            <div className="flex flex-wrap gap-2 mb-3">
                                                                {(sale.items || []).map((item, idx) => (
                                                                    <span
                                                                        key={idx}
                                                                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium ${item.type === 'servicio' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}
                                                                    >
                                                                        {item.name} × {item.quantity} — ${(item.price * item.quantity).toFixed(2)}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                            <p className="text-slate-500 border-t border-slate-100 pt-3">
                                                                {t('salesRecords.summaryLine', {
                                                                    subtotal: sale.subtotal.toFixed(2),
                                                                    tax: sale.iva.toFixed(2),
                                                                    total: sale.total.toFixed(2),
                                                                    method: getPaymentMethodLabel(sale.metodoPago),
                                                                })}
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

                        {/* Móvil: cards con borde acento y mejor espaciado */}
                        <div className="md:hidden p-3 space-y-3">
                            {filtered.map((sale) => (
                                <div
                                    key={sale.id}
                                    className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow"
                                >
                                    <button
                                        type="button"
                                        onClick={() => setExpandedId(expandedId === sale.id ? null : sale.id)}
                                        className="w-full text-left p-4 flex justify-between items-start gap-3 active:bg-slate-50/50 transition-colors"
                                    >
                                        <div className="min-w-0 flex-1 border-l-4 border-amber-400 pl-3">
                                            <p className="font-semibold text-slate-800 truncate">{getClientName(sale.clienteId)}</p>
                                            <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-1">
                                                <Clock size={12} className="text-slate-400 shrink-0" />
                                                {formatSaleDate(sale.fecha)} · {sale.hora}
                                            </p>
                                            <p className="text-sm text-slate-600 mt-1">
                                                {(sale.items || []).slice(0, 2).map((i) => i.name).join(', ')}
                                                {(sale.items?.length ?? 0) > 2 && ` +${(sale.items?.length ?? 0) - 2}`}
                                            </p>
                                            {showBarbero && (
                                                <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-1">
                                                    <User size={12} /> {getBarberName(sale.barberoId)}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className="font-bold text-slate-800 tabular-nums text-base">${sale.total.toFixed(2)}</span>
                                            <span className={`p-1.5 rounded-lg transition-colors ${expandedId === sale.id ? 'bg-amber-100 text-amber-700' : 'text-slate-400'}`}>
                                                {expandedId === sale.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                                            </span>
                                        </div>
                                    </button>
                                    {expandedId === sale.id && (
                                        <div className="mx-3 mb-3 rounded-xl bg-gradient-to-br from-amber-50/80 to-slate-50 border border-amber-100 p-4 text-sm">
                                            <p className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
                                                <Package size={14} className="text-amber-600" />
                                                {sale.numeroVenta}
                                            </p>
                                            <ul className="space-y-2">
                                                {(sale.items || []).map((item, idx) => (
                                                    <li key={idx} className="flex justify-between text-slate-600">
                                                        <span>{item.name} × {item.quantity}</span>
                                                        <span className="font-medium tabular-nums">${(item.price * item.quantity).toFixed(2)}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                            <p className="text-slate-500 text-xs mt-3 pt-3 border-t border-slate-200">
                                                Subtotal ${sale.subtotal.toFixed(2)} · {t('invoiceDoc.tax')} ${sale.iva.toFixed(2)} · {getPaymentMethodLabel(sale.metodoPago)}
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
        </div>
    );
};

export default SalesRecords;
