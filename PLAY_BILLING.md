# Google Play Billing – Planes en la app Android

Para vender los planes (Solo, Barbería, Multi-Sede) como **suscripciones** dentro de la app en Google Play, hay que usar **Google Play Billing** y un endpoint en tu backend para verificar la compra y activar la sede.

---

## 1. Product IDs en Play Console

En **Google Play Console** → tu app → **Monetización** → **Productos** → **Suscripciones**, crea una suscripción por cada plan y ciclo. Usa estos **ID de producto** (máx. 40 caracteres):

| Plan       | Mensual              | Anual                |
|-----------|----------------------|----------------------|
| Solo      | `plan_solo_monthly`  | `plan_solo_yearly`   |
| Barbería  | `plan_barberia_monthly` | `plan_barberia_yearly` |
| Multi-Sede| `plan_multisede_monthly` | `plan_multisede_yearly` |

- Precio en Play Console: define el precio que quieras (ej. 14.99 USD mensual, anual con descuento).
- La app usa estos mismos IDs para iniciar la compra con el plugin.

---

## 2. Plugin en la app

Se usa **@squareetlabs/capacitor-subscriptions** (StoreKit 2 en iOS, Billing 7 en Android).

- **Android:** antes de usar el plugin hay que llamar a `setGoogleVerificationDetails(urlVerificacion, appId)`.
- **urlVerificacion:** URL de una Cloud Function que reciba el token de compra y lo verifique con la API de Google Play (ver más abajo).
- **appId:** `com.barbershow.app` (debe coincidir con el `applicationId` de tu app en Play Console).

---

## 3. Verificación en el backend (Cloud Function)

Google **no** devuelve la fecha de vencimiento de la suscripción en el cliente; hay que verificar el **purchase token** en el servidor con la **Google Play Developer API**.

### 3.1 Cuenta de servicio y API

1. En [Google Cloud Console](https://console.cloud.google.com) (mismo proyecto que Firebase): **APIs y servicios** → **Biblioteca** → activa **Google Play Android Developer API**.
2. **Credenciales** → **Crear credenciales** → **Cuenta de servicio** → crear clave JSON. Guarda el JSON de forma segura (por ejemplo en Firebase Functions config o Secret Manager).
3. En **Google Play Console** → **Configuración** → **Acceso a la API**: vincula el proyecto de Cloud y otorga acceso a la cuenta de servicio (como “Ver información financiera”, etc., según la documentación de Play).

### 3.2 Endpoints en el backend

**A) Verificación (para el plugin)**  
El plugin puede llamar a un endpoint que reciba el token y devuelva validez y fecha de vencimiento. URL configurada en `setGoogleVerificationDetails` en la app (ver `services/playBilling.ts`).

**B) Activar plan tras la compra (callable `activatePlanFromPlay`)**  
La app, tras una compra en Google Play, llama a la callable **`activatePlanFromPlay`** con:

- `purchaseToken`: token de la compra (obtenido de `getCurrentEntitlements()` en la app).
- `productId`: ej. `plan_solo_monthly`, `plan_barberia_yearly`, etc.
- `email`, `nombreNegocio` (opcional), `nombreRepresentante` (opcional).

La función debe:

1. Verificar el `purchaseToken` con la API de Google Play (Purchases.Subscriptions) para obtener el estado y la fecha de vencimiento.
2. Si la suscripción es válida: crear la sede (PointOfSale) en Firebase con el tier correspondiente al `productId`. **Asignar subscriptionExpiresAt** con la fecha de vencimiento que devuelve la API de Google (así la app bloqueará el acceso cuando venza). Opcional: crear el usuario y asociarlo. Devolver `{ success: true }`.
3. Si algo falla: devolver `{ success: false, message: "..." }`.

Documentación: [Verify subscription with Google Play](https://developer.android.com/google/play/billing/security#verify).

---

## 4. Flujo en la app

1. Usuario elige plan y ciclo (mensual/anual) en `WelcomePlanSelector`.
2. Toca **“Pagar con Google Play”**.
3. La app obtiene el **productId** (ej. `plan_solo_yearly`) y llama a `purchaseProduct(productId)` del plugin → se abre el diálogo nativo de Google Play.
4. Tras el pago, el plugin puede usar tu **urlVerificacion** (si lo soporta) o la app llama a tu Cloud Function pasando `purchaseToken` y `productId`.
5. La Cloud Function verifica con Google, crea la sede (y usuario si aplica) y responde. La app muestra éxito y puede redirigir al login.

---

## 5. Resumen de tareas

| Tarea | Dónde |
|-------|--------|
| Crear suscripciones en Play Console con los product IDs anteriores | Play Console |
| Activar Google Play Android Developer API y crear cuenta de servicio | Google Cloud + Play Console |
| Implementar Cloud Function `verifyGooglePlayReceipt` (verificación para el plugin) | `functions/src/index.ts` |
| Implementar callable `activatePlanFromPlay` (verificar token + crear sede) | `functions/src/index.ts` |
| Configurar esa URL en `setGoogleVerificationDetails` en la app | `services/playBilling.ts` |
| Botón “Pagar con Google Play” (solo Android) | `WelcomePlanSelector.tsx` |

---

## 6. Comisiones

Google retiene aproximadamente **15–30%** del pago (menor porcentaje en suscripciones de más de 1 año). El resto lo recibes en tu cuenta de **Google Play Console** y luego puedes transferirlo a tu cuenta bancaria desde la sección de pagos de Play Console.
