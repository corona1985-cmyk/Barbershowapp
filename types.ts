
export type UserRole = 'superadmin' | 'admin' | 'barbero' | 'cliente' | 'platform_owner' | 'support' | 'financial' | 'commercial';

/** Plan de la sede: basic = funciones estándar, pro = incluye notificaciones de citas para barbero */
export type PosPlan = 'basic' | 'pro';

export interface PointOfSale {
    id: number;
    name: string;
    address: string;
    ownerId: string; // Username of the owner
    isActive: boolean;
    /** Plan de suscripción; solo 'pro' habilita campana de notificaciones de citas para el barbero */
    plan?: PosPlan;
}

export interface AppSettings {
    posId?: number; // Settings are specific to a POS
    taxRate: number;
    storeName: string;
    currencySymbol: string;
}

export interface GlobalSettings {
    appName: string;
    primaryColor: string;
    secondaryColor: string;
    termsAndConditions: string;
    privacyPolicy: string;
    cookiePolicy: string;
    supportEmail: string;
    maintenanceMode: boolean;
}

export interface AuditLog {
    id: number;
    action: string;
    actor: string; // Username
    target?: string;
    posId?: number; // Null if global
    details: string;
    timestamp: string;
    ip: string;
}

export interface Permissions {
    canManageUsers?: boolean;
    canViewReports?: boolean;
    canDeleteAppointments?: boolean;
    canManageInventory?: boolean;
    canOverrideSchedule?: boolean;
}

export interface SystemUser {
    username: string;
    role: UserRole;
    password?: string; // Optional for mock
    name: string;
    posId?: number | null; // Null for superadmin or global users, specific ID for tenant users
    barberId?: number | null; // Solo para rol barbero: id del registro en Barber (barbers table)
    permissions?: Permissions;
    lastLogin?: string;
    ip?: string;
    loginAttempts?: number;
    status?: 'active' | 'locked' | 'suspended';
}

export interface Client {
    id: number;
    posId: number;
    nombre: string;
    telefono: string;
    email: string;
    ultimaVisita: string;
    notas: string;
    fechaRegistro: string;
    photoUrl?: string;
    puntos: number; // Loyalty points
    status: 'active' | 'suspended';
    whatsappOptIn?: boolean;
}

export interface Product {
    id: number;
    posId: number;
    producto: string;
    categoria: string;
    stock: number;
    precioCompra: number;
    precioVenta: number;
    estado: 'activo' | 'inactivo';
}

export interface Service {
    id: number;
    posId: number;
    name: string;
    price: number;
    duration: number;
}

export interface Barber {
    id: number;
    posId: number;
    name: string;
    specialty: string;
    active: boolean;
}

export interface Appointment {
    id: number;
    posId: number;
    clienteId: number;
    barberoId: number;
    fecha: string;
    hora: string;
    servicios: Service[];
    notas: string;
    duracionTotal: number;
    total: number;
    estado: 'pendiente' | 'confirmada' | 'completada' | 'cancelada';
    fechaCreacion: string;
}

export interface SaleItem {
    id: number;
    name: string;
    price: number;
    quantity: number;
    type: 'servicio' | 'producto';
}

/** Datos de una cita completada para llevar a facturación */
export interface AppointmentForSale {
    appointmentId: number;
    clienteId: number;
    clienteNombre: string;
    barberoId?: number; // Barbero que atendió (para asignar la venta)
    fecha: string;
    hora: string;
    items: SaleItem[];
    total: number;
}

export interface CartItem extends SaleItem {
    image?: string;
}

export interface Sale {
    id: number;
    posId: number;
    numeroVenta: string;
    clienteId: number | null;
    barberoId?: number | null; // Barbero que realizó la venta (para aislamiento por barbero)
    items: SaleItem[];
    metodoPago: string;
    subtotal: number;
    iva: number;
    total: number;
    fecha: string;
    hora: string;
    notas: string;
    estado: 'completada' | 'cancelada';
}

export interface FinanceRecord {
    id: number;
    posId: number;
    fecha: string;
    ingresos: number;
    egresos: number;
    ventas: any[];
    gastos: any[];
}

export interface FinancialTransaction {
    id: number;
    posId: number;
    type: 'income' | 'expense' | 'commission' | 'withdrawal';
    amount: number;
    description: string;
    date: string;
    status: 'pending' | 'cleared';
}

export interface NotificationLog {
    id: number;
    posId: number;
    barberId: number;
    clientId: number;
    type: 'whatsapp';
    status: 'sent' | 'failed' | 'pending';
    timestamp: string;
    message: string;
}

export type ViewState = 'dashboard' | 'clients' | 'appointments' | 'inventory' | 'sales' | 'shop' | 'finance' | 'reports' | 'settings' | 'admin_pos' | 'calendar' | 'whatsapp_console' | 'user_admin' | 'client_discovery' | 'master_dashboard';
