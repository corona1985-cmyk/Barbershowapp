
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { ViewState, UserRole, PointOfSale, SystemUser, AppointmentForSale, AccountTier } from './types';
import QRScannerView from './components/QRScannerView';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { DataService } from './services/data';
import { isAccountDeactivated } from './services/data';
import { authenticateMasterWithPassword, activatePlanFromPlay, listPublicShops, registerClientAccount, switchActivePos, signOutSession, auth } from './services/firebase';
import {
    initPlayBilling,
    isNativePaymentAvailable,
    purchasePlan,
    addPlayPurchaseListener,
    getTransactionForPlan,
    getActivePlayTransactions,
    isTransactionActivatable,
    iapActivationPayload,
} from './services/playBilling';
import { initLocalNotifications, syncAppointmentNotifications, stopAppointmentNotifications } from './services/notifications';
import LegalDocumentPage from './pages/LegalDocumentPage';
import { getLegalDocumentFromUrl, LegalDocumentType } from './utils/legal';
import { GLOBAL_FREE_MODE, MIN_PASSWORD_LENGTH } from './config/app';
import { sanitizeViewForRole, defaultViewForRole } from './config/views';
import { isIOSAccountCreationAllowed } from './utils/platform';
import { useTranslation, translate } from './i18n';
import { guestShell, ViewFallback } from './components/app/GuestShell';
import { SubscriptionExpiredView } from './components/app/SubscriptionExpiredView';
import { AuthenticatedShell } from './components/app/AuthenticatedShell';
import { UnauthenticatedScreens } from './components/app/UnauthenticatedScreens';

const MasterDashboard = lazy(() => import('./pages/MasterDashboard'));

function parseSessionUserRole(value: string | undefined): UserRole | null {
    const role = value === 'empleado' ? 'barbero' : value;
    switch (role) {
        case 'superadmin':
        case 'admin':
        case 'dueno':
        case 'barbero':
        case 'cliente':
        case 'platform_owner':
        case 'support':
        case 'financial':
        case 'commercial':
            return role;
        default:
            return null;
    }
}

