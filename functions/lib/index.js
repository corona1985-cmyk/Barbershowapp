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
exports.stripeWebhook = exports.activatePlanFromPlay = exports.createPendingBarberSignupMobile = exports.createPendingBarberSignup = exports.completeSelfSignupFree = exports.sendWhatsAppMessage = exports.authenticateMasterWithPassword = void 0;
const https_1 = require("firebase-functions/v2/https");
const v1_1 = require("firebase-functions/v1");
const admin = __importStar(require("firebase-admin"));
const crypto = __importStar(require("crypto"));
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.database();
const ROOT = "barbershow";
const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;
function bufferToHex(buffer) {
    return buffer.toString("hex");
}
/** Hash password compatible with client (PBKDF2 SHA-256 salt:hash hex). */
function hashPasswordNode(plainPassword) {
    const salt = crypto.randomBytes(SALT_BYTES);
    const hash = crypto.pbkdf2Sync(plainPassword, salt, PBKDF2_ITERATIONS, HASH_BYTES, "sha256");
    return bufferToHex(salt) + ":" + bufferToHex(hash);
}
function generateUniqueId() {
    return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}
const DEFAULT_SETTINGS = {
    taxRate: 0.16,
    storeName: "BarberShow",
    currencySymbol: "$",
};
/** Payload de usuario Master devuelto al frontend (sin contraseña). */
const MASTER_USER = {
    username: "master",
    role: "platform_owner",
    name: "Master Admin",
    posId: null,
};
/**
 * Valida credenciales Master en el servidor. La contraseña NUNCA se valida en el cliente.
 * Config: firebase functions:config:set master.password="tu_password_seguro"
 * o variable de entorno MASTER_PASSWORD.
 */
exports.authenticateMasterWithPassword = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
    var _a, _b, _c;
    const masterPassword = process.env.MASTER_PASSWORD || ((_a = (0, v1_1.config)().master) === null || _a === void 0 ? void 0 : _a.password);
    if (!masterPassword) {
        throw new https_1.HttpsError("failed-precondition", "Master no está configurado. Ejecuta: firebase functions:config:set master.password=\"tu_password\"");
    }
    const data = request.data;
    const username = String((_b = data === null || data === void 0 ? void 0 : data.username) !== null && _b !== void 0 ? _b : "").trim().toLowerCase();
    const password = (_c = data === null || data === void 0 ? void 0 : data.password) !== null && _c !== void 0 ? _c : "";
    if (username !== "master" || password !== masterPassword) {
        throw new https_1.HttpsError("unauthenticated", "Usuario o contraseña incorrectos para Master Admin.");
    }
    return { user: MASTER_USER };
});
/**
 * Envía un mensaje de WhatsApp vía API REST de Twilio (2ª Gen).
 * Config: firebase functions:config:set twilio.sid="ACxxx" twilio.token="xxx" twilio.whatsapp_from="whatsapp:+14155238886"
 */
