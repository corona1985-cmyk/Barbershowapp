import * as crypto from "crypto";
import * as admin from "firebase-admin";
import { HttpsError, CallableRequest } from "firebase-functions/v2/https";

export const ROOT = "barbershow";
export const PBKDF2_ITERATIONS = 100_000;
export const SALT_BYTES = 16;
export const HASH_BYTES = 32;
export const MIN_PHONE_DIGITS = 8;
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

export function resolveTierFromProductId(productId: string): { tier: string; plan: string } | null {
  const id = String(productId || "").trim();
  if (PRODUCT_ID_TO_TIER[id]) return PRODUCT_ID_TO_TIER[id];
  if (id.includes("barberia")) return { tier: "barberia", plan: "pro" };
  if (id.includes("solo")) return { tier: "solo", plan: "basic" };
  if (id.includes("multisede")) return { tier: "multisede", plan: "pro" };
  return null;
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

export function db(): admin.database.Database {
  return admin.database();
}

export function firestore(): admin.firestore.Firestore {
  return admin.firestore();
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
  const all = await db().ref(`${ROOT}/users`).get();
  if (!all.exists()) return null;
  const keys = Object.keys(all.val() as Record<string, unknown>);
  return keys.find((k) => k.toLowerCase() === lower) ?? null;
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
  await admin.auth().setCustomUserClaims(uid, payload);
  return claims;
}

export async function ensureAuthUser(username: string, displayName: string, existingUid?: string | null): Promise<string> {
  const uid = existingUid || uidForUsername(username);
  try {
    await admin.auth().createUser({ uid, displayName: displayName || username, disabled: false });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code !== "auth/uid-already-exists" && code !== "auth/email-already-exists") {
      const existing = await admin.auth().getUser(uid).catch(() => null);
      if (!existing) throw err;
    }
  }
  await db().ref(`${ROOT}/uidIndex/${uid}`).set(username);
  await db().ref(`${ROOT}/users/${username}/authUid`).set(uid);
  return uid;
}

export async function mintCustomTokenForUser(usernameKey: string, user: Record<string, unknown>): Promise<{ customToken: string; user: Record<string, unknown> }> {
  const uid = await ensureAuthUser(usernameKey, String(user.name || usernameKey), user.authUid ? String(user.authUid) : null);
  await syncUserClaims(uid, user, usernameKey);
  const customToken = await admin.auth().createCustomToken(uid);
  return { customToken, user: publicUser(user, usernameKey) };
}

export function digitsOnly(value: string): string {
  return String(value || "").replace(/\D/g, "");
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
