import React, { Suspense, lazy, useEffect, useState } from 'react';
import {
    Scissors, MapPin, UserPlus, CheckCircle, ArrowLeft, Loader2,
    User, Lock, Eye, EyeOff, KeyRound, MessageCircle, Mail,
} from 'lucide-react';
import WelcomePlanSelector from '../WelcomePlanSelector';
import SelfServiceBarberSignup from '../SelfServiceBarberSignup';
import LandingPage from '../landing/LandingPage';
import GuestBookingView from '../GuestBookingView';
import AdMobBanner from '../AdMobBanner';
import { APP_VERSION, listPublicShops } from '../../services/firebase';
import { PointOfSale } from '../../types';
import { isIOSAccountCreationAllowed, isIOSBarberSignupAllowed } from '../../utils/platform';
import { LOGIN_FAILED_ATTEMPTS_HINT, MIN_PASSWORD_LENGTH } from '../../config/app';
import { CONTACT } from '../../constants/plans';
import { guestShell, ViewFallback } from './GuestShell';

const ClientDiscovery = lazy(() => import('../../pages/ClientDiscovery'));

export interface UnauthenticatedScreensProps {
    t: (key: string, vars?: Record<string, string | number>) => string;
    isNativeApp: boolean;
    isLoadingSession: boolean;
    guestBookingPos: { id: number; name: string } | null;
    showBarberiasGuest: boolean;
    showLandingPage: boolean;
    showLoginScreen: boolean;
    isBarberRegistering: boolean;
    isRegistering: boolean;
    connectionError: string | null;
    loginError: string;
    loginLoading: boolean;
    failedLoginAttempts: number;
    username: string;
    password: string;
    regName: string;
    regUsername: string;
    regPassword: string;
    regPhone: string;
    regSuccess: boolean;
    referralPos: PointOfSale | null;
    onGuestBookingBack: () => void;
    onGuestBookingSuccess: () => void;
    onCloseBarberias: () => void;
    onOpenClientRegistration: (clearReferral?: boolean, returnTarget?: 'welcome' | 'landing' | 'barberias') => void;
    onOpenLogin: (returnTarget?: 'welcome' | 'landing' | 'barberias') => void;
    onGuestSelectPos: (id: number) => void;
    onBookAppointment: (id: number, name: string) => void;
    onLandingGetStarted: () => void;
    onLandingLogin: () => void;
    onLandingBarberias: () => void;
    onLandingClientRegister: () => void;
    onBarberSignupSuccess: (username: string, password: string) => void;
    onBarberSignupLogin: () => void;
    onBarberSignupBack: () => void;
    onWelcomeLogin: () => void;
    onWelcomeBarberias: () => void;
    onWelcomeClientRegister: () => void;
    onWelcomeBackToLanding?: () => void;
    onWelcomeBarberSuccess: (username: string, password: string) => void;
    onLoginBack: () => void;
    onLogin: (e: React.FormEvent) => void;
    onRegister: (e: React.FormEvent) => void;
    onUsernameChange: (value: string) => void;
    onPasswordChange: (value: string) => void;
    onRegNameChange: (value: string) => void;
    onRegUsernameChange: (value: string) => void;
    onRegPasswordChange: (value: string) => void;
    onRegPhoneChange: (value: string) => void;
    onStartClientRegister: () => void;
    onStartBarberRegister: () => void;
    onCancelRegister: () => void;
}

const LoginAtmosphere: React.FC = () => (
    <div className="login-atmosphere" aria-hidden>
        <div className="login-orb login-orb-a" />
        <div className="login-orb login-orb-b" />
        <div className="login-orb login-orb-c" />
        <Scissors className="login-deco-scissors login-deco-1" size={128} strokeWidth={1.25} />
        <Scissors className="login-deco-scissors login-deco-2" size={96} strokeWidth={1.25} />
    </div>
);

