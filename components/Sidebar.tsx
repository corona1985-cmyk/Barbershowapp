import React, { useMemo, useState } from 'react';
import { ViewState, UserRole, AccountTier } from '../types';
import { LayoutDashboard, Users, Calendar, Package, DollarSign, FileText, LogOut, Scissors, Settings, ShoppingBag, MapPin, X, ChevronDown, ChevronRight, Briefcase, BarChart2, MessageCircle, Shield, Globe, ListChecks, QrCode, StarOff, User } from 'lucide-react';
import { useTranslation } from '../i18n';

interface SidebarProps {
    currentView: ViewState;
    onChangeView: (view: ViewState) => void;
    onLogout: () => void;
    userRole: UserRole | string;
    isOpen: boolean;        
    onClose: () => void;
    clientHasSelectedBarberia?: boolean;
    accountTier?: AccountTier;
    preferredPosId?: number | null;
    currentPosId?: number | null;
    onRemoveFavorite?: () => void | Promise<void>;
}

type NavGroup = 'principal' | 'operaciones' | 'administracion';

const HIDDEN_IN_TIER_SOLO: ViewState[] = ['calendar', 'inventory', 'finance', 'user_admin'];
const SHOWN_IN_TIER_GRATUITO: ViewState[] = ['dashboard', 'sales', 'client_profile', 'appointments', 'settings', 'client_discovery', 'qr_scanner'];