exports.sendWhatsAppMessage = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
    var _a, _b, _c, _d, _e;
    const sid = process.env.TWILIO_ACCOUNT_SID || ((_a = (0, v1_1.config)().twilio) === null || _a === void 0 ? void 0 : _a.sid);
    const token = process.env.TWILIO_AUTH_TOKEN || ((_b = (0, v1_1.config)().twilio) === null || _b === void 0 ? void 0 : _b.token);
    const from = process.env.TWILIO_WHATSAPP_FROM || ((_c = (0, v1_1.config)().twilio) === null || _c === void 0 ? void 0 : _c.whatsapp_from);
    if (!sid || !token || !from) {
        throw new https_1.HttpsError("failed-precondition", "WhatsApp no está configurado. Configura Twilio (sid, token, whatsapp_from) en las Cloud Functions.");
    }
    const data = request.data;
    const to = (_d = data === null || data === void 0 ? void 0 : data.to) === null || _d === void 0 ? void 0 : _d.trim();
    const body = (_e = data === null || data === void 0 ? void 0 : data.body) === null || _e === void 0 ? void 0 : _e.trim();
    if (!to || !body) {
        throw new https_1.HttpsError("invalid-argument", "Faltan 'to' (teléfono) o 'body' (mensaje).");
    }
    let phone = to.replace(/\D/g, "");
    if (phone.length === 10 && !to.startsWith("+")) {
        phone = "52" + phone;
    }
    if (!phone.startsWith("+")) {
        phone = "+" + phone;
    }
    const toWhatsApp = `whatsapp:${phone}`;
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const params = new URLSearchParams({
        To: toWhatsApp,
        From: from,
        Body: body,
    });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
            "Authorization": `Basic ${auth}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new https_1.HttpsError("internal", `Twilio error: ${res.status} - ${err}`);
    }
    const json = (await res.json());
    return { success: true, sid: json.sid };
});
const MIN_PHONE_DIGITS = 8;
const PAID_PLANS = ["solo", "barberia", "multisede"];
const PLAN_PRICES = {
    solo: 14.95,
    barberia: 19.95,
    multisede: 29.95,
};
/**
 * Completa el autoregistro con plan gratuito: crea usuario admin + POS en una sola llamada.
 * Entrada: username, password, name, phone (obligatorio), email opcional, barbershopName, address.
 */
exports.completeSelfSignupFree = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
    var _a, _b, _c, _d, _e, _f;
    const data = request.data;
    const username = String((_a = data === null || data === void 0 ? void 0 : data.username) !== null && _a !== void 0 ? _a : "").trim().toLowerCase();
    const password = (_b = data === null || data === void 0 ? void 0 : data.password) !== null && _b !== void 0 ? _b : "";
    const name = String((_c = data === null || data === void 0 ? void 0 : data.name) !== null && _c !== void 0 ? _c : "").trim();
    const phone = String((_d = data === null || data === void 0 ? void 0 : data.phone) !== null && _d !== void 0 ? _d : "").trim().replace(/\D/g, "");
    const email = (data === null || data === void 0 ? void 0 : data.email) != null ? String(data.email).trim() : undefined;
    const barbershopName = String((_e = data === null || data === void 0 ? void 0 : data.barbershopName) !== null && _e !== void 0 ? _e : "").trim();
    const address = String((_f = data === null || data === void 0 ? void 0 : data.address) !== null && _f !== void 0 ? _f : "").trim();
    if (!username) {
        throw new https_1.HttpsError("invalid-argument", "El nombre de usuario es obligatorio.");
    }
    if (!password || password.length < 6) {
        throw new https_1.HttpsError("invalid-argument", "La contraseña es obligatoria (mín. 6 caracteres).");
    }
    if (!name) {
        throw new https_1.HttpsError("invalid-argument", "El nombre completo es obligatorio.");
    }
    if (phone.length < MIN_PHONE_DIGITS) {
        throw new https_1.HttpsError("invalid-argument", `El teléfono es obligatorio y debe tener al menos ${MIN_PHONE_DIGITS} dígitos.`);
    }
    if (!barbershopName) {
        throw new https_1.HttpsError("invalid-argument", "El nombre de la barbería es obligatorio.");
    }
    if (!address) {
        throw new https_1.HttpsError("invalid-argument", "La dirección es obligatoria.");
    }
    const usersRef = db.ref(ROOT + "/users");
    const existingUser = await usersRef.child(username).get();
    if (existingUser.exists()) {
        throw new https_1.HttpsError("already-exists", "Ese nombre de usuario ya existe. Elige otro.");
    }
    const posId = generateUniqueId();
    const pointsOfSaleRef = db.ref(ROOT + "/pointsOfSale/" + posId);
    const newPos = {
        id: posId,
        name: barbershopName,
        address,
        ownerId: username,
        isActive: true,
        tier: "gratuito",
    };
    await pointsOfSaleRef.set(newPos);
    const settingsRef = db.ref(ROOT + "/settings/" + posId);
    await settingsRef.set({ ...DEFAULT_SETTINGS, posId, storeName: barbershopName });
    const hashedPassword = hashPasswordNode(password);
    const newUser = {
        username,
        role: "admin",
        name,
        posId,
        password: hashedPassword,
        status: "active",
        loginAttempts: 0,
    };
    if (email)
        newUser.email = email;
    await usersRef.child(username).set(newUser);
    return { success: true };
});
/**
 * Crea usuario y POS en estado pendiente y devuelve URL de checkout Stripe.
 * Si el pago no se completa, la cuenta no se activa.
 */
exports.createPendingBarberSignup = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const data = request.data;
    const username = String((_a = data === null || data === void 0 ? void 0 : data.username) !== null && _a !== void 0 ? _a : "").trim().toLowerCase();
    const password = (_b = data === null || data === void 0 ? void 0 : data.password) !== null && _b !== void 0 ? _b : "";
    const name = String((_c = data === null || data === void 0 ? void 0 : data.name) !== null && _c !== void 0 ? _c : "").trim();
    const phone = String((_d = data === null || data === void 0 ? void 0 : data.phone) !== null && _d !== void 0 ? _d : "").trim().replace(/\D/g, "");
    const email = (data === null || data === void 0 ? void 0 : data.email) != null ? String(data.email).trim() : undefined;
    const barbershopName = String((_e = data === null || data === void 0 ? void 0 : data.barbershopName) !== null && _e !== void 0 ? _e : "").trim();
    const address = String((_f = data === null || data === void 0 ? void 0 : data.address) !== null && _f !== void 0 ? _f : "").trim();
    const plan = (_g = data === null || data === void 0 ? void 0 : data.plan) !== null && _g !== void 0 ? _g : "";
    const ciclo = (data === null || data === void 0 ? void 0 : data.ciclo) === "anual" ? "anual" : "mensual";
    if (!username) {
        throw new https_1.HttpsError("invalid-argument", "El nombre de usuario es obligatorio.");
    }
    if (!password || password.length < 6) {
        throw new https_1.HttpsError("invalid-argument", "La contraseña es obligatoria (mín. 6 caracteres).");
    }
    if (!name) {
        throw new https_1.HttpsError("invalid-argument", "El nombre completo es obligatorio.");
    }
    if (phone.length < MIN_PHONE_DIGITS) {
        throw new https_1.HttpsError("invalid-argument", `El teléfono es obligatorio y debe tener al menos ${MIN_PHONE_DIGITS} dígitos.`);
    }
    if (!barbershopName) {
        throw new https_1.HttpsError("invalid-argument", "El nombre de la barbería es obligatorio.");
    }
    if (!address) {
        throw new https_1.HttpsError("invalid-argument", "La dirección es obligatoria.");
    }
    if (!PAID_PLANS.includes(plan)) {
        throw new https_1.HttpsError("invalid-argument", "Plan de pago no válido (solo, barberia, multisede).");
    }
    const usersRef = db.ref(ROOT + "/users");
    const existingUser = await usersRef.child(username).get();
    if (existingUser.exists()) {
        throw new https_1.HttpsError("already-exists", "Ese nombre de usuario ya existe. Elige otro.");
    }
    const posId = generateUniqueId();
    const pointsOfSaleRef = db.ref(ROOT + "/pointsOfSale/" + posId);
    const newPos = {
        id: posId,
        name: barbershopName,
        address,
        ownerId: username,
        isActive: false,
        tier: plan,
    };
    await pointsOfSaleRef.set(newPos);
    const hashedPassword = hashPasswordNode(password);
    const newUser = {
        username,
        role: "admin",
        name,
        posId,
        password: hashedPassword,
        status: "pending_payment",
        loginAttempts: 0,
    };
    if (email)
        newUser.email = email;
    await usersRef.child(username).set(newUser);
    const stripeSecret = process.env.STRIPE_SECRET_KEY || ((_h = (0, v1_1.config)().stripe) === null || _h === void 0 ? void 0 : _h.secret_key);
    if (!stripeSecret) {
        throw new https_1.HttpsError("failed-precondition", "El pago con tarjeta no está configurado. Configura STRIPE_SECRET_KEY en las Cloud Functions o usa el plan gratuito.");
    }
    const Stripe = (await Promise.resolve().then(() => __importStar(require("stripe")))).default;
    const stripe = new Stripe(stripeSecret, { apiVersion: "2023-10-16" });
    const pricePerMonth = (_j = PLAN_PRICES[plan]) !== null && _j !== void 0 ? _j : 14.95;
    const amountCents = ciclo === "anual"
        ? Math.round(pricePerMonth * 0.6 * 12 * 100)
        : Math.round(pricePerMonth * 100);
    const origin = request.rawRequest.headers.origin || request.rawRequest.headers.referer || "https://localhost";
    const baseUrl = typeof origin === "string" ? origin.replace(/\/$/, "") : "https://localhost";
    const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
            {
                price_data: {
                    currency: "usd",
                    product_data: {
                        name: `BarberShow - ${plan} (${ciclo})`,
                        description: `Plan ${plan}, ${ciclo === "anual" ? "anual -40%" : "mensual"}. Barbería: ${barbershopName}.`,
                    },
                    unit_amount: amountCents,
                },
                quantity: 1,
            },
        ],
        success_url: `${baseUrl}?signup=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}?signup=cancelled`,
        metadata: {
            username,
            posId: String(posId),
            plan,
            ciclo,
        },
        customer_email: email || undefined,
    });
    const url = session.url;
    if (!url) {
        throw new https_1.HttpsError("internal", "No se pudo crear la sesión de pago.");
    }
    return { url };
});
/**
 * Crea usuario y POS en estado pendiente para pago en app móvil (Apple Pay / Google Wallet).
 * No crea sesión Stripe; la app abrirá el flujo nativo y luego llamará a activatePlanFromPlay.
 */
exports.createPendingBarberSignupMobile = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
    var _a, _b, _c, _d, _e, _f, _g;
    const data = request.data;
    const username = String((_a = data === null || data === void 0 ? void 0 : data.username) !== null && _a !== void 0 ? _a : "").trim().toLowerCase();
    const password = (_b = data === null || data === void 0 ? void 0 : data.password) !== null && _b !== void 0 ? _b : "";
    const name = String((_c = data === null || data === void 0 ? void 0 : data.name) !== null && _c !== void 0 ? _c : "").trim();
    const phone = String((_d = data === null || data === void 0 ? void 0 : data.phone) !== null && _d !== void 0 ? _d : "").trim().replace(/\D/g, "");
    const email = (data === null || data === void 0 ? void 0 : data.email) != null ? String(data.email).trim() : undefined;
    const barbershopName = String((_e = data === null || data === void 0 ? void 0 : data.barbershopName) !== null && _e !== void 0 ? _e : "").trim();
    const address = String((_f = data === null || data === void 0 ? void 0 : data.address) !== null && _f !== void 0 ? _f : "").trim();
    const plan = (_g = data === null || data === void 0 ? void 0 : data.plan) !== null && _g !== void 0 ? _g : "";
    if (!username) {
        throw new https_1.HttpsError("invalid-argument", "El nombre de usuario es obligatorio.");
    }
    if (!password || password.length < 6) {
        throw new https_1.HttpsError("invalid-argument", "La contraseña es obligatoria (mín. 6 caracteres).");
    }
    if (!name) {
        throw new https_1.HttpsError("invalid-argument", "El nombre completo es obligatorio.");
    }
    if (phone.length < MIN_PHONE_DIGITS) {
        throw new https_1.HttpsError("invalid-argument", `El teléfono es obligatorio y debe tener al menos ${MIN_PHONE_DIGITS} dígitos.`);
    }
    if (!barbershopName) {
        throw new https_1.HttpsError("invalid-argument", "El nombre de la barbería es obligatorio.");
    }
    if (!address) {
        throw new https_1.HttpsError("invalid-argument", "La dirección es obligatoria.");
    }
    if (!PAID_PLANS.includes(plan)) {
        throw new https_1.HttpsError("invalid-argument", "Plan de pago no válido (solo, barberia, multisede).");
    }
    const usersRef = db.ref(ROOT + "/users");
    const existingUser = await usersRef.child(username).get();
    if (existingUser.exists()) {
        throw new https_1.HttpsError("already-exists", "Ese nombre de usuario ya existe. Elige otro.");
    }
    const posId = generateUniqueId();
    const pointsOfSaleRef = db.ref(ROOT + "/pointsOfSale/" + posId);
    const newPos = {
        id: posId,
        name: barbershopName,
        address,
        ownerId: username,
        isActive: false,
        tier: plan,
    };
    await pointsOfSaleRef.set(newPos);
    const hashedPassword = hashPasswordNode(password);
    const newUser = {
        username,
        role: "admin",
        name,
        posId,
        password: hashedPassword,
        status: "pending_payment",
        loginAttempts: 0,
    };
    if (email)
        newUser.email = email;
    await usersRef.child(username).set(newUser);
    return { success: true };
});
/**
 * Activa el plan tras una compra en Google Play o App Store.
 * Si se pasa username, activa ese usuario y su POS pendiente (subscriptionExpiresAt según ciclo).
 * En producción debería verificarse el token con Google/Apple API.
 */
exports.activatePlanFromPlay = (0, https_1.onCall)({ region: "us-central1" }, async (request) => {
    var _a;
    const data = request.data;
    const username = (data === null || data === void 0 ? void 0 : data.username) ? String(data.username).trim().toLowerCase() : undefined;
    const productId = (_a = data === null || data === void 0 ? void 0 : data.productId) !== null && _a !== void 0 ? _a : "";
    if (!username) {
        return { success: false, message: "Falta username del signup pendiente." };
    }
    const userSnap = await db.ref(ROOT + "/users/" + username).get();
    if (!userSnap.exists()) {
        return { success: false, message: "Usuario no encontrado." };
    }
    const userData = userSnap.val();
    const posId = userData.posId;
    if (posId == null) {
        return { success: false, message: "Usuario sin barbería asignada." };
    }
    const isYearly = productId.includes("yearly") || productId.includes("anual");
    const now = new Date();
    const expiresAt = isYearly
        ? new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString()
        : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()).toISOString();
    await db.ref(ROOT + "/pointsOfSale/" + posId).update({
        isActive: true,
        subscriptionExpiresAt: expiresAt,
    });
    await db.ref(ROOT + "/users/" + username).update({
        status: "active",
    });
    return { success: true };
});
/**
 * Webhook Stripe: al completar el pago activa usuario y POS.
 * Configurar en Stripe Dashboard: Webhooks → Add endpoint → URL de esta función.
 */
exports.stripeWebhook = (0, https_1.onRequest)({ region: "us-central1" }, async (req, res) => {
    var _a, _b, _c, _d;
    const stripeSecret = process.env.STRIPE_SECRET_KEY || ((_a = (0, v1_1.config)().stripe) === null || _a === void 0 ? void 0 : _a.secret_key);
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ((_b = (0, v1_1.config)().stripe) === null || _b === void 0 ? void 0 : _b.webhook_secret);
    if (!stripeSecret || !webhookSecret) {
        res.status(500).send("Stripe no configurado");
        return;
    }
    const sig = req.headers["stripe-signature"];
    if (!sig || typeof sig !== "string") {
        res.status(400).send("Falta firma");
        return;
    }
    const Stripe = (await Promise.resolve().then(() => __importStar(require("stripe")))).default;
    const stripe = new Stripe(stripeSecret, { apiVersion: "2023-10-16" });
    let event;
    try {
        // Stripe requires raw body for signature verification. In Firebase 2nd gen, ensure raw body is available (e.g. via middleware or request.rawBody).
        const rawBody = (_c = req.rawBody) !== null && _c !== void 0 ? _c : req.body;
        const payload = Buffer.isBuffer(rawBody) ? rawBody : (typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody));
        event = stripe.webhooks.constructEvent(payload, sig, webhookSecret);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Webhook signature verification failed";
        res.status(400).send(message);
        return;
    }
    if (event.type !== "checkout.session.completed") {
        res.status(200).send("ok");
        return;
    }
    const session = (_d = event.data) === null || _d === void 0 ? void 0 : _d.object;
    const metadata = session === null || session === void 0 ? void 0 : session.metadata;
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
    await db.ref(ROOT + "/pointsOfSale/" + posId).update({
        isActive: true,
        subscriptionExpiresAt: expiresAt,
    });
    await db.ref(ROOT + "/users/" + username).update({
        status: "active",
    });
    res.status(200).send("ok");
});
//# sourceMappingURL=index.js.map