export const UnauthenticatedScreens: React.FC<UnauthenticatedScreensProps> = (p) => {
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [shakeLogin, setShakeLogin] = useState(false);

    useEffect(() => {
        if (p.isRegistering) setShowForgotPassword(false);
    }, [p.isRegistering]);

    useEffect(() => {
        if (!p.loginError || showForgotPassword) return;
        setShakeLogin(true);
        const id = window.setTimeout(() => setShakeLogin(false), 450);
        return () => window.clearTimeout(id);
    }, [p.loginError, p.failedLoginAttempts, showForgotPassword]);

    const showForgotHint = p.failedLoginAttempts >= LOGIN_FAILED_ATTEMPTS_HINT;
    const recoveryUsername = p.username.trim() || p.t('auth.forgotPasswordNoUsername');
    const forgotWaHref = `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(p.t('auth.forgotPasswordWaMessage', { username: recoveryUsername }))}`;
    const forgotMailHref = `mailto:${CONTACT.email}?subject=${encodeURIComponent(p.t('auth.forgotPasswordEmailSubject'))}&body=${encodeURIComponent(p.t('auth.forgotPasswordWaMessage', { username: recoveryUsername }))}`;
    if (p.isLoadingSession) {
        return guestShell(
            <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
                <div className="text-center text-white">
                    <div className="w-16 h-16 border-4 border-[#ffd427] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-lg font-medium">{p.t('auth.loadingApp')}</p>
                </div>
            </div>
        );
    }

    if (p.guestBookingPos) {
        return guestShell(
            <GuestBookingView
                posId={p.guestBookingPos.id}
                posName={p.guestBookingPos.name}
                onBack={p.onGuestBookingBack}
                onSuccess={p.onGuestBookingSuccess}
            />
        );
    }

    if (p.showBarberiasGuest) {
        return guestShell(
            <div className="min-h-screen min-h-[100dvh] bg-slate-50">
                <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between safe-area-top shadow-sm">
                    <button type="button" onClick={p.onCloseBarberias} className="flex items-center gap-1.5 min-h-[44px] text-slate-600 hover:text-slate-900 text-sm rounded-xl hover:bg-slate-100 px-3 -ml-1 transition-colors">
                        <ArrowLeft size={18} /> {p.t('common.back')}
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="w-9 h-9 bg-[#ffd427] rounded-lg flex items-center justify-center shadow-sm">
                            <Scissors size={18} className="text-slate-900" />
                        </div>
                        <span className="font-bold text-slate-900 hidden sm:inline">{p.t('common.barberShow')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {isIOSAccountCreationAllowed() && (
                            <button type="button" onClick={() => p.onOpenClientRegistration(true, 'barberias')} className="min-h-[44px] flex items-center text-sm border border-slate-200 hover:border-slate-300 text-slate-700 font-medium px-3 sm:px-4 rounded-xl transition-colors hover:bg-slate-50">
                                {p.t('common.register')}
                            </button>
                        )}
                        <button type="button" onClick={() => p.onOpenLogin('barberias')} className="min-h-[44px] flex items-center text-sm bg-[#ffd427] hover:bg-amber-400 text-slate-900 font-semibold px-3 sm:px-4 rounded-xl transition-colors shadow-sm">
                            {p.t('common.login')}
                        </button>
                    </div>
                </header>
                <main className="px-4 sm:px-6 lg:px-10 py-8 md:py-12 max-w-7xl mx-auto">
                    <Suspense fallback={<ViewFallback />}>
                    <ClientDiscovery
                        guestMode
                        onSwitchPos={p.onGuestSelectPos}
                        onBookAppointment={p.onBookAppointment}
                    />
                    </Suspense>
                </main>
            </div>
        );
    }

    if (p.showLandingPage && !p.isNativeApp && !p.showBarberiasGuest && !p.guestBookingPos) {
        return guestShell(
            <>
                <AdMobBanner showAds={true} />
                <LandingPage
                    onGetStarted={p.onLandingGetStarted}
                    onGoToLogin={p.onLandingLogin}
                    onGoToBarberias={p.onLandingBarberias}
                    onGoToClientRegister={p.onLandingClientRegister}
                />
            </>
        );
    }

    if (p.isBarberRegistering && isIOSBarberSignupAllowed()) {
        return guestShell(
            <>
                <AdMobBanner showAds={true} />
                <SelfServiceBarberSignup
                    onSuccess={p.onBarberSignupSuccess}
                    onGoToLogin={p.onBarberSignupLogin}
                    onGoBack={p.onBarberSignupBack}
                />
            </>
        );
    }

    if (!p.showLoginScreen) {
        return guestShell(
            <>
                <AdMobBanner showAds={true} />
                <WelcomePlanSelector
                    onGoToLogin={p.onWelcomeLogin}
                    onGoToBarberias={p.onWelcomeBarberias}
                    onGoToClientRegister={p.onWelcomeClientRegister}
                    onBackToLanding={p.onWelcomeBackToLanding}
                    onBarberSignupSuccess={p.onWelcomeBarberSuccess}
                />
            </>
        );
    }

    return guestShell(
        <div className="relative min-h-screen min-h-[100dvh] login-hero-bg flex flex-col overflow-hidden">
            <LoginAtmosphere />
            <header className="relative z-40 sticky top-0 bg-slate-900/70 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 py-3 safe-area-top">
                <button
                    type="button"
                    onClick={() => {
                        setShowForgotPassword(false);
                        p.onLoginBack();
                    }}
                    className="flex items-center gap-1.5 min-h-[44px] text-slate-200 hover:text-white text-sm rounded-xl hover:bg-white/10 px-3 -ml-1 transition-colors"
                >
                    <ArrowLeft size={18} /> {p.t('common.back')}
                </button>
            </header>
            <main className="relative z-10 flex-1 overflow-y-auto scroll-touch px-3 sm:px-4 py-4 sm:py-6 safe-area-bottom flex items-start sm:items-center justify-center">
                <div className={`bg-white rounded-2xl shadow-2xl shadow-black/30 w-full max-w-md min-w-0 overflow-hidden login-card-in ${shakeLogin ? 'login-shake' : ''}`}>
                <div className="login-barber-stripe" aria-hidden />
                <div className="p-4 sm:p-6 md:p-8">
                {p.connectionError && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                        {p.connectionError}
                    </div>
                )}
                {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('signup') === 'success' && (
                    <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center gap-2">
                        <CheckCircle size={20} className="flex-shrink-0" />
                        <span>{p.t('auth.accountActivated')}</span>
                    </div>
                )}
                <div className={`text-center ${showForgotPassword ? 'mb-4' : 'mb-6'}`}>
                    {!showForgotPassword && (
                    <div className="relative w-20 h-20 mx-auto mb-4">
                        <div className="absolute inset-0 rounded-full bg-[#ffd427]/40 login-pulse-ring" />
                        <div className="relative w-20 h-20 bg-[#ffd427] rounded-full flex items-center justify-center login-logo-glow">
                            <Scissors size={36} className="text-slate-900 login-scissors-wiggle" />
                        </div>
                    </div>
                    )}
                    <h1 className="text-2xl font-bold text-slate-900">{p.t('common.barberShow')}</h1>
                    {!p.isRegistering && !showForgotPassword && (
                        <p className="text-slate-500 text-sm mt-1">{p.t('auth.loginTagline')}</p>
                    )}
                    {!showForgotPassword && (
                    <p className="text-slate-400 text-xs mt-1">v{APP_VERSION}</p>
                    )}
                </div>

                {p.isRegistering && isIOSAccountCreationAllowed() ? (
                     <form onSubmit={p.onRegister} className="space-y-4 animate-in slide-in-from-right duration-300">
                         <p className="text-center text-slate-600 text-sm mb-1">{p.t('auth.createClientAccount', { role: p.t('auth.clientRole') })}</p>
                         {p.loginError && (
                             <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">
                                 {p.loginError}
                             </div>
                         )}
                         {p.referralPos && (
                             <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center mb-4">
                                 <MapPin size={20} className="text-[#ffd427] mr-2" />
                                 <div>
                                     <p className="text-xs text-yellow-800 uppercase font-bold">{p.t('auth.registeringAt')}</p>
                                     <p className="font-bold text-slate-800">{p.referralPos.name}</p>
                                 </div>
                             </div>
                         )}
                         {p.regSuccess ? (
                             <div className="bg-green-50 text-green-700 p-6 rounded-xl flex flex-col items-center justify-center text-center">
                                 <CheckCircle size={48} className="mb-2" />
                                 <h3 className="font-bold text-lg">{p.t('auth.accountCreated')}</h3>
                                 <p>{p.t('auth.redirectingLogin')}</p>
                             </div>
                         ) : (
                             <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">{p.t('common.username')}</label>
                                        <input type="text" required className="w-full px-4 py-2 border rounded-lg focus:ring-[#ffd427]" value={p.regUsername} onChange={e => p.onRegUsernameChange(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">{p.t('common.name')}</label>
                                        <input type="text" required className="w-full px-4 py-2 border rounded-lg focus:ring-[#ffd427]" value={p.regName} onChange={e => p.onRegNameChange(e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">{p.t('common.phone')}</label>
                                    <input type="tel" required className="w-full px-4 py-2 border rounded-lg focus:ring-[#ffd427]" value={p.regPhone} onChange={e => p.onRegPhoneChange(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">{p.t('common.password')}</label>
                                    <input type="password" required minLength={MIN_PASSWORD_LENGTH} className="w-full px-4 py-2 border rounded-lg focus:ring-[#ffd427]" value={p.regPassword} onChange={e => p.onRegPasswordChange(e.target.value)} placeholder={p.t('signup.passwordMinPlaceholder', { min: MIN_PASSWORD_LENGTH })} />
                                </div>
                                <button type="submit" className="w-full min-h-[48px] bg-[#ffd427] text-slate-900 py-3 rounded-xl font-bold hover:bg-[#e6be23] transition-colors shadow-lg mt-4 active:scale-[0.98]">
                                    {p.t('common.register')}
                                </button>
                                <button type="button" onClick={p.onCancelRegister} className="w-full min-h-[44px] text-slate-500 py-2 text-sm flex items-center justify-center hover:text-slate-700 active:bg-slate-100 rounded-lg">
                                    <ArrowLeft size={14} className="mr-1" /> {p.t('auth.backToLogin')}
                                </button>
                             </>
                         )}
                     </form>
                ) : showForgotPassword ? (
                    <div className="space-y-3 animate-in slide-in-from-right duration-300">
                        <div className="flex justify-center">
                            <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center">
                                <KeyRound size={24} className="text-amber-500" />
                            </div>
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 text-center">{p.t('auth.forgotPasswordTitle')}</h2>
                        <p className="text-sm text-slate-600 text-center leading-relaxed">{p.t('auth.forgotPasswordBody')}</p>
                        <p className="text-xs text-slate-500 text-center">{p.t('auth.forgotPasswordUsernameHint')}</p>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">{p.t('common.username')}</label>
                            <div className="relative">
                                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffd427]"
                                    value={p.username}
                                    onChange={e => p.onUsernameChange(e.target.value)}
                                    placeholder={p.t('common.usernamePlaceholder')}
                                    autoComplete="username"
                                />
                            </div>
                        </div>
                        <a
                            href={forgotWaHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full min-h-[48px] py-3 rounded-xl font-bold bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 active:scale-[0.98] transition-colors"
                        >
                            <MessageCircle size={20} /> {p.t('auth.forgotPasswordWhatsApp')}
                        </a>
                        <a
                            href={forgotMailHref}
                            className="w-full min-h-[44px] py-3 rounded-xl font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-colors"
                        >
                            <Mail size={18} /> {p.t('auth.forgotPasswordEmail')}
                        </a>
                        <button
                            type="button"
                            onClick={() => setShowForgotPassword(false)}
                            className="w-full min-h-[44px] text-slate-500 py-2 text-sm flex items-center justify-center hover:text-slate-700 active:bg-slate-100 rounded-lg"
                        >
                            <ArrowLeft size={14} className="mr-1" /> {p.t('auth.backToLogin')}
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <form onSubmit={p.onLogin} className="space-y-4 animate-in slide-in-from-left duration-300">
                            {p.loginError && (
                                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">
                                    {p.loginError}
                                </div>
                            )}
                            {showForgotHint && (
                                <div className="bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-xl text-sm animate-in fade-in zoom-in duration-200">
                                    <p className="font-medium leading-relaxed">{p.t('auth.forgotPasswordBanner')}</p>
                                    <button
                                        type="button"
                                        onClick={() => setShowForgotPassword(true)}
                                        className="mt-2 w-full min-h-[44px] rounded-lg bg-[#ffd427] hover:bg-[#e6be23] text-slate-900 font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-colors"
                                    >
                                        <KeyRound size={16} /> {p.t('auth.forgotPasswordCta')}
                                    </button>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{p.t('common.username')}</label>
                                <div className="relative">
                                    <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    <input
                                        type="text"
                                        className="w-full pl-10 pr-4 py-3 sm:py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffd427] focus:border-transparent transition-shadow"
                                        value={p.username}
                                        onChange={e => p.onUsernameChange(e.target.value)}
                                        placeholder={p.t('common.usernamePlaceholder')}
                                        required
                                        autoComplete="username"
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="block text-sm font-medium text-slate-700">{p.t('common.password')}</label>
                                    <button
                                        type="button"
                                        onClick={() => setShowForgotPassword(true)}
                                        className="text-xs font-semibold text-amber-600 hover:text-amber-700 hover:underline min-h-[32px] px-1"
                                    >
                                        {p.t('auth.forgotPassword')}
                                    </button>
                                </div>
                                <div className="relative">
                                    <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        className="w-full pl-10 pr-12 py-3 sm:py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffd427] focus:border-transparent transition-shadow"
                                        value={p.password}
                                        onChange={e => p.onPasswordChange(e.target.value)}
                                        placeholder={p.t('common.passwordPlaceholder')}
                                        required
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword((v) => !v)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-700 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                                        aria-label={p.t(showPassword ? 'auth.hidePassword' : 'auth.showPassword')}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                            <button type="submit" disabled={p.loginLoading} className="w-full min-h-[48px] py-3 rounded-xl font-bold transition-all shadow-lg shadow-yellow-500/30 mt-2 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98] bg-[#ffd427] text-slate-900 hover:bg-[#e6be23] hover:shadow-yellow-500/50">
                                {p.loginLoading ? (<><Loader2 size={20} className="animate-spin" /> {p.t('common.loggingIn')}</>) : p.t('common.loginTitle')}
                            </button>
                            {isIOSAccountCreationAllowed() && (
                            <div className="pt-4 border-t border-slate-100 mt-4 space-y-2">
                                <button type="button" onClick={p.onStartClientRegister} className="w-full min-h-[44px] flex items-center justify-center text-slate-600 font-medium hover:underline hover:text-[#e6be23] rounded-lg active:bg-slate-50">
                                    <UserPlus size={18} className="mr-2" /> {p.t('auth.createClientFree')}
                                </button>
                                {isIOSBarberSignupAllowed() && (
                                <button
                                    type="button"
                                    onClick={p.onStartBarberRegister}
                                    className="w-full min-h-[44px] flex items-center justify-center text-slate-600 font-medium hover:underline hover:text-[#e6be23] rounded-lg active:bg-slate-50"
                                >
                                    <Scissors size={18} className="mr-2" /> {p.t('auth.createBarberProfile')}
                                </button>
                                )}
                            </div>
                            )}
                        </form>
                    </div>
                )}
                </div>
                </div>
            </main>
        </div>
    );
};

export async function resolveGuestShopSelection(id: number): Promise<PointOfSale | undefined> {
    const list = await listPublicShops();
    return list.find(p => p.id === id);
}
