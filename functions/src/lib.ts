import * as crypto from "crypto";
import * as admin from "firebase-admin";
import { HttpsError, CallableRequest } from "firebase-functions/v2/https";

export const ROOT = "barbershow";
export const PBKDF2_ITERATIONS = 100_000;
export const SALT_BYTES = 16;
export const HASH_BYTES = 32;
export const MIN_PHONE_DIGITS = 8;
export const MIN_PASSWORD_LENGTH = 10;
export const PUBLIC_SLOT_DAYS = 14;
export const PAID_PLANS = ["solo", "barberia", "multisede"] as const;
export const STAFF_ROLES = ["admin", "dueno", "barbero", "empleado"] as const;
export const PLATFORM_ROLES = ["platform_owner", "superadmin", "support", "financial", "commercial"] as const;
export const ALL_ROLES = [
  "superadmin",
  "admin",
  "dueno",
  "barbero",
  "empleado",
  "cliente",
  "platform_owner",
  "support",
  "financial",
  "commercial",
] as const;
export const APPOINTMENT_STATES = ["pendiente", "confirmada", "completada", "cancelada"] as const;

export const PRODUCT_ID_TO_TIER: Record<string, { tier: string; plan: string }> = {
  plan_barberia_monthly: { tier: "barberia", plan: "pro" },
  plan_barberia_yearly: { tier: "barberia", plan: "pro" },
  plan_solo_monthly: { tier: "solo", plan: "basic" },
  plan_solo_yearly: { tier: "solo", plan: "basic" },
  plan_multisede_monthly: { tier: "multisede", plan: "pro" },
  plan_multisede_yearly: { tier: "multisede", plan: "pro" },
};

export const DEFAULT_SETTINGS = {
  taxRate: 0,
  storeName: "BarberShow",
  currencySymbol: "$",
};

export function isEmulator(): boolean {
  return process.env.FUNCTIONS_EMULATOR === "true" || process.env.FIREBASE_AUTH_EMULATOR_HOST != null;
}

export function appCheckEnforced(): boolean {
  return process.env.ENFORCE_APP_CHECK === "true";
}

/** Tope de foto en RTDB. Mantener alineado con utils/storedMedia.ts y database.rules.json. */
const MAX_STORED_PHOTO_CHARS = 80_000;

export function assertStoredPhotoUrl(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  const value = String(raw);
  if (value.length > MAX_STORED_PHOTO_CHARS) {
    throw new HttpsError("invalid-argument", "Imagen demasiado grande.");
  }
  if (value.startsWith("data:image/jpeg") || value.startsWith("data:image/png") || value.startsWith("data:image/webp")) {
    return value;
  }
  if (/^https:\/\//i.test(value) && value.length <= 2048 && !/\s/.test(value)) return value;
  throw new HttpsError("invalid-argument", "URL de imagen no válida.");
}

export function publicAssetUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (/^https:\/\//i.test(raw) && raw.length <= 2048 && !/\s/.test(raw)) return raw;
  return null;
}

export function toClientLite(client: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!client) return null;
  const id = Number(client.id);
  const posId = Number(client.posId);
  if (!Number.isFinite(id) || !Number.isFinite(posId) || posId <= 0) return null;
  const photo = publicAssetUrl(client.photoUrl);
  const out: Record<string, unknown> = {
    id,
    posId,
    nombre: String(client.nombre || ""),
    telefono: String(client.telefono || ""),
    email: String(client.email || ""),
    ultimaVisita: String(client.ultimaVisita || ""),
    notas: String(client.notas || "").slice(0, 500),
    puntos: Number(client.puntos || 0),
    status: client.status === "suspended" ? "suspended" : "active",
    fechaRegistro: String(client.fechaRegistro || ""),
  };
  if (photo) out.photoUrl = photo;
  if (typeof client.whatsappOptIn === "boolean") out.whatsappOptIn = client.whatsappOptIn;
  return out;
}

export async function writeClientLite(client: Record<string, unknown>): Promise<void> {
  const lite = toClientLite(client);
  if (!lite) return;
  await db().ref(`${ROOT}/clientsLite/${lite.posId}/${lite.id}`).set(lite);
}

export async function writePublicShopRecord(pos: Record<string, unknown> | null | undefined): Promise<void> {
  const id = Number(pos?.id);
  if (!Number.isFinite(id) || id <= 0) return;
  const shop = sanitizePublicShop(pos);
  const ref = db().ref(`${ROOT}/publicShops/${id}`);
  if (!shop) {
    await ref.remove();
    return;
  }
  await ref.set(shop);
}

