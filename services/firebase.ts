import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, connectDatabaseEmulator, ref, get, query, orderByChild, equalTo } from 'firebase/database';
import {
  getAuth,
  signInAnonymously,
  signInWithCustomToken,
  signOut,
  connectAuthEmulator,
  onAuthStateChanged,
} from 'firebase/auth';
import { initializeFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAnalytics, isSupported, logEvent } from 'firebase/analytics';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { Capacitor } from '@capacitor/core';
import { FUNCTIONS_REGION, getFirebaseWebConfig, getRecaptchaSiteKey, useFirebaseEmulators } from '../config/firebaseEnv';
import { clearSessionClaims, parseTokenClaims, setCachedClaims, type SessionClaims } from './session';
import type { PointOfSale, Service, Barber, BarberGalleryPhoto, Appointment } from '../types';

const firebaseConfig = getFirebaseWebConfig();
const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

export const db = getDatabase(app);
export const auth = getAuth(app);
export const firestore = initializeFirestore(
  app,
  Capacitor.isNativePlatform()
    ? { experimentalForceLongPolling: true }
    : { experimentalAutoDetectLongPolling: true }
);
export const functions = getFunctions(app, FUNCTIONS_REGION);

const usingEmulators = useFirebaseEmulators();
if (usingEmulators && typeof window !== 'undefined' && !(window as unknown as { __bsEmu?: boolean }).__bsEmu) {
  (window as unknown as { __bsEmu?: boolean }).__bsEmu = true;
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
  connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
}

const recaptchaKey = getRecaptchaSiteKey();
if (typeof window !== 'undefined' && recaptchaKey && !usingEmulators) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(recaptchaKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch {
    // App Check opcional hasta configurar la clave
  }
}

export const APP_VERSION = '1.0.10';

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    clearSessionClaims();
    return;
  }
  try {
    let token = await user.getIdTokenResult();
    let parsed = parseTokenClaims(token.claims as Record<string, unknown>);
    if (!parsed) {
      token = await user.getIdTokenResult(true);
      parsed = parseTokenClaims(token.claims as Record<string, unknown>);
    }
    setCachedClaims(parsed);
  } catch {
    clearSessionClaims();
  }
});

export async function getAuthIdToken(): Promise<string | null> {
  if (!auth.currentUser) return null;
  return auth.currentUser.getIdToken();
}

export async function applyCustomToken(customToken: string): Promise<SessionClaims | null> {
  const cred = await signInWithCustomToken(auth, customToken);
  const token = await cred.user.getIdTokenResult(true);
  const claims = parseTokenClaims(token.claims as Record<string, unknown>);
  setCachedClaims(claims);
  return claims;
}

export async function refreshSessionClaims(): Promise<SessionClaims | null> {
  if (!auth.currentUser) {
    clearSessionClaims();
    return null;
  }
  const token = await auth.currentUser.getIdTokenResult(true);
  const claims = parseTokenClaims(token.claims as Record<string, unknown>);
  setCachedClaims(claims);
  return claims;
}

export async function signOutSession(): Promise<void> {
  clearSessionClaims();
  await signOut(auth).catch(() => undefined);
}

/** Garantiza una sesión anónima solo para flujos que aún la requieren (no RTDB de negocio). */
export async function ensureAnonymousAuth(): Promise<void> {
  if (auth.currentUser) return;
  await signInAnonymously(auth);
}

export async function getAnalyticsIfSupported() {
  if (!(await isSupported())) return null;
  return getAnalytics(app);
}

export async function logAnalyticsEvent(name: string, params: Record<string, unknown>): Promise<void> {
  try {
    const analytics = await getAnalyticsIfSupported();
    if (!analytics) return;
    logEvent(analytics, name, params);
  } catch {
    // no-op
  }
}

function callable<Req, Res>(name: string) {
  return httpsCallable<Req, Res>(functions, name);
}

export async function sendWhatsAppFromApp(to: string, body: string): Promise<{ success: boolean; sid?: string }> {
  const fn = callable<{ to: string; body: string }, { success: boolean; sid?: string }>('sendWhatsAppMessage');
  const result = await fn({ to, body });
  return result.data;
}

export interface MasterAuthResult {
  customToken?: string;
  user: { username: string; role: 'platform_owner'; name: string; posId: number | null };
}

export async function authenticateMasterWithPassword(username: string, password: string): Promise<MasterAuthResult> {
  const fn = callable<{ username: string; password: string }, MasterAuthResult>('authenticateMasterWithPassword');
  const result = await fn({ username: username.trim(), password });
  if (result.data.customToken) await applyCustomToken(result.data.customToken);
  return result.data;
}

