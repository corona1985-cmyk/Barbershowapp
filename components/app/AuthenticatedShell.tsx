import React from 'react';
import Sidebar from '../Sidebar';
import { PointOfSale, AccountTier } from '../../types';
import { Cookie, MapPin, Globe, LogOut, Menu } from 'lucide-react';
import BarberNotificationBell from '../BarberNotificationBell';
import AdMobBanner from '../AdMobBanner';
import AdSenseBanner from '../AdSenseBanner';
import { Capacitor } from '@capacitor/core';
import { AppViewsSuspense, AppViewsProps } from './AppViews';
import { navigateToLegal } from '../../utils/legal';

interface AuthenticatedShellProps extends AppViewsProps {
    viewTitle: string;
    fullName: string;
    username: string;
    userPhotoUrl: string;
    currentPosName: string;
    isPlanPro: boolean;
    isSidebarOpen: boolean;
    acceptedCookies: boolean;
    pointsOfSale: PointOfSale[];
    formattedDate: string;
    cookieMessage: string;
    viewPolicyLabel: string;
    acceptLabel: string;
    openMenuLabel: string;
    logoutLabel: string;
    logoutTitle: string;
    viewingPosLabel: string;
    posLabel: string;
    myBusinessLabel: string;
    onOpenSidebar: () => void;
    onCloseSidebar: () => void;
    onLogout: () => void;
    onSwitchPos: (posId: number) => void;
    onAcceptCookies: () => void;
}

