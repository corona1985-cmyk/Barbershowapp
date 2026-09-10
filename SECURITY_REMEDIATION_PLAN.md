# Plan de remediación de seguridad — BarberShow

Fecha: 2026-09-10  
Alcance: RTDB, Firebase Auth, Cloud Functions, App Check, ambientes, pruebas y CI.  
No se despliegan reglas ni Functions a producción en este cambio.

## 1. Inventario derivado del código

### 1.1 Rutas RTDB (`/barbershow`)

| Ruta | Lectores/escritores actuales | Datos sensibles | Destino |
| --- | --- | --- | --- |
| `users` | Login lista claves (`users.json?shallow=true`), lee hashes, escribe perfil/roles/estado. Nativo: REST GET/PUT/DELETE. | Hash de contraseña, rol, `posId`, email, `barberId`, `clientId`, estado | Lectura propia o de la sede autorizada **sin** `password`. Escritura de rol/estado/plan **solo Functions**. Secretos en `authSecrets` (deny-all cliente). |
| `pointsOfSale` | `getPointsOfSale` lee **todas** las sedes (descubrimiento, QR, admin). Escritura de `tier`/`plan`/`subscriptionExpiresAt` desde cliente (IAP, AdminPOS, Master). | `ownerId`, plan, vencimiento, dirección | Lectura autenticada por sede/owner/plataforma. Catálogo público sanitizado en `publicShops`. Plan/tier/owner solo backend. |
| `settings/{posId}` | Staff de la sede | Configuración comercial | Staff de la misma `posId` o plataforma. |
| `clients` | Lista por `posId`; `findClientByPhone` lee **todos** los clientes. Invitados y registro crean clientes. | Nombre, teléfono, email, notas | Query por `posId` (staff) o `id` propio (cliente). Alta de invitado vía Function. |
| `appointments` | Staff por sede; invitado lee citas de la sede (PII de terceros) y escribe. | `clienteId`, estado, servicios | Staff: query `posId`. Cliente: query `clienteId`. Invitado: Function. Transiciones de `estado` validadas. |
| `barbers`, `services`, `products` | Staff; invitado lee barberos/servicios | Agenda, precios; productos/stock | Staff de la sede. Catálogo público sanitizado (`publicBarbers`, `publicServices`). |
| `sales`, `finances`, `financialTransactions` | Staff; Master lee todo | Ventas, pagos, totales | Staff de la sede / plataforma. Cliente **no** escribe. |
| `auditLogs`, `notificationLogs` | Cliente escribe auditoría; nativo REST | Acciones, IPs ficticias | Escritura solo backend o staff autenticado con esquema. Lectura plataforma/admin sede. |
| `globalSettings` | Lectura amplia; escritura `platform_owner` en UI | Textos legales, email soporte | Lectura pública justificada (términos). Escritura solo `platform_owner`. |
| `clientPreferences/{username}` | Cliente | `preferredPosId` | Solo el propio `username` (claim). |
| `barberGallery/{barberId}` | Invitado y staff | Fotos de trabajos (no teléfonos) | Lectura pública justificada. Escritura barbero dueño o admin de sede. |
| `userCart` | Semilla vacía; el carrito real está en `localStorage` | — | Deny cliente. |
| `authSecrets`, `uidIndex`, `rateLimits` | No existen aún | Hashes, límites | Deny-all cliente. Solo Admin SDK. |

Regla actual: `/barbershow` con `.read: true` y `.write: true` (crítico).

### 1.2 `localStorage` (sesión / roles / planes)

| Clave | Uso | Tras la remediación |
| --- | --- | --- |
| `currentUser` | Sesión y **autorización** (`role`, `posId`, `barberId`) | Solo caché de UI (nombre/foto). Autorización = Firebase Auth custom claims. |
| `acceptedCookies` | Preferencia | Se conserva. |
| `userCart` | Carrito POS | Se conserva (no es permiso). |
| `barbershow-locale` | Idioma | Se conserva. |
| IDs de notificaciones locales | UX | Se conservan. |