export type PlanCheckoutProvider = 'stripe' | 'mercadopago' | 'paypal';

export async function createPlanCheckout(params: {
  plan: string;
  ciclo: 'mensual' | 'anual';
  email: string;
  nombreNegocio?: string;
  nombreRepresentante?: string;
  provider?: PlanCheckoutProvider;
}): Promise<{ url: string }> {
  const fn = callable<typeof params, { url: string }>('createPlanCheckout');
  const result = await fn(params);
  return result.data;
}

export async function loginWithPassword(username: string, password: string): Promise<{ user: Record<string, unknown> }> {
  const fn = callable<{ username: string; password: string }, { customToken: string; user: Record<string, unknown> }>('loginWithPassword');
  const result = await fn({ username, password });
  await applyCustomToken(result.data.customToken);
  return { user: result.data.user };
}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const fn = callable<{ username: string }, { taken: boolean }>('checkUsernameAvailable');
  const result = await fn({ username });
  return result.data.taken;
}

export async function activatePlanFromPlay(params: {
  purchaseToken?: string;
  productId: string;
  receiptData?: string;
  platform?: string;
}): Promise<{ success: boolean; message?: string }> {
  const fn = callable<typeof params, { success: boolean }>('activatePlanFromPlay');
  try {
    const result = await fn(params);
    await refreshSessionClaims();
    return result.data;
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'No se pudo activar el plan.' };
  }
}

export interface CompleteSelfSignupFreeParams {
  username: string;
  password: string;
  name: string;
  phone: string;
  email?: string;
  barbershopName: string;
  address: string;
  country: string;
  city: string;
  barrio: string;
  lat?: number;
  lng?: number;
}

export async function completeSelfSignupFree(params: CompleteSelfSignupFreeParams): Promise<{ success: true }> {
  const fn = callable<CompleteSelfSignupFreeParams, { success: true; customToken: string }>('completeSelfSignupFree');
  const result = await fn(params);
  if (result.data.customToken) await applyCustomToken(result.data.customToken);
  return { success: true };
}

export interface CreatePendingBarberSignupParams {
  username: string;
  password: string;
  name: string;
  phone: string;
  email?: string;
  barbershopName: string;
  address: string;
  country?: string;
  city?: string;
  barrio?: string;
  lat?: number;
  lng?: number;
  plan: 'solo' | 'barberia' | 'multisede';
  ciclo: 'mensual' | 'anual';
}

export async function createPendingBarberSignup(params: CreatePendingBarberSignupParams): Promise<{ url: string }> {
  const fn = callable<CreatePendingBarberSignupParams, { url: string; customToken?: string }>('createPendingBarberSignup');
  const result = await fn(params);
  if (result.data.customToken) await applyCustomToken(result.data.customToken);
  return { url: result.data.url };
}

export async function createPendingBarberSignupMobile(params: CreatePendingBarberSignupParams): Promise<{ success: true }> {
  const fn = callable<CreatePendingBarberSignupParams, { success: true; customToken: string }>('createPendingBarberSignupMobile');
  const result = await fn(params);
  if (result.data.customToken) await applyCustomToken(result.data.customToken);
  return { success: true };
}

export async function registerClientAccount(params: {
  username: string;
  password: string;
  name: string;
  phone: string;
  posId: number;
}): Promise<{ user: Record<string, unknown> }> {
  const fn = callable<typeof params, { customToken: string; user: Record<string, unknown> }>('registerClientAccount');
  const result = await fn(params);
  await applyCustomToken(result.data.customToken);
  return { user: result.data.user };
}

export async function upsertStaffUser(user: Record<string, unknown>): Promise<void> {
  const fn = callable<Record<string, unknown>, { success: boolean }>('upsertStaffUser');
  await fn(user);
}

export async function deleteStaffUser(username: string): Promise<void> {
  const fn = callable<{ username: string }, { success: boolean }>('deleteStaffUser');
  await fn({ username });
}

export async function updateMyProfile(updates: { name?: string; photoUrl?: string | null }): Promise<void> {
  const fn = callable<typeof updates, { success: boolean }>('updateMyProfile');
  await fn(updates);
}

export async function adminSetPosPlan(posId: number, tier: string, plan: string, subscriptionExpiresAt?: string | null): Promise<void> {
  const fn = callable<{ posId: number; tier: string; plan: string; subscriptionExpiresAt?: string | null }, { success: boolean }>('adminSetPosPlan');
  await fn({ posId, tier, plan, subscriptionExpiresAt });
}

