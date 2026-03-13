# Compilar BarberShow para Android e iPhone

Guía rápida para dejar el proyecto listo y generar builds nativos.

## Requisitos previos

| Plataforma | Necesitas |
|------------|-----------|
| **Android** | Node.js 18+, Android Studio (SDK 35, JDK 17), variables en `variables.gradle` |
| **iOS**     | Mac, Xcode, CocoaPods (`brew install cocoapods`), cuenta Apple Developer (para dispositivo/App Store) |

## 1. Dejar todo listo (una sola vez)

```bash
npm install
npm run build
npx cap sync
```

- **`npm run build:mobile`** hace `build` + `cap sync` (sincroniza Android e iOS a la vez).

## 2. Android

### Desarrollo (emulador o dispositivo)

```bash
npm run android
```

- Genera el build web, sincroniza Android y abre Android Studio.
- En Android Studio: Run (▶) sobre un emulador o dispositivo conectado.

### APK/AAB de release

**En Mac/Linux:**

```bash
npm run android:release
```

- El APK queda en: `android/app/build/outputs/apk/release/app-release-unsigned.apk`
- Para publicar en Play Store suele usarse un AAB firmado (Build → Generate Signed Bundle en Android Studio).

**En Windows:**

```bash
npm run android:release:win
```

- Firmar el APK/AAB en Android Studio (Build → Generate Signed Bundle / APK) con tu keystore.

### Si no ves los últimos cambios

```bash
npm run android:sync
```

Luego vuelve a ejecutar o generar el APK desde Android Studio.

---

## 3. iPhone / iPad (iOS)

### Desarrollo (simulador o dispositivo)

```bash
npm run ios
```

- Genera el build web, sincroniza iOS y abre Xcode.
- Abre siempre **`ios/App/App.xcworkspace`** (no el `.xcodeproj`).
- En Xcode: elige simulador o dispositivo y Run (▶).

### Firma (Signing) en Xcode

1. Proyecto **App** → target **App** → **Signing & Capabilities**.
2. Activa **Automatically manage signing** y elige tu **Team** (cuenta Apple).

### Después de cambiar código web

```bash
npm run ios:sync
```

O todo en uno: `npm run ios` (build + sync + abrir Xcode).

### Build para App Store (release)

1. Sincronizar: `npm run ios:release` (o `npm run ios:sync`).
2. En Xcode: destino **Any iOS Device** → **Product → Archive**.
3. En el Organizer: **Distribute App** → App Store Connect y seguir el asistente.

---

## Scripts útiles

| Script | Qué hace |
|--------|-----------|
| `npm run build:mobile` | Build web + sincroniza Android e iOS |
| `npm run android` | Build + sync Android + abre Android Studio |
| `npm run android:sync` | Build + sync Android (sin abrir) |
| `npm run android:release` | Build + sync + genera APK release (Mac/Linux) |
| `npm run android:release:win` | Igual en Windows |
| `npm run ios` | Build + sync iOS + abre Xcode |
| `npm run ios:sync` | Build + sync iOS (sin abrir) |
| `npm run ios:release` | Build + sync iOS (luego Archive en Xcode) |

---

## Resolución de problemas

- **“android platform has not been added”** → Ejecuta desde la raíz del proyecto; antes haz `npm run build` y `npx cap sync android`. Si sigue fallando, revisa [ANDROID.md](./ANDROID.md).
- **iOS: Pods o firma** → Revisa [IOS_SETUP.md](./IOS_SETUP.md).
- **iOS: “Unicode Normalization not appropriate for ASCII-8BIT”** (fallo en `pod install`) → En la terminal, usa UTF-8. Añade a `~/.zshrc` o `~/.profile`: `export LANG=en_US.UTF-8` y `export LC_ALL=en_US.UTF-8`, luego cierra y abre la terminal y ejecuta de nuevo `npm run ios:sync` o `cd ios/App && pod install`.
- **La app en el dispositivo no se actualiza** → Vuelve a hacer `npm run android:sync` o `npm run ios:sync` y regenera/instala la app.
