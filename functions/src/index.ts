import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { config } from "firebase-functions/v1";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import {
  ROOT,
  PAID_PLANS,
  MIN_PHONE_DIGITS,
  MIN_PASSWORD_LENGTH,
  DEFAULT_SETTINGS,
  ALL_ROLES,
  assertAppCheck,
  assertPassword,
  assertUsername,
  canCallerAssignRole,
  claimIapReceipt,
  consumeRateLimit,
  db,
  digitsOnly,
  firestore,
  generateUniqueId,
  hashPasswordNode,
  iapReuseKeys,
  indexClientPhone,
  ipHash,
  isEmulator,
  isPlatformRole,
  isStaffRole,
  canRewritePosClaim,
  canActivatePosPlan,
  parseGlobalFreeMode,
  mintCustomTokenForUser,
  readPasswordHash,
  requireAuth,
  requirePlatformOwner,
  resolveTierFromProductId,
  resolveUsernameKey,
  sanitizePublicShop,
  sanitizePublicBarber,
  setPasswordHash,
  migratePasswordSecret,
  migrateAllLegacyPasswordSecrets,
  syncUserClaims,
  verifyPasswordNode,
  writeAdminAudit,
} from "./lib";
import { verifyGooglePlayPurchase, verifyStorePurchase } from "./iapVerify";
import {
  assertBookingPayload,
  assertPosAndBarber,
  createPendingAppointment,
  ensureClientForBooking,
  loadBusySlotsForPos,
  resolveServicesFromIds,
} from "./booking";

if (!admin.apps.length) {
  admin.initializeApp();
}

const callableOpts = { region: "us-central1" as const };

function getFreeSignupTierAndPlan(): { tier: string; plan: string } {
  if (parseGlobalFreeMode(process.env.GLOBAL_FREE_MODE, isEmulator())) {
    return { tier: "barberia", plan: "pro" };
  }
  return { tier: "gratuito", plan: "basic" };
}

const PLAN_PRICES: Record<string, number> = {
  solo: 14.95,
  barberia: 19.95,
  multisede: 29.95,
};

const MASTER_USER = {
  username: "master",
  role: "platform_owner" as const,
  name: "Master Admin",
  posId: null as number | null,
};

function stripeSecret(): string | undefined {
  return process.env.STRIPE_SECRET_KEY || config().stripe?.secret_key;
}

function masterPassword(): string | undefined {
  return process.env.MASTER_PASSWORD || config().master?.password;
}

async function findClientPhoneInPos(posId: number, phone: string): Promise<boolean> {
  const snap = await db().ref(`${ROOT}/clients`).orderByChild("posId").equalTo(posId).get();
  if (!snap.exists()) return false;
  const want = digitsOnly(phone);
  const val = snap.val() as Record<string, { telefono?: string }>;
  return Object.values(val).some((c) => digitsOnly(String(c.telefono || "")) === want);
}

function isStoredHashSafe(stored: string): boolean {
  return stored.includes(":") && stored.split(":")[0].length === 32;
}

export const loginWithPassword = onCall(callableOpts, async (request) => {
  assertAppCheck(request);
  const data = request.data as { username?: string; password?: string } | undefined;
  const usernameRaw = String(data?.username ?? "").trim();
  const password = String(data?.password ?? "");
  await consumeRateLimit("login-ip", ipHash(request), 20, 15 * 60 * 1000);
  await consumeRateLimit("login-user", usernameRaw.toLowerCase() || "unknown", 8, 15 * 60 * 1000);
  if (!usernameRaw || !password) {
    throw new HttpsError("unauthenticated", "Usuario o contraseña incorrectos.");
  }
  if (usernameRaw.toLowerCase() === "master") {
    throw new HttpsError("unauthenticated", "Usa el acceso Master.");
  }
  const dbKey = await resolveUsernameKey(usernameRaw);
  if (!dbKey) {
    throw new HttpsError("unauthenticated", "Usuario o contraseña incorrectos.");
  }
  const snap = await db().ref(`${ROOT}/users/${dbKey}`).get();
  if (!snap.exists()) {
    throw new HttpsError("unauthenticated", "Usuario o contraseña incorrectos.");
  }
  const user = snap.val() as Record<string, unknown>;
  if (user.active === false || user.accountStatus === "deactivated") {
    throw new HttpsError("failed-precondition", "ACCOUNT_DEACTIVATED");
  }
  if (user.status === "suspended" || user.status === "locked") {
    throw new HttpsError("unauthenticated", "Usuario o contraseña incorrectos.");
  }
  const stored = await readPasswordHash(dbKey, user);
  if (!stored) {
    throw new HttpsError("failed-precondition", "NO_PASSWORD_SET");
  }
  if (!verifyPasswordNode(password, stored)) {
    throw new HttpsError("unauthenticated", "Usuario o contraseña incorrectos.");
  }
  if (typeof user.password === "string") {
    await migratePasswordSecret(dbKey, isStoredHashSafe(stored) ? stored : hashPasswordNode(password));
  }
  await db().ref(`${ROOT}/users/${dbKey}`).update({ lastLogin: new Date().toISOString(), loginAttempts: 0 });
  const fresh = { ...user, lastLogin: new Date().toISOString(), loginAttempts: 0 };
  const minted = await mintCustomTokenForUser(dbKey, fresh);
  await writeAdminAudit(dbKey, "login", "login_ok", typeof user.posId === "number" ? user.posId : null);
  return minted;
});

