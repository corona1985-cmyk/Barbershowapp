 # Análisis: Error "Algo salió mal" al entrar sin sesión

## 1. Hipótesis inicial (ordenadas por probabilidad)

1. **Variable usada antes de declararse en `GuestBookingView`**  
   En `GuestBookingView.tsx`, el `useEffect` que carga la galería del barbero usa `defaultBarberId` en el cuerpo y en el array de dependencias, pero `defaultBarberId` se declara más abajo en el mismo componente. Al evaluar el efecto, `defaultBarberId` sigue en la “temporal dead zone” y se produce un `ReferenceError`, que el ErrorBoundary captura y muestra como "Algo salió mal".

2. **`currentUser` en localStorage inválido o corrupto**  
   Si en `localStorage` hay un valor como la cadena `"null"`, `!user` es falso y se hace `userData = JSON.parse("null")` → `null`. Luego `userData.role` lanza `TypeError`. Ese error está dentro de un `try/catch` en el efecto de sesión, por lo que no debería llegar al ErrorBoundary; solo sería causa raíz si el `catch` no cubriera bien en algún entorno.

3. **Excepción en plugin nativo (p. ej. Play Billing) al montar**  
   En Android, si algo en `initPlayBilling()` o en el plugin de suscripciones lanzara de forma síncrona durante el montaje, podría provocar el fallo. El código actual está envuelto en try/catch y no se llama en el render, por lo que es menos probable.

## 2. Análisis línea por línea (causa más probable)

**Archivo: `components/GuestBookingView.tsx`**

- **Líneas 48–52**: Segundo `useEffect` que usa `defaultBarberId`:
  - En el cuerpo: `const bid = selectedBarberId || defaultBarberId;`
  - En las dependencias: `[selectedBarberId, defaultBarberId]`
- **Líneas 58–59**: Declaración de `activeBarbers` y `defaultBarberId`:
  - `const activeBarbers = barbers.filter((b) => b.active);`
  - `const defaultBarberId = activeBarbers.length > 0 ? activeBarbers[0].id : 0;`

En cada render, React recorre el cuerpo del componente en orden. Al llegar al segundo `useEffect`, se registra el efecto y se evalúa el array de dependencias. En ese momento aún no se ha ejecutado la línea 59, por lo que `defaultBarberId` está en la temporal dead zone; leerlo lanza **ReferenceError**. Ese error ocurre durante el render/montaje, así que el ErrorBoundary lo captura y muestra "Algo salió mal".

**Cuándo se monta `GuestBookingView`:** cuando no hay sesión y hay `guestBookingPos` (por ejemplo, el usuario entra con `?ref_pos=...` y la barbería existe). En ese flujo, en lugar de mostrarse el menú “barbero o cliente”, se intenta mostrar la vista de reserva invitado y al montar `GuestBookingView` se produce el fallo.

## 3. Causa raíz

**Causa:** Uso de `defaultBarberId` en un `useEffect` (cuerpo y dependencias) cuando su declaración está más abajo en el mismo componente.

**Por qué provoca el comportamiento:**  
En JavaScript, las variables `const`/`let` existen desde el inicio del bloque pero no se pueden leer hasta su declaración (TDZ). Al evaluar las dependencias del efecto, el motor encuentra `defaultBarberId` y al leerlo lanza `ReferenceError`. Ese error ocurre en la fase de render/commit de React, por lo que el ErrorBoundary lo atrapa y muestra la pantalla "Algo salió mal" en lugar del menú de elegir barbero o cliente (o la vista de reserva invitado).

## 4. Solución (código corregido)

Se declara `activeBarbers` y `defaultBarberId` **antes** del `useEffect` que los usa.

**Cambio en `GuestBookingView.tsx`:**

- Mover la definición de `activeBarbers` y `defaultBarberId` para que estén **por encima** del segundo `useEffect` (p. ej. justo después del primer `useEffect` y antes del segundo).

## 5. Prevención

- **Orden de declaraciones:** En componentes funcionales, declarar primero todas las variables derivadas (como `activeBarbers`, `defaultBarberId`) que se usen en hooks o en el JSX, y después los `useEffect` que dependan de ellas.
- **Regla de lint:** Habilitar una regla que detecte uso de variables antes de declarar (p. ej. `@typescript-eslint/no-use-before-define` con opciones que no impidan funciones).
- **Tests de integración:** Añadir un test que abra la app sin sesión (y opcionalmente con `ref_pos` válido) y compruebe que se muestra el menú de bienvenida o la vista de reserva invitado, sin pantalla de error.