const Sidebar: React.FC<SidebarProps> = ({ currentView, onChangeView, onLogout, userRole, isOpen, onClose, clientHasSelectedBarberia = true, accountTier = 'barberia', preferredPosId = null, currentPosId = null, onRemoveFavorite }) => {
    const { t } = useTranslation();
    const [expandedGroups, setExpandedGroups] = useState<Record<NavGroup, boolean>>({
        principal: true,
        operaciones: true,
        administracion: true
    });

    const toggleGroup = (group: NavGroup) => {
        setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }));
    };

    const navGroups = useMemo(() => [
        {
            id: 'principal' as NavGroup,
            label: t('nav.principal'),
            icon: <LayoutDashboard size={18} />,
            items: [
                { id: 'admin_pos', label: t('nav.globalPos'), icon: <MapPin size={18} />, roles: ['superadmin'] },
                { id: 'dashboard', label: t('nav.dashboard'), icon: <LayoutDashboard size={18} />, roles: ['superadmin', 'admin', 'barbero'] },
                { id: 'client_discovery', label: t('nav.discoverBarbershops'), icon: <Globe size={18} />, roles: ['cliente'] },
                { id: 'client_profile', label: t('nav.myProfile'), icon: <User size={18} />, roles: ['cliente', 'superadmin', 'admin', 'barbero'] },
                { id: 'qr_scanner', label: t('nav.scanQr'), icon: <QrCode size={18} />, roles: ['cliente'] },
            ]
        },
        {
            id: 'operaciones' as NavGroup,
            label: t('nav.operations'),
            icon: <Briefcase size={18} />,
            items: [
                { id: 'sales', label: t('nav.salesPos'), icon: <DollarSign size={18} />, roles: ['superadmin', 'admin', 'barbero'] },
                { id: 'shop', label: t('nav.onlineShop'), icon: <ShoppingBag size={18} />, roles: ['cliente'] },
                { id: 'appointments', label: t('nav.appointments'), icon: <Calendar size={18} />, roles: ['superadmin', 'admin', 'barbero', 'cliente'] },
                { id: 'calendar', label: t('nav.monthlyCalendar'), icon: <Calendar size={18} />, roles: ['superadmin', 'admin', 'barbero'] },
                { id: 'whatsapp_console', label: t('nav.whatsappConsole'), icon: <MessageCircle size={18} />, roles: ['barbero', 'admin'] },
                { id: 'clients', label: t('nav.clients'), icon: <Users size={18} />, roles: ['superadmin', 'admin', 'barbero'] },
            ]
        },
        {
            id: 'administracion' as NavGroup,
            label: t('nav.administration'),
            icon: <BarChart2 size={18} />,
            items: [
                { id: 'inventory', label: t('nav.inventory'), icon: <Package size={18} />, roles: ['superadmin', 'admin', 'barbero'] },
                { id: 'finance', label: t('nav.finance'), icon: <DollarSign size={18} />, roles: ['superadmin', 'admin', 'barbero'] },
                { id: 'reports', label: t('nav.reports'), icon: <FileText size={18} />, roles: ['superadmin', 'admin'] },
                { id: 'sales_records', label: t('nav.salesRecords'), icon: <ListChecks size={18} />, roles: ['superadmin', 'admin', 'barbero'] },
                { id: 'user_admin', label: t('nav.userAdmin'), icon: <Shield size={18} />, roles: ['superadmin'] },
                { id: 'settings', label: t('nav.settings'), icon: <Settings size={18} />, roles: ['superadmin', 'admin', 'barbero'] },
            ]
        }
    ], [t]);

    const handleItemClick = (id: ViewState) => {
        onChangeView(id);
        onClose();
    };

    const roleLabel = (userRole === 'barbero' || userRole === 'empleado') ? t('nav.barberRole') : userRole;

    return (
        <>
            {isOpen && (
                <div 
                    className="fixed inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm transition-opacity"
                    onClick={onClose}
                />
            )}

            <div className={`
                fixed inset-y-0 left-0 w-64 bg-slate-900 text-white flex flex-col h-screen shadow-2xl z-30 
                transform transition-transform duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
                md:translate-x-0 border-r border-slate-800
            `}>
                <div className="p-6 flex flex-col items-center relative border-b border-slate-800">
                    <button 
                        type="button"
                        onClick={onClose}
                        className="absolute top-4 right-4 text-slate-400 hover:text-white md:hidden flex items-center justify-center min-h-[44px] min-w-[44px] rounded-xl hover:bg-slate-800 active:bg-slate-700"
                        aria-label={t('common.closeMenu')}
                    >
                        <X size={22} />
                    </button>

                    <div className="w-12 h-12 bg-[#ffd427] rounded-xl flex items-center justify-center mb-3 shadow-lg shadow-yellow-500/20 transform rotate-3">
                        <Scissors size={24} className="text-slate-900" />
                    </div>
                    <h1 className="text-lg font-bold tracking-tight text-[#ffd427]">{t('common.barberShow')}</h1>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest mt-1 px-2 py-0.5 rounded bg-slate-800">
                        {roleLabel}
                    </span>
                </div>
                
                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
                    {navGroups.map(group => {
                        const effectiveRole = userRole === 'empleado' ? 'barbero' : userRole;
                        if (group.id === 'operaciones' && effectiveRole === 'cliente' && !clientHasSelectedBarberia) return null;
                        let filteredItems = group.items.filter(item => item.roles.includes(effectiveRole as UserRole));
                        if (accountTier === 'solo') {
                            filteredItems = filteredItems.filter(item => !HIDDEN_IN_TIER_SOLO.includes(item.id as ViewState));
                        }
                        if (accountTier === 'gratuito' && effectiveRole !== 'superadmin') {
                            filteredItems = filteredItems.filter(item => SHOWN_IN_TIER_GRATUITO.includes(item.id as ViewState));
                        }
                        if (accountTier === 'gratuito') {
                            filteredItems = filteredItems.filter(item => item.id !== 'whatsapp_console');
                        }
                        if (filteredItems.length === 0) return null;

                        return (
                            <div key={group.id} className="mb-2">
                                <button 
                                    type="button"
                                    onClick={() => toggleGroup(group.id)}
                                    className="w-full flex items-center justify-between px-3 min-h-[44px] py-2 text-xs font-bold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors touch-target-inline"
                                >
                                    <div className="flex items-center space-x-2">
                                        <span>{group.label}</span>
                                    </div>
                                    {expandedGroups[group.id] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </button>
                                
                                <div className={`space-y-1 mt-1 transition-all duration-300 overflow-hidden ${expandedGroups[group.id] ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                                    {filteredItems.map(item => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => handleItemClick(item.id as ViewState)}
                                            className={`w-full flex items-center space-x-3 px-4 min-h-[44px] py-2.5 rounded-xl text-sm transition-all duration-200 group touch-target-inline ${
                                                currentView === item.id 
                                                ? 'bg-[#ffd427] text-slate-900 shadow-md shadow-yellow-900/20 font-bold' 
                                                : 'text-slate-400 hover:bg-slate-800 hover:text-[#ffd427] active:bg-slate-700'
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

                <div className="p-4 border-t border-slate-800 bg-slate-900/50 space-y-2">
                    {(userRole === 'cliente' && clientHasSelectedBarberia && currentPosId != null && currentPosId === preferredPosId && onRemoveFavorite) && (
                        <button
                            type="button"
                            onClick={() => { onRemoveFavorite(); onClose(); }}
                            className="w-full flex items-center justify-center space-x-2 px-4 min-h-[44px] py-2 rounded-xl text-slate-400 hover:bg-slate-700 hover:text-[#ffd427] transition-colors duration-200 text-sm touch-target-inline"
                        >
                            <StarOff size={16} />
                            <span>{t('nav.removeFavorite')}</span>
                        </button>
                    )}
                    <button 
                        type="button"
                        onClick={onLogout}
                        className="w-full flex items-center justify-center space-x-2 px-4 min-h-[44px] py-2.5 border border-slate-700 rounded-xl text-slate-400 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all duration-200 text-sm font-medium touch-target-inline"
                    >
                        <LogOut size={18} />
                        <span>{t('common.logoutTitle')}</span>
                    </button>
                </div>
            </div>
        </>
    );
};

export default Sidebar;
