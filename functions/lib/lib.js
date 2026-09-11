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
exports.writeAdminAudit = exports.consumeRateLimit = exports.requirePlatformOwner = exports.requirePlatform = exports.requireAuth = exports.claimsFromToken = exports.firestore = exports.db = exports.ipHash = exports.clientIp = exports.sha256Hex = exports.generateUniqueId = exports.verifyPasswordNode = exports.isStoredHash = exports.hashPasswordNode = exports.bufferToHex = exports.sanitizePublicBarber = exports.sanitizePublicShop = exports.sanitizePublicHighlights = exports.sanitizePublicCertifications = exports.resolveTierFromProductId = exports.canRewritePosClaim = exports.canClientOrderAtPos = exports.appendRecentSales = exports.normalizeRecentSales = exports.RECENT_SALES_LIMIT = exports.toDirectoryUser = exports.canListDirectoryUsers = exports.canActivatePosPlan = exports.parseGlobalFreeMode = exports.canManagePosUsers = exports.isStaffRole = exports.isPlatformRole = exports.assertAppCheck = exports.appCheckEnforced = exports.isEmulator = exports.DEFAULT_SETTINGS = exports.PRODUCT_ID_TO_TIER = exports.APPOINTMENT_STATES = exports.ALL_ROLES = exports.PLATFORM_ROLES = exports.STAFF_ROLES = exports.PAID_PLANS = exports.PUBLIC_SLOT_DAYS = exports.MIN_PASSWORD_LENGTH = exports.MIN_PHONE_DIGITS = exports.HASH_BYTES = exports.SALT_BYTES = exports.PBKDF2_ITERATIONS = exports.ROOT = void 0;
exports.canCallerAssignRole = exports.assertUsername = exports.releaseAppointmentSlot = exports.lockAppointmentSlot = exports.isSlotLockActive = exports.SLOT_LOCK_TTL_MS = exports.claimIapReceipt = exports.iapReuseKeys = exports.findClientIdByPhone = exports.indexClientPhone = exports.writeAppointmentIndexes = exports.bumpPlatformStat = exports.busySlotKey = exports.isoDateOffset = exports.rtdbSafeKey = exports.assertPassword = exports.digitsOnly = exports.mintCustomTokenForUser = exports.ensureAuthUser = exports.syncUserClaims = exports.setPasswordHash = exports.migrateAllLegacyPasswordSecrets = exports.migratePasswordSecret = exports.readPasswordHash = exports.inspectPasswordHash = exports.resolvePasswordHashFromSources = exports.resolveUsernameKey = exports.uidForUsername = exports.publicUser = void 0;
const crypto = __importStar(require("crypto"));
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
exports.ROOT = "barbershow";
exports.PBKDF2_ITERATIONS = 100000;
exports.SALT_BYTES = 16;
exports.HASH_BYTES = 32;
exports.MIN_PHONE_DIGITS = 8;
exports.MIN_PASSWORD_LENGTH = 10;
exports.PUBLIC_SLOT_DAYS = 14;
exports.PAID_PLANS = ["solo", "barberia", "multisede"];
exports.STAFF_ROLES = ["admin", "dueno", "barbero", "empleado"];
exports.PLATFORM_ROLES = ["platform_owner", "superadmin", "support", "financial", "commercial"];
exports.ALL_ROLES = [
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
];
exports.APPOINTMENT_STATES = ["pendiente", "confirmada", "completada", "cancelada"];
exports.PRODUCT_ID_TO_TIER = {
    plan_barberia_monthly: { tier: "barberia", plan: "pro" },
    plan_barberia_yearly: { tier: "barberia", plan: "pro" },
    plan_solo_monthly: { tier: "solo", plan: "basic" },
    plan_solo_yearly: { tier: "solo", plan: "basic" },
    plan_multisede_monthly: { tier: "multisede", plan: "pro" },
    plan_multisede_yearly: { tier: "multisede", plan: "pro" },
};
exports.DEFAULT_SETTINGS = {
    taxRate: 0,
    storeName: "BarberShow",
    currencySymbol: "$",
};
function isEmulator() {
    return process.env.FUNCTIONS_EMULATOR === "true" || process.env.FIREBASE_AUTH_EMULATOR_HOST != null;
}
exports.isEmulator = isEmulator;
function appCheckEnforced() {
    return process.env.ENFORCE_APP_CHECK === "true";
}
exports.appCheckEnforced = appCheckEnforced;
function assertAppCheck(request) {
    if (appCheckEnforced() && !request.app) {
        throw new https_1.HttpsError("failed-precondition", "App Check requerido.");
    }
}
exports.assertAppCheck = assertAppCheck;
function isPlatformRole(role) {
    return role === "platform_owner" || role === "superadmin";
}
exports.isPlatformRole = isPlatformRole;
function isStaffRole(role) {
    return role === "admin" || role === "dueno" || role === "barbero" || role === "empleado";
}
exports.isStaffRole = isStaffRole;
function canManagePosUsers(role) {
    return role === "admin" || role === "dueno" || isPlatformRole(role);
}
exports.canManagePosUsers = canManagePosUsers;
/**
 * Modo promocional en Functions: true/false explícito gana.
 * Si no está definido, el emulador queda en true (como Vite DEV) y producción en false.
 */
