# BarberShow - Sistema Multi-Sede

Sistema POS y gestión para barberías: múltiples sedes, citas, ventas, inventario, clientes, reportes y consola WhatsApp.

## Requisitos

- **Node.js** (recomendado v18+)
- Cuenta **Firebase** (Realtime Database, Functions)
- Opcional: **Twilio** para envío de WhatsApp

## Ejecutar en local

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Copiar variables de entorno (opcional):
   ```bash
   cp .env.example .env.local
   ```
   Edita `.env.local` si usas Gemini u otras claves. La app funciona sin `.env.local`; Firebase se configura en el código del proyecto.

3. Arrancar la app:
   ```bash
   npm run dev
   ```
   Abre http://localhost:3000

## Build y despliegue

- **Build:** `npm run build` (salida en `dist/`)
- **Firebase:**  
  - Reglas de Realtime Database: `database.rules.json` (desplegadas con `firebase deploy --only database`).  
  - Functions: `npm run firebase:deploy` (o `firebase deploy --only functions` desde la raíz).

## Configuración de Cloud Functions

- **Master Admin:** La contraseña Master se valida en el servidor. Configura:
  ```bash
  firebase functions:config:set master.password="tu_password_seguro"
  ```
- **WhatsApp (Twilio):**
  ```bash
  firebase functions:config:set twilio.sid="ACxxx" twilio.token="xxx" twilio.whatsapp_from="whatsapp:+14155238886"
  ```

## Estructura principal

- `App.tsx` – Flujo de login, rutas de vista y layout.
- `pages/` – Vistas (Dashboard, Ventas, Citas, Clientes, etc.).
- `services/data.ts` – Acceso a Firebase Realtime Database.
- `services/firebase.ts` – Inicialización Firebase y llamadas a Cloud Functions.
- `functions/src/index.ts` – Cloud Functions (WhatsApp, login Master).

## Usuarios de prueba

Tras el primer arranque, el seed crea usuarios de ejemplo. Consulta la pantalla de login para las credenciales sugeridas (SuperAdmin, barbero, cliente). El usuario **Master** se valida contra la contraseña configurada en `master.password`.
