# Estado actual del código – Análisis para Plan Solo

Este documento describe cómo está hoy la app para saber **qué adaptar** cuando el usuario está en **plan Solo** (un barbero, una barbería).

---

## 1. Estructura del proyecto

- **Entrada:** `index.html` → `index.tsx` → `App.tsx`
- **Navegación:** `Sidebar.tsx` (menú lateral por grupos: Principal, Operaciones, Administración)
- **Vistas:** `pages/` — Dashboard, Sales, Appointments, Reports, Settings, etc.
- **Datos:** `services/data.ts` (Firebase), `types.ts` (tipos y modelos)

---

## 2. Modelo de datos actual

| Entidad      | Uso relevante para Plan Solo |
|-------------|-------------------------------|
| **PointOfSale** | Ya existe `plan?: 'basic' \| 'pro'` (notificaciones). Falta un “tier” de negocio: `solo` \| `barberia` \| `multisede`. |
| **Barber**      | Lista de barberos por sede. En Plan Solo debe haber **uno implícito** (el usuario). |
| **SystemUser**  | `posId`, `barberId`; en Solo el usuario es el único barbero efectivo. |
| **Appointment** | `barberoId` obligatorio hoy. En Solo debe asignarse al barbero por defecto. |
| **Sale**        | `barberoId` opcional; ya se usa `DataService.getCurrentBarberId()` al guardar. |

---

## 3. Menú actual (Sidebar)

**Principal:** Sedes Globales (superadmin), Dashboard, Descubrir Barberías (cliente).

**Operaciones:** Ventas (POS), Tienda Online (cliente), Agenda Citas, Calendario Mensual, Consola WhatsApp, Clientes.

**Administración:** Inventario, Finanzas, Reportes, Admin Usuarios (superadmin), Configuración (admin/superadmin).

Para **Plan Solo** debe mostrarse solo: Dashboard, Citas, Clientes, Ventas (POS), Configuración (y opcionalmente Reportes básicos). Ocultar: Calendario Mensual, Consola WhatsApp, Inventario, Finanzas, Admin Usuarios (o mostrarlos deshabilitados con CTA).

---

## 4. Pantallas a adaptar

### 4.1 Appointments (`pages/Appointments.tsx`)

- Carga `barbers` y usa `selectedBarberForView` para filtrar por barbero.
- **Vista cliente:** selector “Seleccionar Barbero” + horarios por barbero.
- **Vista admin/barbero:** filtro por fecha; en “Nueva Cita” hay un **select “Barbero”** (líneas 639–648).
- **Guardar cita:** exige `newApt.barberoId` (línea 86).

**Para Plan Solo:** no mostrar selector de barbero; usar siempre el barbero por defecto (único) de la sede. En vista cliente no elegir barbero; en modal “Nueva Cita” no mostrar el select Barbero y asignar automáticamente el barbero por defecto.

### 4.2 Sales (`pages/Sales.tsx`)

- Al hacer checkout usa `barberoId: salesFromAppointment?.barberoId ?? DataService.getCurrentBarberId() ?? undefined`.
- No hay selector visible de barbero en la UI; ya está implícito por usuario actual.

**Para Plan Solo:** sin cambios de UI; seguir usando `getCurrentBarberId()` o el barbero por defecto de la sede.

### 4.3 Settings (`pages/Settings.tsx`)

- Pestañas: **general**, **users**, **barbers**, **services**, **privacy**.
- **Barbers:** lista de barberos, alta/baja, modal edición (líneas 302–350).

**Para Plan Solo:** ocultar pestaña “Barberos” o mostrarla deshabilitada con mensaje “Plan Barbería” y CTA a subir de plan.

### 4.4 Reports (`pages/Reports.tsx`)

- Reportes globales: ventas en el tiempo, estado de citas, productos más vendidos, etc.
- No hay desglose “por barbero” en la UI actual (solo datos agregados).

**Para Plan Solo:** se puede dejar como está (reportes básicos). Más adelante, si se añade “por barbero”, ocultarlo cuando el plan sea Solo.

---

## 5. Selector de sede

- **App.tsx:** SuperAdmin tiene selector de sede (pointsOfSale, currentPosId). Usuarios normales ven “tenant label” (currentPosName).
- En Plan Solo no debe mostrarse selector de sede (siempre “mi negocio” / una sede implícita).

---

## 6. Datos y sesión

- **data.ts:** `getCurrentUser()`, `getCurrentUserRole()`, `getCurrentBarberId()` leen de `localStorage.currentUser`.
- `ACTIVE_POS_ID` y `setActivePosId` determinan la sede activa.
- No existe aún “plan de cuenta” o “tier” (solo/barbería/multi-sede) en el flujo; solo `PosPlan` (basic/pro) en PointOfSale.

---

## 7. Resumen de cambios necesarios para Plan Solo

| Área           | Cambio |
|----------------|--------|
| **Tipos / modelo** | Añadir tier de negocio (ej. `solo` \| `barberia` \| `multisede`) en PointOfSale o en contexto de cuenta. |
| **Sidebar**    | Filtrar ítems del menú según plan: en Solo ocultar Calendario, WhatsApp, Inventario, Finanzas, Admin Usuarios. |
| **Settings**   | Ocultar o deshabilitar pestaña Barberos en plan Solo. |
| **Appointments** | Sin selector de barbero; asignar barbero por defecto de la sede. |
| **Sales**      | Sin cambios relevantes (ya usa barbero actual o de la cita). |
| **Reportes**   | Mantener reportes básicos; si luego hay “por barbero”, ocultar en Solo. |
| **Sede**       | No mostrar selector de sede en Plan Solo (una sede implícita). |

---

*Documento de análisis para reestructuración Plan Solo – BarberShow.*
