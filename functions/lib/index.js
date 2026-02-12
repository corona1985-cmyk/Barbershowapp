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
exports.sendWhatsAppMessage = exports.authenticateMasterWithPassword = void 0;
const https_1 = require("firebase-functions/v2/https");
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
    const { config } = await Promise.resolve().then(() => __importStar(require("firebase-functions")));
    const masterPassword = process.env.MASTER_PASSWORD || ((_a = config().master) === null || _a === void 0 ? void 0 : _a.password);
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
    const { config } = await Promise.resolve().then(() => __importStar(require("firebase-functions")));
    const sid = process.env.TWILIO_ACCOUNT_SID || ((_a = config().twilio) === null || _a === void 0 ? void 0 : _a.sid);
    const token = process.env.TWILIO_AUTH_TOKEN || ((_b = config().twilio) === null || _b === void 0 ? void 0 : _b.token);
    const from = process.env.TWILIO_WHATSAPP_FROM || ((_c = config().twilio) === null || _c === void 0 ? void 0 : _c.whatsapp_from);
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
//# sourceMappingURL=index.js.map