export async function adminUpsertPointOfSale(pos: Record<string, unknown>): Promise<{ pos: PointOfSale }> {
  const fn = callable<Record<string, unknown>, { pos: PointOfSale }>('adminUpsertPointOfSale');
  const result = await fn(pos);
  return result.data;
}

export async function adminDeletePointOfSale(posId: number): Promise<void> {
  const fn = callable<{ posId: number }, { success: boolean }>('adminDeletePointOfSale');
  await fn({ posId });
}

export async function switchActivePos(posId: number): Promise<void> {
  const fn = callable<{ posId: number }, { success: boolean }>('switchActivePos');
  await fn({ posId });
  await refreshSessionClaims();
}

export async function deleteMyAccount(payload: {
  password: string;
  reason: string;
  customReason?: string;
  improvementFeedback?: string;
  platform?: string;
  appVersion?: string;
}): Promise<void> {
  const fn = callable<typeof payload, { success: boolean }>('deleteMyAccount');
  await fn(payload);
  await signOutSession();
}

const PUBLIC_ROOT = 'barbershow';

function toPublicShop(raw: unknown): PointOfSale | null {
  if (!raw || typeof raw !== 'object') return null;
  const pos = raw as Record<string, unknown>;
  if (pos.isActive === false) return null;
  const id = Number(pos.id);
  if (!Number.isFinite(id)) return null;
  return {
    id,
    name: String(pos.name || ''),
    address: String(pos.address || ''),
    country: typeof pos.country === 'string' ? pos.country : undefined,
    city: typeof pos.city === 'string' ? pos.city : undefined,
    barrio: typeof pos.barrio === 'string' ? pos.barrio : undefined,
    lat: typeof pos.lat === 'number' ? pos.lat : undefined,
    lng: typeof pos.lng === 'number' ? pos.lng : undefined,
    ownerId: '',
    isActive: pos.isActive !== false,
    about: typeof pos.about === 'string' ? pos.about : undefined,
    highlights: Array.isArray(pos.highlights) ? pos.highlights.filter((x): x is string => typeof x === 'string') : undefined,
  };
}

export async function listPublicShops(): Promise<PointOfSale[]> {
  const snap = await get(ref(db, `${PUBLIC_ROOT}/publicShops`));
  const raw = (snap.val() || {}) as Record<string, unknown>;
  return Object.entries(raw)
    .filter(([key, shop]) => key !== '_ready' && shop && typeof shop === 'object')
    .map(([, shop]) => toPublicShop(shop))
    .filter((shop): shop is PointOfSale => shop != null)
    .slice(0, 150);
}

export type PublicBusySlot = Pick<Appointment, 'barberoId' | 'fecha' | 'hora' | 'duracionTotal' | 'estado'>;

export async function getPublicBookingCatalog(posId: number): Promise<{
  shop: PointOfSale;
  services: Service[];
  barbers: Barber[];
  busySlots: PublicBusySlot[];
  galleries: Record<string, BarberGalleryPhoto[]>;
}> {
  const shopSnap = await get(ref(db, `${PUBLIC_ROOT}/publicShops/${posId}`));
  const shop = toPublicShop(shopSnap.val());
  if (!shop) throw new Error('Barbería no encontrada.');
  const [servicesSnap, barbersSnap] = await Promise.all([
    get(query(ref(db, `${PUBLIC_ROOT}/services`), orderByChild('posId'), equalTo(posId))),
    get(query(ref(db, `${PUBLIC_ROOT}/barbers`), orderByChild('posId'), equalTo(posId))),
  ]);
  const services = Object.values((servicesSnap.val() || {}) as Record<string, Record<string, unknown>>).map((s) => ({
    id: Number(s.id),
    posId,
    name: String(s.name || ''),
    price: Number(s.price || 0),
    duration: Number(s.duration || 30),
    barberId: s.barberId == null ? null : Number(s.barberId),
  })) as Service[];
  const barbers = Object.values((barbersSnap.val() || {}) as Record<string, Record<string, unknown>>)
    .filter((b) => b && b.active !== false)
    .map((b) => ({
      id: Number(b.id),
      posId,
      name: String(b.name || ''),
      specialty: String(b.specialty || ''),
      active: true,
      workingHours: b.workingHours || undefined,
      lunchBreak: b.lunchBreak || undefined,
      blockedHours: b.blockedHours || undefined,
    })) as Barber[];
  const dayMs = 24 * 60 * 60 * 1000;
  const dates: string[] = [];
  for (let i = -1; i <= 21; i += 1) {
    dates.push(new Date(Date.now() + i * dayMs).toISOString().slice(0, 10));
  }
  const slotSnaps = await Promise.all(dates.map((fecha) => get(ref(db, `${PUBLIC_ROOT}/busySlots/${posId}/${fecha}`))));
  const busySlots: PublicBusySlot[] = [];
  for (const snap of slotSnaps) {
    if (!snap.exists()) continue;
    for (const row of Object.values(snap.val() as Record<string, Record<string, unknown>>)) {
      if (!row || row.estado === 'cancelada') continue;
      busySlots.push({
        barberoId: Number(row.barberoId),
        fecha: String(row.fecha),
        hora: String(row.hora),
        duracionTotal: Number(row.duracionTotal || 30),
        estado: String(row.estado || 'pendiente'),
      } as PublicBusySlot);
    }
  }
  return { shop, services, barbers, busySlots, galleries: {} };
}

