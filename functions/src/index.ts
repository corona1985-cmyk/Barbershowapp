import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { config } from "firebase-functions/v1";
import * as admin from "firebase-admin";
import * as crypto from "crypto";

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.database();
const ROOT = "barbershow";

const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const HASH_BYTES = 32;

function bufferToHex(buffer: Buffer): string {
  return buffer.toString("hex");
}

/** Hash password compatible with client (PBKDF2 SHA-256 salt:hash hex). */
function hashPasswordNode(plainPassword: string): string {
  const salt = crypto.randomBytes(SALT_BYTES);
  const hash = crypto.pbkdf2Sync(
    plainPassword,
    salt,
    PBKDF2_ITERATIONS,
    HASH_BYTES,
    "sha256"
  );
  return bufferToHex(salt) + ":" + bufferToHex(hash);
}

function generateUniqueId(): number {
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
  role: "platform_owner" as const,
  name: "Master Admin",
  posId: null as number | null,
};

/**
 * Valida credenciales Master en el servidor. La contraseña NUNCA se valida en el cliente.
 * Config: firebase functions:config:set master.password="tu_password_seguro"
 * o variable de entorno MASTER_PASSWORD.
 */
export const authenticateMasterWithPassword = onCall(
  { region: "us-central1" },
  async (request): Promise<{ user: typeof MASTER_USER }> => {
    const masterPassword =
      process.env.MASTER_PASSWORD || config().master?.password;
    if (!masterPassword) {
      throw new HttpsError(
        "failed-precondition",
        "Master no está configurado. Ejecuta: firebase functions:config:set master.password=\"tu_password\""
      );
    }
    const data = request.data as { username?: string; password?: string } | undefined;
    const username = String(data?.username ?? "").trim().toLowerCase();
    const password = data?.password ?? "";
    if (username !== "master" || password !== masterPassword) {
      throw new HttpsError(
        "unauthenticated",
        "Usuario o contraseña incorrectos para Master Admin."
      );
    }
    return { user: MASTER_USER };
  }
);

/**
 * Envía un mensaje de WhatsApp vía API REST de Twilio (2ª Gen).
 * Config: firebase functions:config:set twilio.sid="ACxxx" twilio.token="xxx" twilio.whatsapp_from="whatsapp:+14155238886"
 */
export const sendWhatsAppMessage = onCall(
  { region: "us-central1" },
  async (request): Promise<{ success: boolean; sid?: string }> => {
    const sid = process.env.TWILIO_ACCOUNT_SID || config().twilio?.sid;
    const token = process.env.TWILIO_AUTH_TOKEN || config().twilio?.token;
    const from = process.env.TWILIO_WHATSAPP_FROM || config().twilio?.whatsapp_from;

    if (!sid || !token || !from) {
      throw new HttpsError(
        "failed-precondition",
        "WhatsApp no está configurado. Configura Twilio (sid, token, whatsapp_from) en las Cloud Functions."
      );
    }

    const data = request.data as { to?: string; body?: string } | undefined;
    const to = data?.to?.trim();
    const body = data?.body?.trim();
    if (!to || !body) {
      throw new HttpsError(
        "invalid-argument",
        "Faltan 'to' (teléfono) o 'body' (mensaje)."
      );
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
      throw new HttpsError(
        "internal",
        `Twilio error: ${res.status} - ${err}`
      );
    }

    const json = (await res.json()) as { sid?: string };
    return { success: true, sid: json.sid };
  }
);

const MIN_PHONE_DIGITS = 8;
const PAID_PLANS = ["solo", "barberia", "multisede"] as const;
const PLAN_PRICES: Record<string, number> = {
  solo: 14.95,
  barberia: 19.95,
  multisede: 29.95,
};

type CompleteSelfSignupFreeData = {
  username?: string;
  password?: string;
  name?: string;
  phone?: string;
  email?: string;
  barbershopName?: string;
  address?: string;
};

/**
 * Completa el autoregistro con plan gratuito: crea usuario admin + POS en una sola llamada.
 * Entrada: username, password, name, phone (obligatorio), email opcional, barbershopName, address.
 */