`requireRole` / `getCurrentUserRole` leen `localStorage`: no es control de seguridad. Las Rules y Functions ignoran ese valor.

### 1.3 Llamadas directas

- **RTDB SDK y REST nativo** (`services/data.ts`, `accountDeactivation.ts`): GET/PUT/PATCH/DELETE sin `auth`. Incluye listado de usuarios, IAP, signup, baja.
- **Firestore**: feedback de baja (`account_deactivation_feedback`) con reglas deny-all / create validado + anónimo. Se mantiene; la baja de RTDB pasa a Function.
- **Stripe**: `createPendingBarberSignup` + `stripeWebhook` (firma). Se conserva el webhook. `createPlanCheckout` está referenciado en cliente y **no existe** en Functions.
- **WhatsApp**: UI usa `wa.me` (dispositivo del usuario). Callable `sendWhatsAppMessage` **sin auth** (Twilio). Se autentica y se limita.
- **IAP**: plugin nativo + `activatePlanFromPlay` en cliente **sin verificar recibo**. Endpoint `verifyGooglePlayReceipt` citado y **no implementado**.
- **Baja de cuenta**: `DELETE` REST al nodo `users/{key}` en nativo.

### 1.4 Cloud Functions actuales

`authenticateMasterWithPassword`, `sendWhatsAppMessage`, `completeSelfSignupFree`, `createPendingBarberSignup`, `createPendingBarberSignupMobile`, `activatePlanFromPlay`, `stripeWebhook`.

Ninguna exige `request.auth` (excepto que el webhook es HTTP). IAP no verifica Apple/Google. Signup móvil se duplica en el cliente y **no** llama a la Function.

Auth de negocio: login propio PBKDF2 100k. Firebase Auth solo `signInAnonymously` para feedback.

Ambiente: un único proyecto `gen-lang-client-0624135070`. `npm run dev` escribe en RTDB cloud. No hay emuladores ni CI de reglas.

### 1.5 Lecturas públicas justificadas (sin PII)

Necesarias para QR/invitado y descubrimiento:

- Nombre, dirección, ciudad, barrio, país, coordenadas, `isActive` de sedes.
- Nombre/especialidad/horario de barberos y servicios/precios.
- Huecos ocupados (`fecha`, `hora`, `barberoId`, `duracionTotal`, `estado`) **sin** `clienteId`.
- Galería de trabajos.
- Textos legales en `globalSettings`.

No son públicas: teléfonos, hashes, roles, ventas, `ownerId`, planes, citas con cliente.

## 2. Riesgos y severidad

| ID | Riesgo | Severidad |
| --- | --- | --- |
| R1 | RTDB world-writable/readable: exfiltración y alteración de teléfonos, citas, ventas, roles, planes | Crítica |
| R2 | Login lee hashes y lista usuarios sin auth; REST nativo sin token | Crítica |
| R3 | Roles/planes/IAP/baja desde el cliente | Crítica |
| R4 | `sendWhatsAppMessage` y signup/IAP callables sin identidad | Alta |
| R5 | Un proyecto para local y producción | Alta |
| R6 | Sin App Check ni rate limit real | Alta |
| R7 | `findClientByPhone` y `getPointsOfSale` globales | Media-alta |
| R8 | Semilla cliente con usuarios `master`/`superadmin` en claro si la raíz está vacía | Alta |

## 3. Compatibilidad con la app publicada

Cerrar `/barbershow` a `auth != null` **rompe** las versiones ya instaladas: no envían ID token y el login actual requiere lectura pública de `users`.

Eso es intencional: las versiones antiguas **son el vector**. La corrección de servidor las deja sin acceso anónimo a datos privados.

Impacto esperado tras desplegar reglas:

- Login, agenda, POS, IAP y baja de las builds actuales fallan hasta actualizar.
- El enlace `wa.me` de la consola sigue funcionando (no usa RTDB/Twilio).
- QR/invitado deja de leer `pointsOfSale` completo; la nueva app usa `publicShops` + Function de reserva.

Mitigación de producto: publicar ya la build con Auth + Functions, y desplegar reglas en la misma ventana (o Functions primero, app a stores, reglas de inmediato por exposición activa).

## 4. Migración por etapas

1. **Código (esta PR)**: Rules cerradas, Functions de identidad/IAP/WhatsApp/baja/roles, cliente con custom token, emuladores, tests, runbook. Sin deploy a producción.
2. **Config manual**: secretos, App Check, IAP APIs, proyectos staging/prod (ver runbook).
3. **Deploy Functions** (producción, con confirmación): login, claims, IAP, baja. Las Rules aún abiertas = ventana residual.
4. **Deploy Rules + App Check gradual**: cierra R1. Fuerza actualización de la app.
5. **Enforcement App Check** en Functions cuando la adopción lo permita.
6. **Proyectos Firebase separados** y emulador obligatorio en local.

Rollback: restaurar `database.rules.json` previo (abierto) **reexpone todo**; solo como emergencia de minutos. Rollback de Functions: revisión anterior. Los custom tokens siguen válidos hasta expirar.

## 5. Variables / credenciales a configurar (manual)

No se incluyen valores reales en el repo.

- Firebase: proyectos `dev` / `staging` / `prod`; Auth (custom tokens); App Check (reCAPTCHA v3 web, Play Integrity, App Attest/DeviceCheck).
- `MASTER_PASSWORD` (ya usado).
- Twilio: SID, token, `whatsapp_from`.
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (ya usados).
- IAP Google: JSON de cuenta de servicio Play Developer API; `GOOGLE_PLAY_PACKAGE_NAME=com.barbershow.app`.
- IAP Apple: `APPLE_SHARED_SECRET` y/o clave `.p8` App Store Server API (`APPLE_ISSUER_ID`, `APPLE_KEY_ID`, `APPLE_BUNDLE_ID=com.barbershow.app`).
- Web: `VITE_FIREBASE_*`, `VITE_RECAPTCHA_SITE_KEY`, `VITE_USE_EMULATORS`.
- Opcional: `ENFORCE_APP_CHECK=true` cuando se active el rechazo duro.

## 6. Rollback seguro

1. No borrar usuarios Auth ni claims.
2. Revertir Functions a la revisión anterior si el login nuevo falla.
3. Revertir Rules solo si la app nueva no está en stores **y** se acepta reabrir R1.
4. Mantener `authSecrets` si ya se migraron hashes; el login nuevo lee `authSecrets` y, si falta, `users.password` (migración perezosa).

## 7. Archivos a cambiar / crear

**Crear:** `functions/src/{auth,claims,rateLimit,audit,publicCatalog,iapVerify,account,guest,staff}.ts`, `config/firebaseEnv.ts`, `services/session.ts`, `tests/*`, `scripts/assert-rtdb-rules-locked.mjs`, `.gitlab-ci.yml`, `firebase.emulators.json` (emuladores en `firebase.json`), `SECURITY_DEPLOYMENT_RUNBOOK.md`, `.env.development.example`.

**Modificar:** `database.rules.json`, `firestore.rules`, `firebase.json`, `functions/src/index.ts`, `functions/package.json`, `services/{firebase,data,accountDeactivation,playBilling}.ts`, `App.tsx`, `components/{GuestBookingView,SelfServiceBarberSignup}.tsx`, `pages/{ClientDiscovery,MasterDashboard,AdminPOS,WhatsAppConsole,UserAdmin}.tsx`, `.env.example`, `package.json`.

**Preservar:** hash PBKDF2 100k, webhook Stripe firmado, reglas de feedback Firestore (se endurecen a create autenticado o Admin SDK), secretos solo en config de Functions.
