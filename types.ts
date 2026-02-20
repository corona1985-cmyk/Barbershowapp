
export type UserRole = 'superadmin' | 'admin' | 'dueno' | 'barbero' | 'empleado' | 'cliente' | 'platform_owner' | 'support' | 'financial' | 'commercial';

/** Plan de la sede: basic = funciones estándar, pro = incluye notificaciones de citas para barbero */
export type PosPlan = 'basic' | 'pro';

/** Tipo de negocio / tier de cuenta: determina menú y límites (solo → barbería → multi-sede) */
export type AccountTier = 'solo' | 'barberia' | 'multisede';

/** Nombre comercial único del plan mostrado al usuario: un solo nombre por cuenta (Normal incluye lo básico; Pro incluye Normal + más; Full incluye todo). */
export type DisplayPlanName = 'Normal' | 'Pro' | 'Full';

export interface PointOfSale {
    id: number;
    name: string;
    address: string;
    ownerId: string; // Username of the owner
    isActive: boolean;
    /** Plan de suscripción; solo 'pro' habilita campana de notificaciones de citas para el barbero */
    plan?: PosPlan;
    /** Tier de negocio: solo = un barbero una sede, barberia = varios barberos una sede, multisede = varias sedes */
    tier?: AccountTier;
    /** Fecha límite de la suscripción pagada (ISO string). Si falta = sin vencimiento por pago. Si está en el pasado, la sede se considera vencida y se bloquea el acceso hasta renovar. */
    subscriptionExpiresAt?: string;
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
    photoUrl?: string; // Foto de perfil (admin, barbero, superadmin, cliente en su perfil de usuario)
    posId?: number | null; // Null for superadmin or global users, specific ID for tenant users
    barberId?: number | null; // Solo para rol barbero: id del registro en Barber (barbers table)
    clientId?: number | null; // Solo para rol cliente: id del registro en Client (clients table)
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
    /** Si es null/undefined = producto de la sede. Si es número = producto propio de ese barbero. */
    barberId?: number | null;
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
    /** Si es null/undefined = servicio de la sede (todos). Si es número = servicio propio de ese barbero. */
    barberId?: number | null;
}

/** Horario de un día: start/end en formato "HH:mm". Si no está definido, el barbero no trabaja ese día. */
export interface BarberWorkingDay {
    start: string;
    end: string;
}

/** Por día de semana: 0 = Domingo, 1 = Lunes, ..., 6 = Sábado. Solo los días que trabaja. */
export type BarberWorkingHours = Partial<Record<number, BarberWorkingDay>>;

/** Bloqueo de horas: el barbero no atiende en este rango (ej. salida, cita personal). */
export interface BarberBlockedSlot {
    date: string;   // "YYYY-MM-DD"
    start: string; // "HH:mm"
    end: string;   // "HH:mm"
}

export interface Barber {
    id: number;
    posId: number;
    name: string;
    specialty: string;
    active: boolean;
    /** Horario por día (0-6). Si no hay nada, se asume 09:00-19:00 todos los días. */
    workingHours?: BarberWorkingHours;
    /** Horas bloqueadas (salidas, no disponibles) por fecha. */
    blockedHours?: BarberBlockedSlot[];
    /** Horario de comida por día de semana (0-6). Mismo formato que workingHours; si está definido, no se ofrecen slots en ese rango. */
    lunchBreak?: BarberWorkingHours;
}

/** Foto de un trabajo/corte del barbero para que los clientes la vean. */
export interface BarberGalleryPhoto {
    id: number;
    barberId: number;
    posId: number;
    imageUrl: string;
    /** Servicio asociado (opcional). */
    serviceId?: number | null;
    caption?: string;
    createdAt: string;
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

export type ViewState = 'dashboard' | 'clients' | 'appointments' | 'inventory' | 'sales' | 'shop' | 'finance' | 'reports' | 'sales_records' | 'settings' | 'admin_pos' | 'calendar' | 'whatsapp_console' | 'user_admin' | 'client_discovery' | 'client_profile' | 'qr_scanner' | 'master_dashboard';