export const completeSelfSignupFree = onCall(
  { region: "us-central1" },
  async (request): Promise<{ success: true }> => {
    try {
      const data = request.data as CompleteSelfSignupFreeData | undefined;
      const username = String(data?.username ?? "").trim().toLowerCase();
      const password = data?.password ?? "";
      const name = String(data?.name ?? "").trim();
      const phone = String(data?.phone ?? "").trim().replace(/\D/g, "");
      const email = data?.email != null ? String(data.email).trim() : undefined;
      const barbershopName = String(data?.barbershopName ?? "").trim();
      const address = String(data?.address ?? "").trim();

      if (!username) {
        throw new HttpsError("invalid-argument", "El nombre de usuario es obligatorio.");
      }
      if (!password || password.length < 6) {
        throw new HttpsError("invalid-argument", "La contraseña es obligatoria (mín. 6 caracteres).");
      }
      if (!name) {
        throw new HttpsError("invalid-argument", "El nombre completo es obligatorio.");
      }
      if (phone.length < MIN_PHONE_DIGITS) {
        throw new HttpsError(
          "invalid-argument",
          `El teléfono es obligatorio y debe tener al menos ${MIN_PHONE_DIGITS} dígitos.`
        );
      }
      if (!barbershopName) {
        throw new HttpsError("invalid-argument", "El nombre de la barbería es obligatorio.");
      }
      if (!address) {
        throw new HttpsError("invalid-argument", "La dirección es obligatoria.");
      }

      const usersRef = db.ref(ROOT + "/users");
      const existingUser = await usersRef.child(username).get();
      if (existingUser.exists()) {
        throw new HttpsError("already-exists", "Ese nombre de usuario ya existe. Elige otro.");
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
      const newUser: Record<string, unknown> = {
        username,
        role: "admin",
        name,
        posId,
        password: hashedPassword,
        status: "active",
        loginAttempts: 0,
      };
      if (email) newUser.email = email;
      await usersRef.child(username).set(newUser);

      return { success: true };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new HttpsError("internal", "No se pudo crear la cuenta. Intenta de nuevo. " + msg);
    }
  }
);

type CreatePendingBarberSignupData = {
  username?: string;
  password?: string;
  name?: string;
  phone?: string;
  email?: string;
  barbershopName?: string;
  address?: string;
  plan?: string;
  ciclo?: "mensual" | "anual";
};

/**
 * Crea usuario y POS en estado pendiente y devuelve URL de checkout Stripe.
 * Si el pago no se completa, la cuenta no se activa.
 */
export const createPendingBarberSignup = onCall(
  { region: "us-central1" },
  async (request): Promise<{ url: string }> => {
    const data = request.data as CreatePendingBarberSignupData | undefined;
    const username = String(data?.username ?? "").trim().toLowerCase();
    const password = data?.password ?? "";
    const name = String(data?.name ?? "").trim();
    const phone = String(data?.phone ?? "").trim().replace(/\D/g, "");
    const email = data?.email != null ? String(data.email).trim() : undefined;
    const barbershopName = String(data?.barbershopName ?? "").trim();
    const address = String(data?.address ?? "").trim();
    const plan = data?.plan ?? "";
    const ciclo = data?.ciclo === "anual" ? "anual" : "mensual";

    if (!username) {
      throw new HttpsError("invalid-argument", "El nombre de usuario es obligatorio.");
    }
    if (!password || password.length < 6) {
      throw new HttpsError("invalid-argument", "La contraseña es obligatoria (mín. 6 caracteres).");
    }
    if (!name) {
      throw new HttpsError("invalid-argument", "El nombre completo es obligatorio.");
    }
    if (phone.length < MIN_PHONE_DIGITS) {
      throw new HttpsError(
        "invalid-argument",
        `El teléfono es obligatorio y debe tener al menos ${MIN_PHONE_DIGITS} dígitos.`
      );
    }
    if (!barbershopName) {
      throw new HttpsError("invalid-argument", "El nombre de la barbería es obligatorio.");
    }
    if (!address) {
      throw new HttpsError("invalid-argument", "La dirección es obligatoria.");
    }
    if (!PAID_PLANS.includes(plan as typeof PAID_PLANS[number])) {
      throw new HttpsError("invalid-argument", "Plan de pago no válido (solo, barberia, multisede).");
    }

    const usersRef = db.ref(ROOT + "/users");
    const existingUser = await usersRef.child(username).get();
    if (existingUser.exists()) {
      throw new HttpsError("already-exists", "Ese nombre de usuario ya existe. Elige otro.");
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
    const newUser: Record<string, unknown> = {
      username,
      role: "admin",
      name,
      posId,
      password: hashedPassword,
      status: "pending_payment",
      loginAttempts: 0,
    };
    if (email) newUser.email = email;
    await usersRef.child(username).set(newUser);

    const stripeSecret = process.env.STRIPE_SECRET_KEY || config().stripe?.secret_key;
    if (!stripeSecret) {
      throw new HttpsError(
        "failed-precondition",
        "El pago con tarjeta no está configurado. Configura STRIPE_SECRET_KEY en las Cloud Functions o usa el plan gratuito."
      );
    }

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeSecret, { apiVersion: "2023-10-16" });

    const pricePerMonth = PLAN_PRICES[plan] ?? 14.95;
    const amountCents =
      ciclo === "anual"
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
      throw new HttpsError("internal", "No se pudo crear la sesión de pago.");
    }
    return { url };
  }
);

/**
 * Crea usuario y POS en estado pendiente para pago en app móvil (Apple Pay / Google Wallet).
 * No crea sesión Stripe; la app abrirá el flujo nativo y luego llamará a activatePlanFromPlay.
 */