export const authenticateMasterWithPassword = onCall(callableOpts, async (request) => {
  assertAppCheck(request);
  await consumeRateLimit("login-master", ipHash(request), 8, 15 * 60 * 1000);
  const expected = masterPassword();
  if (!expected) {
    throw new HttpsError("failed-precondition", "Master no está configurado.");
  }
  const data = request.data as { username?: string; password?: string } | undefined;
  const username = String(data?.username ?? "").trim().toLowerCase();
  const password = data?.password ?? "";
  if (username !== "master" || password !== expected) {
    throw new HttpsError("unauthenticated", "Usuario o contraseña incorrectos para Master Admin.");
  }
  const uid = "bs_master_platform";
  try {
    await admin.auth().createUser({ uid, displayName: MASTER_USER.name, disabled: false });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code !== "auth/uid-already-exists") throw err;
  }
  await admin.auth().setCustomUserClaims(uid, { role: "platform_owner", username: "master" });
  const customToken = await admin.auth().createCustomToken(uid, { role: "platform_owner", username: "master" });
  await migrateAllLegacyPasswordSecrets().catch(() => 0);
  await writeAdminAudit("master", "master_login", "master_ok");
  return { customToken, user: MASTER_USER };
});

export const checkUsernameAvailable = onCall(callableOpts, async (request) => {
  assertAppCheck(request);
  await consumeRateLimit("username", ipHash(request), 30, 15 * 60 * 1000);
  const username = String((request.data as { username?: string } | undefined)?.username ?? "").trim().toLowerCase();
  if (!username) return { taken: false };
  const key = await resolveUsernameKey(username);
  return { taken: key != null || username === "master" };
});

export const sendWhatsAppMessage = onCall(callableOpts, async (request) => {
  const { claims } = requireAuth(request);
  if (!isStaffRole(claims.role) && !isPlatformRole(claims.role)) {
    throw new HttpsError("permission-denied", "No autorizado.");
  }
  const posId = claims.posId;
  if (posId == null && !isPlatformRole(claims.role)) {
    throw new HttpsError("permission-denied", "No hay sede asociada.");
  }
  await consumeRateLimit("whatsapp", String(posId ?? claims.username), 20, 60 * 60 * 1000);
  const sid = process.env.TWILIO_ACCOUNT_SID || config().twilio?.sid;
  const token = process.env.TWILIO_AUTH_TOKEN || config().twilio?.token;
  const from = process.env.TWILIO_WHATSAPP_FROM || config().twilio?.whatsapp_from;
  if (!sid || !token || !from) {
    throw new HttpsError("failed-precondition", "WhatsApp no está configurado.");
  }
  const data = request.data as { to?: string; body?: string } | undefined;
  const to = data?.to?.trim();
  const body = data?.body?.trim();
  if (!to || !body) {
    throw new HttpsError("invalid-argument", "Faltan destino o mensaje.");
  }
  if (body.length > 1000) {
    throw new HttpsError("invalid-argument", "Mensaje demasiado largo.");
  }
  if (posId != null && !isPlatformRole(claims.role)) {
    const belongs = await findClientPhoneInPos(posId, to);
    if (!belongs) {
      throw new HttpsError("permission-denied", "El destino no pertenece a tu sede.");
    }
  }
  let phone = digitsOnly(to);
  if (phone.length === 10 && !to.startsWith("+")) phone = "52" + phone;
  if (!phone.startsWith("+")) phone = "+" + phone;
  const authHeader = Buffer.from(`${sid}:${token}`).toString("base64");
  const params = new URLSearchParams({ To: `whatsapp:${phone}`, From: from, Body: body });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${authHeader}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  if (!res.ok) {
    throw new HttpsError("internal", "No se pudo enviar el mensaje.");
  }
  const json = (await res.json()) as { sid?: string };
  await writeAdminAudit(claims.username, "whatsapp_send", "sent", posId);
  return { success: true, sid: json.sid };
});

type SignupPayload = {
  username?: string;
  password?: string;
  name?: string;
  phone?: string;
  email?: string;
  barbershopName?: string;
  address?: string;
  country?: string;
  city?: string;
  barrio?: string;
  lat?: number;
  lng?: number;
  plan?: string;
  ciclo?: "mensual" | "anual";
};

function parseSignup(data: SignupPayload | undefined) {
  const username = assertUsername(String(data?.username ?? ""));
  const password = data?.password ?? "";
  const name = String(data?.name ?? "").trim();
  const phone = digitsOnly(String(data?.phone ?? ""));
  const email = data?.email != null ? String(data.email).trim() : undefined;
  const barbershopName = String(data?.barbershopName ?? "").trim();
  const address = String(data?.address ?? "").trim();
  const country = data?.country != null ? String(data.country).trim().toUpperCase() : undefined;
  const city = data?.city != null ? String(data.city).trim() : undefined;
  const barrio = data?.barrio != null ? String(data.barrio).trim() : undefined;
  const lat = typeof data?.lat === "number" && Number.isFinite(data.lat) ? data.lat : undefined;
  const lng = typeof data?.lng === "number" && Number.isFinite(data.lng) ? data.lng : undefined;
  assertPassword(password);
  if (!name) throw new HttpsError("invalid-argument", "El nombre completo es obligatorio.");
  if (phone.length < MIN_PHONE_DIGITS) throw new HttpsError("invalid-argument", "Teléfono inválido.");
  if (!barbershopName) throw new HttpsError("invalid-argument", "El nombre de la barbería es obligatorio.");
  if (!address) throw new HttpsError("invalid-argument", "La dirección es obligatoria.");
  return { username, password, name, phone, email, barbershopName, address, country, city, barrio, lat, lng };
}

