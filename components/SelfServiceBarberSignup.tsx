import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { AccountTier } from '../types';
import { Scissors, ArrowLeft, ArrowRight, LogIn, CheckCircle, Loader2, Smartphone, User, Lock, Mail, Phone, MapPin, Building2, ChevronLeft } from 'lucide-react';
import { DataService } from '../services/data';
import { completeSelfSignupFree, createPendingBarberSignupMobile, activatePlanFromPlay } from '../services/firebase';
import { isPlayBillingAvailable, initPlayBilling, purchasePlan, addPlayPurchaseListener, getPlayProductId, getActivePlayTransactions } from '../services/playBilling';

const TIER_OPTIONS: { value: AccountTier; label: string; description: string; price: number }[] = [
  { value: 'gratuito', label: 'Plan Gratuito', description: 'Solo ver y gestionar citas. Hasta 100 citas al mes.', price: 0 },
  { value: 'solo', label: 'Plan Solo', description: 'Una persona, un local.', price: 14.95 },
  { value: 'barberia', label: 'Plan Barbería', description: 'Varios barberos, una sede.', price: 19.95 },
  { value: 'multisede', label: 'Plan Multi-Sede', description: 'Varias ubicaciones o cadena.', price: 29.95 },
];

type WizardStep = 1 | 2 | 3;

export interface SelfServiceBarberSignupProps {
  onSuccess: (username: string, password: string) => void;
  onGoToLogin: () => void;
  /** Volver a la pantalla anterior (ej. bienvenida). Se muestra en paso 1. */
  onGoBack?: () => void;
}

const MIN_PHONE_DIGITS = 8;

const APP_STORE_URL = 'https://apps.apple.com/app/barbershow/id123456789';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.barbershow.app';