export const createPendingBarberSignupMobile = onCall(
  { region: "us-central1" },
  async (request): Promise<{ success: true }> => {
    const data = request.data as CreatePendingBarberSignupData | undefined;
    const username = String(data?.username ?? "").trim().toLowerCase();
    const password = data?.password ?? "";
    const name = String(data?.name ?? "").trim();
    const phone = String(data?.phone ?? "").trim().replace(/\D/g, "");
    const email = data?.email != null ? String(data.email).trim() : undefined;
    const barbershopName = String(data?.barbershopName ?? "").trim();
    const address = String(data?.address ?? "").trim();
    const plan = data?.plan ?? "";

    if (!username) {
      throw new HttpsError("invalid-argument", "El nombre de usuario es obligatorio.");
    }
    if (!password || password.length < 6) {
      throw new HttpsError("invalid-argument", "La contraseña es obligatoria (mín. 6 caracteres).");
    }
    if (!name) {
      throw new HttpsError("invalid-argument", "El nombre completo es obligatorio.");
    }
    if (phone.length < MIN_PHONE_DIGITS) {
      throw new HttpsError(
        "invalid-argument",
        `El teléfono es obligatorio y debe tener al menos ${MIN_PHONE_DIGITS} dígitos.`
      );
    }
    if (!barbershopName) {
      throw new HttpsError("invalid-argument", "El nombre de la barbería es obligatorio.");
    }
    if (!address) {
      throw new HttpsError("invalid-argument", "La dirección es obligatoria.");
    }
    if (!PAID_PLANS.includes(plan as typeof PAID_PLANS[number])) {
      throw new HttpsError("invalid-argument", "Plan de pago no válido (solo, barberia, multisede).");
    }

    const usersRef = db.ref(ROOT + "/users");
    const existingUser = await usersRef.child(username).get();
    if (existingUser.exists()) {
      throw new HttpsError("already-exists", "Ese nombre de usuario ya existe. Elige otro.");
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
    const newUser: Record<string, unknown> = {
      username,
      role: "admin",
      name,
      posId,
      password: hashedPassword,
      status: "pending_payment",
      loginAttempts: 0,
    };
    if (email) newUser.email = email;
    await usersRef.child(username).set(newUser);

    return { success: true };
  }
);

type ActivatePlanFromPlayData = {
  purchaseToken?: string;
  productId?: string;
  email?: string;
  nombreNegocio?: string;
  nombreRepresentante?: string;
  username?: string;
};

/**
 * Activa el plan tras una compra en Google Play o App Store.
 * Si se pasa username, activa ese usuario y su POS pendiente (subscriptionExpiresAt según ciclo).
 * En producción debería verificarse el token con Google/Apple API.
 */
export const activatePlanFromPlay = onCall(
  { region: "us-central1" },
  async (request): Promise<{ success: boolean; message?: string }> => {
    const data = request.data as ActivatePlanFromPlayData | undefined;
    const username = data?.username ? String(data.username).trim().toLowerCase() : undefined;
    const productId = data?.productId ?? "";

    if (!username) {
      return { success: false, message: "Falta username del signup pendiente." };
    }

    const userSnap = await db.ref(ROOT + "/users/" + username).get();
    if (!userSnap.exists()) {
      return { success: false, message: "Usuario no encontrado." };
    }

    const userData = userSnap.val() as { posId?: number; status?: string };
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
  }
);

/**
 * Webhook Stripe: al completar el pago activa usuario y POS.
 * Configurar en Stripe Dashboard: Webhooks → Add endpoint → URL de esta función.
 */
export const stripeWebhook = onRequest(
  { region: "us-central1" },
  async (req, res) => {
    const stripeSecret = process.env.STRIPE_SECRET_KEY || config().stripe?.secret_key;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || config().stripe?.webhook_secret;
    if (!stripeSecret || !webhookSecret) {
      res.status(500).send("Stripe no configurado");
      return;
    }

    const sig = req.headers["stripe-signature"];
    if (!sig || typeof sig !== "string") {
      res.status(400).send("Falta firma");
      return;
    }

    const Stripe = (await import("stripe")).default;
    const stripe = new Stripe(stripeSecret, { apiVersion: "2023-10-16" });
    let event: { type: string; data?: { object?: { metadata?: Record<string, string> | null; id?: string } } };
    try {
      // Stripe requires raw body for signature verification. In Firebase 2nd gen, ensure raw body is available (e.g. via middleware or request.rawBody).
      const rawBody = (req as unknown as { rawBody?: Buffer | string }).rawBody ?? req.body;
      const payload = Buffer.isBuffer(rawBody) ? rawBody : (typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody));
      event = stripe.webhooks.constructEvent(payload, sig, webhookSecret) as typeof event;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Webhook signature verification failed";
      res.status(400).send(message);
      return;
    }

    if (event.type !== "checkout.session.completed") {
      res.status(200).send("ok");
      return;
    }

    const session = event.data?.object;
    const metadata = session?.metadata;
    if (!metadata?.username || !metadata?.posId) {
      res.status(200).send("ok");
      return;
    }

    const username = metadata.username;
    const posId = Number(metadata.posId);
    const ciclo = metadata.ciclo || "mensual";

    const now = new Date();
    const expiresAt =
      ciclo === "anual"
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
  }
);
