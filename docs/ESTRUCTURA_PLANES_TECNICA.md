# Estructura técnica de los 3 planes – BarberShow

Resumen de cómo está implementado cada plan y qué comportamientos aplican.

---

## 1. Plan SOLO (`tier: 'solo'`)

| Área | Comportamiento |
|------|----------------|
| **Menú** | Ocultos: Calendario, Consola WhatsApp, Inventario, Finanzas, Admin Usuarios. Visibles: Dashboard, Ventas, Agenda Citas, Clientes, Reportes, Configuración. |
| **Header** | Etiqueta de sede: "Mi negocio" (no se muestra nombre de sede). |
| **Configuración** | Pestaña Barberos oculta. |
| **Citas** | Sin selector de barbero (se usa el barbero por defecto de la sede). |
| **Ventas** | Sin selector de barbero (asociado al usuario/barbero actual). |
| **Reportes** | Solo resumen global; sin pestañas "Por barbero" ni "Por sede". |
| **Selector de sede** | No se muestra. |
| **Onboarding** | Si la sede no tiene `tier`, se muestra "¿Cómo trabajas?" y se guarda en la sede. |

---

## 2. Plan BARBERÍA (`tier: 'barberia'`)

| Área | Comportamiento |
|------|----------------|
| **Menú** | Completo: Dashboard, Ventas, Citas, Calendario, WhatsApp, Clientes, Inventario, Finanzas, Reportes, Admin Usuarios (según rol), Configuración. |
| **Header** | Etiqueta con nombre de la sede (una sola sede). |
| **Configuración** | Pestaña Barberos visible; alta/baja y edición de barberos. |
| **Citas** | Selector de barbero en nueva cita y en vista cliente. |
| **Ventas** | Barbero implícito (usuario actual o de la cita). |
| **Reportes** | Resumen global + sección **Por barbero** (ventas y citas por barbero). |
| **Selector de sede** | No se muestra (una sola sede). |

---

## 3. Plan MULTI-SEDE (`tier: 'multisede'`)

| Área | Comportamiento |
|------|----------------|
| **Menú** | Igual que Barbería (completo). |
| **Header** | **Selector de sede** cuando el usuario tiene acceso a más de una sede (mismo `ownerId`). |
| **Configuración** | Igual que Barbería (incluye Barberos). |
| **Citas / Ventas** | Igual que Barbería; datos de la sede seleccionada. |
| **Reportes** | Resumen global + Por barbero + **Por sede** (comparativa entre sedes del mismo owner). |
| **Datos por sede** | Se usan `getSalesForPos(posId)` y `getAppointmentsForPos(posId)` para reportes por sede sin cambiar la sede activa. |

---

## 4. Lógica de negocio en código

- **`accountTier`** viene de `PointOfSale.tier` (sede activa). Se usa en: App, Sidebar, Settings, Appointments, Reports.
- **Selector de sede (Multi-Sede):** Se muestra si `accountTier === 'multisede'` y el usuario tiene más de una sede con el mismo `ownerId` que la sede actual. Se rellena con `posListForOwner`.
- **Reportes por barbero:** Solo si `accountTier` es `barberia` o `multisede`; se agrupa por `barberoId` en ventas y citas.
- **Reportes por sede:** Solo si `accountTier === 'multisede'`; se agrupa por `posId` para las sedes de `posListForOwner`.

---

## 5. Archivos tocados por plan

| Archivo | Solo | Barbería | Multi-Sede |
|---------|------|----------|------------|
| `App.tsx` | Etiqueta "Mi negocio", onboarding | — | `posListForOwner`, selector sede |
| `components/Sidebar.tsx` | Filtro ítems menú | — | — |
| `pages/Settings.tsx` | Oculta pestaña Barberos | — | — |
| `pages/Appointments.tsx` | Sin selector barbero | — | — |
| `pages/Reports.tsx` | Solo resumen | Por barbero | Por sede |
| `services/data.ts` | — | — | `getSalesForPos`, `getAppointmentsForPos` |
| `types.ts` | `AccountTier` | — | — |

---

*Documento de referencia técnica – reestructuración 3 planes BarberShow.*