export async function writeDirectoryUserRecord(username: string, user: Record<string, unknown> | null | undefined): Promise<void> {
  const key = String(username || "").trim().toLowerCase();
  if (!key || key.startsWith("_")) return;
  const ref = db().ref(`${ROOT}/directoryUsers/${key}`);
  if (!user) {
    await ref.remove();
    return;
  }
  await ref.set(toDirectoryUser(key, user));
}

export function safeCheckoutOrigin(originHeader: string | string[] | undefined): string {
  const origin = String(Array.isArray(originHeader) ? originHeader[0] : originHeader || "").replace(/\/$/, "");
  const allowed = new Set([
    "https://barbershow.net",
    "https://www.barbershow.net",
    "https://gen-lang-client-0624135070.web.app",
    "https://gen-lang-client-0624135070.firebaseapp.com",
  ]);
  if (allowed.has(origin)) return origin;
  if (isEmulator() && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return "https://barbershow.net";
}

export function assertAppCheck(request: CallableRequest): void {
  if (appCheckEnforced() && !request.app) {
    throw new HttpsError("failed-precondition", "App Check requerido.");
  }
}

export function isPlatformRole(role: string | undefined | null): boolean {
  return role === "platform_owner" || role === "superadmin";
}

export function isStaffRole(role: string | undefined | null): boolean {
  return role === "admin" || role === "dueno" || role === "barbero" || role === "empleado";
}

export function canManagePosUsers(role: string | undefined | null): boolean {
  return role === "admin" || role === "dueno" || isPlatformRole(role);
}

/**
 * Modo promocional en Functions: true/false explícito gana.
 * Si no está definido, el emulador queda en true (como Vite DEV) y producción en false.
 */
export function parseGlobalFreeMode(raw: string | undefined, emulator: boolean): boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  return emulator;
}

/** Solo dueño/admin de la sede puede activar un plan IAP (no barbero, empleado ni cliente). */
export function canActivatePosPlan(role: string | undefined | null): boolean {
  return role === "admin" || role === "dueno";
}

export function canListDirectoryUsers(role: string | undefined | null): boolean {
  return isPlatformRole(role) || role === "support" || role === "financial" || role === "commercial";
}

export type DirectoryUser = {
  username: string;
  name: string;
  role: string;
  posId: number | null;
  status?: string;
  lastLogin?: string;
  ip?: string;
};

/** Lista de plataforma: sin photoUrl ni password. */
export function toDirectoryUser(username: string, raw: Record<string, unknown> | null | undefined): DirectoryUser {
  const posRaw = raw?.posId;
  const posId = posRaw == null || posRaw === "" ? null : Number(posRaw);
  const out: DirectoryUser = {
    username: String((raw?.username as string) || username),
    name: String(raw?.name || ""),
    role: String(raw?.role || ""),
    posId: Number.isFinite(posId as number) && (posId as number) > 0 ? (posId as number) : null,
  };
  if (typeof raw?.status === "string") out.status = raw.status;
  if (typeof raw?.lastLogin === "string") out.lastLogin = raw.lastLogin;
  if (typeof raw?.ip === "string") out.ip = raw.ip;
  return out;
}

export type RecentSaleSummary = {
  id: number;
  posId: number;
  total: number;
  fecha: string;
  hora?: string;
  numeroVenta?: string;
  metodoPago?: string;
};

export const RECENT_SALES_LIMIT = 20;

export function normalizeRecentSales(cur: unknown): RecentSaleSummary[] {
  const list = Array.isArray(cur)
    ? cur
    : cur && typeof cur === "object"
      ? Object.values(cur as Record<string, unknown>)
      : [];
  return list.filter((item): item is RecentSaleSummary => {
    if (!item || typeof item !== "object") return false;
    const rec = item as RecentSaleSummary;
    return Number.isFinite(Number(rec.id)) && Number(rec.id) > 0 && Number.isFinite(Number(rec.total));
  }).slice(-RECENT_SALES_LIMIT);
}

export function appendRecentSales(cur: unknown, sale: RecentSaleSummary): RecentSaleSummary[] {
  return [...normalizeRecentSales(cur), sale].slice(-RECENT_SALES_LIMIT);
}

