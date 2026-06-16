import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { AccountTier } from '../types';
import { Scissors, LogIn, ArrowLeft, UserCircle, Store, CheckCircle, Send, MessageCircle, CreditCard, X, Mail, UserPlus } from 'lucide-react';
import { DataService } from '../services/data';
import { createPlanCheckout, activatePlanFromPlay, type PlanCheckoutProvider } from '../services/firebase';
import SelfServiceBarberSignup from './SelfServiceBarberSignup';
import {
    isPlayBillingAvailable,
    initPlayBilling,
    purchasePlan,
    addPlayPurchaseListener,
    getPlayProductId,
    getActivePlayTransactions,
} from '../services/playBilling';
import { CONTACT, TIER_OPTIONS } from '../constants/plans';
import { SUPPORTED_COUNTRIES } from '../constants/regions';
import { formatSignupAddress, getBarriosForCity, getCitiesForCountry } from '../utils/posLocation';
import { navigateToLegal } from '../utils/legal';
import { ALLOW_NATIVE_BARBER_SIGNUP } from '../config/app';

type Step = 'who' | 'barber_plan' | 'barber_registered' | 'barber_contact' | 'client_registered' | 'client_new';
type UserType = 'barbero' | 'cliente';

interface WelcomePlanSelectorProps {
    onGoToLogin: () => void;
    /** Cliente nuevo: ir al listado de barberías para elegir una y registrarse o agendar. */
    onGoToBarberias?: () => void;
    /** Abre el formulario de registro de cliente (sin elegir barbería). */
    onGoToClientRegister?: () => void;
    /** Cuando el barbero completa el autoregistro (plan gratuito), hacer login con estas credenciales. */
    onBarberSignupSuccess?: (username: string, password: string) => void;
    /** Volver a la landing page de marketing. */
    onBackToLanding?: () => void;
}

