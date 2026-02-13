# Plan de Reestructuración – BarberShow

## Objetivo

Hacer que BarberShow sirva **tanto** para un **barbero solo con una barbería** como para barberías con equipo o varias sedes, con **3 planes** en el sistema (Solo, Barbería y Pro), y que el uso **invite de forma natural** a subir de plan cuando crezcan las necesidades.

---

## Beneficios por plan (resumen para validación)

### Plan SOLO — Una persona, un local

| Beneficio | Descripción |
|-----------|-------------|
| Interfaz simple | Sin sedes ni lista de barberos; todo es “mi negocio”. |
| Menú reducido | Dashboard, Citas, Clientes, Ventas (POS), Configuración básica (servicios, datos del negocio). |
| Citas y ventas directas | No se elige barbero; la cita/venta es “conmigo”. |
| Reportes básicos | Resumen de ventas y citas (sin desglose por barbero ni por sede). |
| Opcional | Inventario simple (productos que vende). |
| **Ideal para** | Barbero independiente que trabaja solo en un solo lugar. |

### Plan BARBERÍA — 2–4 barberos, una sede

| Beneficio | Descripción |
|-----------|-------------|
| Todo lo del plan Solo | Misma base + más capacidades. |
| Varios barberos | Alta/baja de barberos; asignar citas y ventas por barbero. |
| Agenda por barbero | Ver y gestionar la agenda de cada profesional. |
| Reportes por barbero | Ver rendimiento y ventas por cada barbero. |
| Una sede | Un solo local; selector de barbero, no de sede. |
| Control de equipo | Gestionar quién hace qué (citas, ventas). |
| Opcional | Inventario, finanzas, Consola WhatsApp, admin de usuarios según rol. |
| **Ideal para** | Barbería con 2–4 barberos en una sola ubicación. |

### Plan MULTI-SEDE — Varias ubicaciones

| Beneficio | Descripción |
|-----------|-------------|
| Todo lo del plan Barbería | Por sede: barberos, agenda, reportes. |
| Varias sedes | Crear y gestionar múltiples ubicaciones. |
| Selector de sede | Cambiar de sede para ver agenda, barberos y reportes de cada una. |
| Reportes por sede | Comparar rendimiento entre ubicaciones. |
| Administración global | Vista centralizada; control por sede cuando haga falta. |
| Sin límite de sedes ni barberos | Escalable para cadenas. |
| **Ideal para** | Cadenas o negocios con varias barberías. |

---

## Orden de reestructuración: plan por plan

La reestructuración se hace **por fases**, empezando por el **plan básico (Solo)**:

1. **Fase actual: Plan Solo (básico)** — Experiencia simplificada para un barbero, una barbería.
2. **Siguiente: Plan Barbería** — Múltiples barberos en una sede, reportes por barbero.
3. **Después: Plan Multi-Sede** — Varias ubicaciones, administración global.

Cada fase entrega un plan usable antes de pasar al siguiente.

---

## 1. Escenarios de uso a cubrir

| Escenario | Descripción | Plan en el sistema |
|-----------|-------------|--------------------|
| **Solo barbero** | Una persona, un local, sin empleados. | **Plan 1 (Solo)** – Experiencia simplificada: “mi negocio”, sin sedes ni múltiples barberos. |
| **Barbería con equipo o varias sedes** | Varios barberos en un local, o varias ubicaciones (cadena). | **Plan 2 (Barbería)** – Todo lo actual: barberos, una o varias sedes, reportes, administración. |

El **mismo producto** atiende ambos casos con solo **2 planes**; la progresión es de Solo a Barbería cuando el usuario necesite más.

---

## 2. Modelo de planes: solo 2 planes

Definir **dos planes** por tipo de negocio. El **tipo de cuenta** y las **limitaciones** del plan Solo empujan al upgrade cuando el usuario necesite equipo o más ubicaciones.

### 2.1 Plan “Solo” (un barbero, una barbería)

- **A quién va:** Persona que trabaja sola en un solo lugar.
- **Experiencia:**
  - Sin concepto de “sede” en la UI (o una sede implícita).
  - Sin lista de “barberos”: el usuario es el único profesional.
  - Menú reducido: Dashboard, Citas, Clientes, Ventas (POS), Configuración básica (servicios, datos del negocio).
  - Opcional: Inventario simple (productos que vende).
- **Limitaciones que invitan a subir:**
  - No puede añadir “otro barbero” ni “otra sede”.
  - Mensajes tipo: “¿Quieres añadir un barbero o otra ubicación? Pasa al plan Barbería.”
  - Reportes básicos; reportes por barbero o por sede solo en plan Barbería.

