# Envío de WhatsApp desde la app (Twilio + Cloud Functions)

Para que el botón **"Enviar desde la app (API)"** en la Consola WhatsApp funcione, tienes que:

## 1. Cuenta de Twilio

1. Regístrate en [Twilio](https://www.twilio.com).
2. En la consola de Twilio, activa el **WhatsApp Sandbox** (para pruebas) o configura un número de WhatsApp Business para producción.
3. Anota:
   - **Account SID**
   - **Auth Token**
   - Número del Sandbox en formato `whatsapp:+14155238886` (o tu número aprobado).

## 2. Instalar y desplegar las Cloud Functions

En la raíz del proyecto:

```bash
cd functions
npm install
cd ..
```

Configura las variables de Twilio en Firebase (sustituye por tus valores):

```bash
firebase functions:config:set twilio.sid="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" twilio.token="tu_auth_token" twilio.whatsapp_from="whatsapp:+14155238886"
```

Despliega las funciones (requiere plan Blaze de Firebase):

```bash
firebase deploy --only functions
```

## 3. Alternativa: variables de entorno en Firebase Console

En [Firebase Console](https://console.firebase.google.com) → Tu proyecto → Functions → Configuración, puedes definir:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM` (ej: `whatsapp:+14155238886`)

La Cloud Function usa primero estas variables y, si no existen, usa `functions.config().twilio`.

## 4. Uso en la app

En **Consola WhatsApp** elige el día y, si quieres, el barbero. Pulsa **"Enviar desde la app (API)"**: los recordatorios se envían por WhatsApp sin abrir ventanas; cada envío se registra en el historial.
