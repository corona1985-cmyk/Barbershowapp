# BarberShow en Android

La app web está empaquetada para Android con **Capacitor**. El proyecto Android está en la carpeta `android/`.

## Requisitos

- **Node.js 18+** (para construir la web)
- **Android Studio** (Arctic Fox o más reciente recomendado)
- **JDK 17** (Android Studio suele traerlo)
- Opcional: dispositivo físico con depuración USB o emulador

## Flujo rápido: construir y abrir en Android Studio

```bash
# 1. Instalar dependencias (si no lo has hecho)
npm install

# 2. Construir, sincronizar y abrir Android Studio (todo en uno)
npm run android
```

En Android Studio: elige un emulador o conecta un dispositivo y pulsa **Run** (▶).

## Si no ves tus cambios en Android Studio

**Android Studio no usa tu código web en vivo.** La app que corre en el emulador/dispositivo es una **copia** de lo que hay en `dist/`. Cada vez que cambies algo en el proyecto (React, TS, CSS, etc.):

1. En la **raíz del proyecto** (donde está `package.json`), ejecuta:
   ```bash
   npm run android:sync
   ```
   Eso hace **build** y copia el resultado al proyecto Android.

2. En **Android Studio**, vuelve a lanzar la app: **Run** (▶).  
   Si sigue saliendo la versión antigua: **Build → Clean Project**, luego **Run** de nuevo.

**Resumen:** Cambios en el código → `npm run android:sync` → Run en Android Studio.

## QR de barbería en Android

En la app Android, la pantalla **Configuración → Código QR** usa la misma lógica que la web. Dentro del WebView de Capacitor la “URL actual” no es la de tu app en internet, así que **los QR deben usar la URL pública del despliegue**.

Antes de construir la app para Android, crea en la raíz del proyecto un `.env` o `.env.production` con:

```bash
VITE_APP_PUBLIC_URL=https://gen-lang-client-0624135070.web.app
```

(sustituye por tu URL real o por tu dominio si usas uno). Luego haz el build y sync como siempre:

```bash
npm run android:sync
```

Así, cuando un barbero abra la app en el móvil y genere o imprima el QR, el código apuntará a esa URL y al escanear se abrirá la app web correcta.

## Comandos disponibles

| Comando | Descripción |
|--------|--------------|
| `npm run android` | Build + sync + abre Android Studio |
| `npm run build` | Solo construye la web en `dist/` |
| `npm run android:sync` | Build + copia `dist/` al proyecto Android (Capacitor sync) |
| `npm run android:open` | Abre el proyecto `android/` en Android Studio |

## Generar APK para instalar o publicar

1. Abre el proyecto en Android Studio (`npm run android:open`).
2. **Build → Build Bundle(s) / APK(s) → Build APK(s)** para un APK de debug o de release (según la variante que tengas seleccionada).
3. Para **release** (Play Store o distribución):
   - **Build → Generate Signed Bundle / APK** → elige **Android App Bundle** (.aab) para Play Store o **APK** para instalar a mano.
   - Necesitas un keystore (crear uno si es la primera vez).

## Probar en dispositivo real

1. Activa **Opciones de desarrollador** y **Depuración USB** en el móvil.
2. Conéctalo por USB.
3. En Android Studio, selecciona el dispositivo en la barra superior y pulsa **Run**.

## Probar la web en el móvil (sin compilar Android)

Para probar la misma URL que verá la app (útil para depurar):

1. En `capacitor.config.ts` descomenta y pon tu IP local:
   ```ts
   server: {
     url: 'http://192.168.1.XXX:3000',
     cleartext: true
   },
   ```
2. En la raíz del proyecto: `npm run dev`.
3. Ejecuta `npm run android:sync` y `npm run android:open`; al lanzar la app en el dispositivo, cargará desde tu PC.

Cuando termines de depurar, **vuelve a comentar** el bloque `server` en `capacitor.config.ts` y haz de nuevo `npm run android:sync`.

## Estructura

- **`capacitor.config.ts`**: nombre de la app, `webDir` (`dist`), opciones Android.
- **`android/`**: proyecto Android (Android Studio); no edites a mano los archivos generados por Capacitor.
- **`dist/`**: salida del build web; Capacitor copia este contenido al APK.

## Identidad de la app

- **Package / Application ID:** `com.barbershow.app`
- **Nombre visible:** BarberShow (en `android/app/src/main/res/values/strings.xml`).

Para cambiar el package en el futuro: además de `capacitor.config.ts` (`appId`), hay que actualizar `applicationId` y `namespace` en `android/app/build.gradle` y el package en `MainActivity.java` y en la estructura de carpetas bajo `android/app/src/main/java/`.
