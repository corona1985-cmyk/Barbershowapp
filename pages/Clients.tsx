import React, { useEffect, useMemo, useState } from 'react';
import { DataService } from '../services/data';
import { Appointment, Client, PointOfSale, Sale, ViewState } from '../types';
import {
    Ban, Calendar, CheckCircle, Clock, Edit2, Loader2, MapPin, MessageCircle,
    Phone, Plus, RefreshCw, Search, Star, StickyNote, Trophy, Upload, User, Users, X,
} from 'lucide-react';
import { useTranslation } from '../i18n';

function phoneDigits(phone: string | number | null | undefined): string {
    return String(phone ?? '').replace(/\D/g, '');
}

function getTodayLocal(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function lastVisitOf(clientId: number, appts: Appointment[], sales: Sale[], fallback: string): string {
    const fromAppts = appts.filter(a => a.clienteId === clientId && a.estado === 'completada').map(a => a.fecha);
    const fromSales = sales.filter(s => s.clienteId === clientId && s.estado !== 'cancelada').map(s => s.fecha);
    const all = [...fromAppts, ...fromSales].sort().reverse();
    const latest = all[0];
    if (latest) return latest;
    if (fallback && fallback !== 'N/A') return fallback;
    return '';
}

function nextVisitOf(clientId: number, appts: Appointment[]): Appointment | null {
    const today = getTodayLocal();
    const upcoming = appts
        .filter(a => a.clienteId === clientId && a.estado !== 'cancelada' && a.estado !== 'completada' && a.fecha >= today)
        .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora));
    return upcoming[0] || null;
}

interface ClientsProps {
    onChangeView?: (view: ViewState) => void;
    onBookClient?: (clientId: number) => void;
}

const emptyForm: Partial<Client> = {
    nombre: '',
    telefono: '',
    email: '',
    notas: '',
    photoUrl: '',
    puntos: 0,
    status: 'active',
};