### 2.2 Plan “Barbería” (equipo y/o varias sedes)

- **A quién va:** Quien tiene varios barberos en un local, varias barberías (cadena) o planea tenerlo.
- **Experiencia:**
  - Una o varias sedes; selector de sede cuando hay más de una.
  - Lista de barberos por sede: alta/baja, asignar citas y ventas por barbero.
  - Todo lo del plan Solo + Agenda por barbero, reportes por barbero y por sede, Consola WhatsApp, Inventario, Finanzas, Admin Usuarios (según rol), gestión multi-sede si aplica.
- **Sin límite de sedes ni de barberos** dentro de este plan; es el plan completo del sistema.

La progresión es **solo una**: **Solo → Barbería**. El sistema “empuja” a subir cuando el usuario en plan Solo intenta hacer algo que requiere plan Barbería (añadir barbero, añadir sede, ver reportes por barbero, etc.).

---

## 3. Cambios de producto y experiencia (sin código)

### 3.1 Onboarding y tipo de cuenta

- **Al registrarse o al dar de alta un negocio:** Pregunta explícita: “¿Cómo trabajas?”
  - “Solo yo en mi barbería” → plan **Solo**.
  - “Tengo equipo (varios barberos) o varias ubicaciones” → plan **Barbería**.
- El plan determina:
  - Qué pantallas y menús se muestran.
  - Qué límites se aplican (en Solo: un barbero, una sede implícita).
  - Qué mensajes de “sube de plan” se muestran y dónde (solo de Solo → Barbería).

### 3.2 Simplificación para plan “Solo”

- **Ocultar o no crear:**
  - Selector de sede (siempre “mi negocio”).
  - Sección “Barberos” en Configuración (o mostrarla deshabilitada con CTA a subir).
  - Admin Usuarios / gestión de roles (o solo “cambiar mi contraseña / datos”).
- **Simplificar:**
  - Configuración: nombre del negocio, servicios, precios, IVA, moneda. Sin pestaña “Barberos” útil.
  - Citas: no elegir “barbero”; la cita es “conmigo”.
  - Ventas: no elegir barbero; se asocia al único usuario.
  - Reportes: resumen de ventas y citas, sin desglose por barbero.
- **Mensajes de upgrade:** En los lugares donde hoy se elige “barbero” o “sede”, en plan Solo mostrar un bloque: “Para asignar citas a varios barberos, pasa al plan Barbería”.

### 3.3 Transición de plan (solo una: Solo → Barbería)

- **De Solo a Barbería:**
  - Habilitar “Barberos” en Configuración.
  - Crear automáticamente un perfil “Barbero” ligado al usuario actual (para no perder historial).
  - Activar opción “Seleccionar barbero” en Citas y en Ventas.
  - Habilitar reportes por barbero, Inventario/Finanzas completos, y (si aplica) flujo “Nueva sede” para multi-sede.
- **No borrar datos**: solo desbloquear vistas y flujos y crear el perfil barbero por defecto si hace falta.

### 3.4 Dónde “empujar” a subir de plan (Solo → Barbería)

- **Al intentar una acción no permitida en plan Solo:**
  - “Añadir barbero” → modal o pantalla: “Necesitas el plan Barbería para tener varios barberos.”
  - “Añadir sede” o “Nueva ubicación” → “Necesitas el plan Barbería para varias ubicaciones.”
- **En el menú / configuración (plan Solo):**
  - Opción “Barberos” visible pero deshabilitada, con texto: “Plan Barbería”.
  - Opción “Nueva sede” (si se muestra) deshabilitada: “Plan Barbería”.
- **En reportes (plan Solo):**
  - “Por barbero” o “Por sede” no disponibles; mensaje + enlace a plan Barbería.
- **En el dashboard (plan Solo):**
  - Un pequeño bloque “Tu plan: Solo” con enlace “Conocer planes” y un beneficio corto del plan Barbería (ej.: “Añade barberos y varias ubicaciones con el plan Barbería.”).

Solo hay **un upgrade posible**: de Solo a Barbería. En los **puntos de fricción** el sistema explica el valor del plan Barbería y ofrece subir.

---

## 4. Cambios técnicos y de datos (a diseñar después)

- **Modelo de datos:** Mantener sedes y barberos por detrás; para plan Solo, una sede y un barbero “por defecto” asociados al usuario. Así no hay migración traumática al subir a Barbería.
- **Roles y permisos:** Definir qué puede hacer cada rol en cada plan (Solo = un solo rol efectivo; Barbería = admin + barberos, una o varias sedes, como hoy).
- **Facturación / suscripción:** Si hay cobro por plan, definir solo 2 precios (Solo y Barbería) y dónde en la app se muestran (Configuración, pantalla de límite, etc.).

