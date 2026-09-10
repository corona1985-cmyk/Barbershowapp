"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyStorePurchase = exports.verifyApplePurchase = exports.verifyGooglePlayPurchase = void 0;
const https_1 = require("firebase-functions/v2/https");
const google_auth_library_1 = require("google-auth-library");
const lib_1 = require("./lib");
const PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME || "com.barbershow.app";
const BUNDLE_ID = process.env.APPLE_BUNDLE_ID || "com.barbershow.app";
function getPlayServiceAccount() {
    const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    if (!raw)
        return null;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed.client_email || !parsed.private_key)
            return null;
        return { client_email: parsed.client_email, private_key: parsed.private_key.replace(/\\n/g, "\n") };
    }
    catch (_a) {
        return null;
    }
}
async function verifyGooglePlayPurchase(productId, purchaseToken) {
    const sa = getPlayServiceAccount();
    if (!sa) {
        if ((0, lib_1.isEmulator)()) {
            return {
                productId,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                platform: "android",
            };
        }
        throw new https_1.HttpsError("failed-precondition", "La verificación de Google Play no está configurada.");
    }
    const jwt = new google_auth_library_1.JWT({
        email: sa.client_email,
        key: sa.private_key,
        scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });
    const tokenRes = await jwt.authorize();
    const accessToken = tokenRes.access_token;
    if (!accessToken) {
        throw new https_1.HttpsError("internal", "No se pudo autenticar con Google Play.");
    }
    const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(PACKAGE_NAME)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
        throw new https_1.HttpsError("failed-precondition", "El recibo de Google Play no es válido.");
    }
    const json = (await res.json());
    const expiryMs = Number(json.expiryTimeMillis);
    if (!Number.isFinite(expiryMs) || expiryMs <= Date.now()) {
        throw new https_1.HttpsError("failed-precondition", "La suscripción de Google Play no está activa.");
    }
    if (json.paymentState !== undefined && json.paymentState === 0) {
        throw new https_1.HttpsError("failed-precondition", "El pago de la suscripción no está confirmado.");
    }
    return {
        productId,
        expiresAt: new Date(expiryMs).toISOString(),
        platform: "android",
    };
}
exports.verifyGooglePlayPurchase = verifyGooglePlayPurchase;
async function appleVerifyReceipt(receiptData, useSandbox) {
    const password = process.env.APPLE_SHARED_SECRET;
    if (!password && !(0, lib_1.isEmulator)()) {
        throw new https_1.HttpsError("failed-precondition", "La verificación de App Store no está configurada.");
    }
    const url = useSandbox ? "https://sandbox.itunes.apple.com/verifyReceipt" : "https://buy.itunes.apple.com/verifyReceipt";
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            "receipt-data": receiptData,
            password: password || "emulator",
            "exclude-old-transactions": true,
        }),
    });
    if (!res.ok) {
        throw new https_1.HttpsError("internal", "Apple verifyReceipt no disponible.");
    }
    return (await res.json());
}
async function verifyApplePurchase(productId, receiptData) {
    var _a, _b;
    if ((0, lib_1.isEmulator)() && !process.env.APPLE_SHARED_SECRET) {
        return {
            productId,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            platform: "ios",
        };
    }
    let json = await appleVerifyReceipt(receiptData, false);
    if (json.status === 21007) {
        json = await appleVerifyReceipt(receiptData, true);
    }
    if (json.status !== 0) {
        throw new https_1.HttpsError("failed-precondition", "El recibo de App Store no es válido.");
    }
    if (((_a = json.receipt) === null || _a === void 0 ? void 0 : _a.bundle_id) && json.receipt.bundle_id !== BUNDLE_ID) {
        throw new https_1.HttpsError("failed-precondition", "El recibo no corresponde a esta aplicación.");
    }
    const items = json.latest_receipt_info || ((_b = json.receipt) === null || _b === void 0 ? void 0 : _b.in_app) || [];
    const match = items.find((item) => item.product_id === productId) || items[0];
    if (!match) {
        throw new https_1.HttpsError("failed-precondition", "El recibo no contiene una suscripción activa.");
    }
    const expiryMs = Number(match.expires_date_ms);
    if (!Number.isFinite(expiryMs) || expiryMs <= Date.now()) {
        throw new https_1.HttpsError("failed-precondition", "La suscripción de App Store no está activa.");
    }
    if (match.product_id && !(0, lib_1.resolveTierFromProductId)(match.product_id)) {
        throw new https_1.HttpsError("failed-precondition", "Producto de App Store no reconocido.");
    }
    return {
        productId: match.product_id || productId,
        expiresAt: new Date(expiryMs).toISOString(),
        originalTransactionId: match.original_transaction_id,
        platform: "ios",
    };
}
exports.verifyApplePurchase = verifyApplePurchase;
async function verifyStorePurchase(input) {
    const productId = String(input.productId || "").trim();
    if (!productId || !(0, lib_1.resolveTierFromProductId)(productId)) {
        throw new https_1.HttpsError("invalid-argument", "Product ID no reconocido.");
    }
    const receipt = (input.receiptData || "").trim();
    const token = (input.purchaseToken || "").trim();
    const platform = String(input.platform || "").toLowerCase();
    if (platform === "ios" || receipt) {
        if (!receipt && !token) {
            throw new https_1.HttpsError("invalid-argument", "Falta el recibo de App Store.");
        }
        return verifyApplePurchase(productId, receipt || token);
    }
    if (!token) {
        throw new https_1.HttpsError("invalid-argument", "Falta purchaseToken de Google Play.");
    }
    return verifyGooglePlayPurchase(productId, token);
}
exports.verifyStorePurchase = verifyStorePurchase;
//# sourceMappingURL=iapVerify.js.map