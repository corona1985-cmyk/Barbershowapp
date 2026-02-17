import React, { useState, useEffect } from 'react';
import { DataService } from '../services/data';
import { Appointment, Barber, Client } from '../types';
import { ChevronLeft, ChevronRight, Clock, User, MapPin, Loader2, X } from 'lucide-react';

const DAY_NAMES_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
const DAY_NAMES_FULL = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const CalendarView: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [selectedBarber, setSelectedBarber] = useState<number | 'all'>('all');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [currentBarberiaName, setCurrentBarberiaName] = useState<string>('');
    const [selectedDay, setSelectedDay] = useState<string | null>(null);
    const currentBarberId = DataService.getCurrentBarberId();
    const isBarberoView = currentBarberId != null;

    useEffect(() => {
        setLoading(true);
        Promise.all([
            DataService.getAppointments(),
            DataService.getBarbers(),
            DataService.getPointsOfSale(),
            DataService.getClients(),
        ]).then(([appts, barbersList, posList, clientsList]) => {
            setAppointments(appts);
            setBarbers(barbersList);
            setClients(clientsList);
            const activePosId = DataService.getActivePosId();
            const pos = posList.find(p => p.id === activePosId);
            setCurrentBarberiaName(pos ? pos.name : '');
        }).finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (isBarberoView && currentBarberId != null) setSelectedBarber(currentBarberId);
    }, [isBarberoView, currentBarberId]);

    const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

    const changeMonth = (delta: number) => {
        const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1);
        setCurrentDate(newDate);
        setSelectedDay(null);
    };

    const getAppointmentsForDay = (dateStr: string) => {
        return appointments.filter(a => {
            if (a.fecha !== dateStr) return false;
            if (a.estado === 'cancelada') return false;
            if (isBarberoView && currentBarberId != null) return a.barberoId === currentBarberId;
            if (selectedBarber !== 'all' && a.barberoId !== selectedBarber) return false;
            return true;
        }).sort((a, b) => a.hora.localeCompare(b.hora));
    };

    const getStatusStyle = (estado: Appointment['estado']) => {
        switch (estado) {
            case 'confirmada': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'completada': return 'bg-green-100 text-green-800 border-green-200';
            default: return 'bg-amber-100 text-amber-800 border-amber-200';
        }
    };

    const todayStr = new Date().toISOString().split('T')[0];

    const renderCalendar = () => {
        const totalDays = daysInMonth(currentDate);
        const startDay = firstDayOfMonth(currentDate);
        const days = [];

        for (let i = 0; i < startDay; i++) {
            days.push(<div key={`blank-${i}`} className="bg-slate-50/50 border border-slate-100 min-h-[72px] sm:min-h-[88px] md:min-h-[100px]" />);
        }

        for (let d = 1; d <= totalDays; d++) {
            const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayAppointments = getAppointmentsForDay(dateStr);
            const isToday = dateStr === todayStr;
            const hasCitas = dayAppointments.length > 0;

            days.push(
                <button
                    key={d}
                    type="button"
                    onClick={() => setSelectedDay(dateStr)}
                    className={`relative flex flex-col items-center justify-start p-1 sm:p-1.5 min-h-[72px] sm:min-h-[88px] md:min-h-[100px] bg-white border border-slate-200 text-left hover:bg-slate-50 active:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[#ffd427] focus:ring-inset ${
                        isToday ? 'ring-2 ring-[#ffd427] ring-offset-1 bg-[#ffd427]/5' : ''
                    }`}
                >
                    <span className={`text-sm font-bold ${isToday ? 'text-[#b8860b]' : 'text-slate-700'}`}>
                        {d}
                        {isToday && <span className="sr-only"> (hoy)</span>}
                    </span>
                    {/* Móvil: solo indicador compacto (puntos o número) */}
                    <div className="mt-1 flex flex-wrap justify-center gap-0.5 max-w-full">
                        {hasCitas ? (
                            <>
                                <span className="hidden sm:inline text-[10px] text-slate-500 font-medium">{dayAppointments.length} {dayAppointments.length === 1 ? 'cita' : 'citas'}</span>
                                <div className="sm:hidden flex flex-wrap justify-center gap-0.5">
                                    {dayAppointments.slice(0, 5).map(app => (
                                        <span
                                            key={app.id}
                                            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                                app.estado === 'confirmada' ? 'bg-blue-500' :
                                                app.estado === 'completada' ? 'bg-green-500' : 'bg-amber-500'
                                            }`}
                                            title={`${app.hora} ${app.estado}`}
                                        />
                                    ))}
                                    {dayAppointments.length > 5 && <span className="text-[9px] text-slate-400">+{dayAppointments.length - 5}</span>}
                                </div>
                            </>
                        ) : null}
                    </div>
                    {/* Desktop: una línea por cita (hora + estado) sin truncar texto largo */}
                    <div className="hidden md:block mt-1 w-full space-y-0.5 overflow-y-auto max-h-14">
                        {dayAppointments.slice(0, 3).map(app => (
                            <div
                                key={app.id}
                                className={`text-[10px] px-1 py-0.5 rounded ${getStatusStyle(app.estado)} truncate`}
                                title={`${app.hora} · ${clients.find(c => c.id === app.clienteId)?.nombre ?? 'Cliente'} · ${app.estado}`}
                            >
                                {app.hora}
                            </div>
                        ))}
                        {dayAppointments.length > 3 && <span className="text-[9px] text-slate-400">+{dayAppointments.length - 3}</span>}
                    </div>
                </button>
            );
        }
        return days;
    };

    const selectedDayAppointments = selectedDay ? getAppointmentsForDay(selectedDay) : [];

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500">
                <Loader2 className="animate-spin mb-4" size={48} />
                <p className="font-medium">Cargando calendario...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-6 pb-6">
            {currentBarberiaName && (
                <div className="flex items-center gap-2 bg-[#ffd427]/20 border border-[#ffd427]/50 text-slate-800 px-4 py-3 rounded-xl w-fit">
                    <MapPin size={20} className="text-[#ffd427] flex-shrink-0" />
                    <span className="font-semibold">{currentBarberiaName}</span>
                </div>
            )}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center">
                    <Clock className="mr-2 flex-shrink-0" size={22} /> Calendario Mensual
                </h2>
                <div className="flex flex-wrap items-center gap-2 sm:gap-4 bg-white p-2 sm:p-3 rounded-lg shadow-sm border border-slate-200">
                    {!isBarberoView ? (
                        <div className="flex items-center space-x-2 min-w-0">
                            <User size={16} className="text-slate-400 flex-shrink-0" />
                            <select
                                className="bg-transparent text-sm font-medium focus:outline-none focus:ring-0 text-slate-700 min-w-0 max-w-[140px] sm:max-w-none"
                                value={selectedBarber}
                                onChange={(e) => setSelectedBarber(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                            >
                                <option value="all">Todos</option>
                                {barbers.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div className="flex items-center space-x-2 text-slate-700">
                            <User size={16} className="text-slate-400 flex-shrink-0" />
                            <span className="text-sm font-medium">Mis citas</span>
                            {barbers.find(b => b.id === currentBarberId) && (
                                <span className="text-xs text-slate-500 truncate max-w-[80px] sm:max-w-none">({barbers.find(b => b.id === currentBarberId)?.name})</span>
                            )}
                        </div>
                    )}
                    <div className="hidden sm:block h-6 w-px bg-slate-200" />
                    <div className="flex items-center justify-between sm:justify-center space-x-2 w-full sm:w-auto">
                        <button
                            type="button"
                            onClick={() => changeMonth(-1)}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 touch-manipulation"
                            aria-label="Mes anterior"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <span className="font-bold text-slate-800 text-sm sm:text-base min-w-[120px] sm:w-32 text-center capitalize">
                            {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                        </span>
                        <button
                            type="button"
                            onClick={() => changeMonth(1)}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 touch-manipulation"
                            aria-label="Mes siguiente"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <div className="min-w-[260px]">
                        <div className="grid grid-cols-7 bg-slate-100 border-b border-slate-200">
                            {DAY_NAMES_FULL.map((long, i) => (
                                <div key={long} className="py-1.5 sm:py-2 text-center text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    <span className="sm:hidden">{DAY_NAMES_SHORT[i]}</span>
                                    <span className="hidden sm:inline">{long}</span>
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 bg-slate-100 gap-px border-t border-slate-100">
                            {renderCalendar()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Leyenda: mismos colores que las celdas y los puntos */}
            <div className="flex flex-wrap gap-4 sm:gap-6 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500 border border-blue-600 shadow-sm" aria-hidden />
                    <span>Confirmada</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500 border border-green-600 shadow-sm" aria-hidden />
                    <span>Completada</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-amber-500 border border-amber-600 shadow-sm" aria-hidden />
                    <span>Pendiente</span>
                </div>
            </div>

            {/* Panel / modal al tocar un día: lista completa de citas */}
            {selectedDay != null && (
                <>
                    <div
                        className="fixed inset-0 bg-black/40 z-40 sm:bg-black/50"
                        onClick={() => setSelectedDay(null)}
                        aria-hidden
                    />
                    <div
                        className="fixed left-0 right-0 bottom-0 sm:left-1/2 sm:right-auto sm:bottom-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-md sm:rounded-xl z-50 bg-white shadow-2xl border-t sm:border border-slate-200 rounded-t-2xl sm:rounded-xl max-h-[70vh] sm:max-h-[80vh] flex flex-col animate-in slide-in-from-bottom duration-200"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="day-detail-title"
                    >
                        <div className="flex items-center justify-between p-4 border-b border-slate-200 flex-shrink-0">
                            <h3 id="day-detail-title" className="text-lg font-bold text-slate-800">
                                Citas del {selectedDay && new Date(selectedDay + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setSelectedDay(null)}
                                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 touch-manipulation"
                                aria-label="Cerrar"
                            >
                                <X size={22} />
                            </button>
                        </div>
                        <div className="overflow-y-auto p-4 space-y-3 flex-1">
                            {selectedDayAppointments.length === 0 ? (
                                <p className="text-slate-500 text-center py-6">No hay citas este día.</p>
                            ) : (
                                selectedDayAppointments.map(app => {
                                    const client = clients.find(c => c.id === app.clienteId);
                                    const barber = barbers.find(b => b.id === app.barberoId);
                                    return (
                                        <div
                                            key={app.id}
                                            className={`p-3 rounded-xl border ${getStatusStyle(app.estado)}`}
                                        >
                                            <div className="flex justify-between items-start gap-2">
                                                <span className="font-bold text-slate-900">{app.hora}</span>
                                                <span className="text-xs font-semibold uppercase">{app.estado}</span>
                                            </div>
                                            <p className="text-sm font-medium text-slate-800 mt-1">{client?.nombre ?? 'Cliente'}</p>
                                            <p className="text-xs text-slate-600">{barber?.name ?? 'Barbero'}</p>
                                            {app.servicios?.length > 0 && (
                                                <p className="text-xs text-slate-500 mt-1">{app.servicios.map(s => s.name).join(', ')}</p>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default CalendarView;