Esto se bajará a tareas técnicas una vez validado el plan de producto.

---

## 5. Fases sugeridas de la reestructuración

| Fase | Enfoque | Entregables |
|------|---------|-------------|
| **1. Definición** | Validar los 3 planes (Solo / Barbería / Multi-Sede), límites y mensajes de upgrade. | Documento de planes, copy de CTAs, flujos de “límite alcanzado”. |
| **2. Experiencia “Solo”** *(empezamos aquí)* | Adaptar UI y flujos para un barbero sin sedes ni lista de barberos. | Menú y pantallas simplificadas, configuración mínima, citas/ventas sin selector de barbero. |
| **3. Límites y upsell** | Implementar comprobaciones de plan y mensajes/CTAs en los puntos acordados. | Comportamiento al intentar “añadir barbero” o “añadir sede” en plan Solo; mensajes y enlace a plan Barbería. |
| **4. Transición de plan** | Flujo para pasar de Solo → Barbería (y después Barbería → Multi-Sede) sin pérdida de datos. | Asistente o pantalla “Subir plan”, creación de perfil barbero por defecto. |
| **5. Onboarding** | Pregunta “¿Cómo trabajas?” y asignación de plan inicial. | Flujo de registro/alta de negocio con 3 opciones (Solo / Barbería / Multi-Sede). |
| **6. Ajustes plan Barbería y Multi-Sede** | Revisar que la experiencia actual (varios barberos, multi-sede) siga intacta. | Ajustes de textos y menús; wizard “Nueva sede” si aplica. |

---

### 5.1 Tareas Fase 1 — Plan Solo (básico) — EN CURSO

Checklist para ejecutar la reestructuración del plan básico:

- [ ] **Modelo de datos:** Una sede implícita y un barbero por defecto asociados al usuario en plan Solo.
- [ ] **Menú plan Solo:** Solo mostrar: Dashboard, Citas, Clientes, Ventas (POS), Configuración básica. Ocultar o deshabilitar: Barberos, Sedes, Admin usuarios (o reducir a “mis datos”).
- [ ] **Configuración:** Nombre del negocio, servicios, precios, IVA, moneda. Sin pestaña Barberos útil.
- [ ] **Citas:** Sin selector de barbero; la cita es “conmigo”.
- [ ] **Ventas (POS):** Sin selector de barbero; se asocia al usuario actual.
- [ ] **Reportes:** Solo resumen global (ventas y citas); sin desglose por barbero ni por sede.
- [ ] **Selector de sede:** No mostrar (siempre “mi negocio”).
- [ ] **Onboarding:** Pregunta “¿Cómo trabajas?” → “Solo yo en mi barbería” asigna plan Solo.
- [ ] **Bloque “Tu plan: Solo”** en dashboard con enlace “Conocer planes” (opcional para Fase 1).

Cuando esta fase esté cerrada, se pasa a **Plan Barbería** y luego **Plan Multi-Sede**.

**Análisis del código actual:** Ver `docs/ESTADO_ACTUAL_CODIGO.md` (menú, citas, ventas, configuración, modelo de datos).

**Estructura técnica de los 3 planes:** Ver `docs/ESTRUCTURA_PLANES_TECNICA.md` (resumen por plan: Solo, Barbería, Multi-Sede; menú, header, reportes por barbero/sede, selector de sede).

---

## 6. Criterios de éxito

- Un **barbero solo** puede usar BarberShow sin sentirse en un sistema “para equipos o cadenas”.
- En los puntos donde el usuario en plan Solo **necesita más** (otro barbero, otra sede), el sistema **explica el plan Barbería** y facilita la subida.
- La **misma base** sirve para los **2 planes** (Solo y Barbería), con cambios de experiencia y límites, no de producto paralelo.
- **Cero pérdida de datos** al pasar de Solo a Barbería; solo se habilitan opciones y se crea el perfil barbero por defecto si aplica.

---

## 7. Próximos pasos

1. Validar con 2–3 barberos solos si el flujo “Solo” y los mensajes de upgrade a Barbería tienen sentido.
2. Fijar nombres comerciales de los **2 planes** (Solo / Barbería o equivalentes) y precios si aplica.
3. Priorizar Fase 2 (experiencia Solo) y Fase 3 (límites y upsell) como primer ciclo de la reestructuración.
4. Bajar cada fase a tareas técnicas (modelo de datos, permisos, pantallas) en un segundo documento o en el backlog.

---

*Documento de plan de reestructuración – BarberShow. Sin implementación en código; solo estrategia y diseño de producto.*
