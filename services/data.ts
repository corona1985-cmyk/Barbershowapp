import { ref, get, set, update, remove } from 'firebase/database';
import { db } from './firebase';
import {
  Client,
  Product,
  Service,
  Barber,
  Appointment,
  Sale,
  FinanceRecord,
  SystemUser,
  AppSettings,
  CartItem,
  PointOfSale,
  NotificationLog,
  AuditLog,
  GlobalSettings,
} from '../types';

const ROOT = 'barbershow';

// Mock Initial Data para primera carga / seed
const INITIAL_POS: PointOfSale[] = [
  { id: 1, name: 'Barbería Central', address: 'Av. Principal 123', ownerId: 'barbero', isActive: true },
  { id: 2, name: 'Sucursal Norte', address: 'Calle Norte 456', ownerId: 'barbero2', isActive: true },
];

const INITIAL_CLIENTS: Client[] = [
  { id: 1, posId: 1, nombre: 'Juan Pérez', telefono: '+1234567890', email: 'juan@email.com', ultimaVisita: '2024-01-10', notas: 'Cliente frecuente', fechaRegistro: '2023-01-01', puntos: 350, status: 'active', whatsappOptIn: true, photoUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80' },
  { id: 2, posId: 1, nombre: 'María García', telefono: '+0987654321', email: 'maria@email.com', ultimaVisita: '2024-01-12', notas: 'Prefiere cita los sábados', fechaRegistro: '2023-02-15', puntos: 120, status: 'active', whatsappOptIn: true, photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?ixlib=rb-1.2.1&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80' },
  { id: 3, posId: 1, nombre: 'Pedro Suspendido', telefono: '+1122334455', email: 'pedro@email.com', ultimaVisita: '2023-12-01', notas: 'Pagos pendientes', fechaRegistro: '2023-06-10', puntos: 10, status: 'suspended' },
  { id: 4, posId: 2, nombre: 'Carlos Norte', telefono: '+55555555', email: 'carlos@norte.com', ultimaVisita: '2024-02-01', notas: 'Nuevo en sucursal', fechaRegistro: '2024-01-01', puntos: 50, status: 'active' },
  { id: 5, posId: 1, nombre: 'Usuario Cliente', telefono: '+9988776655', email: 'cliente@demo.com', ultimaVisita: '2024-02-10', notas: 'Usuario Demo', fechaRegistro: '2024-01-01', puntos: 100, status: 'active', whatsappOptIn: true },
];

const INITIAL_PRODUCTS: Product[] = [
  { id: 1, posId: 1, producto: 'Shampoo Anticaspa', categoria: 'Cuidado Capilar', stock: 15, precioCompra: 8.5, precioVenta: 15, estado: 'activo' },
  { id: 2, posId: 1, producto: 'Cera Moldeadora', categoria: 'Estilo', stock: 8, precioCompra: 12, precioVenta: 25, estado: 'activo' },
  { id: 3, posId: 1, producto: 'Aceite para Barba', categoria: 'Barba', stock: 3, precioCompra: 15, precioVenta: 30, estado: 'activo' },
  { id: 4, posId: 2, producto: 'Gel Fijador', categoria: 'Estilo', stock: 20, precioCompra: 5, precioVenta: 10, estado: 'activo' },
];

const INITIAL_SERVICES: Service[] = [
  { id: 1, posId: 1, name: 'Corte de Cabello', price: 25, duration: 30 },
  { id: 2, posId: 1, name: 'Corte de Barba', price: 20, duration: 25 },
  { id: 3, posId: 1, name: 'Corte + Barba', price: 40, duration: 50 },
  { id: 4, posId: 1, name: 'Afeitado Clásico', price: 30, duration: 35 },
  { id: 5, posId: 2, name: 'Corte Express', price: 15, duration: 15 },
];

const INITIAL_BARBERS: Barber[] = [
  { id: 1, posId: 1, name: 'Carlos Rodríguez', specialty: 'Cortes Clásicos', active: true },
  { id: 2, posId: 1, name: 'Miguel Ángel', specialty: 'Barbas y Afeitados', active: true },
  { id: 3, posId: 2, name: 'Ana Norte', specialty: 'Colorimetría', active: true },
];

const INITIAL_USERS: SystemUser[] = [
  { username: 'master', role: 'platform_owner', name: 'Master Admin', password: 'root', posId: null, status: 'active' },
  { username: 'superadmin', role: 'superadmin', name: 'Super Admin Global', password: 'admin', permissions: { canManageUsers: true, canViewReports: true }, status: 'active' },
  { username: 'barbero', role: 'barbero', name: 'Carlos Barbero', password: '123', posId: 1, barberId: 1, status: 'active' },
  { username: 'barbero2', role: 'barbero', name: 'Laura Barbero (Norte)', password: '123', posId: 2, barberId: 3, status: 'active' },
  { username: 'cliente', role: 'cliente', name: 'Usuario Cliente', password: '123', posId: 1, status: 'active' },
];

const DEFAULT_SETTINGS: AppSettings = {
  taxRate: 0.16,
  storeName: 'BarberShow',
  currencySymbol: '$',
};

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  appName: 'BarberShow',
  primaryColor: '#ffd427',
  secondaryColor: '#1e293b',
  termsAndConditions: 'Términos y condiciones estándar...',
  privacyPolicy: 'Política de privacidad estándar...',
  cookiePolicy: 'Política de cookies estándar...',
  supportEmail: 'support@barbershow.com',
  maintenanceMode: false,
};

function toObjectById<T extends { id: number }>(arr: T[]): Record<string, T> {
  const o: Record<string, T> = {};
  arr.forEach((item) => { o[String(item.id)] = item; });
  return o;
}

function toObjectByUsername(users: SystemUser[]): Record<string, SystemUser> {
  const o: Record<string, SystemUser> = {};
  users.forEach((u) => { o[u.username] = u; });
  return o;
}

function snapshotToArray<T>(val: unknown): T[] {
  if (val == null) return [];
  const obj = val as Record<string, T>;
  return Object.keys(obj).map((k) => ({ ...obj[k], id: obj[k] && typeof (obj[k] as any).id === 'number' ? (obj[k] as any).id : Number(k) || k }));
}

function snapshotToUsers(val: unknown): SystemUser[] {
  if (val == null) return [];
  const obj = val as Record<string, SystemUser>;
  return Object.values(obj);
}

let ACTIVE_POS_ID: number | null = null;

export const DataService = {
  initialize: async (): Promise<void> => {
    const snap = await get(ref(db, ROOT + '/pointsOfSale'));
    if (!snap.exists()) {
      await set(ref(db, ROOT + '/pointsOfSale'), toObjectById(INITIAL_POS));
      await set(ref(db, ROOT + '/clients'), toObjectById(INITIAL_CLIENTS));
      await set(ref(db, ROOT + '/products'), toObjectById(INITIAL_PRODUCTS));
      await set(ref(db, ROOT + '/services'), toObjectById(INITIAL_SERVICES));
      await set(ref(db, ROOT + '/barbers'), toObjectById(INITIAL_BARBERS));
      await set(ref(db, ROOT + '/appointments'), {});
      await set(ref(db, ROOT + '/sales'), {});
      await set(ref(db, ROOT + '/finances'), {});
      await set(ref(db, ROOT + '/users'), toObjectByUsername(INITIAL_USERS));
      await set(ref(db, ROOT + '/notificationLogs'), {});
      await set(ref(db, ROOT + '/auditLogs'), {});
      await set(ref(db, ROOT + '/financialTransactions'), {});
      await set(ref(db, ROOT + '/globalSettings'), DEFAULT_GLOBAL_SETTINGS);
      await set(ref(db, ROOT + '/settings'), { '1': { ...DEFAULT_SETTINGS, posId: 1 }, '2': { ...DEFAULT_SETTINGS, storeName: 'BarberShow Norte', posId: 2 } });
      await set(ref(db, ROOT + '/userCart'), []);
    }
    // Asegurar que los usuarios por defecto existan siempre (por si la BD ya tenía datos sin users)
    const usersSnap = await get(ref(db, ROOT + '/users'));
    const currentUsers = usersSnap.val() || {};
    const updates: Record<string, SystemUser> = {};
    for (const u of INITIAL_USERS) {
      if (!currentUsers[u.username]) {
        updates[u.username] = { ...u, status: u.status || 'active', loginAttempts: 0 };
      }
    }
    if (Object.keys(updates).length > 0) {
      await update(ref(db, ROOT + '/users'), updates);
    }
  },

  setActivePosId: (id: number | null) => { ACTIVE_POS_ID = id; },
  getActivePosId: () => ACTIVE_POS_ID,

  getPointsOfSale: async (): Promise<PointOfSale[]> => {
    const snap = await get(ref(db, ROOT + '/pointsOfSale'));
    const arr = snapshotToArray<PointOfSale>(snap.val());
    return arr.map((p) => ({ ...p, id: Number(p.id) }));
  },

  addPointOfSale: async (pos: Omit<PointOfSale, 'id'>): Promise<PointOfSale> => {
    const newPos = { ...pos, id: Date.now(), isActive: true };
    await update(ref(db, ROOT + '/pointsOfSale/' + newPos.id), newPos);
    const allSettingsSnap = await get(ref(db, ROOT + '/settings'));
    const allSettings: Record<string, AppSettings> = allSettingsSnap.val() || {};
    allSettings[String(newPos.id)] = { ...DEFAULT_SETTINGS, posId: newPos.id, storeName: newPos.name };
    await set(ref(db, ROOT + '/settings'), allSettings);
    await DataService.logAuditAction('create_pos', 'master', `Created POS: ${newPos.name}`, newPos.id);
    return newPos;
  },

  updatePointOfSale: async (pos: PointOfSale): Promise<void> => {
    await set(ref(db, ROOT + '/pointsOfSale/' + pos.id), pos);
    await DataService.logAuditAction('update_pos', 'master', `Updated POS: ${pos.name}`, pos.id);
  },

  deletePointOfSale: async (id: number): Promise<void> => {
    await remove(ref(db, ROOT + '/pointsOfSale/' + id));
    const allSnap = await get(ref(db, ROOT + '/settings'));
    const all: Record<string, AppSettings> = allSnap.val() || {};
    delete all[String(id)];
    await set(ref(db, ROOT + '/settings'), all);
    await DataService.logAuditAction('delete_pos', 'master', `Deleted POS ID: ${id}`);
  },

  getUsers: async (): Promise<SystemUser[]> => {
    const snap = await get(ref(db, ROOT + '/users'));
    const users = snapshotToUsers(snap.val());
    if (ACTIVE_POS_ID) return users.filter((u) => u.posId === ACTIVE_POS_ID || u.role === 'superadmin');
    return users;
  },

  getAllUsersGlobal: async (): Promise<SystemUser[]> => {
    const snap = await get(ref(db, ROOT + '/users'));
    return snapshotToUsers(snap.val());
  },

  authenticate: async (username: string): Promise<SystemUser | null> => {
    const searchUsername = String(username || '').trim().toLowerCase();
    if (!searchUsername) return null;
    const snap = await get(ref(db, ROOT + '/users'));
    const users = snapshotToUsers(snap.val());
    const user = users.find((u) => (u.username || '').trim().toLowerCase() === searchUsername);
    if (!user || user.status === 'suspended' || user.status === 'locked') return null;
    const updated = { ...user, lastLogin: new Date().toISOString(), loginAttempts: 0 };
    await set(ref(db, ROOT + '/users/' + user.username), updated);
    await DataService.logAuditAction('login', username, 'User Logged In', user.posId ?? undefined);
    return updated;
  },

  authenticateMaster: async (username: string): Promise<SystemUser | null> => {
    if (username === 'master') {
      await DataService.logAuditAction('master_login', 'master', 'Platform Owner Access');
      return { username: 'master', role: 'platform_owner', name: 'Master Admin', posId: null, lastLogin: new Date().toISOString(), ip: '10.0.0.1' };
    }
    return null;
  },

  getCurrentUser: (): SystemUser | null => {
    const userStr = localStorage.getItem('currentUser');
    return userStr ? JSON.parse(userStr) : null;
  },
  getCurrentUserRole: (): string => {
    const userStr = localStorage.getItem('currentUser');
    const role = userStr ? JSON.parse(userStr).role : '';
    return role === 'empleado' ? 'barbero' : role;
  },

  /** Id del barbero (tabla Barber) cuando el usuario es rol barbero; null en caso contrario. */
  getCurrentBarberId: (): number | null => {
    const user = DataService.getCurrentUser();
    if (!user || (user.role !== 'barbero' && user.role !== 'empleado')) return null;
    const id = user.barberId;
    return id != null && id !== undefined ? id : null;
  },

  saveUser: async (user: SystemUser): Promise<void> => {
    user.username = (user.username || '').trim();
    if (!user.username) return;
    // Solo asignar sede por defecto si no se eligió ninguna (undefined); si es null = explícitamente sin sede
    if (ACTIVE_POS_ID && user.role !== 'superadmin' && user.posId === undefined && !['support', 'financial', 'commercial'].includes(user.role)) {
      user.posId = ACTIVE_POS_ID;
    }
    const snap = await get(ref(db, ROOT + '/users/' + user.username));
    const isUpdate = snap.exists();
    const toWrite: Record<string, unknown> = { ...user, status: user.status || 'active', loginAttempts: user.loginAttempts ?? 0 };
    // Al editar, si no se envió contraseña no sobrescribir la existente
    if (isUpdate && (user.password === undefined || user.password === null || user.password === '')) {
      const existing = snap.val() as SystemUser | null;
      if (existing?.password) toWrite.password = existing.password;
    }
    await set(ref(db, ROOT + '/users/' + user.username), toWrite);
    await DataService.logAuditAction(isUpdate ? 'update_user' : 'create_user', 'admin', `User: ${user.username}`, user.posId ?? undefined);
  },

  deleteUser: async (username: string): Promise<void> => {
    await remove(ref(db, ROOT + '/users/' + username));
    await DataService.logAuditAction('delete_user', 'admin', `Deleted user: ${username}`);
  },

  getSettings: async (): Promise<AppSettings> => {
    const snap = await get(ref(db, ROOT + '/settings'));
    const obj = snap.val() || {};
    const posSettings = ACTIVE_POS_ID != null ? obj[String(ACTIVE_POS_ID)] : null;
    return posSettings || DEFAULT_SETTINGS;
  },

  updateSettings: async (settings: AppSettings): Promise<void> => {
    const posId = ACTIVE_POS_ID!;
    await update(ref(db, ROOT + '/settings'), { [String(posId)]: { ...settings, posId } });
    await DataService.logAuditAction('update_settings', 'admin', 'Updated POS Settings', posId);
  },

  getGlobalSettings: async (): Promise<GlobalSettings> => {
    const snap = await get(ref(db, ROOT + '/globalSettings'));
    return snap.val() || DEFAULT_GLOBAL_SETTINGS;
  },

  updateGlobalSettings: async (settings: GlobalSettings): Promise<void> => {
    await set(ref(db, ROOT + '/globalSettings'), settings);
    await DataService.logAuditAction('update_global_settings', 'master', 'Updated Platform Branding/Settings');
  },

  logAuditAction: async (action: string, actor: string, details: string, posId?: number): Promise<void> => {
    const id = Date.now();
    const log: Record<string, unknown> = {
      id,
      action,
      actor,
      details,
      timestamp: new Date().toISOString(),
      ip: '192.168.1.1',
    };
    if (posId !== undefined && posId !== null) {
      log.posId = posId;
    }
    await set(ref(db, ROOT + '/auditLogs/' + id), log);
  },

  getAuditLogs: async (): Promise<AuditLog[]> => {
    const snap = await get(ref(db, ROOT + '/auditLogs'));
    const obj = snap.val() || {};
    return Object.values(obj).sort((a: AuditLog, b: AuditLog) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  getGlobalFinancialHistory: async () => {
    const [salesSnap, transSnap] = await Promise.all([
      get(ref(db, ROOT + '/sales')),
      get(ref(db, ROOT + '/financialTransactions')),
    ]);
    const sales = snapshotToArray<Sale>(salesSnap.val());
    const transactions = Object.values(transSnap.val() || {});
    const posRevenue: Record<number, number> = {};
    sales.forEach((s) => { posRevenue[s.posId] = (posRevenue[s.posId] || 0) + s.total; });
    return { totalRevenue: Object.values(posRevenue).reduce((a, b) => a + b, 0), posRevenue, transactions, sales };
  },

  getClients: async (): Promise<Client[]> => {
    if (ACTIVE_POS_ID == null) return [];
    const snap = await get(ref(db, ROOT + '/clients'));
    const arr = snapshotToArray<Client>(snap.val());
    return arr.filter((c) => c.posId === ACTIVE_POS_ID).map((c) => ({ ...c, id: Number(c.id) }));
  },

  /** Busca un cliente por teléfono en toda la base de datos (cualquier barbería). Normaliza solo dígitos. */
  findClientByPhone: async (phone: string): Promise<Client | null> => {
    const normalized = (phone || '').replace(/\D/g, '');
    if (normalized.length < 6) return null;
    const snap = await get(ref(db, ROOT + '/clients'));
    const arr = snapshotToArray<Client>(snap.val()) || [];
    const found = arr.find((c) => (c.telefono || '').replace(/\D/g, '') === normalized);
    return found ? { ...found, id: Number(found.id) } : null;
  },

  /** Solo clientes que tienen al menos una cita o una venta en esta sede (para barberos: solo de este barbero). */
  getClientsWithActivity: async (): Promise<Client[]> => {
    if (ACTIVE_POS_ID == null) return [];
    const [clientsSnap, apptsSnap, salesSnap] = await Promise.all([
      get(ref(db, ROOT + '/clients')),
      get(ref(db, ROOT + '/appointments')),
      get(ref(db, ROOT + '/sales')),
    ]);
    const allClients = snapshotToArray<Client>(clientsSnap.val()).filter((c) => c.posId === ACTIVE_POS_ID);
    let appts = snapshotToArray<Appointment>(apptsSnap.val()).filter((a) => a.posId === ACTIVE_POS_ID);
    let sales = snapshotToArray<Sale>(salesSnap.val()).filter((s) => s.posId === ACTIVE_POS_ID);
    const barberId = DataService.getCurrentBarberId();
    if (barberId != null) {
      appts = appts.filter((a) => a.barberoId === barberId);
      sales = sales.filter((s) => (s.barberoId ?? null) === barberId);
    }
    const clientIdsWithAppt = new Set(appts.map((a) => a.clienteId));
    const clientIdsWithSale = new Set(sales.map((s) => s.clienteId).filter(Boolean));
    const activeIds = new Set([...clientIdsWithAppt, ...clientIdsWithSale]);
    return allClients.filter((c) => activeIds.has(c.id)).map((c) => ({ ...c, id: Number(c.id) }));
  },

  addClient: async (client: Omit<Client, 'id' | 'posId'>): Promise<Client> => {
    const effectivePosId = ACTIVE_POS_ID ?? 1;
    const newClient = { ...client, id: Date.now(), posId: effectivePosId } as Client;
    await set(ref(db, ROOT + '/clients/' + newClient.id), newClient);
    await DataService.logAuditAction('create_client', 'system', `Registered client: ${client.nombre}`, effectivePosId);
    return newClient;
  },

  updateClient: async (client: Client): Promise<void> => {
    await set(ref(db, ROOT + '/clients/' + client.id), client);
  },

  toggleClientStatus: async (id: number): Promise<void> => {
    const snap = await get(ref(db, ROOT + '/clients/' + id));
    if (!snap.exists()) return;
    const client = snap.val() as Client;
    client.status = client.status === 'active' ? 'suspended' : 'active';
    await set(ref(db, ROOT + '/clients/' + id), client);
    await DataService.logAuditAction('toggle_client', 'admin', `Toggled client ${id} status`, client.posId);
  },

  calculatePoints: (amount: number, type: 'product' | 'service') => (type === 'service' ? 20 : Math.floor(amount)),

  getProducts: async (): Promise<Product[]> => {
    if (ACTIVE_POS_ID == null) return [];
    const snap = await get(ref(db, ROOT + '/products'));
    const arr = snapshotToArray<Product>(snap.val());
    return arr.filter((p) => p.posId === ACTIVE_POS_ID).map((p) => ({ ...p, id: Number(p.id) }));
  },

  setProducts: async (data: Product[]): Promise<void> => {
    const snap = await get(ref(db, ROOT + '/products'));
    const all: Record<string, Product> = snap.val() || {};
    const other = Object.fromEntries(Object.entries(all).filter(([, p]) => p.posId !== ACTIVE_POS_ID));
    const merged = { ...other, ...toObjectById(data) };
    await set(ref(db, ROOT + '/products'), merged);
  },

  addProduct: async (product: Omit<Product, 'id' | 'posId'>): Promise<Product> => {
    if (ACTIVE_POS_ID == null) throw new Error('No Active POS');
    const newProduct = { ...product, id: Date.now(), posId: ACTIVE_POS_ID } as Product;
    await set(ref(db, ROOT + '/products/' + newProduct.id), newProduct);
    await DataService.logAuditAction('create_product', 'admin', `Created product: ${product.producto}`, ACTIVE_POS_ID);
    return newProduct;
  },

  updateProduct: async (product: Product): Promise<void> => {
    await set(ref(db, ROOT + '/products/' + product.id), product);
  },

  getCart: (): CartItem[] => JSON.parse(localStorage.getItem('userCart') || '[]'),
  addToCart: (product: Product): CartItem[] => {
    const cart = DataService.getCart();
    const existing = cart.find((i) => i.id === product.id && i.type === 'producto');
    if (existing) existing.quantity += 1;
    else cart.push({ id: product.id, name: product.producto, price: product.precioVenta, quantity: 1, type: 'producto' });
    localStorage.setItem('userCart', JSON.stringify(cart));
    return cart;
  },
  updateCartQuantity: (itemId: number, quantity: number): CartItem[] => {
    let cart = DataService.getCart();
    const item = cart.find((i) => i.id === itemId);
    if (item) {
      item.quantity = quantity;
      if (item.quantity <= 0) cart = cart.filter((i) => i.id !== itemId);
    }
    localStorage.setItem('userCart', JSON.stringify(cart));
    return cart;
  },
  clearCart: () => localStorage.setItem('userCart', '[]'),

  getServices: async (): Promise<Service[]> => {
    if (ACTIVE_POS_ID == null) return [];
    const snap = await get(ref(db, ROOT + '/services'));
    const arr = snapshotToArray<Service>(snap.val());
    return arr.filter((s) => s.posId === ACTIVE_POS_ID).map((s) => ({ ...s, id: Number(s.id) }));
  },

  saveService: async (service: Service): Promise<void> => {
    await set(ref(db, ROOT + '/services/' + service.id), service);
  },

  addService: async (serviceData: Omit<Service, 'id' | 'posId'>): Promise<Service> => {
    if (ACTIVE_POS_ID == null) throw new Error('No Active POS');
    const newService = { ...serviceData, id: Date.now(), posId: ACTIVE_POS_ID } as Service;
    await set(ref(db, ROOT + '/services/' + newService.id), newService);
    await DataService.logAuditAction('create_service', 'admin', `Created service: ${serviceData.name}`, ACTIVE_POS_ID);
    return newService;
  },

  deleteService: async (id: number): Promise<void> => {
    await remove(ref(db, ROOT + '/services/' + id));
    await DataService.logAuditAction('delete_service', 'admin', `Deleted service ID: ${id}`, ACTIVE_POS_ID ?? undefined);
  },

  getBarbers: async (): Promise<Barber[]> => {
    if (ACTIVE_POS_ID == null) return [];
    const snap = await get(ref(db, ROOT + '/barbers'));
    const arr = snapshotToArray<Barber>(snap.val());
    return arr.filter((b) => b.posId === ACTIVE_POS_ID).map((b) => ({ ...b, id: Number(b.id) }));
  },

  /** Barbers de una sede (para Admin al asignar usuario barbero). No depende de ACTIVE_POS_ID. */
  getBarbersForPos: async (posId: number): Promise<Barber[]> => {
    const snap = await get(ref(db, ROOT + '/barbers'));
    const arr = snapshotToArray<Barber>(snap.val());
    return arr.filter((b) => b.posId === posId).map((b) => ({ ...b, id: Number(b.id) }));
  },

  addBarber: async (barber: Omit<Barber, 'id' | 'posId'>): Promise<Barber> => {
    if (ACTIVE_POS_ID == null) throw new Error('No Active POS');
    const newBarber = { ...barber, id: Date.now(), posId: ACTIVE_POS_ID } as Barber;
    await set(ref(db, ROOT + '/barbers/' + newBarber.id), newBarber);
    await DataService.logAuditAction('create_barber', 'admin', `Created barber: ${barber.name}`, ACTIVE_POS_ID);
    return newBarber;
  },

  updateBarber: async (barber: Barber): Promise<void> => {
    await set(ref(db, ROOT + '/barbers/' + barber.id), barber);
  },

  deleteBarber: async (id: number): Promise<void> => {
    await remove(ref(db, ROOT + '/barbers/' + id));
    await DataService.logAuditAction('delete_barber', 'admin', `Deleted barber ID: ${id}`, ACTIVE_POS_ID ?? undefined);
  },

  toggleBarberStatus: async (id: number): Promise<void> => {
    const snap = await get(ref(db, ROOT + '/barbers/' + id));
    if (!snap.exists()) return;
    const barber = snap.val() as Barber;
    barber.active = !barber.active;
    await set(ref(db, ROOT + '/barbers/' + id), barber);
    await DataService.logAuditAction('toggle_barber', 'admin', `Toggled barber ${id} status`, ACTIVE_POS_ID ?? undefined);
  },

  getAppointments: async (): Promise<Appointment[]> => {
    if (ACTIVE_POS_ID == null) return [];
    const role = DataService.getCurrentUserRole();
    const barberId = DataService.getCurrentBarberId();
    if ((role === 'barbero' || role === 'empleado') && barberId == null) return [];
    const snap = await get(ref(db, ROOT + '/appointments'));
    const arr = snapshotToArray<Appointment>(snap.val());
    let filtered = arr.filter((a) => a.posId === ACTIVE_POS_ID);
    if (barberId != null) filtered = filtered.filter((a) => a.barberoId === barberId);
    return filtered.map((a) => ({ ...a, id: Number(a.id) }));
  },

  checkAppointmentConflict: async (posId: number, barberId: number, date: string, time: string): Promise<boolean> => {
    const snap = await get(ref(db, ROOT + '/appointments'));
    const arr = snapshotToArray<Appointment>(snap.val());
    return arr.some((a) => a.posId === posId && a.barberoId === barberId && a.fecha === date && a.hora === time && a.estado !== 'cancelada');
  },

  setAppointments: async (data: Appointment[]): Promise<void> => {
    const snap = await get(ref(db, ROOT + '/appointments'));
    const all: Record<string, Appointment> = snap.val() || {};
    const barberId = DataService.getCurrentBarberId();
    let toMerge = data;
    if (ACTIVE_POS_ID != null && barberId != null) {
      const othersSamePos = Object.entries(all).filter(([, a]) => a.posId === ACTIVE_POS_ID && a.barberoId !== barberId);
      toMerge = [...Object.values(Object.fromEntries(othersSamePos)), ...data];
    }
    const other = Object.fromEntries(Object.entries(all).filter(([, a]) => a.posId !== ACTIVE_POS_ID));
    const merged = { ...other, ...toObjectById(toMerge) };
    await set(ref(db, ROOT + '/appointments'), merged);
  },

  getSales: async (): Promise<Sale[]> => {
    if (ACTIVE_POS_ID == null) return [];
    const role = DataService.getCurrentUserRole();
    const barberId = DataService.getCurrentBarberId();
    if ((role === 'barbero' || role === 'empleado') && barberId == null) return [];
    const snap = await get(ref(db, ROOT + '/sales'));
    const arr = snapshotToArray<Sale>(snap.val());
    let filtered = arr.filter((s) => s.posId === ACTIVE_POS_ID);
    if (barberId != null) filtered = filtered.filter((s) => (s.barberoId ?? null) === barberId);
    return filtered.map((s) => ({ ...s, id: Number(s.id) }));
  },

  setSales: async (data: Sale[]): Promise<void> => {
    const snap = await get(ref(db, ROOT + '/sales'));
    const all: Record<string, Sale> = snap.val() || {};
    const barberId = DataService.getCurrentBarberId();
    const currentPosId = ACTIVE_POS_ID!;
    let toMerge = data.map((s) => ({ ...s, posId: s.posId || currentPosId, barberoId: barberId ?? s.barberoId ?? undefined }));
    if (currentPosId != null && barberId != null) {
      const othersSamePos = Object.entries(all).filter(([, s]) => s.posId === currentPosId && (s.barberoId ?? null) !== barberId);
      toMerge = [...Object.values(Object.fromEntries(othersSamePos)), ...toMerge];
    }
    const other = Object.fromEntries(Object.entries(all).filter(([, s]) => s.posId !== currentPosId));
    const merged = { ...other, ...toObjectById(toMerge) };
    await set(ref(db, ROOT + '/sales'), merged);
  },

  getFinances: async (): Promise<FinanceRecord[]> => {
    if (ACTIVE_POS_ID == null) return [];
    const snap = await get(ref(db, ROOT + '/finances'));
    const arr = snapshotToArray<FinanceRecord>(snap.val());
    return arr.filter((f) => f.posId === ACTIVE_POS_ID);
  },

  setFinances: async (data: FinanceRecord[]): Promise<void> => {
    const snap = await get(ref(db, ROOT + '/finances'));
    const all: Record<string, FinanceRecord> = snap.val() || {};
    const other = Object.fromEntries(Object.entries(all).filter(([, f]) => f.posId !== ACTIVE_POS_ID));
    const merged = { ...other, ...toObjectById(data) };
    await set(ref(db, ROOT + '/finances'), merged);
  },

  logNotification: async (log: Omit<NotificationLog, 'id'>): Promise<void> => {
    const id = Date.now();
    await set(ref(db, ROOT + '/notificationLogs/' + id), { ...log, id });
    await DataService.logAuditAction('send_notification', 'system', `Notification to client ${log.clientId}`, log.posId);
  },

  getNotificationLogs: async (): Promise<NotificationLog[]> => {
    if (ACTIVE_POS_ID == null) return [];
    const snap = await get(ref(db, ROOT + '/notificationLogs'));
    const obj = snap.val() || {};
    return Object.values(obj).filter((l: NotificationLog) => l.posId === ACTIVE_POS_ID);
  },

  logSecurityEvent: (event: string, details: unknown) => {
    console.log('[SECURITY AUDIT]', new Date().toISOString(), event, details);
    DataService.logAuditAction('security_event', 'system', event);
  },

  getGlobalStats: async () => {
    const [salesSnap, usersSnap, posSnap, appSnap] = await Promise.all([
      get(ref(db, ROOT + '/sales')),
      get(ref(db, ROOT + '/users')),
      get(ref(db, ROOT + '/pointsOfSale')),
      get(ref(db, ROOT + '/appointments')),
    ]);
    const sales = snapshotToArray<Sale>(salesSnap.val());
    const users = snapshotToUsers(usersSnap.val());
    const sedes = snapshotToArray<PointOfSale>(posSnap.val());
    const appointments = snapshotToArray<Appointment>(appSnap.val());
    const totalRevenue = sales.reduce((acc, s) => acc + s.total, 0);
    return { totalRevenue, totalUsers: users.length, totalSedes: sedes.length, totalAppointments: appointments.length };
  },
};

// Inicializar Firebase al cargar (seed si está vacío)
DataService.initialize().catch(console.error);
