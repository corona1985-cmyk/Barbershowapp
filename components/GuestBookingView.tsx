import React, { useState, useEffect, useMemo } from 'react';
import { DataService } from '../services/data';
import { Appointment, Barber, BarberGalleryPhoto, Service } from '../types';
import { MapPin, ArrowLeft, CheckCircle, ImageIcon } from 'lucide-react';

interface GuestBookingViewProps {
    posId: number;
    posName: string;
    onBack: () => void;
    onSuccess: () => void;
}

const GuestBookingView: React.FC<GuestBookingViewProps> = ({ posId, posName, onBack, onSuccess }) => {
    const [services, setServices] = useState<Service[]>([]);
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [selectedBarberId, setSelectedBarberId] = useState<number>(0);
    const [selectedTime, setSelectedTime] = useState<string>('');
    const [selectedServices, setSelectedServices] = useState<Service[]>([]);
    const [nombre, setNombre] = useState('');
    const [telefono, setTelefono] = useState('');
    const [showConfirm, setShowConfirm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);
    const [guestBarberGallery, setGuestBarberGallery] = useState<BarberGalleryPhoto[]>([]);

    useEffect(() => {
        const prev = DataService.getActivePosId();
        DataService.setActivePosId(posId);
        Promise.all([
            DataService.getServices(),
            DataService.getBarbers(),
            DataService.getAppointments(),
        ]).then(([s, b, a]) => {
            setServices(s);
            setBarbers(b.filter((x) => x.active));
            setAppointments(a);
            if (b.filter((x) => x.active).length > 0) setSelectedBarberId(b.filter((x) => x.active)[0].id);
        }).catch(() => setError('No se pudo cargar la información.'));
        return () => { DataService.setActivePosId(prev); };
    }, [posId]);

    useEffect(() => {
        const bid = selectedBarberId || defaultBarberId;
        if (bid) DataService.getBarberGallery(bid).then(setGuestBarberGallery).catch(() => setGuestBarberGallery([]));
        else setGuestBarberGallery([]);
    }, [selectedBarberId, defaultBarberId]);

    const getTodayLocal = (): string => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    const todayStr = getTodayLocal();
    const activeBarbers = barbers.filter((b) => b.active);
    const defaultBarberId = activeBarbers.length > 0 ? activeBarbers[0].id : 0;

    const timeToMinutes = (hora: string): number => {
        const [h, m] = hora.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    };
    const isSlotInsideAppointment = (slotMinutes: number, apt: Appointment): boolean => {
        const start = timeToMinutes(apt.hora);
        const duration = apt.duracionTotal ?? 30;
        return slotMinutes >= start && slotMinutes < start + duration;
    };

    const getBarberWorkRange = (barber: Barber | undefined, dateStr: string): { startMins: number; endMins: number } | null => {
        const day = new Date(dateStr + 'T12:00:00').getDay();
        const wh = barber?.workingHours?.[day];
        if (wh) return { startMins: timeToMinutes(wh.start), endMins: timeToMinutes(wh.end) };
        if (barber?.workingHours && Object.keys(barber.workingHours).length > 0) return null;
        return { startMins: 9 * 60, endMins: 19 * 60 };
    };

    const generateTimeSlots = (date: string, barberId: number) => {
        const slots: { time: string; taken: boolean; past: boolean }[] = [];
        const barber = barbers.find((b) => b.id === barberId);
        const range = getBarberWorkRange(barber, date);
        if (range === null) return slots;

        const today = new Date();
        const nowMinutes = today.getHours() * 60 + today.getMinutes();
        const taken = appointments.filter((a) => a.fecha === date && a.barberoId === barberId && a.estado !== 'cancelada');
        const isBlocked = (slotMins: number) => {
            const blocks = barber?.blockedHours ?? [];
            if (blocks.some((b) => b.date === date && slotMins < timeToMinutes(b.end) && slotMins + 30 > timeToMinutes(b.start))) return true;
            const day = new Date(date + 'T12:00:00').getDay();
            const lunch = barber?.lunchBreak?.[day];
            if (lunch?.start && lunch?.end && slotMins < timeToMinutes(lunch.end) && slotMins + 30 > timeToMinutes(lunch.start)) return true;
            return false;
        };

        for (let m = range.startMins; m < range.endMins; m += 30) {
            const h = Math.floor(m / 60);
            const min = m % 60;
            const hourStr = h.toString().padStart(2, '0') + ':' + (min === 0 ? '00' : '30');
            const blocked = isBlocked(m);
            const isTaken = !blocked && taken.some((a) => isSlotInsideAppointment(m, a));
            const past = date < todayStr || (date === todayStr && m <= nowMinutes);
            slots.push({ time: hourStr, taken: blocked || isTaken, past });
        }
        return slots;
    };

    const barberId = selectedBarberId || defaultBarberId;
    const slots = barberId ? generateTimeSlots(selectedDate, barberId) : [];
    const noBarbers = activeBarbers.length === 0;
    const servicesForBarber = useMemo(
        () => services.filter((s) => s.barberId == null || s.barberId === barberId),
        [services, barberId]
    );

    const toggleService = (s: Service) => {
        setSelectedServices((prev) =>
            prev.find((x) => x.id === s.id) ? prev.filter((x) => x.id !== s.id) : [...prev, s]
        );
    };

    const handleConfirm = async () => {
        setError('');
        if (!nombre.trim() || !telefono.trim()) {
            setError('Nombre y teléfono son obligatorios.');
            return;
        }
        if (selectedServices.length === 0) {
            setError('Elige al menos un servicio.');
            return;
        }
        if (!selectedTime) {
            setError('Elige una hora.');
            return;
        }
        if (!barberId) {
            setError('No hay barberos disponibles en esta barbería.');
            return;
        }
        const duracionTotal = selectedServices.reduce((acc, s) => acc + s.duration, 0);
        const newStart = timeToMinutes(selectedTime);
        const existingSameBarber = appointments.filter(
            (a) => a.fecha === selectedDate && a.barberoId === barberId && a.estado !== 'cancelada'
        );
        const overlaps = existingSameBarber.some((a) => {
            const otherStart = timeToMinutes(a.hora);
            const otherDur = a.duracionTotal ?? 30;
            const end1 = newStart + duracionTotal;
            const end2 = otherStart + otherDur;
            return newStart < end2 && otherStart < end1;
        });
        if (overlaps) {
            setError('Esa hora ya no está disponible (se solapa con otra cita). Elige otra.');
            return;
        }
        setLoading(true);
        try {
            const client = await DataService.addClientOrGetExisting({
                nombre: nombre.trim(),
                telefono: telefono.trim(),
                email: '',
                ultimaVisita: 'N/A',
                notas: 'Reserva sin cuenta (invitado)',
                fechaRegistro: new Date().toISOString().split('T')[0],
                puntos: 0,
                status: 'active',
            });
            const total = selectedServices.reduce((acc, s) => acc + s.price, 0);
            await DataService.addAppointment({
                posId,
                clienteId: client.id,
                barberoId: barberId,
                fecha: selectedDate,
                hora: selectedTime,
                servicios: selectedServices,
                notas: '',
                duracionTotal,
                total,
                estado: 'confirmada',
                fechaCreacion: new Date().toISOString(),
            });
            setDone(true);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(msg.includes('permiso') || msg.includes('conexión') ? msg : `No se pudo agendar. ${msg}`);
        } finally {
            setLoading(false);
        }
    };

    if (done) {
        return (
            <div className="max-w-md mx-auto bg-white rounded-2xl shadow-xl p-4 sm:p-8 text-center min-w-0">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={32} className="text-green-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Cita agendada</h2>
                <p className="text-slate-600 mb-6">
                    Tu cita en <strong>{posName}</strong> para el {selectedDate} a las {selectedTime} está confirmada. Te contactaremos al {telefono} si hace falta.
                </p>
                <button
                    type="button"
                    onClick={onSuccess}
                    className="w-full py-3 bg-[#ffd427] text-slate-900 font-bold rounded-xl hover:bg-amber-400"
                >
                    Volver a barberías
                </button>
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl mx-auto px-0 sm:px-2 min-w-0">
            <button type="button" onClick={onBack} className="flex items-center gap-1 text-slate-600 hover:text-slate-800 mb-4 sm:mb-6 py-2 min-h-[44px]">
                <ArrowLeft size={20} /> Volver
            </button>
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-[#ffd427]/10">
                    <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <MapPin size={22} className="text-[#ffd427]" /> {posName}
                    </h1>
                    <p className="text-slate-600 text-sm mt-1">Agenda tu cita sin registrarte</p>
                </div>
                <div className="p-6 space-y-6">
                    {error && <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

                    {/* Barbero (si hay más de uno) */}
                    {activeBarbers.length > 1 && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Barbero</label>
                            <div className="flex flex-wrap gap-2">
                                {activeBarbers.map((b) => (
                                    <button
                                        key={b.id}
                                        type="button"
                                        onClick={() => setSelectedBarberId(b.id)}
                                        className={`px-3 py-2 rounded-lg text-sm font-medium ${selectedBarberId === b.id ? 'bg-[#ffd427] text-slate-900' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                                    >
                                        {b.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Galería del barbero */}
                    {guestBarberGallery.length > 0 && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">Trabajos de {activeBarbers.find((b) => b.id === (selectedBarberId || defaultBarberId))?.name}</label>
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                                {guestBarberGallery.map((p) => (
                                    <button key={p.id} type="button" className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-slate-200 shadow-sm hover:ring-2 hover:ring-[#ffd427] focus:outline-none" onClick={() => window.open(p.imageUrl, '_blank')}>
                                        <img src={p.imageUrl} alt={p.caption || 'Trabajo'} className="w-full h-full object-cover" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Fecha */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Fecha</label>
                        <input
                            type="date"
                            min={todayStr}
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#ffd427]"
                        />
                    </div>

                    {noBarbers && <p className="text-amber-700 bg-amber-50 p-3 rounded-lg text-sm">No hay barberos disponibles en esta barbería por el momento.</p>}

                    {/* Hora */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Hora</label>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                            {slots.map((slot) => (
                                <button
                                    key={slot.time}
                                    type="button"
                                    disabled={slot.taken || slot.past}
                                    onClick={() => setSelectedTime(slot.time)}
                                    className={`py-2 rounded-lg text-sm font-medium ${slot.taken || slot.past ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : selectedTime === slot.time ? 'bg-[#ffd427] text-slate-900' : 'bg-slate-100 text-slate-700 hover:bg-[#ffd427]/30'}`}
                                >
                                    {slot.time}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Servicios */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Servicios</label>
                        <div className="space-y-2 border border-slate-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                            {servicesForBarber.map((s) => (
                                <label key={s.id} className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="rounded text-[#ffd427] focus:ring-[#ffd427]"
                                        checked={!!selectedServices.find((x) => x.id === s.id)}
                                        onChange={() => toggleService(s)}
                                    />
                                    <span className="flex-1 text-slate-700">{s.name}</span>
                                    <span className="font-medium text-slate-600">${s.price}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Nombre y teléfono */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tu nombre</label>
                            <input
                                type="text"
                                value={nombre}
                                onChange={(e) => setNombre(e.target.value)}
                                placeholder="Ej: Juan Pérez"
                                className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#ffd427]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono (para confirmar)</label>
                            <input
                                type="tel"
                                value={telefono}
                                onChange={(e) => setTelefono(e.target.value)}
                                placeholder="Ej: 555 123 4567"
                                className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-[#ffd427]"
                            />
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={loading || noBarbers}
                        className="w-full py-3 bg-[#ffd427] text-slate-900 font-bold rounded-xl hover:bg-amber-400 disabled:opacity-50"
                    >
                        {loading ? 'Agendando...' : 'Confirmar cita'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GuestBookingView;
