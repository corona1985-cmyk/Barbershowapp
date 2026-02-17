import { onCall, HttpsError } from "firebase-functions/v2/https";
import { config } from "firebase-functions/v1";

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
