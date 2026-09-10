# Runbook de despliegue de seguridad — BarberShow

No desplegar a producción sin confirmación explícita del dueño del proyecto.

## 0. Qué cambia para usuarios ya instalados

Al publicar las **Rules RTDB**, las versiones de Play Store / App Store que hablan con Firebase **sin Auth** dejarán de leer y escribir datos privados. Eso cierra la exposición actual.

Orden recomendado:

1. Publicar esta build en Play y App Store (Auth + Functions).
2. Desplegar Cloud Functions.
3. Iniciar sesión Master **una vez** (mueve hashes residuales de `users.password` a `authSecrets`).
4. Desplegar Rules RTDB/Firestore en la misma ventana.
5. App Check en monitor → enforce cuando la adopción lo permita.

## 1. Acciones manuales

### Firebase Console (cada proyecto: staging y prod)

1. Crear proyectos separados `barbershow-dev`, `barbershow-staging`, `barbershow-prod` (no reutilizar el actual para desarrollo).
2. Authentication → Sign-in method → **Anonymous** (feedback legado) y tokens personalizados (habilitados por defecto).
3. Realtime Database + Firestore en el proyecto.
4. App Check:
   - Web: reCAPTCHA v3 (site key → `VITE_RECAPTCHA_SITE_KEY`).
   - Android: Play Integrity, paquete `com.barbershow.app`.
   - iOS: DeviceCheck / App Attest, bundle `com.barbershow.app`.
   - Registrar debug tokens para emulador.
5. Functions (Blaze): variables de entorno o secretos:
   - `MASTER_PASSWORD`
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
   - `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, `GOOGLE_PLAY_PACKAGE_NAME`
   - `APPLE_SHARED_SECRET`, `APPLE_BUNDLE_ID`
   - `ENFORCE_APP_CHECK=false` al inicio
   - `GLOBAL_FREE_MODE` alineado con `config/app.ts`
6. Indexes RTDB: `posId` (ya en rules), `ownerId` en `pointsOfSale`, `clienteId` en `appointments`.

### Apple

1. App Store Connect → App-Specific Shared Secret (IAP).
2. DeviceCheck / App Attest para App Check.
3. In-App Purchases: IDs `plan_*_monthly` / `plan_*_yearly` sin cambios.

### Google Play

1. Play Console → cuenta de servicio con API **Google Play Android Developer**.
2. Vincular el JSON a `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`.
3. Play Integrity para App Check.

### Stripe

1. Webhook → URL `https://us-central1-<PROJECT>.cloudfunctions.net/stripeWebhook`.
2. Evento `checkout.session.completed`.
3. Guardar signing secret en `STRIPE_WEBHOOK_SECRET`.

### Twilio

1. WhatsApp sender aprobado.
2. SID / token / `whatsapp_from` solo en Functions, nunca en el cliente.

## 2. Desarrollo local (emuladores)

```bash
npm ci
npm ci --prefix functions
npm run build --prefix functions
npm run emulators
```

En otra terminal: `npm run dev` (`.env.development` activa `VITE_USE_FIREBASE_EMULATOR=true`).

Auth emulator: 9099 · Database: 9000 · Firestore: 8080 · Functions: 5001 · UI: 4000.

No uses `VITE_USE_FIREBASE_EMULATOR=false` contra producción.

## 3. Migración de usuarios

1. El login nuevo (`loginWithPassword`) verifica el hash PBKDF2 existente, crea el usuario Auth, pone custom claims (`role`, `username`, `posId`, `barberId`, `clientId`) y mueve el hash a `authSecrets` (no legible por cliente).
2. La primera sesión tras actualizar la app pide **volver a iniciar sesión** (el `localStorage` ya no autoriza).
3. Master sigue validándose solo en servidor y ahora recibe custom token `platform_owner`. El primer login Master recorre `users` y mueve cualquier `password` residual a `authSecrets`.
4. Roles y planes solo con `upsertStaffUser` / `adminSetPosPlan` / IAP verificado / webhook Stripe.

## 4. Verificación posterior

- Anónimo: `GET .../barbershow/users.json` → 401.
- Usuario A no lee clientes de la sede de B.
- Activar plan sin recibo válido → error.
- Baja de cuenta sin Auth → denegado.
- WhatsApp callable sin claims o con teléfono de otra sede → denegado.
- `npm run test:security` en verde.

## 5. Rollback

- Functions: `firebase functions:rollback` o redesplegar la revisión anterior.
- Rules: restaurar el `database.rules.json` previo **solo en emergencia**; reabre R1.
- App Check enforce: volver `ENFORCE_APP_CHECK=false`.
- No borrar `authSecrets` ni usuarios Auth.

## 6. Comandos (requieren tu confirmación)

```bash
# Staging
firebase use staging
firebase deploy --only functions
firebase deploy --only database,firestore

# Producción (NO ejecutar sin confirmación)
firebase use prod
firebase deploy --only functions
firebase deploy --only database,firestore
```

App Check enforcement: cuando la mayoría haya actualizado, `ENFORCE_APP_CHECK=true` y redesplegar Functions.