async function createBarberAccount(params: ReturnType<typeof parseSignup> & { pending: boolean; tier: string; plan?: string }) {
  const existing = await db().ref(`${ROOT}/users/${params.username}`).get();
  if (existing.exists()) throw new HttpsError("already-exists", "Ese nombre de usuario ya existe. Elige otro.");
  const posId = generateUniqueId();
  const barberId = generateUniqueId();
  const posPayload: Record<string, unknown> = {
    id: posId,
    name: params.barbershopName,
    address: params.address,
    ownerId: params.username,
    isActive: !params.pending,
    tier: params.tier,
  };
  if (params.plan) posPayload.plan = params.plan;
  if (params.country) posPayload.country = params.country;
  if (params.city) posPayload.city = params.city;
  if (params.barrio) posPayload.barrio = params.barrio;
  if (params.lat != null) posPayload.lat = params.lat;
  if (params.lng != null) posPayload.lng = params.lng;
  if (params.lat != null && params.lng != null) posPayload.locationUpdatedAt = new Date().toISOString();
  await db().ref(`${ROOT}/pointsOfSale/${posId}`).set(posPayload);
  await db().ref(`${ROOT}/settings/${posId}`).set({ ...DEFAULT_SETTINGS, posId, storeName: params.barbershopName });
  await db().ref(`${ROOT}/barbers/${barberId}`).set({ id: barberId, posId, name: params.name, specialty: "Barbero", active: true });
  const newUser: Record<string, unknown> = {
    username: params.username,
    role: "admin",
    name: params.name,
    posId,
    barberId,
    status: params.pending ? "pending_payment" : "active",
    loginAttempts: 0,
  };
  if (params.email) newUser.email = params.email;
  await db().ref(`${ROOT}/users/${params.username}`).set(newUser);
  await setPasswordHash(params.username, hashPasswordNode(params.password));
  const minted = await mintCustomTokenForUser(params.username, newUser);
  return { ...minted, posId };
}

export const completeSelfSignupFree = onCall(callableOpts, async (request) => {
  assertAppCheck(request);
  await consumeRateLimit("signup", ipHash(request), 5, 60 * 60 * 1000);
  const parsed = parseSignup(request.data as SignupPayload);
  const { tier, plan } = getFreeSignupTierAndPlan();
  const created = await createBarberAccount({ ...parsed, pending: false, tier, plan });
  return { success: true as const, customToken: created.customToken, user: created.user };
});

export const createPendingBarberSignup = onCall(callableOpts, async (request) => {
  assertAppCheck(request);
  await consumeRateLimit("signup", ipHash(request), 5, 60 * 60 * 1000);
  const data = request.data as SignupPayload | undefined;
  const parsed = parseSignup(data);
  const plan = data?.plan ?? "";
  const ciclo = data?.ciclo === "anual" ? "anual" : "mensual";
  if (!PAID_PLANS.includes(plan as typeof PAID_PLANS[number])) {
    throw new HttpsError("invalid-argument", "Plan de pago no válido.");
  }
  const created = await createBarberAccount({ ...parsed, pending: true, tier: plan, plan: plan === "solo" ? "basic" : "pro" });
  const secret = stripeSecret();
  if (!secret) throw new HttpsError("failed-precondition", "El pago con tarjeta no está configurado.");
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(secret, { apiVersion: "2023-10-16" });
  const pricePerMonth = PLAN_PRICES[plan] ?? 14.95;
  const amountCents = ciclo === "anual" ? Math.round(pricePerMonth * 0.6 * 12 * 100) : Math.round(pricePerMonth * 100);
  const origin = request.rawRequest.headers.origin || request.rawRequest.headers.referer || "https://localhost";
  const baseUrl = typeof origin === "string" ? origin.replace(/\/$/, "") : "https://localhost";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: { name: `BarberShow - ${plan} (${ciclo})`, description: `Plan ${plan}. Barbería: ${parsed.barbershopName}.` },
        unit_amount: amountCents,
      },
      quantity: 1,
    }],
    success_url: `${baseUrl}?signup=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}?signup=cancelled`,
    metadata: { username: parsed.username, posId: String(created.posId), plan, ciclo },
    customer_email: parsed.email || undefined,
  });
  if (!session.url) throw new HttpsError("internal", "No se pudo crear la sesión de pago.");
  return { url: session.url, customToken: created.customToken, user: created.user };
});