const App: React.FC = () => {
    const { t, formatDate } = useTranslation();
    const isNativeApp = Capacitor.isNativePlatform();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentView, setCurrentView] = useState<ViewState>('dashboard');
    const [userRole, setUserRole] = useState<UserRole>('admin');
    const [fullName, setFullName] = useState('');
    const [userPhotoUrl, setUserPhotoUrl] = useState('');
    const [acceptedCookies, setAcceptedCookies] = useState(false);
    const [legalView, setLegalView] = useState<LegalDocumentType | null>(() => getLegalDocumentFromUrl());
    
    // Mobile Sidebar State
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    
    // Multi-Tenant State
    const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([]);
    const [currentPosId, setCurrentPosId] = useState<number | null>(null);
    const [currentPosName, setCurrentPosName] = useState<string>('');
    const [referralPos, setReferralPos] = useState<PointOfSale | null>(null);
    
    // Login State
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loginError, setLoginError] = useState('');
    const [loginLoading, setLoginLoading] = useState(false);
    
    // Registration State
    const [isRegistering, setIsRegistering] = useState(false);
    const [regName, setRegName] = useState('');
    const [regUsername, setRegUsername] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regPhone, setRegPhone] = useState('');
    const [regSuccess, setRegSuccess] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [isLoadingSession, setIsLoadingSession] = useState(true);
    /** Si false, se muestra primero la bienvenida (tipo de barbería + contacto). Si true, el formulario de login. */
    const [showLoginScreen, setShowLoginScreen] = useState(false);
    /** Pantalla a la que vuelve "Volver" desde el login. */
    const [loginReturnTarget, setLoginReturnTarget] = useState<'welcome' | 'landing' | 'barberias'>('welcome');
    /** Registro de perfil de barbero abierto desde la pantalla de login. */
    const [isBarberRegistering, setIsBarberRegistering] = useState(false);
    /** Landing page de marketing; nunca en iOS/Android nativo (Guideline 4.2). */
    const [showLandingPage, setShowLandingPage] = useState(() => !isNativeApp);
    /** Cliente sin cuenta que quiere ver barberías: muestra lista para elegir una y registrarse ahí. */
    const [showBarberiasGuest, setShowBarberiasGuest] = useState(false);
    /** Invitado que está agendando cita en una barbería (sin cuenta). */
    const [guestBookingPos, setGuestBookingPos] = useState<{ id: number; name: string } | null>(null);
    /** Cita completada que se envía a facturación (Punto de Venta) */
    const [salesFromAppointment, setSalesFromAppointment] = useState<AppointmentForSale | null>(null);
    const [appointmentsPrefill, setAppointmentsPrefill] = useState<{ date?: string; clientId?: number; openModal?: boolean } | null>(null);
    /** Plan de la sede activa: solo 'pro' muestra campana de notificaciones para el barbero */
    const [isPlanPro, setIsPlanPro] = useState(false);
    /** Tier de negocio de la sede activa: solo / barberia / multisede (menú y límites) */
    const [accountTier, setAccountTier] = useState<AccountTier>('barberia');
    const [renewalLoading, setRenewalLoading] = useState(false);
    const [renewalError, setRenewalError] = useState('');
    const pendingRenewalRef = useRef<{ username: string; cycle: 'mensual' | 'anual' } | null>(null);
    /** En plan Multi-Sede: sedes del mismo owner para mostrar selector (solo si hay más de una) */
    const [posListForOwner, setPosListForOwner] = useState<PointOfSale[]>([]);
    /** Solo cliente: barbería preferida (QR/favoritos). Al iniciar sesión se abre esa barbería. */
    const [preferredPosId, setPreferredPosId] = useState<number | null>(null);
    /** Sede actual (para comprobar vencimiento de suscripción). */
    const [currentPos, setCurrentPos] = useState<PointOfSale | null>(null);
    const accountDeactivatedMessage = 'Tu cuenta ha sido eliminada permanentemente.';

    useEffect(() => {
        DataService.initialize().catch((err) => {
            console.error('Error inicializando DataService:', err);
        });
    }, []);

    useEffect(() => {
        const syncLegalFromUrl = () => setLegalView(getLegalDocumentFromUrl());
        window.addEventListener('popstate', syncLegalFromUrl);
        return () => window.removeEventListener('popstate', syncLegalFromUrl);
    }, []);

    const handleSwitchPos = async (posId: number): Promise<AccountTier> => {
        const role = DataService.getCurrentUserRole() || userRole;
        if (role !== 'cliente') {
            try {
                await switchActivePos(posId);
            } catch (e) {
                console.warn('switchActivePos', e);
            }
        }
        DataService.setActivePosId(posId);
        setCurrentPosId(posId);
        try {
            let pos: PointOfSale | null = null;
            let posList: PointOfSale[] = [];
            if (role === 'cliente') {
                posList = await listPublicShops();
                pos = posList.find(p => p.id === posId) ?? null;
            } else {
                posList = await DataService.getPointsOfSale();
                pos = posList.find(p => p.id === posId) ?? null;
            }
            try {
                setCurrentPos(pos);
                setCurrentPosName(pos ? pos.name : 'Desconocido');
                setIsPlanPro(pos?.plan === 'pro');
                setAccountTier(pos?.tier ?? 'barberia');
                if (role !== 'cliente' && pos?.tier === 'multisede' && pos.ownerId) {
                    const sameOwner = posList.filter(p => p.ownerId === pos.ownerId);
                    setPosListForOwner(sameOwner);
                } else {
                    setPosListForOwner([]);
                }
            } catch (stateErr) {
                console.error('handleSwitchPos state update error:', stateErr);
                setCurrentPos(null);
                setCurrentPosName('Desconocido');
                setIsPlanPro(false);
                setAccountTier('barberia');
                setPosListForOwner([]);
            }
            return (pos?.tier ?? 'barberia');
        } catch (err) {
            setCurrentPos(null);
            setCurrentPosName('Desconocido');
            setIsPlanPro(false);
            setAccountTier('barberia');
            setPosListForOwner([]);
            return 'barberia';
        }
    };

    /** Suscripción vencida: solo aplica a admin/dueno/barbero con sede que tiene subscriptionExpiresAt en el pasado. */
    const isSubscriptionExpired = (userRole === 'admin' || userRole === 'dueno' || userRole === 'barbero')
        && currentPos != null
        && currentPos.subscriptionExpiresAt != null
        && !DataService.isSubscriptionActive(currentPos);

    // Ocultar splash (web + nativo Android) cuando la app ha cargado
    useEffect(() => {
        if (!isLoadingSession) {
            const splash = document.getElementById('app-splash');
            if (splash) {
                splash.classList.add('hide');
                setTimeout(() => { splash.remove(); }, 450);
            }
            if (Capacitor.isNativePlatform()) {
                SplashScreen.hide().catch(() => {});
            }
        }
    }, [isLoadingSession]);

    // App Tracking Transparency (iOS): el plugin AdMob enlaza el framework ATT, por lo que
    // Apple exige mostrar el diálogo de permiso aunque el banner nativo esté desactivado.
    // Lo solicitamos al arrancar (una vez cargada la sesión y con la app en primer plano),
    // independientemente de si se muestran anuncios. Sin esto, App Review rechaza la app con
    // "permission request not found".
    useEffect(() => {
        if (Capacitor.getPlatform() !== 'ios' || isLoadingSession) return;

        let cancelled = false;
        // iOS solo presenta el diálogo ATT con la app en estado activo; un pequeño retraso
        // tras ocultar el splash garantiza que la app esté en primer plano.
        const timeoutId = setTimeout(() => {
            import('./services/att')
                .then(({ ensureAppTrackingAuthorization }) => {
                    if (!cancelled) ensureAppTrackingAuthorization();
                })
                .catch((err) => console.warn('[ATT] No se pudo solicitar autorización:', err));
        }, 800);

        return () => {
            cancelled = true;
            clearTimeout(timeoutId);
        };
    }, [isLoadingSession]);

    // Billing nativo cuando no estamos en modo promocional global (App Store / Play Store).
    useEffect(() => {
        if (!GLOBAL_FREE_MODE && isNativePaymentAvailable()) initPlayBilling();
    }, []);

    // Listener de compra para renovación de suscripción vencida.
    useEffect(() => {
        if (!isSubscriptionExpired || GLOBAL_FREE_MODE || !isNativePaymentAvailable()) return;
        const remove = addPlayPurchaseListener(async () => {
            const pending = pendingRenewalRef.current;
            if (!pending || !currentPosId) return;
            try {
                const tx = await getTransactionForPlan('barberia', pending.cycle);
                if (!isTransactionActivatable(tx)) {
                    setRenewalError('Compra recibida. Si no se reactiva, contacta a soporte.');
                    pendingRenewalRef.current = null;
                    return;
                }
                const result = await activatePlanFromPlay(iapActivationPayload(tx!));
                pendingRenewalRef.current = null;
                setRenewalLoading(false);
                if (result.success) {
                    setRenewalError('');
                    await handleSwitchPos(currentPosId);
                } else {
                    setRenewalError(result.message || 'No se pudo reactivar la suscripción.');
                }
            } catch (e) {
                console.error(e);
                setRenewalError('Error al reactivar. Contacta a soporte.');
                pendingRenewalRef.current = null;
                setRenewalLoading(false);
            }
        });
        return remove;
    }, [isSubscriptionExpired, currentPosId, username]);

    // Notificaciones locales de citas (solo nativo): recordatorio 30 min antes y aviso de cita nueva.
    useEffect(() => {
        if (!isNativeApp || !isAuthenticated) return;
        if (userRole === 'platform_owner') return;

        let cancelled = false;
        let intervalId: ReturnType<typeof setInterval> | null = null;

        const buildContext = () => ({
            role: userRole,
            posId: currentPosId,
            barberId: DataService.getCurrentBarberId(),
            clientId: DataService.getCurrentUser()?.clientId ?? null,
        });

        const runSync = () => {
            syncAppointmentNotifications(buildContext()).catch((err) => {
                console.warn('[notifications] sync error:', err);
            });
        };

        const onVisibility = () => {
            if (document.visibilityState === 'visible') runSync();
        };

        (async () => {
            const granted = await initLocalNotifications();
            if (cancelled || !granted) return;
            runSync();
            intervalId = setInterval(runSync, 60_000);
            document.addEventListener('visibilitychange', onVisibility);
        })();

        return () => {
            cancelled = true;
            if (intervalId) clearInterval(intervalId);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [isNativeApp, isAuthenticated, userRole, currentPosId, username]);

    useEffect(() => {
        if (!isAuthenticated) return;
        const safe = sanitizeViewForRole(currentView, userRole, accountTier);
        if (safe !== currentView) setCurrentView(safe);
    }, [isAuthenticated, accountTier, currentView, userRole]);

    useEffect(() => {
        const user = localStorage.getItem('currentUser');
        const cookies = localStorage.getItem('acceptedCookies');
        if (cookies) setAcceptedCookies(true);
        setConnectionError(null);

        const SESSION_LOAD_TIMEOUT_MS = 12000;
        let completed = false;
        const timeoutId = setTimeout(() => {
            if (completed) return;
            console.warn('[Session] Load timeout: forcing loading off');
            completed = true;
            setIsLoadingSession(false);
            const splash = document.getElementById('app-splash');
            if (splash) { splash.classList.add('hide'); splash.remove(); }
            if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) SplashScreen.hide().catch(() => {});
        }, SESSION_LOAD_TIMEOUT_MS);

        (async () => {
            try {
                await auth.authStateReady();
                if (!user || !auth.currentUser) {
                    if (user && !auth.currentUser) localStorage.removeItem('currentUser');
                    setShowLoginScreen(false);
                    setShowBarberiasGuest(false);
                    const params = new URLSearchParams(window.location.search);
                    const refPosId = params.get('ref_pos');
                    if (refPosId) {
                        const id = Number(refPosId);
                        setGuestBookingPos({ id, name: 'Cargando...' });
                        listPublicShops()
                            .then((posList) => {
                                const found = posList.find(p => p.id === id);
                                if (found) {
                                    setReferralPos(found);
                                    setGuestBookingPos({ id: found.id, name: found.name });
                                } else {
                                    setGuestBookingPos(null);
                                }
                            })
                            .catch((e) => {
                                console.error('Error cargando barbería del QR:', e);
                                setGuestBookingPos(null);
                            });
                    } else {
                        setGuestBookingPos(null);
                    }
                    setIsLoadingSession(false);
                    return;
                }
                let userData: { role?: string; name?: string; username?: string; posId?: number; photoUrl?: string } | null = null;
                try {
                    userData = JSON.parse(user);
                } catch {
                    localStorage.removeItem('currentUser');
                    setShowLoginScreen(false);
                    setShowBarberiasGuest(false);
                    setGuestBookingPos(null);
                    setIsLoadingSession(false);
                    return;
                }
                if (!userData || typeof userData !== 'object' || !userData.role || !userData.username) {
                    localStorage.removeItem('currentUser');
                    setShowLoginScreen(false);
                    setShowBarberiasGuest(false);
                    setGuestBookingPos(null);
                    setIsLoadingSession(false);
                    return;
                }
                const sessionUsername = userData.username;
                const freshUser = await DataService.getUserByUsername(sessionUsername);
                if (isAccountDeactivated(freshUser)) {
                    localStorage.removeItem('currentUser');
                    setIsAuthenticated(false);
                    setLoginError(accountDeactivatedMessage);
                    setShowLoginScreen(true);
                    setLoginReturnTarget('welcome');
                    setIsRegistering(false);
                    setShowBarberiasGuest(false);
                    setGuestBookingPos(null);
                    setUsername('');
                    setPassword('');
                    setIsLoadingSession(false);
                    return;
                }
                const resolvedUser = (freshUser ?? userData) as { role?: string; name?: string; username?: string; posId?: number; photoUrl?: string; barberId?: number; clientId?: number };
                const role = parseSessionUserRole(resolvedUser.role ?? userData.role);
                if (!role) {
                    localStorage.removeItem('currentUser');
                    setShowLoginScreen(false);
                    setShowBarberiasGuest(false);
                    setGuestBookingPos(null);
                    setIsLoadingSession(false);
                    return;
                }
                setIsAuthenticated(true);
                setUserRole(role);
                setFullName(resolvedUser.name ?? '');
                setUsername(resolvedUser.username ?? sessionUsername);
                setUserPhotoUrl((resolvedUser as any).photoUrl ?? '');

                if (role === 'platform_owner') {
                    setCurrentView('master_dashboard');
                } else if (role === 'superadmin') {
                    const posList = await DataService.getPointsOfSale();
                    setPointsOfSale(posList);
                    if (posList.length > 0) await handleSwitchPos(posList[0].id);
                    setCurrentView('admin_pos');
                } else {
                    if (role === 'cliente') {
                        const preferred = await DataService.getClientPreferredPos(sessionUsername);
                        setPreferredPosId(preferred);
                        const params = new URLSearchParams(window.location.search);
                        const refPosId = params.get('ref_pos');
                        if (refPosId) {
                            const posList = await listPublicShops();
                            const found = posList.find(p => p.id === Number(refPosId));
                            if (found) {
                                await DataService.setClientPreferredPos(sessionUsername, found.id);
                                setPreferredPosId(found.id);
                                await handleSwitchPos(found.id);
                                setCurrentView('appointments');
                            } else {
                                DataService.setActivePosId(null);
                                setCurrentPosId(null);
                                setCurrentPosName('');
                                setAccountTier('barberia');
                                setCurrentView('client_discovery');
                            }
                        } else if (preferred != null) {
                            const posList = await listPublicShops();
                            const found = posList.find(p => p.id === preferred);
                            if (found) {
                                await handleSwitchPos(preferred);
                                setCurrentView('appointments');
                            } else {
                                await DataService.setClientPreferredPos(sessionUsername, null);
                                setPreferredPosId(null);
                                DataService.setActivePosId(null);
                                setCurrentPosId(null);
                                setCurrentPosName('');
                                setAccountTier('barberia');
                                setCurrentView('client_discovery');
                            }
                        } else {
                            DataService.setActivePosId(null);
                            setCurrentPosId(null);
                            setCurrentPosName('');
                            setAccountTier('barberia');
                            setCurrentView('client_discovery');
                        }
                    } else {
                        const assignedPosId = resolvedUser.posId;
                        const tier = assignedPosId ? await handleSwitchPos(assignedPosId) : 'barberia';
                        if (!assignedPosId) setAccountTier('barberia');
                        setCurrentView(tier === 'gratuito' ? 'appointments' : 'dashboard');
                    }
                }
            } catch (err) {
                console.error('Error al restaurar sesión:', err);
                setConnectionError(translate('errors.connectionDb'));
            } finally {
                completed = true;
                clearTimeout(timeoutId);
                setIsLoadingSession(false);
            }
        })();
    }, []);

    const handleLogin = async (e: React.FormEvent, credentials?: { username: string; password: string }) => {
        e.preventDefault();
        setLoginError('');
        setConnectionError(null);
        const trimmedUsername = (credentials?.username ?? username).trim().toLowerCase();
        const passwordToUse = credentials?.password ?? password;
        if (!passwordToUse.trim()) {
            setLoginError(translate('errors.passwordRequired'));
            return;
        }
        setLoginLoading(true);
        let user: SystemUser | null = null;
        try {
            if (trimmedUsername === 'master') {
                const result = await authenticateMasterWithPassword(trimmedUsername, passwordToUse);
                user = result.user as SystemUser;
                DataService.logAuditAction('master_login', 'master', 'Platform Owner Access').catch(() => {});
            } else {
                try {
                    user = await DataService.authenticate(trimmedUsername, passwordToUse);
                } catch (e) {
                    setLoginLoading(false);
                    if (e instanceof Error && e.message === 'NO_PASSWORD_SET') {
                        setLoginError(translate('errors.noPasswordAssigned'));
                    } else if (e instanceof Error && e.message === 'ACCOUNT_DEACTIVATED') {
                        setLoginError(accountDeactivatedMessage);
                    } else {
                        setLoginError(e instanceof Error ? e.message : translate('errors.connectionRetry'));
                    }
                    return;
                }
                if (!user) {
                    setLoginLoading(false);
                    setLoginError(translate('errors.wrongPassword'));
                    return;
                }
            }

                if (!user) {
                    setLoginLoading(false);
                    setLoginError(translate('errors.invalidCredentials'));
                    return;
                }

                if (isAccountDeactivated(user)) {
                    setLoginLoading(false);
                    setLoginError(accountDeactivatedMessage);
                    setPassword('');
                    return;
                }

                if (user.status === 'pending_payment') {
                    setLoginLoading(false);
                    setLoginError(translate('errors.pendingPayment'));
                    return;
                }

            const role = user.role === 'empleado' ? 'barbero' : user.role;
            const userData = { username: user.username, role, name: user.name, photoUrl: (user as any).photoUrl, posId: user.posId, barberId: (user as any).barberId, clientId: (user as any).clientId, loginTime: new Date().toISOString() };
            localStorage.setItem('currentUser', JSON.stringify(userData));
            setIsAuthenticated(true);
            setUserRole(role);
            setFullName(user.name);
            setUserPhotoUrl((user as any).photoUrl ?? '');

            if (role === 'platform_owner') setCurrentView('master_dashboard');
            else if (role === 'superadmin') {
                const posList = await DataService.getPointsOfSale();
                setPointsOfSale(posList);
                if (posList.length > 0) await handleSwitchPos(posList[0].id);
                setCurrentView('admin_pos');
            } else {
                if (role === 'cliente') {
                    const params = new URLSearchParams(window.location.search);
                    const refPosId = params.get('ref_pos');
                    const [preferred, posList] = await Promise.all([
                        DataService.getClientPreferredPos(user.username),
                        listPublicShops(),
                    ]);
                    setPreferredPosId(preferred);
                    if (refPosId) {
                        const found = posList.find(p => p.id === Number(refPosId));
                        if (found) {
                            await DataService.setClientPreferredPos(user.username, found.id);
                            setPreferredPosId(found.id);
                            await handleSwitchPos(found.id);
                            setCurrentView('appointments');
                        } else {
                            DataService.setActivePosId(null);
                            setCurrentPosId(null);
                            setCurrentPosName('');
                            setAccountTier('barberia');
                            setCurrentView('client_discovery');
                        }
                    } else if (preferred != null) {
                        const found = posList.find(p => p.id === preferred);
                        if (found) {
                            await handleSwitchPos(preferred);
                            setCurrentView('appointments');
                        } else {
                            await DataService.setClientPreferredPos(user.username, null);
                            setPreferredPosId(null);
                            DataService.setActivePosId(null);
                            setCurrentPosId(null);
                            setCurrentPosName('');
                            setAccountTier('barberia');
                            setCurrentView('client_discovery');
                        }
                    } else {
                        DataService.setActivePosId(null);
                        setCurrentPosId(null);
                        setCurrentPosName('');
                        setAccountTier('barberia');
                        setCurrentView('client_discovery');
                    }
                } else if (user.posId != null) {
                    const tier = await handleSwitchPos(user.posId);
                    setCurrentView(tier === 'gratuito' ? 'appointments' : 'dashboard');
                } else {
                    setLoginError(translate('errors.noPosAssigned'));
                    setIsAuthenticated(false);
                    localStorage.removeItem('currentUser');
                }
            }
        } catch (err) {            console.error('Error en login:', err);
            setLoginError(translate('errors.connectionFirebase'));
        } finally {            setLoginLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isIOSAccountCreationAllowed()) return;
        setLoginError('');
        const userTrim = (regUsername || '').trim().toLowerCase();
        const nameTrim = (regName || '').trim();
        const phoneTrim = (regPhone || '').trim().replace(/\D/g, '');
        if (!userTrim || !regPassword || !nameTrim) {
            setLoginError(translate('errors.completeRegistrationFields'));
            return;
        }
        if (phoneTrim.length < 8) {
            setLoginError(translate('errors.invalidPhone'));
            return;
        }
        if (regPassword.length < MIN_PASSWORD_LENGTH) {
            setLoginError(translate('signup.passwordMinPlaceholder', { min: MIN_PASSWORD_LENGTH }));
            return;
        }
        try {
            const targetPosId = referralPos ? referralPos.id : 1;
            await registerClientAccount({
                username: userTrim,
                password: regPassword,
                name: nameTrim,
                phone: regPhone.trim(),
                posId: targetPosId,
            });
            setIsRegistering(false);
            setUsername(userTrim);
            setPassword(regPassword);
            await handleLogin({ preventDefault: () => {} } as React.FormEvent, {
                username: userTrim,
                password: regPassword,
            });
        } catch (err) {
            console.error('Error en registro:', err);
            const msg = err instanceof Error ? err.message : String(err);
            setLoginError(msg.includes('conexión') || msg.includes('permiso') ? msg : translate('errors.registrationFailed', { message: msg }));
        }
    };

    const openLoginScreen = (returnTarget: 'welcome' | 'landing' | 'barberias' = 'welcome') => {
        setLoginReturnTarget(returnTarget);
        setShowBarberiasGuest(false);
        if (returnTarget !== 'landing') setShowLandingPage(false);
        setShowLoginScreen(true);
        setIsRegistering(false);
        setIsBarberRegistering(false);
        setLoginError('');
    };

    const handleLoginBack = () => {
        setShowLoginScreen(false);
        setIsRegistering(false);
        setIsBarberRegistering(false);
        setLoginError('');
        if (loginReturnTarget === 'landing') {
            setShowLandingPage(true);
            setShowBarberiasGuest(false);
        } else if (loginReturnTarget === 'barberias') {
            setShowLandingPage(false);
            setShowBarberiasGuest(true);
        } else {
            setShowLandingPage(false);
            setShowBarberiasGuest(false);
        }
    };

    const openClientRegistration = (clearReferral = true, returnTarget: 'welcome' | 'landing' | 'barberias' = 'welcome') => {
        if (!isIOSAccountCreationAllowed()) return;
        if (clearReferral) setReferralPos(null);
        setLoginReturnTarget(returnTarget);
        setShowLandingPage(false);
        setShowBarberiasGuest(false);
        setShowLoginScreen(true);
        setIsRegistering(true);
        setLoginError('');
    };

    const handleLogout = () => {
        stopAppointmentNotifications().catch(() => {});
        localStorage.removeItem('currentUser');
        signOutSession().catch(() => {});
        setIsAuthenticated(false);
        setUsername('');
        setPassword('');
        setLoginError('');
        setRenewalError('');
        setCurrentView(defaultViewForRole(userRole));
        DataService.setActivePosId(null);
        setCurrentPosId(null);
        setShowLoginScreen(false);
        setShowLandingPage(!isNativeApp);
    };

    const handleRenewSubscription = async () => {
        if (!username.trim() || renewalLoading) return;
        if (!isNativePaymentAvailable()) {
            setRenewalError(translate('errors.renewFromMobile'));
            return;
        }
        setRenewalError('');
        setRenewalLoading(true);
        pendingRenewalRef.current = { username: username.trim().toLowerCase(), cycle: 'mensual' };
        const result = await purchasePlan('barberia', 'mensual');
        if (!result.success) {
            pendingRenewalRef.current = null;
            setRenewalLoading(false);
            setRenewalError(result.message || translate('errors.storeOpenFailed'));
        }
    };

    const handleRestoreSubscription = async () => {
        if (!username.trim() || renewalLoading) return;
        setRenewalError('');
        setRenewalLoading(true);
        try {
            const transactions = await getActivePlayTransactions();
            const barberiaTx = transactions.find((t) => t.productIdentifier.includes('barberia')) ?? transactions[0];
            if (!isTransactionActivatable(barberiaTx)) {
                setRenewalError(translate('errors.noPurchasesToRestore'));
                return;
            }
            const result = await activatePlanFromPlay(iapActivationPayload(barberiaTx!));
            if (result.success && currentPosId) {
                await handleSwitchPos(currentPosId);
            } else {
                setRenewalError(result.message || translate('errors.restoreFailed'));
            }
        } catch (e) {
            console.error(e);
            setRenewalError('Error al restaurar compras.');
        } finally {
            setRenewalLoading(false);
        }
    };

    const handleAccountDeactivated = () => {
        handleLogout();
        openLoginScreen('welcome');
        setLoginError(accountDeactivatedMessage);
    };

    const acceptCookies = () => {
        localStorage.setItem('acceptedCookies', 'true');
        setAcceptedCookies(true);
    };

    const handleClientPosSwitch = async (id: number) => {
        const currentUser = DataService.getCurrentUser();
        if (currentUser?.username && currentUser.role === 'cliente') {
            await DataService.setClientPreferredPos(currentUser.username, id);
            setPreferredPosId(id);
        }
        await handleSwitchPos(id);
        setCurrentView('appointments');
        window.history.replaceState({}, '', `${window.location.pathname}?ref_pos=${id}`);
    };

    const handleChangeView = (view: ViewState) => {
        if (userRole === 'cliente' && view === 'client_discovery') {
            DataService.setActivePosId(null);
            setCurrentPosId(null);
            setCurrentPosName('');
            DataService.clearCart();
            window.history.replaceState({}, '', window.location.pathname);
        }
        setCurrentView(sanitizeViewForRole(view, userRole, accountTier));
    };

    const handleRemoveFavorite = async () => {
        const u = DataService.getCurrentUser();
        if (u?.username) {
            await DataService.setClientPreferredPos(u.username, null);
            setPreferredPosId(null);
        }
    };

    const getViewTitle = (view: ViewState): string => {
        const titles: Partial<Record<ViewState, string>> = {
            shop: 'nav.onlineShop',
            sales: 'nav.posPoint',
            admin_pos: 'nav.globalManagement',
            client_discovery: 'nav.barbershops',
            qr_scanner: 'nav.scanQr',
            sales_records: 'nav.salesRecords',
            dashboard: 'nav.dashboard',
            appointments: 'nav.appointments',
            settings: 'nav.settings',
            calendar: 'nav.calendar',
            whatsapp_console: 'nav.whatsappConsole',
            clients: 'nav.clients',
            inventory: 'nav.inventory',
            finance: 'nav.finance',
            reports: 'nav.reports',
            user_admin: 'nav.userAdmin',
            client_profile: 'nav.clientProfile',
        };
        const key = titles[view];
        return key ? t(key) : view.replace('_', ' ');
    };

    const viewProps = {
        currentView,
        userRole,
        accountTier,
        currentPosId,
        preferredPosId,
        salesFromAppointment,
        appointmentsPrefill,
        posListForOwner,
        onChangeView: handleChangeView,
        onClearSalesFromAppointment: () => setSalesFromAppointment(null),
        onPrefillConsumed: () => setAppointmentsPrefill(null),
        onCompleteForBilling: (data: AppointmentForSale) => {
            setSalesFromAppointment(data);
            setCurrentView(sanitizeViewForRole('sales', userRole, accountTier));
        },
        onBookClient: (clientId: number) => {
            setAppointmentsPrefill({ clientId, openModal: true });
            setCurrentView('appointments');
        },
        onGoToSchedule: (date: string, openModal?: boolean) => {
            setAppointmentsPrefill({ date, openModal });
            setCurrentView('appointments');
        },
        onClientPosSwitch: handleClientPosSwitch,
        onRemoveFavorite: handleRemoveFavorite,
        onProfileUpdated: () => {
            const u = DataService.getCurrentUser();
            if (u) {
                setFullName(u.name ?? fullName);
                setUserPhotoUrl(u.photoUrl ?? '');
            }
        },
        onAccountDeactivated: handleAccountDeactivated,
    };

    if (legalView) {
        return isAuthenticated ? <LegalDocumentPage type={legalView} /> : guestShell(<LegalDocumentPage type={legalView} />);
    }

    if (isAuthenticated && userRole === 'platform_owner') {
        return (
            <Suspense fallback={<ViewFallback />}>
                <MasterDashboard onLogout={handleLogout} />
            </Suspense>
        );
    }

    if (isAuthenticated && isSubscriptionExpired && currentPos && !GLOBAL_FREE_MODE) {
        const expiresAt = currentPos.subscriptionExpiresAt;
        const expiryDate = expiresAt ? formatDate(expiresAt, { day: 'numeric', month: 'long', year: 'numeric' }) : '';
        return (
            <SubscriptionExpiredView
                title={t('subscription.expiredTitle')}
                message={t('subscription.expiredMessage', {
                    name: currentPosName || currentPos.name,
                    date: expiryDate ? t('subscription.expiredOn', { date: expiryDate }) : '',
                })}
                renewLabel={t('subscription.renewNow')}
                restoreLabel={t('subscription.restorePurchases')}
                logoutLabel={t('common.logout')}
                processingLabel={t('common.processing')}
                renewalError={renewalError}
                renewalLoading={renewalLoading}
                onRenew={handleRenewSubscription}
                onRestore={handleRestoreSubscription}
                onLogout={handleLogout}
            />
        );
    }

    if (!isAuthenticated) {
        return (
            <UnauthenticatedScreens
                t={t}
                isNativeApp={isNativeApp}
                isLoadingSession={isLoadingSession}
                guestBookingPos={guestBookingPos}
                showBarberiasGuest={showBarberiasGuest}
                showLandingPage={showLandingPage}
                showLoginScreen={showLoginScreen}
                isBarberRegistering={isBarberRegistering}
                isRegistering={isRegistering}
                connectionError={connectionError}
                loginError={loginError}
                loginLoading={loginLoading}
                username={username}
                password={password}
                regName={regName}
                regUsername={regUsername}
                regPassword={regPassword}
                regPhone={regPhone}
                regSuccess={regSuccess}
                referralPos={referralPos}
                onGuestBookingBack={() => setGuestBookingPos(null)}
                onGuestBookingSuccess={() => setGuestBookingPos(null)}
                onCloseBarberias={() => setShowBarberiasGuest(false)}
                onOpenClientRegistration={openClientRegistration}
                onOpenLogin={openLoginScreen}
                onGuestSelectPos={(id) => {
                    listPublicShops().then((list) => {
                        const pos = list.find(p => p.id === id);
                        if (pos) {
                            setReferralPos(pos);
                            if (isIOSAccountCreationAllowed()) {
                                openClientRegistration(false, 'barberias');
                            } else {
                                setGuestBookingPos({ id: pos.id, name: pos.name });
                            }
                            window.history.replaceState({}, '', `${window.location.pathname}?ref_pos=${id}`);
                        }
                    });
                }}
                onBookAppointment={(id, name) => setGuestBookingPos({ id, name })}
                onLandingGetStarted={() => {
                    setShowLandingPage(false);
                    setIsBarberRegistering(true);
                }}
                onLandingLogin={() => { setShowLandingPage(false); openLoginScreen('landing'); }}
                onLandingBarberias={() => setShowBarberiasGuest(true)}
                onLandingClientRegister={() => openClientRegistration(true, 'landing')}
                onBarberSignupSuccess={(u, pw) => {
                    setIsBarberRegistering(false);
                    handleLogin({ preventDefault: () => {} } as React.FormEvent, { username: u, password: pw });
                }}
                onBarberSignupLogin={() => openLoginScreen(showLoginScreen ? loginReturnTarget : 'landing')}
                onBarberSignupBack={() => {
                    setIsBarberRegistering(false);
                    if (!showLoginScreen && !isNativeApp) setShowLandingPage(true);
                }}
                onWelcomeLogin={() => openLoginScreen('welcome')}
                onWelcomeBarberias={() => setShowBarberiasGuest(true)}
                onWelcomeClientRegister={() => openClientRegistration(true, 'welcome')}
                onWelcomeBackToLanding={isNativeApp ? undefined : () => setShowLandingPage(true)}
                onWelcomeBarberSuccess={(u, pw) => {
                    handleLogin({ preventDefault: () => {} } as React.FormEvent, { username: u, password: pw });
                }}
                onLoginBack={handleLoginBack}
                onLogin={handleLogin}
                onRegister={handleRegister}
                onUsernameChange={setUsername}
                onPasswordChange={setPassword}
                onRegNameChange={setRegName}
                onRegUsernameChange={setRegUsername}
                onRegPasswordChange={setRegPassword}
                onRegPhoneChange={setRegPhone}
                onStartClientRegister={() => setIsRegistering(true)}
                onStartBarberRegister={() => {
                    setIsBarberRegistering(true);
                    setIsRegistering(false);
                    setLoginError('');
                }}
                onCancelRegister={() => setIsRegistering(false)}
            />
        );
    }

    if (userRole === 'cliente' && currentView === 'qr_scanner') {
        return (
            <QRScannerView
                onBack={() => setCurrentView('client_discovery')}
                onScan={async (posId) => {
                    await handleClientPosSwitch(posId);
                }}
            />
        );
    }

    return (
        <AuthenticatedShell
            {...viewProps}
            viewTitle={getViewTitle(currentView)}
            fullName={fullName}
            username={username}
            userPhotoUrl={userPhotoUrl}
            currentPosName={currentPosName}
            isPlanPro={isPlanPro}
            isSidebarOpen={isSidebarOpen}
            acceptedCookies={acceptedCookies}
            pointsOfSale={pointsOfSale}
            formattedDate={formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}
            cookieMessage={t('cookies.message')}
            viewPolicyLabel={t('common.viewPolicy')}
            acceptLabel={t('common.accept')}
            openMenuLabel={t('common.openMenu')}
            logoutLabel={t('common.logout')}
            logoutTitle={t('common.logoutTitle')}
            viewingPosLabel={t('nav.viewingPos')}
            posLabel={t('nav.posLabel')}
            myBusinessLabel={t('common.myBusiness')}
            onOpenSidebar={() => setIsSidebarOpen(true)}
            onCloseSidebar={() => setIsSidebarOpen(false)}
            onLogout={handleLogout}
            onSwitchPos={(posId) => { void handleSwitchPos(posId); }}
            onAcceptCookies={acceptCookies}
        />
    );
};

export default App;
