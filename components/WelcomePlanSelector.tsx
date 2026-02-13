import React, { useState, useEffect } from 'react';
import { AccountTier } from '../types';
import { Scissors, User, Users, MapPin, LogIn, ArrowLeft, UserCircle, Store, CheckCircle, Send } from 'lucide-react';
import { DataService } from '../services/data';

/** Configuración de contacto: pon aquí tu número WhatsApp (código país + número sin +) para mostrar el botón. Ej: '5215512345678' */
const CONTACT = {
    whatsapp: '',
    email: 'contacto@barbershow.com',
};

type Step = 'who' | 'barber_plan' | 'barber_registered' | 'barber_contact' | 'client_registered' | 'client_new';
type UserType = 'barbero' | 'cliente';

/** Planes con todo lo incluido detallado para que el cliente sepa qué obtiene */
const TIER_OPTIONS: { value: AccountTier; label: string; description: string; benefits: string[]; icon: React.ReactNode }[] = [
    {
        value: 'solo',
        label: 'Plan Solo',
        description: 'Una persona, un local.',
        benefits: [
            'Interfaz simple: todo es "mi negocio", sin sedes ni lista de barberos',
            'Menú reducido: Dashboard, Citas, Clientes, Ventas (POS), Configuración básica (servicios, datos del negocio)',
            'Citas y ventas directas: no eliges barbero; la cita o venta es contigo',
            'Reportes básicos: resumen de ventas y citas (sin desglose por barbero ni por sede)',
            'Opcional: inventario simple (productos que vendes)',
            'Ideal para: barbero independiente que trabaja solo en un solo lugar',
        ],
        icon: <User size={32} className="text-slate-700" />,
    },
    {
        value: 'barberia',
        label: 'Plan Barbería',
        description: 'Varios barberos, una sede.',
        benefits: [
            'Todo lo del plan Solo',
            'Varios barberos: alta y baja de barberos; asignar citas y ventas por barbero',
            'Agenda por barbero: ver y gestionar la agenda de cada profesional',
            'Reportes por barbero: ver rendimiento y ventas de cada uno',
            'Una sede: un solo local; selector de barbero, no de sede',
            'Control de equipo: gestionar quién hace qué (citas, ventas)',
            'Opcional: inventario, finanzas, Consola WhatsApp, administración de usuarios por rol',
            'Ideal para: barbería con 2–4 barberos en una sola ubicación',
        ],
        icon: <Users size={32} className="text-slate-700" />,
    },
    {
        value: 'multisede',
        label: 'Plan Multi-Sede',
        description: 'Varias ubicaciones o cadena.',
        benefits: [
            'Todo lo del plan Barbería',
            'Varias sedes: crear y gestionar múltiples ubicaciones',
            'Selector de sede: cambiar de sede para ver agenda, barberos y reportes de cada una',
            'Reportes por sede: comparar rendimiento entre ubicaciones',
            'Administración global: vista centralizada; control por sede cuando haga falta',
            'Sin límite de sedes ni barberos: escalable para cadenas',
            'Ideal para: cadenas o negocios con varias barberías',
        ],
        icon: <MapPin size={32} className="text-slate-700" />,
    },
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
    /** Formulario solicitud de acceso (estilo ICC Tech) */
    const [formNombre, setFormNombre] = useState('');
    const [formNegocio, setFormNegocio] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formTelefono, setFormTelefono] = useState('');
    const [formMotivo, setFormMotivo] = useState('');
    const [formAceptoTerminos, setFormAceptoTerminos] = useState(false);

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
        } else if (step === 'barber_contact') { setStep('barber_plan'); setSelectedPlan(null); }
        else if (step === 'client_new') setStep('client_registered');
    };

    const handleEnviarSolicitud = () => {
        if (!formAceptoTerminos) {
            alert('Debes aceptar los Términos de Servicio y la Política de Privacidad.');
            return;
        }
        const body = [
            `Plan solicitado: ${plan?.label ?? selectedPlan}`,
            '',
            `Nombre: ${formNombre}`,
            `Negocio/Barbería: ${formNegocio}`,
            `Correo: ${formEmail}`,
            `Teléfono: ${formTelefono}`,
            '',
            'Motivo / Mensaje:',
            formMotivo || '(Sin mensaje adicional)',
        ].join('\n');
        window.location.href = `mailto:${supportEmail}?subject=Solicitud de acceso - ${plan?.label ?? selectedPlan} - BarberShow&body=${encodeURIComponent(body)}`;
    };

    /** Layout dos paneles como ICC Tech: izquierda = plan elegido, derecha = formulario solicitud */
    if (step === 'barber_contact' && plan) {
        return (
            <div className="min-h-screen min-h-[100dvh] flex flex-col lg:flex-row">
                {/* Panel izquierdo oscuro — plan que quiere */}
                <div className="lg:w-[45%] xl:w-[40%] bg-slate-900 text-white p-6 lg:p-10 flex flex-col justify-between">
                    <div>
                        <button type="button" onClick={goBack} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-8">
                            <ArrowLeft size={16} /> Volver
                        </button>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-[#ffd427] rounded-xl flex items-center justify-center">
                                <Scissors size={24} className="text-slate-900" />
                            </div>
                            <div>
                                <h1 className="text-xl font-semibold text-white">BarberShow</h1>
                                <p className="text-slate-400 text-sm">Sistema para barberías</p>
                            </div>
                        </div>
                        <h2 className="text-2xl lg:text-3xl font-bold text-white mb-3">Solicitud de acceso</h2>
                        <p className="text-slate-300 text-sm lg:text-base mb-8">
                            Gestione citas, ventas y clientes con el plan que mejor se adapte a su negocio.
                        </p>
                        {/* Plan elegido — visible en el lado */}
                        <div className="bg-white/10 rounded-xl border border-white/20 p-5 mb-4">
                            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">Plan seleccionado</p>
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-12 h-12 rounded-lg bg-[#ffd427] flex items-center justify-center [&>svg]:w-6 [&>svg]:h-6 text-slate-900">
                                    {plan.icon}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">{plan.label}</h3>
                                    <p className="text-slate-400 text-sm">{plan.description}</p>
                                </div>
                            </div>
                            <ul className="space-y-2 text-slate-300 text-sm">
                                {plan.benefits.slice(0, 4).map((b, i) => (
                                    <li key={i} className="flex items-start gap-2">
                                        <CheckCircle size={16} className="text-[#ffd427] flex-shrink-0 mt-0.5" />
                                        <span>{b}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500 text-sm mt-6">
                        <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                        <span>Soporte por correo y WhatsApp</span>
                    </div>
                </div>

                {/* Panel derecho claro — formulario */}
                <div className="flex-1 bg-slate-50 lg:bg-white p-6 lg:p-10 flex flex-col justify-center">
                    <div className="max-w-lg mx-auto w-full">
                        <h2 className="text-2xl font-bold text-slate-800 mb-1">Solicitud de acceso empresarial</h2>
                        <p className="text-slate-500 text-sm mb-6">Complete el formulario para registrar su negocio. Nos pondremos en contacto a la brevedad.</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del representante</label>
                                <input
                                    type="text"
                                    value={formNombre}
                                    onChange={(e) => setFormNombre(e.target.value)}
                                    placeholder="Su nombre completo"
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ffd427] focus:border-[#ffd427] text-slate-800"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del negocio / Barbería</label>
                                <input
                                    type="text"
                                    value={formNegocio}
                                    onChange={(e) => setFormNegocio(e.target.value)}
                                    placeholder="Ej: Barbería El Corte"
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ffd427] focus:border-[#ffd427] text-slate-800"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Correo electrónico</label>
                                <input
                                    type="email"
                                    value={formEmail}
                                    onChange={(e) => setFormEmail(e.target.value)}
                                    placeholder="correo@ejemplo.com"
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ffd427] focus:border-[#ffd427] text-slate-800"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                                <input
                                    type="tel"
                                    value={formTelefono}
                                    onChange={(e) => setFormTelefono(e.target.value)}
                                    placeholder="Ej: +52 55 1234 5678"
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ffd427] focus:border-[#ffd427] text-slate-800"
                                />
                            </div>
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Motivo de solicitud</label>
                            <textarea
                                value={formMotivo}
                                onChange={(e) => setFormMotivo(e.target.value)}
                                rows={4}
                                placeholder="Describa brevemente su negocio y por qué desea acceder a BarberShow..."
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ffd427] focus:border-[#ffd427] text-slate-800 resize-none"
                            />
                        </div>
                        <div className="mb-6">
                            <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formAceptoTerminos}
                                    onChange={(e) => setFormAceptoTerminos(e.target.checked)}
                                    className="mt-1 rounded border-slate-300 text-[#ffd427] focus:ring-[#ffd427]"
                                />
                                <span className="text-sm text-slate-600">
                                    Acepto los <button type="button" onClick={() => {}} className="text-[#ffd427] hover:underline font-medium">Términos de Servicio</button> y la <button type="button" onClick={() => {}} className="text-[#ffd427] hover:underline font-medium">Política de Privacidad</button>. Entiendo que mi solicitud será revisada.
                                </span>
                            </label>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-3">
                            <button type="button" onClick={goBack} className="px-4 py-2.5 text-slate-600 hover:text-slate-800 font-medium text-sm">
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleEnviarSolicitud}
                                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors text-sm"
                            >
                                Enviar solicitud <Send size={18} />
                            </button>
                        </div>
                        <p className="mt-6 text-center">
                            <button type="button" onClick={onGoToLogin} className="text-slate-500 hover:text-[#ffd427] text-sm font-medium">
                                Ya tengo cuenta – Iniciar sesión
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen min-h-[100dvh] relative flex flex-col items-center justify-center p-4 safe-area-top safe-area-bottom overflow-hidden">
            {/* Imagen de fondo de barbería difuminada */}
            <div
                className="absolute inset-0 bg-cover bg-center scale-110"
                style={{
                    backgroundImage: `url('/barbershop-bg.png')`,
                    filter: 'blur(14px)',
                }}
                aria-hidden
            />
            {/* Overlay oscuro para legibilidad */}
            <div className="absolute inset-0 bg-slate-900/75" aria-hidden />
            {/* Contenido */}
            <div className="relative z-10 w-full max-w-2xl lg:max-w-6xl min-w-0">
                {/* Logo — tamaño medio, equilibrado */}
                <div className="text-center mb-8">
                    <div className="w-14 h-14 bg-[#ffd427] rounded-xl flex items-center justify-center mx-auto mb-3">
                        <Scissors size={28} className="text-slate-900" />
                    </div>
                    <h1 className="text-2xl font-semibold text-white">BarberShow</h1>
                    <p className="text-slate-400 mt-1 text-sm">Sistema para barberías</p>
                </div>

                {/* Paso 1: ¿Barbero o Cliente? — punto medio: ni muy chico ni muy grande */}
                {step === 'who' && (
                    <>
                        <p className="text-white text-center text-lg font-semibold mb-5">¿Eres Barbero o Cliente?</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 max-w-lg mx-auto">
                            <button
                                type="button"
                                onClick={() => { setUserType('barbero'); setStep('barber_plan'); }}
                                className="flex flex-col items-center gap-3 py-5 px-5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 transition-colors group"
                            >
                                <div className="w-11 h-11 rounded-lg bg-[#ffd427]/20 flex items-center justify-center group-hover:bg-[#ffd427]/30">
                                    <Scissors size={22} className="text-[#ffd427]" strokeWidth={2} />
                                </div>
                                <span className="font-semibold text-white text-base">Barbero</span>
                                <span className="text-slate-400 text-sm text-center leading-snug">Tengo o trabajo en una barbería</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => { setUserType('cliente'); setStep('client_registered'); }}
                                className="flex flex-col items-center gap-3 py-5 px-5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 transition-colors group"
                            >
                                <div className="w-11 h-11 rounded-lg bg-[#ffd427]/20 flex items-center justify-center group-hover:bg-[#ffd427]/30">
                                    <UserCircle size={22} className="text-[#ffd427]" strokeWidth={2} />
                                </div>
                                <span className="font-semibold text-white text-base">Cliente</span>
                                <span className="text-slate-400 text-sm text-center leading-snug">Quiero reservar o comprar</span>
                            </button>
                        </div>
                    </>
                )}

                {/* Barbero: ¿Qué tipo de barbería? */}
                {step === 'barber_plan' && (
                    <>
                        <button type="button" onClick={goBack} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-3">
                            <ArrowLeft size={14} /> Volver
                        </button>
                        <p className="text-white text-center text-base font-semibold mb-1">¿Qué tipo de barbería tienes?</p>
                        <p className="text-slate-400 text-center text-sm mb-4">Elige el plan que mejor describe tu negocio.</p>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
                            {TIER_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => { setSelectedPlan(opt.value); setStep('barber_contact'); }}
                                    className="w-full flex flex-col sm:flex-row lg:flex-col items-start gap-3 p-4 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-left transition-colors group h-full"
                                >
                                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#ffd427]/20 flex items-center justify-center group-hover:bg-[#ffd427]/30 [&>svg]:w-5 [&>svg]:h-5">
                                        {opt.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <span className="font-semibold text-white block text-sm">{opt.label}</span>
                                        <span className="text-xs text-slate-400 block mt-0.5">{opt.description}</span>
                                        <ul className="mt-2 space-y-1 text-slate-400 text-xs">
                                            {opt.benefits.map((b, i) => (
                                                <li key={i} className="flex gap-2">
                                                    <span className="text-[#ffd427] flex-shrink-0">✓</span>
                                                    <span>{b}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </>
                )}

                {/* Barbero: ¿Ya registrado o nuevo? — mismo equilibrio que who */}
                {step === 'barber_registered' && (
                    <div className="max-w-lg mx-auto">
                        <button type="button" onClick={goBack} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-4">
                            <ArrowLeft size={14} /> Volver
                        </button>
                        <p className="text-white text-center text-lg font-semibold mb-5">¿Ya estás registrado o eres nuevo?</p>
                        <div className="space-y-4 mb-6">
                            <button
                                type="button"
                                onClick={onGoToLogin}
                                className="w-full flex items-center justify-center gap-2 py-4 rounded-lg bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-semibold text-base transition-colors"
                            >
                                <LogIn size={20} />
                                Ya estoy registrado
                            </button>
                            <button
                                type="button"
                                onClick={() => setStep('barber_contact')}
                                className="w-full flex items-center justify-center gap-2 py-4 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium text-base transition-colors"
                            >
                                Soy nuevo – quiero que me den de alta
                            </button>
                        </div>
                    </div>
                )}

                {/* Cliente: ¿Ya registrado o nuevo? — mismo equilibrio */}
                {step === 'client_registered' && (
                    <div className="max-w-lg mx-auto">
                        <button type="button" onClick={goBack} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-4">
                            <ArrowLeft size={14} /> Volver
                        </button>
                        <p className="text-white text-center text-lg font-semibold mb-5">¿Ya estás registrado o eres nuevo?</p>
                        <div className="space-y-4 mb-6">
                            <button
                                type="button"
                                onClick={onGoToLogin}
                                className="w-full flex items-center justify-center gap-2 py-4 rounded-lg bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-semibold text-base transition-colors"
                            >
                                <LogIn size={20} />
                                Ya estoy registrado
                            </button>
                            <button
                                type="button"
                                onClick={() => setStep('client_new')}
                                className="w-full flex items-center justify-center gap-2 py-4 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium text-base transition-colors"
                            >
                                Soy nuevo
                            </button>
                        </div>
                    </div>
                )}

                {/* Cliente nuevo: ver barberías — mismo equilibrio */}
                {step === 'client_new' && (
                    <div className="max-w-lg mx-auto">
                        <button type="button" onClick={goBack} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm mb-4">
                            <ArrowLeft size={14} /> Volver
                        </button>
                        <p className="text-white text-center text-lg font-semibold mb-5">¿No tienes barbería aún?</p>
                        {onGoToBarberias && (
                            <button
                                type="button"
                                onClick={onGoToBarberias}
                                className="w-full flex items-center justify-center gap-2 py-4 rounded-lg bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-semibold text-base transition-colors mb-4"
                            >
                                <Store size={20} /> Ver barberías – elegir una y agendar cita
                            </button>
                        )}
                        <div className="bg-white/10 rounded-lg border border-white/20 p-5 mb-5">
                            <p className="text-white font-medium text-sm mb-2">O regístrate en una barbería:</p>
                            <p className="text-slate-400 text-sm">
                                Visita la barbería donde quieres reservar y escanea el código QR o pide el enlace.
                            </p>
                            <p className="text-slate-500 text-sm mt-2">Si ya te registraste, inicia sesión abajo.</p>
                        </div>
                        <button
                            type="button"
                            onClick={onGoToLogin}
                            className="w-full flex items-center justify-center gap-2 py-4 rounded-lg bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium text-base transition-colors"
                        >
                            <LogIn size={18} /> Iniciar sesión
                        </button>
                    </div>
                )}

                {/* Enlace a login en paso "who" — mismo equilibrio */}
                {step === 'who' && (
                    <div className="max-w-lg mx-auto pt-6 border-t border-white/10">
                        <button type="button" onClick={onGoToLogin} className="w-full flex items-center justify-center gap-2 py-3 text-slate-400 hover:text-[#ffd427] text-sm font-medium transition-colors">
                            <LogIn size={18} /> Ya tengo cuenta – Iniciar sesión
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WelcomePlanSelector;
