import React, { lazy, Suspense } from 'react';
import { ViewState, UserRole, PointOfSale, AppointmentForSale, AccountTier } from '../../types';
import { sanitizeViewForRole } from '../../config/views';
import { ViewFallback } from './GuestShell';

const Dashboard = lazy(() => import('../../pages/Dashboard'));
const Sales = lazy(() => import('../../pages/Sales'));
const Shop = lazy(() => import('../../pages/Shop'));
const Appointments = lazy(() => import('../../pages/Appointments'));
const Reports = lazy(() => import('../../pages/Reports'));
const SalesRecords = lazy(() => import('../../pages/SalesRecords'));
const Settings = lazy(() => import('../../pages/Settings'));
const AdminPOS = lazy(() => import('../../pages/AdminPOS'));
const CalendarView = lazy(() => import('../../pages/CalendarView'));
const WhatsAppConsole = lazy(() => import('../../pages/WhatsAppConsole'));
const UserAdmin = lazy(() => import('../../pages/UserAdmin'));
const ClientDiscovery = lazy(() => import('../../pages/ClientDiscovery'));
const ClientProfile = lazy(() => import('../../pages/ClientProfile'));
const Clients = lazy(() => import('../../pages/Clients'));
const Inventory = lazy(() => import('../../pages/InventoryClientsFinance').then(m => ({ default: m.Inventory })));
const Finance = lazy(() => import('../../pages/InventoryClientsFinance').then(m => ({ default: m.Finance })));

export interface AppViewsProps {
    currentView: ViewState;
    userRole: UserRole;
    accountTier: AccountTier;
    currentPosId: number | null;
    preferredPosId: number | null;
    salesFromAppointment: AppointmentForSale | null;
    appointmentsPrefill: { date?: string; clientId?: number; openModal?: boolean } | null;
    posListForOwner: PointOfSale[];
    onChangeView: (view: ViewState) => void;
    onClearSalesFromAppointment: () => void;
    onPrefillConsumed: () => void;
    onCompleteForBilling: (data: AppointmentForSale) => void;
    onBookClient: (clientId: number) => void;
    onGoToSchedule: (date: string, openModal?: boolean) => void;
    onClientPosSwitch: (id: number) => void;
    onRemoveFavorite: () => void | Promise<void>;
    onProfileUpdated: () => void;
    onAccountDeactivated: () => void;
}

export const AppViews: React.FC<AppViewsProps> = (props) => {
    const k = props.currentPosId;
    const view = sanitizeViewForRole(props.currentView, props.userRole, props.accountTier);
    const planProps = { accountTier: props.accountTier };
    switch (view) {
        case 'admin_pos': return <AdminPOS key={k} />;
        case 'dashboard': return <Dashboard key={k} onChangeView={props.onChangeView} />;
        case 'sales': return <Sales key={k} salesFromAppointment={props.salesFromAppointment} onClearSalesFromAppointment={props.onClearSalesFromAppointment} {...planProps} />;
        case 'shop': return <Shop key={k} />;
        case 'appointments': return <Appointments key={k} onChangeView={props.onChangeView} initialDate={props.appointmentsPrefill?.date} prefillClientId={props.appointmentsPrefill?.clientId} openPrefillModal={props.appointmentsPrefill?.openModal} onPrefillConsumed={props.onPrefillConsumed} onCompleteForBilling={props.onCompleteForBilling} {...planProps} />;
        case 'clients': return <Clients key={k} onChangeView={props.onChangeView} onBookClient={props.onBookClient} />;
        case 'inventory': return <Inventory key={k} />;
        case 'finance': return <Finance key={k} />;
        case 'reports': return <Reports key={k} accountTier={props.accountTier} posListForOwner={props.accountTier === 'multisede' ? props.posListForOwner : []} />;
        case 'sales_records': return <SalesRecords key={k} accountTier={props.accountTier} />;
        case 'settings': return <Settings key={k} {...planProps} onAccountDeactivated={props.onAccountDeactivated} />;
        case 'calendar': return <CalendarView key={k} onGoToSchedule={props.onGoToSchedule} />;
        case 'whatsapp_console': return <WhatsAppConsole key={k} />;
        case 'user_admin': return <UserAdmin key={k} />;
        case 'client_discovery': return <ClientDiscovery key={k} onSwitchPos={props.onClientPosSwitch} preferredPosId={props.preferredPosId} onRemoveFavorite={props.onRemoveFavorite} />;
        case 'client_profile': return <ClientProfile key={k} onChangeView={props.onChangeView} onProfileUpdated={props.onProfileUpdated} onAccountDeactivated={props.onAccountDeactivated} />;
        case 'qr_scanner': return null;
        default: return <Dashboard key={k} onChangeView={props.onChangeView} />;
    }
};

export const AppViewsSuspense: React.FC<AppViewsProps> = (props) => (
    <Suspense fallback={<ViewFallback />}>
        <AppViews {...props} />
    </Suspense>
);