const WelcomePlanSelector: React.FC<WelcomePlanSelectorProps> = ({ onGoToLogin, onGoToBarberias, onGoToClientRegister, onBarberSignupSuccess, onBackToLanding }) => {
    const isNativeMobile = Capacitor.isNativePlatform();
    const [step, setStep] = useState<Step>('who');
    const [userType, setUserType] = useState<UserType | null>(null);
    const [showSelfSignup, setShowSelfSignup] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState<AccountTier | null>(null);
    const [supportEmail, setSupportEmail] = useState(CONTACT.email);
    /** Formulario solicitud de acceso (estilo ICC Tech) */
    const [formNombre, setFormNombre] = useState('');
    const [formNegocio, setFormNegocio] = useState('');
    const [formPais, setFormPais] = useState('');
    const [formCiudad, setFormCiudad] = useState('');
    const [formBarrio, setFormBarrio] = useState('');
    const [formCalle, setFormCalle] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formTelefono, setFormTelefono] = useState('');
    const [formMotivo, setFormMotivo] = useState('');
    const [formAceptoTerminos, setFormAceptoTerminos] = useState(false);
    /** Ciclo de facturación para "Pagar en la app". */
    const [cicloPago, setCicloPago] = useState<'mensual' | 'anual'>('mensual');
    const [payLoading, setPayLoading] = useState(false);
    const [payPlayLoading, setPayPlayLoading] = useState(false);
    /** Modal para que visitantes sin cuenta vean todos los planes. */
    const [showPlansModal, setShowPlansModal] = useState(false);
    /** Datos para activar el plan tras una compra en Google Play (solo Android). */
    const pendingPlayRef = useRef<{ email: string; nombreNegocio: string; nombreRepresentante: string; plan: AccountTier; cycle: 'mensual' | 'anual' } | null>(null);

    useEffect(() => {
        DataService.getGlobalSettings().then((s) => setSupportEmail(s?.supportEmail || CONTACT.email)).catch(() => {});
    }, []);

    useEffect(() => {
        if (isPlayBillingAvailable()) initPlayBilling();
    }, []);

    useEffect(() => {
        const remove = addPlayPurchaseListener(async () => {
            const pending = pendingPlayRef.current;
            if (!pending) return;
            try {
                const transactions = await getActivePlayTransactions();
                const productId = getPlayProductId(pending.plan, pending.cycle);
                const tx = transactions.find((t) => t.productIdentifier === productId) ?? transactions[0];
                if (!tx?.purchaseToken) {
                    alert('Compra recibida. Si no se activa tu plan, contacta a soporte con tu correo.');
                    pendingPlayRef.current = null;
                    return;
                }
                const result = await activatePlanFromPlay({
                    purchaseToken: tx.purchaseToken,
                    productId: tx.productIdentifier,
                    email: pending.email,
                    nombreNegocio: pending.nombreNegocio || undefined,
                    nombreRepresentante: pending.nombreRepresentante || undefined,
                });
                pendingPlayRef.current = null;
                if (result.success) alert('Plan activado. Ya puedes iniciar sesión con tu correo.');
                else alert(result.message || 'No se pudo activar el plan. Contacta a soporte.');
            } catch (e) {
                console.error(e);
                alert('Error al activar el plan. Contacta a soporte con tu correo.');
                pendingPlayRef.current = null;
            }
        });
        return remove;
    }, []);

    const plan = selectedPlan ? TIER_OPTIONS.find((o) => o.value === selectedPlan) : null;
    const whatsappNumber = CONTACT.whatsapp;
    const whatsappMessage = selectedPlan
        ? `Hola, quiero activar el plan ${plan?.label ?? selectedPlan.toUpperCase()} en BarberShow. ¿Me pueden dar de alta?`
        : '';
    const waLink = whatsappNumber && whatsappMessage
        ? `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`
        : null;

    /** Enlace de contacto genérico para la pantalla de inicio (sin plan seleccionado) */
    const homeContactWhatsAppHref = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent('Hola, tengo una consulta sobre BarberShow.')}`;
    const homeContactEmailHref = `mailto:${supportEmail}?subject=${encodeURIComponent('Consulta BarberShow')}`;

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

    const getSolicitudBody = () =>
        [
            `Plan solicitado: ${plan?.label ?? selectedPlan}`,
            '',
            `Nombre: ${formNombre}`,
            `Negocio/Barbería: ${formNegocio}`,
            `País: ${formPais || '(No indicado)'}`,
            `Ciudad: ${formCiudad || '(No indicada)'}`,
            `Barrio/Zona: ${formBarrio || '(No indicado)'}`,
            `Dirección: ${formPais && formCiudad && formBarrio ? formatSignupAddress(formCalle, formBarrio, formCiudad, formPais) : formCalle || '(No indicada)'}`,
            `Correo: ${formEmail}`,
            `Teléfono: ${formTelefono}`,
            '',
            'Motivo / Mensaje:',
            formMotivo || '(Sin mensaje adicional)',
        ].join('\n');

    const handleEnviarSolicitudCorreo = () => {
        if (!formAceptoTerminos) {
            alert('Debes aceptar los Términos de Servicio y la Política de Privacidad.');
            return;
        }
        const body = getSolicitudBody();
        const subject = `Solicitud de acceso - ${plan?.label ?? selectedPlan} - BarberShow`;
        const mailto = `mailto:${CONTACT.solicitudEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        const a = document.createElement('a');
        a.href = mailto;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    const handleEnviarSolicitudWhatsApp = () => {
        if (!formAceptoTerminos) {
            alert('Debes aceptar los Términos de Servicio y la Política de Privacidad.');
            return;
        }
        const body = getSolicitudBody();
        const url = `https://wa.me/${CONTACT.solicitudWhatsApp}?text=${encodeURIComponent(body)}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const handlePagarEnApp = async (provider?: PlanCheckoutProvider) => {
        if (!formAceptoTerminos) {
            alert('Debes aceptar los Términos de Servicio y la Política de Privacidad.');
            return;
        }
        if (!formEmail?.trim()) {
            alert('Indica tu correo electrónico para continuar al pago.');
            return;
        }
        if (!plan || !selectedPlan) return;
        setPayLoading(true);
        try {
            const { url } = await createPlanCheckout({
                plan: selectedPlan,
                ciclo: cicloPago,
                email: formEmail.trim(),
                nombreNegocio: formNegocio.trim() || undefined,
                nombreRepresentante: formNombre.trim() || undefined,
                ...(provider && { provider }),
            });
            if (url) window.location.href = url;
        } catch (e) {
            console.error(e);
            alert('El pago en la app aún no está configurado. Por ahora usa "Enviar por WhatsApp" o "Enviar por correo". En el proyecto ver el archivo PLANES_EN_APP.md para activar el pago con Stripe, Mercado Pago o PayPal.');
        } finally {
            setPayLoading(false);
        }
    };

    const handlePagarConGooglePlay = async () => {
        if (!formAceptoTerminos) {
            alert('Debes aceptar los Términos de Servicio y la Política de Privacidad.');
            return;
        }
        if (!formEmail?.trim()) {
            alert('Indica tu correo electrónico para activar tu plan tras la compra.');
            return;
        }
        if (!plan || !selectedPlan) return;
        setPayPlayLoading(true);
        pendingPlayRef.current = {
            email: formEmail.trim(),
            nombreNegocio: formNegocio.trim(),
            nombreRepresentante: formNombre.trim(),
            plan: selectedPlan,
            cycle: cicloPago,
        };
        try {
            const result = await purchasePlan(selectedPlan, cicloPago);
            if (result.success) {
                // El diálogo de Google Play se abrió; el resultado llega por addPlayPurchaseListener.
                alert('Completa el pago en la ventana de Google Play. Al confirmar, tu plan se activará automáticamente.');
            } else {
                pendingPlayRef.current = null;
                alert(result.message || 'No se pudo abrir la tienda.');
            }
        } catch (e) {
            pendingPlayRef.current = null;
            console.error(e);
            alert('Error al abrir Google Play.');
        } finally {
            setPayPlayLoading(false);
        }
    };

    /** Layout dos paneles como ICC Tech: izquierda = plan elegido, derecha = formulario solicitud */
    if (step === 'barber_contact' && plan && !isNativeMobile) {
        return (
            <div className="min-h-screen min-h-[100dvh] flex flex-col lg:flex-row">
                {/* Panel izquierdo oscuro — plan que quiere */}
                <div className="lg:w-[45%] xl:w-[40%] bg-slate-900 text-white p-6 lg:p-10 flex flex-col justify-between">
                    <div>
                        <button type="button" onClick={goBack} className="flex items-center gap-1.5 min-h-[44px] text-slate-400 hover:text-white text-sm mb-8 rounded-lg w-fit px-2 -ml-2 active:bg-white/10">
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
                                    <div className="flex items-baseline gap-2">
                                        <h3 className="text-lg font-bold text-white">{plan.label}</h3>
                                        <span className="text-[#ffd427] font-bold">{plan.price === 0 ? 'Gratis' : `$${plan.price.toFixed(2)}/mes`}</span>
                                    </div>
                                    {plan.value !== 'gratuito' && (
                                        <p className="text-sm text-emerald-500 font-medium mt-0.5">Sin Anuncios</p>
                                    )}
                                    {plan.price > 0 && (
                                        <p className="text-slate-400 text-sm mt-0.5">Paga 1 año: <span className="text-green-400 font-semibold">-40%</span> → ${(plan.price * 0.6).toFixed(2)}/mes</p>
                                    )}
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
                    <a
                        href={waLink || `mailto:${supportEmail}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-slate-500 hover:text-[#ffd427] text-sm mt-6 transition-colors cursor-pointer"
                    >
                        <CheckCircle size={18} className="text-green-500 flex-shrink-0" />
                        <span>Soporte por correo y WhatsApp (829 599 2941)</span>
                    </a>
                </div>

                {/* Panel derecho claro — formulario */}
                <div className="flex-1 bg-slate-50 lg:bg-white p-6 lg:p-10 flex flex-col justify-center">
                    <div className="max-w-lg mx-auto w-full">
                        <h2 className="text-2xl font-bold text-slate-800 mb-1">Solicitud de acceso empresarial</h2>
                        <p className="text-slate-500 text-sm mb-6">Complete el formulario para registrar su negocio. Nos pondremos en contacto a la brevedad.</p>

                        {selectedPlan && plan && plan.price > 0 && (
                        <div className="mb-4 p-3 bg-slate-100 rounded-lg border border-slate-200">
                            <label className="block text-sm font-medium text-slate-700 mb-2">Facturación</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="ciclo" checked={cicloPago === 'mensual'} onChange={() => setCicloPago('mensual')} className="text-[#ffd427] focus:ring-[#ffd427]" />
                                    <span className="text-sm text-slate-700">Mensual (${plan.price.toFixed(2)}/mes)</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="ciclo" checked={cicloPago === 'anual'} onChange={() => setCicloPago('anual')} className="text-[#ffd427] focus:ring-[#ffd427]" />
                                    <span className="text-sm text-slate-700">Anual <span className="text-green-600 font-medium">-40%</span> (${(plan.price * 0.6).toFixed(2)}/mes · ${(plan.price * 0.6 * 12).toFixed(2)}/año)</span>
                                </label>
                            </div>
                        </div>
                        )}
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
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-1">País</label>
                            <select
                                value={formPais}
                                onChange={(e) => { setFormPais(e.target.value); setFormCiudad(''); setFormBarrio(''); }}
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ffd427] focus:border-[#ffd427] text-slate-800 bg-white"
                            >
                                <option value="">Selecciona país</option>
                                {SUPPORTED_COUNTRIES.map((c) => (
                                    <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Ciudad</label>
                                <select
                                    value={formCiudad}
                                    onChange={(e) => { setFormCiudad(e.target.value); setFormBarrio(''); }}
                                    disabled={!formPais}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ffd427] focus:border-[#ffd427] text-slate-800 bg-white disabled:bg-slate-100"
                                >
                                    <option value="">{formPais ? 'Selecciona ciudad' : 'Elige país primero'}</option>
                                    {(formPais ? getCitiesForCountry(formPais) : []).map((c) => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Barrio / Zona</label>
                                <select
                                    value={formBarrio}
                                    onChange={(e) => setFormBarrio(e.target.value)}
                                    disabled={!formCiudad}
                                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ffd427] focus:border-[#ffd427] text-slate-800 bg-white disabled:bg-slate-100"
                                >
                                    <option value="">{formCiudad ? 'Selecciona barrio' : 'Elige ciudad primero'}</option>
                                    {(formPais && formCiudad ? getBarriosForCity(formPais, formCiudad) : []).map((b) => (
                                        <option key={b} value={b}>{b}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Calle o referencia (opcional)</label>
                            <input
                                type="text"
                                value={formCalle}
                                onChange={(e) => setFormCalle(e.target.value)}
                                placeholder="Ej: Calle Principal 123"
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ffd427] focus:border-[#ffd427] text-slate-800"
                            />
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
                                    Acepto los <button type="button" onClick={(e) => { e.preventDefault(); navigateToLegal('terminos'); }} className="text-[#ffd427] hover:underline font-medium">Términos de Servicio</button> y la <button type="button" onClick={(e) => { e.preventDefault(); navigateToLegal('privacidad'); }} className="text-[#ffd427] hover:underline font-medium">Política de Privacidad</button>. Entiendo que mi solicitud será revisada.
                                </span>
                            </label>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            <button type="button" onClick={goBack} className="min-h-[44px] px-4 py-2.5 rounded-lg text-slate-600 hover:text-slate-800 font-medium text-sm active:bg-slate-200/50">
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleEnviarSolicitudCorreo}
                                title={`Enviar a ${CONTACT.solicitudEmail}`}
                                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors text-sm"
                            >
                                Enviar por correo <Send size={18} />
                            </button>
                            <button
                                type="button"
                                onClick={handleEnviarSolicitudWhatsApp}
                                title="Enviar por WhatsApp al 829 599 2941"
                                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors text-sm"
                            >
                                Enviar por WhatsApp <MessageCircle size={18} />
                            </button>
                        </div>
                        <p className="mt-3 text-center text-xs text-slate-500">
                            Enviar solicitud a {CONTACT.solicitudEmail} o WhatsApp 829 599 2941
                        </p>
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

    /* Cuando se muestra el signup, ocupar toda la ventana y evitar doble scroll */
    if (showSelfSignup && (!isNativeMobile || ALLOW_NATIVE_BARBER_SIGNUP)) {
        return (
            <div className="h-[100dvh] max-h-[100dvh] overflow-hidden flex flex-col">
                <SelfServiceBarberSignup
                    onSuccess={(u, p) => { onBarberSignupSuccess?.(u, p); setShowSelfSignup(false); }}
                    onGoToLogin={() => { setShowSelfSignup(false); onGoToLogin(); }}
                    onGoBack={() => setShowSelfSignup(false)}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen min-h-[100dvh] relative flex flex-col items-center justify-center p-3 sm:p-4 overflow-y-auto overflow-x-hidden">
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
            {onBackToLanding && !isNativeMobile && !showSelfSignup && step === 'who' && (
                <button
                    type="button"
                    onClick={onBackToLanding}
                    className="fixed top-0 left-0 z-20 flex items-center gap-1.5 min-h-[44px] m-3 sm:m-4 px-3 py-2 rounded-xl text-slate-300 hover:text-white bg-black/30 hover:bg-black/50 border border-white/10 backdrop-blur-sm text-sm font-medium transition-colors safe-area-top"
                >
                    <ArrowLeft size={18} /> Volver al inicio
                </button>
            )}
            {/* Contenido */}
            <div className="relative z-10 w-full max-w-2xl lg:max-w-6xl min-w-0">
                {/* Logo — tamaño medio, equilibrado */}
                <div className="text-center mb-8">
                    <div className="w-14 h-14 bg-[#ffd427] rounded-xl flex items-center justify-center mx-auto mb-3">
                        <Scissors size={28} className="text-slate-900" />
                    </div>
                    <h1 className="text-2xl font-semibold text-white">BarberShow</h1>
                    <p className="text-slate-400 mt-1 text-sm">Sistema para barberías</p>
                    <p className="text-slate-500 text-xs mt-0.5">v1.0.10</p>
                </div>


                {/* Paso 1: ¿Barbero o Cliente? — en nativo sin autoregistro solo login + cliente (Guideline 3.1.1) */}
                {!showSelfSignup && step === 'who' && isNativeMobile && !ALLOW_NATIVE_BARBER_SIGNUP && (
                    <div className="max-w-lg mx-auto space-y-4">
                        <p className="text-white text-center text-lg font-semibold mb-2">Bienvenido a BarberShow</p>
                        <p className="text-slate-400 text-center text-sm mb-6">Inicia sesión o regístrate como cliente para reservar citas.</p>
                        <button
                            type="button"
                            onClick={onGoToLogin}
                            className="w-full min-h-[52px] flex items-center justify-center gap-2 py-4 rounded-xl bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-semibold text-base transition-colors active:scale-[0.98]"
                        >
                            <LogIn size={20} />
                            Iniciar sesión
                        </button>
                        <button
                            type="button"
                            onClick={() => { setUserType('cliente'); setStep('client_registered'); }}
                            className="w-full min-h-[52px] flex items-center justify-center gap-2 py-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium text-base transition-colors active:bg-white/20"
                        >
                            <UserCircle size={20} />
                            Registrarme como cliente
                        </button>
                        <p className="text-xs text-slate-500 text-center mt-4 px-2 leading-relaxed">
                            ¿Eres dueño de una barbería y quieres unirte? Visita nuestra plataforma web.
                        </p>
                    </div>
                )}

                {!showSelfSignup && step === 'who' && (!isNativeMobile || ALLOW_NATIVE_BARBER_SIGNUP) && (
                    <>
                        <p className="text-white text-center text-lg font-semibold mb-5">¿Eres Barbero o Cliente?</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 max-w-lg mx-auto">
                            <button
                                type="button"
                                onClick={() => { setUserType('barbero'); setShowSelfSignup(true); }}
                                className="flex flex-col items-center gap-3 min-h-[120px] py-5 px-5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 transition-colors group active:bg-white/20"
                            >
                                <div className="w-11 h-11 rounded-lg bg-[#ffd427]/20 flex items-center justify-center group-hover:bg-[#ffd427]/30">
                                    <Scissors size={22} className="text-[#ffd427]" strokeWidth={2} />
                                </div>
                                <span className="font-semibold text-white text-base">Barbero</span>
                                <span className="text-slate-400 text-sm text-center leading-snug">Crear mi barbería o acceder</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => { setUserType('cliente'); setStep('client_registered'); }}
                                className="flex flex-col items-center gap-3 min-h-[120px] py-5 px-5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 transition-colors group active:bg-white/20"
                            >
                                <div className="w-11 h-11 rounded-lg bg-[#ffd427]/20 flex items-center justify-center group-hover:bg-[#ffd427]/30">
                                    <UserCircle size={22} className="text-[#ffd427]" strokeWidth={2} />
                                </div>
                                <span className="font-semibold text-white text-base">Cliente</span>
                                <span className="text-slate-400 text-sm text-center leading-snug">Quiero reservar o comprar</span>
                            </button>
                        </div>
                        <p className="text-center">
                            <button
                                type="button"
                                onClick={() => setShowPlansModal(true)}
                                className="text-slate-400 hover:text-[#ffd427] text-sm font-medium inline-flex items-center gap-1.5 transition-colors"
                            >
                                <CreditCard size={16} /> Ver planes y precios
                            </button>
                        </p>
                        <div className="mt-6 max-w-lg mx-auto rounded-xl border border-white/15 bg-white/5 p-4 sm:p-5">
                            <p className="text-center text-white text-sm font-medium mb-1">¿Dudas o soporte?</p>
                            <p className="text-center text-slate-400 text-xs mb-4">Escríbenos y te respondemos pronto.</p>
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 justify-center">
                                <a
                                    href={homeContactWhatsAppHref}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-semibold text-sm transition-colors active:scale-[0.98]"
                                >
                                    <MessageCircle size={18} />
                                    WhatsApp
                                </a>
                                <a
                                    href={homeContactEmailHref}
                                    className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium text-sm transition-colors active:scale-[0.98]"
                                >
                                    <Mail size={18} />
                                    Correo
                                </a>
                            </div>
                        </div>
                    </>
                )}

                {/* Barbero: ¿Qué tipo de barbería? — solo web */}
                {step === 'barber_plan' && !isNativeMobile && (
                    <>
                        <button type="button" onClick={goBack} className="flex items-center gap-1.5 min-h-[44px] text-slate-400 hover:text-white text-sm mb-3 rounded-lg w-fit px-2 -ml-2 active:bg-white/10">
                            <ArrowLeft size={16} /> Volver
                        </button>
                        <p className="text-white text-center text-base font-semibold mb-1">¿Qué tipo de barbería tienes?</p>
                        <p className="text-slate-400 text-center text-sm mb-1">Elige el plan que mejor describe tu negocio.</p>
                        <p className="text-slate-500 text-center text-xs mb-4">Haz clic sobre un plan para elegirlo.</p>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-6">
                            {TIER_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => { setSelectedPlan(opt.value); setStep('barber_contact'); }}
                                    className="w-full flex flex-col sm:flex-row lg:flex-col items-start gap-3 p-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-left transition-colors group h-full min-h-[100px] active:bg-white/20"
                                >
                                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[#ffd427]/20 flex items-center justify-center group-hover:bg-[#ffd427]/30 [&>svg]:w-5 [&>svg]:h-5">
                                        {opt.icon}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <span className="font-semibold text-white block text-sm">{opt.label}</span>
                                            <span className="text-[#ffd427] font-bold text-sm whitespace-nowrap">${opt.price.toFixed(2)}/mes</span>
                                        </div>
                                        {opt.value !== 'gratuito' && (
                                            <p className="text-xs text-emerald-400 mt-0.5 font-medium">Sin Anuncios</p>
                                        )}
                                        <p className="text-xs text-slate-400 mt-0.5">Paga 1 año: <span className="text-green-400 font-semibold">-40%</span> → ${(opt.price * 0.6).toFixed(2)}/mes</p>
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
                        <button type="button" onClick={goBack} className="flex items-center gap-1.5 min-h-[44px] text-slate-400 hover:text-white text-sm mb-4 rounded-lg w-fit px-2 -ml-2 active:bg-white/10">
                            <ArrowLeft size={16} /> Volver
                        </button>
                        <p className="text-white text-center text-lg font-semibold mb-5">¿Ya estás registrado o eres nuevo?</p>
                        <div className="space-y-4 mb-6">
                            <button
                                type="button"
                                onClick={onGoToLogin}
                                className="w-full min-h-[52px] flex items-center justify-center gap-2 py-4 rounded-xl bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-semibold text-base transition-colors active:scale-[0.98]"
                            >
                                <LogIn size={20} />
                                Ya estoy registrado
                            </button>
                            <button
                                type="button"
                                onClick={() => setStep('barber_contact')}
                                className="w-full min-h-[52px] flex items-center justify-center gap-2 py-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium text-base transition-colors active:bg-white/20"
                            >
                                Soy nuevo – quiero que me den de alta
                            </button>
                        </div>
                    </div>
                )}

                {/* Cliente: ¿Ya registrado o nuevo? — mismo equilibrio */}
                {step === 'client_registered' && (
                    <div className="max-w-lg mx-auto">
                        <button type="button" onClick={goBack} className="flex items-center gap-1.5 min-h-[44px] text-slate-400 hover:text-white text-sm mb-4 rounded-lg w-fit px-2 -ml-2 active:bg-white/10">
                            <ArrowLeft size={16} /> Volver
                        </button>
                        <p className="text-white text-center text-lg font-semibold mb-5">¿Ya estás registrado o eres nuevo?</p>
                        <div className="space-y-4 mb-6">
                            <button
                                type="button"
                                onClick={onGoToLogin}
                                className="w-full min-h-[52px] flex items-center justify-center gap-2 py-4 rounded-xl bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-semibold text-base transition-colors active:scale-[0.98]"
                            >
                                <LogIn size={20} />
                                Ya estoy registrado
                            </button>
                            <button
                                type="button"
                                onClick={() => setStep('client_new')}
                                className="w-full min-h-[52px] flex items-center justify-center gap-2 py-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium text-base transition-colors active:bg-white/20"
                            >
                                Soy nuevo
                            </button>
                        </div>
                    </div>
                )}

                {/* Cliente nuevo: ver barberías — mismo equilibrio */}
                {step === 'client_new' && (
                    <div className="max-w-lg mx-auto">
                        <button type="button" onClick={goBack} className="flex items-center gap-1.5 min-h-[44px] text-slate-400 hover:text-white text-sm mb-4 rounded-lg w-fit px-2 -ml-2 active:bg-white/10">
                            <ArrowLeft size={16} /> Volver
                        </button>
                        <p className="text-white text-center text-lg font-semibold mb-5">¿No tienes barbería aún?</p>
                        {onGoToClientRegister && (
                            <button
                                type="button"
                                onClick={onGoToClientRegister}
                                className="w-full min-h-[52px] flex items-center justify-center gap-2 py-4 rounded-xl bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-semibold text-base transition-colors mb-4 active:scale-[0.98]"
                            >
                                <UserPlus size={20} /> Crear cuenta de cliente gratis
                            </button>
                        )}
                        {onGoToBarberias && (
                            <button
                                type="button"
                                onClick={onGoToBarberias}
                                className="w-full min-h-[52px] flex items-center justify-center gap-2 py-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium text-base transition-colors mb-4 active:bg-white/20"
                            >
                                <Store size={20} /> Ver barberías – elegir una y agendar cita
                            </button>
                        )}
                        <div className="bg-white/10 rounded-lg border border-white/20 p-5 mb-5">
                            <p className="text-white font-medium text-sm mb-2">O regístrate en una barbería específica:</p>
                            <p className="text-slate-400 text-sm">
                                Visita la barbería donde quieres reservar y escanea el código QR o pide el enlace.
                            </p>
                            <p className="text-slate-500 text-sm mt-2">Si ya te registraste, inicia sesión abajo.</p>
                        </div>
                        <button
                            type="button"
                            onClick={onGoToLogin}
                            className="w-full min-h-[52px] flex items-center justify-center gap-2 py-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/20 text-white font-medium text-base transition-colors active:bg-white/20"
                        >
                            <LogIn size={18} /> Iniciar sesión
                        </button>
                    </div>
                )}

                {/* Enlace a login en paso "who" */}
                {!showSelfSignup && step === 'who' && (!isNativeMobile || ALLOW_NATIVE_BARBER_SIGNUP) && (
                    <div className="max-w-lg mx-auto pt-6 border-t border-white/10">
                        <button type="button" onClick={onGoToLogin} className="w-full flex items-center justify-center gap-2 py-3 text-slate-400 hover:text-[#ffd427] text-sm font-medium transition-colors">
                            <LogIn size={18} /> Ya tengo cuenta – Iniciar sesión
                        </button>
                    </div>
                )}

                {/* Modal: planes y precios — solo web */}
                {!isNativeMobile && showPlansModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setShowPlansModal(false)}>
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between p-4 border-b border-slate-200">
                                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <CreditCard size={22} className="text-[#ffd427]" /> Planes y precios
                                </h2>
                                <button type="button" onClick={() => setShowPlansModal(false)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100">
                                    <X size={20} />
                                </button>
                            </div>
                            <div className="overflow-y-auto p-4 space-y-4">
                                {TIER_OPTIONS.map((opt) => (
                                    <div key={opt.value} className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-[#ffd427]/20 flex items-center justify-center flex-shrink-0">
                                                    {opt.icon}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-slate-900">{opt.label}</div>
                                                    <div className="text-sm text-slate-600 mt-0.5">{opt.description}</div>
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                <div className="font-bold text-[#ffd427]">
                                                    {opt.price === 0 ? 'Gratis' : `$${opt.price.toFixed(2)}/mes`}
                                                </div>
                                                {opt.price > 0 && (
                                                    <div className="text-xs text-slate-500">Anual −40%: ${(opt.price * 0.6 * 12).toFixed(2)}/año</div>
                                                )}
                                            </div>
                                        </div>
                                        {opt.benefits && opt.benefits.length > 0 && (
                                            <ul className="mt-3 space-y-1 text-xs text-slate-600 pl-1 border-t border-slate-100 pt-3">
                                                {opt.benefits.map((b, i) => (
                                                    <li key={i} className="flex gap-2">
                                                        <span className="text-[#ffd427] flex-shrink-0">✓</span>
                                                        <span>{b}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className="p-4 border-t border-slate-200 bg-slate-50">
                                <p className="text-sm text-slate-600 text-center mb-2">Elige <strong>Barbero</strong> para crear tu barbería con el plan que prefieras.</p>
                                <button type="button" onClick={() => { setShowPlansModal(false); }} className="w-full py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium text-sm">
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WelcomePlanSelector;
