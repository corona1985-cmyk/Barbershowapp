import React, { useState } from 'react';
import { ViewState, UserRole, AccountTier } from '../types';
import { LayoutDashboard, Users, Calendar, Package, DollarSign, FileText, LogOut, Scissors, Settings, ShoppingBag, MapPin, X, ChevronDown, ChevronRight, Briefcase, BarChart2, MessageCircle, Shield, Globe, ListChecks, QrCode } from 'lucide-react';

interface SidebarProps {
    currentView: ViewState;
    onChangeView: (view: ViewState) => void;
    onLogout: () => void;
    userRole: UserRole | string;
    isOpen: boolean;        
    onClose: () => void;
    /** Solo para rol cliente: true cuando ya eligió una barbería (Visitar Perfil). Si false, no se muestra Operaciones. */
    clientHasSelectedBarberia?: boolean;
    /** Plan de negocio: en 'solo' se ocultan Calendario, WhatsApp, Inventario, Finanzas, Admin Usuarios. */
    accountTier?: AccountTier;
}

type NavGroup = 'principal' | 'operaciones' | 'administracion';

/** Ítems que se ocultan en plan Solo (menú simplificado) */
const HIDDEN_IN_TIER_SOLO: ViewState[] = ['calendar', 'whatsapp_console', 'inventory', 'finance', 'user_admin'];

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, onLogout, userRole, isOpen, onClose, clientHasSelectedBarberia = true, accountTier = 'barberia' }) => {
    
    // State for collapsible groups
    const [expandedGroups, setExpandedGroups] = useState<Record<NavGroup, boolean>>({
        principal: true,
        operaciones: true,
        administracion: true
    });

    const toggleGroup = (group: NavGroup) => {
        setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
    };

    // Define items structure with groups
    const navGroups = [
        {
            id: 'principal' as NavGroup,
            label: 'Principal',
            icon: <LayoutDashboard size={18} />,
            items: [
                { id: 'admin_pos', label: 'Sedes Globales', icon: <MapPin size={18} />, roles: ['superadmin'] },
                { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} />, roles: ['superadmin', 'admin', 'barbero'] },
                { id: 'client_discovery', label: 'Descubrir Barberías', icon: <Globe size={18} />, roles: ['cliente'] },
                { id: 'qr_scanner', label: 'Escanear QR', icon: <QrCode size={18} />, roles: ['cliente'] },
            ]
        },
        {
            id: 'operaciones' as NavGroup,
            label: 'Operaciones',
            icon: <Briefcase size={18} />,
            items: [
                { id: 'sales', label: 'Ventas (POS)', icon: <DollarSign size={18} />, roles: ['superadmin', 'admin', 'barbero'] },
                { id: 'shop', label: 'Tienda Online', icon: <ShoppingBag size={18} />, roles: ['cliente'] },
                { id: 'appointments', label: 'Agenda Citas', icon: <Calendar size={18} />, roles: ['superadmin', 'admin', 'barbero', 'cliente'] },
                { id: 'calendar', label: 'Calendario Mensual', icon: <Calendar size={18} />, roles: ['superadmin', 'admin', 'barbero'] },
                { id: 'whatsapp_console', label: 'Consola WhatsApp', icon: <MessageCircle size={18} />, roles: ['barbero', 'admin'] },
                { id: 'clients', label: 'Clientes', icon: <Users size={18} />, roles: ['superadmin', 'admin', 'barbero'] },
            ]
        },
        {
            id: 'administracion' as NavGroup,
            label: 'Administración',
            icon: <BarChart2 size={18} />,
            items: [
                { id: 'inventory', label: 'Inventario', icon: <Package size={18} />, roles: ['superadmin', 'admin', 'barbero'] },
                { id: 'finance', label: 'Finanzas', icon: <DollarSign size={18} />, roles: ['superadmin', 'admin', 'barbero'] },
                { id: 'reports', label: 'Reportes', icon: <FileText size={18} />, roles: ['superadmin', 'admin'] },
                { id: 'sales_records', label: 'Registros de cortes', icon: <ListChecks size={18} />, roles: ['superadmin', 'admin', 'barbero'] },
                { id: 'user_admin', label: 'Admin Usuarios', icon: <Shield size={18} />, roles: ['superadmin'] },
                { id: 'settings', label: 'Configuración', icon: <Settings size={18} />, roles: ['superadmin', 'admin', 'barbero'] },
            ]
        }
    ];

    const handleItemClick = (id: ViewState) => {
        onChangeView(id);
        onClose(); // Auto close on mobile
    };

    return (
        <>
            {/* Mobile Overlay */}
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm transition-opacity"
                    onClick={onClose}
                />
            )}

            {/* Sidebar Container */}
            <div className={`
                fixed inset-y-0 left-0 w-64 bg-slate-900 text-white flex flex-col h-screen shadow-2xl z-30 
                transform transition-transform duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
                md:translate-x-0 border-r border-slate-800
            `}>
                <div className="p-6 flex flex-col items-center relative border-b border-slate-800">
                    <button 
                        onClick={onClose}
                        className="absolute top-4 right-4 text-slate-400 hover:text-white md:hidden p-1 rounded-md hover:bg-slate-800"
                    >
                        <X size={20} />
                    </button>

                    <div className="w-12 h-12 bg-[#ffd427] rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-yellow-500/20 transform rotate-3">
                        <Scissors size={24} className="text-slate-900" />
                    </div>
                    <h1 className="text-lg font-bold tracking-tight text-[#ffd427]">BarberShow</h1>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest mt-1 px-2 py-0.5 rounded bg-slate-800">
                        {(userRole === 'barbero' || userRole === 'empleado') ? 'Barbero' : userRole}
                    </span>
                </div>
                
                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
                    {navGroups.map(group => {
                        // Cliente: no mostrar Operaciones hasta que haya elegido una barbería
                        const effectiveRole = userRole === 'empleado' ? 'barbero' : userRole;
                        if (group.id === 'operaciones' && effectiveRole === 'cliente' && !clientHasSelectedBarberia) return null;
                        // Filter items for this group based on permissions
                        let filteredItems = group.items.filter(item => item.roles.includes(effectiveRole as UserRole));
                        // En plan Solo ocultar: Calendario, WhatsApp, Inventario, Finanzas, Admin Usuarios
                        if (accountTier === 'solo') {
                            filteredItems = filteredItems.filter(item => !HIDDEN_IN_TIER_SOLO.includes(item.id as ViewState));
                        }
                        // Consola WhatsApp solo en plan Multi-Sede
                        if (accountTier !== 'multisede') {
                            filteredItems = filteredItems.filter(item => item.id !== 'whatsapp_console');
                        }
                        if (filteredItems.length === 0) return null;

                        return (
                            <div key={group.id} className="mb-2">
                                <button 
                                    onClick={() => toggleGroup(group.id)}
                                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors"
                                >
                                    <div className="flex items-center space-x-2">
                                        {/* {group.icon} */}
                                        <span>{group.label}</span>
                                    </div>
                                    {expandedGroups[group.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                                
                                <div className={`space-y-1 mt-1 transition-all duration-300 overflow-hidden ${expandedGroups[group.id] ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                    {filteredItems.map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleItemClick(item.id as ViewState)}
                                            className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 group ${
                                                currentView === item.id 
                                                ? 'bg-[#ffd427] text-slate-900 shadow-md shadow-yellow-900/20 font-bold' 
                                                : 'text-slate-400 hover:bg-slate-800 hover:text-[#ffd427]'
                                            }`}
                                        >
                                            <span className={`${currentView === item.id ? 'text-slate-900' : 'text-slate-500 group-hover:text-[#ffd427]'}`}>
                                                {item.icon}
                                            </span>
                                            <span>{item.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                    <button 
                        onClick={onLogout}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 border border-slate-700 rounded-lg text-slate-400 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all duration-200 text-sm font-medium"
                    >
                        <LogOut size={18} />
                        <span>Cerrar Sesión</span>
                    </button>
                </div>
            </div>
        </>
    );
};

export default Sidebar;