const Clients: React.FC<ClientsProps> = ({ onChangeView, onBookClient }) => {
    const { t, formatDate } = useTranslation();
    const [loading, setLoading] = useState(true);
    const [clients, setClients] = useState<Client[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [sales, setSales] = useState<Sale[]>([]);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isAdmin, setIsAdmin] = useState(false);
    const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([]);
    const [userRole, setUserRole] = useState<string>('');
    const [currentClient, setCurrentClient] = useState<Partial<Client>>(emptyForm);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const isBarbero = userRole === 'barbero';

    const loadLists = async (role: string) => {
        const clientsLoader = role === 'barbero'
            ? DataService.refreshClientsWithActivity()
            : DataService.refreshClients();
        const [clientsList, posList, apptsList, salesList] = await Promise.all([
            clientsLoader,
            DataService.getPointsOfSale(),
            DataService.getAppointments(),
            DataService.getSales(),
        ]);
        setClients(clientsList);
        setPointsOfSale(posList);
        setAppointments(Array.isArray(apptsList) ? apptsList : []);
        setSales(Array.isArray(salesList) ? salesList : []);
        return clientsList;
    };

    useEffect(() => {
        const role = DataService.getCurrentUserRole();
        setUserRole(role);
        setIsAdmin(['admin', 'superadmin'].includes(role));
        setLoading(true);
        loadLists(role).finally(() => setLoading(false));
    }, []);

    const handleEditClick = (client: Client, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setCurrentClient(client);
        setIsEditing(true);
        setSaveError('');
        setShowModal(true);
    };

    const handleCreateClick = () => {
        setCurrentClient({ ...emptyForm });
        setIsEditing(false);
        setSaveError('');
        setShowModal(true);
    };

    const handleToggleStatus = async (client: Client, e?: React.MouseEvent) => {
        e?.stopPropagation();
        if (confirm(client.status === 'active'
            ? t('crm.suspendConfirm', { name: client.nombre })
            : t('crm.reactivateConfirm', { name: client.nombre }))) {
            await DataService.toggleClientStatus(client.id);
            await loadLists(userRole);
        }
    };

    const handleRefreshClients = async () => {
        setRefreshing(true);
        try {
            await loadLists(userRole);
        } finally {
            setRefreshing(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCurrentClient(prev => ({ ...prev, photoUrl: reader.result as string }));
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveClient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentClient.nombre?.trim() || !currentClient.telefono?.trim()) {
            setSaveError(t('crm.namePhoneRequired'));
            return;
        }
        setSaving(true);
        setSaveError('');
        try {
            if (isEditing && currentClient.id) {
                await DataService.updateClient(currentClient as Client);
                await loadLists(userRole);
            } else {
                const client = await DataService.addClientOrGetExisting({
                    ...currentClient as Omit<Client, 'id' | 'posId'>,
                    fechaRegistro: new Date().toISOString().split('T')[0],
                    ultimaVisita: currentClient.ultimaVisita || '',
                });
                const merged = {
                    ...client,
                    ...currentClient,
                    id: client.id,
                    posId: client.posId,
                    fechaRegistro: client.fechaRegistro,
                } as Client;
                await DataService.updateClient(merged);
                await loadLists(userRole);
                setClients(prev => prev.some(c => c.id === merged.id) ? prev : [merged, ...prev]);
                setSelectedId(merged.id);
            }
            setShowModal(false);
        } catch {
            setSaveError(t('crm.saveFailed'));
        } finally {
            setSaving(false);
        }
    };

    const getPosName = (posId: number) => {
        const pos = pointsOfSale.find(p => p.id === posId);
        return pos ? pos.name : `Sede #${posId}`;
    };

    const formatRegDate = (iso: string) => {
        if (!iso) return '—';
        const d = new Date(iso + 'T12:00:00');
        if (Number.isNaN(d.getTime())) return iso;
        return formatDate(d, { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const filtered = clients.filter(c =>
        c.nombre.toLowerCase().includes(search.toLowerCase()) || String(c.telefono ?? '').includes(search)
    );

    const topClients = [...clients].filter(c => (c.puntos || 0) > 0).sort((a, b) => b.puntos - a.puntos).slice(0, 5);

    const selected = clients.find(c => c.id === selectedId) || null;
    const selectedHistory = useMemo(() => {
        if (!selected) return [];
        return appointments
            .filter(a => a.clienteId === selected.id)
            .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.hora.localeCompare(a.hora))
            .slice(0, 8);
    }, [selected, appointments]);
    const selectedSales = useMemo(() => {
        if (!selected) return [];
        return sales
            .filter(s => s.clienteId === selected.id && s.estado !== 'cancelada')
            .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.hora.localeCompare(a.hora))
            .slice(0, 8);
    }, [selected, sales]);

    const openWhatsApp = (client: Client) => {
        const num = phoneDigits(client.telefono);
        if (num.length < 10) {
            alert(t('crm.noPhoneWa'));
            return;
        }
        window.open(`https://wa.me/${num}`, '_blank', 'noopener,noreferrer');
    };

    const statusBadge = (status: Client['status']) => (
        <span className={`inline-flex px-2.5 py-1 rounded-lg text-xs font-semibold ${
            status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
        }`}>
            {status === 'active' ? t('crm.active') : t('crm.suspended')}
        </span>
    );

    const avatar = (client: Pick<Client, 'nombre' | 'photoUrl'>, size = 'w-11 h-11') => (
        client.photoUrl ? (
            <img src={client.photoUrl} alt={client.nombre} className={`${size} rounded-full object-cover border-2 border-slate-100 shadow-sm shrink-0`} />
        ) : (
            <div className={`${size} rounded-full bg-[#ffd427]/20 flex items-center justify-center text-[#c9a000] font-bold text-lg shrink-0`}>
                {(client.nombre || '?').charAt(0).toUpperCase()}
            </div>
        )
    );

    const clientRowMeta = (c: Client) => {
        const last = lastVisitOf(c.id, appointments, sales, c.ultimaVisita);
        const next = nextVisitOf(c.id, appointments);
        return { last, next };
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                <Loader2 className="animate-spin mb-4 text-[#ffd427]" size={48} />
                <p className="font-medium">{t('crm.loading')}</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            <div className="lg:col-span-3 space-y-6">
                {isBarbero && (
                    <div className="bg-amber-50/80 border border-amber-200/80 text-amber-800 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
                        <Users size={18} className="shrink-0" />
                        {t('crm.barberHint')}
                    </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-[#ffd427]/15 text-[#c9a000]">
                            <User size={26} strokeWidth={2} />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 tracking-tight">{t('crm.title')}</h1>
                            <p className="text-sm text-slate-500 mt-0.5">{isBarbero ? t('crm.subtitle') : t('crm.subtitleAdmin')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={handleRefreshClients}
                            disabled={refreshing}
                            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors disabled:opacity-50 min-h-[44px] min-w-[44px]"
                            title={t('crm.refresh')}
                        >
                            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                        </button>
                        <button
                            type="button"
                            onClick={handleCreateClick}
                            className="bg-[#ffd427] hover:bg-[#e6be23] text-slate-900 px-4 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors shadow-sm min-h-[44px]"
                        >
                            <Plus size={18} />
                            <span>{t('crm.newClient')}</span>
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
                    <div className="p-4 sm:p-5 border-b border-slate-100">
                        <div className="relative max-w-md">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="text"
                                placeholder={t('crm.searchPlaceholder')}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50/80 border border-slate-200 rounded-xl text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#ffd427]/40 focus:border-[#ffd427]/50 focus:bg-white transition-all"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>
                        {filtered.length > 0 && (
                            <p className="mt-3 text-sm text-slate-500">
                                <strong className="text-slate-700">
                                    {filtered.length === 1
                                        ? t('crm.countOne', { count: filtered.length })
                                        : t('crm.countMany', { count: filtered.length })}
                                </strong>
                                {search && filtered.length !== clients.length && t('crm.ofTotal', { total: clients.length })}
                            </p>
                        )}
                    </div>

                    {filtered.length === 0 ? (
                        <div className="py-16 px-6 text-center">
                            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                                <User size={28} className="text-slate-400" />
                            </div>
                            <p className="text-slate-600 font-medium">{search ? t('crm.noSearch') : t('crm.empty')}</p>
                            <p className="text-slate-500 text-sm mt-1">
                                {search ? t('crm.noSearchHint') : (isBarbero ? t('crm.emptyHint') : t('crm.emptyHintAdmin'))}
                            </p>
                            {!search && (
                                <button
                                    type="button"
                                    onClick={handleCreateClick}
                                    className="mt-4 inline-flex items-center gap-2 bg-[#ffd427] hover:bg-[#e6be23] text-slate-900 px-4 py-2.5 rounded-xl font-bold"
                                >
                                    <Plus size={18} /> {t('crm.newClient')}
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            <div className="hidden md:block overflow-x-auto table-wrapper">
                                <table className="w-full text-left min-w-[640px]">
                                    <thead>
                                        <tr className="bg-slate-50/90 text-slate-500 text-xs font-semibold uppercase tracking-wider border-b border-slate-200">
                                            <th className="py-4 px-5">{t('appointments.client')}</th>
                                            <th className="py-4 px-5">{t('crm.lastVisit')}</th>
                                            <th className="py-4 px-5">{t('common.phone')}</th>
                                            <th className="py-4 px-5">{t('crm.points')}</th>
                                            <th className="py-4 px-5">{t('crm.status')}</th>
                                            <th className="py-4 px-5 text-right w-28"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filtered.map(c => {
                                            const { last, next } = clientRowMeta(c);
                                            return (
                                                <tr
                                                    key={c.id}
                                                    onClick={() => setSelectedId(c.id)}
                                                    className={`cursor-pointer hover:bg-amber-50/30 transition-colors ${c.status === 'suspended' ? 'bg-red-50/50' : ''} ${selectedId === c.id ? 'bg-amber-50/60' : ''}`}
                                                >
                                                    <td className="py-4 px-5">
                                                        <div className="flex items-center gap-3">
                                                            {avatar(c)}
                                                            <div>
                                                                <div className="font-semibold text-slate-800">{c.nombre}</div>
                                                                <div className="text-xs text-slate-500 mt-0.5">{t('crm.registered', { date: formatRegDate(c.fechaRegistro) })}</div>
                                                                {next && (
                                                                    <div className="text-xs text-amber-700 mt-0.5">
                                                                        {t('crm.nextVisit', { date: formatRegDate(next.fecha), time: next.hora })}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-5 text-sm text-slate-600">
                                                        {last ? formatRegDate(last) : t('crm.lastVisitNever')}
                                                    </td>
                                                    <td className="py-4 px-5">
                                                        <div className="flex items-center gap-1.5 text-slate-700 text-sm font-medium">
                                                            <Phone size={14} className="text-slate-400 shrink-0" />
                                                            {c.telefono}
                                                        </div>
                                                        <div className="text-xs text-slate-400 mt-0.5">{c.email || t('crm.noEmail')}</div>
                                                    </td>
                                                    <td className="py-4 px-5">
                                                        <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-800 px-2.5 py-1 rounded-lg w-fit border border-amber-100">
                                                            <Star size={14} className="fill-amber-400 text-amber-400 shrink-0" />
                                                            <span className="font-bold text-sm">{c.puntos || 0}</span>
                                                        </span>
                                                    </td>
                                                    <td className="py-4 px-5">{statusBadge(c.status)}</td>
                                                    <td className="py-4 px-5 text-right">
                                                        <div className="flex justify-end gap-1">
                                                            {phoneDigits(c.telefono).length >= 10 && (
                                                                <button type="button" onClick={(e) => { e.stopPropagation(); openWhatsApp(c); }} className="p-2 rounded-lg text-green-600 hover:bg-green-50" title={t('crm.whatsapp')}>
                                                                    <MessageCircle size={18} />
                                                                </button>
                                                            )}
                                                            <button type="button" onClick={(e) => handleEditClick(c, e)} className="p-2 rounded-lg text-slate-400 hover:text-[#c9a000] hover:bg-[#ffd427]/15 transition-colors" title={t('crm.edit')}>
                                                                <Edit2 size={18} />
                                                            </button>
                                                            {isAdmin && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => handleToggleStatus(c, e)}
                                                                    className={`p-2 rounded-lg transition-colors ${c.status === 'active' ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50'}`}
                                                                    title={c.status === 'active' ? t('crm.suspend') : t('crm.reactivate')}
                                                                >
                                                                    {c.status === 'active' ? <Ban size={18} /> : <CheckCircle size={18} />}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="md:hidden divide-y divide-slate-100">
                                {filtered.map(c => {
                                    const { last, next } = clientRowMeta(c);
                                    return (
                                        <button
                                            type="button"
                                            key={c.id}
                                            onClick={() => setSelectedId(c.id)}
                                            className={`w-full text-left p-4 ${c.status === 'suspended' ? 'bg-red-50/50' : ''}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                {avatar(c, 'w-12 h-12')}
                                                <div className="min-w-0 flex-1">
                                                    <p className="font-semibold text-slate-800 truncate">{c.nombre}</p>
                                                    <p className="text-xs text-slate-500 mt-0.5">{last ? `${t('crm.lastVisit')}: ${formatRegDate(last)}` : t('crm.lastVisitNever')}</p>
                                                    {next && (
                                                        <p className="text-xs text-amber-700 mt-0.5">{t('crm.nextVisit', { date: formatRegDate(next.fecha), time: next.hora })}</p>
                                                    )}
                                                    <div className="flex items-center gap-1.5 mt-2 text-sm text-slate-700">
                                                        <Phone size={14} className="text-slate-400" />
                                                        {c.telefono}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2 mt-2">
                                                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 px-2 py-0.5 rounded text-xs font-bold">
                                                            <Star size={12} className="fill-amber-400" /> {c.puntos || 0}
                                                        </span>
                                                        {statusBadge(c.status)}
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="lg:col-span-1 space-y-6">
                <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-6 text-white shadow-lg border-t-4 border-[#ffd427]">
                    <div className="flex items-center space-x-2 mb-4">
                        <Trophy className="text-[#ffd427]" />
                        <h3 className="font-bold text-lg text-[#ffd427]">{t('crm.vipTitle')}</h3>
                    </div>
                    <p className="text-slate-400 text-sm mb-4">{t('crm.vipSubtitle')}</p>
                    {topClients.length === 0 ? (
                        <p className="text-slate-400 text-sm">{t('crm.vipEmpty')}</p>
                    ) : (
                        <div className="space-y-3">
                            {topClients.map((client, idx) => (
                                <button
                                    type="button"
                                    key={client.id}
                                    onClick={() => setSelectedId(client.id)}
                                    className="w-full flex items-center justify-between p-3 bg-white/5 rounded-lg backdrop-blur-sm border border-white/10 hover:bg-white/10 text-left"
                                >
                                    <div className="flex items-center space-x-3 min-w-0">
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                                            idx === 0 ? 'bg-[#ffd427] text-slate-900' :
                                            idx === 1 ? 'bg-slate-300 text-slate-800' :
                                            idx === 2 ? 'bg-orange-400 text-orange-900' : 'bg-slate-700 text-white'
                                        }`}>
                                            {idx + 1}
                                        </div>
                                        <span className="font-medium text-sm truncate">{client.nombre}</span>
                                    </div>
                                    <div className="flex items-center text-[#ffd427] font-bold text-sm shrink-0">
                                        <Star size={12} className="fill-[#ffd427] mr-1" />
                                        {client.puntos}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {selected && (
                <>
                    <div className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm" onClick={() => setSelectedId(null)} aria-hidden />
                    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 pointer-events-none sm:items-center sm:p-4">
                        <div
                            className="flex max-h-[86vh] w-full min-w-0 flex-col rounded-t-2xl border-t border-slate-200 bg-white shadow-2xl pointer-events-auto sm:max-w-lg sm:rounded-2xl sm:border"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="client-sheet-title"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-4">
                                <div className="flex items-center gap-3 min-w-0">
                                    {avatar(selected, 'w-14 h-14')}
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{t('crm.sheetTitle')}</p>
                                        <h3 id="client-sheet-title" className="truncate text-lg font-bold text-slate-800">{selected.nombre}</h3>
                                        {statusBadge(selected.status)}
                                    </div>
                                </div>
                                <button type="button" onClick={() => setSelectedId(null)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-200" aria-label={t('common.cancel')}>
                                    <X size={22} />
                                </button>
                            </div>
                            <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="rounded-xl bg-slate-50 p-3">
                                        <p className="text-xs text-slate-500">{t('common.phone')}</p>
                                        <p className="font-semibold text-slate-800 break-all">{selected.telefono || t('common.noPhone')}</p>
                                    </div>
                                    <div className="rounded-xl bg-slate-50 p-3">
                                        <p className="text-xs text-slate-500">{t('crm.lastVisit')}</p>
                                        <p className="font-semibold text-slate-800">{lastVisitOf(selected.id, appointments, sales, selected.ultimaVisita) ? formatRegDate(lastVisitOf(selected.id, appointments, sales, selected.ultimaVisita)) : t('crm.lastVisitNever')}</p>
                                    </div>
                                    <div className="rounded-xl bg-slate-50 p-3 col-span-2">
                                        <p className="text-xs text-slate-500 flex items-center gap-1"><MapPin size={12} /> {t('crm.originPos')}</p>
                                        <p className="font-medium text-slate-800">{getPosName(selected.posId)}</p>
                                    </div>
                                </div>
                                {selected.notas && (
                                    <div className="rounded-xl border border-slate-100 p-3 text-sm text-slate-700">
                                        <p className="text-xs font-semibold text-slate-500 mb-1 flex items-center gap-1"><StickyNote size={12} /> {t('crm.notes')}</p>
                                        {selected.notas}
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    {phoneDigits(selected.telefono).length >= 10 && (
                                        <button type="button" onClick={() => openWhatsApp(selected)} className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-600 text-white font-semibold">
                                            <MessageCircle size={18} /> {t('crm.whatsapp')}
                                        </button>
                                    )}
                                    {phoneDigits(selected.telefono).length >= 7 && (
                                        <a href={`tel:${phoneDigits(selected.telefono)}`} className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold">
                                            <Phone size={18} /> {t('crm.call')}
                                        </a>
                                    )}
                                    <button type="button" onClick={() => handleEditClick(selected)} className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold">
                                        <Edit2 size={18} /> {t('crm.edit')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (onBookClient) onBookClient(selected.id);
                                            else onChangeView?.('appointments');
                                        }}
                                        className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#ffd427] text-slate-900 font-bold"
                                    >
                                        <Calendar size={18} /> {t('crm.book')}
                                    </button>
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 mb-2">{t('crm.history')}</h4>
                                    {selectedHistory.length === 0 ? (
                                        <p className="text-sm text-slate-500">{t('crm.historyEmpty')}</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {selectedHistory.map(a => (
                                                <div key={a.id} className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 p-3">
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-800 flex items-center gap-1"><Clock size={14} /> {formatRegDate(a.fecha)} · {a.hora}</p>
                                                        <p className="text-xs text-slate-500 mt-0.5">{a.servicios?.length ? a.servicios.map(s => s.name).join(', ') : t('appointments.noServices')}</p>
                                                    </div>
                                                    <span className="text-[11px] font-semibold uppercase text-slate-500">{t(`appointments.status.${a.estado}`)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <h4 className="font-bold text-slate-800 mb-2">{t('crm.purchases')}</h4>
                                    {selectedSales.length === 0 ? (
                                        <p className="text-sm text-slate-500">{t('crm.purchasesEmpty')}</p>
                                    ) : (
                                        <div className="space-y-2">
                                            {selectedSales.map(s => (
                                                <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-100 p-3">
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-800">{s.numeroVenta}</p>
                                                        <p className="text-xs text-slate-500">{formatRegDate(s.fecha)} · {s.hora}</p>
                                                    </div>
                                                    <span className="font-bold text-emerald-600">${s.total.toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {showModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-xl font-bold text-slate-800">{isEditing ? t('crm.editTitle') : t('crm.createTitle')}</h3>
                            <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                        </div>
                        <form onSubmit={handleSaveClient} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
                            {saveError && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg p-3">{saveError}</p>}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">{t('crm.photo')}</label>
                                <div className="flex items-center space-x-4">
                                    <div className="relative group">
                                        <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden border-2 border-slate-200">
                                            {currentClient.photoUrl ? (
                                                <img src={currentClient.photoUrl} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <User size={32} className="text-slate-400" />
                                            )}
                                        </div>
                                        <label className="absolute bottom-0 right-0 bg-[#ffd427] text-slate-900 p-1.5 rounded-full cursor-pointer hover:bg-[#e6be23] shadow-md">
                                            <Upload size={14} />
                                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                                        </label>
                                    </div>
                                    <div className="flex-1">
                                        <input
                                            type="text"
                                            className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ffd427] mb-2"
                                            placeholder={t('crm.photoUrlPlaceholder')}
                                            value={currentClient.photoUrl}
                                            onChange={e => setCurrentClient({...currentClient, photoUrl: e.target.value})}
                                        />
                                        <p className="text-xs text-slate-500">{t('crm.photoHint')}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('crm.fullName')} *</label>
                                    <input type="text" required className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427]" value={currentClient.nombre} onChange={e => setCurrentClient({...currentClient, nombre: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('common.phone')} *</label>
                                    <input type="tel" required className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427]" value={currentClient.telefono} onChange={e => setCurrentClient({...currentClient, telefono: e.target.value})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                <input type="email" className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427]" value={currentClient.email} onChange={e => setCurrentClient({...currentClient, email: e.target.value})} />
                            </div>
                            {isAdmin && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('crm.loyaltyPoints')}</label>
                                    <input
                                        type="number"
                                        min={0}
                                        className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427] placeholder:text-gray-400"
                                        value={currentClient.puntos === 0 ? '' : currentClient.puntos}
                                        placeholder="0"
                                        onChange={e => {
                                            const v = e.target.value;
                                            setCurrentClient({ ...currentClient, puntos: v === '' ? 0 : Number(v) });
                                        }}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('crm.status')}</label>
                                    <select className="w-full border border-slate-300 rounded-lg p-2.5" value={currentClient.status} onChange={e => setCurrentClient({...currentClient, status: e.target.value as Client['status']})}>
                                        <option value="active">{t('crm.active')}</option>
                                        <option value="suspended">{t('crm.suspended')}</option>
                                    </select>
                                </div>
                            </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{t('crm.notes')}</label>
                                <textarea className="w-full border border-slate-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427]" rows={2} placeholder={t('crm.notesPlaceholder')} value={currentClient.notas} onChange={e => setCurrentClient({...currentClient, notas: e.target.value})}></textarea>
                            </div>
                            <div className="pt-4 flex justify-end space-x-3 border-t border-slate-100 mt-2">
                                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg">{t('common.cancel')}</button>
                                <button type="submit" disabled={saving} className="px-6 py-2 bg-[#ffd427] text-slate-900 font-bold rounded-lg hover:bg-[#e6be23] disabled:opacity-70 flex items-center gap-2">
                                    {saving ? <><Loader2 className="animate-spin" size={16} /> {t('common.saving')}</> : t('crm.save')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Clients;