const SelfServiceBarberSignup: React.FC<SelfServiceBarberSignupProps> = ({ onSuccess, onGoToLogin, onGoBack }) => {
  const [step, setStep] = useState<WizardStep>(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingUser, setCheckingUser] = useState(false);

  // Step 1
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [usernameExists, setUsernameExists] = useState<boolean | null>(null);

  // Step 2
  const [barbershopName, setBarbershopName] = useState('');
  const [address, setAddress] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<AccountTier>('gratuito');

  // Step 3
  const [cicloPago, setCicloPago] = useState<'mensual' | 'anual'>('mensual');
  const [acceptTerms, setAcceptTerms] = useState(false);

  const planOption = TIER_OPTIONS.find((o) => o.value === selectedPlan);
  const isFree = selectedPlan === 'gratuito';

  const checkUsername = async () => {
    const u = (username || '').trim().toLowerCase();
    if (!u) return;
    setCheckingUser(true);
    setUsernameExists(null);
    try {
      const existing = await DataService.findUserByUsername(u);
      setUsernameExists(!!existing);
    } catch {
      setUsernameExists(null);
    } finally {
      setCheckingUser(false);
    }
  };

  const phoneDigits = (phone || '').replace(/\D/g, '');
  const phoneValid = phoneDigits.length >= MIN_PHONE_DIGITS;

  const MIN_PASSWORD_LENGTH = 6;
  const step1Valid =
    (username || '').trim().length > 0 &&
    usernameExists === false &&
    (password || '').length >= MIN_PASSWORD_LENGTH &&
    password === confirmPassword &&
    (name || '').trim().length > 0 &&
    phoneValid;

  const step2Valid =
    (barbershopName || '').trim().length > 0 &&
    (address || '').trim().length > 0 &&
    selectedPlan != null;

  const step3Valid = isFree || acceptTerms;

  const handleNextFrom1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!step1Valid) return;
    setStep(2);
  };

  const handleNextFrom2 = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!step2Valid) return;
    setStep(3);
  };

  const handleSubmitFree = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!step1Valid || !step2Valid || !isFree) return;
    setLoading(true);
    try {
      await completeSelfSignupFree({
        username: username.trim().toLowerCase(),
        password,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        barbershopName: barbershopName.trim(),
        address: address.trim(),
      });
      onSuccess(username.trim().toLowerCase(), password);
    } catch (err: unknown) {
      const msg = err && typeof (err as { message?: string }).message === 'string' ? (err as { message: string }).message : 'No se pudo crear la cuenta. Intenta de nuevo.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const isWeb = typeof Capacitor !== 'undefined' && Capacitor.getPlatform() === 'web';
  const isNativeMobile = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
  const isAndroid = typeof Capacitor !== 'undefined' && Capacitor.getPlatform() === 'android';
  const isIOS = typeof Capacitor !== 'undefined' && Capacitor.getPlatform() === 'ios';

  const pendingMobileRef = useRef<{ username: string; password: string; plan: AccountTier; cycle: 'mensual' | 'anual' } | null>(null);

  useEffect(() => {
    if (isPlayBillingAvailable()) initPlayBilling();
  }, []);

  useEffect(() => {
    if (!isNativeMobile) return;
    const remove = addPlayPurchaseListener(async () => {
      const pending = pendingMobileRef.current;
      if (!pending) return;
      try {
        const transactions = await getActivePlayTransactions();
        const productId = getPlayProductId(pending.plan, pending.cycle);
        const tx = transactions.find((t) => t.productIdentifier === productId) ?? transactions[0];
        if (!tx?.purchaseToken) {
          setError('Compra recibida. Si no se activa, contacta a soporte.');
          pendingMobileRef.current = null;
          return;
        }
        const result = await activatePlanFromPlay({
          purchaseToken: tx.purchaseToken,
          productId: tx.productIdentifier,
          email: email.trim() || username.trim() + '@barbershow.app',
          nombreNegocio: barbershopName.trim(),
          nombreRepresentante: name.trim(),
          username: pending.username,
        });
        pendingMobileRef.current = null;
        if (result.success) onSuccess(pending.username, pending.password);
        else setError(result.message || 'No se pudo activar el plan.');
      } catch (e) {
        console.error(e);
        setError('Error al activar el plan. Contacta a soporte.');
        pendingMobileRef.current = null;
      }
    });
    return remove;
  }, [isNativeMobile, barbershopName, name, email, username]);

  const handlePayWithMobile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!step1Valid || !step2Valid || isFree || !acceptTerms || !isNativeMobile) return;
    setLoading(true);
    try {
      await createPendingBarberSignupMobile({
        username: username.trim().toLowerCase(),
        password,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        barbershopName: barbershopName.trim(),
        address: address.trim(),
        plan: selectedPlan,
        ciclo: cicloPago,
      });
      pendingMobileRef.current = {
        username: username.trim().toLowerCase(),
        password,
        plan: selectedPlan,
        cycle: cicloPago,
      };
      const result = await purchasePlan(selectedPlan, cicloPago);
      if (result.success) {
        setError('');
      } else {
        pendingMobileRef.current = null;
        setError(result.message || 'No se pudo abrir la tienda.');
      }
    } catch (err: unknown) {
      pendingMobileRef.current = null;
      const raw = err && typeof (err as { message?: string }).message === 'string' ? (err as { message: string }).message : '';
      const code = err && typeof (err as { code?: string }).code === 'string' ? (err as { code: string }).code : '';
      const msg = raw && raw !== code && !/^internal$|^functions\/internal$/i.test(raw)
        ? raw
        : 'No se pudo procesar el pago. Comprueba tu conexión e intenta de nuevo, o contacta a soporte si el problema continúa.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const primary = '#F5B301';

  return (
    <div className="h-[100dvh] min-h-0 max-h-[100dvh] relative flex flex-col font-sans">
      {/* Fondo: gradiente oscuro + blur sutil */}
      <div
        className="absolute inset-0 bg-cover bg-center scale-105"
        style={{ backgroundImage: "url('/barbershop-bg.png')", filter: 'blur(12px)' }}
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-b from-slate-900/90 via-slate-900/85 to-slate-950/95"
        aria-hidden
      />

      <div
        className="relative z-10 flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col items-center px-4 pt-6 pb-2 sm:px-6 md:px-8 sm:pt-8 sm:pb-4 signup-scroll"
        style={{ overscrollBehavior: 'none' }}
      >
        <div className="w-full max-w-lg md:max-w-2xl mx-auto min-w-0 pb-8">
          {/* Card moderna: más ancha en desktop para aprovechar espacio */}
          <div
            className="bg-white rounded-[14px] overflow-hidden border border-slate-200/50"
            style={{
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07), 0 10px 24px -4px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.02)',
            }}
          >
            <div className="border-t-4 border-[#F5B301]" style={{ borderTopColor: primary }} />
            <div className="p-5 sm:p-6 md:p-8">
              {/* Header: volver (paso 1) + icono + título */}
              <div className="flex items-start gap-4 mb-6">
                {step === 1 && onGoBack && (
                  <button
                    type="button"
                    onClick={onGoBack}
                    className="flex items-center justify-center min-h-[44px] min-w-[44px] -ml-1 rounded-xl text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors flex-shrink-0"
                    aria-label="Volver atrás"
                  >
                    <ChevronLeft size={24} strokeWidth={2.2} />
                  </button>
                )}
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div
                    className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 hover:scale-[1.02]"
                    style={{ backgroundColor: primary }}
                  >
                    <Scissors size={24} className="text-slate-900 sm:w-7 sm:h-7" strokeWidth={2.2} />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Crear mi barbería</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Cuenta → Barbería → Pago</p>
                  </div>
                </div>
              </div>

              {/* Stepper horizontal minimalista con transición */}
              <nav className="flex items-center justify-between mb-6" aria-label="Pasos">
                {([1, 2, 3] as const).map((s) => (
                  <React.Fragment key={s}>
                    <div
                      className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full font-semibold text-sm border-2 flex-shrink-0 transition-all duration-300 ease-out ${
                        step === s
                          ? 'bg-[#F5B301] border-[#F5B301] text-slate-900 shadow-[0_0_0_3px_rgba(245,179,1,0.25)]'
                          : step > s
                            ? 'bg-emerald-500 border-emerald-500 text-white'
                            : 'bg-slate-100 border-slate-200 text-slate-400'
                      }`}
                      aria-current={step === s ? 'step' : undefined}
                    >
                      {step > s ? <CheckCircle size={18} className="sm:w-5 sm:h-5" /> : s}
                    </div>
                    {s < 3 && (
                      <div
                        className={`flex-1 h-0.5 mx-1 sm:mx-2 rounded-full transition-colors duration-300 ${
                          step > s ? 'bg-emerald-500' : 'bg-slate-200'
                        }`}
                      />
                    )}
                  </React.Fragment>
                ))}
              </nav>

            {error && (
              <div className="mb-4 p-3 bg-red-50/90 border border-red-200 rounded-xl text-red-700 text-sm transition-opacity" role="alert">
                {error}
              </div>
            )}

            {/* Step 1: Cuenta - 2 columnas en desktop para aprovechar espacio */}
            {step === 1 && (
              <form id="wizard-step1" onSubmit={handleNextFrom1} className="space-y-4 transition-opacity duration-300 ease-out">
                <h2 className="text-base sm:text-lg font-semibold text-slate-800">Paso 1 – Tu cuenta</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Nombre de usuario (único)</label>
                      <div className="relative">
                        <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          required
                          autoComplete="username"
                          value={username}
                          onChange={(e) => {
                            setUsername(e.target.value);
                            setUsernameTouched(true);
                            setUsernameExists(null);
                          }}
                          onBlur={() => {
                            setUsernameTouched(true);
                            if ((username || '').trim()) checkUsername();
                          }}
                          placeholder="Ej: mibarberia"
                          className="input-modern w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F5B301]/35 focus:border-[#F5B301] transition-all duration-200"
                        />
                      </div>
                      {usernameTouched && username.trim() && (
                        <p className="mt-2 text-xs">
                          {checkingUser ? (
                            <span className="text-slate-500">Comprobando...</span>
                          ) : usernameExists === true ? (
                            <span className="text-red-600 font-medium">Ese usuario ya existe. Elige otro.</span>
                          ) : usernameExists === false ? (
                            <span className="text-emerald-600 font-medium flex items-center gap-1">Disponible</span>
                          ) : null}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Nombre completo</label>
                      <div className="relative">
                        <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          required
                          autoComplete="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Tu nombre"
                          className="input-modern w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F5B301]/35 focus:border-[#F5B301] transition-all duration-200"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Contraseña</label>
                      <div className="relative">
                        <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="password"
                          required
                          autoComplete="new-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={`Mín. ${MIN_PASSWORD_LENGTH} caracteres`}
                          className="input-modern w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F5B301]/35 focus:border-[#F5B301] transition-all duration-200"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Confirmar contraseña</label>
                      <div className="relative">
                        <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="password"
                          required
                          autoComplete="new-password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Repite la contraseña"
                          className="input-modern w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F5B301]/35 focus:border-[#F5B301] transition-all duration-200"
                        />
                      </div>
                      {confirmPassword && password !== confirmPassword && (
                        <p className="mt-2 text-xs text-red-600 font-medium">No coinciden</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Teléfono <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="tel"
                          required
                          autoComplete="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="Ej: 809 555 1234"
                          className="input-modern w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F5B301]/35 focus:border-[#F5B301] transition-all duration-200"
                        />
                      </div>
                      {phone && !phoneValid && (
                        <p className="mt-2 text-xs text-amber-600 font-medium">Mínimo {MIN_PHONE_DIGITS} dígitos</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Correo (opcional)</label>
                      <div className="relative">
                        <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="email"
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="correo@ejemplo.com"
                          className="input-modern w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F5B301]/35 focus:border-[#F5B301] transition-all duration-200"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            )}

            {/* Step 2: Barbería - 2 columnas en desktop */}
            {step === 2 && (
              <form id="wizard-step2" onSubmit={handleNextFrom2} className="space-y-4 transition-opacity duration-300 ease-out">
                <h2 className="text-base sm:text-lg font-semibold text-slate-800">Paso 2 – Tu barbería</h2>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Nombre de la barbería</label>
                      <div className="relative">
                        <Building2 size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          required
                          value={barbershopName}
                          onChange={(e) => setBarbershopName(e.target.value)}
                          placeholder="Ej: Corte & Estilo"
                          className="input-modern w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F5B301]/35 focus:border-[#F5B301] transition-all duration-200"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Dirección</label>
                      <div className="relative">
                        <MapPin size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          required
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Calle, ciudad, país"
                          className="input-modern w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F5B301]/35 focus:border-[#F5B301] transition-all duration-200"
                        />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Plan</label>
                    <div className="space-y-2">
                      {TIER_OPTIONS.map((opt) => (
                        <label
                          key={opt.value}
                          className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                            selectedPlan === opt.value ? 'border-[#F5B301] bg-amber-50/60 shadow-sm' : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <input
                            type="radio"
                            name="plan"
                            value={opt.value}
                            checked={selectedPlan === opt.value}
                            onChange={() => setSelectedPlan(opt.value)}
                            className="mt-1 text-[#F5B301] focus:ring-[#F5B301]"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-slate-800">{opt.label}</span>
                            <span className="ml-2 font-bold" style={{ color: primary }}>
                              {opt.price === 0 ? 'Gratis' : `$${opt.price}/mes`}
                            </span>
                            <p className="text-xs text-slate-500 mt-0.5">{opt.description}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </form>
            )}

            {/* Step 3: Pago / Confirmación */}
            {step === 3 && (
              <div className="space-y-4 transition-opacity duration-300 ease-out">
                <h2 className="text-base sm:text-lg font-semibold text-slate-800">Paso 3 – Confirmación</h2>
                <div className="bg-slate-50/80 rounded-xl p-4 space-y-2 text-sm border border-slate-100">
                  <p><span className="text-slate-500">Usuario:</span> <strong>{username.trim().toLowerCase()}</strong></p>
                  <p><span className="text-slate-500">Barbería:</span> <strong>{barbershopName}</strong></p>
                  <p><span className="text-slate-500">Plan:</span> <strong>{planOption?.label ?? selectedPlan}</strong></p>
                  {!isFree && (
                    <p className="pt-2">
                      <span className="text-slate-500">Ciclo:</span>{' '}
                      <strong>{cicloPago === 'anual' ? 'Anual (-40%)' : 'Mensual'}</strong>{' '}
                      {planOption && planOption.price > 0 && (
                        <span className="font-bold" style={{ color: primary }}>
                          {cicloPago === 'anual'
                            ? `$${(planOption.price * 0.6 * 12).toFixed(2)}/año`
                            : `$${planOption.price.toFixed(2)}/mes`}
                        </span>
                      )}
                    </p>
                  )}
                </div>

                {!isFree && (
                  <>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="ciclo"
                          checked={cicloPago === 'mensual'}
                          onChange={() => setCicloPago('mensual')}
                          className="text-[#F5B301] focus:ring-[#F5B301]"
                        />
                        <span className="text-sm text-slate-700">Mensual</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="ciclo"
                          checked={cicloPago === 'anual'}
                          onChange={() => setCicloPago('anual')}
                          className="text-[#F5B301] focus:ring-[#F5B301]"
                        />
                        <span className="text-sm text-slate-700">Anual <span className="text-emerald-600 font-medium">-40%</span></span>
                      </label>
                    </div>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acceptTerms}
                        onChange={(e) => setAcceptTerms(e.target.checked)}
                        className="mt-1 rounded border-slate-300 text-[#F5B301] focus:ring-[#F5B301]"
                      />
                      <span className="text-sm text-slate-600">
                        Acepto los Términos de Servicio y la Política de Privacidad. Sin pago no se activará la cuenta.
                      </span>
                    </label>
                  </>
                )}

                {!isFree && isWeb && (
                  <div className="rounded-xl bg-slate-100 border border-slate-200 p-4 flex flex-col gap-3">
                    <p className="text-slate-700 font-medium flex items-center gap-2">
                      <Smartphone size={20} style={{ color: primary }} />
                      Pago solo en la app móvil
                    </p>
                    <p className="text-sm text-slate-600">
                      Para contratar un plan de pago usa la app en tu móvil: <strong>Apple Pay</strong> en iPhone o <strong>Google Wallet</strong> en Android.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <a
                        href={APP_STORE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-black text-white rounded-lg font-medium text-sm hover:bg-slate-800 transition-colors"
                      >
                        App Store (iPhone)
                      </a>
                      <a
                        href={PLAY_STORE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-medium text-sm hover:bg-emerald-700 transition-colors"
                      >
                        Google Play (Android)
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Botones de acción: dentro de la card, justo debajo del contenido */}
            <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col-reverse sm:flex-row gap-3">
              {step === 1 && (
                <>
                  <button
                    type="submit"
                    form="wizard-step1"
                    disabled={!step1Valid || checkingUser}
                    className="btn-primary min-h-[48px] flex-1 sm:order-2 py-3 text-slate-900 font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ backgroundColor: primary }}
                  >
                    Continuar <ArrowRight size={20} strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    onClick={onGoToLogin}
                    className="min-h-[48px] px-4 py-3 rounded-xl text-slate-600 hover:text-slate-800 hover:bg-slate-50 text-sm font-medium transition-colors duration-200 sm:order-1"
                  >
                    <LogIn size={18} className="inline mr-1.5" /> Ya tengo cuenta
                  </button>
                </>
              )}
              {step === 2 && (
                <>
                  <button
                    type="submit"
                    form="wizard-step2"
                    disabled={!step2Valid}
                    className="btn-primary min-h-[48px] flex-1 py-3 text-slate-900 font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ backgroundColor: primary }}
                  >
                    Continuar <ArrowRight size={20} strokeWidth={2.2} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="min-h-[48px] px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-100 font-medium flex items-center gap-1.5 transition-colors duration-200"
                  >
                    <ArrowLeft size={18} /> Atrás
                  </button>
                </>
              )}
              {step === 3 && (
                <>
                  {(isFree || isNativeMobile) && (
                    isFree ? (
                      <button
                        type="button"
                        onClick={handleSubmitFree}
                        disabled={loading}
                        className="btn-primary min-h-[48px] flex-1 py-3 text-slate-900 font-semibold rounded-xl transition-all duration-200 disabled:opacity-70 flex items-center justify-center gap-2"
                        style={{ backgroundColor: primary }}
                      >
                        {loading ? <><Loader2 size={20} className="animate-spin" /> Creando...</> : <>Crear mi cuenta y barbería</>}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handlePayWithMobile}
                        disabled={loading || !step3Valid}
                        className="btn-primary min-h-[48px] flex-1 py-3 text-slate-900 font-semibold rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        style={{ backgroundColor: primary }}
                      >
                        {loading ? <><Loader2 size={20} className="animate-spin" /> Abriendo...</> : isAndroid ? <>Pagar con Google Wallet</> : <>Pagar con Apple Pay</>}
                      </button>
                    )
                  )}
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="min-h-[48px] px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-100 font-medium flex items-center gap-1.5 transition-colors duration-200"
                  >
                    <ArrowLeft size={18} /> Atrás
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        </div>

        <p className="mt-5 text-center pb-2 text-sm text-slate-500">
          ¿Ya tienes cuenta?{' '}
          <button type="button" onClick={onGoToLogin} className="font-medium text-[#F5B301] hover:underline focus:outline-none focus:ring-2 focus:ring-[#F5B301]/30 rounded">
            Iniciar sesión
          </button>
        </p>
      </div>
    </div>
  );
};

export default SelfServiceBarberSignup;
