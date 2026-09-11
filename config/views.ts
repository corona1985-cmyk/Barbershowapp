import { ViewState, UserRole } from '../types';

const STAFF: UserRole[] = ['superadmin', 'admin', 'dueno', 'barbero'];
const CLIENT: UserRole[] = ['cliente'];

export const VIEWS_BY_ROLE: Record<ViewState, UserRole[]> = {
  admin_pos: ['superadmin'],
  dashboard: ['superadmin', 'admin', 'dueno', 'barbero'],
  client_discovery: CLIENT,
  client_profile: ['cliente', 'superadmin', 'admin', 'dueno', 'barbero'],
  qr_scanner: CLIENT,
  sales: STAFF,
  shop: CLIENT,
  appointments: [...STAFF, 'cliente'],
  calendar: STAFF,
  whatsapp_console: ['barbero', 'admin', 'dueno'],
  clients: STAFF,
  inventory: STAFF,
  finance: STAFF,
  reports: ['superadmin', 'admin', 'dueno'],
  sales_records: STAFF,
  user_admin: ['superadmin'],
  settings: STAFF,
  master_dashboard: ['platform_owner'],
};

export function defaultViewForRole(role: string): ViewState {
  if (role === 'platform_owner') return 'master_dashboard';
  if (role === 'superadmin') return 'admin_pos';
  if (role === 'cliente') return 'client_discovery';
  return 'dashboard';
}

export function isViewAllowedForRole(view: ViewState, role: string, accountTier?: string): boolean {
  const effective = role === 'empleado' ? 'barbero' : role;
  const allowed = VIEWS_BY_ROLE[view];
  if (!allowed?.includes(effective as UserRole)) return false;
  if (accountTier === 'solo' && (view === 'calendar' || view === 'inventory' || view === 'finance' || view === 'user_admin')) {
    return false;
  }
  if (accountTier === 'gratuito') {
    return ['dashboard', 'sales', 'client_profile', 'appointments', 'settings', 'client_discovery', 'qr_scanner', 'shop'].includes(view);
  }
  return true;
}

export function sanitizeViewForRole(view: ViewState, role: string, accountTier?: string): ViewState {
  if (isViewAllowedForRole(view, role, accountTier)) return view;
  const fallback = defaultViewForRole(role);
  if (role !== 'cliente' && accountTier === 'gratuito') return 'appointments';
  return fallback;
}
