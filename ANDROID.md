# BarberShow – Build para Android

Guía para generar y ejecutar la app en Android con Capacitor.

## Requisitos

- **Node.js** v18+
- **Android Studio** (Arctic Fox o superior) con:
  - Android SDK (API 35 recomendado; el proyecto usa `compileSdkVersion` y `targetSdkVersion` 35)
  - JDK 17
- **Variables de entorno** (opcional): `.env` o `.env.local` si usas API keys en la app

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

## Comandos útiles

| Comando | Descripción |
|--------|-------------|
| `npm run android` | Build web + sync + abrir Android Studio |
| `npm run android:sync` | Solo build web + sync (sin abrir IDE) |
| `npm run android:open` | Solo abrir el proyecto en Android Studio |

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
