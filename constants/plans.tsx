import React from 'react';
import { Scissors, User, Users, MapPin } from 'lucide-react';
import type { AccountTier } from '../types';

export const CONTACT = {
    whatsapp: '18295992941',
    email: 'corona1985@iccdigitalgroup.com',
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

const PLAN_BENEFIT_COUNTS: Record<AccountTier, number> = {
    gratuito: 4,
    solo: 6,
    barberia: 8,
    multisede: 7,
};

const TIER_DEFS: { value: AccountTier; price: number; icon: React.ReactNode }[] = [
    { value: 'gratuito', price: 0, icon: <Scissors size={32} className="text-slate-600" /> },
    { value: 'solo', price: 14.95, icon: <User size={32} className="text-slate-700" /> },
    { value: 'barberia', price: 19.95, icon: <Users size={32} className="text-slate-700" /> },
    { value: 'multisede', price: 29.95, icon: <MapPin size={32} className="text-slate-700" /> },
];

export function getTierOptions(t: (key: string) => string): TierOption[] {
    return TIER_DEFS.map((def) => ({
        value: def.value,
        price: def.price,
        icon: def.icon,
        label: t(`plans.${def.value}.label`),
        description: t(`plans.${def.value}.description`),
        benefits: Array.from({ length: PLAN_BENEFIT_COUNTS[def.value] }, (_, i) =>
            t(`plans.${def.value}.benefit${i}`),
        ),
    }));
}

/** @deprecated Use getTierOptions(t) inside components */
export const TIER_OPTIONS: TierOption[] = [];
