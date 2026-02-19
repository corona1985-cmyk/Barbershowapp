# Datos iniciales en la base de datos

Las sedes, barberos y configuración **no** vienen en el código; se gestionan desde la base de datos.

## Importar sedes y barberos por defecto

El archivo `database-seed.json` contiene dos sedes de ejemplo y dos barberos. Para cargarlos en Firebase:

1. Abre la [consola de Firebase](https://console.firebase.google.com) → tu proyecto → **Realtime Database**.
2. En la raíz de la base de datos debe existir el nodo `barbershow` (la app lo crea al iniciar si está vacío).
3. **Opción A – Importar bajo `barbershow`:**  
   Menú (⋮) → **Importar JSON**. Selecciona `database-seed.json`. Al importar en la **raíz** del Realtime Database, Firebase pide reemplazar todo; **no** uses eso. En su lugar:
   - Expande el nodo `barbershow`.
   - Crea o edita manualmente los nodos `pointsOfSale`, `barbers` y `settings` y pega el contenido correspondiente de `database-seed.json` (cada objeto con clave numérica: `1`, `2`, etc.).

4. **Opción B – Reemplazar solo `barbershow`:**  
   Si la base está vacía o quieres reemplazar todo lo que hay bajo `barbershow`, construye un JSON con esta forma y impórtalo como raíz (o bajo el nodo que corresponda):
   ```json
   { "barbershow": <contenido completo de database-seed.json> }
   ```

Tras importar tendrás:
- **Sedes:** Corte & Estilo (id 1), La Barba (id 2), con plan **pro** y tier **barberia**.
- **Barberos:** Carlos Rodríguez (sede 1), Ana Martínez (sede 2).
- **Configuración:** `settings/1` y `settings/2` con nombre de tienda e impuestos.

Los usuarios **master** y **superadmin** se crean desde el código al iniciar la app (si no existen). El resto de usuarios (barberos, clientes) se crean desde la app en **Sedes Globales** / **Administración de usuarios**.
