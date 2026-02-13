import React from 'react';
import { AccountTier } from '../types';
import { Scissors, User, Users, MapPin } from 'lucide-react';

interface OnboardingTierProps {
    /** Nombre de la sede/negocio para personalizar el mensaje */
    businessName?: string;
    onSelect: (tier: AccountTier) => void;
}

const TIER_OPTIONS: { value: AccountTier; label: string; description: string; icon: React.ReactNode }[] = [
    {
        value: 'solo',
        label: 'Solo yo en mi barbería',
        description: 'Una persona, un local. Menú simplificado y reportes básicos.',
        icon: <User size={28} className="text-slate-700" />,
    },
    {
        value: 'barberia',
        label: 'Tengo equipo (varios barberos)',
        description: 'Varios barberos en una sede. Agenda y reportes por barbero.',
        icon: <Users size={28} className="text-slate-700" />,
    },
    {
        value: 'multisede',
        label: 'Varias ubicaciones o cadena',
        description: 'Múltiples sedes. Administración global y reportes por sede.',
        icon: <MapPin size={28} className="text-slate-700" />,
    },
];

const OnboardingTier: React.FC<OnboardingTierProps> = ({ businessName, onSelect }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/95 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border-t-4 border-[#ffd427]">
                <div className="p-6 md:p-8">
                    <div className="flex justify-center mb-4">
                        <div className="w-14 h-14 bg-[#ffd427] rounded-xl flex items-center justify-center shadow-lg">
                            <Scissors size={28} className="text-slate-900" />
                        </div>
                    </div>
                    <h2 className="text-xl md:text-2xl font-bold text-slate-800 text-center mb-1">
                        ¿Cómo trabajas?
                    </h2>
                    <p className="text-slate-500 text-center text-sm mb-6">
                        {businessName ? `Configura "${businessName}" según tu tipo de negocio.` : 'Elige la opción que mejor describe tu negocio.'}
                    </p>

                    <div className="space-y-3">
                        {TIER_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                type="button"
                                onClick={() => onSelect(opt.value)}
                                className="w-full flex items-start gap-4 p-4 rounded-xl border-2 border-slate-200 hover:border-[#ffd427] hover:bg-amber-50/50 transition-all text-left group"
                            >
                                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center group-hover:bg-[#ffd427]/20">
                                    {opt.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <span className="font-bold text-slate-800 block">{opt.label}</span>
                                    <span className="text-sm text-slate-500 block mt-0.5">{opt.description}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OnboardingTier;
