import React, { useState, useEffect } from 'react';
import { DataService } from '../services/data';
import { AppSettings, SystemUser, Service, UserRole, Barber } from '../types';
import { Save, Plus, Trash2, Edit2, Shield, Scissors, UserCog, Settings as SettingsIcon, UserCheck, Power, QrCode, Download, Printer } from 'lucide-react';

type SettingsTab = 'general' | 'users' | 'services' | 'privacy' | 'barbers';

const Settings: React.FC = () => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('general');
    const [settings, setSettings] = useState<AppSettings>({ taxRate: 0.16, storeName: '', currencySymbol: '$' });
    const [users, setUsers] = useState<SystemUser[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [barbers, setBarbers] = useState<Barber[]>([]);
    const [currentUserRole, setCurrentUserRole] = useState<string>(() => DataService.getCurrentUserRole());
    const [activePosId, setActivePosId] = useState<number | null>(null);

    const [showUserModal, setShowUserModal] = useState(false);
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [showBarberModal, setShowBarberModal] = useState(false);

    const [currentUser, setCurrentUser] = useState<Partial<SystemUser>>({ username: '', name: '', role: 'cliente', password: '' });
    const [currentService, setCurrentService] = useState<Partial<Service>>({ name: '', price: 0, duration: 30 });
    const [currentBarber, setCurrentBarber] = useState<Partial<Barber>>({ name: '', specialty: '', active: true });

    const loadData = async () => {
        const [settingsData, usersData, servicesData, barbersData] = await Promise.all([
            DataService.getSettings(),
            DataService.getUsers(),
            DataService.getServices(),
            DataService.getBarbers(),
        ]);
        setSettings(settingsData);
        setUsers(usersData);
        setServices(servicesData);
        setBarbers(barbersData);
        setCurrentUserRole(DataService.getCurrentUserRole());
        setActivePosId(DataService.getActivePosId());
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSaveSettings = async () => {
        await DataService.updateSettings(settings);
        alert('Configuración guardada correctamente');
    };

    const handleSaveUser = async () => {
        if (!currentUser.username || !currentUser.name || !currentUser.role) return;
        await DataService.saveUser(currentUser as SystemUser);
        await loadData();
        setShowUserModal(false);
    };

    const handleDeleteUser = async (username: string) => {
        if (confirm(`¿Eliminar usuario ${username}?`)) {
            await DataService.deleteUser(username);
            await loadData();
        }
    };

    const handleSaveService = async () => {
        if (!currentService.name || !currentService.price) return;
        if (currentService.id) {
            await DataService.saveService(currentService as Service);
        } else {
            await DataService.addService(currentService as Service);
        }
        await loadData();
        setShowServiceModal(false);
    };

    const handleDeleteService = async (id: number) => {
        if (confirm('¿Eliminar servicio?')) {
            await DataService.deleteService(id);
            await loadData();
        }
    };

    const handleSaveBarber = async () => {
        if (!currentBarber.name) return;
        if (currentBarber.id) {
            await DataService.updateBarber(currentBarber as Barber);
        } else {
            await DataService.addBarber(currentBarber as Barber);
        }
        await loadData();
        setShowBarberModal(false);
    };

    const handleDeleteBarber = async (id: number) => {
        if (confirm('¿Eliminar barbero? Se recomienda solo desactivarlo si tiene historial.')) {
            await DataService.deleteBarber(id);
            await loadData();
        }
    };

    const handleToggleBarber = async (id: number) => {
        await DataService.toggleBarberStatus(id);
        await loadData();
    };

    const openUserModal = (user?: SystemUser) => {
        if (user) {
            setCurrentUser({ ...user }); // Editing
        } else {
            setCurrentUser({ username: '', name: '', role: 'empleado', password: '' }); // Creating
        }
        setShowUserModal(true);
    };

    const openServiceModal = (service?: Service) => {
        if (service) {
            setCurrentService({ ...service });
        } else {
            setCurrentService({ name: '', price: 0, duration: 30 });
        }
        setShowServiceModal(true);
    };

    const openBarberModal = (barber?: Barber) => {
        if (barber) {
            setCurrentBarber({ ...barber });
        } else {
            setCurrentBarber({ name: '', specialty: '', active: true });
        }
        setShowBarberModal(true);
    };

    // Generate QR URL
    const getRegistrationUrl = () => {
        const baseUrl = window.location.origin + window.location.pathname;
        return `${baseUrl}?ref_pos=${activePosId}`;
    };

    // Solo admin, dueño y superadmin pueden acceder a Configuración
    const canAccessSettings = ['admin', 'dueno', 'superadmin'].includes(currentUserRole);
    if (!canAccessSettings) {
        return (
            <div className="p-8 text-center text-slate-500">
                No tienes permisos para acceder a esta sección. Solo administradores, dueños y superadmin pueden ver Configuración y gestionar servicios.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center">
                <SettingsIcon className="mr-2" /> Administración de Sede
            </h2>

            {/* Tabs */}
            <div className="flex space-x-1 bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-fit overflow-x-auto">
                <button 
                    onClick={() => setActiveTab('general')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center whitespace-nowrap ${activeTab === 'general' ? 'bg-[#ffd427] text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    <SettingsIcon size={16} className="mr-2" /> General
                </button>
                <button 
                    onClick={() => setActiveTab('users')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center whitespace-nowrap ${activeTab === 'users' ? 'bg-[#ffd427] text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    <UserCog size={16} className="mr-2" /> Usuarios
                </button>
                <button 
                    onClick={() => setActiveTab('barbers')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center whitespace-nowrap ${activeTab === 'barbers' ? 'bg-[#ffd427] text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    <UserCheck size={16} className="mr-2" /> Barberos
                </button>
                <button 
                    onClick={() => setActiveTab('services')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center whitespace-nowrap ${activeTab === 'services' ? 'bg-[#ffd427] text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    <Scissors size={16} className="mr-2" /> Servicios
                </button>
                <button 
                    onClick={() => setActiveTab('privacy')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center whitespace-nowrap ${activeTab === 'privacy' ? 'bg-[#ffd427] text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                    <Shield size={16} className="mr-2" /> Privacidad
                </button>
            </div>

            {/* Content */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                
                {/* GENERAL SETTINGS */}
                {activeTab === 'general' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">Configuración General</h3>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del Negocio (Sede Actual)</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-slate-300 rounded-lg p-2.5"
                                    value={settings.storeName}
                                    onChange={e => setSettings({...settings, storeName: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Tasa de Impuestos (Decimal)</label>
                                <input 
                                    type="number" 
                                    step="0.01"
                                    className="w-full border border-slate-300 rounded-lg p-2.5"
                                    value={settings.taxRate}
                                    onChange={e => setSettings({...settings, taxRate: Number(e.target.value)})}
                                />
                                <p className="text-xs text-slate-500 mt-1">Ejemplo: 0.16 para 16%</p>
                            </div>
                            <button onClick={handleSaveSettings} className="bg-[#ffd427] text-slate-900 px-4 py-2 rounded-lg font-bold flex items-center hover:bg-[#e6be23]">
                                <Save size={18} className="mr-2" /> Guardar Cambios
                            </button>
                        </div>

                        {/* QR Code Banner Section */}
                        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center text-center">
                            <div className="bg-white p-4 rounded-xl shadow-sm mb-4">
                                <img 
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(getRegistrationUrl())}`} 
                                    alt="QR de Registro" 
                                    className="w-48 h-48"
                                />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-1">Escanea para Registrarte</h3>
                            <p className="text-slate-500 text-sm mb-4">Coloca este código en la entrada para que los clientes se registren automáticamente en esta sede.</p>
                            
                            <div className="flex space-x-2">
                                <a 
                                    href={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(getRegistrationUrl())}`}
                                    download="BarberShow_QR.png"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium text-sm"
                                >
                                    <Download size={16} className="mr-2" /> Descargar PNG
                                </a>
                                <button 
                                    onClick={() => window.print()} 
                                    className="flex items-center px-4 py-2 bg-[#ffd427] text-slate-900 rounded-lg hover:bg-[#e6be23] font-bold text-sm"
                                >
                                    <Printer size={16} className="mr-2" /> Imprimir Bajante
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* USERS SETTINGS */}
                {activeTab === 'users' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                            <h3 className="text-lg font-bold text-slate-800">Gestión de Personal (Sede Actual)</h3>
                            <button onClick={() => openUserModal()} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center hover:bg-green-700">
                                <Plus size={16} className="mr-1" /> Nuevo Usuario
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-slate-500 text-sm border-b border-slate-200">
                                        <th className="py-2">Usuario</th>
                                        <th className="py-2">Nombre Completo</th>
                                        <th className="py-2">Rol</th>
                                        <th className="py-2 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((u, i) => (
                                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                                            <td className="py-3 font-medium text-slate-700">{u.username}</td>
                                            <td className="py-3 text-slate-600">{u.name}</td>
                                            <td className="py-3">
                                                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                                                    u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                                    u.role === 'dueno' ? 'bg-indigo-100 text-indigo-700' :
                                                    u.role === 'empleado' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                                                }`}>
                                                    {u.role}
                                                </span>
                                            </td>
                                            <td className="py-3 text-right space-x-2">
                                                <button onClick={() => openUserModal(u)} className="text-blue-500 hover:text-blue-700"><Edit2 size={18}/></button>
                                                <button onClick={() => handleDeleteUser(u.username)} className="text-red-400 hover:text-red-600"><Trash2 size={18}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* BARBERS SETTINGS */}
                {activeTab === 'barbers' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                            <h3 className="text-lg font-bold text-slate-800">Gestión de Barberos (Sede Actual)</h3>
                            <button onClick={() => openBarberModal()} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center hover:bg-green-700">
                                <Plus size={16} className="mr-1" /> Nuevo Barbero
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-slate-500 text-sm border-b border-slate-200">
                                        <th className="py-2">Nombre</th>
                                        <th className="py-2">Especialidad</th>
                                        <th className="py-2 text-center">Estado</th>
                                        <th className="py-2 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {barbers.map((b) => (
                                        <tr key={b.id} className="border-b border-slate-50 hover:bg-slate-50">
                                            <td className="py-3 font-medium text-slate-700">{b.name}</td>
                                            <td className="py-3 text-slate-600">{b.specialty}</td>
                                            <td className="py-3 text-center">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                                    b.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                                                }`}>
                                                    {b.active ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </td>
                                            <td className="py-3 text-right space-x-2 flex justify-end">
                                                <button 
                                                    onClick={() => handleToggleBarber(b.id)} 
                                                    className={`p-2 rounded-lg transition-colors ${b.active ? 'text-green-500 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                                                    title={b.active ? 'Desactivar' : 'Activar'}
                                                >
                                                    <Power size={18} />
                                                </button>
                                                <button onClick={() => openBarberModal(b)} className="text-blue-500 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-lg"><Edit2 size={18}/></button>
                                                <button onClick={() => handleDeleteBarber(b.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* SERVICES SETTINGS */}
                {activeTab === 'services' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                            <h3 className="text-lg font-bold text-slate-800">Catálogo de Servicios (Sede Actual)</h3>
                            <button onClick={() => openServiceModal()} className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center hover:bg-green-700">
                                <Plus size={16} className="mr-1" /> Nuevo Servicio
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-slate-500 text-sm border-b border-slate-200">
                                        <th className="py-2">Servicio</th>
                                        <th className="py-2">Duración (min)</th>
                                        <th className="py-2">Precio</th>
                                        <th className="py-2 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {services.map((s) => (
                                        <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                                            <td className="py-3 font-medium text-slate-700">{s.name}</td>
                                            <td className="py-3 text-slate-600">{s.duration}</td>
                                            <td className="py-3 font-bold text-slate-800">${s.price.toFixed(2)}</td>
                                            <td className="py-3 text-right space-x-2">
                                                <button onClick={() => openServiceModal(s)} className="text-blue-500 hover:text-blue-700"><Edit2 size={18}/></button>
                                                <button onClick={() => handleDeleteService(s.id)} className="text-red-400 hover:text-red-600"><Trash2 size={18}/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* PRIVACY SETTINGS */}
                {activeTab === 'privacy' && (
                    <div className="space-y-4">
                         <h3 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-2">Política de Privacidad y Cookies</h3>
                         <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg text-sm text-slate-600 h-64 overflow-y-auto">
                            <p className="font-bold mb-2">1. Introducción</p>
                            <p className="mb-4">BarberShow valora su privacidad. Esta política describe cómo recopilamos, usamos y protegemos su información.</p>
                            
                            <p className="font-bold mb-2">2. Recopilación de Datos</p>
                            <p className="mb-4">Recopilamos información personal como nombre, teléfono y correo electrónico para gestionar citas y servicios.</p>
                            
                            <p className="font-bold mb-2">3. Uso de Cookies</p>
                            <p className="mb-4">Utilizamos cookies para mejorar la experiencia del usuario, recordar preferencias y analizar el tráfico del sitio.</p>
                            
                            <p className="font-bold mb-2">4. Seguridad</p>
                            <p className="mb-4">Implementamos medidas de seguridad para proteger sus datos contra acceso no autorizado.</p>
                            
                            <p className="font-bold mb-2">5. Derechos del Usuario</p>
                            <p>Usted tiene derecho a acceder, rectificar o eliminar sus datos personales en cualquier momento.</p>
                         </div>
                         <div className="flex justify-end">
                             <button className="text-blue-600 text-sm font-medium hover:underline">Descargar PDF</button>
                         </div>
                    </div>
                )}

            </div>

            {/* USER MODAL */}
            {showUserModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-4">{currentUser.username ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nombre de Usuario (Login)</label>
                                <input type="text" className="w-full border rounded-lg p-2" value={currentUser.username} onChange={e => setCurrentUser({...currentUser, username: e.target.value})} disabled={!!currentUser.username && users.some(u => u.username === currentUser.username && u !== currentUser)} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Nombre Completo</label>
                                <input type="text" className="w-full border rounded-lg p-2" value={currentUser.name} onChange={e => setCurrentUser({...currentUser, name: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Contraseña</label>
                                <input type="password" className="w-full border rounded-lg p-2" value={currentUser.password} onChange={e => setCurrentUser({...currentUser, password: e.target.value})} placeholder={currentUser.username ? "Sin cambios" : "Contraseña inicial"} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Rol / Privilegios</label>
                                <select className="w-full border rounded-lg p-2" value={currentUser.role} onChange={e => setCurrentUser({...currentUser, role: e.target.value as UserRole})}>
                                    {currentUserRole === 'superadmin' && <option value="dueno">Dueño (Admin Local)</option>}
                                    <option value="empleado">Empleado</option>
                                    <option value="admin">Administrador</option>
                                    <option value="cliente">Cliente</option>
                                </select>
                            </div>
                            <div className="flex justify-end space-x-2 mt-4">
                                <button onClick={() => setShowUserModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                                <button onClick={handleSaveUser} className="px-4 py-2 bg-[#ffd427] text-slate-900 font-bold rounded-lg hover:bg-[#e6be23]">Guardar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SERVICE MODAL */}
            {showServiceModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-4">{currentService.id ? 'Editar Servicio' : 'Nuevo Servicio'}</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nombre del Servicio</label>
                                <input type="text" className="w-full border rounded-lg p-2" value={currentService.name} onChange={e => setCurrentService({...currentService, name: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Precio ($)</label>
                                <input type="number" className="w-full border rounded-lg p-2" value={currentService.price} onChange={e => setCurrentService({...currentService, price: Number(e.target.value)})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Duración (minutos)</label>
                                <input type="number" className="w-full border rounded-lg p-2" value={currentService.duration} onChange={e => setCurrentService({...currentService, duration: Number(e.target.value)})} />
                            </div>
                            <div className="flex justify-end space-x-2 mt-4">
                                <button onClick={() => setShowServiceModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                                <button onClick={handleSaveService} className="px-4 py-2 bg-[#ffd427] text-slate-900 font-bold rounded-lg hover:bg-[#e6be23]">Guardar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* BARBER MODAL */}
            {showBarberModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold mb-4">{currentBarber.id ? 'Editar Barbero' : 'Nuevo Barbero'}</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium mb-1">Nombre Completo</label>
                                <input type="text" className="w-full border rounded-lg p-2" value={currentBarber.name} onChange={e => setCurrentBarber({...currentBarber, name: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Especialidad</label>
                                <input type="text" className="w-full border rounded-lg p-2" value={currentBarber.specialty} onChange={e => setCurrentBarber({...currentBarber, specialty: e.target.value})} placeholder="Ej: Cortes clásicos, Barba" />
                            </div>
                            <div className="flex items-center space-x-2 mt-2">
                                <input type="checkbox" id="barberActive" checked={currentBarber.active} onChange={e => setCurrentBarber({...currentBarber, active: e.target.checked})} className="rounded text-[#ffd427] focus:ring-[#ffd427]" />
                                <label htmlFor="barberActive" className="text-sm font-medium text-slate-700">Barbero Activo (Disponible)</label>
                            </div>
                            <div className="flex justify-end space-x-2 mt-4">
                                <button onClick={() => setShowBarberModal(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancelar</button>
                                <button onClick={handleSaveBarber} className="px-4 py-2 bg-[#ffd427] text-slate-900 font-bold rounded-lg hover:bg-[#e6be23]">Guardar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;