/** El cliente solo compra en su sede preferida, la de su ficha o la del token. */
export function canClientOrderAtPos(params: {
  preferredPosId?: number | null;
  clientRecordPosId?: number | null;
  claimsPosId?: number | null;
  targetPosId: number;
}): boolean {
  const asPosId = (n: unknown): number | null => {
    const v = Number(n);
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  const target = asPosId(params.targetPosId);
  if (target == null) return false;
  const allowed = [params.preferredPosId, params.clientRecordPosId, params.claimsPosId]
    .map(asPosId)
    .filter((n): n is number => n != null);
  return allowed.includes(target);
}

/** El cliente nunca reescribe posId del token. Staff/plataforma sí, si es sede propia u owner. */
export function canRewritePosClaim(params: {
  role?: string | null;
  claimsPosId?: number | null;
  targetPosId: number;
  ownerId?: string | null;
  username?: string | null;
}): boolean {
  const role = String(params.role || "");
  if (!role || role === "cliente") return false;
  if (isPlatformRole(role)) return true;
  if (params.ownerId && params.username && params.ownerId === params.username) return true;
  return Number(params.claimsPosId) === Number(params.targetPosId);
}

export function resolveTierFromProductId(productId: string): { tier: string; plan: string } | null {
  const id = String(productId || "").trim();
  if (PRODUCT_ID_TO_TIER[id]) return PRODUCT_ID_TO_TIER[id];
  if (id.includes("barberia")) return { tier: "barberia", plan: "pro" };
  if (id.includes("solo")) return { tier: "solo", plan: "basic" };
  if (id.includes("multisede")) return { tier: "multisede", plan: "pro" };
  return null;
}

function asPublicList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") return Object.values(raw as Record<string, unknown>);
  return [];
}

export function sanitizePublicCertifications(raw: unknown): { id: string; title: string; issuer?: string; year?: number }[] {
  const yearMax = new Date().getFullYear() + 1;
  const out: { id: string; title: string; issuer?: string; year?: number }[] = [];
  for (const item of asPublicList(raw)) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const title = String(rec.title || "").trim().slice(0, 120);
    if (!title) continue;
    const cert: { id: string; title: string; issuer?: string; year?: number } = {
      id: String(rec.id || `c${out.length}`).slice(0, 40),
      title,
    };
    const issuer = String(rec.issuer || "").trim().slice(0, 80);
    if (issuer) cert.issuer = issuer;
    const year = Number(rec.year);
    if (Number.isFinite(year) && year >= 1980 && year <= yearMax) cert.year = Math.round(year);
    out.push(cert);
    if (out.length >= 12) break;
  }
  return out;
}

export function sanitizePublicHighlights(raw: unknown): string[] {
  const out: string[] = [];
  for (const item of asPublicList(raw)) {
    const s = String(item || "").trim().slice(0, 48);
    if (s && !out.some((x) => x.toLowerCase() === s.toLowerCase())) out.push(s);
    if (out.length >= 8) break;
  }
  return out;
}

export function sanitizePublicShop(pos: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!pos || pos.isActive === false) return null;
  const id = Number(pos.id);
  if (!Number.isFinite(id)) return null;
  return {
    id,
    name: String(pos.name || ""),
    address: String(pos.address || ""),
    country: pos.country ?? null,
    city: pos.city ?? null,
    barrio: pos.barrio ?? null,
    lat: typeof pos.lat === "number" ? pos.lat : null,
    lng: typeof pos.lng === "number" ? pos.lng : null,
    isActive: pos.isActive !== false,
    about: typeof pos.about === "string" ? pos.about.trim().slice(0, 800) : "",
    highlights: sanitizePublicHighlights(pos.highlights),
    certifications: sanitizePublicCertifications(pos.certifications),
  };
}

export function sanitizePublicBarber(b: Record<string, unknown> | null | undefined, posId: number): Record<string, unknown> | null {
  if (!b || b.active === false) return null;
  const id = Number(b.id);
  if (!Number.isFinite(id)) return null;
  const years = Number(b.yearsExperience);
  return {
    id,
    posId,
    name: b.name,
    specialty: typeof b.specialty === "string" ? String(b.specialty).slice(0, 120) : "",
    active: true,
    workingHours: b.workingHours || null,
    lunchBreak: b.lunchBreak || null,
    blockedHours: b.blockedHours || null,
    bio: typeof b.bio === "string" ? String(b.bio).trim().slice(0, 800) : "",
    yearsExperience: Number.isFinite(years) && years > 0 ? Math.min(60, Math.round(years)) : null,
    certifications: sanitizePublicCertifications(b.certifications),
  };
}

