# BarberShow – Build para Android

Guía para generar y ejecutar la app en Android con Capacitor.

## Implementación lista para Android

- **Capacitor 6** con `@capacitor/android`, `@capacitor/splash-screen`, `@squareetlabs/capacitor-subscriptions`
- **Icono y splash**: logo en `drawable/ic_launcher_foreground.jpg` y splash nativo que se oculta al cargar la app
- **Permisos**: INTERNET, CAMERA (opcional)
- **Red**: `network_security_config.xml` permite cleartext para desarrollo con `server.url`
- **Scripts**: `android`, `android:sync`, `android:open`, `android:release`

## Requisitos

- **Node.js** v18+
- **Android Studio** (Arctic Fox o superior) con:
  - Android SDK (API 35 recomendado; el proyecto usa `compileSdkVersion` y `targetSdkVersion` 35)
  - JDK 17
- **Variables de entorno** (opcional): `.env` o `.env.local` si usas API keys en la app

## Error: "android platform has not been added yet"

Si ves este mensaje:

1. **Ejecuta siempre desde la raíz del proyecto** (donde está `package.json` y `capacitor.config.ts`):
   ```bash
   cd C:\Users\yendr\Documents\GitHub\Barbershowapp
   ```
2. **Genera primero el build web** (Capacitor copia la carpeta `dist` a Android):
   ```bash
   npm run build
   ```
3. **Sincroniza la plataforma Android**:
   ```bash
   npx cap sync android
   ```
4. Para abrir Android Studio: `npx cap open android`.

Si el error sigue y la carpeta `android` existe pero está dañada o desactualizada, puedes volver a añadir la plataforma (**backupea** `android/app/src/main/AndroidManifest.xml`, `android/app/build.gradle`, `android/variables.gradle` y `android/app/src/main/res/values/strings.xml` antes):
   ```bash
   rmdir /s /q android
   npx cap add android
   ```
   Luego restaura los archivos que modificaste (AdMob, permisos, etc.).

## Pasos rápidos

### 1. Instalar dependencias

```bash
npm install
```

### 2. Build web y sincronizar con Android

```bash
npm run android
```

Este comando hace:

1. `npm run build` (Vite → `dist/`)
2. `npx cap sync android` (copia `dist/` al proyecto Android y actualiza plugins)
3. `npx cap open android` (abre Android Studio)

### 3. En Android Studio

- Espera a que Gradle termine de sincronizar.
- Conecta un dispositivo o inicia un emulador.
- Pulsa **Run** (▶) para instalar y ejecutar la app.

## Si los cambios no se ven en Android (plan gratuito, límite de citas, servicios opcionales)

La app en Android carga el código web desde los archivos empaquetados en el APK. Si has actualizado el código pero **no ves** el contador de citas (X / 100), los servicios opcionales en plan gratuito o el límite de 100 citas/mes, la app está usando una **versión antigua** del bundle. Haz lo siguiente:

1. **Reconstruir y sincronizar** (en la raíz del proyecto):
   ```bash
   npm run android:sync
   ```
   Esto hace `npm run build` y copia el nuevo `dist/` al proyecto Android.

2. **En Android Studio**: **Build → Clean Project**, luego **Run** (▶) para instalar de nuevo en el dispositivo/emulador.

3. **Comprobar versión**: En la pantalla de login (o bienvenida) debe aparecer **v1.0.6** debajo de "Sistema Multi-Sede". Si no aparece o ves una versión anterior, repite el paso 1 y vuelve a instalar la app (o desinstálala del dispositivo e instala de nuevo).

4. **Plan gratuito**: Para que apliquen el límite de 100 citas y los servicios opcionales, la sede debe tener **plan Gratuito**. En **Admin POS** o **Master Dashboard** asigna el plan "Gratuito" a la sede con la que inicias sesión.

## Comandos útiles

| Comando | Descripción |
|--------|-------------|
| `npm run android` | Build web + sync + abrir Android Studio |
| `npm run android:sync` | Solo build web + sync (sin abrir IDE) |
| `npm run android:open` | Solo abrir el proyecto en Android Studio |
| `npm run android:release` | Build web + sync + APK release (sin firma; para firma usar Android Studio) |

## Permisos en la app

- **INTERNET**: necesario para Firebase y APIs.
- **CAMERA**: para el escáner QR (registro / ref_pos). El hardware de cámara se declara como no obligatorio (`required="false"`) para que la app se pueda instalar en dispositivos sin cámara.

## Desarrollo en dispositivo real (live reload)

1. En `capacitor.config.ts`, descomenta y ajusta:

   ```ts
   server: {
     url: 'http://TU_IP_LOCAL:3000',
     cleartext: true
   }
   ```

2. Ejecuta en la PC:

   ```bash
   npm run dev
   ```

3. Sincroniza y abre Android:

   ```bash
   npm run android:sync
   npm run android:open
   ```

4. En Android Studio, ejecuta la app. La WebView cargará desde tu IP y verás los cambios al recargar.

No olvides volver a comentar `server.url` y `cleartext` para builds de producción.

## Generar APK o AAB (release)

1. En Android Studio: **Build → Generate Signed Bundle / APK**.
2. Elige **Android App Bundle** (.aab) para subir a Google Play o **APK** para instalación directa.
3. Crea o selecciona un keystore y completa el formulario.
4. El build de release se genera en `android/app/build/outputs/`.

Para compilar por línea de comandos (después de configurar la firma en `android/app/build.gradle`):

```bash
cd android
./gradlew assembleRelease
# APK en: app/build/outputs/apk/release/
```

## Versión de la app

La versión se define en `android/app/build.gradle`:

- `versionCode`: entero que debe aumentar en cada subida a Play Store.
- `versionName`: string visible para el usuario (ej. `"1.0.5"`).

## Firebase y Google Play

- Si usas **Google Sign-In** o **Firebase Cloud Messaging**, coloca `google-services.json` en `android/app/`.
- Las suscripciones con **Google Play Billing** usan el plugin `@squareetlabs/capacitor-subscriptions`; los product IDs se definen en `services/playBilling.ts`.

## Solución de problemas

- **"SDK location not found"**: Crea `android/local.properties` con `sdk.dir=C\:\\Users\\TU_USUARIO\\AppData\\Local\\Android\\Sdk` (o la ruta de tu SDK).
- **WebView en blanco**: Asegúrate de haber ejecutado `npm run build` y luego `npx cap sync android` antes de ejecutar en el dispositivo/emulador.
- **Cámara no abre**: Comprueba que el permiso CAMERA esté en `AndroidManifest.xml` y que en Ajustes del dispositivo la app tenga permiso de cámara.