export const createPendingBarberSignupMobile = onCall(callableOpts, async (request) => {
  assertAppCheck(request);
  await consumeRateLimit("signup", ipHash(request), 5, 60 * 60 * 1000);
  const data = request.data as SignupPayload | undefined;
  const parsed = parseSignup(data);
  const plan = data?.plan ?? "";
  if (!PAID_PLANS.includes(plan as typeof PAID_PLANS[number])) {
    throw new HttpsError("invalid-argument", "Plan de pago no válido.");
  }
  const created = await createBarberAccount({ ...parsed, pending: true, tier: plan, plan: plan === "solo" ? "basic" : "pro" });
  return { success: true as const, customToken: created.customToken, user: created.user };
});

export const activatePlanFromPlay = onCall(callableOpts, async (request) => {
  const { claims } = requireAuth(request);
  if (!canActivatePosPlan(claims.role)) {
    throw new HttpsError("permission-denied", "Solo el dueño o administrador puede activar el plan.");
  }
  await consumeRateLimit("iap", claims.username, 10, 60 * 60 * 1000);
  const data = request.data as { purchaseToken?: string; productId?: string; receiptData?: string; platform?: string } | undefined;
  const productId = String(data?.productId ?? "").trim();
  const verified = await verifyStorePurchase({
    productId,
    purchaseToken: data?.purchaseToken,
    receiptData: data?.receiptData,
    platform: data?.platform,
  });
  const tierMeta = resolveTierFromProductId(verified.productId);
  if (!tierMeta) throw new HttpsError("invalid-argument", "Product ID no reconocido.");
  const username = claims.username;
  const userSnap = await db().ref(`${ROOT}/users/${username}`).get();
  if (!userSnap.exists()) throw new HttpsError("not-found", "Usuario no encontrado.");
  const userData = userSnap.val() as { posId?: number };
  const posId = userData.posId;
  if (posId == null) throw new HttpsError("failed-precondition", "Usuario sin barbería asignada.");
  await claimIapReceipt(username, iapReuseKeys(verified));
  await db().ref(`${ROOT}/pointsOfSale/${posId}`).update({
    isActive: true,
    tier: tierMeta.tier,
    plan: tierMeta.plan,
    subscriptionExpiresAt: verified.expiresAt,
  });
  await db().ref(`${ROOT}/users/${username}`).update({ status: "active" });
  const fresh = { ...(userSnap.val() as Record<string, unknown>), status: "active" };
  await syncUserClaims(request.auth!.uid, fresh, username);
  await writeAdminAudit(username, "iap_activate", "ok", posId);
  return { success: true };
});

export const verifyGooglePlayReceipt = onRequest({ region: "us-central1" }, async (req, res) => {
  try {
    if (!isEmulator() && process.env.PLAY_VERIFY_ALLOW_HTTP !== "true") {
      res.status(404).json({ error: "gone" });
      return;
    }
    const bid = String(req.query.bid || "");
    const subId = String(req.query.subId || "");
    const purchaseToken = String(req.query.purchaseToken || "");
    await consumeRateLimit("play-verify", crypto.createHash("sha256").update(req.ip || "unknown").digest("hex").slice(0, 32), 20, 15 * 60 * 1000);
    if (!subId || !purchaseToken) {
      res.status(400).json({ error: "missing" });
      return;
    }
    if (bid && bid !== (process.env.GOOGLE_PLAY_PACKAGE_NAME || "com.barbershow.app") && !isEmulator()) {
      res.status(400).json({ error: "package" });
      return;
    }
    const verified = await verifyGooglePlayPurchase(subId, purchaseToken);
    res.status(200).json({
      googleResponse: {
        payload: { expiryTimeMillis: String(new Date(verified.expiresAt).getTime()) },
      },
    });
  } catch {
    res.status(400).json({ error: "invalid" });
  }
});

export const registerClientAccount = onCall(callableOpts, async (request) => {
  assertAppCheck(request);
  await consumeRateLimit("signup-client", ipHash(request), 8, 60 * 60 * 1000);
  const data = request.data as { username?: string; password?: string; name?: string; phone?: string; posId?: number } | undefined;
  const username = assertUsername(String(data?.username ?? ""));
  const password = String(data?.password ?? "");
  const name = String(data?.name ?? "").trim();
  const phone = digitsOnly(String(data?.phone ?? ""));
  const posId = Number(data?.posId ?? 0);
  assertPassword(password);
  if (!name) throw new HttpsError("invalid-argument", "Nombre obligatorio.");
  if (phone.length < MIN_PHONE_DIGITS) throw new HttpsError("invalid-argument", "Teléfono inválido.");
  if (!Number.isFinite(posId) || posId <= 0) throw new HttpsError("invalid-argument", "Barbería inválida.");
  const posSnap = await db().ref(`${ROOT}/pointsOfSale/${posId}`).get();
  if (!posSnap.exists() || posSnap.val()?.isActive === false) {
    throw new HttpsError("not-found", "Barbería no encontrada.");
  }
  if (await resolveUsernameKey(username)) throw new HttpsError("already-exists", "Ese nombre de usuario ya existe.");
  const clientId = generateUniqueId();
  const phoneDisplay = String(data?.phone ?? "").trim();
  await db().ref(`${ROOT}/clients/${clientId}`).set({
    id: clientId,
    posId,
    nombre: name,
    telefono: phoneDisplay,
    email: "",
    ultimaVisita: "N/A",
    notas: "Registro de cliente",
    fechaRegistro: new Date().toISOString().split("T")[0],
    puntos: 0,
    status: "active",
    whatsappOptIn: false,
  });
  await indexClientPhone(posId, phoneDisplay, clientId);
  const newUser: Record<string, unknown> = {
    username,
    role: "cliente",
    name,
    posId,
    clientId,
    status: "active",
    loginAttempts: 0,
  };
  await db().ref(`${ROOT}/users/${username}`).set(newUser);
  await setPasswordHash(username, hashPasswordNode(password));
  await db().ref(`${ROOT}/clientPreferences/${username}`).set({ preferredPosId: posId });
  return mintCustomTokenForUser(username, newUser);
});

