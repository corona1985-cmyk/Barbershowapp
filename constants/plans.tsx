import React from 'react';
import { Scissors, User, Users, MapPin } from 'lucide-react';
import type { AccountTier } from '../types';

export const CONTACT = {
    whatsapp: '18295992941',
    email: 'contacto@barbershow.com',
    solicitudEmail: 'corona1985@iccdigitalgroup.com',
    solicitudWhatsApp: '18295992941',
    phoneDisplay: '829 599 2941',
};

export type TierOption = {
    value: AccountTier;
    label: string;
    description: string;
    price: number;
    benefits: string[];
    icon: React.ReactNode;
};

/** Planes con precios (USD/mes). Gratuito = solo ver citas, 100/mes. */
export const TIER_OPTIONS: TierOption[] = [
    {
        value: 'gratuito',
        label: 'Plan Gratuito',
        description: 'Solo ver y gestionar citas. Hasta 100 citas al mes.',
        price: 0,
        benefits: [
            'Solo agenda de citas: ver citas agendadas',
            'Contador de citas mensuales (máximo 100 por mes)',
            'Sin ventas POS, ni clientes, ni reportes ni inventario',
            'Ideal para probar la app o negocios muy pequeños',
        ],
        icon: <Scissors size={32} className="text-slate-600" />,
    },
    {
        value: 'solo',
        label: 'Plan Solo',
        description: 'Una persona, un local.',
        price: 14.95,
        benefits: [
            'Interfaz simple: todo es "mi negocio", sin sedes ni lista de barberos',
            'Menú reducido: Dashboard, Citas, Clientes, Ventas (POS), Configuración básica',
            'Citas y ventas directas: no eliges barbero; la cita o venta es contigo',
            'Reportes básicos: resumen de ventas y citas',
            'Opcional: inventario simple (productos que vendes)',
            'Ideal para: barbero independiente que trabaja solo',
        ],
        icon: <User size={32} className="text-slate-700" />,
    },
    {
        value: 'barberia',
        label: 'Plan Barbería',
        description: 'Varios barberos, una sede.',
        price: 19.95,
        benefits: [
            'Todo lo del plan Solo',
            'Varios barberos: alta y baja de barberos; asignar citas y ventas por barbero',
            'Agenda por barbero: ver y gestionar la agenda de cada profesional',
            'Reportes por barbero: ver rendimiento y ventas de cada uno',
            'Una sede: un solo local; selector de barbero, no de sede',
            'Control de equipo: gestionar quién hace qué (citas, ventas)',
            'Opcional: inventario, finanzas, Consola WhatsApp, administración de usuarios',
            'Ideal para: barbería con 2–4 barberos en una sola ubicación',
        ],
        icon: <Users size={32} className="text-slate-700" />,
    },
    {
        value: 'multisede',
        label: 'Plan Multi-Sede',
        description: 'Varias ubicaciones o cadena.',
        price: 29.95,
        benefits: [
            'Todo lo del plan Barbería',
            'Varias sedes: crear y gestionar múltiples ubicaciones',
            'Selector de sede: cambiar de sede para ver agenda, barberos y reportes',
            'Reportes por sede: comparar rendimiento entre ubicaciones',
            'Administración global: vista centralizada; control por sede',
            'Sin límite de sedes ni barberos: escalable para cadenas',
            'Ideal para: cadenas o negocios con varias barberías',
        ],
        icon: <MapPin size={32} className="text-slate-700" />,
    },
];