export const AuthenticatedShell: React.FC<AuthenticatedShellProps> = ({
    viewTitle,
    fullName,
    username,
    userPhotoUrl,
    currentPosName,
    isPlanPro,
    isSidebarOpen,
    acceptedCookies,
    pointsOfSale,
    formattedDate,
    cookieMessage,
    viewPolicyLabel,
    acceptLabel,
    openMenuLabel,
    logoutLabel,
    logoutTitle,
    viewingPosLabel,
    posLabel,
    myBusinessLabel,
    onOpenSidebar,
    onCloseSidebar,
    onLogout,
    onSwitchPos,
    onAcceptCookies,
    ...viewProps
}) => {
    const { userRole, accountTier, currentPosId, preferredPosId, posListForOwner, onChangeView, onRemoveFavorite } = viewProps;
    const showWebAds = accountTier === 'gratuito' || userRole === 'cliente';
    const showNativeAds = accountTier === 'gratuito' || userRole === 'cliente';
    return (
        <div className="flex h-screen min-h-0 max-h-[100dvh] bg-slate-100 font-sans overflow-hidden">
            <AdMobBanner showAds={showNativeAds} />
            <Sidebar
                currentView={viewProps.currentView}
                onChangeView={onChangeView}
                onLogout={onLogout}
                userRole={userRole}
                isOpen={isSidebarOpen}
                onClose={onCloseSidebar}
                clientHasSelectedBarberia={userRole === 'cliente' ? currentPosId != null : true}
                accountTier={accountTier}
                preferredPosId={userRole === 'cliente' ? preferredPosId : null}
                currentPosId={userRole === 'cliente' ? currentPosId : null}
                onRemoveFavorite={userRole === 'cliente' ? onRemoveFavorite : undefined}
            />
            <main className="flex-1 flex flex-col min-w-0 min-h-0 md:ml-64 overflow-hidden transition-all duration-300">
                <header className="flex-shrink-0 flex flex-wrap justify-between items-center p-3 sm:p-4 md:p-6 lg:p-8 pb-2 md:pb-4 no-print gap-2 sm:gap-3 bg-slate-100">
                    <div className="flex items-center space-x-2 sm:space-x-3 md:space-x-4 min-w-0">
                        <button
                            className="md:hidden flex items-center justify-center min-h-[44px] min-w-[44px] text-slate-700 p-2 bg-white rounded-xl shadow-sm active:bg-slate-100"
                            onClick={onOpenSidebar}
                            aria-label={openMenuLabel}
                        >
                            <Menu size={24} />
                        </button>
                        <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 capitalize truncate max-w-[140px] sm:max-w-[200px] md:max-w-none">
                            {viewTitle}
                        </h1>
                        {userRole === 'superadmin' && (
                            <div className="hidden md:flex items-center bg-slate-800 text-white px-3 py-1.5 rounded-lg shadow-md ml-4 border border-slate-700">
                                <Globe size={16} className="text-[#ffd427] mr-2" />
                                <span className="text-xs text-slate-400 mr-2 uppercase tracking-wider font-bold">{viewingPosLabel}</span>
                                <select
                                    value={currentPosId || ''}
                                    onChange={(e) => onSwitchPos(Number(e.target.value))}
                                    className="bg-slate-900 border-none text-white text-sm font-bold focus:ring-0 cursor-pointer rounded"
                                >
                                    {pointsOfSale.map(pos => (
                                        <option key={pos.id} value={pos.id}>{pos.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {accountTier === 'multisede' && posListForOwner.length > 1 && userRole !== 'superadmin' && (
                            <div className="hidden md:flex items-center bg-slate-800 text-white px-3 py-1.5 rounded-lg shadow-md ml-4 border border-slate-700">
                                <MapPin size={16} className="text-[#ffd427] mr-2" />
                                <span className="text-xs text-slate-400 mr-2 uppercase tracking-wider font-bold">{posLabel}</span>
                                <select
                                    value={currentPosId || ''}
                                    onChange={(e) => onSwitchPos(Number(e.target.value))}
                                    className="bg-slate-900 border-none text-white text-sm font-bold focus:ring-0 cursor-pointer rounded"
                                >
                                    {posListForOwner.map(pos => (
                                        <option key={pos.id} value={pos.id}>{pos.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {userRole !== 'superadmin' && userRole !== 'platform_owner' && (
                            <div className="hidden md:flex items-center bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-200">
                                <MapPin size={14} className="text-[#ffd427] mr-2" />
                                <span className="text-sm font-bold text-slate-700">
                                    {accountTier === 'solo' ? myBusinessLabel : currentPosName}
                                </span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center space-x-2 md:space-x-4">
                        <BarberNotificationBell
                            isPlanPro={isPlanPro}
                            userRole={userRole}
                            onChangeView={onChangeView}
                        />
                        <div className="text-right hidden md:block">
                            <p className="text-sm font-bold text-slate-800">{fullName || username}</p>
                            <p className="text-xs text-slate-500 capitalize">{formattedDate}</p>
                        </div>
                        <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-tr from-[#ffd427] to-amber-500 rounded-full flex items-center justify-center text-slate-900 font-bold border-2 border-white shadow-md overflow-hidden shrink-0">
                            {userPhotoUrl ? (
                                <img src={userPhotoUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                                (username || fullName).charAt(0).toUpperCase() || '?'
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={onLogout}
                            className="flex items-center justify-center min-h-[44px] min-w-[44px] bg-white p-2 rounded-full text-slate-500 hover:text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors shadow-sm border border-slate-200"
                            title={logoutTitle}
                            aria-label={logoutLabel}
                        >
                            <LogOut size={20} />
                        </button>
                    </div>
                </header>
                <div className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto scroll-touch scroll-area-mobile px-3 sm:px-4 md:px-6 lg:px-8 pb-6">
                    {userRole === 'superadmin' && (
                        <div className="md:hidden mb-4">
                             <div className="flex items-center bg-slate-800 text-white px-3 py-2 rounded-lg shadow-md border border-slate-700 w-full">
                                <Globe size={16} className="text-[#ffd427] mr-2" />
                                <select
                                    value={currentPosId || ''}
                                    onChange={(e) => onSwitchPos(Number(e.target.value))}
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
                                    onChange={(e) => onSwitchPos(Number(e.target.value))}
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
                        <AppViewsSuspense {...viewProps} />
                    </div>
                    <AdSenseBanner show={showWebAds} />
                </div>
            </main>
            {!acceptedCookies && !Capacitor.isNativePlatform() && (
                <div className="fixed bottom-0 left-0 right-0 w-full bg-slate-900 text-white p-4 z-50 shadow-2xl animate-in slide-in-from-bottom duration-500 safe-area-bottom">
                    <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center space-x-3">
                            <Cookie className="text-[#ffd427]" size={24} />
                            <p className="text-sm">{cookieMessage}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <button type="button" onClick={() => navigateToLegal('privacidad')} className="min-h-[44px] px-4 flex items-center text-slate-300 hover:text-white text-sm underline rounded-lg active:bg-white/10">{viewPolicyLabel}</button>
                            <button type="button" onClick={onAcceptCookies} className="min-h-[44px] bg-[#ffd427] hover:bg-[#e6be23] text-slate-900 px-6 py-2.5 rounded-full text-sm font-bold transition-colors active:scale-[0.98]">
                                {acceptLabel}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
