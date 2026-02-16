# BarberShow – App Android y Google Play

El proyecto ya está configurado con **Capacitor** para generar la app Android a partir de la web.

## Requisitos en tu PC

1. **Android Studio**  
   Descarga: https://developer.android.com/studio  
   Instala con **Android SDK** y **Android SDK Platform** (el instalador los ofrece por defecto).

2. **Variables de entorno (recomendado)**  
   Añade al PATH:
   - `ANDROID_HOME` = carpeta del SDK (ej. `C:\Users\TuUsuario\AppData\Local\Android\Sdk`)
   - `%ANDROID_HOME%\platform-tools` y `%ANDROID_HOME%\tools` en el PATH

## Comandos útiles

| Comando | Qué hace |
|--------|----------|
| `npm run android:sync` | Construye la web (`npm run build`) y copia todo a `android/` (ejecuta esto cada vez que cambies el front). |
| `npm run android:open` | Abre el proyecto Android en Android Studio. |

## Flujo para generar el AAB (Google Play)

1. **Actualizar la web en la app**
   ```bash
   npm run android:sync
   ```

2. **Abrir en Android Studio**
   ```bash
   npm run android:open
   ```

3. **En Android Studio**
   - Espera a que Gradle termine de sincronizar (barra de progreso abajo).
   - Menú **Build → Generate Signed Bundle / APK**.
   - Elige **Android App Bundle** (recomendado para Play Store).
   - Crea o selecciona un **keystore** (guarda la contraseña y el archivo .jks o .keystore; los necesitarás para todas las actualizaciones).
   - Elige **release** y termina el asistente.
   - El AAB se generará en `android/app/release/app-release.aab`.

4. **Subir a Google Play**
   - Entra en https://play.google.com/console (cuenta de desarrollador, pago único ~25 USD).
   - Crea una nueva app o selecciona la existente.
   - En **Producción** (o Prueba interna/cerrada) → **Crear nueva versión**.
   - Sube el archivo `app-release.aab`.
   - Completa la ficha (descripción, capturas, ícono, política de privacidad, clasificación de contenido).
   - Envía para revisión.

## Configuración del proyecto

- **ID de la app (package):** `com.barbershow.app`  
  Definido en `capacitor.config.ts` y en `android/app/build.gradle`. Para cambiarlo, edita ambos y vuelve a sincronizar si hace falta.

- **Nombre en el dispositivo:** BarberShow  
  Definido en `capacitor.config.ts` → `appName`.

- **Carpeta web:** `dist/`  
  Vite genera ahí el build; Capacitor copia su contenido a `android/app/src/main/assets/public`.

## Probar en dispositivo o emulador

- **Emulador:** En Android Studio, **Tools → Device Manager**, crea un dispositivo y ejecuta la app con el botón Run (triángulo verde).
- **Dispositivo físico:** Activa **Opciones de desarrollador** y **Depuración USB**, conecta el móvil, y en Android Studio elige el dispositivo y Run.

## Nota sobre Node

El proyecto usa **Capacitor 6** para ser compatible con Node 18–21. Si actualizas a **Node 22+**, puedes pasar a Capacitor 8:

```bash
npm install @capacitor/core@8 @capacitor/cli@8 @capacitor/android@8
```

Luego vuelve a ejecutar `npx cap sync android` por si hubiera cambios de estructura.