export const upsertStaffUser = onCall(callableOpts, async (request) => {
  const { claims } = requireAuth(request);
  const data = request.data as Record<string, unknown> | undefined;
  const username = assertUsername(String(data?.username ?? ""));
  const role = String(data?.role ?? "");
  const name = String(data?.name ?? "").trim();
  const posId = data?.posId == null ? null : Number(data.posId);
  const password = data?.password != null ? String(data.password) : "";
  if (!ALL_ROLES.includes(role as typeof ALL_ROLES[number])) throw new HttpsError("invalid-argument", "Rol no válido.");
  if (!name) throw new HttpsError("invalid-argument", "Nombre obligatorio.");
  if (!canCallerAssignRole(claims.role, role, claims.posId, posId)) {
    throw new HttpsError("permission-denied", "No puedes asignar ese rol.");
  }
  const existingSnap = await db().ref(`${ROOT}/users/${username}`).get();
  const existing = existingSnap.exists() ? (existingSnap.val() as Record<string, unknown>) : null;
  if (existing && (existing.role === "platform_owner" || username === "master")) {
    throw new HttpsError("permission-denied", "Esa cuenta no se puede modificar así.");
  }
  const toWrite: Record<string, unknown> = {
    username,
    role,
    name,
    posId,
    status: existing?.status || "active",
    loginAttempts: existing?.loginAttempts ?? 0,
  };
  if (data?.barberId != null) toWrite.barberId = Number(data.barberId);
  else if (existing?.barberId != null) toWrite.barberId = existing.barberId;
  if (data?.clientId != null) toWrite.clientId = Number(data.clientId);
  else if (existing?.clientId != null) toWrite.clientId = existing.clientId;
  if (data?.permissions) toWrite.permissions = data.permissions;
  if (existing?.lastLogin) toWrite.lastLogin = existing.lastLogin;
  if (existing?.photoUrl) toWrite.photoUrl = existing.photoUrl;
  if (existing?.authUid) toWrite.authUid = existing.authUid;
  if (typeof existing?.password === "string" && existing.password) {
    await migratePasswordSecret(username, existing.password);
  }
  await db().ref(`${ROOT}/users/${username}`).set(toWrite);
  if (password && password.length >= MIN_PASSWORD_LENGTH) {
    await setPasswordHash(username, hashPasswordNode(password));
  } else if (password) {
    throw new HttpsError("invalid-argument", `La contraseña es obligatoria (mín. ${MIN_PASSWORD_LENGTH} caracteres).`);
  } else if (!existing) {
    throw new HttpsError("invalid-argument", "La contraseña es obligatoria para usuarios nuevos.");
  }
  if (toWrite.authUid) {
    await syncUserClaims(String(toWrite.authUid), toWrite, username);
  }
  await writeAdminAudit(claims.username, existing ? "update_user" : "create_user", username, posId);
  return { success: true };
});

export const deleteStaffUser = onCall(callableOpts, async (request) => {
  const { claims } = requireAuth(request);
  const username = assertUsername(String((request.data as { username?: string })?.username ?? ""));
  if (username === claims.username) throw new HttpsError("failed-precondition", "No puedes eliminarte a ti mismo.");
  const snap = await db().ref(`${ROOT}/users/${username}`).get();
  if (!snap.exists()) return { success: true };
  const target = snap.val() as Record<string, unknown>;
  if (target.role === "platform_owner" || username === "master") {
    throw new HttpsError("permission-denied", "Esa cuenta no se puede eliminar.");
  }
  const targetPos = target.posId == null ? null : Number(target.posId);
  if (!canCallerAssignRole(claims.role, String(target.role), claims.posId, targetPos) && claims.role !== "superadmin" && claims.role !== "platform_owner") {
    throw new HttpsError("permission-denied", "No autorizado.");
  }
  await db().ref(`${ROOT}/users/${username}`).remove();
  await db().ref(`${ROOT}/authSecrets/${username}`).remove();
  if (target.authUid) {
    await admin.auth().deleteUser(String(target.authUid)).catch(() => undefined);
  }
  await writeAdminAudit(claims.username, "delete_user", username, targetPos);
  return { success: true };
});

