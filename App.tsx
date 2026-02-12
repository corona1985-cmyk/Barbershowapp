
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Shop from './pages/Shop';
import Appointments from './pages/Appointments';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import AdminPOS from './pages/AdminPOS';
import CalendarView from './pages/CalendarView';
import WhatsAppConsole from './pages/WhatsAppConsole';
import UserAdmin from './pages/UserAdmin';
import ClientDiscovery from './pages/ClientDiscovery';
import MasterDashboard from './pages/MasterDashboard';
import { Clients, Inventory, Finance } from './pages/InventoryClientsFinance';
import { ViewState, UserRole, PointOfSale, SystemUser, AppointmentForSale } from './types';
import { Scissors, Cookie, MapPin, Globe, LogOut, Menu, UserPlus, CheckCircle, ArrowLeft, Shield } from 'lucide-react';
import { DataService } from './services/data';
import { authenticateMasterWithPassword } from './services/firebase';

const App: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentView, setCurrentView] = useState<ViewState>('dashboard');
    const [userRole, setUserRole] = useState<UserRole>('admin');
    const [fullName, setFullName] = useState('');
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
    
    // Registration State
    const [isRegistering, setIsRegistering] = useState(false);
    const [regName, setRegName] = useState('');
    const [regUsername, setRegUsername] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regPhone, setRegPhone] = useState('');
    const [regSuccess, setRegSuccess] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [isLoadingSession, setIsLoadingSession] = useState(true);
    /** Cita completada que se envía a facturación (Punto de Venta) */
    const [salesFromAppointment, setSalesFromAppointment] = useState<AppointmentForSale | null>(null);

    const handleSwitchPos = async (posId: number) => {
        DataService.setActivePosId(posId);
        setCurrentPosId(posId);
        try {
            const posList = await DataService.getPointsOfSale();
            const pos = posList.find(p => p.id === posId);
            setCurrentPosName(pos ? pos.name : 'Desconocido');
        } catch {
            setCurrentPosName('Desconocido');
        }
    };

    useEffect(() => {
        const user = localStorage.getItem('currentUser');
        const cookies = localStorage.getItem('acceptedCookies');
        if (cookies) setAcceptedCookies(true);
        setConnectionError(null);

        (async () => {
            try {
                if (!user) {
                    const params = new URLSearchParams(window.location.search);
                    const refPosId = params.get('ref_pos');
                    if (refPosId) {
                        const posList = await DataService.getPointsOfSale();
                        const found = posList.find(p => p.id === Number(refPosId));
                        if (found) {
                            setReferralPos(found);
                            setIsRegistering(true);
                        }
                    }
                    return;
                }
                const userData = JSON.parse(user);
                const role = userData.role === 'empleado' ? 'barbero' : userData.role;
                setIsAuthenticated(true);
                setUserRole(role);
                setFullName(userData.name);

                if (role === 'platform_owner') {
                    setCurrentView('master_dashboard');
                } else if (role === 'superadmin') {
                    const posList = await DataService.getPointsOfSale();
                    setPointsOfSale(posList);
                    if (posList.length > 0) await handleSwitchPos(posList[0].id);
                    setCurrentView('admin_pos');
                } else {
                    if (role === 'cliente') {
                        DataService.setActivePosId(null);
                        setCurrentPosId(null);
                        setCurrentPosName('');
                        setCurrentView('client_discovery');
                    } else {
                        const assignedPosId = userData.posId;
                        if (assignedPosId) await handleSwitchPos(assignedPosId);
                        setCurrentView('dashboard');
                    }
                }
            } catch (err) {
                console.error('Error al restaurar sesión:', err);
                setConnectionError('No se pudo conectar con la base de datos. Revisa tu conexión a internet y las reglas de Firebase.');
            } finally {
                setIsLoadingSession(false);
            }
        })();
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError('');
        setConnectionError(null);
        const trimmedUsername = username.trim();
        if (!password.trim()) {
            setLoginError('La contraseña es requerida.');
            return;
        }
        let user: SystemUser | null = null;
        try {
            if (loginTab === 'master') {
                const result = await authenticateMasterWithPassword(trimmedUsername, password);
                user = result.user as SystemUser;
                await DataService.logAuditAction('master_login', 'master', 'Platform Owner Access');
            } else {
                user = await DataService.authenticate(trimmedUsername);
                if (user) {
                    if (user.password === undefined || user.password === null || user.password === '') {
                        setLoginError('Este usuario no tiene contraseña. El administrador debe asignarla en Admin Usuarios.');
                        return;
                    }
                    if (user.password !== password) {
                        setLoginError('Contraseña incorrecta.');
                        return;
                    }
                }
            }

            if (!user) {
                setLoginError('Usuario no encontrado o credenciales inválidas.');
                return;
            }

            const role = user.role === 'empleado' ? 'barbero' : user.role;
            const userData = { username: user.username, role, name: user.name, posId: user.posId, barberId: (user as any).barberId, loginTime: new Date().toISOString() };
            localStorage.setItem('currentUser', JSON.stringify(userData));
            setIsAuthenticated(true);
            setUserRole(role);
            setFullName(user.name);

            if (role === 'platform_owner') setCurrentView('master_dashboard');
            else if (role === 'superadmin') {
                const posList = await DataService.getPointsOfSale();
                setPointsOfSale(posList);
                if (posList.length > 0) await handleSwitchPos(posList[0].id);
                setCurrentView('admin_pos');
            } else {
                if (role === 'cliente') {
                    DataService.setActivePosId(null);
                    setCurrentPosId(null);
                    setCurrentPosName('');
                    setCurrentView('client_discovery');
                } else if (user.posId != null) {
                    await handleSwitchPos(user.posId);
                    setCurrentView('dashboard');
                } else {
                    setLoginError('Usuario no tiene una Sede asignada. Contacte al administrador.');
                    setIsAuthenticated(false);
                    localStorage.removeItem('currentUser');
                }
            }
        } catch (err) {
            console.error('Error en login:', err);
            setLoginError('Error de conexión. Revisa tu internet o las reglas de Firebase Realtime Database e intenta de nuevo.');
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!regUsername || !regPassword || !regName) return;
        const existing = await DataService.authenticate(regUsername);
        if (existing) {
            setLoginError('El usuario ya existe');
            return;
        }
        const targetPosId = referralPos ? referralPos.id : 1;
        const newUser: SystemUser = { username: regUsername, password: regPassword, name: regName, role: 'cliente', posId: targetPosId };
        const prevPosId = DataService.getActivePosId();
        DataService.setActivePosId(targetPosId);
        await DataService.saveUser(newUser);
        await DataService.addClient({
            nombre: regName,
            telefono: regPhone,
            email: `${regUsername}@example.com`,
            notas: referralPos ? `Registrado vía QR en ${referralPos.name}` : 'Registro Autoservicio Web',
            fechaRegistro: new Date().toISOString().split('T')[0],
            puntos: 0,
            status: 'active',
            whatsappOptIn: true,
            ultimaVisita: 'N/A'
        });
        DataService.setActivePosId(prevPosId);
        setRegSuccess(true);
        setTimeout(() => {
            setRegSuccess(false);
            setIsRegistering(false);
            setUsername(regUsername);
            setPassword('');
            setLoginError('Registro exitoso. Por favor inicie sesión.');
        }, 2000);
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

    const handleClientPosSwitch = (id: number) => {
        handleSwitchPos(id);
        setCurrentView('shop');
    };

    const renderView = () => {
        // Force re-render when POS changes using key
        const viewProps = { key: currentPosId }; 
        
        switch (currentView) {
            case 'admin_pos': return <AdminPOS {...viewProps} />;
            case 'dashboard': return <Dashboard onChangeView={setCurrentView} {...viewProps} />;
            case 'sales': return <Sales salesFromAppointment={salesFromAppointment} onClearSalesFromAppointment={() => setSalesFromAppointment(null)} {...viewProps} />;
            case 'shop': return <Shop {...viewProps} />;
            case 'appointments': return <Appointments onChangeView={setCurrentView} onCompleteForBilling={(data) => { setSalesFromAppointment(data); setCurrentView('sales'); }} {...viewProps} />;
            case 'clients': return <Clients {...viewProps} />;
            case 'inventory': return <Inventory {...viewProps} />;
            case 'finance': return <Finance {...viewProps} />;
            case 'reports': return <Reports {...viewProps} />;
            case 'settings': return <Settings {...viewProps} />;
            case 'calendar': return <CalendarView {...viewProps} />;
            case 'whatsapp_console': return <WhatsAppConsole {...viewProps} />;
            case 'user_admin': return <UserAdmin {...viewProps} />;
            case 'client_discovery': return <ClientDiscovery onSwitchPos={handleClientPosSwitch} />;
            default: return <Dashboard onChangeView={setCurrentView} {...viewProps} />;
        }
    };

    // --- RENDER ---

    // 1. MASTER DASHBOARD RENDER (No sidebar, full screen exclusive)
    if (isAuthenticated && userRole === 'platform_owner') {
        return <MasterDashboard onLogout={handleLogout} />;
    }

    // 2. LOADING (restaurando sesión)
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

    // 3. LOGIN SCREEN
    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative overflow-hidden border-t-8 border-[#ffd427]">
                    {connectionError && (
                        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
                            {connectionError}
                        </div>
                    )}
                    {/* Header */}
                    <div className="text-center mb-6 relative z-10">
                        <div className="w-16 h-16 bg-[#ffd427] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-yellow-500/20">
                            <Scissors size={32} className="text-slate-900" />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900">BarberShow</h1>
                        <p className="text-slate-500">Sistema Multi-Sede</p>
                    </div>

                    {isRegistering ? (
                         <form onSubmit={handleRegister} className="space-y-4 animate-in slide-in-from-right duration-300">
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
                                    <div className="grid grid-cols-2 gap-4">
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
                                    <button type="submit" className="w-full bg-[#ffd427] text-slate-900 py-3 rounded-lg font-bold hover:bg-[#e6be23] transition-colors shadow-lg mt-4">
                                        Registrarse
                                    </button>
                                    <button type="button" onClick={() => setIsRegistering(false)} className="w-full text-slate-500 py-2 text-sm flex items-center justify-center hover:text-slate-700">
                                        <ArrowLeft size={14} className="mr-1" /> Volver al Login
                                    </button>
                                 </>
                             )}
                         </form>
                    ) : (
                        <div className="space-y-4">
                            {/* Tabs */}
                            <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
                                <button 
                                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${loginTab === 'general' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
                                    onClick={() => { setLoginTab('general'); setLoginError(''); }}
                                >
                                    Acceso General
                                </button>
                                <button 
                                    className={`flex-1 py-2 text-sm font-bold rounded-md transition-colors ${loginTab === 'master' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}
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
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffd427]"
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
                                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#ffd427]"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder={loginTab === 'general' ? "pass: 123" : "root"}
                                        required
                                    />
                                </div>
                                
                                <button type="submit" className={`w-full py-3 rounded-lg font-bold transition-colors shadow-lg shadow-yellow-500/30 mt-4 ${loginTab === 'master' ? 'bg-slate-900 text-white hover:bg-slate-700' : 'bg-[#ffd427] text-slate-900 hover:bg-[#e6be23]'}`}>
                                    {loginTab === 'master' ? 'Acceder al Sistema Maestro' : 'Iniciar Sesión'}
                                </button>

                                {loginTab === 'general' && (
                                    <div className="pt-4 border-t border-slate-100 mt-4">
                                        <button type="button" onClick={() => setIsRegistering(true)} className="w-full flex items-center justify-center text-slate-600 font-medium hover:underline hover:text-[#e6be23]">
                                            <UserPlus size={18} className="mr-2" /> ¿No tienes cuenta? Regístrate
                                        </button>
                                    </div>
                                )}

                                {loginTab === 'general' && (
                                    <div className="text-xs text-center text-slate-400 mt-4 space-y-1">
                                        <p><strong>SuperAdmin:</strong> superadmin / admin</p>
                                        <p><strong>Sede 1:</strong> barbero / 123</p>
                                    </div>
                                )}
                            </form>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // 4. MAIN APP RENDER (General Users)
    return (
        <div className="flex min-h-screen bg-slate-100 font-sans">
            <Sidebar 
                currentView={currentView} 
                onChangeView={setCurrentView} 
                onLogout={handleLogout}
                userRole={userRole}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />
            {/* Adjusted margin to be responsive: ml-0 on mobile, ml-64 on desktop */}
            <main className="flex-1 md:ml-64 p-4 md:p-8 overflow-y-auto h-screen transition-all duration-300">
                <header className="flex justify-between items-center mb-6 md:mb-8 no-print gap-3">
                    <div className="flex items-center space-x-3 md:space-x-4">
                        {/* Hamburger Button for Mobile */}
                        <button 
                            className="md:hidden text-slate-700 p-2 bg-white rounded-lg shadow-sm"
                            onClick={() => setIsSidebarOpen(true)}
                        >
                            <Menu size={24} />
                        </button>

                        <h1 className="text-xl md:text-2xl font-bold text-slate-800 capitalize truncate max-w-[150px] md:max-w-none">
                            {currentView === 'shop' ? 'Tienda Online' : 
                             currentView === 'sales' ? 'Punto de Venta' : 
                             currentView === 'admin_pos' ? 'Gestión Global' :
                             currentView === 'client_discovery' ? 'Barberías' :
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
                        
                        {/* Tenant Label */}
                        {userRole !== 'superadmin' && userRole !== 'platform_owner' && (
                            <div className="hidden md:flex items-center bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-200">
                                <MapPin size={14} className="text-[#ffd427] mr-2" />
                                <span className="text-sm font-bold text-slate-700">{currentPosName}</span>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex items-center space-x-2 md:space-x-4">
                        <div className="text-right hidden md:block">
                            <p className="text-sm font-bold text-slate-800">{fullName || username}</p>
                            <p className="text-xs text-slate-500 capitalize">{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                        </div>
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-tr from-[#ffd427] to-amber-500 rounded-full flex items-center justify-center text-slate-900 font-bold border-2 border-white shadow-md overflow-hidden">
                            {username.charAt(0).toUpperCase()}
                        </div>
                        
                        {/* Extra Logout Button in Header */}
                        <button 
                            onClick={handleLogout} 
                            className="bg-white p-2 rounded-full text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors shadow-sm border border-slate-200"
                            title="Cerrar Sesión"
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </header>
                
                {/* Mobile Tenant Selector (Superadmin only) */}
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
                
                {renderView()}
            </main>

            {/* Cookie Consent Banner */}
            {!acceptedCookies && (
                <div className="fixed bottom-0 left-0 w-full bg-slate-900 text-white p-4 z-50 shadow-2xl animate-in slide-in-from-bottom duration-500">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="flex items-center space-x-3">
                            <Cookie className="text-[#ffd427]" size={24} />
                            <p className="text-sm">
                                Usamos cookies para asegurar que tengas la mejor experiencia en nuestro sistema. 
                                Al continuar navegando, aceptas nuestra política de privacidad.
                            </p>
                        </div>
                        <div className="flex space-x-3">
                            <button onClick={() => setCurrentView('settings')} className="text-slate-300 hover:text-white text-sm underline">Ver Política</button>
                            <button onClick={acceptCookies} className="bg-[#ffd427] hover:bg-[#e6be23] text-slate-900 px-6 py-2 rounded-full text-sm font-bold transition-colors">
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
