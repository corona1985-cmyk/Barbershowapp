import React, { Suspense, lazy } from 'react';
import { Scissors, MapPin, UserPlus, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import WelcomePlanSelector from '../WelcomePlanSelector';
import SelfServiceBarberSignup from '../SelfServiceBarberSignup';
import LandingPage from '../landing/LandingPage';
import GuestBookingView from '../GuestBookingView';
import AdMobBanner from '../AdMobBanner';
import { APP_VERSION, listPublicShops } from '../../services/firebase';
import { PointOfSale } from '../../types';
import { isIOSAccountCreationAllowed, isIOSBarberSignupAllowed } from '../../utils/platform';
import { MIN_PASSWORD_LENGTH } from '../../config/app';
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

export const UnauthenticatedScreens: React.FC<UnauthenticatedScreensProps> = (p) => {
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
        <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col">
            <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-white/10 px-4 sm:px-6 py-3 safe-area-top">
                <button
                    type="button"
                    onClick={p.onLoginBack}
                    className="flex items-center gap-1.5 min-h-[44px] text-slate-200 hover:text-white text-sm rounded-xl hover:bg-white/10 px-3 -ml-1 transition-colors"
                >
                    <ArrowLeft size={18} /> {p.t('common.back')}
                </button>
            </header>
            <main className="flex-1 overflow-y-auto scroll-touch px-3 sm:px-4 py-4 sm:py-6 safe-area-bottom flex items-start sm:items-center justify-center">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-4 sm:p-6 md:p-8 border-t-8 border-[#ffd427] min-w-0">
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
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-[#ffd427] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-yellow-500/20">
                        <Scissors size={32} className="text-slate-900" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900">{p.t('common.barberShow')}</h1>
                    <p className="text-slate-400 text-xs mt-1">v{APP_VERSION}</p>
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
                ) : (
                    <div className="space-y-4">
                        <form onSubmit={p.onLogin} className="space-y-4 animate-in slide-in-from-left duration-300">
                            {p.loginError && (
                                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">
                                    {p.loginError}
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{p.t('common.username')}</label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-3 sm:py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffd427]"
                                    value={p.username}
                                    onChange={e => p.onUsernameChange(e.target.value)}
                                    placeholder={p.t('common.usernamePlaceholder')}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">{p.t('common.password')}</label>
                                <input
                                    type="password"
                                    className="w-full px-4 py-3 sm:py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffd427]"
                                    value={p.password}
                                    onChange={e => p.onPasswordChange(e.target.value)}
                                    placeholder={p.t('common.passwordPlaceholder')}
                                    required
                                />
                            </div>
                            <button type="submit" disabled={p.loginLoading} className="w-full min-h-[48px] py-3 rounded-xl font-bold transition-colors shadow-lg shadow-yellow-500/30 mt-4 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98] bg-[#ffd427] text-slate-900 hover:bg-[#e6be23]">
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
            </main>
        </div>
    );
};

export async function resolveGuestShopSelection(id: number): Promise<PointOfSale | undefined> {
    const list = await listPublicShops();
    return list.find(p => p.id === id);
}