export const updateMyProfile = onCall(callableOpts, async (request) => {
  const { claims } = requireAuth(request);
  const data = request.data as { name?: string; photoUrl?: string | null } | undefined;
  const snap = await db().ref(`${ROOT}/users/${claims.username}`).get();
  if (!snap.exists()) throw new HttpsError("not-found", "Usuario no encontrado.");
  const updates: Record<string, unknown> = {};
  if (data?.name !== undefined) {
    const name = String(data.name).trim();
    if (!name || name.length > 120) throw new HttpsError("invalid-argument", "Nombre inválido.");
    updates.name = name;
  }
  if (data?.photoUrl !== undefined) {
    if (data.photoUrl && String(data.photoUrl).length > 500000) throw new HttpsError("invalid-argument", "Imagen demasiado grande.");
    updates.photoUrl = data.photoUrl || null;
  }
  if (Object.keys(updates).length) {
    await db().ref(`${ROOT}/users/${claims.username}`).update(updates);
  }
  return { success: true };
});

export const adminSetPosPlan = onCall(callableOpts, async (request) => {
  const { claims } = requirePlatformOwner(request);
  const data = request.data as { posId?: number; tier?: string; plan?: string; subscriptionExpiresAt?: string | null } | undefined;
  const posId = Number(data?.posId);
  const tier = String(data?.tier ?? "");
  const plan = String(data?.plan ?? "");
  if (!Number.isFinite(posId)) throw new HttpsError("invalid-argument", "Sede inválida.");
  if (!["gratuito", "solo", "barberia", "multisede"].includes(tier)) throw new HttpsError("invalid-argument", "Tier inválido.");
  if (!["basic", "pro"].includes(plan)) throw new HttpsError("invalid-argument", "Plan inválido.");
  const updates: Record<string, unknown> = { tier, plan };
  if (data?.subscriptionExpiresAt !== undefined) {
    updates.subscriptionExpiresAt = data.subscriptionExpiresAt ? String(data.subscriptionExpiresAt) : null;
  }
  await db().ref(`${ROOT}/pointsOfSale/${posId}`).update(updates);
  await writeAdminAudit(claims.username, "set_pos_plan", `${tier}/${plan}`, posId);
  return { success: true };
});

export const adminUpsertPointOfSale = onCall(callableOpts, async (request) => {
  const { claims } = requirePlatformOwner(request);
  const data = request.data as Record<string, unknown> | undefined;
  const name = String(data?.name ?? "").trim();
  const address = String(data?.address ?? "").trim();
  if (!name || !address) throw new HttpsError("invalid-argument", "Nombre y dirección obligatorios.");
  const id = data?.id != null ? Number(data.id) : generateUniqueId();
  const existing = await db().ref(`${ROOT}/pointsOfSale/${id}`).get();
  const prev = existing.exists() ? (existing.val() as Record<string, unknown>) : {};
  const payload: Record<string, unknown> = {
    ...prev,
    id,
    name,
    address,
    ownerId: String(data?.ownerId ?? prev.ownerId ?? ""),
    isActive: data?.isActive !== undefined ? Boolean(data.isActive) : prev.isActive !== false,
    tier: data?.tier ?? prev.tier ?? "solo",
    plan: data?.plan ?? prev.plan ?? "basic",
  };
  if (data?.country) payload.country = data.country;
  if (data?.city) payload.city = data.city;
  if (data?.barrio) payload.barrio = data.barrio;
  if (typeof data?.lat === "number") payload.lat = data.lat;
  if (typeof data?.lng === "number") payload.lng = data.lng;
  await db().ref(`${ROOT}/pointsOfSale/${id}`).set(payload);
  if (!existing.exists()) {
    await db().ref(`${ROOT}/settings/${id}`).set({ ...DEFAULT_SETTINGS, posId: id, storeName: name });
  }
  await writeAdminAudit(claims.username, existing.exists() ? "update_pos" : "create_pos", name, id);
  return { pos: payload };
});

export const adminDeletePointOfSale = onCall(callableOpts, async (request) => {
  const { claims } = requirePlatformOwner(request);
  const posId = Number((request.data as { posId?: number })?.posId);
  if (!Number.isFinite(posId)) throw new HttpsError("invalid-argument", "Sede inválida.");
  await db().ref(`${ROOT}/pointsOfSale/${posId}`).remove();
  await db().ref(`${ROOT}/settings/${posId}`).remove();
  await writeAdminAudit(claims.username, "delete_pos", "deleted", posId);
  return { success: true };
});

export const switchActivePos = onCall(callableOpts, async (request) => {
  const { uid, claims } = requireAuth(request);
  const posId = Number((request.data as { posId?: number })?.posId);
  if (!Number.isFinite(posId)) throw new HttpsError("invalid-argument", "Sede inválida.");
  const posSnap = await db().ref(`${ROOT}/pointsOfSale/${posId}`).get();
  if (!posSnap.exists()) throw new HttpsError("not-found", "Sede no encontrada.");
  const pos = posSnap.val() as { ownerId?: string };
  if (claims.role === "cliente") {
    await db().ref(`${ROOT}/clientPreferences/${claims.username}`).set({ preferredPosId: posId });
    return { success: true, posId };
  }
  const allowed = canRewritePosClaim({
    role: claims.role,
    claimsPosId: claims.posId,
    targetPosId: posId,
    ownerId: pos.ownerId,
    username: claims.username,
  });
  if (!allowed) throw new HttpsError("permission-denied", "No autorizado.");
  const userSnap = await db().ref(`${ROOT}/users/${claims.username}`).get();
  const user = (userSnap.exists() ? userSnap.val() : { role: claims.role, username: claims.username }) as Record<string, unknown>;
  if (isPlatformRole(claims.role) || pos.ownerId === claims.username) {
    user.posId = posId;
  }
  await syncUserClaims(uid, user, claims.username);
  return { success: true, posId };
});

