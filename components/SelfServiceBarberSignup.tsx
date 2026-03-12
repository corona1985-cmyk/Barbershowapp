import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { AccountTier } from '../types';
import { Scissors, ArrowLeft, ArrowRight, LogIn, CheckCircle, Loader2, Smartphone } from 'lucide-react';
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
}

const MIN_PHONE_DIGITS = 8;

const APP_STORE_URL = 'https://apps.apple.com/app/barbershow/id123456789';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.barbershow.app';

const SelfServiceBarberSignup: React.FC<SelfServiceBarberSignupProps> = ({ onSuccess, onGoToLogin }) => {
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
      const msg = err && typeof (err as { message?: string }).message === 'string' ? (err as { message: string }).message : 'No se pudo iniciar el pago.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] relative flex flex-col items-center justify-center p-3 sm:p-4 overflow-y-auto overflow-x-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center scale-110"
        style={{ backgroundImage: "url('/barbershop-bg.png')", filter: 'blur(14px)' }}
        aria-hidden
      />
      <div className="absolute inset-0 bg-slate-900/80" aria-hidden />

      <div className="relative z-10 w-full max-w-lg mx-auto min-w-0">
        <div className="bg-white rounded-2xl shadow-2xl border-t-4 border-[#ffd427] overflow-hidden">
          <div className="p-4 sm:p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-[#ffd427] rounded-xl flex items-center justify-center flex-shrink-0">
                <Scissors size={24} className="text-slate-900" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">Crear mi barbería</h1>
                <p className="text-slate-500 text-sm">Cuenta → Barbería → Pago</p>
              </div>
            </div>

            {/* Step indicator */}
            <nav className="flex items-center justify-between mb-6" aria-label="Pasos">
              {([1, 2, 3] as const).map((s) => (
                <React.Fragment key={s}>
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm border-2 transition-colors ${
                      step === s
                        ? 'bg-[#ffd427] border-[#ffd427] text-slate-900'
                        : step > s
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'bg-slate-100 border-slate-200 text-slate-400'
                    }`}
                    aria-current={step === s ? 'step' : undefined}
                  >
                    {step > s ? <CheckCircle size={20} /> : s}
                  </div>
                  {s < 3 && <div className={`flex-1 h-0.5 mx-1 rounded ${step > s ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
                </React.Fragment>
              ))}
            </nav>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm" role="alert">
                {error}
              </div>
            )}

            {/* Step 1: Cuenta */}
            {step === 1 && (
              <form onSubmit={handleNextFrom1} className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-800">Paso 1 – Tu cuenta</h2>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de usuario (único)</label>
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
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ffd427] focus:border-[#ffd427] text-slate-800"
                  />
                  {usernameTouched && username.trim() && (
                    <p className="mt-1 text-xs">
                      {checkingUser ? (
                        <span className="text-slate-500">Comprobando...</span>
                      ) : usernameExists === true ? (
                        <span className="text-red-600">Ese usuario ya existe. Elige otro.</span>
                      ) : usernameExists === false ? (
                        <span className="text-emerald-600">Disponible</span>
                      ) : null}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={`Mín. ${MIN_PASSWORD_LENGTH} caracteres`}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ffd427] focus:border-[#ffd427] text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar contraseña</label>
                    <input
                      type="password"
                      required
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repite la contraseña"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ffd427] focus:border-[#ffd427] text-slate-800"
                    />
                    {confirmPassword && password !== confirmPassword && (
                      <p className="mt-1 text-xs text-red-600">No coinciden</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre completo</label>
                  <input
                    type="text"
                    required
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Tu nombre"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ffd427] focus:border-[#ffd427] text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono <span className="text-red-500">*</span></label>
                  <input
                    type="tel"
                    required
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ej: 809 555 1234"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ffd427] focus:border-[#ffd427] text-slate-800"
                  />
                  {phone && !phoneValid && (
                    <p className="mt-1 text-xs text-amber-600">Mínimo {MIN_PHONE_DIGITS} dígitos</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Correo (opcional)</label>
                  <input
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="correo@ejemplo.com"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ffd427] focus:border-[#ffd427] text-slate-800"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onGoToLogin}
                    className="min-h-[44px] px-4 py-2 rounded-lg text-slate-600 hover:text-slate-800 text-sm font-medium"
                  >
                    <LogIn size={16} className="inline mr-1" /> Ya tengo cuenta
                  </button>
                  <button
                    type="submit"
                    disabled={!step1Valid || checkingUser}
                    className="min-h-[44px] flex-1 bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    Siguiente <ArrowRight size={18} />
                  </button>
                </div>
              </form>
            )}

            {/* Step 2: Barbería */}
            {step === 2 && (
              <form onSubmit={handleNextFrom2} className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-800">Paso 2 – Tu barbería</h2>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nombre de la barbería</label>
                  <input
                    type="text"
                    required
                    value={barbershopName}
                    onChange={(e) => setBarbershopName(e.target.value)}
                    placeholder="Ej: Corte & Estilo"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ffd427] focus:border-[#ffd427] text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Dirección</label>
                  <input
                    type="text"
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Calle, ciudad, país"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#ffd427] focus:border-[#ffd427] text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Plan</label>
                  <div className="space-y-2">
                    {TIER_OPTIONS.map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                          selectedPlan === opt.value ? 'border-[#ffd427] bg-amber-50/50' : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="plan"
                          value={opt.value}
                          checked={selectedPlan === opt.value}
                          onChange={() => setSelectedPlan(opt.value)}
                          className="mt-1 text-[#ffd427] focus:ring-[#ffd427]"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-slate-800">{opt.label}</span>
                          <span className="ml-2 text-[#ffd427] font-bold">
                            {opt.price === 0 ? 'Gratis' : `$${opt.price}/mes`}
                          </span>
                          <p className="text-xs text-slate-500 mt-0.5">{opt.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="min-h-[44px] px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium flex items-center gap-1"
                  >
                    <ArrowLeft size={18} /> Atrás
                  </button>
                  <button
                    type="submit"
                    disabled={!step2Valid}
                    className="min-h-[44px] flex-1 bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    Siguiente <ArrowRight size={18} />
                  </button>
                </div>
              </form>
            )}

            {/* Step 3: Pago / Confirmación */}
            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-slate-800">Paso 3 – Confirmación</h2>
                <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
                  <p><span className="text-slate-500">Usuario:</span> <strong>{username.trim().toLowerCase()}</strong></p>
                  <p><span className="text-slate-500">Barbería:</span> <strong>{barbershopName}</strong></p>
                  <p><span className="text-slate-500">Plan:</span> <strong>{planOption?.label ?? selectedPlan}</strong></p>
                  {!isFree && (
                    <p className="pt-2">
                      <span className="text-slate-500">Ciclo:</span>{' '}
                      <strong>{cicloPago === 'anual' ? 'Anual (-40%)' : 'Mensual'}</strong>{' '}
                      {planOption && planOption.price > 0 && (
                        <span className="text-[#ffd427] font-bold">
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
                          className="text-[#ffd427] focus:ring-[#ffd427]"
                        />
                        <span className="text-sm text-slate-700">Mensual</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="ciclo"
                          checked={cicloPago === 'anual'}
                          onChange={() => setCicloPago('anual')}
                          className="text-[#ffd427] focus:ring-[#ffd427]"
                        />
                        <span className="text-sm text-slate-700">Anual <span className="text-emerald-600 font-medium">-40%</span></span>
                      </label>
                    </div>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acceptTerms}
                        onChange={(e) => setAcceptTerms(e.target.checked)}
                        className="mt-1 rounded border-slate-300 text-[#ffd427] focus:ring-[#ffd427]"
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
                      <Smartphone size={20} className="text-[#ffd427]" />
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

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="min-h-[44px] px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium flex items-center gap-1"
                  >
                    <ArrowLeft size={18} /> Atrás
                  </button>
                  {isFree ? (
                    <button
                      type="button"
                      onClick={handleSubmitFree}
                      disabled={loading}
                      className="min-h-[44px] flex-1 bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
                    >
                      {loading ? <><Loader2 size={20} className="animate-spin" /> Creando...</> : <>Crear mi cuenta y barbería</>}
                    </button>
                  ) : isNativeMobile ? (
                    <button
                      type="button"
                      onClick={handlePayWithMobile}
                      disabled={loading || !step3Valid}
                      className="min-h-[44px] flex-1 bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loading ? <><Loader2 size={20} className="animate-spin" /> Abriendo...</> : isAndroid ? <>Pagar con Google Wallet</> : <>Pagar con Apple Pay</>}
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="mt-4 text-center">
          <button type="button" onClick={onGoToLogin} className="text-slate-400 hover:text-[#ffd427] text-sm font-medium">
            Ya tengo cuenta – Iniciar sesión
          </button>
        </p>
      </div>
    </div>
  );
};

export default SelfServiceBarberSignup;