export async function createGuestAppointment(params: {
  posId: number;
  barberoId: number;
  fecha: string;
  hora: string;
  nombre: string;
  telefono: string;
  servicios: Service[];
}): Promise<{ success: true }> {
  const fn = callable<typeof params, { success: true }>('createGuestAppointment');
  await fn(params);
  return { success: true };
}

export async function updateMyClientProfile(updates: { nombre?: string; telefono?: string; photoUrl?: string | null }): Promise<{ client: Record<string, unknown> }> {
  const fn = callable<typeof updates, { success: true; client: Record<string, unknown> }>('updateMyClientProfile');
  const result = await fn(updates);
  return { client: result.data.client };
}

export async function ensureMyClientProfile(): Promise<{ client: Record<string, unknown>; claimsUpdated: boolean }> {
  const fn = callable<Record<string, never>, { success: true; client: Record<string, unknown>; claimsUpdated: boolean }>('ensureMyClientProfile');
  const result = await fn({});
  if (result.data.claimsUpdated) await refreshSessionClaims();
  return { client: result.data.client, claimsUpdated: result.data.claimsUpdated };
}

export async function createClientAppointment(params: {
  posId: number;
  barberoId: number;
  fecha: string;
  hora: string;
  nombre: string;
  telefono: string;
  servicios: Array<{ id: number }>;
}): Promise<{ success: true }> {
  const fn = callable<typeof params, { success: true }>('createClientAppointment');
  await fn(params);
  return { success: true };
}

export async function cancelMyAppointment(appointmentId: number): Promise<void> {
  const fn = callable<{ appointmentId: number }, { success: true }>('cancelMyAppointment');
  await fn({ appointmentId });
}

export async function getShopCatalog(posId: number): Promise<{
  products: Array<{ id: number; posId: number; producto: string; precioVenta: number; stock: number; photoUrl?: string | null }>;
  taxRate: number;
  currencySymbol: string;
}> {
  const fn = callable<{ posId: number }, {
    products: Array<{ id: number; posId: number; producto: string; precioVenta: number; stock: number; photoUrl?: string | null }>;
    taxRate: number;
    currencySymbol: string;
  }>('getShopCatalog');
  const result = await fn({ posId });
  return result.data;
}

export async function createClientShopOrder(posId: number, items: Array<{ id: number; quantity: number }>): Promise<{ saleNumber: string; total: number }> {
  const fn = callable<{ posId: number; items: Array<{ id: number; quantity: number }> }, { success: true; saleNumber: string; total: number }>('createClientShopOrder');
  const result = await fn({ posId, items });
  return { saleNumber: result.data.saleNumber, total: result.data.total };
}

export type PlatformStats = {
  totalRevenue: number;
  totalUsers: number;
  totalSedes: number;
  totalAppointments: number;
  revenueByPos?: Record<string, number>;
  recentSales?: Array<{
    id: number;
    posId: number;
    total: number;
    fecha: string;
    hora?: string;
    numeroVenta?: string;
    metodoPago?: string;
  }>;
};

export async function getPlatformStats(): Promise<PlatformStats> {
  const fn = callable<Record<string, never>, PlatformStats>('getPlatformStats');
  const result = await fn({});
  return result.data;
}

export async function listDirectoryUsers(): Promise<Array<{
  username: string;
  name: string;
  role: string;
  posId: number | null;
  status?: string;
  lastLogin?: string;
  ip?: string;
}>> {
  const fn = callable<Record<string, never>, { users: Array<{
    username: string;
    name: string;
    role: string;
    posId: number | null;
    status?: string;
    lastLogin?: string;
    ip?: string;
  }> }>('listDirectoryUsers');
  const result = await fn({});
  return result.data.users;
}

export async function rebuildPosIndexes(posId: number): Promise<void> {
  const fn = httpsCallable<{ posId: number }, { success: true }>(functions, 'rebuildPosIndexes', { timeout: 120000 });
  await fn({ posId });
}
