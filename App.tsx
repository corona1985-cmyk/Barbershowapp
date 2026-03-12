
import React, { useState, useEffect, lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import { ViewState, UserRole, PointOfSale, SystemUser, AppointmentForSale, AccountTier } from './types';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Sales = lazy(() => import('./pages/Sales'));
const Shop = lazy(() => import('./pages/Shop'));
const Appointments = lazy(() => import('./pages/Appointments'));
const Reports = lazy(() => import('./pages/Reports'));
const SalesRecords = lazy(() => import('./pages/SalesRecords'));
const Settings = lazy(() => import('./pages/Settings'));
const AdminPOS = lazy(() => import('./pages/AdminPOS'));
const CalendarView = lazy(() => import('./pages/CalendarView'));
const WhatsAppConsole = lazy(() => import('./pages/WhatsAppConsole'));
const UserAdmin = lazy(() => import('./pages/UserAdmin'));
const ClientDiscovery = lazy(() => import('./pages/ClientDiscovery'));
const ClientProfile = lazy(() => import('./pages/ClientProfile'));
const MasterDashboard = lazy(() => import('./pages/MasterDashboard'));
const Clients = lazy(() => import('./pages/InventoryClientsFinance').then(m => ({ default: m.Clients })));
const Inventory = lazy(() => import('./pages/InventoryClientsFinance').then(m => ({ default: m.Inventory })));
const Finance = lazy(() => import('./pages/InventoryClientsFinance').then(m => ({ default: m.Finance })));
import { Scissors, Cookie, MapPin, Globe, LogOut, Menu, UserPlus, CheckCircle, ArrowLeft, Shield, Loader2 } from 'lucide-react';
import BarberNotificationBell from './components/BarberNotificationBell';
import WelcomePlanSelector from './components/WelcomePlanSelector';
import GuestBookingView from './components/GuestBookingView';
import AdMobBanner from './components/AdMobBanner';
import AdSenseBanner from './components/AdSenseBanner';
import QRScannerView from './components/QRScannerView';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { DataService } from './services/data';
import { authenticateMasterWithPassword } from './services/firebase';
import { initPlayBilling, isPlayBillingAvailable } from './services/playBilling';

const ViewFallback = () => (
    <div className="flex items-center justify-center min-h-[200px]">
        <div className="w-12 h-12 border-4 border-[#ffd427] border-t-transparent rounded-full animate-spin" />
    </div>
);

const App: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentView, setCurrentView] = useState<ViewState>('dashboard');
    const [userRole, setUserRole] = useState<UserRole>('admin');
    const [fullName, setFullName] = useState('');
    const [userPhotoUrl, setUserPhotoUrl] = useState('');
    const [acceptedCookies, setAcceptedCookies] = useState(false);
    
    // Mobile Sidebar State
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    
    // Multi-Tenant State
    const [pointsOfSale, setPointsOfSale] = useState<PointOfSale[]>([]);
    const [currentPosId, setCurrentPosId] = useState<number | null>(null);
    const [currentPosName, setCurrentPosName] = useState<string>('');
    const [referralPos, setReferralPos] = useState<PointOfSale | null>(null);
    
    // Login State
    const [loginTab, setLoginTab] = useState<'general' | 'master'>('general');
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
    /** Cliente sin cuenta que quiere ver barberías: muestra lista para elegir una y registrarse ahí. */
    const [showBarberiasGuest, setShowBarberiasGuest] = useState(false);
    /** Invitado que está agendando cita en una barbería (sin cuenta). */
    const [guestBookingPos, setGuestBookingPos] = useState<{ id: number; name: string } | null>(null);
    /** Cita completada que se envía a facturación (Punto de Venta) */
    const [salesFromAppointment, setSalesFromAppointment] = useState<AppointmentForSale | null>(null);
    /** Plan de la sede activa: solo 'pro' muestra campana de notificaciones para el barbero */
    const [isPlanPro, setIsPlanPro] = useState(false);
    /** Tier de negocio de la sede activa: solo / barberia / multisede (menú y límites) */
    const [accountTier, setAccountTier] = useState<AccountTier>('barberia');
    /** En plan Multi-Sede: sedes del mismo owner para mostrar selector (solo si hay más de una) */
    const [posListForOwner, setPosListForOwner] = useState<PointOfSale[]>([]);
    /** Solo cliente: barbería preferida (QR/favoritos). Al iniciar sesión se abre esa barbería. */
    const [preferredPosId, setPreferredPosId] = useState<number | null>(null);
    /** Sede actual (para comprobar vencimiento de suscripción). */
    const [currentPos, setCurrentPos] = useState<PointOfSale | null>(null);

    const handleSwitchPos = async (posId: number): Promise<AccountTier> => {
        DataService.setActivePosId(posId);
        setCurrentPosId(posId);
        try {
            const posList = await DataService.getPointsOfSale();
            const pos = posList.find(p => p.id === posId) ?? null;
            try {
                setCurrentPos(pos);
                setCurrentPosName(pos ? pos.name : 'Desconocido');
                setIsPlanPro(pos?.plan === 'pro');
                setAccountTier(pos?.tier ?? 'barberia');
                if (pos?.tier === 'multisede' && pos.ownerId) {
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

    // Inicializar Google Play Billing en Android al arranque (verificación de compras).
    useEffect(() => {
        if (isPlayBillingAvailable()) initPlayBilling();
    }, []);

    // Plan Gratuito: no tiene acceso al Dashboard; redirigir a Agenda (superadmin puede ver todo)
    useEffect(() => {
        if (accountTier === 'gratuito' && currentView === 'dashboard' && userRole !== 'superadmin') {
            setCurrentView('appointments');
        }
    }, [accountTier, currentView, userRole]);

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
                if (!user) {
                    setShowLoginScreen(false);
                    setShowBarberiasGuest(false);
                    const params = new URLSearchParams(window.location.search);
                    const refPosId = params.get('ref_pos');
                    if (refPosId) {
                        const id = Number(refPosId);
                        setGuestBookingPos({ id, name: 'Cargando...' });
                        DataService.getPointsOfSale()
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
                if (!userData || typeof userData !== 'object' || !userData.role) {
                    localStorage.removeItem('currentUser');
                    setShowLoginScreen(false);
                    setShowBarberiasGuest(false);
                    setGuestBookingPos(null);
                    setIsLoadingSession(false);
                    return;
                }
                const role = userData.role === 'empleado' ? 'barbero' : userData.role;
                setIsAuthenticated(true);
                setUserRole(role);
                setFullName(userData.name);
                setUsername(userData.username ?? '');
                setUserPhotoUrl((userData as any).photoUrl ?? '');

                if (role === 'platform_owner') {
                    setCurrentView('master_dashboard');
                } else if (role === 'superadmin') {
                    const posList = await DataService.getPointsOfSale();
                    setPointsOfSale(posList);
                    if (posList.length > 0) await handleSwitchPos(posList[0].id);
                    setCurrentView('admin_pos');
                } else {
                    if (role === 'cliente') {
                        const preferred = await DataService.getClientPreferredPos(userData.username);
                        setPreferredPosId(preferred);
                        const params = new URLSearchParams(window.location.search);
                        const refPosId = params.get('ref_pos');
                        if (refPosId) {
                            const posList = await DataService.getPointsOfSale();
                            const found = posList.find(p => p.id === Number(refPosId));
                            if (found) {
                                await DataService.setClientPreferredPos(userData.username, found.id);
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
                            const posList = await DataService.getPointsOfSale();
                            const found = posList.find(p => p.id === preferred);
                            if (found) {
                                await handleSwitchPos(preferred);
                                setCurrentView('appointments');
                            } else {
                                await DataService.setClientPreferredPos(userData.username, null);
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
                        const assignedPosId = userData.posId;
                        const tier = assignedPosId ? await handleSwitchPos(assignedPosId) : 'barberia';
                        if (!assignedPosId) setAccountTier('barberia');
                        setCurrentView(tier === 'gratuito' ? 'appointments' : 'dashboard');
                    }
                }
            } catch (err) {
                console.error('Error al restaurar sesión:', err);
                setConnectionError('No se pudo conectar con la base de datos. Revisa tu conexión a internet y las reglas de Firebase.');
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
            setLoginError('La contraseña es requerida.');
            return;
        }
        setLoginLoading(true);
        let user: SystemUser | null = null;
        try {
            if (loginTab === 'master') {
                const result = await authenticateMasterWithPassword(trimmedUsername, passwordToUse);
                user = result.user as SystemUser;
                DataService.logAuditAction('master_login', 'master', 'Platform Owner Access').catch(() => {});
            } else {
                try {
                    user = await DataService.authenticate(trimmedUsername, passwordToUse);
                } catch (e) {
                    setLoginLoading(false);
                    if (e instanceof Error && e.message === 'NO_PASSWORD_SET') {
                        setLoginError('Este usuario no tiene contraseña. El administrador debe asignarla en Admin Usuarios.');
                    } else {
                        setLoginError(e instanceof Error ? e.message : 'Error de conexión. Revisa tu internet e intenta de nuevo.');
                    }
                    return;
                }
                if (!user) {
                    setLoginLoading(false);
                    setLoginError('Contraseña incorrecta.');
                    return;
                }
            }

                if (!user) {
                    setLoginLoading(false);
                    setLoginError('Usuario no encontrado o credenciales inválidas.');
                    return;
                }

                if (user.status === 'pending_payment') {
                    setLoginLoading(false);
                    setLoginError('Cuenta pendiente de pago. Completa el pago para activar tu barbería o crea una nueva con plan gratuito.');
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
                        DataService.getPointsOfSale(),
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
                    setLoginError('Usuario no tiene una Sede asignada. Contacte al administrador.');
                    setIsAuthenticated(false);
                    localStorage.removeItem('currentUser');
                }
            }
        } catch (err) {
            console.error('Error en login:', err);
            setLoginError('Error de conexión. Revisa tu internet o las reglas de Firebase Realtime Database e intenta de nuevo.');
        } finally {
            setLoginLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');
        const userTrim = (regUsername || '').trim().toLowerCase();
        const nameTrim = (regName || '').trim();
        const phoneTrim = (regPhone || '').trim().replace(/\D/g, '');
        if (!userTrim || !regPassword || !nameTrim) {
            setLoginError('Completa usuario, nombre y contraseña.');
            return;
        }
        if (phoneTrim.length < 8) {
            setLoginError('Ingresa un teléfono válido (al menos 8 dígitos).');
            return;
        }
        try {
            const existing = await DataService.findUserByUsername(userTrim);
            if (existing) {
                setLoginError('El usuario ya existe. Elige otro o inicia sesión.');
                return;
            }
            const targetPosId = referralPos ? referralPos.id : 1;
            const prevPosId = DataService.getActivePosId();
            DataService.setActivePosId(targetPosId);
            const client = await DataService.addClientOrGetExisting({
                nombre: nameTrim,
                telefono: regPhone.trim(),
                email: `${userTrim}@example.com`,
                notas: referralPos ? `Registrado vía QR en ${referralPos.name}` : 'Registro Autoservicio Web',
                fechaRegistro: new Date().toISOString().split('T')[0],
                puntos: 0,
                status: 'active',
                whatsappOptIn: true,
                ultimaVisita: 'N/A'
            });
            const newUser: SystemUser = { username: userTrim, password: regPassword, name: nameTrim, role: 'cliente', posId: targetPosId, clientId: client.id };
            await DataService.saveUser(newUser);
            await DataService.setClientPreferredPos(userTrim, targetPosId);
            DataService.setActivePosId(prevPosId);
            setRegSuccess(true);
            setTimeout(() => {
                setRegSuccess(false);
                setIsRegistering(false);
                setUsername(userTrim);
                setPassword('');
                setLoginError('Registro exitoso. Por favor inicie sesión.');
            }, 2000);
        } catch (err) {
            console.error('Error en registro:', err);
            const msg = err instanceof Error ? err.message : String(err);
            setLoginError(msg.includes('conexión') || msg.includes('permiso') ? msg : `No se pudo completar el registro. ${msg}`);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('currentUser');
        setIsAuthenticated(false);
        setUsername('');
        setPassword('');
        setLoginError('');
        setCurrentView('dashboard');
        DataService.setActivePosId(null);
        setCurrentPosId(null);
    };

    const acceptCookies = () => {
        localStorage.setItem('acceptedCookies', 'true');
        setAcceptedCookies(true);
    };

    const handleClientPosSwitch = async (id: number) => {
        const currentUser = DataService.getCurrentUser();
        if (currentUser?.username && (currentUser.role === 'cliente' || (currentUser as any).role === 'cliente')) {
            await DataService.setClientPreferredPos(currentUser.username, id);
            setPreferredPosId(id);
        }
        await handleSwitchPos(id);
        setCurrentView('appointments');
        window.history.replaceState({}, '', `${window.location.pathname}?ref_pos=${id}`);
    };

    /** Al volver a Descubrir Barberías, el cliente debe limpiar la barbería seleccionada y la URL. */
    const handleChangeView = (view: ViewState) => {
        if (userRole === 'cliente' && view === 'client_discovery') {
            DataService.setActivePosId(null);
            setCurrentPosId(null);
            setCurrentPosName('');
            DataService.clearCart();
            window.history.replaceState({}, '', window.location.pathname);
        }
        setCurrentView(view);
    };

    const renderView = () => {
        // Force re-render when POS changes: key must be passed directly to JSX, not spread
        const k = currentPosId;
        const planProps = { accountTier };
        switch (currentView) {
            case 'admin_pos': return <AdminPOS key={k} />;
            case 'dashboard': return <Dashboard key={k} onChangeView={setCurrentView} />;
            case 'sales': return <Sales key={k} salesFromAppointment={salesFromAppointment} onClearSalesFromAppointment={() => setSalesFromAppointment(null)} {...planProps} />;
            case 'shop': return <Shop key={k} />;
            case 'appointments': return <Appointments key={k} onChangeView={setCurrentView} onCompleteForBilling={(data) => { setSalesFromAppointment(data); setCurrentView('sales'); }} {...planProps} />;
            case 'clients': return <Clients key={k} />;
            case 'inventory': return <Inventory key={k} />;
            case 'finance': return <Finance key={k} />;
            case 'reports': return <Reports key={k} accountTier={accountTier} posListForOwner={accountTier === 'multisede' ? posListForOwner : []} />;
            case 'sales_records': return <SalesRecords key={k} accountTier={accountTier} />;
            case 'settings': return <Settings key={k} {...planProps} />;
            case 'calendar': return <CalendarView key={k} />;
            case 'whatsapp_console': return <WhatsAppConsole key={k} />;
            case 'user_admin': return <UserAdmin key={k} />;
            case 'client_discovery': return <ClientDiscovery key={k} onSwitchPos={handleClientPosSwitch} preferredPosId={preferredPosId} onRemoveFavorite={async () => { const u = DataService.getCurrentUser(); if (u?.username) { await DataService.setClientPreferredPos(u.username, null); setPreferredPosId(null); } }} />;
            case 'client_profile': return <ClientProfile key={k} onChangeView={setCurrentView} onProfileUpdated={() => { const u = DataService.getCurrentUser(); if (u) { setFullName(u.name ?? fullName); setUserPhotoUrl(u.photoUrl ?? ''); } }} />;
            case 'qr_scanner': return null;
            default: return <Dashboard key={k} onChangeView={setCurrentView} />;
        }
    };

    // --- RENDER ---

    // 1. MASTER DASHBOARD RENDER (No sidebar, full screen exclusive)
    if (isAuthenticated && userRole === 'platform_owner') {
        return (
            <Suspense fallback={<ViewFallback />}>
                <MasterDashboard onLogout={handleLogout} />
            </Suspense>
        );
    }

    // 2. SUSCRIPCIÓN VENCIDA (admin/dueno/barbero con sede vencida)
    if (isAuthenticated && isSubscriptionExpired && currentPos) {
        const expiresAt = currentPos.subscriptionExpiresAt;
        const expiryDate = expiresAt ? new Date(expiresAt).toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
        return (
            <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col items-center justify-center p-6 text-white">
                <div className="max-w-md w-full text-center space-y-6">
                    <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto">
                        <Shield size={32} className="text-amber-400" />
                    </div>
                    <h1 className="text-2xl font-bold">Suscripción vencida</h1>
                    <p className="text-slate-300">
                        La suscripción de <strong className="text-white">{currentPosName || currentPos.name}</strong> venció{expiryDate ? ` el ${expiryDate}` : ''}. Renueva para seguir usando BarberShow.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <button
                            type="button"
                            onClick={() => { setIsAuthenticated(false); setShowLoginScreen(false); setUsername(''); setPassword(''); }}
                            className="px-6 py-3 bg-[#ffd427] text-slate-900 font-semibold rounded-xl hover:bg-amber-400 transition-colors"
                        >
                            Renovar ahora
                        </button>
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="px-6 py-3 border border-slate-500 text-slate-300 rounded-xl hover:bg-slate-700/50 transition-colors"
                        >
                            Cerrar sesión
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // 3. LOADING (restaurando sesión)
    if (!isAuthenticated && isLoadingSession) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
                <div className="text-center text-white">
                    <div className="w-16 h-16 border-4 border-[#ffd427] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-lg font-medium">Cargando BarberShow...</p>
                </div>
            </div>
        );
    }

    // 3. INVITADO: Agendar cita sin cuenta (desde QR o tras elegir barbería)
    if (!isAuthenticated && guestBookingPos) {
        return (
            <div className="min-h-screen min-h-[100dvh] bg-slate-100 p-4 md:p-8 overflow-x-hidden">
                <GuestBookingView
                    posId={guestBookingPos.id}
                    posName={guestBookingPos.name}
                    onBack={() => setGuestBookingPos(null)}
                    onSuccess={() => setGuestBookingPos(null)}
                />
            </div>
        );
    }

    // 4. INVITADO: Ver barberías (cliente buscando barbería)
    if (!isAuthenticated && showBarberiasGuest) {
        return (
            <div className="min-h-screen min-h-[100dvh] bg-slate-100">
                <header className="bg-slate-900 text-white px-3 sm:px-4 py-3 flex items-center justify-between shadow-lg">
                    <button type="button" onClick={() => setShowBarberiasGuest(false)} className="flex items-center gap-1.5 min-h-[44px] text-slate-300 hover:text-white text-sm rounded-lg active:bg-white/10 px-2 -ml-2">
                        <ArrowLeft size={18} /> Volver
                    </button>
                    <span className="font-bold text-[#ffd427]">BarberShow</span>
                    <button type="button" onClick={() => { setShowBarberiasGuest(false); setShowLoginScreen(true); }} className="min-h-[44px] flex items-center text-sm text-[#ffd427] hover:text-amber-300 font-medium px-2 rounded-lg active:bg-white/10">
                        Iniciar sesión
                    </button>
                </header>
                <main className="p-4 md:p-8 max-w-6xl mx-auto">
                    <p className="text-slate-600 text-center mb-2">Elige una barbería para agendar tu cita (sin cuenta) o registrarte.</p>
                    <p className="text-slate-400 text-center text-sm mb-6">Próximamente: ver barberías más cercanas a tu ubicación.</p>
                    <Suspense fallback={<ViewFallback />}>
                    <ClientDiscovery
                        guestMode
                        onSwitchPos={(id) => {
                            DataService.getPointsOfSale().then((list) => {
                                const pos = list.find(p => p.id === id);
                                if (pos) {
                                    setReferralPos(pos);
                                    setShowLoginScreen(true);
                                    setShowBarberiasGuest(false);
                                    setIsRegistering(true);
                                    window.history.replaceState({}, '', `${window.location.pathname}?ref_pos=${id}`);
                                }
                            });
                        }}
                        onBookAppointment={(id, name) => setGuestBookingPos({ id, name })}
                    />
                    </Suspense>
                </main>
            </div>
        );
    }

    // 5. BIENVENIDA (tipo de barbería + contacto) o LOGIN
    if (!isAuthenticated) {
        if (!showLoginScreen) {
            return (
                <WelcomePlanSelector
                    onGoToLogin={() => { setShowLoginScreen(true); setIsRegistering(false); }}
                    onGoToBarberias={() => setShowBarberiasGuest(true)}
                    onBarberSignupSuccess={(username, password) => {
                        handleLogin({ preventDefault: () => {} } as React.FormEvent, { username, password });
                    }}
                />
            );
        }
        return (
            <div className="min-h-screen min-h-[100dvh] bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-4 sm:p-6 md:p-8 relative overflow-hidden border-t-8 border-[#ffd427] my-2 sm:my-4">
                    <button
                        type="button"
                        onClick={() => setShowLoginScreen(false)}
                        className="absolute top-3 left-3 sm:top-4 sm:left-4 flex items-center justify-center gap-1.5 min-h-[44px] pl-2 pr-3 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 active:bg-slate-200 text-sm"
                    >
                        <ArrowLeft size={18} /> Volver
                    </button>
                    {connectionError && (
                        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                            {connectionError}
                        </div>
                    )}
                    {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('signup') === 'success' && (
                        <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-sm flex items-center gap-2">
                            <CheckCircle size={20} className="flex-shrink-0" />
                            <span>Cuenta activada. Inicia sesión con tu usuario y contraseña.</span>
                        </div>
                    )}
                    {/* Header */}
                    <div className="text-center mb-6 relative z-10">
                        <div className="w-16 h-16 bg-[#ffd427] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-yellow-500/20">
                            <Scissors size={32} className="text-slate-900" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900">BarberShow</h1>
                        <p className="text-slate-500">Sistema Multi-Sede</p>
                        <p className="text-slate-400 text-xs mt-1">v1.0.7</p>
                    </div>

                    {isRegistering ? (
                         <form onSubmit={handleRegister} className="space-y-4 animate-in slide-in-from-right duration-300">
                             {loginError && (
                                 <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">
                                     {loginError}
                                 </div>
                             )}
                             {referralPos && (
                                 <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center mb-4">
                                     <MapPin size={20} className="text-[#ffd427] mr-2" />
                                     <div>
                                         <p className="text-xs text-yellow-800 uppercase font-bold">Registrándose en:</p>
                                         <p className="font-bold text-slate-800">{referralPos.name}</p>
                                     </div>
                                 </div>
                             )}
                             
                             {regSuccess ? (
                                 <div className="bg-green-50 text-green-700 p-6 rounded-xl flex flex-col items-center justify-center text-center">
                                     <CheckCircle size={48} className="mb-2" />
                                     <h3 className="font-bold text-lg">¡Cuenta Creada!</h3>
                                     <p>Redirigiendo al login...</p>
                                 </div>
                             ) : (
                                 <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Usuario</label>
                                            <input type="text" required className="w-full px-4 py-2 border rounded-lg focus:ring-[#ffd427]" value={regUsername} onChange={e => setRegUsername(e.target.value)} />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                                            <input type="text" required className="w-full px-4 py-2 border rounded-lg focus:ring-[#ffd427]" value={regName} onChange={e => setRegName(e.target.value)} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono (WhatsApp)</label>
                                        <input type="tel" required className="w-full px-4 py-2 border rounded-lg focus:ring-[#ffd427]" value={regPhone} onChange={e => setRegPhone(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
                                        <input type="password" required className="w-full px-4 py-2 border rounded-lg focus:ring-[#ffd427]" value={regPassword} onChange={e => setRegPassword(e.target.value)} />
                                    </div>
                                    <button type="submit" className="w-full min-h-[48px] bg-[#ffd427] text-slate-900 py-3 rounded-xl font-bold hover:bg-[#e6be23] transition-colors shadow-lg mt-4 active:scale-[0.98]">
                                        Registrarse
                                    </button>
                                    <button type="button" onClick={() => setIsRegistering(false)} className="w-full min-h-[44px] text-slate-500 py-2 text-sm flex items-center justify-center hover:text-slate-700 active:bg-slate-100 rounded-lg">
                                        <ArrowLeft size={14} className="mr-1" /> Volver al Login
                                    </button>
                                 </>
                             )}
                         </form>
                    ) : (
                        <div className="space-y-4">
                            {/* Tabs */}
                            <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
                                <button 
                                    type="button"
                                    className={`flex-1 min-h-[44px] py-2.5 text-sm font-bold rounded-lg transition-colors ${loginTab === 'general' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                                    onClick={() => { setLoginTab('general'); setLoginError(''); }}
                                >
                                    Acceso General
                                </button>
                                <button 
                                    type="button"
                                    className={`flex-1 min-h-[44px] py-2.5 text-sm font-bold rounded-lg transition-colors ${loginTab === 'master' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}
                                    onClick={() => { setLoginTab('master'); setLoginError(''); }}
                                >
                                    Master Admin
                                </button>
                            </div>

                            <form onSubmit={handleLogin} className="space-y-4 animate-in slide-in-from-left duration-300">
                                {loginError && (
                                    <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">
                                        {loginError}
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Usuario {loginTab === 'master' && '(Master)'}</label>
                                    <input 
                                        type="text" 
                                        className="w-full px-4 py-3 sm:py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffd427]"
                                        value={username}
                                        onChange={e => setUsername(e.target.value)}
                                        placeholder={loginTab === 'general' ? "Ej: barbero, cliente" : "master"}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña</label>
                                    <input 
                                        type="password" 
                                        className="w-full px-4 py-3 sm:py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffd427]"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder={loginTab === 'general' ? "pass: 123" : "root"}
                                        required
                                    />
                                </div>
                                
                                <button type="submit" disabled={loginLoading} className={`w-full min-h-[48px] py-3 rounded-xl font-bold transition-colors shadow-lg shadow-yellow-500/30 mt-4 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98] ${loginTab === 'master' ? 'bg-slate-900 text-white hover:bg-slate-700' : 'bg-[#ffd427] text-slate-900 hover:bg-[#e6be23]'}`}>
                                    {loginLoading ? (<><Loader2 size={20} className="animate-spin" /> Iniciando sesión...</>) : (loginTab === 'master' ? 'Acceder al Sistema Maestro' : 'Iniciar Sesión')}
                                </button>

                                {loginTab === 'general' && (
                                    <div className="pt-4 border-t border-slate-100 mt-4">
                                        <button type="button" onClick={() => setIsRegistering(true)} className="w-full min-h-[44px] flex items-center justify-center text-slate-600 font-medium hover:underline hover:text-[#e6be23] rounded-lg active:bg-slate-50">
                                            <UserPlus size={18} className="mr-2" /> ¿No tienes cuenta? Regístrate
                                        </button>
                                    </div>
                                )}

                            </form>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // 4. CLIENTE: Lector QR (pantalla completa con cámara)
    if (isAuthenticated && userRole === 'cliente' && currentView === 'qr_scanner') {
        return (
            <QRScannerView
                onBack={() => setCurrentView('client_discovery')}
                onScan={async (posId) => {
                    await handleSwitchPos(posId);
                    setCurrentView('appointments');
                    window.history.replaceState({}, '', `${window.location.pathname}?ref_pos=${posId}`);
                }}
            />
        );
    }

    // 5. MAIN APP RENDER (General Users)
    const showWebAds = accountTier === 'gratuito' || userRole === 'cliente';
    return (
        <div className="flex h-screen min-h-0 max-h-[100dvh] bg-slate-100 font-sans overflow-hidden">
            <AdMobBanner accountTier={accountTier} />
            <Sidebar 
                currentView={currentView} 
                onChangeView={handleChangeView} 
                onLogout={handleLogout}
                userRole={userRole}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                clientHasSelectedBarberia={userRole === 'cliente' ? currentPosId != null : true}
                accountTier={accountTier}
                preferredPosId={userRole === 'cliente' ? preferredPosId : null}
                currentPosId={userRole === 'cliente' ? currentPosId : null}
                onRemoveFavorite={userRole === 'cliente' ? async () => { const u = DataService.getCurrentUser(); if (u?.username) { await DataService.setClientPreferredPos(u.username, null); setPreferredPosId(null); } } : undefined}
            />
            {/* Área principal: flex para que el scroll sea solo en el contenido */}
            <main className="flex-1 flex flex-col min-w-0 min-h-0 md:ml-64 overflow-hidden transition-all duration-300">
                <header className="flex-shrink-0 flex flex-wrap justify-between items-center p-3 sm:p-4 md:p-6 lg:p-8 pb-2 md:pb-4 no-print gap-2 sm:gap-3 bg-slate-100">
                    <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4 min-w-0">
                        {/* Hamburger Button for Mobile - touch target 44px */}
                        <button 
                            className="md:hidden flex items-center justify-center min-h-[44px] min-w-[44px] text-slate-700 p-2 bg-white rounded-xl shadow-sm active:bg-slate-100"
                            onClick={() => setIsSidebarOpen(true)}
                            aria-label="Abrir menú"
                        >
                            <Menu size={24} />
                        </button>

                        <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 capitalize truncate max-w-[140px] sm:max-w-[200px] md:max-w-none">
                            {currentView === 'shop' ? 'Tienda Online' : 
                             currentView === 'sales' ? 'Punto de Venta' : 
                             currentView === 'admin_pos' ? 'Gestión Global' :
                             currentView === 'client_discovery' ? 'Barberías' :
                             currentView === 'qr_scanner' ? 'Escanear QR' :
                             currentView === 'sales_records' ? 'Registros de cortes' :
                             currentView.replace('_', ' ')}
                        </h1>
                        
                        {/* SuperAdmin Global Selector */}
                        {userRole === 'superadmin' && (
                            <div className="hidden md:flex items-center bg-slate-800 text-white px-3 py-1.5 rounded-lg shadow-md ml-4 border border-slate-700">
                                <Globe size={16} className="text-[#ffd427] mr-2" />
                                <span className="text-xs text-slate-400 mr-2 uppercase tracking-wider font-bold">Viendo Sede:</span>
                                <select 
                                    value={currentPosId || ''} 
                                    onChange={(e) => handleSwitchPos(Number(e.target.value))}
                                    className="bg-slate-900 border-none text-white text-sm font-bold focus:ring-0 cursor-pointer rounded"
                                >
                                    {pointsOfSale.map(pos => (
                                        <option key={pos.id} value={pos.id}>{pos.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {/* Multi-Sede: selector de sede cuando el usuario tiene varias sedes (mismo owner) */}
                        {accountTier === 'multisede' && posListForOwner.length > 1 && userRole !== 'superadmin' && (
                            <div className="hidden md:flex items-center bg-slate-800 text-white px-3 py-1.5 rounded-lg shadow-md ml-4 border border-slate-700">
                                <MapPin size={16} className="text-[#ffd427] mr-2" />
                                <span className="text-xs text-slate-400 mr-2 uppercase tracking-wider font-bold">Sede:</span>
                                <select 
                                    value={currentPosId || ''} 
                                    onChange={(e) => handleSwitchPos(Number(e.target.value))}
                                    className="bg-slate-900 border-none text-white text-sm font-bold focus:ring-0 cursor-pointer rounded"
                                >
                                    {posListForOwner.map(pos => (
                                        <option key={pos.id} value={pos.id}>{pos.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        
                        {/* Tenant Label: en plan Solo "Mi negocio", en Barbería/Multi-Sede nombre de la sede */}
                        {userRole !== 'superadmin' && userRole !== 'platform_owner' && (
                            <div className="hidden md:flex items-center bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-200">
                                <MapPin size={14} className="text-[#ffd427] mr-2" />
                                <span className="text-sm font-bold text-slate-700">
                                    {accountTier === 'solo' ? 'Mi negocio' : currentPosName}
                                </span>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex items-center space-x-2 md:space-x-4">
                        {/* Campana de notificaciones (solo Plan Pro, barbero/admin) */}
                        <BarberNotificationBell
                            isPlanPro={isPlanPro}
                            userRole={userRole}
                            onChangeView={setCurrentView}
                        />
                        <div className="text-right hidden md:block">
                            <p className="text-sm font-bold text-slate-800">{fullName || username}</p>
                            <p className="text-xs text-slate-500 capitalize">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                        </div>
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-tr from-[#ffd427] to-amber-500 rounded-full flex items-center justify-center text-slate-900 font-bold border-2 border-white shadow-md overflow-hidden shrink-0">
                            {userPhotoUrl ? (
                                <img src={userPhotoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                                (username || fullName).charAt(0).toUpperCase() || '?'
                            )}
                        </div>
                        
                        {/* Extra Logout Button in Header */}
                        <button 
                            type="button"
                            onClick={handleLogout} 
                            className="flex items-center justify-center min-h-[44px] min-w-[44px] bg-white p-2 rounded-full text-slate-500 hover:text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors shadow-sm border border-slate-200"
                            title="Cerrar Sesión"
                            aria-label="Cerrar sesión"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </header>
                
                {/* Zona con scroll: única área que hace scroll */}
                <div className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto scroll-touch scroll-area-mobile px-3 sm:px-4 md:px-6 lg:px-8 pb-6">
                    {/* Mobile Tenant Selector (Superadmin o Multi-Sede con varias sedes) */}
                    {userRole === 'superadmin' && (
                        <div className="md:hidden mb-4">
                             <div className="flex items-center bg-slate-800 text-white px-3 py-2 rounded-lg shadow-md border border-slate-700 w-full">
                                <Globe size={16} className="text-[#ffd427] mr-2" />
                                <select 
                                    value={currentPosId || ''} 
                                    onChange={(e) => handleSwitchPos(Number(e.target.value))}
                                    className="bg-slate-900 border-none text-white text-sm font-bold focus:ring-0 cursor-pointer rounded w-full"
                                >
                                    {pointsOfSale.map(pos => (
                                        <option key={pos.id} value={pos.id}>{pos.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                    {accountTier === 'multisede' && posListForOwner.length > 1 && userRole !== 'superadmin' && (
                        <div className="md:hidden mb-4">
                            <div className="flex items-center bg-slate-800 text-white px-3 py-2 rounded-lg shadow-md border border-slate-700 w-full">
                                <MapPin size={16} className="text-[#ffd427] mr-2" />
                                <select 
                                    value={currentPosId || ''} 
                                    onChange={(e) => handleSwitchPos(Number(e.target.value))}
                                    className="bg-slate-900 border-none text-white text-sm font-bold focus:ring-0 cursor-pointer rounded w-full"
                                >
                                    {posListForOwner.map(pos => (
                                        <option key={pos.id} value={pos.id}>{pos.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                    <div className="responsive-container">
                        <Suspense fallback={<ViewFallback />}>
                            {renderView()}
                        </Suspense>
                    </div>
                    <AdSenseBanner show={showWebAds} />
                </div>
            </main>

            {/* Cookie Consent Banner */}
            {!acceptedCookies && (
                <div className="fixed bottom-0 left-0 right-0 w-full bg-slate-900 text-white p-4 z-50 shadow-2xl animate-in slide-in-from-bottom duration-500 safe-area-bottom">
                    <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center space-x-3">
                            <Cookie className="text-[#ffd427]" size={24} />
                            <p className="text-sm">
                                Usamos cookies para asegurar que tengas la mejor experiencia en nuestro sistema. 
                                Al continuar navegando, aceptas nuestra política de privacidad.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <button type="button" onClick={() => setCurrentView('settings')} className="min-h-[44px] px-4 flex items-center text-slate-300 hover:text-white text-sm underline rounded-lg active:bg-white/10">Ver Política</button>
                            <button type="button" onClick={acceptCookies} className="min-h-[44px] bg-[#ffd427] hover:bg-[#e6be23] text-slate-900 px-6 py-2.5 rounded-full text-sm font-bold transition-colors active:scale-[0.98]">
                                Aceptar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default App;