export function bufferToHex(buffer: Buffer): string {
  return buffer.toString("hex");
}

export function hashPasswordNode(plainPassword: string): string {
  const salt = crypto.randomBytes(SALT_BYTES);
  const hash = crypto.pbkdf2Sync(plainPassword, salt, PBKDF2_ITERATIONS, HASH_BYTES, "sha256");
  return bufferToHex(salt) + ":" + bufferToHex(hash);
}

export function isStoredHash(stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  return /^[0-9a-f]+$/i.test(parts[0]) && parts[0].length === SALT_BYTES * 2 && /^[0-9a-f]+$/i.test(parts[1]) && parts[1].length === HASH_BYTES * 2;
}

export function verifyPasswordNode(plainPassword: string, stored: string | null | undefined): boolean {
  if (!plainPassword || stored == null || stored === "") return false;
  if (isStoredHash(stored)) {
    const [saltHex, hashHex] = stored.split(":");
    const computed = crypto.pbkdf2Sync(plainPassword, Buffer.from(saltHex, "hex"), PBKDF2_ITERATIONS, HASH_BYTES, "sha256");
    const expected = Buffer.from(hashHex, "hex");
    if (computed.length !== expected.length) return false;
    return crypto.timingSafeEqual(computed, expected);
  }
  const a = Buffer.from(plainPassword);
  const b = Buffer.from(String(stored));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function generateUniqueId(): number {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function clientIp(request: CallableRequest): string {
  const raw = request.rawRequest.headers["x-forwarded-for"];
  const ip = Array.isArray(raw) ? raw[0] : (raw || request.rawRequest.ip || "unknown");
  return String(ip).split(",")[0].trim();
}

export function ipHash(request: CallableRequest): string {
  return sha256Hex(clientIp(request)).slice(0, 32);
}

export function ensureAdmin(): void {
  if (!admin.apps.length) {
    admin.initializeApp();
  }
}

export function db(): admin.database.Database {
  ensureAdmin();
  return admin.database();
}

export function firestore(): admin.firestore.Firestore {
  ensureAdmin();
  return admin.firestore();
}

function authAdmin() {
  ensureAdmin();
  return admin.auth();
}

export type SessionClaims = {
  role: string;
  username: string;
  posId: number | null;
  barberId: number | null;
  clientId: number | null;
};

export function claimsFromToken(request: CallableRequest): SessionClaims | null {
  const token = request.auth?.token as Record<string, unknown> | undefined;
  if (!token || !request.auth) return null;
  if (token.firebase && (token.firebase as { sign_in_provider?: string }).sign_in_provider === "anonymous") return null;
  const username = String(token.username || "").trim();
  const role = String(token.role || "").trim();
  if (!username || !role) return null;
  return {
    role,
    username,
    posId: typeof token.posId === "number" ? token.posId : token.posId == null ? null : Number(token.posId),
    barberId: typeof token.barberId === "number" ? token.barberId : token.barberId == null ? null : Number(token.barberId),
    clientId: typeof token.clientId === "number" ? token.clientId : token.clientId == null ? null : Number(token.clientId),
  };
}

export function requireAuth(request: CallableRequest): { uid: string; claims: SessionClaims } {
  assertAppCheck(request);
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesión.");
  }
  const claims = claimsFromToken(request);
  if (!claims) {
    throw new HttpsError("permission-denied", "La sesión no tiene permisos de negocio.");
  }
  return { uid: request.auth.uid, claims };
}

export function requirePlatform(request: CallableRequest): { uid: string; claims: SessionClaims } {
  const ctx = requireAuth(request);
  if (!isPlatformRole(ctx.claims.role)) {
    throw new HttpsError("permission-denied", "No autorizado.");
  }
  return ctx;
}

export function requirePlatformOwner(request: CallableRequest): { uid: string; claims: SessionClaims } {
  const ctx = requireAuth(request);
  if (ctx.claims.role !== "platform_owner" && ctx.claims.role !== "superadmin") {
    throw new HttpsError("permission-denied", "No autorizado.");
  }
  return ctx;
}

export async function consumeRateLimit(bucket: string, key: string, max: number, windowMs: number): Promise<void> {
  const ref = db().ref(`${ROOT}/rateLimits/${bucket}/${key}`);
  const now = Date.now();
  const result = await ref.transaction((cur: { windowStart?: number; count?: number } | null) => {
    if (!cur || typeof cur.windowStart !== "number" || now - cur.windowStart > windowMs) {
      return { windowStart: now, count: 1 };
    }
    if ((cur.count || 0) >= max) {
      return;
    }
    return { windowStart: cur.windowStart, count: (cur.count || 0) + 1 };
  });
  if (!result.committed) {
    throw new HttpsError("resource-exhausted", "Demasiados intentos. Espera unos minutos.");
  }
}

export async function writeAdminAudit(actor: string, action: string, details: string, posId?: number | null): Promise<void> {
  const id = generateUniqueId();
  const log: Record<string, unknown> = {
    id,
    actor,
    action,
    details,
    timestamp: new Date().toISOString(),
  };
  if (posId != null) log.posId = posId;
  await db().ref(`${ROOT}/adminAudit/${id}`).set(log);
}

export function publicUser(user: Record<string, unknown>, username: string): Record<string, unknown> {
  return {
    username: user.username || username,
    role: user.role || "cliente",
    name: user.name || username,
    posId: user.posId ?? null,
    barberId: user.barberId ?? null,
    clientId: user.clientId ?? null,
    photoUrl: user.photoUrl ?? null,
    status: user.status || "active",
    permissions: user.permissions || null,
    active: user.active,
    accountStatus: user.accountStatus || null,
  };
}

export function uidForUsername(username: string): string {
  return "bs_" + sha256Hex(username.toLowerCase()).slice(0, 28);
}

export async function resolveUsernameKey(username: string): Promise<string | null> {
  const search = String(username || "").trim();
  if (!search) return null;
  const lower = search.toLowerCase();
  const direct = await db().ref(`${ROOT}/users/${lower}`).get();
  if (direct.exists()) return lower;
  if (search !== lower) {
    const exact = await db().ref(`${ROOT}/users/${search}`).get();
    if (exact.exists()) return search;
  }
  return null;
}

export type PasswordHashSource = "authSecrets" | "users.password" | "none";

export function resolvePasswordHashFromSources(
  secretHash: unknown,
  userPassword: unknown
): { hash: string | null; source: PasswordHashSource } {
  if (typeof secretHash === "string" && secretHash) {
    return { hash: secretHash, source: "authSecrets" };
  }
  if (typeof userPassword === "string" && userPassword) {
    return { hash: userPassword, source: "users.password" };
  }
  return { hash: null, source: "none" };
}

export async function inspectPasswordHash(
  usernameKey: string,
  userVal: Record<string, unknown>
): Promise<{ hash: string | null; source: PasswordHashSource }> {
  const secretSnap = await db().ref(`${ROOT}/authSecrets/${usernameKey}/passwordHash`).get();
  return resolvePasswordHashFromSources(secretSnap.exists() ? secretSnap.val() : null, userVal.password);
}

export async function readPasswordHash(usernameKey: string, userVal: Record<string, unknown>): Promise<string | null> {
  return (await inspectPasswordHash(usernameKey, userVal)).hash;
}

export async function migratePasswordSecret(usernameKey: string, hash: string): Promise<void> {
  await db().ref(`${ROOT}/authSecrets/${usernameKey}`).update({
    passwordHash: hash,
    migratedAt: new Date().toISOString(),
  });
  await db().ref(`${ROOT}/users/${usernameKey}/password`).remove();
}

/** Mueve hashes residuales de users.password a authSecrets. No registra el hash. */
export async function migrateAllLegacyPasswordSecrets(): Promise<number> {
  const snap = await db().ref(`${ROOT}/users`).get();
  if (!snap.exists()) return 0;
  const users = snap.val() as Record<string, Record<string, unknown>>;
  let moved = 0;
  for (const [key, user] of Object.entries(users)) {
    if (typeof user?.password === "string" && user.password) {
      await migratePasswordSecret(key, user.password);
      moved += 1;
    }
  }
  return moved;
}

export async function setPasswordHash(usernameKey: string, hash: string): Promise<void> {
  await db().ref(`${ROOT}/authSecrets/${usernameKey}`).update({
    passwordHash: hash,
    updatedAt: new Date().toISOString(),
  });
  await db().ref(`${ROOT}/users/${usernameKey}/password`).remove();
}

export async function syncUserClaims(uid: string, user: Record<string, unknown>, username: string): Promise<SessionClaims> {
  const status = String(user.status || "active");
  const role = status === "pending_payment" ? "pending_signup" : String(user.role || "cliente");
  const claims: SessionClaims = {
    role,
    username,
    posId: user.posId == null || user.posId === "" ? null : Number(user.posId),
    barberId: user.barberId == null ? null : Number(user.barberId),
    clientId: user.clientId == null ? null : Number(user.clientId),
  };
  const payload: Record<string, unknown> = {
    role: claims.role,
    username: claims.username,
  };
  if (claims.posId != null && Number.isFinite(claims.posId)) payload.posId = claims.posId;
  if (claims.barberId != null && Number.isFinite(claims.barberId)) payload.barberId = claims.barberId;
  if (claims.clientId != null && Number.isFinite(claims.clientId)) payload.clientId = claims.clientId;
  await authAdmin().setCustomUserClaims(uid, payload);
  return claims;
}

export async function ensureAuthUser(username: string, displayName: string, existingUid?: string | null): Promise<string> {
  const uid = existingUid || uidForUsername(username);
  try {
    await authAdmin().createUser({ uid, displayName: displayName || username, disabled: false });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code !== "auth/uid-already-exists" && code !== "auth/email-already-exists") {
      const existing = await authAdmin().getUser(uid).catch(() => null);
      if (!existing) throw err;
    }
  }
  await db().ref(`${ROOT}/uidIndex/${uid}`).set(username);
  await db().ref(`${ROOT}/users/${username}/authUid`).set(uid);
  return uid;
}