function parseGlobalFreeMode(raw, emulator) {
    if (raw === "true")
        return true;
    if (raw === "false")
        return false;
    return emulator;
}
exports.parseGlobalFreeMode = parseGlobalFreeMode;
/** Solo dueño/admin de la sede puede activar un plan IAP (no barbero, empleado ni cliente). */
function canActivatePosPlan(role) {
    return role === "admin" || role === "dueno";
}
exports.canActivatePosPlan = canActivatePosPlan;
function canListDirectoryUsers(role) {
    return isPlatformRole(role) || role === "support" || role === "financial" || role === "commercial";
}
exports.canListDirectoryUsers = canListDirectoryUsers;
/** Lista de plataforma: sin photoUrl ni password. */
function toDirectoryUser(username, raw) {
    const posRaw = raw === null || raw === void 0 ? void 0 : raw.posId;
    const posId = posRaw == null || posRaw === "" ? null : Number(posRaw);
    const out = {
        username: String((raw === null || raw === void 0 ? void 0 : raw.username) || username),
        name: String((raw === null || raw === void 0 ? void 0 : raw.name) || ""),
        role: String((raw === null || raw === void 0 ? void 0 : raw.role) || ""),
        posId: Number.isFinite(posId) && posId > 0 ? posId : null,
    };
    if (typeof (raw === null || raw === void 0 ? void 0 : raw.status) === "string")
        out.status = raw.status;
    if (typeof (raw === null || raw === void 0 ? void 0 : raw.lastLogin) === "string")
        out.lastLogin = raw.lastLogin;
    if (typeof (raw === null || raw === void 0 ? void 0 : raw.ip) === "string")
        out.ip = raw.ip;
    return out;
}
exports.toDirectoryUser = toDirectoryUser;
exports.RECENT_SALES_LIMIT = 20;
function normalizeRecentSales(cur) {
    const list = Array.isArray(cur)
        ? cur
        : cur && typeof cur === "object"
            ? Object.values(cur)
            : [];
    return list.filter((item) => {
        if (!item || typeof item !== "object")
            return false;
        const rec = item;
        return Number.isFinite(Number(rec.id)) && Number(rec.id) > 0 && Number.isFinite(Number(rec.total));
    }).slice(-exports.RECENT_SALES_LIMIT);
}
exports.normalizeRecentSales = normalizeRecentSales;
function appendRecentSales(cur, sale) {
    return [...normalizeRecentSales(cur), sale].slice(-exports.RECENT_SALES_LIMIT);
}
exports.appendRecentSales = appendRecentSales;
/** El cliente solo compra en su sede preferida, la de su ficha o la del token. */
function canClientOrderAtPos(params) {
    const asPosId = (n) => {
        const v = Number(n);
        return Number.isFinite(v) && v > 0 ? v : null;
    };
    const target = asPosId(params.targetPosId);
    if (target == null)
        return false;
    const allowed = [params.preferredPosId, params.clientRecordPosId, params.claimsPosId]
        .map(asPosId)
        .filter((n) => n != null);
    return allowed.includes(target);
}
exports.canClientOrderAtPos = canClientOrderAtPos;
/** El cliente nunca reescribe posId del token. Staff/plataforma sí, si es sede propia u owner. */
function canRewritePosClaim(params) {
    const role = String(params.role || "");
    if (!role || role === "cliente")
        return false;
    if (isPlatformRole(role))
        return true;
    if (params.ownerId && params.username && params.ownerId === params.username)
        return true;
    return Number(params.claimsPosId) === Number(params.targetPosId);
}
exports.canRewritePosClaim = canRewritePosClaim;
function resolveTierFromProductId(productId) {
    const id = String(productId || "").trim();
    if (exports.PRODUCT_ID_TO_TIER[id])
        return exports.PRODUCT_ID_TO_TIER[id];
    if (id.includes("barberia"))
        return { tier: "barberia", plan: "pro" };
    if (id.includes("solo"))
        return { tier: "solo", plan: "basic" };
    if (id.includes("multisede"))
        return { tier: "multisede", plan: "pro" };
    return null;
}
exports.resolveTierFromProductId = resolveTierFromProductId;
function asPublicList(raw) {
    if (Array.isArray(raw))
        return raw;
    if (raw && typeof raw === "object")
        return Object.values(raw);
    return [];
}
function sanitizePublicCertifications(raw) {
    const yearMax = new Date().getFullYear() + 1;
    const out = [];
    for (const item of asPublicList(raw)) {
        if (!item || typeof item !== "object")
            continue;
        const rec = item;
        const title = String(rec.title || "").trim().slice(0, 120);
        if (!title)
            continue;
        const cert = {
            id: String(rec.id || `c${out.length}`).slice(0, 40),
            title,
        };
        const issuer = String(rec.issuer || "").trim().slice(0, 80);
        if (issuer)
            cert.issuer = issuer;
        const year = Number(rec.year);
        if (Number.isFinite(year) && year >= 1980 && year <= yearMax)
            cert.year = Math.round(year);
        out.push(cert);
        if (out.length >= 12)
            break;
    }
    return out;
}
exports.sanitizePublicCertifications = sanitizePublicCertifications;
function sanitizePublicHighlights(raw) {
    const out = [];
    for (const item of asPublicList(raw)) {
        const s = String(item || "").trim().slice(0, 48);
        if (s && !out.some((x) => x.toLowerCase() === s.toLowerCase()))
            out.push(s);
        if (out.length >= 8)
            break;
    }
    return out;
}
exports.sanitizePublicHighlights = sanitizePublicHighlights;
function sanitizePublicShop(pos) {
    var _a, _b, _c;
    if (!pos || pos.isActive === false)
        return null;
    const id = Number(pos.id);
    if (!Number.isFinite(id))
        return null;
    return {
        id,
        name: String(pos.name || ""),
        address: String(pos.address || ""),
        country: (_a = pos.country) !== null && _a !== void 0 ? _a : null,
        city: (_b = pos.city) !== null && _b !== void 0 ? _b : null,
        barrio: (_c = pos.barrio) !== null && _c !== void 0 ? _c : null,
        lat: typeof pos.lat === "number" ? pos.lat : null,
        lng: typeof pos.lng === "number" ? pos.lng : null,
        isActive: pos.isActive !== false,
        about: typeof pos.about === "string" ? pos.about.trim().slice(0, 800) : "",
        highlights: sanitizePublicHighlights(pos.highlights),
        certifications: sanitizePublicCertifications(pos.certifications),
    };
}
exports.sanitizePublicShop = sanitizePublicShop;
function sanitizePublicBarber(b, posId) {
    if (!b || b.active === false)
        return null;
    const id = Number(b.id);
    if (!Number.isFinite(id))
        return null;
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
exports.sanitizePublicBarber = sanitizePublicBarber;
function bufferToHex(buffer) {
    return buffer.toString("hex");
}
exports.bufferToHex = bufferToHex;
function hashPasswordNode(plainPassword) {
    const salt = crypto.randomBytes(exports.SALT_BYTES);
    const hash = crypto.pbkdf2Sync(plainPassword, salt, exports.PBKDF2_ITERATIONS, exports.HASH_BYTES, "sha256");
    return bufferToHex(salt) + ":" + bufferToHex(hash);
}
exports.hashPasswordNode = hashPasswordNode;
function isStoredHash(stored) {
    const parts = stored.split(":");
    if (parts.length !== 2)
        return false;
    return /^[0-9a-f]+$/i.test(parts[0]) && parts[0].length === exports.SALT_BYTES * 2 && /^[0-9a-f]+$/i.test(parts[1]) && parts[1].length === exports.HASH_BYTES * 2;
}
exports.isStoredHash = isStoredHash;
function verifyPasswordNode(plainPassword, stored) {
    if (!plainPassword || stored == null || stored === "")
        return false;
    if (isStoredHash(stored)) {
        const [saltHex, hashHex] = stored.split(":");
        const computed = crypto.pbkdf2Sync(plainPassword, Buffer.from(saltHex, "hex"), exports.PBKDF2_ITERATIONS, exports.HASH_BYTES, "sha256");
        const expected = Buffer.from(hashHex, "hex");
        if (computed.length !== expected.length)
            return false;
        return crypto.timingSafeEqual(computed, expected);
    }
    const a = Buffer.from(plainPassword);
    const b = Buffer.from(String(stored));
    if (a.length !== b.length)
        return false;
    return crypto.timingSafeEqual(a, b);
}
exports.verifyPasswordNode = verifyPasswordNode;
function generateUniqueId() {
    return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}
exports.generateUniqueId = generateUniqueId;
function sha256Hex(value) {
    return crypto.createHash("sha256").update(value).digest("hex");
}
exports.sha256Hex = sha256Hex;
function clientIp(request) {
    const raw = request.rawRequest.headers["x-forwarded-for"];
    const ip = Array.isArray(raw) ? raw[0] : (raw || request.rawRequest.ip || "unknown");
    return String(ip).split(",")[0].trim();
}
exports.clientIp = clientIp;
function ipHash(request) {
    return sha256Hex(clientIp(request)).slice(0, 32);
}
exports.ipHash = ipHash;
function db() {
    return admin.database();
}
exports.db = db;
function firestore() {
    return admin.firestore();
}
exports.firestore = firestore;
function claimsFromToken(request) {
    var _a;
    const token = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.token;
    if (!token || !request.auth)
        return null;
    if (token.firebase && token.firebase.sign_in_provider === "anonymous")
        return null;
    const username = String(token.username || "").trim();
    const role = String(token.role || "").trim();
    if (!username || !role)
        return null;
    return {
        role,
        username,
        posId: typeof token.posId === "number" ? token.posId : token.posId == null ? null : Number(token.posId),
        barberId: typeof token.barberId === "number" ? token.barberId : token.barberId == null ? null : Number(token.barberId),
        clientId: typeof token.clientId === "number" ? token.clientId : token.clientId == null ? null : Number(token.clientId),
    };
}
exports.claimsFromToken = claimsFromToken;
function requireAuth(request) {
    var _a;
    assertAppCheck(request);
    if (!((_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid)) {
        throw new https_1.HttpsError("unauthenticated", "Debes iniciar sesión.");
    }
    const claims = claimsFromToken(request);
    if (!claims) {
        throw new https_1.HttpsError("permission-denied", "La sesión no tiene permisos de negocio.");
    }
    return { uid: request.auth.uid, claims };
}
exports.requireAuth = requireAuth;
function requirePlatform(request) {
    const ctx = requireAuth(request);
    if (!isPlatformRole(ctx.claims.role)) {
        throw new https_1.HttpsError("permission-denied", "No autorizado.");
    }
    return ctx;
}
exports.requirePlatform = requirePlatform;
function requirePlatformOwner(request) {
    const ctx = requireAuth(request);
    if (ctx.claims.role !== "platform_owner" && ctx.claims.role !== "superadmin") {
        throw new https_1.HttpsError("permission-denied", "No autorizado.");
    }
    return ctx;
}
exports.requirePlatformOwner = requirePlatformOwner;
async function consumeRateLimit(bucket, key, max, windowMs) {
    const ref = db().ref(`${exports.ROOT}/rateLimits/${bucket}/${key}`);
    const now = Date.now();
    const result = await ref.transaction((cur) => {
        if (!cur || typeof cur.windowStart !== "number" || now - cur.windowStart > windowMs) {
            return { windowStart: now, count: 1 };
        }
        if ((cur.count || 0) >= max) {
            return;
        }
        return { windowStart: cur.windowStart, count: (cur.count || 0) + 1 };
    });
    if (!result.committed) {
        throw new https_1.HttpsError("resource-exhausted", "Demasiados intentos. Espera unos minutos.");
    }
}
exports.consumeRateLimit = consumeRateLimit;
async function writeAdminAudit(actor, action, details, posId) {
    const id = generateUniqueId();
    const log = {
        id,
        actor,
        action,
        details,
        timestamp: new Date().toISOString(),
    };
    if (posId != null)
        log.posId = posId;
    await db().ref(`${exports.ROOT}/adminAudit/${id}`).set(log);
}
exports.writeAdminAudit = writeAdminAudit;
function publicUser(user, username) {
    var _a, _b, _c, _d;
    return {
        username: user.username || username,
        role: user.role || "cliente",
        name: user.name || username,
        posId: (_a = user.posId) !== null && _a !== void 0 ? _a : null,
        barberId: (_b = user.barberId) !== null && _b !== void 0 ? _b : null,
        clientId: (_c = user.clientId) !== null && _c !== void 0 ? _c : null,
        photoUrl: (_d = user.photoUrl) !== null && _d !== void 0 ? _d : null,
        status: user.status || "active",
        permissions: user.permissions || null,
        active: user.active,
        accountStatus: user.accountStatus || null,
    };
}
exports.publicUser = publicUser;
function uidForUsername(username) {
    return "bs_" + sha256Hex(username.toLowerCase()).slice(0, 28);
}
exports.uidForUsername = uidForUsername;
async function resolveUsernameKey(username) {
    var _a;
    const search = String(username || "").trim();
    if (!search)
        return null;
    const lower = search.toLowerCase();
    const direct = await db().ref(`${exports.ROOT}/users/${lower}`).get();
    if (direct.exists())
        return lower;
    if (search !== lower) {
        const exact = await db().ref(`${exports.ROOT}/users/${search}`).get();
        if (exact.exists())
            return search;
    }
    const all = await db().ref(`${exports.ROOT}/users`).get();
    if (!all.exists())
        return null;
    const keys = Object.keys(all.val());
    return (_a = keys.find((k) => k.toLowerCase() === lower)) !== null && _a !== void 0 ? _a : null;
}
exports.resolveUsernameKey = resolveUsernameKey;
function resolvePasswordHashFromSources(secretHash, userPassword) {
    if (typeof secretHash === "string" && secretHash) {
        return { hash: secretHash, source: "authSecrets" };
    }
    if (typeof userPassword === "string" && userPassword) {
        return { hash: userPassword, source: "users.password" };
    }
    return { hash: null, source: "none" };
}
exports.resolvePasswordHashFromSources = resolvePasswordHashFromSources;
async function inspectPasswordHash(usernameKey, userVal) {
    const secretSnap = await db().ref(`${exports.ROOT}/authSecrets/${usernameKey}/passwordHash`).get();
    return resolvePasswordHashFromSources(secretSnap.exists() ? secretSnap.val() : null, userVal.password);
}
exports.inspectPasswordHash = inspectPasswordHash;
async function readPasswordHash(usernameKey, userVal) {
    return (await inspectPasswordHash(usernameKey, userVal)).hash;
}
exports.readPasswordHash = readPasswordHash;
async function migratePasswordSecret(usernameKey, hash) {
    await db().ref(`${exports.ROOT}/authSecrets/${usernameKey}`).update({
        passwordHash: hash,
        migratedAt: new Date().toISOString(),
    });
    await db().ref(`${exports.ROOT}/users/${usernameKey}/password`).remove();
}
exports.migratePasswordSecret = migratePasswordSecret;
/** Mueve hashes residuales de users.password a authSecrets. No registra el hash. */
async function migrateAllLegacyPasswordSecrets() {
    const snap = await db().ref(`${exports.ROOT}/users`).get();
    if (!snap.exists())
        return 0;
    const users = snap.val();
    let moved = 0;
    for (const [key, user] of Object.entries(users)) {
        if (typeof (user === null || user === void 0 ? void 0 : user.password) === "string" && user.password) {
            await migratePasswordSecret(key, user.password);
            moved += 1;
        }
    }
    return moved;
}
exports.migrateAllLegacyPasswordSecrets = migrateAllLegacyPasswordSecrets;
async function setPasswordHash(usernameKey, hash) {
    await db().ref(`${exports.ROOT}/authSecrets/${usernameKey}`).update({
        passwordHash: hash,
        updatedAt: new Date().toISOString(),
    });
    await db().ref(`${exports.ROOT}/users/${usernameKey}/password`).remove();
}
exports.setPasswordHash = setPasswordHash;
async function syncUserClaims(uid, user, username) {
    const status = String(user.status || "active");
    const role = status === "pending_payment" ? "pending_signup" : String(user.role || "cliente");
    const claims = {
        role,
        username,
        posId: user.posId == null || user.posId === "" ? null : Number(user.posId),
        barberId: user.barberId == null ? null : Number(user.barberId),
        clientId: user.clientId == null ? null : Number(user.clientId),
    };
    const payload = {
        role: claims.role,
        username: claims.username,
    };
    if (claims.posId != null && Number.isFinite(claims.posId))
        payload.posId = claims.posId;
    if (claims.barberId != null && Number.isFinite(claims.barberId))
        payload.barberId = claims.barberId;
    if (claims.clientId != null && Number.isFinite(claims.clientId))
        payload.clientId = claims.clientId;
    await admin.auth().setCustomUserClaims(uid, payload);
    return claims;
}
exports.syncUserClaims = syncUserClaims;
async function ensureAuthUser(username, displayName, existingUid) {
    const uid = existingUid || uidForUsername(username);
    try {
        await admin.auth().createUser({ uid, displayName: displayName || username, disabled: false });
    }
    catch (err) {
        const code = err.code;
        if (code !== "auth/uid-already-exists" && code !== "auth/email-already-exists") {
            const existing = await admin.auth().getUser(uid).catch(() => null);
            if (!existing)
                throw err;
        }
    }
    await db().ref(`${exports.ROOT}/uidIndex/${uid}`).set(username);
    await db().ref(`${exports.ROOT}/users/${username}/authUid`).set(uid);
    return uid;
}
exports.ensureAuthUser = ensureAuthUser;
async function mintCustomTokenForUser(usernameKey, user) {
    const uid = await ensureAuthUser(usernameKey, String(user.name || usernameKey), user.authUid ? String(user.authUid) : null);
    const claims = await syncUserClaims(uid, user, usernameKey);
    const extra = {
        role: claims.role,
        username: claims.username,
    };
    if (claims.posId != null && Number.isFinite(claims.posId))
        extra.posId = claims.posId;
    if (claims.barberId != null && Number.isFinite(claims.barberId))
        extra.barberId = claims.barberId;
    if (claims.clientId != null && Number.isFinite(claims.clientId))
        extra.clientId = claims.clientId;
    const customToken = await admin.auth().createCustomToken(uid, extra);
    return { customToken, user: publicUser(user, usernameKey) };
}
exports.mintCustomTokenForUser = mintCustomTokenForUser;
function digitsOnly(value) {
    return String(value || "").replace(/\D/g, "");
}
exports.digitsOnly = digitsOnly;
function assertPassword(password) {
    if (!password || password.length < exports.MIN_PASSWORD_LENGTH) {
        throw new https_1.HttpsError("invalid-argument", `La contraseña es obligatoria (mín. ${exports.MIN_PASSWORD_LENGTH} caracteres).`);
    }
    return password;
}
exports.assertPassword = assertPassword;
function rtdbSafeKey(value) {
    return String(value || "").replace(/[.#$\[\]]/g, "_").slice(0, 200);
}
exports.rtdbSafeKey = rtdbSafeKey;
function isoDateOffset(days = 0) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}
exports.isoDateOffset = isoDateOffset;
function busySlotKey(barberoId, hora) {
    return `${barberoId}_${rtdbSafeKey(hora)}`;
}
exports.busySlotKey = busySlotKey;
async function bumpPlatformStat(field, delta = 1) {
    if (!field || !Number.isFinite(delta) || delta === 0)
        return;
    await db().ref(`${exports.ROOT}/platformStats/${field}`).transaction((cur) => (typeof cur === "number" ? cur : 0) + delta);
}
exports.bumpPlatformStat = bumpPlatformStat;
async function writeAppointmentIndexes(apt) {
    const slotPath = `${exports.ROOT}/busySlots/${apt.posId}/${apt.fecha}/${busySlotKey(apt.barberoId, apt.hora)}`;
    const byDatePath = `${exports.ROOT}/appointmentsByPosDate/${apt.posId}/${apt.fecha}/${apt.id}`;
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
exports.writeAppointmentIndexes = writeAppointmentIndexes;
async function indexClientPhone(posId, phone, clientId) {
    const digits = digitsOnly(phone);
    if (digits.length < exports.MIN_PHONE_DIGITS)
        return;
    const ref = db().ref(`${exports.ROOT}/clientsByPhone/${posId}/${digits}`);
    if (clientId == null)
        await ref.remove();
    else
        await ref.set(clientId);
}
exports.indexClientPhone = indexClientPhone;
async function findClientIdByPhone(posId, phone) {
    const digits = digitsOnly(phone);
    if (digits.length < exports.MIN_PHONE_DIGITS)
        return null;
    const snap = await db().ref(`${exports.ROOT}/clientsByPhone/${posId}/${digits}`).get();
    if (snap.exists() && Number.isFinite(Number(snap.val())))
        return Number(snap.val());
    return null;
}
exports.findClientIdByPhone = findClientIdByPhone;
function iapReuseKeys(input) {
    const keys = [input.originalTransactionId, input.orderId, input.purchaseTokenHash]
        .map((k) => rtdbSafeKey(String(k || "").trim()))
        .filter(Boolean);
    return [...new Set(keys)];
}
exports.iapReuseKeys = iapReuseKeys;
async function claimIapReceipt(username, keys) {
    if (!keys.length) {
        throw new https_1.HttpsError("failed-precondition", "No se pudo identificar el recibo de la tienda.");
    }
    const at = new Date().toISOString();
    for (const key of keys) {
        const ref = db().ref(`${exports.ROOT}/authSecrets/_iap/${key}`);
        const result = await ref.transaction((cur) => {
            const owner = cur && typeof cur === "object" ? String(cur.username || "") : "";
            if (owner && owner !== username)
                return;
            return { username, at };
        });
        if (!result.committed) {
            throw new https_1.HttpsError("already-exists", "Este recibo ya fue usado.");
        }
    }
}
exports.claimIapReceipt = claimIapReceipt;
/** Mutex corto: si el proceso muere, el lock caduca y no deja el horario muerto. */
exports.SLOT_LOCK_TTL_MS = 60000;
function isSlotLockActive(cur, now = Date.now()) {
    if (cur == null)
        return false;
    if (typeof cur !== "object")
        return true;
    const at = Number(cur.at);
    if (!Number.isFinite(at))
        return true;
    return now - at < exports.SLOT_LOCK_TTL_MS;
}
exports.isSlotLockActive = isSlotLockActive;
async function lockAppointmentSlot(posId, barberoId, fecha, hora) {
    const ref = db().ref(`${exports.ROOT}/slotLocks/${posId}/${barberoId}/${fecha}/${rtdbSafeKey(hora)}`);
    const result = await ref.transaction((cur) => {
        if (isSlotLockActive(cur))
            return;
        return { at: Date.now() };
    });
    if (!result.committed) {
        throw new https_1.HttpsError("already-exists", "Ese horario ya no está disponible.");
    }
}
exports.lockAppointmentSlot = lockAppointmentSlot;
async function releaseAppointmentSlot(posId, barberoId, fecha, hora) {
    await db().ref(`${exports.ROOT}/slotLocks/${posId}/${barberoId}/${fecha}/${rtdbSafeKey(hora)}`).remove();
}
exports.releaseAppointmentSlot = releaseAppointmentSlot;
function assertUsername(username) {
    const value = String(username || "").trim().toLowerCase();
    if (!value || value.length < 3 || value.length > 40 || !/^[a-z0-9._-]+$/.test(value)) {
        throw new https_1.HttpsError("invalid-argument", "Nombre de usuario no válido.");
    }
    if (value === "master") {
        throw new https_1.HttpsError("invalid-argument", "Ese nombre de usuario no está permitido.");
    }
    return value;
}
exports.assertUsername = assertUsername;
function canCallerAssignRole(callerRole, targetRole, callerPosId, targetPosId) {
    if (targetRole === "platform_owner")
        return false;
    if (callerRole === "platform_owner" || callerRole === "superadmin")
        return true;
    if ((callerRole === "admin" || callerRole === "dueno") && callerPosId != null && targetPosId === callerPosId) {
        return targetRole === "admin" || targetRole === "dueno" || targetRole === "barbero" || targetRole === "empleado" || targetRole === "cliente";
    }
    return false;
}
exports.canCallerAssignRole = canCallerAssignRole;
//# sourceMappingURL=lib.js.map