# Cómo hacer que los planes se contraten y paguen desde la aplicación

Para que los usuarios elijan un plan (Solo, Barbería, Multi-Sede) y paguen con tarjeta o método digital **dentro de la app**, hace falta conectar un proveedor de pagos y un poco de lógica en el backend.

## Opciones de pago

| Proveedor | Ventaja | Uso típico |
|-----------|---------|------------|
| **Stripe** | Muy usado, buena documentación, suscripciones recurrentes | Tarjeta internacional |
| **Mercado Pago** | Muy usado en LATAM, acepta tarjeta y efectivo | México, RD, Argentina, etc. |
| **PayPal** | Reconocido, botón familiar | Internacional |

Recomendación: **Stripe** si quieres suscripciones mensuales/anuales automáticas; **Mercado Pago** si tu público paga más en efectivo o métodos locales.

---

## Flujo general

1. Usuario elige **plan** (Solo $14.95, Barbería $19.95, Multi-Sede $29.95) y **ciclo** (mensual o anual -40%).
2. En la app se muestra un botón **"Pagar ahora"** o **"Suscribirse"**.
3. La app llama a una **Cloud Function** (Firebase) que crea una sesión de pago en Stripe/Mercado Pago y devuelve la URL de checkout.
4. Se redirige al usuario a esa URL (página segura del proveedor), paga y el proveedor envía un **webhook** a tu backend.
5. La Cloud Function que recibe el webhook: valida el pago, crea la sede (y usuario si aplica) en Firebase y asigna el plan/tier.

---

## Paso 1: Cuenta en el proveedor

- **Stripe:** [dashboard.stripe.com](https://dashboard.stripe.com) → crear cuenta → obtener **Clave secreta** y **Clave publicable** (o usar modo test).
- **Mercado Pago:** [mercadopago.com/developers](https://www.mercadopago.com/developers) → crear aplicación → **Access Token** y **Public Key**.

Guarda las claves como **variables de entorno** en Firebase Functions (no en el código).

---

## Paso 2: Cloud Functions para crear el checkout

En `functions/` añades una función **callable** (o HTTP) que:

1. Reciba: `plan` (solo | barberia | multisede), `ciclo` (mensual | anual), `email`, `nombreNegocio` (opcional).
2. Calcule el precio (mensual o anual con -40%).
3. Cree en Stripe un **Checkout Session** (o en Mercado Pago el link de pago) con ese monto y metadatos (plan, email).
4. Devuelva la **URL** de pago al front.

Ejemplo de precios que ya tienes en la app:

- Solo: $14.95/mes o $107.64/año (12 × 14.95 × 0.6)
- Barbería: $19.95/mes o $143.64/año
- Multi-Sede: $29.95/mes o $215.64/año

Documentación:

- Stripe Checkout: [stripe.com/docs/payments/checkout](https://stripe.com/docs/payments/checkout)
- Mercado Pago: [developers.mercadopago.com](https://www.mercadopago.com.mx/developers/es/docs/checkout-basic/landing)

---

## Paso 3: Webhook cuando el pago es exitoso

En Stripe/Mercado Pago configuras una URL de webhook que apunte a otra Cloud Function, por ejemplo:

`https://us-central1-TU_PROJECT_ID.cloudfunctions.net/stripeWebhook`

Esa función:

1. Verifica la firma del webhook (que venga de Stripe/MP).
2. Si el evento es "pago completado", lee en los metadatos el `plan` y el `email`.
3. En Firebase Realtime Database (o Firestore):
   - Crea un **PointOfSale** con el tier correspondiente (solo/barberia/multisede) y nombre del negocio.
   - **Importante:** asigna **subscriptionExpiresAt** (ISO string) según el ciclo pagado: mensual → `new Date()` + 1 mes; anual → + 1 año. Ejemplo: `subscriptionExpiresAt: new Date(Date.now() + 30*24*60*60*1000).toISOString()` para 30 días. Así la app bloqueará el acceso cuando venza hasta que renueven.
   - Opcional: crea un usuario **admin** o **dueno** para ese email y lo asocia a la sede.
4. (Opcional) Envía un correo o WhatsApp al usuario con el enlace de login y la sede ya activa.

Así el plan se "hace" automáticamente cuando el pago es exitoso.

---

## Paso 4: En la aplicación (frontend)

En la pantalla de **Solicitud de acceso** (donde ya están "Enviar por correo" y "Enviar por WhatsApp") tienes ya el botón **"Pagar en la app"** (o "Contratar y pagar"). Ese botón debe:

1. Validar que el usuario haya aceptado términos y rellenado al menos email y nombre.
2. Llamar a la Cloud Function que crea el checkout:  
   `const result = await httpsCallable(functions, 'createPlanCheckout')({ plan, ciclo, email, nombreNegocio });`
3. Con la URL que devuelve la función: `window.location.href = result.data.url;`
4. El usuario paga en la página de Stripe/MP y, tras el pago, puedes redirigirlo a una URL de éxito (configurada en el Checkout) tipo `https://tudominio.com/gracias?session_id=...`. En esa página puedes mostrar "Cuenta creada, revisa tu correo para iniciar sesión" o un enlace directo al login.

---

## Resumen de tareas

| Tarea | Dónde |
|-------|--------|
| Crear cuenta y obtener claves | Stripe o Mercado Pago |
| Función `createPlanCheckout` (crear sesión y devolver URL) | `functions/src/index.ts` |
| Función `stripeWebhook` o `mercadopagoWebhook` (crear sede + usuario al pagar) | `functions/src/index.ts` |
| Configurar URL de webhook en el dashboard del proveedor | Stripe/MP dashboard |
| Botón "Pagar en la app" que llame a la callable y redirija | `WelcomePlanSelector.tsx` (ya preparado para cuando la función exista) |
| Página opcional "Gracias / Cuenta creada" | Nueva ruta o componente |

Cuando tengas las claves y la primera función desplegada, en la app solo hay que conectar el botón "Pagar en la app" con esa función (por ejemplo usando `getFunctions()` y `httpsCallable` de Firebase). Si quieres, el siguiente paso puede ser escribir la función `createPlanCheckout` para Stripe con los precios 14.95, 19.95 y 29.95 (y anual con -40%).

---

## Vencimiento y desactivación por pago

La app ya soporta **vencimiento de suscripción** por pago:

- En el modelo **PointOfSale** existe el campo **subscriptionExpiresAt** (ISO string). Si está en el pasado, la sede se considera vencida.
- Al iniciar sesión como admin/dueño/barbero, si la sede activa tiene `subscriptionExpiresAt` vencido, se muestra la pantalla **"Suscripción vencida"** con la fecha y botones "Renovar ahora" (va al selector de planes) y "Cerrar sesión".
- El backend (webhook de Stripe/MP o callable `activatePlanFromPlay` de Google Play) debe **escribir subscriptionExpiresAt** al crear o renovar la sede: mensual → ahora + 1 mes; anual → ahora + 1 año (o la fecha que devuelva Google/Stripe).
- Si no se asigna `subscriptionExpiresAt`, la sede no vence por pago (comportamiento anterior).