export async function mintCustomTokenForUser(usernameKey: string, user: Record<string, unknown>): Promise<{ customToken: string; user: Record<string, unknown> }> {
  const uid = await ensureAuthUser(usernameKey, String(user.name || usernameKey), user.authUid ? String(user.authUid) : null);
  const claims = await syncUserClaims(uid, user, usernameKey);
  const extra: Record<string, unknown> = {
    role: claims.role,
    username: claims.username,
  };
  if (claims.posId != null && Number.isFinite(claims.posId)) extra.posId = claims.posId;
  if (claims.barberId != null && Number.isFinite(claims.barberId)) extra.barberId = claims.barberId;
  if (claims.clientId != null && Number.isFinite(claims.clientId)) extra.clientId = claims.clientId;
  const customToken = await authAdmin().createCustomToken(uid, extra);
  return { customToken, user: publicUser(user, usernameKey) };
}

export function digitsOnly(value: string): string {
  return String(value || "").replace(/\D/g, "");
}

export function assertPassword(password: string): string {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new HttpsError("invalid-argument", `La contraseña es obligatoria (mín. ${MIN_PASSWORD_LENGTH} caracteres).`);
  }
  return password;
}

export function rtdbSafeKey(value: string): string {
  return String(value || "").replace(/[.#$\[\]]/g, "_").slice(0, 200);
}

export function isoDateOffset(days = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function busySlotKey(barberoId: number, hora: string): string {
  return `${barberoId}_${rtdbSafeKey(hora)}`;
}

export async function bumpPlatformStat(field: string, delta = 1): Promise<void> {
  if (!field || !Number.isFinite(delta) || delta === 0) return;
  await db().ref(`${ROOT}/platformStats/${field}`).transaction((cur) => (typeof cur === "number" ? cur : 0) + delta);
}

export async function writeAppointmentIndexes(apt: {
  id: number;
  posId: number;
  barberoId: number;
  fecha: string;
  hora: string;
  duracionTotal?: number;
  estado: string;
}): Promise<void> {
  const slotPath = `${ROOT}/busySlots/${apt.posId}/${apt.fecha}/${busySlotKey(apt.barberoId, apt.hora)}`;
  const byDatePath = `${ROOT}/appointmentsByPosDate/${apt.posId}/${apt.fecha}/${apt.id}`;
  if (apt.estado === "cancelada") {
    await db().ref(slotPath).remove();
    await db().ref(byDatePath).remove();
    return;
  }
  await db().ref(slotPath).set({
    barberoId: apt.barberoId,
    fecha: apt.fecha,
    hora: apt.hora,
    duracionTotal: apt.duracionTotal || 30,
    estado: apt.estado,
    appointmentId: apt.id,
  });
  await db().ref(byDatePath).set(true);
}

export async function writeSaleIndexes(sale: { id: number; posId: number; fecha: string }): Promise<void> {
  const id = Number(sale.id);
  const posId = Number(sale.posId);
  const fecha = String(sale.fecha || "");
  if (!Number.isFinite(id) || !Number.isFinite(posId) || posId <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return;
  await db().ref(`${ROOT}/salesByPosDate/${posId}/${fecha}/${id}`).set(true);
}

export async function indexClientPhone(posId: number, phone: string, clientId: number | null): Promise<void> {
  const digits = digitsOnly(phone);
  if (digits.length < MIN_PHONE_DIGITS) return;
  const ref = db().ref(`${ROOT}/clientsByPhone/${posId}/${digits}`);
  if (clientId == null) await ref.remove();
  else await ref.set(clientId);
}

export async function findClientIdByPhone(posId: number, phone: string): Promise<number | null> {
  const digits = digitsOnly(phone);
  if (digits.length < MIN_PHONE_DIGITS) return null;
  const snap = await db().ref(`${ROOT}/clientsByPhone/${posId}/${digits}`).get();
  if (snap.exists() && Number.isFinite(Number(snap.val()))) return Number(snap.val());
  return null;
}

export function iapReuseKeys(input: {
  originalTransactionId?: string;
  orderId?: string;
  purchaseTokenHash?: string;
}): string[] {
  const keys = [input.originalTransactionId, input.orderId, input.purchaseTokenHash]
    .map((k) => rtdbSafeKey(String(k || "").trim()))
    .filter(Boolean);
  return [...new Set(keys)];
}

export async function claimIapReceipt(username: string, keys: string[]): Promise<void> {
  if (!keys.length) {
    throw new HttpsError("failed-precondition", "No se pudo identificar el recibo de la tienda.");
  }
  const at = new Date().toISOString();
  for (const key of keys) {
    const ref = db().ref(`${ROOT}/authSecrets/_iap/${key}`);
    const result = await ref.transaction((cur: { username?: string } | null) => {
      const owner = cur && typeof cur === "object" ? String(cur.username || "") : "";
      if (owner && owner !== username) return;
      return { username, at };
    });
    if (!result.committed) {
      throw new HttpsError("already-exists", "Este recibo ya fue usado.");
    }
  }
}

/** Mutex corto: si el proceso muere, el lock caduca y no deja el horario muerto. */
export const SLOT_LOCK_TTL_MS = 60_000;

export function isSlotLockActive(cur: unknown, now = Date.now()): boolean {
  if (cur == null) return false;
  if (typeof cur !== "object") return true;
  const at = Number((cur as { at?: number }).at);
  if (!Number.isFinite(at)) return true;
  return now - at < SLOT_LOCK_TTL_MS;
}

export async function lockAppointmentSlot(posId: number, barberoId: number, fecha: string, hora: string): Promise<void> {
  const ref = db().ref(`${ROOT}/slotLocks/${posId}/${barberoId}/${fecha}/${rtdbSafeKey(hora)}`);
  const result = await ref.transaction((cur) => {
    if (isSlotLockActive(cur)) return;
    return { at: Date.now() };
  });
  if (!result.committed) {
    throw new HttpsError("already-exists", "Ese horario ya no está disponible.");
  }
}

export async function releaseAppointmentSlot(posId: number, barberoId: number, fecha: string, hora: string): Promise<void> {
  await db().ref(`${ROOT}/slotLocks/${posId}/${barberoId}/${fecha}/${rtdbSafeKey(hora)}`).remove();
}

export function assertUsername(username: string): string {
  const value = String(username || "").trim().toLowerCase();
  if (!value || value.length < 3 || value.length > 40 || !/^[a-z0-9._-]+$/.test(value)) {
    throw new HttpsError("invalid-argument", "Nombre de usuario no válido.");
  }
  if (value === "master") {
    throw new HttpsError("invalid-argument", "Ese nombre de usuario no está permitido.");
  }
  return value;
}

export function canCallerAssignRole(callerRole: string, targetRole: string, callerPosId: number | null, targetPosId: number | null): boolean {
  if (targetRole === "platform_owner") return false;
  if (callerRole === "platform_owner" || callerRole === "superadmin") return true;
  if ((callerRole === "admin" || callerRole === "dueno") && callerPosId != null && targetPosId === callerPosId) {
    return targetRole === "admin" || targetRole === "dueno" || targetRole === "barbero" || targetRole === "empleado" || targetRole === "cliente";
  }
  return false;
}
