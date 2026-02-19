import React, { useState, useEffect } from 'react';
import { DataService } from '../services/data';
import { Appointment, Barber, Client } from '../types';
import { ChevronLeft, ChevronRight, User, MapPin, Loader2, X, CalendarDays, Clock, Scissors } from 'lucide-react';

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
        }).sort((a, b) => {
            const aConfirmada = a.estado === 'confirmada' ? 1 : 0;
            const bConfirmada = b.estado === 'confirmada' ? 1 : 0;
            if (bConfirmada !== aConfirmada) return bConfirmada - aConfirmada;
            return a.hora.localeCompare(b.hora);
        });
    };

    const getStatusStyle = (estado: Appointment['estado']) => {
        switch (estado) {
            case 'confirmada': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'completada': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            default: return 'bg-amber-100 text-amber-800 border-amber-200';
        }
    };

    const todayStr = new Date().toISOString().split('T')[0];

    const renderCalendar = () => {
        const totalDays = daysInMonth(currentDate);
        const startDay = firstDayOfMonth(currentDate);
        const days = [];

        for (let i = 0; i < startDay; i++) {
            days.push(<div key={`blank-${i}`} className="min-h-[76px] bg-slate-50/60 sm:min-h-[90px] md:min-h-[102px]" />);
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
                    className={`relative flex min-h-[76px] flex-col items-center justify-start p-2 text-left transition-all focus:outline-none focus:ring-2 focus:ring-[#ffd427] focus:ring-inset sm:min-h-[90px] sm:p-2.5 md:min-h-[102px] ${
                        isToday
                            ? 'bg-amber-50/90 shadow-inner ring-1 ring-amber-300/60'
                            : 'bg-white hover:bg-slate-50/80 active:bg-slate-100 sm:hover:shadow-sm'
                    }`}
                >
                    <span className={`text-sm font-bold tabular-nums sm:text-base ${isToday ? 'text-amber-800' : 'text-slate-700'}`}>
                        {d}
                        {isToday && <span className="ml-0.5 rounded bg-amber-200/60 px-1 text-[10px] font-semibold uppercase text-amber-800">hoy</span>}
                    </span>
                    <div className="mt-1.5 flex min-w-0 max-w-full flex-wrap justify-center gap-0.5">
                        {hasCitas ? (
                            <>
                                <span className="text-[10px] font-semibold text-slate-600">{dayAppointments.length} {dayAppointments.length === 1 ? 'cita' : 'citas'}</span>
                                <div className="mt-0.5 flex flex-wrap justify-center gap-0.5 md:hidden">
                                    {dayAppointments.slice(0, 5).map(app => (
                                        <span
                                            key={app.id}
                                            className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                                                app.estado === 'confirmada' ? 'bg-blue-500' :
                                                app.estado === 'completada' ? 'bg-emerald-500' : 'bg-amber-500'
                                            }`}
                                            title={`${app.hora} ${app.estado}`}
                                        />
                                    ))}
                                    {dayAppointments.length > 5 && <span className="text-[9px] text-slate-400">+{dayAppointments.length - 5}</span>}
                                </div>
                                <div className="mt-0.5 hidden flex-wrap justify-center gap-1 md:flex">
                                    {dayAppointments.slice(0, 2).map(app => (
                                        <span
                                            key={app.id}
                                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${getStatusStyle(app.estado)}`}
                                            title={`${app.hora} · ${clients.find(c => c.id === app.clienteId)?.nombre ?? 'Cliente'} · ${app.estado}`}
                                        >
                                            {app.hora}
                                        </span>
                                    ))}
                                    {dayAppointments.length > 2 && <span className="text-[9px] font-medium text-slate-400">+{dayAppointments.length - 2}</span>}
                                </div>
                            </>
                        ) : null}
                    </div>
                </button>
            );
        }
        return days;
    };

    const selectedDayAppointments = selectedDay ? getAppointmentsForDay(selectedDay) : [];

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-slate-600">
                <div className="rounded-2xl bg-slate-100 p-6">
                    <Loader2 className="animate-spin text-[#ffd427]" size={44} strokeWidth={2.5} />
                </div>
                <p className="mt-4 font-semibold text-slate-700">Cargando calendario...</p>
                <p className="mt-1 text-sm text-slate-500">Un momento</p>
            </div>
        );
    }

    return (
        <div className="space-y-5 sm:space-y-6 pb-8">
            {currentBarberiaName && (
                <div className="flex items-center gap-3 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50/80 to-[#ffd427]/10 px-4 py-3 shadow-sm">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ffd427]/20">
                        <MapPin size={20} className="text-amber-700" />
                    </div>
                    <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-amber-700/80">Sede activa</p>
                        <p className="font-semibold text-slate-800">{currentBarberiaName}</p>
                    </div>
                </div>
            )}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-600 sm:h-12 sm:w-12">
                        <CalendarDays size={22} className="sm:w-6 sm:h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-slate-800 sm:text-2xl">Calendario mensual</h2>
                        <p className="text-sm text-slate-500">Toca un día para ver las citas</p>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:gap-4 sm:px-4 sm:py-3">
                    {!isBarberoView ? (
                        <div className="flex min-w-0 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                            <User size={18} className="text-slate-500 flex-shrink-0" />
                            <select
                                className="min-w-0 max-w-[140px] flex-1 bg-transparent text-sm font-semibold text-slate-700 focus:outline-none sm:max-w-none"
                                value={selectedBarber}
                                onChange={(e) => setSelectedBarber(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                            >
                                <option value="all">Todos los barberos</option>
                                {barbers.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                            <User size={18} className="text-slate-500 flex-shrink-0" />
                            <span className="text-sm font-semibold text-slate-700">Mis citas</span>
                            {barbers.find(b => b.id === currentBarberId) && (
                                <span className="truncate text-xs text-slate-500 max-w-[90px] sm:max-w-none">({barbers.find(b => b.id === currentBarberId)?.name})</span>
                            )}
                        </div>
                    )}
                    <div className="hidden h-8 w-px bg-slate-200 sm:block" />
                    <div className="flex flex-1 items-center justify-between gap-1 rounded-xl bg-slate-50 px-2 py-2 sm:flex-initial sm:justify-center sm:gap-2 sm:px-3">
                        <button
                            type="button"
                            onClick={() => changeMonth(-1)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-white hover:shadow-sm active:bg-slate-100 sm:h-10 sm:w-10"
                            aria-label="Mes anterior"
                        >
                            <ChevronLeft size={22} />
                        </button>
                        <span className="min-w-[110px] text-center text-sm font-bold capitalize text-slate-800 sm:min-w-[140px] sm:text-base">
                            {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                        </span>
                        <button
                            type="button"
                            onClick={() => changeMonth(1)}
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-white hover:shadow-sm active:bg-slate-100 sm:h-10 sm:w-10"
                            aria-label="Mes siguiente"
                        >
                            <ChevronRight size={22} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md">
                <div className="overflow-x-auto">
                    <div className="min-w-[280px]">
                        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-100/80">
                            {DAY_NAMES_FULL.map((long, i) => (
                                <div key={long} className="py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:py-3 sm:text-xs">
                                    <span className="sm:hidden">{DAY_NAMES_SHORT[i]}</span>
                                    <span className="hidden sm:inline">{long}</span>
                                </div>
                            ))}
                        </div>
                        <div className="grid grid-cols-7 gap-px bg-slate-200 p-px">
                            {renderCalendar()}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 sm:gap-6 sm:px-5">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estados</span>
                <div className="flex flex-wrap gap-4 sm:gap-6">
                    <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-blue-500 shadow-sm ring-2 ring-blue-200" aria-hidden />
                        <span className="text-sm font-medium text-slate-700">Confirmada</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-emerald-500 shadow-sm ring-2 ring-emerald-200" aria-hidden />
                        <span className="text-sm font-medium text-slate-700">Completada</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-amber-500 shadow-sm ring-2 ring-amber-200" aria-hidden />
                        <span className="text-sm font-medium text-slate-700">Pendiente</span>
                    </div>
                </div>
            </div>

            {/* Panel / modal al tocar un día: lista completa de citas */}
            {selectedDay != null && (
                <>
                    <div
                        className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
                        onClick={() => setSelectedDay(null)}
                        aria-hidden
                    />
                    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 pointer-events-none sm:items-center sm:p-4">
                        <div
                            className="flex max-h-[72vh] w-full min-w-0 flex-col rounded-t-2xl border-t border-slate-200 bg-white shadow-2xl pointer-events-auto animate-in slide-in-from-bottom duration-200 sm:max-h-[85vh] sm:max-w-md sm:rounded-2xl sm:border sm:shadow-xl"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="day-detail-title"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-4 py-4 min-w-0 sm:rounded-t-2xl">
                                <div className="min-w-0 flex-1">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Citas del día</p>
                                    <h3 id="day-detail-title" className="truncate text-lg font-bold text-slate-800">
                                        {selectedDay && new Date(selectedDay + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                                    </h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedDay(null)}
                                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
                                    aria-label="Cerrar"
                                >
                                    <X size={22} />
                                </button>
                            </div>
                            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3">
                                {selectedDayAppointments.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="rounded-2xl bg-slate-100 p-5">
                                            <CalendarDays size={40} className="text-slate-400" />
                                        </div>
                                        <p className="mt-4 font-medium text-slate-600">No hay citas este día</p>
                                        <p className="mt-1 text-sm text-slate-500">Las citas aparecerán aquí al agendarlas</p>
                                    </div>
                                ) : (
                                    selectedDayAppointments.map(app => {
                                        const client = clients.find(c => c.id === app.clienteId);
                                        const barber = barbers.find(b => b.id === app.barberoId);
                                        return (
                                            <div
                                                key={app.id}
                                                className={`flex min-w-0 gap-3 rounded-xl border p-4 break-words ${getStatusStyle(app.estado)}`}
                                            >
                                                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/80">
                                                    <Clock size={18} className="text-slate-600" />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <span className="text-base font-bold text-slate-900">{app.hora}</span>
                                                        <span className="rounded-full px-2 py-0.5 text-xs font-semibold uppercase">{app.estado}</span>
                                                    </div>
                                                    <p className="mt-1 font-medium text-slate-800">{client?.nombre ?? 'Cliente'}</p>
                                                    <p className="flex items-center gap-1.5 text-sm text-slate-600">
                                                        <Scissors size={14} className="flex-shrink-0" />
                                                        {barber?.name ?? 'Barbero'}
                                                    </p>
                                                    {app.servicios?.length > 0 && (
                                                        <p className="mt-2 text-xs text-slate-500">{app.servicios.map(s => s.name).join(', ')}</p>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default CalendarView;