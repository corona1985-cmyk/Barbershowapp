import React, { useState, useEffect, useMemo } from 'react';
import { DataService } from '../services/data';
import { Appointment, Barber, Client, Service, AppointmentForSale, SaleItem, AccountTier } from '../types';
import { ViewState } from '../types';
import { Calendar, Clock, User, Scissors, Check, X, Trash2, Printer, MessageCircle, MapPin, Loader2 } from 'lucide-react';

interface AppointmentsProps {
    onChangeView?: (view: ViewState) => void;
    onCompleteForBilling?: (data: AppointmentForSale) => void;
    accountTier?: AccountTier;
}

const LOAD_TIMEOUT_MS = 15000; // 15 s: si la BD no responde, dejar de cargar y mostrar error/retry

const Appointments: React.FC<AppointmentsProps> = ({ onChangeView, onCompleteForBilling, accountTier = 'barberia' }) => {
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [userRole, setUserRole] = useState<string>('');
    const [selectedBarberForView, setSelectedBarberForView] = useState<number>(0);
    const [currentBarberiaName, setCurrentBarberiaName] = useState<string>('');
    
    // Modal State
    const [showModal, setShowModal] = useState(false);
    const [clients, setClients] = useState<Client[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [newApt, setNewApt] = useState<Partial<Appointment>>({
        fecha: new Date().toISOString().split('T')[0],
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

    const loadData = React.useCallback(async () => {
        setLoadError(false);
        setLoading(true);
        const timeoutId = window.setTimeout(() => {
            setLoading(false);
            setLoadError(true);
        }, LOAD_TIMEOUT_MS);
        try {
            const role = DataService.getCurrentUserRole();
            setUserRole(role);
            const clientsLoader = role === 'barbero' ? DataService.getClientsWithActivity() : DataService.getClients();
            const [appts, barbersList, clientsList, servicesList, posList] = await Promise.all([
                DataService.getAppointments(),
                DataService.getBarbers(),
                clientsLoader,
                DataService.getServices(),
                DataService.getPointsOfSale(),
            ]);
            clearTimeout(timeoutId);
            setAppointments(appts);
            setBarbers(barbersList);
            setClients(clientsList);
            setServices(servicesList);
            const activePosId = DataService.getActivePosId();
            const pos = posList.find(p => p.id === activePosId);
            setCurrentBarberiaName(pos ? pos.name : '');
            const activeBarbers = barbersList.filter(b => b.active);
            if (activeBarbers.length > 0) setSelectedBarberForView(activeBarbers[0].id);
            if (role === 'cliente') {
                const currUser = DataService.getCurrentUser();
                if (currUser) {
                    const clientRecord = clientsList.find(c => c.nombre === currUser.name);
                    if (clientRecord) setNewApt(prev => ({ ...prev, clienteId: clientRecord.id }));
                }
            }
        } catch (err) {
            clearTimeout(timeoutId);
            console.error('Error cargando citas:', err);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredAppointments = appointments.filter(a => a.fecha === selectedDate);
    const sortedAppointments = filteredAppointments.sort((a, b) => a.hora.localeCompare(b.hora));

    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const minTimeToday = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const isDateTimeInPast = (fecha: string, hora: string): boolean => {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        if (fecha < todayStr) return true;
        if (fecha > todayStr) return false;
        const [h, m] = hora.split(':').map(Number);
        const slotMinutes = (h || 0) * 60 + (m || 0);
        const nowMinutes = today.getHours() * 60 + today.getMinutes();
        return slotMinutes <= nowMinutes;
    };

    const isPlanSolo = accountTier === 'solo';
    const defaultBarberId = barbers.filter(b => b.active).length > 0 ? barbers.filter(b => b.active)[0].id : barbers[0]?.id;
    /** Servicios disponibles para el barbero seleccionado: de la sede (barberId null) + del barbero */
    const servicesForBarber = useMemo(() => {
        const bid = newApt.barberoId ?? (isPlanSolo ? defaultBarberId : undefined);
        if (bid == null) return services.filter((s) => s.barberId == null);
        return services.filter((s) => s.barberId == null || s.barberId === bid);
    }, [services, newApt.barberoId, isPlanSolo, defaultBarberId]);

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
                const newClient = await DataService.addClient({
                    nombre: (currUser?.name || 'Cliente').trim(),
                    telefono: clientPhoneForBooking.trim(),
                    email: '',
                    notas: 'Registrado al agendar cita (cliente)',
                    fechaRegistro: new Date().toISOString().split('T')[0],
                    ultimaVisita: 'N/A',
                    puntos: 0,
                    status: 'active',
                });
                finalClientId = newClient.id;
                setClients(prev => [...prev, newClient]);
            }
        } else if (isNewClient) {
            if (!newClientName.trim() || !newClientPhone.trim()) {
                setSaving(false);
                alert('Ingrese nombre y teléfono del nuevo cliente.');
                return;
            }
            const newClient = await DataService.addClient({
                nombre: newClientName.trim(),
                telefono: newClientPhone.trim(),
                email: '',
                notas: 'Registrado al agendar cita',
                fechaRegistro: new Date().toISOString().split('T')[0],
                ultimaVisita: 'N/A',
                puntos: 0,
                status: 'active',
            });
            finalClientId = newClient.id;
            setClients([...clients, newClient]);
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
        if (clientRecord && !(clientRecord.telefono || '').trim()) {
            setSaving(false);
            alert('El cliente debe tener un número de teléfono para confirmar la cita. Edite el cliente o use "Buscar por teléfono".');
            return;
        }
        const total = newApt.servicios!.reduce((acc, s) => acc + s.price, 0);
        const duration = newApt.servicios!.reduce((acc, s) => acc + s.duration, 0);
        const newAppointment: Appointment = {
            id: Date.now(),
            posId: DataService.getActivePosId() || 0,
            clienteId: finalClientId,
            barberoId: barberoId,
            fecha: newApt.fecha!,
            hora: newApt.hora!,
            servicios: newApt.servicios!,
            notas: newApt.notas || '',
            duracionTotal: duration,
            total: total,
            estado: 'confirmada',
            fechaCreacion: new Date().toISOString()
        };
        try {
            const updated = [...appointments, newAppointment];
            setAppointments(updated);
            await DataService.setAppointments(updated);
            setShowModal(false);
            setNewApt(prev => ({ ...prev, hora: undefined, servicios: [], notas: '', clienteId: undefined }));
            setIsNewClient(false);
            setNewClientName('');
            setNewClientPhone('');
            setClientPhoneForBooking('');
            alert('Cita agendada con éxito.');
        } catch (err) {
            console.error('Error al agendar cita:', err);
            alert('No se pudo guardar la cita. Revisa tu conexión e intenta de nuevo.');
        } finally {
            setSaving(false);
        }
    };

    const updateStatus = async (id: number, status: Appointment['estado']) => {
        const updated = appointments.map(a => a.id === id ? { ...a, estado: status } : a);
        setAppointments(updated);
        await DataService.setAppointments(updated);
    };

    const handleCompleteAndGoToBilling = async (apt: Appointment) => {
        await updateStatus(apt.id, 'completada');
        const client = clients.find(c => c.id === apt.clienteId);
        const clienteNombre = client?.nombre ?? 'Cliente';
        const items: SaleItem[] = (apt.servicios || []).map(s => ({
            id: s.id,
            name: s.name,
            price: s.price,
            quantity: 1,
            type: 'servicio' as const,
        }));
        if (onCompleteForBilling && onChangeView) {
            onCompleteForBilling({
                appointmentId: apt.id,
                clienteId: apt.clienteId,
                clienteNombre,
                barberoId: apt.barberoId,
                fecha: apt.fecha,
                hora: apt.hora,
                items,
                total: apt.total ?? items.reduce((sum, i) => sum + i.price * i.quantity, 0),
            });
            onChangeView('sales');
        }
    };

    const deleteAppointment = async (id: number) => {
        if (confirm('¿Eliminar cita?')) {
            const updated = appointments.filter(a => a.id !== id);
            setAppointments(updated);
            await DataService.setAppointments(updated);
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
                telefono: client.telefono || '',
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

    // Client Visual Grid Logic
    const generateTimeSlots = (date: string, barberId: number) => {
        const slots: { time: string; taken: boolean; past: boolean }[] = [];
        const startHour = 9; // 9 AM
        const endHour = 19; // 7 PM
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        const nowMinutes = today.getHours() * 60 + today.getMinutes();

        const taken = appointments.filter(a => a.fecha === date && a.barberoId === barberId && a.estado !== 'cancelada');

        for (let h = startHour; h < endHour; h++) {
            const hourStr = h.toString().padStart(2, '0') + ':00';
            const isTaken = taken.some(a => a.hora === hourStr);
            const slotMins = h * 60;
            const past = date < todayStr || (date === todayStr && slotMins <= nowMinutes);
            slots.push({ time: hourStr, taken: isTaken, past });

            const halfHourStr = h.toString().padStart(2, '0') + ':30';
            const isHalfTaken = taken.some(a => a.hora === halfHourStr);
            const halfSlotMins = h * 60 + 30;
            const halfPast = date < todayStr || (date === todayStr && halfSlotMins <= nowMinutes);
            slots.push({ time: halfHourStr, taken: isHalfTaken, past: halfPast });
        }
        return slots;
    };

    const handleSlotClick = (time: string, taken: boolean, past?: boolean) => {
        if (taken || past) return;
        setNewApt({
            ...newApt,
            fecha: selectedDate,
            hora: time,
            barberoId: selectedBarberForView
        });
        setShowModal(true);
    };

    // Solo clientes ven "Reservar Cita" (elegir barbero/fecha/hora). Superadmin, admin y barbero ven "Agenda de Citas" para agendar.
    const role = (userRole || '').toLowerCase();
    const isClientView = role === 'cliente';

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
                {currentBarberiaName && (
                    <div className="flex items-center gap-2 bg-[#ffd427]/20 border border-[#ffd427]/50 text-slate-800 px-4 py-3 rounded-xl">
                        <MapPin size={20} className="text-[#ffd427] flex-shrink-0" />
                        <span className="font-semibold">Barbería:</span>
                        <span>{currentBarberiaName}</span>
                    </div>
                )}
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
                                <button onClick={() => { setShowModal(false); setClientPhoneForBooking(''); }} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
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
                                            {clients.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
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
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">Agenda de Citas</h2>
                <div className="flex space-x-2">
                    <button 
                        onClick={() => window.print()}
                        className="bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors shadow-sm"
                    >
                        <Printer size={18} />
                        <span className="hidden sm:inline">Imprimir</span>
                    </button>
                    <button 
                        onClick={() => setShowModal(true)}
                        className="bg-[#ffd427] hover:bg-[#e6be23] text-slate-900 px-4 py-2 rounded-lg font-bold flex items-center space-x-2 transition-colors shadow-sm"
                    >
                        <Calendar size={18} />
                        <span className="hidden sm:inline">Nueva Cita</span>
                    </button>
                </div>
            </div>

            <div className="flex items-center space-x-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <label className="font-medium text-slate-700">Filtrar Fecha:</label>
                <input 
                    type="date" 
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#ffd427]"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sortedAppointments.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-slate-400 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                        <Calendar size={48} className="mx-auto mb-3 opacity-50" />
                        <p>No hay citas programadas para este día</p>
                    </div>
                ) : (
                    sortedAppointments.map(apt => {
                        const client = clients.find(c => c.id === apt.clienteId);
                        const barber = barbers.find(b => b.id === apt.barberoId);
                        
                        // Robust WhatsApp Link Generation
                        const rawPhone = client?.telefono || '';
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
                                        <span className="font-medium">{client?.nombre || 'Cliente Desconocido'}</span>
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
                            <button onClick={() => { setShowModal(false); setIsNewClient(false); setNewClientName(''); setNewClientPhone(''); setSearchPhone(''); setClientFoundByPhone(null); setSearchAttempted(false); }} className="text-slate-400 hover:text-slate-600"><X size={24}/></button>
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
                                            {clients.map(c => <option key={c.id} value={c.id}>{c.nombre} – {c.telefono || 'Sin teléfono'}</option>)}
                                        </select>
                                        {newApt.clienteId && (() => {
                                            const sel = clients.find(c => c.id === newApt.clienteId);
                                            return sel && !(sel.telefono || '').trim() ? (
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
                                    <select className="w-full border border-slate-300 rounded-lg p-2" value={newApt.barberoId || ''} onChange={e => setNewApt({...newApt, barberoId: Number(e.target.value)})}>
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