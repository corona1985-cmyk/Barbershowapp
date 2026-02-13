import React, { useState, useEffect } from 'react';
import { AccountTier } from '../types';
import { Scissors, User, Users, MapPin, MessageCircle, Mail, LogIn, ArrowLeft, UserCircle, Store } from 'lucide-react';
import { DataService } from '../services/data';

/** Configuración de contacto: pon aquí tu número WhatsApp (código país + número sin +) para mostrar el botón. Ej: '5215512345678' */
const CONTACT = {
    whatsapp: '',
    email: 'contacto@barbershow.com',
};

type Step = 'who' | 'barber_plan' | 'barber_registered' | 'barber_contact' | 'client_registered' | 'client_new';
type UserType = 'barbero' | 'cliente';

const TIER_OPTIONS: { value: AccountTier; label: string; description: string; benefits: string[]; icon: React.ReactNode }[] = [
    { value: 'solo', label: 'Plan Solo', description: 'Una persona, un local.', benefits: ['Menú simplificado', 'Citas y ventas directas', 'Reportes básicos', 'Sin complicaciones'], icon: <User size={32} className="text-slate-700" /> },
    { value: 'barberia', label: 'Plan Barbería', description: 'Varios barberos, una sede.', benefits: ['Varios barberos', 'Agenda y reportes por barbero', 'Control de equipo', 'Inventario y finanzas'], icon: <Users size={32} className="text-slate-700" /> },
    { value: 'multisede', label: 'Plan Multi-Sede', description: 'Varias ubicaciones o cadena.', benefits: ['Múltiples sedes', 'Reportes por sede', 'Administración centralizada', 'Escalable'], icon: <MapPin size={32} className="text-slate-700" /> },
];

interface WelcomePlanSelectorProps {
    onGoToLogin: () => void;
    /** Cliente nuevo: ir al listado de barberías para elegir una y registrarse o agendar. */
    onGoToBarberias?: () => void;
}

