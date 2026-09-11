import { HttpsError } from "firebase-functions/v2/https";
import { JWT } from "google-auth-library";
import { isEmulator, resolveTierFromProductId, sha256Hex } from "./lib";

const PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME || "com.barbershow.app";
const BUNDLE_ID = process.env.APPLE_BUNDLE_ID || "com.barbershow.app";

export type VerifiedSubscription = {
  productId: string;
  expiresAt: string;
  originalTransactionId?: string;
  orderId?: string;
  purchaseTokenHash?: string;
  platform: "android" | "ios";
};

function getPlayServiceAccount(): { client_email: string; private_key: string } | null {
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { client_email?: string; private_key?: string };
    if (!parsed.client_email || !parsed.private_key) return null;
    return { client_email: parsed.client_email, private_key: parsed.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

export async function verifyGooglePlayPurchase(productId: string, purchaseToken: string): Promise<VerifiedSubscription> {
  const sa = getPlayServiceAccount();
  if (!sa) {
    if (isEmulator()) {
      return {
        productId,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        platform: "android",
        orderId: `emu-${productId}`,
        purchaseTokenHash: sha256Hex(purchaseToken || productId).slice(0, 40),
      };
    }
    throw new HttpsError("failed-precondition", "La verificación de Google Play no está configurada.");
  }
  const jwt = new JWT({
    email: sa.client_email,
    key: sa.private_key,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  const tokenRes = await jwt.authorize();
  const accessToken = tokenRes.access_token;
  if (!accessToken) {
    throw new HttpsError("internal", "No se pudo autenticar con Google Play.");
  }
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(PACKAGE_NAME)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    throw new HttpsError("failed-precondition", "El recibo de Google Play no es válido.");
  }
  const json = (await res.json()) as { expiryTimeMillis?: string; paymentState?: number; orderId?: string };
  const expiryMs = Number(json.expiryTimeMillis);
  if (!Number.isFinite(expiryMs) || expiryMs <= Date.now()) {
    throw new HttpsError("failed-precondition", "La suscripción de Google Play no está activa.");
  }
  if (json.paymentState !== undefined && json.paymentState === 0) {
    throw new HttpsError("failed-precondition", "El pago de la suscripción no está confirmado.");
  }
  return {
    productId,
    expiresAt: new Date(expiryMs).toISOString(),
    platform: "android",
    orderId: json.orderId ? String(json.orderId) : undefined,
    purchaseTokenHash: sha256Hex(purchaseToken).slice(0, 40),
  };
}

type AppleVerifyResponse = {
  status: number;
  latest_receipt_info?: Array<{ product_id?: string; expires_date_ms?: string; original_transaction_id?: string }>;
  receipt?: { bundle_id?: string; in_app?: Array<{ product_id?: string; expires_date_ms?: string; original_transaction_id?: string }> };
};

async function appleVerifyReceipt(receiptData: string, useSandbox: boolean): Promise<AppleVerifyResponse> {
  const password = process.env.APPLE_SHARED_SECRET;
  if (!password && !isEmulator()) {
    throw new HttpsError("failed-precondition", "La verificación de App Store no está configurada.");
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
    throw new HttpsError("internal", "Apple verifyReceipt no disponible.");
  }
  return (await res.json()) as AppleVerifyResponse;
}

export async function verifyApplePurchase(productId: string, receiptData: string): Promise<VerifiedSubscription> {
  if (isEmulator() && !process.env.APPLE_SHARED_SECRET) {
    return {
      productId,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      platform: "ios",
      originalTransactionId: `emu-ios-${productId}`,
      purchaseTokenHash: sha256Hex(receiptData || productId).slice(0, 40),
    };
  }
  let json = await appleVerifyReceipt(receiptData, false);
  if (json.status === 21007) {
    json = await appleVerifyReceipt(receiptData, true);
  }
  if (json.status !== 0) {
    throw new HttpsError("failed-precondition", "El recibo de App Store no es válido.");
  }
  if (json.receipt?.bundle_id && json.receipt.bundle_id !== BUNDLE_ID) {
    throw new HttpsError("failed-precondition", "El recibo no corresponde a esta aplicación.");
  }
  const items = json.latest_receipt_info || json.receipt?.in_app || [];
  const match = items.find((item) => item.product_id === productId) || items[0];
  if (!match) {
    throw new HttpsError("failed-precondition", "El recibo no contiene una suscripción activa.");
  }
  const expiryMs = Number(match.expires_date_ms);
  if (!Number.isFinite(expiryMs) || expiryMs <= Date.now()) {
    throw new HttpsError("failed-precondition", "La suscripción de App Store no está activa.");
  }
  if (match.product_id && !resolveTierFromProductId(match.product_id)) {
    throw new HttpsError("failed-precondition", "Producto de App Store no reconocido.");
  }
  return {
    productId: match.product_id || productId,
    expiresAt: new Date(expiryMs).toISOString(),
    originalTransactionId: match.original_transaction_id,
    orderId: match.original_transaction_id,
    purchaseTokenHash: sha256Hex(receiptData).slice(0, 40),
    platform: "ios",
  };
}

export async function verifyStorePurchase(input: {
  productId: string;
  purchaseToken?: string;
  receiptData?: string;
  platform?: string;
}): Promise<VerifiedSubscription> {
  const productId = String(input.productId || "").trim();
  if (!productId || !resolveTierFromProductId(productId)) {
    throw new HttpsError("invalid-argument", "Product ID no reconocido.");
  }
  const receipt = (input.receiptData || "").trim();
  const token = (input.purchaseToken || "").trim();
  const platform = String(input.platform || "").toLowerCase();
  if (platform === "ios" || receipt) {
    if (!receipt && !token) {
      throw new HttpsError("invalid-argument", "Falta el recibo de App Store.");
    }
    return verifyApplePurchase(productId, receipt || token);
  }
  if (!token) {
    throw new HttpsError("invalid-argument", "Falta purchaseToken de Google Play.");
  }
  return verifyGooglePlayPurchase(productId, token);
}
