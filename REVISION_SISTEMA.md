# Revisión del sistema – BarberShow

## 1. Arquitectura general

- **Stack:** React 19 + TypeScript, Vite, Firebase Realtime Database, Cloud Functions (login Master, WhatsApp).
- **Estructura:** App central en `App.tsx` con estado de vista, sesión y multi-sede; páginas por sección (Dashboard, Ventas, Citas, Clientes, etc.); `DataService` en `services/data.ts` como capa de datos.
- **Roles:** `platform_owner`, `superadmin`, `admin`, `barbero`, `cliente`. El rol legacy `empleado` se normaliza a `barbero` en sesión y menú.
- **Multi-tenant:** Sedes (`pointsOfSale`), sede activa (`currentPosId`), datos filtrados por `posId` y, para barberos, por `barberId`.

**Conclusión:** Estructura clara y coherente con el dominio (barberías, citas, ventas, clientes, barberos).

---

## 2. Seguridad

### 2.1 Base de datos (Firebase Realtime Database)

- **Reglas actuales:** `.read: true` y `.write: true` en todo el nodo `barbershow`.
- **Riesgo:** Cualquiera con la URL de la base puede leer y modificar todos los datos.
- **Recomendación:** Cuando puedas, sustituir por reglas que exijan autenticación (Firebase Auth o al menos un token/uid) y limitar escritura/lectura por rol o por `posId`. Mientras tanto, no exponer la `databaseURL` en repos públicos ni en builds que no controles.

### 2.2 Autenticación

- **Login normal:** Usuario/contraseña se validan en el cliente contra `/users` en RTDB. La contraseña viaja y se compara en el navegador.
- **Login Master:** Validado en Cloud Function (`authenticateMasterWithPassword`), que es el enfoque correcto.
- **Sesión:** Se guarda en `localStorage` (`currentUser`). Cualquiera con acceso al dispositivo puede ver/modificar ese JSON.
- **Recomendación a medio plazo:** Migrar login normal a Firebase Auth (email/contraseña o proveedores que necesites) y usar el UID en reglas de RTDB; así las contraseñas no se comparan ni almacenan en el cliente.

---

## 3. Rendimiento y datos

- **Caché:** Caché en memoria con TTL 50 s para `getClients`, `getAppointments`, `getSales`, `getBarbers`, `getPointsOfSale`, `getClientsWithActivity`; invalidación al crear/actualizar.
- **Consultas:** Se usan `query` con `orderByChild('posId')` y `equalTo(posId)` para clients, products, services, barbers, appointments, sales; así solo se descargan datos de la sede activa.
- **Índices:** `database.rules.json` define `.indexOn: ["posId"]` para esos nodos. Hay que desplegar las reglas (`firebase deploy --only database` o pegarlas en la consola de Firebase) para que las consultas sean eficientes.
- **Pendiente de optimizar (lecturas de nodo completo):**
  - `findClientByPhone`: hace `get` de todo `/clients` (búsqueda por teléfono en todas las barberías).
  - `checkAppointmentConflict`: hace `get` de todo `/appointments`.
  - `setProducts` / `setAppointments` / `setSales`: leen el nodo completo para hacer merge y luego escriben (patrón necesario con la estructura actual).

**Conclusión:** La parte más crítica (listados por sede) ya está optimizada con queries e índices; el resto es aceptable para el tamaño actual. Desplegar reglas es importante.

---

## 4. Consistencia y mantenimiento

- **Tipos (`types.ts`):** Bien definidos (UserRole, PointOfSale, Client, Appointment, Sale, etc.). `UserRole` incluye `empleado` por compatibilidad; en la app se trata como `barbero`.
- **Vistas y permisos:** El `Sidebar` filtra ítems por `userRole` y por `accountTier` (solo/barberia/multisede). Coherente con los roles usados en `App.tsx` y en las páginas.
- **Prop `key` en App:** Corregido: `key` se pasa directamente a cada componente en `renderView()`, no dentro de un objeto spread.
- **package.json:** El nombre del proyecto es `colmafacil-pos`; si quieres que coincida con la marca, puedes cambiarlo a algo como `barbershow-app`.

---

## 5. Frontend y despliegue

- **Tailwind:** Se carga por CDN en `index.html` (`cdn.tailwindcss.com`). La consola avisa de no usarlo en producción. Para producción es mejor instalar Tailwind como dependencia y usar el build de Vite (PostCSS o CLI).
- **PWA/Android:** `index.html` tiene meta para theme-color, mobile-web-app-capable y enlace a `manifest.json`; útil para uso tipo app.
- **Build:** `vite build`; no hay variables de entorno obligatorias para el build base (Gemini es opcional si no usas esa parte).

---

## 6. Resumen de acciones sugeridas

| Prioridad | Acción |
|----------|--------|
| Alta | Desplegar reglas de Firebase (`database.rules.json`) para activar índices y, cuando sea posible, endurecer `.read`/`.write`. |
| Media | Planear migración de login a Firebase Auth y reglas por UID para mejorar seguridad. |
| Media | En producción, usar Tailwind vía npm + build en lugar del CDN. |
| Baja | Opcional: renombrar `package.json` a `barbershow-app` y revisar `findClientByPhone` / `checkAppointmentConflict` si el volumen de datos crece. |

---

*Revisión realizada sobre el estado actual del repositorio.*
