import React, { useState, useEffect, useRef } from 'react';
import { Bell, Clock, X, Calendar } from 'lucide-react';
import { DataService } from '../services/data';
import { Appointment, Client, Barber } from '../types';
import { ViewState } from '../types';

const MINUTES_BEFORE_ALERT = 15;
const POLL_INTERVAL_MS = 60_000; // 1 minuto

interface BarberNotificationBellProps {
    isPlanPro: boolean;
    userRole: string;
    onChangeView?: (view: ViewState) => void;
}

/** Campana de notificaciones para el barbero: alerta cuando se acerca la hora de una cita. Solo visible en plan Pro. */
const BarberNotificationBell: React.FC<BarberNotificationBellProps> = ({ isPlanPro, userRole, onChangeView }) => {
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [open, setOpen] = useState(false);
    const [notifiedIds, setNotifiedIds] = useState<Set<number>>(new Set());
    const dropdownRef = useRef<HTMLDivElement>(null);

    const canSee = isPlanPro && ['barbero', 'admin', 'superadmin'].includes(userRole);
    const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>(() => typeof Notification !== 'undefined' ? Notification.permission : 'denied');

    const requestNotificationPermission = () => {
        if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
            Notification.requestPermission().then((p) => setNotificationPermission(p));
        }
    };

    const todayStr = new Date().toISOString().split('T')[0];
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();

    const getSlotMinutes = (hora: string): number => {
        const [h, m] = hora.split(':').map(Number);
        return (h || 0) * 60 + (m || 0);
    };

    // Citas de hoy (confirmadas o pendientes) que aún no han pasado
    const upcomingToday = appointments.filter((a) => {
        if (a.fecha !== todayStr || (a.estado !== 'confirmada' && a.estado !== 'pendiente')) return false;
        const slot = getSlotMinutes(a.hora);
        return slot > nowMinutes;
    }).sort((a, b) => getSlotMinutes(a.hora) - getSlotMinutes(b.hora));

    // Citas que están por llegar en los próximos MINUTES_BEFORE_ALERT minutos (para alerta y badge)
    const approaching = upcomingToday.filter((a) => {
        const slot = getSlotMinutes(a.hora);
        const diff = slot - nowMinutes;
        return diff > 0 && diff <= MINUTES_BEFORE_ALERT;
    });

    const badgeCount = approaching.length;

    const loadData = async () => {
        if (!canSee) return;
        const [appts, clientsList, barbersList] = await Promise.all([
            DataService.getAppointments(),
            DataService.getClients(),
            DataService.getBarbers(),
        ]);
        const today = appts.filter((a) => a.fecha === todayStr && a.estado !== 'cancelada');
        setAppointments(today);
        setClients(clientsList);
        setBarbers(barbersList);
    };

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [canSee, todayStr]);

    // Notificación del navegador cuando una cita se acerca (solo una vez por cita)
    const approachingIds = approaching.map((a) => a.id).sort((a, b) => a - b).join(',');
    useEffect(() => {
        if (!canSee || approaching.length === 0) return;
        setNotifiedIds((prev) => {
            const idsToNotify = approaching.map((a) => a.id).filter((id) => !prev.has(id));
            if (idsToNotify.length === 0) return prev;
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                idsToNotify.forEach((id) => {
                    const apt = appointments.find((a) => a.id === id);
                    if (!apt) return;
                    const client = clients.find((c) => c.id === apt.clienteId);
                    const barber = barbers.find((b) => b.id === apt.barberoId);
                    new Notification('BarberShow – Cita próxima', {
                        body: `${client?.nombre ?? 'Cliente'} a las ${apt.hora}${barber ? ` con ${barber.name}` : ''}`,
                        icon: '/manifest.json',
                    });
                });
                return new Set([...prev, ...idsToNotify]);
            }
            return prev;
        });
    }, [canSee, approachingIds]);

    // Cerrar dropdown al hacer clic fuera
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const goToAppointments = () => {
        setOpen(false);
        onChangeView?.('appointments');
    };

    if (!canSee) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="relative p-2 rounded-full text-slate-600 hover:bg-slate-200 hover:text-slate-800 transition-colors border border-slate-200 bg-white shadow-sm"
                title="Citas próximas (Plan Pro)"
            >
                <Bell size={22} className="text-slate-700" />
                {badgeCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center bg-amber-500 text-white text-xs font-bold rounded-full px-1">
                        {badgeCount > 9 ? '9+' : badgeCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-full mt-2 w-80 max-h-[400px] bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden flex flex-col">
                    <div className="p-3 border-b border-slate-100 bg-amber-50 flex items-center justify-between">
                        <span className="font-bold text-slate-800 flex items-center gap-2">
                            <Bell size={18} className="text-amber-600" />
                            Citas próximas
                        </span>
                        <span className="text-[10px] uppercase text-amber-700 font-semibold bg-amber-200/80 px-2 py-0.5 rounded">Pro</span>
                        <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 p-1">
                            <X size={18} />
                        </button>
                    </div>
                    <div className="overflow-y-auto flex-1 max-h-72">
                        {upcomingToday.length === 0 ? (
                            <div className="p-6 text-center text-slate-500 text-sm">
                                <Calendar size={32} className="mx-auto mb-2 text-slate-300" />
                                <p>No hay citas pendientes hoy</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {upcomingToday.slice(0, 10).map((apt) => {
                                    const client = clients.find((c) => c.id === apt.clienteId);
                                    const barber = barbers.find((b) => b.id === apt.barberoId);
                                    const slot = getSlotMinutes(apt.hora);
                                    const diff = slot - nowMinutes;
                                    const isApproaching = diff > 0 && diff <= MINUTES_BEFORE_ALERT;
                                    const minutesLabel = diff <= 0 ? 'Ahora' : diff <= 60 ? `En ${diff} min` : `En ${Math.floor(diff / 60)} h`;
                                    return (
                                        <li key={apt.id} className={`p-3 hover:bg-slate-50 transition-colors ${isApproaching ? 'bg-amber-50/80' : ''}`}>
                                            <div className="flex items-start gap-3">
                                                <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${isApproaching ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                                    <Clock size={18} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-slate-800 truncate">{client?.nombre ?? 'Cliente'}</p>
                                                    <p className="text-sm text-slate-500 flex items-center gap-1">
                                                        <span className="font-mono font-medium text-slate-700">{apt.hora}</span>
                                                        {barber && <span className="text-slate-400">· {barber.name}</span>}
                                                    </p>
                                                    <p className={`text-xs font-medium mt-0.5 ${isApproaching ? 'text-amber-700' : 'text-slate-400'}`}>
                                                        {minutesLabel}
                                                    </p>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                    <div className="p-2 border-t border-slate-100 bg-slate-50 space-y-2">
                        {notificationPermission === 'default' && (
                            <button type="button" onClick={requestNotificationPermission} className="w-full py-1.5 text-xs font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg">
                                Activar alertas en el navegador
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={goToAppointments}
                            className="w-full py-2 text-sm font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors"
                        >
                            Ver agenda de citas
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BarberNotificationBell;
