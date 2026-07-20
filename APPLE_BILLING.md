# App Store In-App Purchase – Plan Barbería (iOS)

Guía para vender el **Plan Barbería** como suscripción auto-renovable dentro de la app iOS vía StoreKit 2 (`@squareetlabs/capacitor-subscriptions`).

---

## 1. Product IDs en App Store Connect

En [App Store Connect](https://appstoreconnect.apple.com) → tu app (`com.barbershow.app`) → **Suscripciones**:

1. Crear un **grupo de suscripciones**: p. ej. `barbershow_plans`
2. Crear **2 suscripciones auto-renovables**:

| Product ID | Plan | Ciclo | Precio referencia |
|------------|------|-------|-------------------|
| `plan_barberia_monthly` | Barbería | Mensual | $19.95 USD |
| `plan_barberia_yearly` | Barbería | Anual (−40%) | $143.64 USD |

3. Completar localización (nombre, descripción) en español e inglés.
4. Firmar el **Paid Applications Agreement** y configurar datos bancarios/fiscales.

> Fase 1 solo incluye Plan Barbería. Solo y Multi-Sede se añadirán en fases posteriores con product IDs adicionales.

---

## 2. Sandbox testers

1. App Store Connect → **Usuarios y acceso** → **Sandbox** → **Testers**
2. Crear cuenta de prueba (email ficticio, p. ej. `test+barbershow@example.com`)
3. En el iPhone de prueba: **Ajustes → App Store → Cuenta sandbox** → iniciar sesión con el tester
4. Instalar la app vía Xcode o TestFlight y probar compra

---

## 3. Plugin en la app

Se usa **@squareetlabs/capacitor-subscriptions** (StoreKit 2 en iOS 15+).

- **iOS:** StoreKit 2 verifica transacciones en el dispositivo; `getCurrentEntitlements()` devuelve `expiryDate` sin endpoint de verificación Google.
- **Android:** sigue requiriendo `setGoogleVerificationDetails` (ver [PLAY_BILLING.md](PLAY_BILLING.md)).

Configuración en [`services/playBilling.ts`](services/playBilling.ts):

- Product IDs: `plan_barberia_monthly`, `plan_barberia_yearly`
- Solo el tier `barberia` está habilitado para IAP en iOS (`IOS_IAP_TIERS` en [`config/app.ts`](config/app.ts))

---

## 4. Flujo en la app

### Registro nuevo (Plan Barbería)

1. Usuario completa wizard en `SelfServiceBarberSignup`
2. `createPendingBarberSignupMobile` crea usuario/POS en `pending_payment`
3. `purchasePlan('barberia', ciclo)` abre diálogo App Store
4. Tras compra, listener llama `getCurrentEntitlements()` → `activatePlanFromPlay` con `expiryDate`
5. Backend activa POS con `subscriptionExpiresAt` real de Apple

### Plan gratuito

Autoregistro sin IAP vía `completeSelfSignupFree` (tier `gratuito`).

### Renovación

Pantalla “Suscripción vencida” en `App.tsx` → **Renovar ahora** → `purchasePlan` → `activatePlanFromPlay`.

### Restaurar compras

Botón **Restaurar compras** (requerido por Apple) → `getCurrentEntitlements()` → `activatePlanFromPlay`.

---

## 5. Activación del plan (cliente, sin Cloud Functions)

La activación tras compra se hace **directamente en Firebase Realtime Database** desde la app ([`services/data.ts`](services/data.ts)):

- `DataService.createPendingBarberSignupMobile` — crea usuario/POS en `pending_payment`
- `DataService.activatePlanFromPlay` — tras StoreKit, actualiza `tier`, `plan`, `subscriptionExpiresAt` y activa el usuario

No hace falta desplegar Cloud Functions para el flujo Apple IAP de fase 1.

**Fase 2 (opcional):** verificación server-side con App Store Server API en Cloud Functions para mayor seguridad anti-fraude.

---

## 6. Modo promocional → cobro

Con `GLOBAL_FREE_MODE = false`:

- El autoregistro ya no otorga Plan Barbería gratis
- Usuarios existentes del periodo promocional reciben **30 días de gracia** (`subscriptionExpiresAt`) vía migración Master
- Pantalla de suscripción vencida activa cuando `subscriptionExpiresAt` está en el pasado

---

## 7. Cumplimiento App Store (Guideline 3.1.1)

- En iOS, planes de pago solo vía App Store IAP (no Stripe ni links externos)
- Textos de la app dicen “App Store”, no “Apple Pay”
- Botón **Restaurar compras** visible en flujo de pago iOS

---

## 8. Checklist de pruebas

| Prueba | Resultado esperado |
|--------|-------------------|
| Sandbox: registro Plan Barbería mensual | POS activo, `subscriptionExpiresAt` futuro |
| Sandbox: registro gratuito | POS tier `gratuito`, sin IAP |
| iOS: seleccionar Solo/Multi-Sede | “Próximamente”, sin compra |
| Sede vencida → Renovar | App Store abre, cuenta reactivada |
| Restaurar compras | Entitlement activo, sede reactivada |
| Android | Flujo Google Play sin regresiones |

---

## 9. Comisiones

Apple retiene **15–30%** según programa y antigüedad de suscripción. Pagos se reciben vía App Store Connect → **Pagos y informes financieros**.
