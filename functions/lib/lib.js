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
exports.assertUsername = exports.digitsOnly = exports.mintCustomTokenForUser = exports.ensureAuthUser = exports.syncUserClaims = exports.setPasswordHash = exports.migrateAllLegacyPasswordSecrets = exports.migratePasswordSecret = exports.readPasswordHash = exports.inspectPasswordHash = exports.resolvePasswordHashFromSources = exports.resolveUsernameKey = exports.uidForUsername = exports.publicUser = exports.writeAdminAudit = exports.consumeRateLimit = exports.requirePlatformOwner = exports.requirePlatform = exports.requireAuth = exports.claimsFromToken = exports.firestore = exports.db = exports.ipHash = exports.clientIp = exports.sha256Hex = exports.generateUniqueId = exports.verifyPasswordNode = exports.isStoredHash = exports.hashPasswordNode = exports.bufferToHex = exports.sanitizePublicShop = exports.resolveTierFromProductId = exports.canManagePosUsers = exports.isStaffRole = exports.isPlatformRole = exports.assertAppCheck = exports.appCheckEnforced = exports.isEmulator = exports.DEFAULT_SETTINGS = exports.PRODUCT_ID_TO_TIER = exports.APPOINTMENT_STATES = exports.ALL_ROLES = exports.PLATFORM_ROLES = exports.STAFF_ROLES = exports.PAID_PLANS = exports.MIN_PHONE_DIGITS = exports.HASH_BYTES = exports.SALT_BYTES = exports.PBKDF2_ITERATIONS = exports.ROOT = void 0;
exports.canCallerAssignRole = void 0;
const crypto = __importStar(require("crypto"));
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
exports.ROOT = "barbershow";
exports.PBKDF2_ITERATIONS = 100000;
exports.SALT_BYTES = 16;
exports.HASH_BYTES = 32;
exports.MIN_PHONE_DIGITS = 8;
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
    };
}
exports.sanitizePublicShop = sanitizePublicShop;
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