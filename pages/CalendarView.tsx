import React, { useState, useEffect } from 'react';
import { DataService } from '../services/data';
import { Appointment, Barber } from '../types';
import { ChevronLeft, ChevronRight, Clock, User, MapPin } from 'lucide-react';

const CalendarView: React.FC = () => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [selectedBarber, setSelectedBarber] = useState<number | 'all'>('all');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [currentBarberiaName, setCurrentBarberiaName] = useState<string>('');
    const currentBarberId = DataService.getCurrentBarberId();
    const isBarberoView = currentBarberId != null;

    useEffect(() => {
        Promise.all([
            DataService.getAppointments(),
            DataService.getBarbers(),
            DataService.getPointsOfSale(),
        ]).then(([appts, barbersList, posList]) => {
            setAppointments(appts);
            setBarbers(barbersList);
            const activePosId = DataService.getActivePosId();
            const pos = posList.find(p => p.id === activePosId);
            setCurrentBarberiaName(pos ? pos.name : '');
        });
    }, []);

    useEffect(() => {
        if (isBarberoView && currentBarberId != null) setSelectedBarber(currentBarberId);
    }, [isBarberoView, currentBarberId]);

    const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

    const changeMonth = (delta: number) => {
        const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1);
        setCurrentDate(newDate);
    };

    const renderCalendar = () => {
        const totalDays = daysInMonth(currentDate);
        const startDay = firstDayOfMonth(currentDate); // 0 = Sunday
        const days = [];

        // Blanks
        for (let i = 0; i < startDay; i++) {
            days.push(<div key={`blank-${i}`} className="bg-slate-50 border border-slate-100 h-32"></div>);
        }

        // Days
        for (let d = 1; d <= totalDays; d++) {
            const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayAppointments = appointments.filter(a => {
                if (a.fecha !== dateStr) return false;
                if (a.estado === 'cancelada') return false;
                if (isBarberoView && currentBarberId != null) return a.barberoId === currentBarberId;
                if (selectedBarber !== 'all' && a.barberoId !== selectedBarber) return false;
                return true;
            });

            days.push(
                <div key={d} className="bg-white border border-slate-200 h-32 p-2 overflow-y-auto hover:shadow-inner transition-shadow">
                    <div className="font-bold text-slate-700 text-sm mb-1">{d}</div>
                    <div className="space-y-1">
                        {dayAppointments.map(app => (
                            <div key={app.id} className={`text-xs p-1 rounded border truncate ${
                                app.estado === 'confirmada' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                app.estado === 'completada' ? 'bg-green-50 text-green-700 border-green-100' :
                                'bg-yellow-50 text-yellow-700 border-yellow-100'
                            }`}>
                                <span className="font-bold mr-1">{app.hora}</span>
                                {barbers.find(b => b.id === app.barberoId)?.name.split(' ')[0]}
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return days;
    };

    return (
        <div className="space-y-6">
            {currentBarberiaName && (
                <div className="flex items-center gap-2 bg-[#ffd427]/20 border border-[#ffd427]/50 text-slate-800 px-4 py-3 rounded-xl w-fit">
                    <MapPin size={20} className="text-[#ffd427] flex-shrink-0" />
                    <span className="font-semibold">{currentBarberiaName}</span>
                </div>
            )}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                    <Clock className="mr-2" /> Calendario Mensual
                </h2>
                <div className="flex items-center space-x-4 bg-white p-2 rounded-lg shadow-sm border border-slate-200">
                    {!isBarberoView ? (
                        <div className="flex items-center space-x-2">
                            <User size={16} className="text-slate-400"/>
                            <select 
                                className="bg-transparent text-sm font-medium focus:outline-none text-slate-700"
                                value={selectedBarber}
                                onChange={(e) => setSelectedBarber(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                            >
                                <option value="all">Todos los Barberos</option>
                                {barbers.map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div className="flex items-center space-x-2 text-slate-700">
                            <User size={16} className="text-slate-400"/>
                            <span className="text-sm font-medium">Mis citas</span>
                            {barbers.find(b => b.id === currentBarberId) && (
                                <span className="text-xs text-slate-500">({barbers.find(b => b.id === currentBarberId)?.name})</span>
                            )}
                        </div>
                    )}
                    <div className="h-6 w-px bg-slate-200"></div>
                    <div className="flex items-center space-x-2">
                        <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-slate-100 rounded text-slate-600"><ChevronLeft size={20} /></button>
                        <span className="font-bold text-slate-800 w-32 text-center">
                            {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                        </span>
                        <button onClick={() => changeMonth(1)} className="p-1 hover:bg-slate-100 rounded text-slate-600"><ChevronRight size={20} /></button>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
                        <div key={day} className="py-2 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                            {day}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 bg-slate-100 gap-px">
                    {renderCalendar()}
                </div>
            </div>
            
            <div className="flex gap-4 text-xs text-slate-500">
                <div className="flex items-center"><div className="w-3 h-3 bg-blue-50 border border-blue-100 rounded mr-1"></div> Confirmada</div>
                <div className="flex items-center"><div className="w-3 h-3 bg-green-50 border border-green-100 rounded mr-1"></div> Completada</div>
                <div className="flex items-center"><div className="w-3 h-3 bg-yellow-50 border border-yellow-100 rounded mr-1"></div> Pendiente</div>
            </div>
        </div>
    );
};

export default CalendarView;