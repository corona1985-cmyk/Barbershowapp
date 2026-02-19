import { ref, get, set, update, remove, query, orderByChild, equalTo } from 'firebase/database';
import { db } from './firebase';
import { hashPassword, verifyPassword, isStoredHash } from './passwordHash';
import {
  Client,
  Product,
  Service,
  Barber,
  BarberWorkingHours,
  BarberBlockedSlot,
  BarberGalleryPhoto,
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

// Solo usuarios mínimos para poder acceder y crear sedes/barberos desde la app. El resto está en la base de datos (ver database-seed.json).
const INITIAL_USERS_MINIMAL: SystemUser[] = [
  { username: 'master', role: 'platform_owner', name: 'Master Admin', password: 'root', posId: null, status: 'active' },
  { username: 'superadmin', role: 'superadmin', name: 'Super Admin Global', password: 'admin', permissions: { canManageUsers: true, canViewReports: true }, status: 'active' },
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

function snapshotToArray<T extends { id?: number }>(val: unknown): T[] {
  if (val == null || typeof val !== 'object') return [];
  const obj = val as Record<string, T | null | undefined>;
  return Object.keys(obj)
    .filter((k) => obj[k] != null)
    .map((k) => {
      const item = obj[k]!;
      const id = typeof item.id === 'number' ? item.id : Number(k) || k;
      return { ...item, id } as T;
    });
}

function snapshotToUsers(val: unknown): SystemUser[] {
  if (val == null) return [];
  const obj = val as Record<string, SystemUser>;
  return Object.values(obj);
}

let ACTIVE_POS_ID: number | null = null;

/** Genera un ID numérico único para evitar colisiones al crear varios registros en el mismo ms. */
export function generateUniqueId(): number {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

const CACHE_TTL_MS = 50 * 1000;
const dataCache: Record<string, { data: unknown; ts: number }> = {};
function cacheGet<T>(key: string): T | null {
  const entry = dataCache[key];
  if (!entry || Date.now() - entry.ts > CACHE_TTL_MS) return null;
  return entry.data as T;
}
function cacheSet(key: string, data: unknown) {
  dataCache[key] = { data, ts: Date.now() };
}
function cacheInvalidate(prefix: string) {
  Object.keys(dataCache).forEach((k) => {
    if (k.startsWith(prefix)) delete dataCache[k];
  });
}

/** Lanza si el rol actual no está en la lista permitida. Usar antes de operaciones sensibles. */
function requireRole(allowedRoles: string[]): void {
  const role = DataService.getCurrentUserRole();
  const normalized = role === 'empleado' ? 'barbero' : role;
  if (!allowedRoles.includes(normalized)) {
    throw new Error('No tienes permiso para realizar esta acción.');
  }
}

export const DataService = {
  initialize: async (): Promise<void> => {
    const snap = await get(ref(db, ROOT + '/pointsOfSale'));
    if (!snap.exists()) {
      await set(ref(db, ROOT + '/pointsOfSale'), {});
      await set(ref(db, ROOT + '/clients'), {});
      await set(ref(db, ROOT + '/products'), {});
      await set(ref(db, ROOT + '/services'), {});
      await set(ref(db, ROOT + '/barbers'), {});
      await set(ref(db, ROOT + '/appointments'), {});
      await set(ref(db, ROOT + '/sales'), {});
      await set(ref(db, ROOT + '/finances'), {});
      await set(ref(db, ROOT + '/users'), toObjectByUsername(INITIAL_USERS_MINIMAL));
      await set(ref(db, ROOT + '/notificationLogs'), {});
      await set(ref(db, ROOT + '/auditLogs'), {});
      await set(ref(db, ROOT + '/financialTransactions'), {});
      await set(ref(db, ROOT + '/globalSettings'), DEFAULT_GLOBAL_SETTINGS);
      await set(ref(db, ROOT + '/userCart'), []);
    }
    // Asegurar que al menos master y superadmin existan (por si la BD ya tenía datos sin users)
    const usersSnap = await get(ref(db, ROOT + '/users'));
    const currentUsers = usersSnap.val() || {};
    const updates: Record<string, SystemUser> = {};
    for (const u of INITIAL_USERS_MINIMAL) {
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
    const key = 'pointsOfSale';
    const cached = cacheGet<PointOfSale[]>(key);
    if (cached) return cached;
    const snap = await get(ref(db, ROOT + '/pointsOfSale'));
    const arr = snapshotToArray<PointOfSale>(snap.val());
    const out = arr.map((p) => ({ ...p, id: Number(p.id), plan: p.plan || 'basic' }));
    cacheSet(key, out);
    return out;
  },

  /** Plan de la sede activa; usado para habilitar funciones Pro (ej. notificaciones barbero). */
  getCurrentPosPlan: async (): Promise<'basic' | 'pro'> => {
    if (ACTIVE_POS_ID == null) return 'basic';
    const list = await DataService.getPointsOfSale();
    const pos = list.find((p) => p.id === ACTIVE_POS_ID);
    return pos?.plan === 'pro' ? 'pro' : 'basic';
  },

  addPointOfSale: async (pos: Omit<PointOfSale, 'id'>): Promise<PointOfSale> => {
    const newPos = { ...pos, id: generateUniqueId(), isActive: true };
    await update(ref(db, ROOT + '/pointsOfSale/' + newPos.id), newPos);
    await set(ref(db, ROOT + '/settings/' + newPos.id), { ...DEFAULT_SETTINGS, posId: newPos.id, storeName: newPos.name });
    await DataService.logAuditAction('create_pos', 'master', `Created POS: ${newPos.name}`, newPos.id);
    return newPos;
  },

  updatePointOfSale: async (pos: PointOfSale): Promise<void> => {
    await set(ref(db, ROOT + '/pointsOfSale/' + pos.id), pos);
    await DataService.logAuditAction('update_pos', 'master', `Updated POS: ${pos.name}`, pos.id);
  },

  deletePointOfSale: async (id: number): Promise<void> => {
    await remove(ref(db, ROOT + '/pointsOfSale/' + id));
    await remove(ref(db, ROOT + '/settings/' + id));
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

  /** Busca usuario por username sin modificar datos (para registro/comprobaciones). */
  findUserByUsername: async (username: string): Promise<SystemUser | null> => {
    const searchUsername = String(username || '').trim().toLowerCase();
    if (!searchUsername) return null;
    const snap = await get(ref(db, ROOT + '/users'));
    const users = snapshotToUsers(snap.val());
    const user = users.find((u) => (u.username || '').trim().toLowerCase() === searchUsername);
    if (!user || user.status === 'suspended' || user.status === 'locked') return null;
    return user;
  },

  /** Autentica con usuario y contraseña. Verifica hash; no devuelve la contraseña. Lanza Error('NO_PASSWORD_SET') si el usuario no tiene contraseña asignada. */
  authenticate: async (username: string, password: string): Promise<SystemUser | null> => {
    const user = await DataService.findUserByUsername(username);
    if (!user) return null;
    const storedPassword = user.password;
    if (storedPassword === undefined || storedPassword === null || storedPassword === '') {
      throw new Error('NO_PASSWORD_SET');
    }
    const valid = await verifyPassword(password, storedPassword);
    if (!valid) return null;
    const updated = { ...user, lastLogin: new Date().toISOString(), loginAttempts: 0 };
    delete (updated as Record<string, unknown>).password;
    await set(ref(db, ROOT + '/users/' + user.username), { ...user, lastLogin: updated.lastLogin, loginAttempts: 0 });
    await DataService.logAuditAction('login', username, 'User Logged In', user.posId ?? undefined);
    return updated as SystemUser;
  },

  authenticateMaster: async (username: string): Promise<SystemUser | null> => {
    if (username === 'master') {
      await DataService.logAuditAction('master_login', 'master', 'Platform Owner Access');
      return { username: 'master', role: 'platform_owner', name: 'Master Admin', posId: null, lastLogin: new Date().toISOString(), ip: '10.0.0.1' };
    }
    return null;
  },

  getCurrentUser: (): SystemUser | null => {
    try {
      const userStr = localStorage.getItem('currentUser');
      if (!userStr) return null;
      const parsed = JSON.parse(userStr);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  },

  /** Obtiene el usuario actual desde Firebase (datos actualizados: name, photoUrl, etc.). */
  getCurrentUserFromFirebase: async (): Promise<SystemUser | null> => {
    const current = DataService.getCurrentUser();
    if (!current?.username) return null;
    const snap = await get(ref(db, ROOT + '/users/' + current.username));
    if (!snap.exists()) return null;
    return snap.val() as SystemUser;
  },

  /** El usuario logueado actualiza solo su propio nombre y/o foto. No toca contraseña ni otros campos. Actualiza localStorage para que la foto se vea en toda la app al instante. */
  updateCurrentUserProfile: async (updates: { name?: string; photoUrl?: string | null }): Promise<void> => {
    const current = DataService.getCurrentUser();
    if (!current?.username) throw new Error('No hay sesión iniciada.');
    const snap = await get(ref(db, ROOT + '/users/' + current.username));
    if (!snap.exists()) throw new Error('Usuario no encontrado.');
    const existing = snap.val() as Record<string, unknown>;
    const merged = { ...existing };
    if (updates.name !== undefined) merged.name = updates.name;
    if (updates.photoUrl !== undefined) merged.photoUrl = updates.photoUrl || null;
    Object.keys(merged).forEach((k) => { if (merged[k] === undefined) delete merged[k]; });
    await set(ref(db, ROOT + '/users/' + current.username), merged);
    const nextUser = { ...current, name: (merged.name as string) ?? current.name, photoUrl: (merged.photoUrl as string) ?? current.photoUrl };
    try {
      localStorage.setItem('currentUser', JSON.stringify(nextUser));
    } catch (_) {}
  },

  getCurrentUserRole: (): string => {
    try {
      const userStr = localStorage.getItem('currentUser');
      if (!userStr) return '';
      const parsed = JSON.parse(userStr);
      const role = parsed?.role ?? '';
      return role === 'empleado' ? 'barbero' : role;
    } catch {
      return '';
    }
  },

  /** Id del barbero (tabla Barber) cuando el usuario es rol barbero; null en caso contrario. */
  getCurrentBarberId: (): number | null => {
    const user = DataService.getCurrentUser();
    if (!user || (user.role !== 'barbero' && user.role !== 'empleado')) return null;
    const id = user.barberId;
    return id != null && id !== undefined ? id : null;
  },

  saveUser: async (user: SystemUser): Promise<void> => {
    const currentRole = DataService.getCurrentUserRole();
    if (currentRole === '') {
      if (user.role !== 'cliente') throw new Error('No tienes permiso para crear este tipo de usuario.');
    } else {
      requireRole(['superadmin', 'admin']);
    }
    user.username = (user.username || '').trim();
    if (!user.username) return;
    // Solo asignar sede por defecto si no se eligió ninguna (undefined); si es null = explícitamente sin sede
    if (ACTIVE_POS_ID && user.role !== 'superadmin' && user.posId === undefined && !['support', 'financial', 'commercial'].includes(user.role)) {
      user.posId = ACTIVE_POS_ID;
    }
    const snap = await get(ref(db, ROOT + '/users/' + user.username));
    const isUpdate = snap.exists();
    const existing = snap.exists() ? (snap.val() as SystemUser | null) : null;
    const toWrite: Record<string, unknown> = { ...user, status: user.status || 'active', loginAttempts: user.loginAttempts ?? 0 };
    if (isUpdate && existing?.lastLogin) toWrite.lastLogin = existing.lastLogin;
    // Al editar, si no se envió contraseña no sobrescribir la existente
    if (isUpdate && (user.password === undefined || user.password === null || user.password === '')) {
      if (existing?.password) toWrite.password = existing.password;
    } else if (toWrite.password && String(toWrite.password).trim() !== '' && !isStoredHash(String(toWrite.password))) {
      toWrite.password = await hashPassword(String(toWrite.password));
    }
    await set(ref(db, ROOT + '/users/' + user.username), toWrite);
    await DataService.logAuditAction(isUpdate ? 'update_user' : 'create_user', 'admin', `User: ${user.username}`, user.posId ?? undefined);
  },

  deleteUser: async (username: string): Promise<void> => {
    requireRole(['superadmin']);
    await remove(ref(db, ROOT + '/users/' + username));
    await DataService.logAuditAction('delete_user', 'admin', `Deleted user: ${username}`);
  },

  /** Barbería preferida del cliente (por QR o elección). Al iniciar sesión se abre esa barbería. Solo clientes. */
  getClientPreferredPos: async (username: string): Promise<number | null> => {
    const snap = await get(ref(db, ROOT + '/clientPreferences/' + encodeURIComponent(username)));
    const val = snap.val();
    if (val == null || typeof val.preferredPosId !== 'number') return null;
    return val.preferredPosId;
  },

  setClientPreferredPos: async (username: string, posId: number | null): Promise<void> => {
    await set(ref(db, ROOT + '/clientPreferences/' + encodeURIComponent(username)), { preferredPosId: posId });
  },

  getSettings: async (): Promise<AppSettings> => {
    if (ACTIVE_POS_ID == null) return DEFAULT_SETTINGS;
    const snap = await get(ref(db, ROOT + '/settings/' + ACTIVE_POS_ID));
    let posSettings = snap.val();
    if (posSettings == null) {
      const legacySnap = await get(ref(db, ROOT + '/settings'));
      const obj = legacySnap.val() || {};
      posSettings = obj[String(ACTIVE_POS_ID)];
    }
    return posSettings || DEFAULT_SETTINGS;
  },

  updateSettings: async (settings: AppSettings): Promise<void> => {
    if (ACTIVE_POS_ID == null) throw new Error('No hay sede activa. Selecciona una sede para guardar la configuración.');
    const role = DataService.getCurrentUserRole();
    const posId = ACTIVE_POS_ID;
    if (role === 'barbero') {
      const current = await DataService.getSettings();
      settings = { ...current, taxRate: settings.taxRate, currencySymbol: settings.currencySymbol };
    } else {
      requireRole(['admin', 'superadmin']);
    }
    await set(ref(db, ROOT + '/settings/' + posId), { ...settings, posId });
    await DataService.logAuditAction('update_settings', role === 'barbero' ? 'barbero' : 'admin', 'Updated POS Settings', posId);
  },

  getGlobalSettings: async (): Promise<GlobalSettings> => {
    const snap = await get(ref(db, ROOT + '/globalSettings'));
    return snap.val() || DEFAULT_GLOBAL_SETTINGS;
  },

  updateGlobalSettings: async (settings: GlobalSettings): Promise<void> => {
    requireRole(['platform_owner']);
    await set(ref(db, ROOT + '/globalSettings'), settings);
    await DataService.logAuditAction('update_global_settings', 'master', 'Updated Platform Branding/Settings');
  },

  logAuditAction: async (action: string, actor: string, details: string, posId?: number): Promise<void> => {
    const id = generateUniqueId();
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
    const arr = Object.values(obj) as AuditLog[];
    return arr.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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
    const key = `clients_${ACTIVE_POS_ID}`;
    const cached = cacheGet<Client[]>(key);
    if (cached) return cached;
    const q = query(ref(db, ROOT + '/clients'), orderByChild('posId'), equalTo(ACTIVE_POS_ID));
    const snap = await get(q);
    const arr = snapshotToArray<Client>(snap.val());
    const out = arr.map((c) => ({ ...c, id: Number(c.id) }));
    cacheSet(key, out);
    return out;
  },

  /** Fuerza recarga de clientes desde Firebase (invalida caché). Para ver fotos y datos actualizados tras Mi perfil. */
  refreshClients: async (): Promise<Client[]> => {
    cacheInvalidate('clients');
    return DataService.getClients();
  },

  /** Igual que refreshClients pero para la lista de barbero (clientes con actividad). */
  refreshClientsWithActivity: async (): Promise<Client[]> => {
    cacheInvalidate('clients');
    return DataService.getClientsWithActivity();
  },

  /** Busca un cliente por teléfono en toda la base de datos (cualquier barbería). Normaliza solo dígitos. */
  findClientByPhone: async (phone: string): Promise<Client | null> => {
    const normalized = String(phone ?? '').replace(/\D/g, '');
    if (normalized.length < 6) return null;
    const snap = await get(ref(db, ROOT + '/clients'));
    const arr = snapshotToArray<Client>(snap.val()) || [];
    const found = arr.find((c) => String(c.telefono || '').replace(/\D/g, '') === normalized);
    return found ? { ...found, id: Number(found.id) } : null;
  },

  /** Solo clientes que tienen al menos una cita o una venta en esta sede (para barberos: solo de este barbero). */
  getClientsWithActivity: async (): Promise<Client[]> => {
    if (ACTIVE_POS_ID == null) return [];
    const barberId = DataService.getCurrentBarberId();
    const key = `clientsActivity_${ACTIVE_POS_ID}_${barberId ?? 'all'}`;
    const cached = cacheGet<Client[]>(key);
    if (cached) return cached;
    const [clientsSnap, apptsSnap, salesSnap] = await Promise.all([
      get(query(ref(db, ROOT + '/clients'), orderByChild('posId'), equalTo(ACTIVE_POS_ID))),
      get(query(ref(db, ROOT + '/appointments'), orderByChild('posId'), equalTo(ACTIVE_POS_ID))),
      get(query(ref(db, ROOT + '/sales'), orderByChild('posId'), equalTo(ACTIVE_POS_ID))),
    ]);
    const allClients = snapshotToArray<Client>(clientsSnap.val()).map((c) => ({ ...c, id: Number(c.id) }));
    let appts = snapshotToArray<Appointment>(apptsSnap.val());
    let sales = snapshotToArray<Sale>(salesSnap.val());
    if (barberId != null) {
      appts = appts.filter((a) => a.barberoId === barberId);
      sales = sales.filter((s) => (s.barberoId ?? null) === barberId);
    }
    const clientIdsWithAppt = new Set(appts.map((a) => a.clienteId));
    const clientIdsWithSale = new Set(sales.map((s) => s.clienteId).filter(Boolean));
    const activeIds = new Set([...clientIdsWithAppt, ...clientIdsWithSale]);
    const out = allClients.filter((c) => activeIds.has(c.id));
    cacheSet(key, out);
    return out;
  },

  addClient: async (client: Omit<Client, 'id' | 'posId'>): Promise<Client> => {
    if (DataService.getCurrentUserRole() !== '') requireRole(['admin', 'superadmin', 'barbero', 'cliente']);
    const effectivePosId = ACTIVE_POS_ID ?? 1;
    const newClient = { ...client, id: generateUniqueId(), posId: effectivePosId } as Client;
    await set(ref(db, ROOT + '/clients/' + newClient.id), newClient);
    cacheInvalidate('clients');
    await DataService.logAuditAction('create_client', 'system', `Registered client: ${client.nombre}`, effectivePosId);
    return newClient;
  },

  /** Busca cliente por teléfono; si existe lo devuelve. Si no, crea uno nuevo. Evita duplicados. */
  addClientOrGetExisting: async (client: Omit<Client, 'id' | 'posId'>): Promise<Client> => {
    const phone = String(client.telefono ?? '').trim();
    if (phone.length >= 6) {
      const existing = await DataService.findClientByPhone(phone);
      if (existing) return existing;
    }
    return DataService.addClient(client);
  },

  updateClient: async (client: Client): Promise<void> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    await set(ref(db, ROOT + '/clients/' + client.id), client);
    cacheInvalidate('clients');
  },

  /** Obtiene un cliente por ID (cualquier sede). */
  getClientById: async (id: number): Promise<Client | null> => {
    const snap = await get(ref(db, ROOT + '/clients/' + id));
    if (!snap.exists()) return null;
    const c = snap.val() as Client;
    return { ...c, id: Number(c.id) };
  },

  /** Solo rol cliente: actualiza su propio perfil (nombre, teléfono, foto). Escribe el cliente completo para que photoUrl se persista bien en la lista. Sincroniza nombre y foto al usuario (users) y a localStorage. */
  updateClientProfileForCurrentUser: async (updates: { nombre?: string; telefono?: string; photoUrl?: string | null }): Promise<void> => {
    const user = DataService.getCurrentUser();
    if (!user || user.role !== 'cliente') throw new Error('Solo los clientes pueden editar su perfil aquí.');
    const clientId = user.clientId;
    if (clientId == null) throw new Error('No tienes un perfil de cliente vinculado. Contacta al administrador.');
    const client = await DataService.getClientById(clientId);
    if (!client) throw new Error('Perfil de cliente no encontrado.');
    const newNombre = updates.nombre !== undefined ? updates.nombre : client.nombre;
    const newTelefono = updates.telefono !== undefined ? updates.telefono : client.telefono;
    let newPhotoUrl: string | null = updates.photoUrl !== undefined ? (updates.photoUrl || null) : (client.photoUrl ?? null);
    if (typeof newPhotoUrl === 'string' && newPhotoUrl.length > 500000) {
      throw new Error('La imagen es demasiado grande. Usa una foto más pequeña o pega una URL de imagen.');
    }
    const merged: Client = {
      ...client,
      id: clientId,
      nombre: newNombre,
      telefono: newTelefono,
      photoUrl: newPhotoUrl ?? undefined,
    };
    const toWrite = JSON.parse(JSON.stringify(merged)) as Record<string, unknown>;
    Object.keys(toWrite).forEach((k) => { if (toWrite[k] === undefined) delete toWrite[k]; });
    await set(ref(db, ROOT + '/clients/' + clientId), toWrite);
    cacheInvalidate('clients');
    const photoValue = newPhotoUrl;
    const nameValue = newNombre || user.name;
    const userSnap = await get(ref(db, ROOT + '/users/' + user.username));
    if (userSnap.exists()) {
      const existingUser = userSnap.val() as Record<string, unknown>;
      const userMerged = { ...existingUser, name: nameValue, photoUrl: photoValue };
      Object.keys(userMerged).forEach((k) => { if (userMerged[k] === undefined) delete userMerged[k]; });
      await set(ref(db, ROOT + '/users/' + user.username), userMerged);
    }
    try {
      const cur = DataService.getCurrentUser();
      if (cur?.username === user.username) {
        localStorage.setItem('currentUser', JSON.stringify({ ...cur, name: nameValue, photoUrl: photoValue || undefined }));
      }
    } catch (_) {}
  },

  /** Asegura que el usuario cliente tenga un registro Client y clientId; si no existe, lo crea y enlaza. */
  ensureClientProfileForCurrentUser: async (): Promise<Client> => {
    const user = DataService.getCurrentUser();
    if (!user || user.role !== 'cliente') throw new Error('Solo aplica para usuarios con rol cliente.');
    if (user.clientId != null) {
      const existing = await DataService.getClientById(user.clientId);
      if (existing) return existing;
    }
    const effectivePosId = ACTIVE_POS_ID ?? 1;
    const newClient: Client = {
      id: generateUniqueId(),
      posId: effectivePosId,
      nombre: user.name || user.username || 'Cliente',
      telefono: '',
      email: '',
      ultimaVisita: '',
      notas: '',
      fechaRegistro: new Date().toISOString().split('T')[0],
      puntos: 0,
      status: 'active',
    };
    await set(ref(db, ROOT + '/clients/' + newClient.id), newClient);
    cacheInvalidate('clients');
    const userSnap = await get(ref(db, ROOT + '/users/' + user.username));
    const existingUser = userSnap.val() as SystemUser | null;
    if (existingUser) {
      await set(ref(db, ROOT + '/users/' + user.username), { ...existingUser, clientId: newClient.id });
    }
    return newClient;
  },

  toggleClientStatus: async (id: number): Promise<void> => {
    requireRole(['admin', 'superadmin']);
    const snap = await get(ref(db, ROOT + '/clients/' + id));
    if (!snap.exists()) return;
    const client = snap.val() as Client;
    client.status = client.status === 'active' ? 'suspended' : 'active';
    await set(ref(db, ROOT + '/clients/' + id), client);
    await DataService.logAuditAction('toggle_client', 'admin', `Toggled client ${id} status`, client.posId);
  },

  calculatePoints: (amount: number, type: 'product' | 'service') => (type === 'service' ? 20 : Math.floor(amount)),

  /** Si barberId se pasa (barbero), devuelve solo productos de ese barbero. Sin argumento: todos los de la sede (admin). */
  getProducts: async (barberId?: number): Promise<Product[]> => {
    if (ACTIVE_POS_ID == null) return [];
    const q = query(ref(db, ROOT + '/products'), orderByChild('posId'), equalTo(ACTIVE_POS_ID));
    const snap = await get(q);
    let list = snapshotToArray<Product>(snap.val()).map((p) => ({ ...p, id: Number(p.id), barberId: p.barberId ?? null }));
    if (barberId !== undefined) {
      list = list.filter((p) => p.barberId === barberId);
    }
    return list;
  },

  setProducts: async (data: Product[]): Promise<void> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    if (ACTIVE_POS_ID == null) throw new Error('No hay sede activa.');
    const snap = await get(ref(db, ROOT + '/products'));
    const all: Record<string, Product> = snap.val() || {};
    const merged = { ...all, ...toObjectById(data) };
    await set(ref(db, ROOT + '/products'), merged);
  },

  addProduct: async (product: Omit<Product, 'id' | 'posId' | 'barberId'>): Promise<Product> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    if (ACTIVE_POS_ID == null) throw new Error('No Active POS');
    const role = DataService.getCurrentUserRole();
    const barberId = role === 'barbero' ? DataService.getCurrentBarberId() ?? undefined : undefined;
    const newProduct = { ...product, id: generateUniqueId(), posId: ACTIVE_POS_ID, barberId: barberId ?? null } as Product;
    await set(ref(db, ROOT + '/products/' + newProduct.id), newProduct);
    await DataService.logAuditAction('create_product', role === 'barbero' ? 'barbero' : 'admin', `Created product: ${product.producto}`, ACTIVE_POS_ID);
    return newProduct;
  },

  updateProduct: async (product: Product): Promise<void> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    const barberId = DataService.getCurrentBarberId();
    const role = DataService.getCurrentUserRole();
    if (role === 'barbero' && barberId != null && product.barberId !== barberId) {
      throw new Error('Solo puedes editar tus propios productos.');
    }
    await set(ref(db, ROOT + '/products/' + product.id), product);
  },

  getCart: (): CartItem[] => {
    try {
      const raw = localStorage.getItem('userCart') || '[]';
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },
  addToCart: (product: Product): CartItem[] => {
    const cart = DataService.getCart();
    const existing = cart.find((i) => i.id === product.id && i.type === 'producto');
    if (existing) existing.quantity += 1;
    else cart.push({ id: product.id, name: product.producto, price: product.precioVenta, quantity: 1, type: 'producto' });
    localStorage.setItem('userCart', JSON.stringify(cart));
    return cart;
  },
  updateCartQuantity: (itemId: number, quantity: number, type?: 'producto' | 'servicio'): CartItem[] => {
    let cart = DataService.getCart();
    const item = cart.find((i) => i.id === itemId && (type === undefined || i.type === type));
    if (item) {
      item.quantity = quantity;
      if (item.quantity <= 0) cart = cart.filter((i) => !(i.id === itemId && (type === undefined || i.type === type)));
    }
    localStorage.setItem('userCart', JSON.stringify(cart));
    return cart;
  },
  clearCart: () => localStorage.setItem('userCart', '[]'),

  /** Si barberId se pasa, devuelve solo servicios de la sede (barberId null) + de ese barbero. Sin argumento: todos los de la sede (admin/config). */
  getServices: async (barberId?: number): Promise<Service[]> => {
    if (ACTIVE_POS_ID == null) return [];
    const q = query(ref(db, ROOT + '/services'), orderByChild('posId'), equalTo(ACTIVE_POS_ID));
    const snap = await get(q);
    let list = snapshotToArray<Service>(snap.val()).map((s) => ({ ...s, id: Number(s.id), barberId: s.barberId ?? null }));
    if (barberId !== undefined) {
      list = list.filter((s) => s.barberId == null || s.barberId === barberId);
    }
    return list;
  },

  saveService: async (service: Service): Promise<void> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    const barberId = DataService.getCurrentBarberId();
    const role = DataService.getCurrentUserRole();
    if (role === 'barbero' && barberId != null && service.barberId !== barberId) {
      throw new Error('Solo puedes editar tus propios servicios.');
    }
    await set(ref(db, ROOT + '/services/' + service.id), service);
  },

  addService: async (serviceData: Omit<Service, 'id' | 'posId'>): Promise<Service> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    if (ACTIVE_POS_ID == null) throw new Error('No Active POS');
    const role = DataService.getCurrentUserRole();
    const barberId = role === 'barbero' ? DataService.getCurrentBarberId() ?? undefined : undefined;
    const newService = { ...serviceData, id: generateUniqueId(), posId: ACTIVE_POS_ID, barberId: barberId ?? null } as Service;
    await set(ref(db, ROOT + '/services/' + newService.id), newService);
    await DataService.logAuditAction('create_service', role === 'barbero' ? 'barbero' : 'admin', `Created service: ${serviceData.name}`, ACTIVE_POS_ID);
    return newService;
  },

  deleteService: async (id: number): Promise<void> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    const barberId = DataService.getCurrentBarberId();
    const role = DataService.getCurrentUserRole();
    const snap = await get(ref(db, ROOT + '/services/' + id));
    if (!snap.exists()) return;
    const service = snap.val() as Service;
    if (role === 'barbero' && (service.barberId == null || service.barberId !== barberId)) {
      throw new Error('Solo puedes eliminar tus propios servicios.');
    }
    await remove(ref(db, ROOT + '/services/' + id));
    await DataService.logAuditAction('delete_service', role === 'barbero' ? 'barbero' : 'admin', `Deleted service ID: ${id}`, ACTIVE_POS_ID ?? undefined);
  },

  getBarbers: async (): Promise<Barber[]> => {
    if (ACTIVE_POS_ID == null) return [];
    const key = `barbers_${ACTIVE_POS_ID}`;
    const cached = cacheGet<Barber[]>(key);
    if (cached) return cached;
    const q = query(ref(db, ROOT + '/barbers'), orderByChild('posId'), equalTo(ACTIVE_POS_ID));
    const snap = await get(q);
    const out = snapshotToArray<Barber>(snap.val()).map((b) => ({ ...b, id: Number(b.id) }));
    cacheSet(key, out);
    return out;
  },

  /** Barbers de una sede (para Admin al asignar usuario barbero). No depende de ACTIVE_POS_ID. */
  getBarbersForPos: async (posId: number): Promise<Barber[]> => {
    const q = query(ref(db, ROOT + '/barbers'), orderByChild('posId'), equalTo(posId));
    const snap = await get(q);
    return snapshotToArray<Barber>(snap.val()).map((b) => ({ ...b, id: Number(b.id) }));
  },

  addBarber: async (barber: Omit<Barber, 'id' | 'posId'>): Promise<Barber> => {
    requireRole(['admin', 'superadmin']);
    if (ACTIVE_POS_ID == null) throw new Error('No Active POS');
    const newBarber = { ...barber, id: generateUniqueId(), posId: ACTIVE_POS_ID } as Barber;
    await set(ref(db, ROOT + '/barbers/' + newBarber.id), newBarber);
    cacheInvalidate('barbers');
    await DataService.logAuditAction('create_barber', 'admin', `Created barber: ${barber.name}`, ACTIVE_POS_ID);
    return newBarber;
  },

  updateBarber: async (barber: Barber): Promise<void> => {
    requireRole(['admin', 'superadmin']);
    const sanitized = JSON.parse(JSON.stringify(barber)) as Barber;
    await set(ref(db, ROOT + '/barbers/' + barber.id), sanitized);
    cacheInvalidate('barbers');
  },

  /** El barbero puede actualizar solo su propio horario de trabajo; admin/superadmin pueden actualizar cualquiera. */
  updateBarberWorkingHours: async (barberId: number, workingHours: BarberWorkingHours): Promise<void> => {
    const role = DataService.getCurrentUserRole();
    const currentBarberId = DataService.getCurrentBarberId();
    if (role === 'barbero' && currentBarberId !== barberId) throw new Error('Solo puedes editar tu propio horario.');
    if (role !== 'barbero') requireRole(['admin', 'superadmin']);
    const snap = await get(ref(db, ROOT + '/barbers/' + barberId));
    if (!snap.exists()) throw new Error('Barbero no encontrado.');
    const barber = snap.val() as Barber;
    const payload: Record<string, unknown> = { ...barber };
    if (workingHours && Object.keys(workingHours).length > 0) payload.workingHours = workingHours;
    else delete payload.workingHours;
    await set(ref(db, ROOT + '/barbers/' + barberId), payload);
    cacheInvalidate('barbers');
  },

  /** Horario de comida. El barbero solo puede editar el suyo. */
  updateBarberLunchBreak: async (barberId: number, lunchBreak: BarberWorkingHours): Promise<void> => {
    const role = DataService.getCurrentUserRole();
    const currentBarberId = DataService.getCurrentBarberId();
    if (role === 'barbero' && currentBarberId !== barberId) throw new Error('Solo puedes editar tu propio horario de comida.');
    if (role !== 'barbero') requireRole(['admin', 'superadmin']);
    const snap = await get(ref(db, ROOT + '/barbers/' + barberId));
    if (!snap.exists()) throw new Error('Barbero no encontrado.');
    const barber = snap.val() as Barber;
    const payload: Record<string, unknown> = { ...barber };
    if (lunchBreak && Object.keys(lunchBreak).length > 0) {
      const sanitized: Record<number, { start: string; end: string }> = {};
      for (const [day, val] of Object.entries(lunchBreak)) {
        if (val && typeof val === 'object' && val.start != null && val.end != null) sanitized[Number(day)] = { start: String(val.start), end: String(val.end) };
      }
      if (Object.keys(sanitized).length > 0) payload.lunchBreak = sanitized;
      else delete payload.lunchBreak;
    } else delete payload.lunchBreak;
    await set(ref(db, ROOT + '/barbers/' + barberId), payload);
    cacheInvalidate('barbers');
  },

  /** Bloquear/desbloquear horas (salidas). El barbero solo puede editar las suyas. */
  updateBarberBlockedHours: async (barberId: number, blockedHours: BarberBlockedSlot[]): Promise<void> => {
    const role = DataService.getCurrentUserRole();
    const currentBarberId = DataService.getCurrentBarberId();
    if (role === 'barbero' && currentBarberId !== barberId) throw new Error('Solo puedes editar tus propias horas bloqueadas.');
    if (role !== 'barbero') requireRole(['admin', 'superadmin']);
    const snap = await get(ref(db, ROOT + '/barbers/' + barberId));
    if (!snap.exists()) throw new Error('Barbero no encontrado.');
    const barber = snap.val() as Barber;
    const payload: Record<string, unknown> = { ...barber };
    if (blockedHours?.length) payload.blockedHours = blockedHours;
    else delete payload.blockedHours;
    await set(ref(db, ROOT + '/barbers/' + barberId), payload);
    cacheInvalidate('barbers');
  },

  getBarberGallery: async (barberId: number): Promise<BarberGalleryPhoto[]> => {
    const snap = await get(ref(db, ROOT + '/barberGallery/' + barberId));
    if (!snap.exists()) return [];
    const val = snap.val();
    if (val == null || typeof val !== 'object') return [];
    const obj = val as Record<string, BarberGalleryPhoto & { id?: number }>;
    return Object.entries(obj)
      .filter(([, v]) => v != null)
      .map(([k, v]) => ({ ...v, id: typeof v.id === 'number' ? v.id : Number(k) || 0 } as BarberGalleryPhoto))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },

  addBarberGalleryPhoto: async (barberId: number, data: { imageUrl?: string; serviceId?: number | null; caption?: string }): Promise<BarberGalleryPhoto> => {
    const role = DataService.getCurrentUserRole();
    const currentBarberId = DataService.getCurrentBarberId();
    if (role === 'barbero' && currentBarberId !== barberId) throw new Error('Solo puedes agregar fotos a tu propia galería.');
    if (role !== 'barbero') requireRole(['admin', 'superadmin']);
    const posId = ACTIVE_POS_ID;
    if (posId == null) throw new Error('No hay sede activa.');
    const imageUrl = data.imageUrl?.trim();
    if (!imageUrl) throw new Error('Indica una imagen (sube un archivo o pega una URL).');
    const id = generateUniqueId();
    const photo: BarberGalleryPhoto = {
      id,
      barberId,
      posId,
      imageUrl,
      serviceId: data.serviceId ?? null,
      caption: data.caption?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    const payload = JSON.parse(JSON.stringify(photo)) as Record<string, unknown>;
    await set(ref(db, ROOT + '/barberGallery/' + barberId + '/' + id), payload);
    return photo;
  },

  deleteBarberGalleryPhoto: async (barberId: number, photoId: number): Promise<void> => {
    const role = DataService.getCurrentUserRole();
    const currentBarberId = DataService.getCurrentBarberId();
    if (role === 'barbero' && currentBarberId !== barberId) throw new Error('Solo puedes eliminar fotos de tu propia galería.');
    if (role !== 'barbero') requireRole(['admin', 'superadmin']);
    await remove(ref(db, ROOT + '/barberGallery/' + barberId + '/' + photoId));
  },

  deleteBarber: async (id: number): Promise<void> => {
    requireRole(['admin', 'superadmin']);
    await remove(ref(db, ROOT + '/barbers/' + id));
    cacheInvalidate('barbers');
    await DataService.logAuditAction('delete_barber', 'admin', `Deleted barber ID: ${id}`, ACTIVE_POS_ID ?? undefined);
  },

  toggleBarberStatus: async (id: number): Promise<void> => {
    requireRole(['admin', 'superadmin']);
    const snap = await get(ref(db, ROOT + '/barbers/' + id));
    if (!snap.exists()) return;
    const barber = snap.val() as Barber;
    barber.active = !barber.active;
    await set(ref(db, ROOT + '/barbers/' + id), barber);
    cacheInvalidate('barbers');
    await DataService.logAuditAction('toggle_barber', 'admin', `Toggled barber ${id} status`, ACTIVE_POS_ID ?? undefined);
  },

  getAppointments: async (): Promise<Appointment[]> => {
    if (ACTIVE_POS_ID == null) return [];
    const role = DataService.getCurrentUserRole();
    const barberId = DataService.getCurrentBarberId();
    if ((role === 'barbero' || role === 'empleado') && barberId == null) return [];
    const key = `appointments_${ACTIVE_POS_ID}_${barberId ?? 'all'}`;
    const cached = cacheGet<Appointment[]>(key);
    if (cached) return cached;
    const q = query(ref(db, ROOT + '/appointments'), orderByChild('posId'), equalTo(ACTIVE_POS_ID));
    const snap = await get(q);
    let arr = snapshotToArray<Appointment>(snap.val()).map((a) => ({ ...a, id: Number(a.id) }));
    if (barberId != null) arr = arr.filter((a) => a.barberoId === barberId);
    cacheSet(key, arr);
    return arr;
  },

  checkAppointmentConflict: async (posId: number, barberId: number, date: string, time: string): Promise<boolean> => {
    const q = query(ref(db, ROOT + '/appointments'), orderByChild('posId'), equalTo(posId));
    const snap = await get(q);
    const arr = snapshotToArray<Appointment>(snap.val());
    return arr.some((a) => a.barberoId === barberId && a.fecha === date && a.hora === time && a.estado !== 'cancelada');
  },

  /** Añade una cita sin reemplazar las demás (para reservas de cliente o invitado). Sin undefined para evitar fallos en móvil. */
  addAppointment: async (appointment: Omit<Appointment, 'id'>): Promise<Appointment> => {
    const id = generateUniqueId();
    const apt: Appointment = { ...appointment, id };
    const toWrite = JSON.parse(JSON.stringify(apt)) as Record<string, unknown>;
    await set(ref(db, ROOT + '/appointments/' + id), toWrite);
    cacheInvalidate('appointments');
    cacheInvalidate('clientsActivity');
    return apt;
  },

  /** Actualiza una cita (escritura por ítem; evita leer/escribir todo el nodo). */
  updateAppointment: async (apt: Appointment): Promise<void> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    await set(ref(db, ROOT + '/appointments/' + apt.id), apt);
    cacheInvalidate('appointments');
    cacheInvalidate('clientsActivity');
  },

  /** Elimina una cita (escritura por ítem). */
  deleteAppointment: async (id: number): Promise<void> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    await remove(ref(db, ROOT + '/appointments/' + id));
    cacheInvalidate('appointments');
    cacheInvalidate('clientsActivity');
  },

  /** @deprecated Usar addAppointment / updateAppointment / deleteAppointment para no sobrecargar con muchas sedes. */
  setAppointments: async (data: Appointment[]): Promise<void> => {
    requireRole(['admin', 'superadmin', 'barbero']);
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
    cacheInvalidate('appointments');
    cacheInvalidate('clientsActivity');
  },

  getSales: async (): Promise<Sale[]> => {
    if (ACTIVE_POS_ID == null) return [];
    const role = DataService.getCurrentUserRole();
    const barberId = DataService.getCurrentBarberId();
    if ((role === 'barbero' || role === 'empleado') && barberId == null) return [];
    const key = `sales_${ACTIVE_POS_ID}_${barberId ?? 'all'}`;
    const cached = cacheGet<Sale[]>(key);
    if (cached) return cached;
    const q = query(ref(db, ROOT + '/sales'), orderByChild('posId'), equalTo(ACTIVE_POS_ID));
    const snap = await get(q);
    let arr = snapshotToArray<Sale>(snap.val()).map((s) => ({ ...s, id: Number(s.id) }));
    if (barberId != null) arr = arr.filter((s) => (s.barberoId ?? null) === barberId);
    cacheSet(key, arr);
    return arr;
  },

  /** Ventas de una sede concreta (para reportes por sede en Multi-Sede). No depende de ACTIVE_POS_ID. */
  getSalesForPos: async (posId: number): Promise<Sale[]> => {
    const q = query(ref(db, ROOT + '/sales'), orderByChild('posId'), equalTo(posId));
    const snap = await get(q);
    return snapshotToArray<Sale>(snap.val()).map((s) => ({ ...s, id: Number(s.id) }));
  },

  /** Citas de una sede concreta (para reportes por sede en Multi-Sede). No depende de ACTIVE_POS_ID. */
  getAppointmentsForPos: async (posId: number): Promise<Appointment[]> => {
    const q = query(ref(db, ROOT + '/appointments'), orderByChild('posId'), equalTo(posId));
    const snap = await get(q);
    return snapshotToArray<Appointment>(snap.val()).map((a) => ({ ...a, id: Number(a.id) }));
  },

  /** Añade una venta (escritura por ítem; evita leer/escribir todo el nodo). */
  addSale: async (sale: Sale): Promise<void> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    if (ACTIVE_POS_ID == null) throw new Error('No hay sede activa. No se puede registrar la venta.');
    const s = { ...sale, posId: sale.posId || ACTIVE_POS_ID, barberoId: sale.barberoId ?? DataService.getCurrentBarberId() ?? undefined };
    await set(ref(db, ROOT + '/sales/' + s.id), s);
    cacheInvalidate('sales');
    cacheInvalidate('clientsActivity');
  },

  /** @deprecated Usar addSale para nuevas ventas; evita contención con muchas sedes. */
  setSales: async (data: Sale[]): Promise<void> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    if (ACTIVE_POS_ID == null) throw new Error('No hay sede activa. No se puede registrar la venta.');
    const snap = await get(ref(db, ROOT + '/sales'));
    const all: Record<string, Sale> = snap.val() || {};
    const barberId = DataService.getCurrentBarberId();
    const currentPosId = ACTIVE_POS_ID;
    let toMerge: Sale[] = data.map((s) => ({ ...s, posId: s.posId || currentPosId, barberoId: barberId ?? s.barberoId ?? undefined }));
    if (currentPosId != null && barberId != null) {
      const othersSamePos = Object.entries(all).filter(([, s]) => s.posId === currentPosId && (s.barberoId ?? null) !== barberId);
      toMerge = [...Object.values(Object.fromEntries(othersSamePos)), ...toMerge] as Sale[];
    }
    const other = Object.fromEntries(Object.entries(all).filter(([, s]) => s.posId !== currentPosId));
    const merged = { ...other, ...toObjectById(toMerge) };
    await set(ref(db, ROOT + '/sales'), merged);
    cacheInvalidate('sales');
    cacheInvalidate('clientsActivity');
  },

  getFinances: async (): Promise<FinanceRecord[]> => {
    if (ACTIVE_POS_ID == null) return [];
    const q = query(ref(db, ROOT + '/finances'), orderByChild('posId'), equalTo(ACTIVE_POS_ID));
    const snap = await get(q);
    return snapshotToArray<FinanceRecord>(snap.val()).map((f) => ({ ...f, id: Number(f.id) }));
  },

  /** Añade un registro de finanzas (escritura por ítem). */
  addFinanceRecord: async (record: Omit<FinanceRecord, 'id'>): Promise<FinanceRecord> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    if (ACTIVE_POS_ID == null) throw new Error('No hay sede activa.');
    const id = generateUniqueId();
    const full: FinanceRecord = { ...record, id, posId: record.posId ?? ACTIVE_POS_ID };
    await set(ref(db, ROOT + '/finances/' + id), full);
    return full;
  },

  /** Actualiza un registro de finanzas (escritura por ítem). */
  updateFinanceRecord: async (record: FinanceRecord): Promise<void> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    await set(ref(db, ROOT + '/finances/' + record.id), record);
  },

  setFinances: async (data: FinanceRecord[]): Promise<void> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    const snap = await get(ref(db, ROOT + '/finances'));
    const all: Record<string, FinanceRecord> = snap.val() || {};
    const other = Object.fromEntries(Object.entries(all).filter(([, f]) => f.posId !== ACTIVE_POS_ID));
    const merged = { ...other, ...toObjectById(data) };
    await set(ref(db, ROOT + '/finances'), merged);
  },

  logNotification: async (log: Omit<NotificationLog, 'id'>): Promise<void> => {
    const id = generateUniqueId();
    await set(ref(db, ROOT + '/notificationLogs/' + id), { ...log, id });
    await DataService.logAuditAction('send_notification', 'system', `Notification to client ${log.clientId}`, log.posId);
  },

  getNotificationLogs: async (): Promise<NotificationLog[]> => {
    if (ACTIVE_POS_ID == null) return [];
    const q = query(ref(db, ROOT + '/notificationLogs'), orderByChild('posId'), equalTo(ACTIVE_POS_ID));
    const snap = await get(q);
    const arr = snapshotToArray<NotificationLog>(snap.val());
    return arr.map((l) => ({ ...l, id: Number(l.id) }));
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