export const deleteMyAccount = onCall(callableOpts, async (request) => {
  const { uid, claims } = requireAuth(request);
  await consumeRateLimit("delete-account", claims.username, 5, 60 * 60 * 1000);
  if (claims.role === "platform_owner" || claims.role === "superadmin") {
    throw new HttpsError("permission-denied", "Esta cuenta no puede eliminarse desde la app.");
  }
  const data = request.data as { password?: string; reason?: string; customReason?: string; improvementFeedback?: string; platform?: string; appVersion?: string } | undefined;
  const password = String(data?.password ?? "");
  if (!password) throw new HttpsError("invalid-argument", "Confirma tu contraseña.");
  const userSnap = await db().ref(`${ROOT}/users/${claims.username}`).get();
  if (!userSnap.exists()) throw new HttpsError("not-found", "Usuario no encontrado.");
  const user = userSnap.val() as Record<string, unknown>;
  const stored = await readPasswordHash(claims.username, user);
  if (!stored || !verifyPasswordNode(password, stored)) {
    throw new HttpsError("unauthenticated", "La contraseña es incorrecta.");
  }
  const reasons = ["no_longer_need_app", "found_another_barbershop", "technical_issues", "hard_to_use", "too_many_notifications", "account_issues", "privacy_security", "other"];
  const reason = reasons.includes(String(data?.reason || "")) ? String(data?.reason) : "other";
  try {
    await firestore().collection("account_deactivation_feedback").add({
      userId: claims.username,
      username: claims.username,
      reason,
      customReason: data?.customReason ? String(data.customReason).slice(0, 2000) : null,
      improvementFeedback: data?.improvementFeedback ? String(data.improvementFeedback).slice(0, 2000) : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      platform: ["web", "ios", "android", "unknown"].includes(String(data?.platform)) ? data?.platform : "unknown",
      appVersion: String(data?.appVersion || "").slice(0, 40),
    });
  } catch {
    // feedback best-effort
  }
  await db().ref(`${ROOT}/users/${claims.username}`).remove();
  await db().ref(`${ROOT}/authSecrets/${claims.username}`).remove();
  await db().ref(`${ROOT}/uidIndex/${uid}`).remove();
  await admin.auth().deleteUser(uid).catch(() => undefined);
  await writeAdminAudit(claims.username, "delete_account", "self");
  return { success: true };
});

export const listPublicShops = onCall(callableOpts, async (request) => {
  assertAppCheck(request);
  await consumeRateLimit("public-shops", ipHash(request), 60, 15 * 60 * 1000);
  const snap = await db().ref(`${ROOT}/pointsOfSale`).get();
  if (!snap.exists()) return { shops: [] as Record<string, unknown>[] };
  const raw = snap.val() as Record<string, Record<string, unknown>>;
  const shops = Object.values(raw).map((p) => sanitizePublicShop(p)).filter((p): p is Record<string, unknown> => p != null);
  return { shops };
});

export const getPublicBookingCatalog = onCall(callableOpts, async (request) => {
  assertAppCheck(request);
  await consumeRateLimit("public-catalog", ipHash(request), 60, 15 * 60 * 1000);
  const posId = Number((request.data as { posId?: number })?.posId);
  if (!Number.isFinite(posId)) throw new HttpsError("invalid-argument", "Sede inválida.");
  const posSnap = await db().ref(`${ROOT}/pointsOfSale/${posId}`).get();
  const shop = sanitizePublicShop(posSnap.val());
  if (!shop) throw new HttpsError("not-found", "Barbería no encontrada.");
  const [servicesSnap, barbersSnap, busySlots] = await Promise.all([
    db().ref(`${ROOT}/services`).orderByChild("posId").equalTo(posId).get(),
    db().ref(`${ROOT}/barbers`).orderByChild("posId").equalTo(posId).get(),
    loadBusySlotsForPos(posId),
  ]);
  const services = Object.values((servicesSnap.val() || {}) as Record<string, Record<string, unknown>>).map((s) => ({
    id: Number(s.id),
    posId,
    name: s.name,
    price: s.price,
    duration: s.duration,
    barberId: s.barberId ?? null,
  }));
  const barbers = Object.values((barbersSnap.val() || {}) as Record<string, Record<string, unknown>>)
    .map((b) => sanitizePublicBarber(b, posId))
    .filter((b): b is Record<string, unknown> => b != null);
  const galleries: Record<string, unknown[]> = {};
  await Promise.all(barbers.map(async (b) => {
    const g = await db().ref(`${ROOT}/barberGallery/${b.id}`).get();
    if (g.exists()) {
      galleries[String(b.id)] = Object.values(g.val() as Record<string, unknown>).map((photo) => {
        const p = photo as Record<string, unknown>;
        return { id: p.id, barberId: p.barberId, imageUrl: p.imageUrl, caption: p.caption, createdAt: p.createdAt };
      });
    }
  }));
  return { shop, services, barbers, busySlots, galleries };
});

