import React, { useState, useEffect, useMemo } from 'react';
import { DataService } from '../services/data';
import { Appointment, Barber, BarberGalleryPhoto, Client, Service, AppointmentForSale, SaleItem, AccountTier } from '../types';
import { ViewState } from '../types';
import { Calendar, Clock, User, Scissors, Check, X, Trash2, Printer, MessageCircle, MapPin, Loader2, ImageIcon, RefreshCw } from 'lucide-react';
import { handlePrint } from '../utils/print';

interface AppointmentsProps {
    onChangeView?: (view: ViewState) => void;
    onCompleteForBilling?: (data: AppointmentForSale) => void;
    accountTier?: AccountTier;
}

const LOAD_TIMEOUT_MS = 22000; // 22 s: en móvil la red puede ser lenta
const SAVE_TIMEOUT_MS = 25000; // 25 s: si guardar tarda más, mostrar error y quitar "Guardando..."

/** Fecha de hoy en zona local YYYY-MM-DD (evita que UTC marque slots como "Pasado" en fechas futuras). */
const getTodayLocal = (): string => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const Appointments: React.FC<AppointmentsProps> = ({ onChangeView, onCompleteForBilling, accountTier = 'barberia' }) => {
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(getTodayLocal);
    const [userRole, setUserRole] = useState<string>('');
    const [selectedBarberForView, setSelectedBarberForView] = useState<number>(0);
    const [currentBarberiaName, setCurrentBarberiaName] = useState<string>('');
    const [clientBarberGallery, setClientBarberGallery] = useState<BarberGalleryPhoto[]>([]);
    
    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [newApt, setNewApt] = useState<Partial<Appointment>>({
        fecha: getTodayLocal(),
        servicios: []
    });
    const [isNewClient, setIsNewClient] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');
    const [searchPhone, setSearchPhone] = useState('');
    const [clientFoundByPhone, setClientFoundByPhone] = useState<Client | null>(null);
    const [searchAttempted, setSearchAttempted] = useState(false);
    /** Teléfono que el cliente (rol) ingresa en Confirmar Reserva cuando aún no está en la barbería */
    const [clientPhoneForBooking, setClientPhoneForBooking] = useState('');
    /** Guardando cita (evita doble clic y muestra feedback) */
    const [saving, setSaving] = useState(false);
    /** Clientes que no estaban en la lista (ej. eliminados o de otra sede) pero sí existen en la BD; así evitamos "Cliente Desconocido" cuando el registro sigue existiendo. */
    const [resolvedClients, setResolvedClients] = useState<Record<number, Client | null>>({});
    /** Orden de la lista: por hora o por tipo/estado (confirmadas siempre primero). */
    const [sortBy, setSortBy] = useState<'hora' | 'estado'>('hora');

    const loadData = React.useCallback(async () => {
        setLoadError(false);
        setLoading(true);
        try {
            const role = DataService.getCurrentUserRole();
            setUserRole(role);
            const clientsLoader = role === 'barbero' ? DataService.getClientsWithActivity() : DataService.getClients();
            const loadPromise = Promise.all([
                DataService.getAppointments(),
                DataService.getBarbers(),
                clientsLoader,
                DataService.getServices(),
                DataService.getPointsOfSale(),
            ]);
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Tiempo de espera agotado. Revisa tu conexión.')), LOAD_TIMEOUT_MS)
            );
            const [appts, barbersList, clientsList, servicesList, posList] = await Promise.race([loadPromise, timeoutPromise]);
            const apptsSafe = Array.isArray(appts) ? appts : [];
            const barbersSafe = Array.isArray(barbersList) ? barbersList : [];
            const clientsSafe = Array.isArray(clientsList) ? clientsList : [];
            const servicesSafe = Array.isArray(servicesList) ? servicesList : [];
            const posListSafe = Array.isArray(posList) ? posList : [];
            setAppointments(apptsSafe);
            setBarbers(barbersSafe);
            setClients(clientsSafe);
            setServices(servicesSafe);
            const activePosId = DataService.getActivePosId();
            const pos = posListSafe.find(p => p.id === activePosId);
            setCurrentBarberiaName(pos ? pos.name : '');
            const activeBarbers = barbersSafe.filter(b => b.active);
            if (activeBarbers.length > 0) setSelectedBarberForView(activeBarbers[0].id);
            if (role === 'cliente') {
                const currUser = DataService.getCurrentUser();
                if (currUser) {
                    const clientRecord = clientsSafe.find(c => c.nombre === currUser.name);
                    if (clientRecord) setNewApt(prev => ({ ...prev, clienteId: clientRecord.id }));
                }
            }
            // Resolver nombres de clientes que no están en la lista (ej. cliente eliminado de la sede pero la cita sigue)
            const missingIds = [...new Set(apptsSafe.map(a => a.clienteId).filter(id => id && !clientsSafe.some(c => c.id === id)))];
            if (missingIds.length > 0) {
                const results = await Promise.all(missingIds.map(id => DataService.getClientById(id)));
                const next: Record<number, Client | null> = {};
                missingIds.forEach((id, i) => { next[id] = results[i] ?? null; });
                setResolvedClients(next);
            } else {
                setResolvedClients({});
            }
        } catch (err) {
            console.error('Error cargando citas:', err);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // En Android: refrescar la agenda al volver a la app o a la pestaña
    useEffect(() => {
        const onVisibility = () => {
            if (document.visibilityState === 'visible') loadData();
        };
        document.addEventListener('visibilitychange', onVisibility);
        return () => document.removeEventListener('visibilitychange', onVisibility);
    }, [loadData]);

    const filteredAppointments = appointments.filter(a => a.fecha === selectedDate);
    const sortedAppointments = useMemo(() => {
        const order: Appointment['estado'][] = ['confirmada', 'pendiente', 'completada', 'cancelada'];
        const estadoRank = (e: Appointment['estado']) => order.indexOf(e);
        return [...filteredAppointments].sort((a, b) => {
            const aConfirmada = a.estado === 'confirmada' ? 1 : 0;
            const bConfirmada = b.estado === 'confirmada' ? 1 : 0;
            if (bConfirmada !== aConfirmada) return bConfirmada - aConfirmada;
            if (sortBy === 'hora') return a.hora.localeCompare(b.hora);
            return estadoRank(a.estado) - estadoRank(b.estado);
        });
    }, [filteredAppointments, sortBy]);

    const todayStr = getTodayLocal();
    const now = new Date();
    const minTimeToday = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const isDateTimeInPast = (fecha: string, hora: string): boolean => {
        const todayStrLocal = getTodayLocal();
        if (fecha < todayStrLocal) return true;
        if (fecha > todayStrLocal) return false;
        const today = new Date();
        const [h, m] = hora.split(':').map(Number);
        const slotMinutes = (h || 0) * 60 + (m || 0);
        const nowMinutes = today.getHours() * 60 + today.getMinutes();
        return slotMinutes <= nowMinutes;
    };

    const isPlanSolo = accountTier === 'solo';
    const defaultBarberId = barbers.filter(b => b.active).length > 0 ? barbers.filter(b => b.active)[0].id : barbers[0]?.id;
    /** Solo clientes activos para agendar (no suspendidos). */
    const activeClients = useMemo(() => clients.filter((c) => c.status === 'active'), [clients]);
    /** Servicios disponibles: si el usuario es barbero solo ve los suyos; si es admin ve sede + del barbero seleccionado */
    const servicesForBarber = useMemo(() => {
        const currentBarberId = DataService.getCurrentBarberId();
        if (userRole === 'barbero' && currentBarberId != null) {
            return services.filter((s) => s.barberId === currentBarberId);
        }
        const bid = newApt.barberoId ?? (isPlanSolo ? defaultBarberId : undefined);
        if (bid == null) return services.filter((s) => s.barberId == null);
        return services.filter((s) => s.barberId == null || s.barberId === bid);
    }, [services, newApt.barberoId, isPlanSolo, defaultBarberId, userRole]);

    const handleSave = async () => {
        const barberoId = isPlanSolo ? (newApt.barberoId ?? defaultBarberId) : newApt.barberoId;
        if (!barberoId) { alert('Seleccione un barbero.'); return; }
        if (!newApt.hora) { alert('Seleccione una hora.'); return; }
        if (!newApt.servicios?.length) { alert('Seleccione al menos un servicio.'); return; }
        if (newApt.fecha && isDateTimeInPast(newApt.fecha, newApt.hora)) {
            alert('No se puede agendar una cita en una fecha u hora que ya pasó.');
            return;
        }
        if (saving) return;
        setSaving(true);
        let finalClientId = newApt.clienteId;
        if (userRole === 'cliente') {
            const currUser = DataService.getCurrentUser();
            const clientRecord = clients.find(c => c.nombre === currUser?.name);
            if (clientRecord) {
                finalClientId = clientRecord.id;
            } else if ((clientPhoneForBooking || '').trim()) {
                const client = await DataService.addClientOrGetExisting({
                    nombre: (currUser?.name || 'Cliente').trim(),
                    telefono: clientPhoneForBooking.trim(),
                    email: '',
                    notas: 'Registrado al agendar cita (cliente)',
                    fechaRegistro: new Date().toISOString().split('T')[0],
                    ultimaVisita: 'N/A',
                    puntos: 0,
                    status: 'active',
                });
                finalClientId = client.id;
                if (!clients.some(c => c.id === client.id)) setClients(prev => [...prev, client]);
            }
        } else if (isNewClient) {
            if (!newClientName.trim() || !newClientPhone.trim()) {
                setSaving(false);
                alert('Ingrese nombre y teléfono del nuevo cliente.');
                return;
            }
            const client = await DataService.addClientOrGetExisting({
                nombre: newClientName.trim(),
                telefono: newClientPhone.trim(),
                email: '',
                notas: 'Registrado al agendar cita',
                fechaRegistro: new Date().toISOString().split('T')[0],
                ultimaVisita: 'N/A',
                puntos: 0,
                status: 'active',
            });
            finalClientId = client.id;
            if (!clients.some(c => c.id === client.id)) setClients([...clients, client]);
        }
        if (!finalClientId) {
            setSaving(false);
            if (userRole === 'cliente') {
                alert('Ingresa tu número de teléfono abajo para confirmar la reserva.');
            } else {
                alert('Seleccione un cliente o agregue uno nuevo (nombre y teléfono).');
            }
            return;
        }
        const clientRecord = clients.find(c => c.id === finalClientId);
        if (clientRecord && !String(clientRecord.telefono ?? '').trim()) {
            setSaving(false);
            alert('El cliente debe tener un número de teléfono para confirmar la cita. Edite el cliente o use "Buscar por teléfono".');
            return;
        }
        const total = newApt.servicios!.reduce((acc, s) => acc + s.price, 0);
        const duration = newApt.servicios!.reduce((acc, s) => acc + s.duration, 0);
        const existingSameBarberDate = appointments.filter(
            (a) => a.fecha === newApt.fecha && a.barberoId === barberoId && a.estado !== 'cancelada'
        );
        const newStart = timeToMinutes(newApt.hora!);
        const overlaps = existingSameBarberDate.some((a) => {
            const otherStart = timeToMinutes(a.hora);
            const otherDur = a.duracionTotal ?? 30;
            return timeRangesOverlap(newStart, duration, otherStart, otherDur);
        });
        if (overlaps) {
            setSaving(false);
            alert(`No se puede agendar: la cita duraría ${duration} minutos y se solaparía con otra cita de ese barbero. Elige otra hora o menos servicios.`);
            return;
        }
        const posId = DataService.getActivePosId();
        if (posId == null) {
            setSaving(false);
            alert('No hay sede activa. Selecciona una barbería o sede antes de agendar.');
            return;
        }
        const aptData: Omit<Appointment, 'id'> = {
            posId,
            clienteId: finalClientId,
            barberoId: barberoId,
            fecha: newApt.fecha!,
            hora: newApt.hora!,
            servicios: newApt.servicios!,
            notas: newApt.notas || '',
            duracionTotal: duration,
            total: total,
            estado: 'confirmada' as const,
            fechaCreacion: new Date().toISOString()
        };
        try {
            const savePromise = DataService.addAppointment(aptData);
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('La conexión tardó demasiado. Revisa tu internet e intenta de nuevo.')), SAVE_TIMEOUT_MS)
            );
            const saved = await Promise.race([savePromise, timeoutPromise]);
            setAppointments(prev => [...prev, saved]);
            setShowModal(false);
            setNewApt(prev => ({ ...prev, hora: undefined, servicios: [], notas: '', clienteId: undefined }));
            setIsNewClient(false);
            setNewClientName('');
            setNewClientPhone('');
            setClientPhoneForBooking('');
            alert('Cita agendada con éxito.');
            await loadData();
        } catch (err) {
            console.error('Error al agendar cita:', err);
            const msg = err instanceof Error ? err.message : String(err);
            alert(msg.includes('permiso') || msg.includes('conexión') || msg.includes('tardó demasiado') ? msg : `No se pudo guardar la cita. ${msg}`);
        } finally {
            setSaving(false);
        }
    };

    const updateStatus = async (id: number, status: Appointment['estado']) => {
        const apt = appointments.find(a => a.id === id);
        if (!apt) return;
        const updated = { ...apt, estado: status };
        setAppointments(prev => prev.map(a => a.id === id ? updated : a));
        await DataService.updateAppointment(updated);
        await loadData();
    };

    const handleCompleteAndGoToBilling = async (apt: Appointment) => {
        await updateStatus(apt.id, 'completada');
        const client = clients.find(c => c.id === apt.clienteId);
        const clienteNombre = client?.nombre ?? 'Cliente';
        // Solo servicios de este barbero (o de la sede sin barbero): evita facturar servicios de otro barbero
        const serviciosDelBarbero = (apt.servicios || []).filter(
            (s) => s.barberId == null || s.barberId === apt.barberoId
        );
        const items: SaleItem[] = serviciosDelBarbero.map(s => ({
            id: s.id,
            name: s.name,
            price: s.price,
            quantity: 1,
            type: 'servicio' as const,
        }));
        const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
        if (onCompleteForBilling && onChangeView) {
            onCompleteForBilling({
                appointmentId: apt.id,
                clienteId: apt.clienteId,
                clienteNombre,
                barberoId: apt.barberoId,
                fecha: apt.fecha,
                hora: apt.hora,
                items,
                total,
            });
            onChangeView('sales');
        }
    };

    const deleteAppointment = async (id: number) => {
        if (confirm('¿Eliminar cita?')) {
            setAppointments(prev => prev.filter(a => a.id !== id));
            await DataService.deleteAppointment(id);
            await loadData();
        }
    };

    const toggleService = (service: Service) => {
        const current = newApt.servicios || [];
        const exists = current.find(s => s.id === service.id);
        if (exists) {
            setNewApt({ ...newApt, servicios: current.filter(s => s.id !== service.id) });
        } else {
            setNewApt({ ...newApt, servicios: [...current, service] });
        }
    };

    const handleSearchByPhone = async () => {
        const trimmed = searchPhone.trim();
        if (trimmed.length < 6) {
            alert('Ingrese al menos 6 dígitos para buscar.');
            return;
        }
        setSearchAttempted(true);
        const found = await DataService.findClientByPhone(trimmed);
        setClientFoundByPhone(found || null);
    };

    const handleUseClientFound = async (client: Client) => {
        const activePosId = DataService.getActivePosId();
        if (client.posId === activePosId) {
            setNewApt(prev => ({ ...prev, clienteId: client.id }));
            if (!clients.some(c => c.id === client.id)) setClients(prev => [...prev, client]);
        } else {
            const newClient = await DataService.addClient({
                nombre: client.nombre,
                telefono: String(client.telefono ?? ''),
                email: client.email || '',
                notas: client.notas || '',
                fechaRegistro: client.fechaRegistro || new Date().toISOString().split('T')[0],
                ultimaVisita: 'N/A',
                puntos: 0,
                status: 'active',
            });
            setNewApt(prev => ({ ...prev, clienteId: newClient.id }));
            setClients(prev => [...prev, newClient]);
        }
        setIsNewClient(false);
        setClientFoundByPhone(null);
        setSearchPhone('');
    };

    /** Convierte "HH:mm" a minutos desde medianoche */
    const timeToMinutes = (hora: string): number => {
        const [h, m] = hora.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    };

    /** True si el slot cae dentro del bloque [apt.hora, apt.hora + duracion) de alguna cita */
    const isSlotInsideAppointment = (slotMinutes: number, apt: Appointment): boolean => {
        const start = timeToMinutes(apt.hora);
        const duration = apt.duracionTotal ?? 30;
        const end = start + duration;
        return slotMinutes >= start && slotMinutes < end;
    };

    /** True si [start1, start1+dur1) y [start2, start2+dur2) se solapan */
    const timeRangesOverlap = (start1: number, dur1: number, start2: number, dur2: number): boolean => {
        const end1 = start1 + dur1;
        const end2 = start2 + dur2;
        return start1 < end2 && start2 < end1;
    };

    // Client Visual Grid Logic: un slot está ocupado si cae dentro de la duración de alguna cita existente
    const getBarberWorkRange = (barber: Barber | undefined, dateStr: string): { startMins: number; endMins: number } | null => {
        const day = new Date(dateStr + 'T12:00:00').getDay();
        const wh = barber?.workingHours?.[day];
        const toMins = (hora: string) => {
            const [h, m] = hora.split(':').map(Number);
            return (h || 0) * 60 + (m || 0);
        };
        if (wh) return { startMins: toMins(wh.start), endMins: toMins(wh.end) };
        if (barber?.workingHours && Object.keys(barber.workingHours).length > 0) return null;
        return { startMins: 9 * 60, endMins: 19 * 60 };
    };

    const generateTimeSlots = (date: string, barberId: number) => {
        const slots: { time: string; taken: boolean; past: boolean }[] = [];
        const barber = barbers.find(b => b.id === barberId);
        const range = getBarberWorkRange(barber, date);
        if (range === null) return slots;
        const startMins = range.startMins;
        const endMins = range.endMins;

        const today = new Date();
        const todayStrLocal = getTodayLocal();
        const nowMinutes = today.getHours() * 60 + today.getMinutes();
        const taken = appointments.filter(a => a.fecha === date && a.barberoId === barberId && a.estado !== 'cancelada');
        const toMins = (hora: string) => {
            const [h, m] = hora.split(':').map(Number);
            return (h || 0) * 60 + (m || 0);
        };
        const isBlocked = (slotMins: number) => {
            const blocks = barber?.blockedHours ?? [];
            if (blocks.some(b => b.date === date && slotMins < toMins(b.end) && slotMins + 30 > toMins(b.start))) return true;
            const day = new Date(date + 'T12:00:00').getDay();
            const lunch = barber?.lunchBreak?.[day];
            if (lunch?.start && lunch?.end && slotMins < toMins(lunch.end) && slotMins + 30 > toMins(lunch.start)) return true;
            return false;
        };

        for (let m = startMins; m < endMins; m += 30) {
            const h = Math.floor(m / 60);
            const min = m % 60;
            const timeStr = h.toString().padStart(2, '0') + ':' + (min === 0 ? '00' : '30');
            const blocked = isBlocked(m);
            const isTaken = !blocked && taken.some(a => isSlotInsideAppointment(m, a));
            const past = date < todayStrLocal || (date === todayStrLocal && m <= nowMinutes);
            slots.push({ time: timeStr, taken: blocked || isTaken, past });
        }
        return slots;
    };

    const handleSlotClick = (time: string, taken: boolean, past?: boolean) => {
        if (taken || past) return;
        const current = newApt.servicios || [];
        const soloDelBarbero = current.filter((s) => s.barberId == null || s.barberId === selectedBarberForView);
        setNewApt({
            ...newApt,
            fecha: selectedDate,
            hora: time,
            barberoId: selectedBarberForView,
            servicios: soloDelBarbero
        });
        setShowModal(true);
    };

    // Solo clientes ven "Reservar Cita" (elegir barbero/fecha/hora). Superadmin, admin y barbero ven "Agenda de Citas" para agendar.
    const role = (userRole || '').toLowerCase();
    const isClientView = role === 'cliente';
    useEffect(() => {
        if (isClientView) DataService.getBarbers().then(setBarbers);
    }, [isClientView, selectedDate]);
    useEffect(() => {
        if (isClientView && selectedBarberForView) {
            DataService.getBarberGallery(selectedBarberForView).then(setClientBarberGallery).catch(() => setClientBarberGallery([]));
        } else setClientBarberGallery([]);
    }, [isClientView, selectedBarberForView]);

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                <Loader2 className="animate-spin mb-4" size={48} />
                <p className="font-medium">Cargando citas...</p>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-slate-600 max-w-md mx-auto text-center px-4">
                <p className="font-medium mb-2">No se pudo cargar la agenda.</p>
                <p className="text-sm text-slate-500 mb-6">Revisa tu conexión a internet e intenta de nuevo.</p>
                <button
                    type="button"
                    onClick={() => loadData()}
                    className="bg-[#ffd427] hover:bg-[#e6be23] text-slate-900 font-semibold px-6 py-3 rounded-xl transition-colors"
                >
                    Reintentar
                </button>
            </div>
        );
    }

    // Render for Clients (Visual Grid - Reservar Cita)
    if (isClientView) {
        const slots = generateTimeSlots(selectedDate, selectedBarberForView);
        const currentBarber = barbers.find(b => b.id === selectedBarberForView);
        
        return (
            <div className="space-y-6">
                <div className="flex flex-wrap gap-3">
                    {currentBarberiaName && (
                        <div className="flex items-center gap-2 bg-[#ffd427]/20 border border-[#ffd427]/50 text-slate-800 px-4 py-3 rounded-xl">
                            <MapPin size={20} className="text-[#ffd427] flex-shrink-0" />
                            <span className="font-semibold">Barbería:</span>
                            <span>{currentBarberiaName}</span>
                        </div>
                    )}
                    {currentBarber && (
                        <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 text-slate-800 px-4 py-3 rounded-xl">
                            <User size={20} className="text-slate-500 flex-shrink-0" />
                            <span className="font-semibold">Barbero:</span>
                            <span>{currentBarber.name}</span>
                        </div>
                    )}
                </div>
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-800">Reservar Cita</h2>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <div className="flex flex-col md:flex-row gap-6 mb-8">
                        {!isPlanSolo && (
                            <div className="flex-1">
                                <label className="block text-sm font-medium text-slate-700 mb-2">Seleccionar Barbero</label>
                                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                                    {barbers.map(b => (
                                        <button 
                                            key={b.id}
                                            disabled={!b.active}
                                            onClick={() => setSelectedBarberForView(b.id)}
                                            className={`px-4 py-3 rounded-lg border text-sm font-medium whitespace-nowrap transition-all flex flex-col items-center min-w-[100px] ${
                                                !b.active 
                                                ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed opacity-70' 
                                                : selectedBarberForView === b.id 
                                                    ? 'bg-[#ffd427] text-slate-900 border-[#ffd427] shadow-md transform scale-105' 
                                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                            }`}
                                        >
                                            <span>{b.name}</span>
                                            <span className={`text-[10px] mt-1 ${!b.active ? 'text-slate-400' : selectedBarberForView === b.id ? 'text-slate-800' : 'text-green-600'}`}>
                                                {b.active ? 'En línea' : 'No disponible'}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Seleccionar Fecha</label>
                            <input 
                                type="date" 
                                min={todayStr}
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="border border-slate-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427] bg-white w-full"
                            />
                        </div>
                    </div>

                    {currentBarber && clientBarberGallery.length > 0 && (
                        <div className="mb-6">
                            <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1"><ImageIcon size={18} /> Trabajos de {currentBarber.name}</h3>
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {clientBarberGallery.map((p) => (
                                    <button key={p.id} type="button" className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-slate-200 shadow-sm hover:ring-2 hover:ring-[#ffd427] focus:outline-none" onClick={() => window.open(p.imageUrl, '_blank')}>
                                        <img src={p.imageUrl} alt={p.caption || 'Trabajo'} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                        <Clock className="mr-2" size={20} /> Horarios Disponibles
                    </h3>
                    
                    {currentBarber?.active ? (
                        <>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                            {slots.map((slot, idx) => (
                                <button
                                    key={idx}
                                    disabled={slot.taken || slot.past}
                                    onClick={() => handleSlotClick(slot.time, slot.taken, slot.past)}
                                    className={`py-3 px-2 rounded-lg text-sm font-medium transition-all transform shadow-sm ${
                                        slot.taken || slot.past
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-transparent'
                                        : 'hover:scale-105 bg-yellow-50 text-yellow-900 border border-yellow-200 hover:bg-[#ffd427] hover:border-[#ffd427] hover:shadow-md cursor-pointer'
                                    }`}
                                >
                                    {slot.time}
                                    <span className="block text-xs mt-1 font-normal opacity-75">
                                        {slot.taken ? 'Ocupado' : slot.past ? 'Pasado' : 'Libre'}
                                    </span>
                                </button>
                            ))}
                        </div>
                        
                        <div className="mt-8 pt-6 border-t border-slate-100">
                            <div className="flex gap-4 text-sm text-slate-500">
                                <div className="flex items-center"><div className="w-3 h-3 bg-yellow-50 border border-yellow-200 rounded mr-2"></div> Disponible</div>
                                <div className="flex items-center"><div className="w-3 h-3 bg-slate-100 rounded mr-2"></div> Ocupado</div>
                            </div>
                        </div>
                        </>
                    ) : (
                        <div className="bg-slate-50 border border-slate-100 rounded-lg p-8 text-center text-slate-500">
                            <User className="mx-auto mb-2 text-slate-300" size={32} />
                            <p>El barbero seleccionado no está disponible en este momento.</p>
                            <p className="text-sm mt-1">Por favor selecciona otro barbero activo.</p>
                        </div>
                    )}
                </div>

                {/* Modal Reuse */}
                {showModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                                <h3 className="text-xl font-bold text-slate-800">Confirmar Reserva</h3>
                                <button onClick={() => { setShowModal(false); setClientPhoneForBooking(''); setNewApt(prev => ({ ...prev, servicios: [] })); }} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="bg-yellow-50 p-4 rounded-lg text-yellow-800 text-sm border border-yellow-100">
                                    {currentBarberiaName && (
                                        <p className="mb-2 flex items-center gap-1">
                                            <MapPin size={14} /> <strong>{currentBarberiaName}</strong>
                                        </p>
                                    )}
                                    Reservando para el <strong className="font-bold">{selectedDate}</strong> a las <strong className="font-bold">{newApt.hora}</strong> con <strong className="font-bold">{barbers.find(b => b.id === newApt.barberoId)?.name}</strong>.
                                </div>
                                
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-2">Selecciona tus Servicios</label>
                                    <div className="space-y-2 border border-slate-200 rounded-lg p-2 max-h-48 overflow-y-auto">
                                        {servicesForBarber.map(s => (
                                            <label key={s.id} className="flex items-center space-x-2 p-2 rounded hover:bg-slate-50 cursor-pointer transition-colors">
                                                <input 
                                                    type="checkbox" 
                                                    className="rounded text-yellow-600 focus:ring-[#ffd427] h-4 w-4"
                                                    checked={!!newApt.servicios?.find(srv => srv.id === s.id)}
                                                    onChange={() => toggleService(s)}
                                                />
                                                <div className="flex-1 flex justify-between items-center ml-2">
                                                    <span className="text-slate-700">{s.name}</span>
                                                    <span className="font-semibold text-slate-600">${s.price}</span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                    {(!newApt.servicios || newApt.servicios.length === 0) && (
                                        <p className="text-xs text-red-500 mt-1">* Selecciona al menos un servicio</p>
                                    )}
                                </div>
                                {/* Cliente: mostrar nombre y, si no está en la barbería, pedir teléfono */}
                                {userRole === 'cliente' && (
                                    <div className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                                        <p className="text-sm font-medium text-slate-700">Datos para la reserva</p>
                                        {newApt.clienteId ? (
                                            <p className="text-slate-600 text-sm">Reservando a nombre de: <strong>{clients.find(c => c.id === newApt.clienteId)?.nombre}</strong></p>
                                        ) : (
                                            <>
                                                <div>
                                                    <label className="block text-xs text-slate-500 mb-1">Tu nombre</label>
                                                    <p className="font-medium text-slate-800">{DataService.getCurrentUser()?.name || 'Cliente'}</p>
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-slate-700 mb-1">Tu teléfono (requerido para confirmar) <span className="text-red-500">*</span></label>
                                                    <input
                                                        type="tel"
                                                        className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-[#ffd427]"
                                                        placeholder="Ej: 555 123 4567"
                                                        value={clientPhoneForBooking}
                                                        onChange={e => setClientPhoneForBooking(e.target.value)}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                                {userRole !== 'cliente' && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Tu Nombre (Confirmación)</label>
                                        <select className="w-full border border-slate-300 rounded-lg p-2" value={newApt.clienteId || ''} onChange={e => setNewApt({...newApt, clienteId: Number(e.target.value)})}>
                                            <option value="">Selecciona tu perfil</option>
                                            {activeClients.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                        </select>
                                    </div>
                                )}
                            </div>
                            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3">
                                <button onClick={() => { setShowModal(false); setClientPhoneForBooking(''); }} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
                                <button 
                                    type="button"
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-6 py-2 bg-[#ffd427] text-slate-900 font-medium rounded-lg hover:bg-[#e6be23] shadow-lg shadow-yellow-500/30 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {saving ? (<><Loader2 className="animate-spin" size={18} /> Guardando...</>) : 'Confirmar Cita'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Render for Admin/Owner/Employee (List View)
    return (
        <div className="space-y-6">
            {currentBarberiaName && (
                <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 text-slate-700 px-4 py-2 rounded-lg w-fit">
                    <MapPin size={18} className="text-slate-500" />
                    <span className="font-medium">{currentBarberiaName}</span>
                </div>
            )}
            <div className="flex justify-between items-center flex-wrap gap-3">
                <h2 className="text-2xl font-bold text-slate-800">Agenda de Citas</h2>
                <div className="flex space-x-2">
                    <button
                        type="button"
                        onClick={() => loadData()}
                        disabled={loading}
                        className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors shadow-sm disabled:opacity-60"
                        title="Actualizar lista de citas"
                    >
                        <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
                        <span className="hidden sm:inline">Actualizar</span>
                    </button>
                    <button 
                        onClick={() => handlePrint({
                            name: 'Agenda de Citas',
                            shareText: sortedAppointments.length
                                ? `Agenda ${selectedDate}\n${sortedAppointments.map(a => {
                                    const c = clients.find(x => x.id === a.clienteId) ?? resolvedClients[a.clienteId] ?? null;
                                    const b = barbers.find(x => x.id === a.barberoId);
                                    return `${a.hora} - ${c?.nombre ?? 'Cliente desconocido'} - ${b?.name ?? ''} - ${a.estado}`;
                                  }).join('\n')}`
                                : `Agenda ${selectedDate}\nSin citas.`,
                        })}
                        className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors shadow-sm"
                    >
                        <Printer size={18} />
                        <span className="hidden sm:inline">Imprimir</span>
                    </button>
                    <button 
                        onClick={() => { setNewApt(prev => ({ ...prev, servicios: [] })); setShowModal(true); }}
                        className="bg-[#ffd427] hover:bg-[#e6be23] text-slate-900 px-4 py-2 rounded-lg font-bold flex items-center space-x-2 transition-colors shadow-sm"
                    >
                        <Calendar size={18} />
                        <span className="hidden sm:inline">Nueva Cita</span>
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center space-x-2">
                    <label className="font-medium text-slate-700">Filtrar Fecha:</label>
                    <input 
                        type="date" 
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427]"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <label className="font-medium text-slate-700">Ordenar:</label>
                    <select 
                        value={sortBy} 
                        onChange={(e) => setSortBy(e.target.value as 'hora' | 'estado')}
                        className="border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427] text-slate-700"
                    >
                        <option value="hora">Por hora</option>
                        <option value="estado">Por tipo (estado)</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedAppointments.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-slate-400 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                        <Calendar size={48} className="mx-auto mb-3 opacity-50" />
                        <p>No hay citas programadas para este día</p>
                    </div>
                ) : (
                    sortedAppointments.map(apt => {
                        const client = clients.find(c => c.id === apt.clienteId) ?? resolvedClients[apt.clienteId] ?? null;
                        const barber = barbers.find(b => b.id === apt.barberoId);
                        
                        // Robust WhatsApp Link Generation
                        const rawPhone = String(client?.telefono ?? '');
                        // Remove all non-numeric characters
                        const cleanPhone = rawPhone.replace(/\D/g, '');
                        // If phone starts with 0 (common in some regions), remove it, or adapt based on country code logic if needed.
                        // Here we just use the clean number. If it lacks country code, WA might fail or open blank.
                        // Ideally prompts for country code.
                        const waLink = cleanPhone.length > 7
                            ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(`Hola ${client?.nombre}, le escribimos de BarberShow para confirmar su cita el ${apt.fecha} a las ${apt.hora}.`)}`
                            : '#';

                        return (
                            <div key={apt.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center text-slate-800 font-bold text-lg">
                                        <Clock size={18} className="mr-2 text-yellow-600" />
                                        {apt.hora}
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold uppercase ${
                                        apt.estado === 'confirmada' ? 'bg-blue-100 text-blue-700' :
                                        apt.estado === 'completada' ? 'bg-green-100 text-green-700' :
                                        'bg-red-100 text-red-700'
                                    }`}>
                                        {apt.estado}
                                    </span>
                                </div>
                                <div className="space-y-2 mb-4">
                                    <div className="flex items-center text-slate-700">
                                        <User size={16} className="mr-2 text-slate-400" />
                                        <span className="font-medium">{client?.nombre || 'Cliente desconocido (eliminado o sin registro)'}</span>
                                    </div>
                                    <div className="flex items-center text-slate-600 text-sm">
                                        <Scissors size={16} className="mr-2 text-slate-400" />
                                        <span>{apt.servicios.map(s => s.name).join(', ')}</span>
                                    </div>
                                    <div className="text-sm text-slate-500">
                                        Barbero: <span className="text-slate-700 font-medium">{barber?.name}</span>
                                    </div>
                                </div>
                                <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2">
                                    {/* WhatsApp Button restored and fixed */}
                                    {cleanPhone.length > 5 && (
                                        <a 
                                            href={waLink} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-green-100"
                                            title="Enviar WhatsApp"
                                        >
                                            <MessageCircle size={18} />
                                        </a>
                                    )}
                                    {apt.estado === 'confirmada' && (
                                        <>
                                            <button onClick={() => handleCompleteAndGoToBilling(apt)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-transparent hover:border-green-100" title="Completar e ir a facturación">
                                                <Check size={18} />
                                            </button>
                                            <button onClick={() => updateStatus(apt.id, 'cancelada')} className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-transparent hover:border-amber-100" title="Cancelar">
                                                <X size={18} />
                                            </button>
                                        </>
                                    )}
                                    <button onClick={() => deleteAppointment(apt.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100" title="Eliminar">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Modal Admin */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="text-xl font-bold text-slate-800">Nueva Cita</h3>
                            <button onClick={() => { setShowModal(false); setIsNewClient(false); setNewClientName(''); setNewClientPhone(''); setSearchPhone(''); setClientFoundByPhone(null); setSearchAttempted(false); setNewApt(prev => ({ ...prev, servicios: [] })); }} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
                        </div>
                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                                    <input type="date" min={todayStr} className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-[#ffd427]" value={newApt.fecha} onChange={e => setNewApt({...newApt, fecha: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Hora</label>
                                    <input type="time" min={newApt.fecha === todayStr ? minTimeToday : undefined} className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-[#ffd427]" value={newApt.hora || ''} onChange={e => setNewApt({...newApt, hora: e.target.value})} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="block text-sm font-medium text-slate-700 mb-1">Buscar cliente por teléfono (ya en la base de datos)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="tel"
                                        className="flex-1 border border-slate-300 rounded-lg p-2 text-sm"
                                        placeholder="Ej: 555 123 4567"
                                        value={searchPhone}
                                        onChange={e => setSearchPhone(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleSearchByPhone()}
                                    />
                                    <button type="button" onClick={handleSearchByPhone} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium text-sm whitespace-nowrap">Buscar</button>
                                </div>
                                {clientFoundByPhone && (
                                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <span className="font-medium text-green-800">Cliente encontrado: {clientFoundByPhone.nombre}</span>
                                            <span className="text-green-700"> – {clientFoundByPhone.telefono || 'Sin teléfono'}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button type="button" onClick={() => handleUseClientFound(clientFoundByPhone)} className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">Usar este cliente</button>
                                            <button type="button" onClick={() => { setClientFoundByPhone(null); setSearchPhone(''); setSearchAttempted(false); }} className="px-3 py-1.5 text-slate-600 hover:bg-slate-200 rounded-lg text-sm">Buscar otro</button>
                                        </div>
                                    </div>
                                )}
                                {searchAttempted && !clientFoundByPhone && searchPhone.trim().length >= 6 && (
                                    <p className="text-sm text-slate-500">No encontrado con ese teléfono. Puede agregar como nuevo cliente abajo.</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Cliente</label>
                                {!isNewClient ? (
                                    <>
                                        <select
                                            className="w-full border border-slate-300 rounded-lg p-2"
                                            value={newApt.clienteId ?? ''}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setNewApt({ ...newApt, clienteId: val ? Number(val) : undefined });
                                            }}
                                        >
                                            <option value="">Seleccionar Cliente</option>
                                            {activeClients.map(c => <option key={c.id} value={c.id}>{c.nombre} – {c.telefono || 'Sin teléfono'}</option>)}
                                        </select>
                                        {newApt.clienteId && (() => {
                                            const sel = clients.find(c => c.id === newApt.clienteId);
                                            return sel && !String(sel.telefono ?? '').trim() ? (
                                                <p className="mt-1 text-amber-600 text-sm">Este cliente no tiene teléfono. Agregue uno en Gestión de Clientes o busque por otro.</p>
                                            ) : null;
                                        })()}
                                        <button
                                            type="button"
                                            onClick={() => { setIsNewClient(true); setNewApt({ ...newApt, clienteId: undefined }); }}
                                            className="mt-2 flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-800 font-medium"
                                        >
                                            <User size={16} />
                                            ¿No está en la lista? Agregar cliente nuevo (sin registro)
                                        </button>
                                    </>
                                ) : (
                                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-medium text-amber-800">Cliente nuevo (sin registro)</span>
                                            <button
                                                type="button"
                                                onClick={() => { setIsNewClient(false); setNewClientName(''); setNewClientPhone(''); }}
                                                className="text-sm text-amber-700 hover:text-amber-900 underline"
                                            >
                                                ← Elegir de la lista de clientes
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-amber-800 mb-1">Nombre</label>
                                                <input
                                                    type="text"
                                                    className="w-full border border-amber-300 rounded-lg p-2 text-sm"
                                                    placeholder="Nombre del cliente"
                                                    value={newClientName}
                                                    onChange={e => setNewClientName(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-amber-800 mb-1">Teléfono</label>
                                                <input
                                                    type="tel"
                                                    className="w-full border border-amber-300 rounded-lg p-2 text-sm"
                                                    placeholder="Teléfono / WhatsApp"
                                                    value={newClientPhone}
                                                    onChange={e => setNewClientPhone(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            {!isPlanSolo && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Barbero</label>
                                    <select className="w-full border border-slate-300 rounded-lg p-2" value={newApt.barberoId || ''} onChange={e => {
                                        const newBarberoId = Number(e.target.value);
                                        const current = newApt.servicios || [];
                                        const soloDelBarbero = current.filter((s) => s.barberId == null || s.barberId === newBarberoId);
                                        setNewApt({ ...newApt, barberoId: newBarberoId, servicios: soloDelBarbero });
                                    }}>
                                        <option value="">Seleccionar Barbero</option>
                                        {barbers.map(b => (
                                            <option key={b.id} value={b.id} disabled={!b.active}>
                                                {b.name} {!b.active && '(No disponible)'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">Servicios</label>
                                <div className="space-y-2 border border-slate-200 p-2 rounded-lg max-h-40 overflow-y-auto">
                                    {servicesForBarber.map(s => (
                                        <label key={s.id} className="flex items-center space-x-2 p-2 rounded hover:bg-slate-50 cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                className="rounded text-yellow-600 focus:ring-[#ffd427]"
                                                checked={!!newApt.servicios?.find(srv => srv.id === s.id)}
                                                onChange={() => toggleService(s)}
                                            />
                                            <div className="flex-1 flex justify-between">
                                                <span>{s.name}</span>
                                                <span className="font-medium text-slate-600">${s.price}</span>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3">
                            <button onClick={() => { setShowModal(false); setIsNewClient(false); setNewClientName(''); setNewClientPhone(''); setSearchPhone(''); setClientFoundByPhone(null); setSearchAttempted(false); }} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
                            <button type="button" onClick={handleSave} disabled={saving} className="px-6 py-2 bg-[#ffd427] text-slate-900 font-bold rounded-lg hover:bg-[#e6be23] transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2">
                                {saving ? (<><Loader2 className="animate-spin" size={18} /> Guardando...</>) : 'Guardar Cita'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Appointments;