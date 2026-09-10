"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createPlanCheckout = exports.stripeWebhook = exports.createGuestAppointment = exports.getPublicBookingCatalog = exports.listPublicShops = exports.deleteMyAccount = exports.switchActivePos = exports.adminDeletePointOfSale = exports.adminUpsertPointOfSale = exports.adminSetPosPlan = exports.updateMyProfile = exports.deleteStaffUser = exports.upsertStaffUser = exports.registerClientAccount = exports.verifyGooglePlayReceipt = exports.activatePlanFromPlay = exports.createPendingBarberSignupMobile = exports.createPendingBarberSignup = exports.completeSelfSignupFree = exports.sendWhatsAppMessage = exports.checkUsernameAvailable = exports.authenticateMasterWithPassword = exports.loginWithPassword = void 0;
const https_1 = require("firebase-functions/v2/https");
const v1_1 = require("firebase-functions/v1");
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
const lib_1 = require("./lib");
const iapVerify_1 = require("./iapVerify");
if (!admin.apps.length) {
    admin.initializeApp();
}
const callableOpts = { region: "us-central1" };
function getFreeSignupTierAndPlan() {
    const globalFree = process.env.GLOBAL_FREE_MODE !== "false";
    if (globalFree)
        return { tier: "barberia", plan: "pro" };
    return { tier: "gratuito", plan: "basic" };
}
const PLAN_PRICES = {
    solo: 14.95,
    barberia: 19.95,
    multisede: 29.95,
};
const MASTER_USER = {
    username: "master",
    role: "platform_owner",
    name: "Master Admin",
    posId: null,
};
function stripeSecret() {
    var _a;
    return process.env.STRIPE_SECRET_KEY || ((_a = (0, v1_1.config)().stripe) === null || _a === void 0 ? void 0 : _a.secret_key);
}
function masterPassword() {
    var _a;
    return process.env.MASTER_PASSWORD || ((_a = (0, v1_1.config)().master) === null || _a === void 0 ? void 0 : _a.password);
}
async function findClientPhoneInPos(posId, phone) {
    const snap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/clients`).orderByChild("posId").equalTo(posId).get();
    if (!snap.exists())
        return false;
    const want = (0, lib_1.digitsOnly)(phone);
    const val = snap.val();
    return Object.values(val).some((c) => (0, lib_1.digitsOnly)(String(c.telefono || "")) === want);
}
function isStoredHashSafe(stored) {
    return stored.includes(":") && stored.split(":")[0].length === 32;
}
exports.loginWithPassword = (0, https_1.onCall)(callableOpts, async (request) => {
    var _a, _b;
    (0, lib_1.assertAppCheck)(request);
    const data = request.data;
    const usernameRaw = String((_a = data === null || data === void 0 ? void 0 : data.username) !== null && _a !== void 0 ? _a : "").trim();
    const password = String((_b = data === null || data === void 0 ? void 0 : data.password) !== null && _b !== void 0 ? _b : "");
    await (0, lib_1.consumeRateLimit)("login-ip", (0, lib_1.ipHash)(request), 20, 15 * 60 * 1000);
    await (0, lib_1.consumeRateLimit)("login-user", usernameRaw.toLowerCase() || "unknown", 8, 15 * 60 * 1000);
    if (!usernameRaw || !password) {
        throw new https_1.HttpsError("unauthenticated", "Usuario o contraseña incorrectos.");
    }
    if (usernameRaw.toLowerCase() === "master") {
        throw new https_1.HttpsError("unauthenticated", "Usa el acceso Master.");
    }
    const dbKey = await (0, lib_1.resolveUsernameKey)(usernameRaw);
    if (!dbKey) {
        throw new https_1.HttpsError("unauthenticated", "Usuario o contraseña incorrectos.");
    }
    const snap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/users/${dbKey}`).get();
    if (!snap.exists()) {
        throw new https_1.HttpsError("unauthenticated", "Usuario o contraseña incorrectos.");
    }
    const user = snap.val();
    if (user.active === false || user.accountStatus === "deactivated") {
        throw new https_1.HttpsError("failed-precondition", "ACCOUNT_DEACTIVATED");
    }
    if (user.status === "suspended" || user.status === "locked") {
        throw new https_1.HttpsError("unauthenticated", "Usuario o contraseña incorrectos.");
    }
    const stored = await (0, lib_1.readPasswordHash)(dbKey, user);
    if (!stored) {
        throw new https_1.HttpsError("failed-precondition", "NO_PASSWORD_SET");
    }
    if (!(0, lib_1.verifyPasswordNode)(password, stored)) {
        throw new https_1.HttpsError("unauthenticated", "Usuario o contraseña incorrectos.");
    }
    if (typeof user.password === "string") {
        await (0, lib_1.migratePasswordSecret)(dbKey, isStoredHashSafe(stored) ? stored : (0, lib_1.hashPasswordNode)(password));
    }
    await (0, lib_1.db)().ref(`${lib_1.ROOT}/users/${dbKey}`).update({ lastLogin: new Date().toISOString(), loginAttempts: 0 });
    const fresh = { ...user, lastLogin: new Date().toISOString(), loginAttempts: 0 };
    const minted = await (0, lib_1.mintCustomTokenForUser)(dbKey, fresh);
    await (0, lib_1.writeAdminAudit)(dbKey, "login", "login_ok", typeof user.posId === "number" ? user.posId : null);
    return minted;
});
exports.authenticateMasterWithPassword = (0, https_1.onCall)(callableOpts, async (request) => {
    var _a, _b;
    (0, lib_1.assertAppCheck)(request);
    await (0, lib_1.consumeRateLimit)("login-master", (0, lib_1.ipHash)(request), 8, 15 * 60 * 1000);
    const expected = masterPassword();
    if (!expected) {
        throw new https_1.HttpsError("failed-precondition", "Master no está configurado.");
    }
    const data = request.data;
    const username = String((_a = data === null || data === void 0 ? void 0 : data.username) !== null && _a !== void 0 ? _a : "").trim().toLowerCase();
    const password = (_b = data === null || data === void 0 ? void 0 : data.password) !== null && _b !== void 0 ? _b : "";
    if (username !== "master" || password !== expected) {
        throw new https_1.HttpsError("unauthenticated", "Usuario o contraseña incorrectos para Master Admin.");
    }
    const uid = "bs_master_platform";
    try {
        await admin.auth().createUser({ uid, displayName: MASTER_USER.name, disabled: false });
    }
    catch (err) {
        const code = err.code;
        if (code !== "auth/uid-already-exists")
            throw err;
    }
    await admin.auth().setCustomUserClaims(uid, { role: "platform_owner", username: "master" });
    const customToken = await admin.auth().createCustomToken(uid);
    await (0, lib_1.migrateAllLegacyPasswordSecrets)().catch(() => 0);
    await (0, lib_1.writeAdminAudit)("master", "master_login", "master_ok");
    return { customToken, user: MASTER_USER };
});
exports.checkUsernameAvailable = (0, https_1.onCall)(callableOpts, async (request) => {
    var _a, _b;
    (0, lib_1.assertAppCheck)(request);
    await (0, lib_1.consumeRateLimit)("username", (0, lib_1.ipHash)(request), 30, 15 * 60 * 1000);
    const username = String((_b = (_a = request.data) === null || _a === void 0 ? void 0 : _a.username) !== null && _b !== void 0 ? _b : "").trim().toLowerCase();
    if (!username)
        return { taken: false };
    const key = await (0, lib_1.resolveUsernameKey)(username);
    return { taken: key != null || username === "master" };
});
exports.sendWhatsAppMessage = (0, https_1.onCall)(callableOpts, async (request) => {
    var _a, _b, _c, _d, _e;
    const { claims } = (0, lib_1.requireAuth)(request);
    if (!(0, lib_1.isStaffRole)(claims.role) && !(0, lib_1.isPlatformRole)(claims.role)) {
        throw new https_1.HttpsError("permission-denied", "No autorizado.");
    }
    const posId = claims.posId;
    if (posId == null && !(0, lib_1.isPlatformRole)(claims.role)) {
        throw new https_1.HttpsError("permission-denied", "No hay sede asociada.");
    }
    await (0, lib_1.consumeRateLimit)("whatsapp", String(posId !== null && posId !== void 0 ? posId : claims.username), 20, 60 * 60 * 1000);
    const sid = process.env.TWILIO_ACCOUNT_SID || ((_a = (0, v1_1.config)().twilio) === null || _a === void 0 ? void 0 : _a.sid);
    const token = process.env.TWILIO_AUTH_TOKEN || ((_b = (0, v1_1.config)().twilio) === null || _b === void 0 ? void 0 : _b.token);
    const from = process.env.TWILIO_WHATSAPP_FROM || ((_c = (0, v1_1.config)().twilio) === null || _c === void 0 ? void 0 : _c.whatsapp_from);
    if (!sid || !token || !from) {
        throw new https_1.HttpsError("failed-precondition", "WhatsApp no está configurado.");
    }
    const data = request.data;
    const to = (_d = data === null || data === void 0 ? void 0 : data.to) === null || _d === void 0 ? void 0 : _d.trim();
    const body = (_e = data === null || data === void 0 ? void 0 : data.body) === null || _e === void 0 ? void 0 : _e.trim();
    if (!to || !body) {
        throw new https_1.HttpsError("invalid-argument", "Faltan destino o mensaje.");
    }
    if (body.length > 1000) {
        throw new https_1.HttpsError("invalid-argument", "Mensaje demasiado largo.");
    }
    if (posId != null && !(0, lib_1.isPlatformRole)(claims.role)) {
        const belongs = await findClientPhoneInPos(posId, to);
        if (!belongs) {
            throw new https_1.HttpsError("permission-denied", "El destino no pertenece a tu sede.");
        }
    }
    let phone = (0, lib_1.digitsOnly)(to);
    if (phone.length === 10 && !to.startsWith("+"))
        phone = "52" + phone;
    if (!phone.startsWith("+"))
        phone = "+" + phone;
    const authHeader = Buffer.from(`${sid}:${token}`).toString("base64");
    const params = new URLSearchParams({ To: `whatsapp:${phone}`, From: from, Body: body });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${authHeader}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
    });
    if (!res.ok) {
        throw new https_1.HttpsError("internal", "No se pudo enviar el mensaje.");
    }
    const json = (await res.json());
    await (0, lib_1.writeAdminAudit)(claims.username, "whatsapp_send", "sent", posId);
    return { success: true, sid: json.sid };
});
function parseSignup(data) {
    var _a, _b, _c, _d, _e, _f;
    const username = (0, lib_1.assertUsername)(String((_a = data === null || data === void 0 ? void 0 : data.username) !== null && _a !== void 0 ? _a : ""));
    const password = (_b = data === null || data === void 0 ? void 0 : data.password) !== null && _b !== void 0 ? _b : "";
    const name = String((_c = data === null || data === void 0 ? void 0 : data.name) !== null && _c !== void 0 ? _c : "").trim();
    const phone = (0, lib_1.digitsOnly)(String((_d = data === null || data === void 0 ? void 0 : data.phone) !== null && _d !== void 0 ? _d : ""));
    const email = (data === null || data === void 0 ? void 0 : data.email) != null ? String(data.email).trim() : undefined;
    const barbershopName = String((_e = data === null || data === void 0 ? void 0 : data.barbershopName) !== null && _e !== void 0 ? _e : "").trim();
    const address = String((_f = data === null || data === void 0 ? void 0 : data.address) !== null && _f !== void 0 ? _f : "").trim();
    const country = (data === null || data === void 0 ? void 0 : data.country) != null ? String(data.country).trim().toUpperCase() : undefined;
    const city = (data === null || data === void 0 ? void 0 : data.city) != null ? String(data.city).trim() : undefined;
    const barrio = (data === null || data === void 0 ? void 0 : data.barrio) != null ? String(data.barrio).trim() : undefined;
    const lat = typeof (data === null || data === void 0 ? void 0 : data.lat) === "number" && Number.isFinite(data.lat) ? data.lat : undefined;
    const lng = typeof (data === null || data === void 0 ? void 0 : data.lng) === "number" && Number.isFinite(data.lng) ? data.lng : undefined;
    if (!password || password.length < 6)
        throw new https_1.HttpsError("invalid-argument", "La contraseña es obligatoria (mín. 6 caracteres).");
    if (!name)
        throw new https_1.HttpsError("invalid-argument", "El nombre completo es obligatorio.");
    if (phone.length < lib_1.MIN_PHONE_DIGITS)
        throw new https_1.HttpsError("invalid-argument", "Teléfono inválido.");
    if (!barbershopName)
        throw new https_1.HttpsError("invalid-argument", "El nombre de la barbería es obligatorio.");
    if (!address)
        throw new https_1.HttpsError("invalid-argument", "La dirección es obligatoria.");
    return { username, password, name, phone, email, barbershopName, address, country, city, barrio, lat, lng };
}
async function createBarberAccount(params) {
    const existing = await (0, lib_1.db)().ref(`${lib_1.ROOT}/users/${params.username}`).get();
    if (existing.exists())
        throw new https_1.HttpsError("already-exists", "Ese nombre de usuario ya existe. Elige otro.");
    const posId = (0, lib_1.generateUniqueId)();
    const barberId = (0, lib_1.generateUniqueId)();
    const posPayload = {
        id: posId,
        name: params.barbershopName,
        address: params.address,
        ownerId: params.username,
        isActive: !params.pending,
        tier: params.tier,
    };
    if (params.plan)
        posPayload.plan = params.plan;
    if (params.country)
        posPayload.country = params.country;
    if (params.city)
        posPayload.city = params.city;
    if (params.barrio)
        posPayload.barrio = params.barrio;
    if (params.lat != null)
        posPayload.lat = params.lat;
    if (params.lng != null)
        posPayload.lng = params.lng;
    if (params.lat != null && params.lng != null)
        posPayload.locationUpdatedAt = new Date().toISOString();
    await (0, lib_1.db)().ref(`${lib_1.ROOT}/pointsOfSale/${posId}`).set(posPayload);
    await (0, lib_1.db)().ref(`${lib_1.ROOT}/settings/${posId}`).set({ ...lib_1.DEFAULT_SETTINGS, posId, storeName: params.barbershopName });
    await (0, lib_1.db)().ref(`${lib_1.ROOT}/barbers/${barberId}`).set({ id: barberId, posId, name: params.name, specialty: "Barbero", active: true });
    const newUser = {
        username: params.username,
        role: "admin",
        name: params.name,
        posId,
        barberId,
        status: params.pending ? "pending_payment" : "active",
        loginAttempts: 0,
    };
    if (params.email)
        newUser.email = params.email;
    await (0, lib_1.db)().ref(`${lib_1.ROOT}/users/${params.username}`).set(newUser);
    await (0, lib_1.setPasswordHash)(params.username, (0, lib_1.hashPasswordNode)(params.password));
    const minted = await (0, lib_1.mintCustomTokenForUser)(params.username, newUser);
    return { ...minted, posId };
}
exports.completeSelfSignupFree = (0, https_1.onCall)(callableOpts, async (request) => {
    (0, lib_1.assertAppCheck)(request);
    await (0, lib_1.consumeRateLimit)("signup", (0, lib_1.ipHash)(request), 5, 60 * 60 * 1000);
    const parsed = parseSignup(request.data);
    const { tier, plan } = getFreeSignupTierAndPlan();
    const created = await createBarberAccount({ ...parsed, pending: false, tier, plan });
    return { success: true, customToken: created.customToken, user: created.user };
});
exports.createPendingBarberSignup = (0, https_1.onCall)(callableOpts, async (request) => {
    var _a, _b;
    (0, lib_1.assertAppCheck)(request);
    await (0, lib_1.consumeRateLimit)("signup", (0, lib_1.ipHash)(request), 5, 60 * 60 * 1000);
    const data = request.data;
    const parsed = parseSignup(data);
    const plan = (_a = data === null || data === void 0 ? void 0 : data.plan) !== null && _a !== void 0 ? _a : "";
    const ciclo = (data === null || data === void 0 ? void 0 : data.ciclo) === "anual" ? "anual" : "mensual";
    if (!lib_1.PAID_PLANS.includes(plan)) {
        throw new https_1.HttpsError("invalid-argument", "Plan de pago no válido.");
    }
    const created = await createBarberAccount({ ...parsed, pending: true, tier: plan, plan: plan === "solo" ? "basic" : "pro" });
    const secret = stripeSecret();
    if (!secret)
        throw new https_1.HttpsError("failed-precondition", "El pago con tarjeta no está configurado.");
    const Stripe = (await Promise.resolve().then(() => __importStar(require("stripe")))).default;
    const stripe = new Stripe(secret, { apiVersion: "2023-10-16" });
    const pricePerMonth = (_b = PLAN_PRICES[plan]) !== null && _b !== void 0 ? _b : 14.95;
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
    if (!session.url)
        throw new https_1.HttpsError("internal", "No se pudo crear la sesión de pago.");
    return { url: session.url, customToken: created.customToken, user: created.user };
});
exports.createPendingBarberSignupMobile = (0, https_1.onCall)(callableOpts, async (request) => {
    var _a;
    (0, lib_1.assertAppCheck)(request);
    await (0, lib_1.consumeRateLimit)("signup", (0, lib_1.ipHash)(request), 5, 60 * 60 * 1000);
    const data = request.data;
    const parsed = parseSignup(data);
    const plan = (_a = data === null || data === void 0 ? void 0 : data.plan) !== null && _a !== void 0 ? _a : "";
    if (!lib_1.PAID_PLANS.includes(plan)) {
        throw new https_1.HttpsError("invalid-argument", "Plan de pago no válido.");
    }
    const created = await createBarberAccount({ ...parsed, pending: true, tier: plan, plan: plan === "solo" ? "basic" : "pro" });
    return { success: true, customToken: created.customToken, user: created.user };
});
exports.activatePlanFromPlay = (0, https_1.onCall)(callableOpts, async (request) => {
    var _a, _b;
    const { claims } = (0, lib_1.requireAuth)(request);
    await (0, lib_1.consumeRateLimit)("iap", claims.username, 10, 60 * 60 * 1000);
    const data = request.data;
    const productId = String((_a = data === null || data === void 0 ? void 0 : data.productId) !== null && _a !== void 0 ? _a : "").trim();
    const verified = await (0, iapVerify_1.verifyStorePurchase)({
        productId,
        purchaseToken: data === null || data === void 0 ? void 0 : data.purchaseToken,
        receiptData: data === null || data === void 0 ? void 0 : data.receiptData,
        platform: data === null || data === void 0 ? void 0 : data.platform,
    });
    const tierMeta = (0, lib_1.resolveTierFromProductId)(verified.productId);
    if (!tierMeta)
        throw new https_1.HttpsError("invalid-argument", "Product ID no reconocido.");
    const username = claims.username;
    const userSnap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/users/${username}`).get();
    if (!userSnap.exists())
        throw new https_1.HttpsError("not-found", "Usuario no encontrado.");
    const userData = userSnap.val();
    const posId = userData.posId;
    if (posId == null)
        throw new https_1.HttpsError("failed-precondition", "Usuario sin barbería asignada.");
    if (verified.originalTransactionId) {
        const used = await (0, lib_1.db)().ref(`${lib_1.ROOT}/authSecrets/_iap/${verified.originalTransactionId}`).get();
        if (used.exists() && ((_b = used.val()) === null || _b === void 0 ? void 0 : _b.username) && used.val().username !== username) {
            throw new https_1.HttpsError("already-exists", "Este recibo ya fue usado.");
        }
        await (0, lib_1.db)().ref(`${lib_1.ROOT}/authSecrets/_iap/${verified.originalTransactionId}`).set({ username, at: new Date().toISOString() });
    }
    await (0, lib_1.db)().ref(`${lib_1.ROOT}/pointsOfSale/${posId}`).update({
        isActive: true,
        tier: tierMeta.tier,
        plan: tierMeta.plan,
        subscriptionExpiresAt: verified.expiresAt,
    });
    await (0, lib_1.db)().ref(`${lib_1.ROOT}/users/${username}`).update({ status: "active" });
    const fresh = { ...userSnap.val(), status: "active" };
    await (0, lib_1.syncUserClaims)(request.auth.uid, fresh, username);
    await (0, lib_1.writeAdminAudit)(username, "iap_activate", "ok", posId);
    return { success: true };
});
exports.verifyGooglePlayReceipt = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    try {
        const bid = String(req.query.bid || "");
        const subId = String(req.query.subId || "");
        const purchaseToken = String(req.query.purchaseToken || "");
        await (0, lib_1.consumeRateLimit)("play-verify", crypto.createHash("sha256").update(req.ip || "unknown").digest("hex").slice(0, 32), 40, 15 * 60 * 1000);
        if (!subId || !purchaseToken) {
            res.status(400).json({ error: "missing" });
            return;
        }
        if (bid && bid !== (process.env.GOOGLE_PLAY_PACKAGE_NAME || "com.barbershow.app") && !(0, lib_1.isEmulator)()) {
            res.status(400).json({ error: "package" });
            return;
        }
        const verified = await (0, iapVerify_1.verifyGooglePlayPurchase)(subId, purchaseToken);
        res.status(200).json({
            googleResponse: {
                payload: { expiryTimeMillis: String(new Date(verified.expiresAt).getTime()) },
            },
        });
    }
    catch (_a) {
        res.status(400).json({ error: "invalid" });
    }
});
exports.registerClientAccount = (0, https_1.onCall)(callableOpts, async (request) => {
    var _a, _b, _c, _d, _e, _f, _g;
    (0, lib_1.assertAppCheck)(request);
    await (0, lib_1.consumeRateLimit)("signup-client", (0, lib_1.ipHash)(request), 8, 60 * 60 * 1000);
    const data = request.data;
    const username = (0, lib_1.assertUsername)(String((_a = data === null || data === void 0 ? void 0 : data.username) !== null && _a !== void 0 ? _a : ""));
    const password = String((_b = data === null || data === void 0 ? void 0 : data.password) !== null && _b !== void 0 ? _b : "");
    const name = String((_c = data === null || data === void 0 ? void 0 : data.name) !== null && _c !== void 0 ? _c : "").trim();
    const phone = (0, lib_1.digitsOnly)(String((_d = data === null || data === void 0 ? void 0 : data.phone) !== null && _d !== void 0 ? _d : ""));
    const posId = Number((_e = data === null || data === void 0 ? void 0 : data.posId) !== null && _e !== void 0 ? _e : 0);
    if (!password || password.length < 6)
        throw new https_1.HttpsError("invalid-argument", "Contraseña inválida.");
    if (!name)
        throw new https_1.HttpsError("invalid-argument", "Nombre obligatorio.");
    if (phone.length < lib_1.MIN_PHONE_DIGITS)
        throw new https_1.HttpsError("invalid-argument", "Teléfono inválido.");
    if (!Number.isFinite(posId) || posId <= 0)
        throw new https_1.HttpsError("invalid-argument", "Barbería inválida.");
    const posSnap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/pointsOfSale/${posId}`).get();
    if (!posSnap.exists() || ((_f = posSnap.val()) === null || _f === void 0 ? void 0 : _f.isActive) === false) {
        throw new https_1.HttpsError("not-found", "Barbería no encontrada.");
    }
    if (await (0, lib_1.resolveUsernameKey)(username))
        throw new https_1.HttpsError("already-exists", "Ese nombre de usuario ya existe.");
    const clientId = (0, lib_1.generateUniqueId)();
    await (0, lib_1.db)().ref(`${lib_1.ROOT}/clients/${clientId}`).set({
        id: clientId,
        posId,
        nombre: name,
        telefono: String((_g = data === null || data === void 0 ? void 0 : data.phone) !== null && _g !== void 0 ? _g : "").trim(),
        email: "",
        ultimaVisita: "N/A",
        notas: "Registro de cliente",
        fechaRegistro: new Date().toISOString().split("T")[0],
        puntos: 0,
        status: "active",
        whatsappOptIn: true,
    });
    const newUser = {
        username,
        role: "cliente",
        name,
        posId,
        clientId,
        status: "active",
        loginAttempts: 0,
    };
    await (0, lib_1.db)().ref(`${lib_1.ROOT}/users/${username}`).set(newUser);
    await (0, lib_1.setPasswordHash)(username, (0, lib_1.hashPasswordNode)(password));
    await (0, lib_1.db)().ref(`${lib_1.ROOT}/clientPreferences/${username}`).set({ preferredPosId: posId });
    return (0, lib_1.mintCustomTokenForUser)(username, newUser);
});
exports.upsertStaffUser = (0, https_1.onCall)(callableOpts, async (request) => {
    var _a, _b, _c, _d;
    const { claims } = (0, lib_1.requireAuth)(request);
    const data = request.data;
    const username = (0, lib_1.assertUsername)(String((_a = data === null || data === void 0 ? void 0 : data.username) !== null && _a !== void 0 ? _a : ""));
    const role = String((_b = data === null || data === void 0 ? void 0 : data.role) !== null && _b !== void 0 ? _b : "");
    const name = String((_c = data === null || data === void 0 ? void 0 : data.name) !== null && _c !== void 0 ? _c : "").trim();
    const posId = (data === null || data === void 0 ? void 0 : data.posId) == null ? null : Number(data.posId);
    const password = (data === null || data === void 0 ? void 0 : data.password) != null ? String(data.password) : "";
    if (!lib_1.ALL_ROLES.includes(role))
        throw new https_1.HttpsError("invalid-argument", "Rol no válido.");
    if (!name)
        throw new https_1.HttpsError("invalid-argument", "Nombre obligatorio.");
    if (!(0, lib_1.canCallerAssignRole)(claims.role, role, claims.posId, posId)) {
        throw new https_1.HttpsError("permission-denied", "No puedes asignar ese rol.");
    }
    const existingSnap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/users/${username}`).get();
    const existing = existingSnap.exists() ? existingSnap.val() : null;
    if (existing && (existing.role === "platform_owner" || username === "master")) {
        throw new https_1.HttpsError("permission-denied", "Esa cuenta no se puede modificar así.");
    }
    const toWrite = {
        username,
        role,
        name,
        posId,
        status: (existing === null || existing === void 0 ? void 0 : existing.status) || "active",
        loginAttempts: (_d = existing === null || existing === void 0 ? void 0 : existing.loginAttempts) !== null && _d !== void 0 ? _d : 0,
    };
    if ((data === null || data === void 0 ? void 0 : data.barberId) != null)
        toWrite.barberId = Number(data.barberId);
    else if ((existing === null || existing === void 0 ? void 0 : existing.barberId) != null)
        toWrite.barberId = existing.barberId;
    if ((data === null || data === void 0 ? void 0 : data.clientId) != null)
        toWrite.clientId = Number(data.clientId);
    else if ((existing === null || existing === void 0 ? void 0 : existing.clientId) != null)
        toWrite.clientId = existing.clientId;
    if (data === null || data === void 0 ? void 0 : data.permissions)
        toWrite.permissions = data.permissions;
    if (existing === null || existing === void 0 ? void 0 : existing.lastLogin)
        toWrite.lastLogin = existing.lastLogin;
    if (existing === null || existing === void 0 ? void 0 : existing.photoUrl)
        toWrite.photoUrl = existing.photoUrl;
    if (existing === null || existing === void 0 ? void 0 : existing.authUid)
        toWrite.authUid = existing.authUid;
    if (typeof (existing === null || existing === void 0 ? void 0 : existing.password) === "string" && existing.password) {
        await (0, lib_1.migratePasswordSecret)(username, existing.password);
    }
    await (0, lib_1.db)().ref(`${lib_1.ROOT}/users/${username}`).set(toWrite);
    if (password && password.length >= 6) {
        await (0, lib_1.setPasswordHash)(username, (0, lib_1.hashPasswordNode)(password));
    }
    else if (!existing) {
        throw new https_1.HttpsError("invalid-argument", "La contraseña es obligatoria para usuarios nuevos.");
    }
    if (toWrite.authUid) {
        await (0, lib_1.syncUserClaims)(String(toWrite.authUid), toWrite, username);
    }
    await (0, lib_1.writeAdminAudit)(claims.username, existing ? "update_user" : "create_user", username, posId);
    return { success: true };
});
exports.deleteStaffUser = (0, https_1.onCall)(callableOpts, async (request) => {
    var _a, _b;
    const { claims } = (0, lib_1.requireAuth)(request);
    const username = (0, lib_1.assertUsername)(String((_b = (_a = request.data) === null || _a === void 0 ? void 0 : _a.username) !== null && _b !== void 0 ? _b : ""));
    if (username === claims.username)
        throw new https_1.HttpsError("failed-precondition", "No puedes eliminarte a ti mismo.");
    const snap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/users/${username}`).get();
    if (!snap.exists())
        return { success: true };
    const target = snap.val();
    if (target.role === "platform_owner" || username === "master") {
        throw new https_1.HttpsError("permission-denied", "Esa cuenta no se puede eliminar.");
    }
    const targetPos = target.posId == null ? null : Number(target.posId);
    if (!(0, lib_1.canCallerAssignRole)(claims.role, String(target.role), claims.posId, targetPos) && claims.role !== "superadmin" && claims.role !== "platform_owner") {
        throw new https_1.HttpsError("permission-denied", "No autorizado.");
    }
    await (0, lib_1.db)().ref(`${lib_1.ROOT}/users/${username}`).remove();
    await (0, lib_1.db)().ref(`${lib_1.ROOT}/authSecrets/${username}`).remove();
    if (target.authUid) {
        await admin.auth().deleteUser(String(target.authUid)).catch(() => undefined);
    }
    await (0, lib_1.writeAdminAudit)(claims.username, "delete_user", username, targetPos);
    return { success: true };
});
exports.updateMyProfile = (0, https_1.onCall)(callableOpts, async (request) => {
    const { claims } = (0, lib_1.requireAuth)(request);
    const data = request.data;
    const snap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/users/${claims.username}`).get();
    if (!snap.exists())
        throw new https_1.HttpsError("not-found", "Usuario no encontrado.");
    const updates = {};
    if ((data === null || data === void 0 ? void 0 : data.name) !== undefined) {
        const name = String(data.name).trim();
        if (!name || name.length > 120)
            throw new https_1.HttpsError("invalid-argument", "Nombre inválido.");
        updates.name = name;
    }
    if ((data === null || data === void 0 ? void 0 : data.photoUrl) !== undefined) {
        if (data.photoUrl && String(data.photoUrl).length > 500000)
            throw new https_1.HttpsError("invalid-argument", "Imagen demasiado grande.");
        updates.photoUrl = data.photoUrl || null;
    }
    if (Object.keys(updates).length) {
        await (0, lib_1.db)().ref(`${lib_1.ROOT}/users/${claims.username}`).update(updates);
    }
    return { success: true };
});
exports.adminSetPosPlan = (0, https_1.onCall)(callableOpts, async (request) => {
    var _a, _b;
    const { claims } = (0, lib_1.requirePlatformOwner)(request);
    const data = request.data;
    const posId = Number(data === null || data === void 0 ? void 0 : data.posId);
    const tier = String((_a = data === null || data === void 0 ? void 0 : data.tier) !== null && _a !== void 0 ? _a : "");
    const plan = String((_b = data === null || data === void 0 ? void 0 : data.plan) !== null && _b !== void 0 ? _b : "");
    if (!Number.isFinite(posId))
        throw new https_1.HttpsError("invalid-argument", "Sede inválida.");
    if (!["gratuito", "solo", "barberia", "multisede"].includes(tier))
        throw new https_1.HttpsError("invalid-argument", "Tier inválido.");
    if (!["basic", "pro"].includes(plan))
        throw new https_1.HttpsError("invalid-argument", "Plan inválido.");
    const updates = { tier, plan };
    if ((data === null || data === void 0 ? void 0 : data.subscriptionExpiresAt) !== undefined) {
        updates.subscriptionExpiresAt = data.subscriptionExpiresAt ? String(data.subscriptionExpiresAt) : null;
    }
    await (0, lib_1.db)().ref(`${lib_1.ROOT}/pointsOfSale/${posId}`).update(updates);
    await (0, lib_1.writeAdminAudit)(claims.username, "set_pos_plan", `${tier}/${plan}`, posId);
    return { success: true };
});
exports.adminUpsertPointOfSale = (0, https_1.onCall)(callableOpts, async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const { claims } = (0, lib_1.requirePlatformOwner)(request);
    const data = request.data;
    const name = String((_a = data === null || data === void 0 ? void 0 : data.name) !== null && _a !== void 0 ? _a : "").trim();
    const address = String((_b = data === null || data === void 0 ? void 0 : data.address) !== null && _b !== void 0 ? _b : "").trim();
    if (!name || !address)
        throw new https_1.HttpsError("invalid-argument", "Nombre y dirección obligatorios.");
    const id = (data === null || data === void 0 ? void 0 : data.id) != null ? Number(data.id) : (0, lib_1.generateUniqueId)();
    const existing = await (0, lib_1.db)().ref(`${lib_1.ROOT}/pointsOfSale/${id}`).get();
    const prev = existing.exists() ? existing.val() : {};
    const payload = {
        ...prev,
        id,
        name,
        address,
        ownerId: String((_d = (_c = data === null || data === void 0 ? void 0 : data.ownerId) !== null && _c !== void 0 ? _c : prev.ownerId) !== null && _d !== void 0 ? _d : ""),
        isActive: (data === null || data === void 0 ? void 0 : data.isActive) !== undefined ? Boolean(data.isActive) : prev.isActive !== false,
        tier: (_f = (_e = data === null || data === void 0 ? void 0 : data.tier) !== null && _e !== void 0 ? _e : prev.tier) !== null && _f !== void 0 ? _f : "solo",
        plan: (_h = (_g = data === null || data === void 0 ? void 0 : data.plan) !== null && _g !== void 0 ? _g : prev.plan) !== null && _h !== void 0 ? _h : "basic",
    };
    if (data === null || data === void 0 ? void 0 : data.country)
        payload.country = data.country;
    if (data === null || data === void 0 ? void 0 : data.city)
        payload.city = data.city;
    if (data === null || data === void 0 ? void 0 : data.barrio)
        payload.barrio = data.barrio;
    if (typeof (data === null || data === void 0 ? void 0 : data.lat) === "number")
        payload.lat = data.lat;
    if (typeof (data === null || data === void 0 ? void 0 : data.lng) === "number")
        payload.lng = data.lng;
    await (0, lib_1.db)().ref(`${lib_1.ROOT}/pointsOfSale/${id}`).set(payload);
    if (!existing.exists()) {
        await (0, lib_1.db)().ref(`${lib_1.ROOT}/settings/${id}`).set({ ...lib_1.DEFAULT_SETTINGS, posId: id, storeName: name });
    }
    await (0, lib_1.writeAdminAudit)(claims.username, existing.exists() ? "update_pos" : "create_pos", name, id);
    return { pos: payload };
});
exports.adminDeletePointOfSale = (0, https_1.onCall)(callableOpts, async (request) => {
    var _a;
    const { claims } = (0, lib_1.requirePlatformOwner)(request);
    const posId = Number((_a = request.data) === null || _a === void 0 ? void 0 : _a.posId);
    if (!Number.isFinite(posId))
        throw new https_1.HttpsError("invalid-argument", "Sede inválida.");
    await (0, lib_1.db)().ref(`${lib_1.ROOT}/pointsOfSale/${posId}`).remove();
    await (0, lib_1.db)().ref(`${lib_1.ROOT}/settings/${posId}`).remove();
    await (0, lib_1.writeAdminAudit)(claims.username, "delete_pos", "deleted", posId);
    return { success: true };
});
exports.switchActivePos = (0, https_1.onCall)(callableOpts, async (request) => {
    var _a;
    const { uid, claims } = (0, lib_1.requireAuth)(request);
    const posId = Number((_a = request.data) === null || _a === void 0 ? void 0 : _a.posId);
    if (!Number.isFinite(posId))
        throw new https_1.HttpsError("invalid-argument", "Sede inválida.");
    const posSnap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/pointsOfSale/${posId}`).get();
    if (!posSnap.exists())
        throw new https_1.HttpsError("not-found", "Sede no encontrada.");
    const pos = posSnap.val();
    const allowed = (0, lib_1.isPlatformRole)(claims.role) || claims.posId === posId || pos.ownerId === claims.username || claims.role === "cliente";
    if (!allowed)
        throw new https_1.HttpsError("permission-denied", "No autorizado.");
    const userSnap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/users/${claims.username}`).get();
    const user = (userSnap.exists() ? userSnap.val() : { role: claims.role, username: claims.username });
    if (claims.role === "cliente") {
        await (0, lib_1.db)().ref(`${lib_1.ROOT}/clientPreferences/${claims.username}`).set({ preferredPosId: posId });
        user.posId = posId;
    }
    else if ((0, lib_1.isPlatformRole)(claims.role) || pos.ownerId === claims.username) {
        user.posId = posId;
    }
    await (0, lib_1.syncUserClaims)(uid, user, claims.username);
    return { success: true, posId };
});
exports.deleteMyAccount = (0, https_1.onCall)(callableOpts, async (request) => {
    var _a;
    const { uid, claims } = (0, lib_1.requireAuth)(request);
    await (0, lib_1.consumeRateLimit)("delete-account", claims.username, 5, 60 * 60 * 1000);
    if (claims.role === "platform_owner" || claims.role === "superadmin") {
        throw new https_1.HttpsError("permission-denied", "Esta cuenta no puede eliminarse desde la app.");
    }
    const data = request.data;
    const password = String((_a = data === null || data === void 0 ? void 0 : data.password) !== null && _a !== void 0 ? _a : "");
    if (!password)
        throw new https_1.HttpsError("invalid-argument", "Confirma tu contraseña.");
    const userSnap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/users/${claims.username}`).get();
    if (!userSnap.exists())
        throw new https_1.HttpsError("not-found", "Usuario no encontrado.");
    const user = userSnap.val();
    const stored = await (0, lib_1.readPasswordHash)(claims.username, user);
    if (!stored || !(0, lib_1.verifyPasswordNode)(password, stored)) {
        throw new https_1.HttpsError("unauthenticated", "La contraseña es incorrecta.");
    }
    const reasons = ["no_longer_need_app", "found_another_barbershop", "technical_issues", "hard_to_use", "too_many_notifications", "account_issues", "privacy_security", "other"];
    const reason = reasons.includes(String((data === null || data === void 0 ? void 0 : data.reason) || "")) ? String(data === null || data === void 0 ? void 0 : data.reason) : "other";
    try {
        await (0, lib_1.firestore)().collection("account_deactivation_feedback").add({
            userId: claims.username,
            username: claims.username,
            reason,
            customReason: (data === null || data === void 0 ? void 0 : data.customReason) ? String(data.customReason).slice(0, 2000) : null,
            improvementFeedback: (data === null || data === void 0 ? void 0 : data.improvementFeedback) ? String(data.improvementFeedback).slice(0, 2000) : null,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            platform: ["web", "ios", "android", "unknown"].includes(String(data === null || data === void 0 ? void 0 : data.platform)) ? data === null || data === void 0 ? void 0 : data.platform : "unknown",
            appVersion: String((data === null || data === void 0 ? void 0 : data.appVersion) || "").slice(0, 40),
        });
    }
    catch (_b) {
        // feedback best-effort
    }
    await (0, lib_1.db)().ref(`${lib_1.ROOT}/users/${claims.username}`).remove();
    await (0, lib_1.db)().ref(`${lib_1.ROOT}/authSecrets/${claims.username}`).remove();
    await (0, lib_1.db)().ref(`${lib_1.ROOT}/uidIndex/${uid}`).remove();
    await admin.auth().deleteUser(uid).catch(() => undefined);
    await (0, lib_1.writeAdminAudit)(claims.username, "delete_account", "self");
    return { success: true };
});
exports.listPublicShops = (0, https_1.onCall)(callableOpts, async (request) => {
    (0, lib_1.assertAppCheck)(request);
    await (0, lib_1.consumeRateLimit)("public-shops", (0, lib_1.ipHash)(request), 60, 15 * 60 * 1000);
    const snap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/pointsOfSale`).get();
    if (!snap.exists())
        return { shops: [] };
    const raw = snap.val();
    const shops = Object.values(raw).map((p) => (0, lib_1.sanitizePublicShop)(p)).filter((p) => p != null);
    return { shops };
});
exports.getPublicBookingCatalog = (0, https_1.onCall)(callableOpts, async (request) => {
    var _a;
    (0, lib_1.assertAppCheck)(request);
    await (0, lib_1.consumeRateLimit)("public-catalog", (0, lib_1.ipHash)(request), 60, 15 * 60 * 1000);
    const posId = Number((_a = request.data) === null || _a === void 0 ? void 0 : _a.posId);
    if (!Number.isFinite(posId))
        throw new https_1.HttpsError("invalid-argument", "Sede inválida.");
    const posSnap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/pointsOfSale/${posId}`).get();
    const shop = (0, lib_1.sanitizePublicShop)(posSnap.val());
    if (!shop)
        throw new https_1.HttpsError("not-found", "Barbería no encontrada.");
    const [servicesSnap, barbersSnap, apptsSnap] = await Promise.all([
        (0, lib_1.db)().ref(`${lib_1.ROOT}/services`).orderByChild("posId").equalTo(posId).get(),
        (0, lib_1.db)().ref(`${lib_1.ROOT}/barbers`).orderByChild("posId").equalTo(posId).get(),
        (0, lib_1.db)().ref(`${lib_1.ROOT}/appointments`).orderByChild("posId").equalTo(posId).get(),
    ]);
    const services = Object.values((servicesSnap.val() || {})).map((s) => {
        var _a;
        return ({
            id: Number(s.id),
            posId,
            name: s.name,
            price: s.price,
            duration: s.duration,
            barberId: (_a = s.barberId) !== null && _a !== void 0 ? _a : null,
        });
    });
    const barbers = Object.values((barbersSnap.val() || {}))
        .filter((b) => b.active !== false)
        .map((b) => ({
        id: Number(b.id),
        posId,
        name: b.name,
        specialty: b.specialty,
        active: true,
        workingHours: b.workingHours || null,
        lunchBreak: b.lunchBreak || null,
        blockedHours: b.blockedHours || null,
    }));
    const busySlots = Object.values((apptsSnap.val() || {}))
        .filter((a) => a.estado !== "cancelada")
        .map((a) => ({
        barberoId: a.barberoId,
        fecha: a.fecha,
        hora: a.hora,
        duracionTotal: a.duracionTotal || 30,
        estado: a.estado,
    }));
    const galleries = {};
    for (const b of barbers) {
        const g = await (0, lib_1.db)().ref(`${lib_1.ROOT}/barberGallery/${b.id}`).get();
        if (g.exists()) {
            galleries[String(b.id)] = Object.values(g.val()).map((photo) => {
                const p = photo;
                return { id: p.id, barberId: p.barberId, imageUrl: p.imageUrl, caption: p.caption, createdAt: p.createdAt };
            });
        }
    }
    return { shop, services, barbers, busySlots, galleries };
});
exports.createGuestAppointment = (0, https_1.onCall)(callableOpts, async (request) => {
    var _a, _b, _c;
    (0, lib_1.assertAppCheck)(request);
    await (0, lib_1.consumeRateLimit)("guest-book", (0, lib_1.ipHash)(request), 10, 60 * 60 * 1000);
    const data = request.data;
    const posId = Number(data === null || data === void 0 ? void 0 : data.posId);
    const barberoId = Number(data === null || data === void 0 ? void 0 : data.barberoId);
    const fecha = String((data === null || data === void 0 ? void 0 : data.fecha) || "");
    const hora = String((data === null || data === void 0 ? void 0 : data.hora) || "");
    const nombre = String((data === null || data === void 0 ? void 0 : data.nombre) || "").trim();
    const telefono = String((data === null || data === void 0 ? void 0 : data.telefono) || "").trim();
    if (!Number.isFinite(posId) || !Number.isFinite(barberoId) || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora) || !nombre || (0, lib_1.digitsOnly)(telefono).length < lib_1.MIN_PHONE_DIGITS) {
        throw new https_1.HttpsError("invalid-argument", "Datos de reserva inválidos.");
    }
    const posSnap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/pointsOfSale/${posId}`).get();
    if (!posSnap.exists() || ((_a = posSnap.val()) === null || _a === void 0 ? void 0 : _a.isActive) === false)
        throw new https_1.HttpsError("not-found", "Barbería no encontrada.");
    const barberSnap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/barbers/${barberoId}`).get();
    if (!barberSnap.exists() || Number((_b = barberSnap.val()) === null || _b === void 0 ? void 0 : _b.posId) !== posId || ((_c = barberSnap.val()) === null || _c === void 0 ? void 0 : _c.active) === false) {
        throw new https_1.HttpsError("failed-precondition", "Barbero no disponible.");
    }
    const apptsSnap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/appointments`).orderByChild("posId").equalTo(posId).get();
    const conflict = Object.values((apptsSnap.val() || {})).some((a) => a.barberoId === barberoId && a.fecha === fecha && a.hora === hora && a.estado !== "cancelada");
    if (conflict)
        throw new https_1.HttpsError("already-exists", "Ese horario ya no está disponible.");
    let clientId = null;
    const clientsSnap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/clients`).orderByChild("posId").equalTo(posId).get();
    const want = (0, lib_1.digitsOnly)(telefono);
    if (clientsSnap.exists()) {
        for (const c of Object.values(clientsSnap.val())) {
            if ((0, lib_1.digitsOnly)(String(c.telefono || "")) === want) {
                clientId = Number(c.id);
                break;
            }
        }
    }
    if (clientId == null) {
        clientId = (0, lib_1.generateUniqueId)();
        await (0, lib_1.db)().ref(`${lib_1.ROOT}/clients/${clientId}`).set({
            id: clientId,
            posId,
            nombre,
            telefono,
            email: "",
            ultimaVisita: "N/A",
            notas: "Reserva sin cuenta (invitado)",
            fechaRegistro: new Date().toISOString().split("T")[0],
            puntos: 0,
            status: "active",
        });
    }
    const servicios = Array.isArray(data === null || data === void 0 ? void 0 : data.servicios) ? data.servicios.slice(0, 10) : [];
    const duracionTotal = servicios.reduce((acc, s) => acc + Number(s.duration || 0), 0) || 30;
    const total = servicios.reduce((acc, s) => acc + Number(s.price || 0), 0);
    const id = (0, lib_1.generateUniqueId)();
    await (0, lib_1.db)().ref(`${lib_1.ROOT}/appointments/${id}`).set({
        id,
        posId,
        clienteId: clientId,
        barberoId,
        fecha,
        hora,
        servicios,
        notas: "",
        duracionTotal,
        total,
        estado: "confirmada",
        fechaCreacion: new Date().toISOString(),
    });
    return { success: true, appointmentId: id };
});
exports.stripeWebhook = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    var _a, _b, _c, _d;
    const secret = stripeSecret();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ((_a = (0, v1_1.config)().stripe) === null || _a === void 0 ? void 0 : _a.webhook_secret);
    if (!secret || !webhookSecret) {
        res.status(500).send("Stripe no configurado");
        return;
    }
    const sig = req.headers["stripe-signature"];
    if (!sig || typeof sig !== "string") {
        res.status(400).send("Falta firma");
        return;
    }
    const Stripe = (await Promise.resolve().then(() => __importStar(require("stripe")))).default;
    const stripe = new Stripe(secret, { apiVersion: "2023-10-16" });
    let event;
    try {
        const rawBody = (_b = req.rawBody) !== null && _b !== void 0 ? _b : req.body;
        const payload = Buffer.isBuffer(rawBody) ? rawBody : (typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody));
        event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
    }
    catch (_e) {
        res.status(400).send("Firma inválida");
        return;
    }
    if (event.type !== "checkout.session.completed") {
        res.status(200).send("ok");
        return;
    }
    const metadata = (_d = (_c = event.data) === null || _c === void 0 ? void 0 : _c.object) === null || _d === void 0 ? void 0 : _d.metadata;
    if (!(metadata === null || metadata === void 0 ? void 0 : metadata.username) || !(metadata === null || metadata === void 0 ? void 0 : metadata.posId)) {
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
    await (0, lib_1.db)().ref(`${lib_1.ROOT}/pointsOfSale/${posId}`).update({ isActive: true, subscriptionExpiresAt: expiresAt });
    await (0, lib_1.db)().ref(`${lib_1.ROOT}/users/${username}`).update({ status: "active" });
    const userSnap = await (0, lib_1.db)().ref(`${lib_1.ROOT}/users/${username}`).get();
    if (userSnap.exists()) {
        const user = userSnap.val();
        if (user.authUid)
            await (0, lib_1.syncUserClaims)(String(user.authUid), { ...user, status: "active" }, username);
    }
    res.status(200).send("ok");
});
exports.createPlanCheckout = (0, https_1.onCall)(callableOpts, async (request) => {
    var _a, _b;
    const { claims } = (0, lib_1.requireAuth)(request);
    if (!(0, lib_1.isStaffRole)(claims.role) && !(0, lib_1.isPlatformRole)(claims.role)) {
        throw new https_1.HttpsError("permission-denied", "No autorizado.");
    }
    const data = request.data;
    const plan = String((_a = data === null || data === void 0 ? void 0 : data.plan) !== null && _a !== void 0 ? _a : "");
    const ciclo = (data === null || data === void 0 ? void 0 : data.ciclo) === "anual" ? "anual" : "mensual";
    if (!lib_1.PAID_PLANS.includes(plan))
        throw new https_1.HttpsError("invalid-argument", "Plan no válido.");
    if (claims.posId == null)
        throw new https_1.HttpsError("failed-precondition", "Sin sede.");
    const secret = stripeSecret();
    if (!secret)
        throw new https_1.HttpsError("failed-precondition", "Pago no configurado.");
    const Stripe = (await Promise.resolve().then(() => __importStar(require("stripe")))).default;
    const stripe = new Stripe(secret, { apiVersion: "2023-10-16" });
    const pricePerMonth = (_b = PLAN_PRICES[plan]) !== null && _b !== void 0 ? _b : 14.95;
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
        customer_email: (data === null || data === void 0 ? void 0 : data.email) || undefined,
    });
    if (!session.url)
        throw new https_1.HttpsError("internal", "No se pudo crear el checkout.");
    return { url: session.url };
});
//# sourceMappingURL=index.js.map