const WelcomePlanSelector: React.FC<WelcomePlanSelectorProps> = ({ onGoToLogin, onGoToBarberias }) => {
    const [step, setStep] = useState<Step>('who');
    const [userType, setUserType] = useState<UserType | null>(null);
    const [selectedPlan, setSelectedPlan] = useState<AccountTier | null>(null);
    const [supportEmail, setSupportEmail] = useState(CONTACT.email);

    useEffect(() => {
        DataService.getGlobalSettings().then((s) => setSupportEmail(s?.supportEmail || CONTACT.email)).catch(() => {});
    }, []);

    const plan = selectedPlan ? TIER_OPTIONS.find((o) => o.value === selectedPlan) : null;
    const whatsappNumber = CONTACT.whatsapp;
    const whatsappMessage = selectedPlan
        ? `Hola, quiero activar el plan ${plan?.label ?? selectedPlan.toUpperCase()} en BarberShow. ¿Me pueden dar de alta?`
        : '';
    const waLink = whatsappNumber && whatsappMessage
        ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`
        : null;

    const goBack = () => {
        if (step === 'barber_plan' || step === 'client_registered') {
            setStep('who');
            setUserType(null);
        } else if (step === 'barber_registered') {
            setStep('barber_plan');
            setSelectedPlan(null);
        } else if (step === 'barber_contact') setStep('barber_registered');
        else if (step === 'client_new') setStep('client_registered');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-lg">
                {/* Logo */}
                <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-[#ffd427] rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-yellow-500/20 transform rotate-3">
                        <Scissors size={40} className="text-slate-900" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">BarberShow</h1>
                    <p className="text-slate-400 mt-1 text-sm">Sistema para barberías</p>
                </div>

                {/* Paso 1: ¿Barbero o Cliente? */}
                {step === 'who' && (
                    <>
                        <p className="text-white text-center text-lg font-medium mb-6">¿Eres Barbero o Cliente?</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                            <button
                                type="button"
                                onClick={() => { setUserType('barbero'); setStep('barber_plan'); }}
                                className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 transition-all group"
                            >
                                <div className="w-16 h-16 rounded-xl bg-[#ffd427]/20 flex items-center justify-center group-hover:bg-[#ffd427]/30">
                                    <Scissors size={32} className="text-[#ffd427]" />
                                </div>
                                <span className="font-bold text-white text-lg">Barbero</span>
                                <span className="text-slate-400 text-sm text-center">Tengo o trabajo en una barbería</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => { setUserType('cliente'); setStep('client_registered'); }}
                                className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 transition-all group"
                            >
                                <div className="w-16 h-16 rounded-xl bg-[#ffd427]/20 flex items-center justify-center group-hover:bg-[#ffd427]/30">
                                    <UserCircle size={32} className="text-[#ffd427]" />
                                </div>
                                <span className="font-bold text-white text-lg">Cliente</span>
                                <span className="text-slate-400 text-sm text-center">Quiero reservar o comprar</span>
                            </button>
                        </div>
                    </>
                )}

                {/* Barbero: ¿Qué tipo de barbería? */}
                {step === 'barber_plan' && (
                    <>
                        <button type="button" onClick={goBack} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-4">
                            <ArrowLeft size={16} /> Volver
                        </button>
                        <p className="text-white text-center text-lg font-medium mb-2">¿Qué tipo de barbería tienes?</p>
                        <p className="text-slate-400 text-center text-sm mb-6">Elige el plan que mejor describe tu negocio.</p>
                        <div className="space-y-3 mb-6">
                            {TIER_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => { setSelectedPlan(opt.value); setStep('barber_registered'); }}
                                    className="w-full flex items-center gap-4 p-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-left transition-all group"
                                >
                                    <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-[#ffd427]/20 flex items-center justify-center group-hover:bg-[#ffd427]/30">
                                        {opt.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="font-bold text-white block">{opt.label}</span>
                                        <span className="text-sm text-slate-300 block mt-0.5">{opt.description}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {/* Barbero: ¿Ya registrado o nuevo? (solo si eligió plan) */}
                {step === 'barber_registered' && (
                    <>
                        <button type="button" onClick={goBack} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-4">
                            <ArrowLeft size={16} /> Volver
                        </button>
                        <p className="text-white text-center text-lg font-medium mb-6">¿Ya estás registrado o eres nuevo?</p>
                        <div className="space-y-3 mb-6">
                            <button
                                type="button"
                                onClick={onGoToLogin}
                                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-bold transition-colors"
                            >
                                <LogIn size={22} />
                                Ya estoy registrado
                            </button>
                            <button
                                type="button"
                                onClick={() => setStep('barber_contact')}
                                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold transition-colors"
                            >
                                Soy nuevo – quiero que me den de alta
                            </button>
                        </div>
                    </>
                )}

                {/* Barbero nuevo: contacto con plan */}
                {step === 'barber_contact' && plan && (
                    <>
                        <button type="button" onClick={goBack} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-4">
                            <ArrowLeft size={16} /> Volver
                        </button>
                        <div className="bg-white/10 rounded-2xl border border-white/20 p-6 mb-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 rounded-xl bg-[#ffd427] flex items-center justify-center">{plan.icon}</div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">{plan.label}</h2>
                                    <p className="text-slate-300 text-sm">{plan.description}</p>
                                </div>
                            </div>
                            <ul className="space-y-2 text-slate-200 text-sm">
                                {plan.benefits.map((b, i) => (
                                    <li key={i} className="flex items-center gap-2"><span className="text-[#ffd427]">✓</span> {b}</li>
                                ))}
                            </ul>
                        </div>
                        <p className="text-slate-300 text-center text-sm mb-4">
                            Contáctanos y te creamos tu usuario con el plan <strong className="text-white">{plan.label}</strong>.
                        </p>
                        <div className="flex flex-col gap-3 mb-6">
                            {waLink && (
                                <a href={waLink} target="_blank" rel="noopener noreferrer" className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold transition-colors">
                                    <MessageCircle size={20} /> Contactar por WhatsApp
                                </a>
                            )}
                            <a
                                href={`mailto:${supportEmail}?subject=Solicitud plan ${plan.label} - BarberShow&body=${encodeURIComponent(whatsappMessage || 'Hola, quiero activar un plan en BarberShow.')}`}
                                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold transition-colors"
                            >
                                <Mail size={20} /> Enviar correo
                            </a>
                        </div>
                        <button type="button" onClick={onGoToLogin} className="w-full flex items-center justify-center gap-2 py-3 text-[#ffd427] hover:text-amber-300 font-medium text-sm">
                            <LogIn size={18} /> Ya tengo cuenta – Iniciar sesión
                        </button>
                    </>
                )}

                {/* Cliente: ¿Ya registrado o nuevo? */}
                {step === 'client_registered' && (
                    <>
                        <button type="button" onClick={goBack} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-4">
                            <ArrowLeft size={16} /> Volver
                        </button>
                        <p className="text-white text-center text-lg font-medium mb-6">¿Ya estás registrado o eres nuevo?</p>
                        <div className="space-y-3 mb-6">
                            <button
                                type="button"
                                onClick={onGoToLogin}
                                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-bold transition-colors"
                            >
                                <LogIn size={22} />
                                Ya estoy registrado
                            </button>
                            <button
                                type="button"
                                onClick={() => setStep('client_new')}
                                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold transition-colors"
                            >
                                Soy nuevo
                            </button>
                        </div>
                    </>
                )}

                {/* Cliente nuevo: ver barberías o mensaje + iniciar sesión */}
                {step === 'client_new' && (
                    <>
                        <button type="button" onClick={goBack} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-4">
                            <ArrowLeft size={16} /> Volver
                        </button>
                        <p className="text-white text-center font-medium mb-4">¿No tienes barbería aún?</p>
                        {onGoToBarberias && (
                            <button
                                type="button"
                                onClick={onGoToBarberias}
                                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-bold transition-colors mb-4"
                            >
                                <Store size={22} /> Ver barberías – elegir una y agendar cita
                            </button>
                        )}
                        <div className="bg-white/10 rounded-2xl border border-white/20 p-6 mb-6">
                            <p className="text-white font-medium mb-2">O regístrate en una barbería:</p>
                            <p className="text-slate-300 text-sm">
                                Visita la barbería donde quieres reservar y escanea el código QR o pide el enlace. Así te darán de alta y podrás agendar citas y comprar desde aquí.
                            </p>
                            <p className="text-slate-400 text-sm mt-4">
                                Si ya te registraste, inicia sesión abajo.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onGoToLogin}
                            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-medium transition-colors"
                        >
                            <LogIn size={20} /> Iniciar sesión
                        </button>
                    </>
                )}

                {/* En paso "who" mostramos también enlace directo a login */}
                {step === 'who' && (
                    <div className="pt-6 border-t border-white/10">
                        <button type="button" onClick={onGoToLogin} className="w-full flex items-center justify-center gap-2 py-3 text-slate-400 hover:text-[#ffd427] text-sm">
                            <LogIn size={18} /> Ya tengo cuenta – Iniciar sesión
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WelcomePlanSelector;
