
import React, { useState, useEffect } from 'react';
import { DataService } from '../services/data';
import { PointOfSale, SystemUser, AuditLog, GlobalSettings, Sale, PosPlan } from '../types';
import { LayoutDashboard, Trash2, Globe, DollarSign, Users, Building, LogOut, Activity, Shield, Settings, FileText, Search, Plus, Save, Monitor, AlertTriangle, Eye, Lock } from 'lucide-react';

interface MasterDashboardProps {
    onLogout: () => void;
}

type MasterModule = 'overview' | 'sedes' | 'users' | 'finance' | 'audit' | 'settings';

const MasterDashboard: React.FC<MasterDashboardProps> = ({ onLogout }) => {
    const [currentModule, setCurrentModule] = useState<MasterModule>('overview');
    
    // Data State
    const [stats, setStats] = useState({ totalRevenue: 0, totalUsers: 0, totalSedes: 0, totalAppointments: 0 });
    const [sedes, setSedes] = useState<PointOfSale[]>([]);
    const [users, setUsers] = useState<SystemUser[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
    const [globalSettings, setGlobalSettings] = useState<GlobalSettings | null>(null);
    const [financialData, setFinancialData] = useState<any>(null);

    const [searchTerm, setSearchTerm] = useState('');
    const [showUserModal, setShowUserModal] = useState(false);
    const [newUser, setNewUser] = useState<Partial<SystemUser>>({ username: '', role: 'support', name: '', password: '' });

    const loadData = async () => {
        const [statsData, sedesData, usersData, auditData, settingsData, financialDataRes] = await Promise.all([
            DataService.getGlobalStats(),
            DataService.getPointsOfSale(),
            DataService.getAllUsersGlobal(),
            DataService.getAuditLogs(),
            DataService.getGlobalSettings(),
            DataService.getGlobalFinancialHistory(),
        ]);
        setStats(statsData);
        setSedes(sedesData);
        setUsers(usersData);
        setAuditLogs(auditData.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
        setGlobalSettings(settingsData);
        setFinancialData(financialDataRes);
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleDeleteSede = async (id: number) => {
        if (confirm('ADVERTENCIA: Esta acción eliminará la sede y sus datos. ¿Continuar?')) {
            await DataService.deletePointOfSale(id);
            loadData();
        }
    };

    const handleUpdateSedePlan = async (sede: PointOfSale, plan: PosPlan) => {
        await DataService.updatePointOfSale({ ...sede, plan });
        loadData();
    };

    const handleDeleteUser = async (username: string) => {
        if (confirm(`¿Eliminar usuario ${username} permanentemente?`)) {
            await DataService.deleteUser(username);
            loadData();
        }
    };

    const handleCreateInternalUser = async () => {
        if (!newUser.username || !newUser.password) return;
        await DataService.saveUser(newUser as SystemUser);
        setShowUserModal(false);
        setNewUser({ username: '', role: 'support', name: '', password: '' });
        loadData();
    };

    const handleSaveSettings = async () => {
        if (!globalSettings) return;
        await DataService.updateGlobalSettings(globalSettings);
        alert('Configuración Global Actualizada');
    };

    // --- MODULE RENDERS ---

    const renderOverview = () => (
        <div className="space-y-8 animate-in fade-in duration-500">
            <h2 className="text-2xl font-bold text-white flex items-center"><Activity className="mr-3 text-[#ffd427]" /> Visión Global del Sistema</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-md hover:border-[#ffd427] transition-colors">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-slate-400 text-sm font-bold uppercase">Ingresos Totales</h3>
                        <DollarSign className="text-green-500" size={24} />
                    </div>
                    <p className="text-3xl font-bold text-white">${stats.totalRevenue.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-2">En todas las sedes</p>
                </div>
                <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-md hover:border-[#ffd427] transition-colors">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-slate-400 text-sm font-bold uppercase">Sedes Activas</h3>
                        <Building className="text-[#ffd427]" size={24} />
                    </div>
                    <p className="text-3xl font-bold text-white">{stats.totalSedes}</p>
                    <p className="text-xs text-slate-500 mt-2">Puntos de venta registrados</p>
                </div>
                <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-md hover:border-[#ffd427] transition-colors">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-slate-400 text-sm font-bold uppercase">Usuarios</h3>
                        <Users className="text-blue-500" size={24} />
                    </div>
                    <p className="text-3xl font-bold text-white">{stats.totalUsers}</p>
                    <p className="text-xs text-slate-500 mt-2">Staff y Clientes</p>
                </div>
                <div className="bg-slate-800 border border-slate-700 p-6 rounded-xl shadow-md hover:border-[#ffd427] transition-colors">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-slate-400 text-sm font-bold uppercase">Volumen Citas</h3>
                        <Globe className="text-purple-500" size={24} />
                    </div>
                    <p className="text-3xl font-bold text-white">{stats.totalAppointments}</p>
                    <p className="text-xs text-slate-500 mt-2">Histórico global</p>
                </div>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                 <h3 className="text-lg font-bold text-white mb-4">Alertas del Sistema</h3>
                 <div className="space-y-3">
                     <div className="flex items-center p-3 bg-green-900/20 border border-green-900/50 rounded-lg">
                         <Shield className="text-green-500 mr-3" size={20} />
                         <div>
                             <p className="text-green-400 font-bold text-sm">Sistema Operativo</p>
                             <p className="text-slate-400 text-xs">Todos los servicios funcionando correctamente.</p>
                         </div>
                     </div>
                     {stats.totalRevenue > 100000 && (
                         <div className="flex items-center p-3 bg-yellow-900/20 border border-yellow-900/50 rounded-lg">
                            <DollarSign className="text-yellow-500 mr-3" size={20} />
                            <div>
                                <p className="text-yellow-400 font-bold text-sm">Hito Financiero</p>
                                <p className="text-slate-400 text-xs">Se ha superado la marca de $100k en ingresos.</p>
                            </div>
                        </div>
                     )}
                 </div>
            </div>
        </div>
    );

    const renderUsers = () => (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white flex items-center"><Users className="mr-3 text-blue-400" /> Administración de Usuarios</h2>
                <button onClick={() => setShowUserModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center text-sm">
                    <Plus size={16} className="mr-2" /> Crear Staff Interno
                </button>
            </div>
            
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-700 flex space-x-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={16} />
                        <input 
                            type="text" 
                            placeholder="Buscar usuario..." 
                            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
                <div className="max-h-[600px] overflow-y-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-slate-900/50 text-xs uppercase font-bold text-slate-500 sticky top-0">
                            <tr>
                                <th className="px-6 py-4">Usuario</th>
                                <th className="px-6 py-4">Rol</th>
                                <th className="px-6 py-4">Sede</th>
                                <th className="px-6 py-4">Última IP</th>
                                <th className="px-6 py-4">Último Login</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {users.filter(u => u.username.includes(searchTerm)).map((u, i) => (
                                <tr key={i} className="hover:bg-slate-700/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-white">{u.username}</div>
                                        <div className="text-xs text-slate-500">{u.name}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded text-xs uppercase font-bold ${
                                            u.role === 'platform_owner' ? 'bg-yellow-900 text-yellow-300' :
                                            u.role === 'superadmin' ? 'bg-purple-900 text-purple-300' :
                                            u.role === 'support' ? 'bg-blue-900 text-blue-300' : 'bg-slate-700 text-slate-300'
                                        }`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-mono text-slate-500">{u.posId ? `POS #${u.posId}` : 'GLOBAL'}</td>
                                    <td className="px-6 py-4 font-mono text-xs">{u.ip || '-'}</td>
                                    <td className="px-6 py-4 text-xs">{u.lastLogin ? new Date(u.lastLogin).toLocaleString() : 'Nunca'}</td>
                                    <td className="px-6 py-4 text-right">
                                        {u.role !== 'platform_owner' && (
                                            <button onClick={() => handleDeleteUser(u.username)} className="text-red-400 hover:text-red-300 p-2"><Trash2 size={16} /></button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Create Internal User */}
            {showUserModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl w-full max-w-md p-6">
                        <h3 className="text-xl font-bold text-white mb-4">Crear Staff Interno</h3>
                        <div className="space-y-4">
                            <input type="text" placeholder="Usuario" className="w-full bg-slate-900 border border-slate-700 text-white rounded p-2" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                            <input type="text" placeholder="Nombre Completo" className="w-full bg-slate-900 border border-slate-700 text-white rounded p-2" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                            <input type="password" placeholder="Contraseña" className="w-full bg-slate-900 border border-slate-700 text-white rounded p-2" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                            <select className="w-full bg-slate-900 border border-slate-700 text-white rounded p-2" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})}>
                                <option value="support">Soporte Técnico</option>
                                <option value="financial">Financiero</option>
                                <option value="commercial">Comercial</option>
                                <option value="superadmin">Super Admin (Cliente)</option>
                            </select>
                            <div className="flex justify-end space-x-3 mt-4">
                                <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-white">Cancelar</button>
                                <button onClick={handleCreateInternalUser} className="bg-blue-600 text-white px-4 py-2 rounded font-bold">Crear Usuario</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    const renderFinance = () => (
        <div className="space-y-6 animate-in fade-in duration-500">
            <h2 className="text-2xl font-bold text-white flex items-center"><DollarSign className="mr-3 text-green-500" /> Finanzas Globales</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 {/* POS Revenue Breakdown */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
                    <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2">Ingresos por Sede</h3>
                    <div className="space-y-4">
                        {financialData && Object.entries(financialData.posRevenue).map(([posId, amount]: [string, any]) => {
                            const pos = sedes.find(p => p.id === Number(posId));
                            const percentage = (amount / stats.totalRevenue) * 100;
                            return (
                                <div key={posId}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="text-slate-300 font-bold">{pos?.name || `Sede #${posId}`}</span>
                                        <span className="text-green-400 font-mono">${amount.toLocaleString()}</span>
                                    </div>
                                    <div className="w-full bg-slate-700 rounded-full h-2">
                                        <div className="bg-green-500 h-2 rounded-full" style={{ width: `${percentage}%` }}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Recent Global Sales */}
                <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 flex flex-col h-96">
                    <h3 className="text-lg font-bold text-white mb-4 border-b border-slate-700 pb-2">Últimas Transacciones</h3>
                    <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                        {financialData?.sales.slice().reverse().slice(0, 20).map((sale: Sale) => (
                            <div key={sale.id} className="flex justify-between items-center p-3 bg-slate-900/50 rounded border border-slate-700">
                                <div>
                                    <p className="text-white font-bold text-sm">Venta #{sale.numeroVenta}</p>
                                    <p className="text-slate-500 text-xs">{new Date(sale.fecha).toLocaleDateString()} - {sale.metodoPago}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[#ffd427] font-bold text-sm">+${sale.total}</p>
                                    <p className="text-slate-600 text-xs">POS: {sale.posId}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    const renderAudit = () => (
        <div className="space-y-6 animate-in fade-in duration-500">
            <h2 className="text-2xl font-bold text-white flex items-center"><Shield className="mr-3 text-red-500" /> Auditoría del Sistema</h2>
            <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden flex flex-col h-[700px]">
                <div className="p-4 border-b border-slate-700 bg-slate-900/50">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-500" size={16} />
                        <input type="text" placeholder="Buscar en logs..." className="w-full pl-10 pr-4 py-2 bg-slate-800 border border-slate-600 rounded text-white focus:border-red-500" />
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                    <table className="w-full text-left text-sm text-slate-300">
                        <thead className="bg-slate-900 text-xs uppercase font-bold text-slate-500 sticky top-0">
                            <tr>
                                <th className="px-4 py-3">Timestamp</th>
                                <th className="px-4 py-3">Actor</th>
                                <th className="px-4 py-3">Acción</th>
                                <th className="px-4 py-3">Detalle</th>
                                <th className="px-4 py-3">Contexto</th>
                                <th className="px-4 py-3">IP</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                            {auditLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-700/50 transition-colors font-mono text-xs">
                                    <td className="px-4 py-3 text-slate-400">{new Date(log.timestamp).toLocaleString()}</td>
                                    <td className="px-4 py-3 font-bold text-blue-300">{log.actor}</td>
                                    <td className="px-4 py-3 text-yellow-300">{log.action}</td>
                                    <td className="px-4 py-3 text-white">{log.details}</td>
                                    <td className="px-4 py-3">{log.posId ? `POS ${log.posId}` : 'GLOBAL'}</td>
                                    <td className="px-4 py-3 text-slate-500">{log.ip}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderSettings = () => {
        if (!globalSettings) return <p className="text-slate-400">Cargando...</p>;
        return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl">
            <h2 className="text-2xl font-bold text-white flex items-center"><Settings className="mr-3 text-slate-400" /> Configuración de Plataforma</h2>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-400 mb-2">Nombre de la Aplicación</label>
                        <input type="text" className="w-full bg-slate-900 border border-slate-600 text-white rounded p-3" value={globalSettings.appName} onChange={e => setGlobalSettings({...globalSettings, appName: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-400 mb-2">Email de Soporte</label>
                        <input type="text" className="w-full bg-slate-900 border border-slate-600 text-white rounded p-3" value={globalSettings.supportEmail} onChange={e => setGlobalSettings({...globalSettings, supportEmail: e.target.value})} />
                    </div>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold text-slate-400 mb-2">Color Primario (Hex)</label>
                        <div className="flex items-center space-x-2">
                            <div className="w-10 h-10 rounded border border-slate-600" style={{backgroundColor: globalSettings.primaryColor}}></div>
                            <input type="text" className="flex-1 bg-slate-900 border border-slate-600 text-white rounded p-3" value={globalSettings.primaryColor} onChange={e => setGlobalSettings({...globalSettings, primaryColor: e.target.value})} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-400 mb-2">Color Secundario (Hex)</label>
                        <div className="flex items-center space-x-2">
                             <div className="w-10 h-10 rounded border border-slate-600" style={{backgroundColor: globalSettings.secondaryColor}}></div>
                            <input type="text" className="flex-1 bg-slate-900 border border-slate-600 text-white rounded p-3" value={globalSettings.secondaryColor} onChange={e => setGlobalSettings({...globalSettings, secondaryColor: e.target.value})} />
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-slate-400 mb-2">Términos y Condiciones (Global)</label>
                    <textarea className="w-full bg-slate-900 border border-slate-600 text-white rounded p-3 h-32" value={globalSettings.termsAndConditions} onChange={e => setGlobalSettings({...globalSettings, termsAndConditions: e.target.value})}></textarea>
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-slate-700">
                    <div className="flex items-center space-x-3 bg-red-900/20 p-3 rounded border border-red-900/50">
                        <AlertTriangle className="text-red-500" />
                        <div>
                            <p className="text-red-400 font-bold text-sm">Modo Mantenimiento</p>
                            <p className="text-slate-500 text-xs">Bloquea el acceso a todos los usuarios excepto Master.</p>
                        </div>
                        <input type="checkbox" checked={globalSettings.maintenanceMode} onChange={e => setGlobalSettings({...globalSettings, maintenanceMode: e.target.checked})} className="ml-4 h-5 w-5 rounded border-slate-600 bg-slate-900" />
                    </div>
                    <button onClick={handleSaveSettings} className="bg-[#ffd427] text-slate-900 px-6 py-3 rounded-lg font-bold hover:bg-[#e6be23] flex items-center shadow-lg shadow-yellow-500/20">
                        <Save className="mr-2" size={20} /> Guardar Configuración
                    </button>
                </div>
            </div>
        </div>
        );
    };

    // --- MAIN RENDER ---
    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans flex">
            {/* Sidebar */}
            <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
                <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
                    <div className="w-10 h-10 bg-[#ffd427] rounded-lg flex items-center justify-center text-slate-900 shadow-lg shadow-yellow-500/20">
                        <Lock size={20} />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg tracking-wider text-white">MASTER</h1>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest">Admin Panel</p>
                    </div>
                </div>
                <nav className="flex-1 p-4 space-y-2">
                    {[
                        { id: 'overview', icon: Activity, label: 'Resumen Global' },
                        { id: 'sedes', icon: Building, label: 'Gestión Sedes' },
                        { id: 'users', icon: Users, label: 'Usuarios Staff' },
                        { id: 'finance', icon: DollarSign, label: 'Finanzas' },
                        { id: 'audit', icon: Shield, label: 'Auditoría Logs' },
                        { id: 'settings', icon: Settings, label: 'Configuración' },
                    ].map(item => (
                        <button 
                            key={item.id}
                            onClick={() => setCurrentModule(item.id as MasterModule)}
                            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                                currentModule === item.id 
                                ? 'bg-[#ffd427] text-slate-900 font-bold shadow-lg shadow-yellow-900/20' 
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`}
                        >
                            <item.icon size={18} />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </nav>
                <div className="p-4 border-t border-slate-800">
                    <button onClick={onLogout} className="w-full flex items-center justify-center space-x-2 p-3 rounded-lg bg-red-900/20 text-red-400 hover:bg-red-600 hover:text-white transition-all font-bold text-sm">
                        <LogOut size={16} /> <span>Cerrar Sesión Maestra</span>
                    </button>
                </div>
            </aside>

            {/* Content Area */}
            <main className="flex-1 bg-slate-950 p-8 overflow-y-auto h-screen">
                <header className="flex justify-between items-center mb-8">
                    <div>
                        <h2 className="text-xl font-bold text-white capitalize">{currentModule}</h2>
                        <p className="text-slate-500 text-sm">Bienvenido al modo dios, Master Admin.</p>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className="px-3 py-1 bg-slate-800 rounded-full border border-slate-700 flex items-center">
                            <div className="w-2 h-2 rounded-full bg-green-500 mr-2 animate-pulse"></div>
                            <span className="text-xs text-slate-300 font-mono">SYSTEM: ONLINE</span>
                        </div>
                    </div>
                </header>

                {currentModule === 'overview' && renderOverview()}
                
                {currentModule === 'sedes' && (
                    <div className="space-y-6 animate-in fade-in duration-500">
                         <h2 className="text-2xl font-bold text-white flex items-center"><Building className="mr-3 text-[#ffd427]" /> Gestión de Sedes (Barberías)</h2>
                         <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
                             <table className="w-full text-left text-sm text-slate-300">
                                <thead className="bg-slate-900 text-xs uppercase font-bold text-slate-500">
                                    <tr>
                                        <th className="px-6 py-4">ID</th>
                                        <th className="px-6 py-4">Nombre</th>
                                        <th className="px-6 py-4">Dirección</th>
                                        <th className="px-6 py-4">Dueño</th>
                                        <th className="px-6 py-4 text-center">Plan</th>
                                        <th className="px-6 py-4 text-center">Estado</th>
                                        <th className="px-6 py-4 text-right">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {sedes.map(sede => (
                                        <tr key={sede.id} className="hover:bg-slate-700/50 transition-colors">
                                            <td className="px-6 py-4 font-mono text-slate-500">#{sede.id}</td>
                                            <td className="px-6 py-4 font-bold text-white">{sede.name}</td>
                                            <td className="px-6 py-4">{sede.address}</td>
                                            <td className="px-6 py-4 text-[#ffd427]">{sede.ownerId}</td>
                                            <td className="px-6 py-4 text-center">
                                                <select
                                                    value={sede.plan || 'basic'}
                                                    onChange={(e) => handleUpdateSedePlan(sede, e.target.value as PosPlan)}
                                                    className="bg-slate-900 border border-slate-600 text-white rounded px-2 py-1 text-xs font-bold cursor-pointer"
                                                >
                                                    <option value="basic">Basic</option>
                                                    <option value="pro">Pro</option>
                                                </select>
                                                {sede.plan === 'pro' && (
                                                    <span className="ml-1 text-[10px] text-amber-400" title="Incluye notificaciones de citas para barbero">🔔</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${sede.isActive ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                                                    {sede.isActive ? 'ACTIVO' : 'INACTIVO'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button onClick={() => handleDeleteSede(sede.id)} className="text-red-400 hover:text-red-300 p-2"><Trash2 size={18} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                         </div>
                    </div>
                )}

                {currentModule === 'users' && renderUsers()}
                {currentModule === 'finance' && renderFinance()}
                {currentModule === 'audit' && renderAudit()}
                {currentModule === 'settings' && renderSettings()}

            </main>
        </div>
    );
};

export default MasterDashboard;