export const createGuestAppointment = onCall(callableOpts, async (request) => {
  assertAppCheck(request);
  await consumeRateLimit("guest-book", ipHash(request), 10, 60 * 60 * 1000);
  const data = request.data as {
    posId?: number;
    barberoId?: number;
    fecha?: string;
    hora?: string;
    nombre?: string;
    telefono?: string;
    servicios?: Array<{ id: number }>;
  } | undefined;
  const parsed = assertBookingPayload(data || {});
  await assertPosAndBarber(parsed.posId, parsed.barberoId);
  const servicios = await resolveServicesFromIds(parsed.posId, data?.servicios);
  const clientId = await ensureClientForBooking({
    posId: parsed.posId,
    nombre: parsed.nombre,
    telefono: parsed.telefono,
    notas: "Reserva sin cuenta (invitado)",
  });
  const appointmentId = await createPendingAppointment({
    posId: parsed.posId,
    barberoId: parsed.barberoId,
    fecha: parsed.fecha,
    hora: parsed.hora,
    clienteId: clientId,
    servicios,
  });
  return { success: true, appointmentId };
});

export const stripeWebhook = onRequest({ region: "us-central1" }, async (req, res) => {
  const secret = stripeSecret();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || config().stripe?.webhook_secret;
  if (!secret || !webhookSecret) {
    res.status(500).send("Stripe no configurado");
    return;
  }
  const sig = req.headers["stripe-signature"];
  if (!sig || typeof sig !== "string") {
    res.status(400).send("Falta firma");
    return;
  }
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(secret, { apiVersion: "2023-10-16" });
  let event: { type: string; data?: { object?: { metadata?: Record<string, string> | null } } };
  try {
    const rawBody = (req as unknown as { rawBody?: Buffer | string }).rawBody ?? req.body;
    const payload = Buffer.isBuffer(rawBody) ? rawBody : (typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody));
    event = stripe.webhooks.constructEvent(payload, sig, webhookSecret) as typeof event;
  } catch {
    res.status(400).send("Firma inválida");
    return;
  }
  if (event.type !== "checkout.session.completed") {
    res.status(200).send("ok");
    return;
  }
  const metadata = event.data?.object?.metadata;
  if (!metadata?.username || !metadata?.posId) {
    res.status(200).send("ok");
    return;
  }
  const username = metadata.username;
  const posId = Number(metadata.posId);
  const ciclo = metadata.ciclo || "mensual";
  const now = new Date();
  const expiresAt = ciclo === "anual"
    ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString()
    : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString();
  await db().ref(`${ROOT}/pointsOfSale/${posId}`).update({ isActive: true, subscriptionExpiresAt: expiresAt });
  await db().ref(`${ROOT}/users/${username}`).update({ status: "active" });
  const userSnap = await db().ref(`${ROOT}/users/${username}`).get();
  if (userSnap.exists()) {
    const user = userSnap.val() as Record<string, unknown>;
    if (user.authUid) await syncUserClaims(String(user.authUid), { ...user, status: "active" }, username);
  }
  res.status(200).send("ok");
});

export const createPlanCheckout = onCall(callableOpts, async (request) => {
  const { claims } = requireAuth(request);
  if (!isStaffRole(claims.role) && !isPlatformRole(claims.role)) {
    throw new HttpsError("permission-denied", "No autorizado.");
  }
  const data = request.data as { plan?: string; ciclo?: "mensual" | "anual"; email?: string } | undefined;
  const plan = String(data?.plan ?? "");
  const ciclo = data?.ciclo === "anual" ? "anual" : "mensual";
  if (!PAID_PLANS.includes(plan as typeof PAID_PLANS[number])) throw new HttpsError("invalid-argument", "Plan no válido.");
  if (claims.posId == null) throw new HttpsError("failed-precondition", "Sin sede.");
  const secret = stripeSecret();
  if (!secret) throw new HttpsError("failed-precondition", "Pago no configurado.");
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(secret, { apiVersion: "2023-10-16" });
  const pricePerMonth = PLAN_PRICES[plan] ?? 14.95;
  const amountCents = ciclo === "anual" ? Math.round(pricePerMonth * 0.6 * 12 * 100) : Math.round(pricePerMonth * 100);
  const origin = request.rawRequest.headers.origin || "https://localhost";
  const baseUrl = typeof origin === "string" ? origin.replace(/\/$/, "") : "https://localhost";
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "usd",
        product_data: { name: `BarberShow - ${plan} (${ciclo})` },
        unit_amount: amountCents,
      },
      quantity: 1,
    }],
    success_url: `${baseUrl}?upgrade=success`,
    cancel_url: `${baseUrl}?upgrade=cancelled`,
    metadata: { username: claims.username, posId: String(claims.posId), plan, ciclo },
    customer_email: data?.email || undefined,
  });
  if (!session.url) throw new HttpsError("internal", "No se pudo crear el checkout.");
  return { url: session.url };
});

export {
  updateMyClientProfile,
  createClientAppointment,
  cancelMyAppointment,
  getShopCatalog,
  createClientShopOrder,
  getPlatformStats,
  listDirectoryUsers,
  onSaleCreated,
  onAppointmentCreated,
  onUserCreated,
  onPosCreated,
} from "./clientOps";
