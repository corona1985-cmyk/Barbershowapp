# BarberShow en dispositivos Apple (iOS)

Guía para preparar, ejecutar y publicar la app en iPhone/iPad y en la App Store.

## Requisitos

- **Mac** con macOS actualizado.
- **Xcode** (desde App Store). Versión reciente recomendada.
- **CocoaPods:** `brew install cocoapods` (o `sudo gem install cocoapods`).
- **Cuenta Apple Developer** (gratuita para probar en dispositivo; de pago para publicar en App Store).
- **Terminal en UTF-8** (evita errores con CocoaPods). Añade a `~/.zshrc`: `export LANG=en_US.UTF-8` y `export LC_ALL=en_US.UTF-8`.

## Primera vez: instalar y abrir en Xcode

```bash
# En la raíz del proyecto
npm install
npm run ios
```

Esto:

1. Instala dependencias (incluye `@capacitor/ios`).
2. Ejecuta `npm run build` (genera `dist/`).
3. Sincroniza el proyecto nativo con `npx cap sync ios`.
4. Abre `ios/App/App.xcworkspace` en Xcode.

**Importante:** Siempre abre el archivo **`.xcworkspace`**, no el `.xcodeproj`, para que CocoaPods funcione bien.

## Configurar firma (Signing) en Xcode

1. En Xcode, selecciona el proyecto **App** en el navegador izquierdo.
2. Selecciona el target **App**.
3. Pestaña **Signing & Capabilities**.
4. Marca **Automatically manage signing**.
5. Elige tu **Team** (cuenta Apple). Si no aparece, añádela en Xcode → Settings → Accounts.

Para **simulador** no hace falta certificado. Para **dispositivo físico** necesitas un Team (cuenta gratuita o de pago).

## Ejecutar en simulador o dispositivo

- **Simulador:** En la barra superior elige un iPhone/iPad (por ejemplo iPhone 15) y pulsa ▶ (Run).
- **Dispositivo:** Conecta el iPhone/iPad por cable, selecciónalo como destino y pulsa ▶. La primera vez puede que tengas que confiar en el certificado de desarrollo en el dispositivo (Ajustes → General → Gestión de dispositivos).

## Después de cambiar el código web

Cada vez que cambies el frontend (React/Vite), vuelve a sincronizar para que la app iOS use el nuevo build:

```bash
npm run ios:sync
```

O build + sync + abrir Xcode:

```bash
npm run ios
```

## Publicar en la App Store

1. **Apple Developer Program:** Necesitas una cuenta de pago en [developer.apple.com](https://developer.apple.com).
2. **App Store Connect:** Crea una app en [App Store Connect](https://appstoreconnect.apple.com) (nombre, bundle ID `com.barbershow.app`, etc.).
3. **En Xcode:**
   - Elige destino **Any iOS Device** (o un dispositivo genérico).
   - Menú **Product → Archive**.
   - Cuando termine, se abrirá el Organizer. Selecciona el archive y **Distribute App**.
   - Elige **App Store Connect** y sigue los pasos (upload).
4. En App Store Connect, completa ficha de la app (descripción, capturas, privacidad, etc.) y envía a revisión.

## Permisos ya configurados en el proyecto

En `ios/App/App/Info.plist` están definidos:

- **NSCameraUsageDescription:** para el escáner QR de barberías.
- **GADApplicationIdentifier:** ID de AdMob (mismo que en Android).
- **NSUserTrackingUsageDescription:** para anuncios personalizados (ATT).
- **SKAdNetworkItems:** para que AdMob funcione correctamente en iOS.

## AdMob en iOS

- El **App ID** de AdMob para iOS está en `Info.plist` (`GADApplicationIdentifier`). Si creas una app iOS en la consola de AdMob, puedes usar ese ID.
- La verificación **app-ads.txt** es la misma que en Android: el dominio que uses en la ficha de la app en App Store Connect debe ser el mismo donde esté desplegado `app-ads.txt` (por ejemplo tu sitio en Firebase Hosting). Ver sección 7 de [DEPLOY.md](DEPLOY.md).

## App Tracking Transparency (ATT)

La app usa **Capacitor + React** con `@capacitor-community/admob`. El flujo ATT está en:

| Archivo | Función |
|---------|---------|
| `services/att.ts` | Lógica del popup ATT (`ensureAppTrackingAuthorization`) |
| `App.tsx` | **Dispara ATT al arrancar en iOS** (tras cargar la sesión), aunque no se muestren anuncios |
| `services/adMob.ts` | ATT → UMP (GDPR) → `AdMob.initialize()` → banner (solo si se usan anuncios) |
| `components/AdMobBanner.tsx` | En nativo no carga anuncios (Guideline 2.1) |
| `ios/App/App/Info.plist` | `NSUserTrackingUsageDescription` (obligatorio) |

**Importante:** el plugin `@capacitor-community/admob` enlaza el framework `AppTrackingTransparency` en el proyecto iOS. Apple exige que, si el framework está enlazado, la app **muestre** el diálogo ATT. Por eso `App.tsx` solicita ATT al arrancar en iOS, independientemente de si el banner nativo está activo. Sin esto, App Review rechaza la app con *"we couldn't find the App Tracking Transparency permission request"*.

**Orden en iOS:** popup ATT (al arrancar) → consentimiento UMP (si aplica) → inicializar AdMob → cargar banner (si se usan anuncios).

### Probar ATT en dispositivo real

El simulador a veces no muestra el diálogo ATT de forma fiable. Usa un **iPhone físico** con iOS 14+:

1. **Restablecer permiso ATT** (para ver el popup otra vez):
   - Ajustes → Privacidad y seguridad → Rastreo → activar **Permitir que las apps soliciten rastreo**.
   - Borra la app BarberShow del dispositivo o: Ajustes → BarberShow → (si aparece) restablecer permisos.
   - Alternativa: Ajustes → Privacidad → Rastreo → desactivar BarberShow y reinstalar la app.

2. **Build y ejecutar:**
   ```bash
   npm run ios
   ```
   En Xcode, elige tu iPhone y pulsa Run.

3. **Cuándo aparece el popup:** poco después de abrir la app (al terminar de cargar la sesión), porque `App.tsx` solicita ATT al arrancar en iOS. No depende de entrar en ninguna pantalla concreta ni de que se muestren anuncios.

4. **Logs en Xcode:** filtra por `[ATT]` o `[AdMob]` en la consola.

### Errores frecuentes de App Store Review

| Rechazo | Causa | Solución en este proyecto |
|---------|--------|---------------------------|
| *permission request not found* | Framework ATT enlazado pero nunca se llama `requestTrackingAuthorization` (p. ej. al desactivar anuncios nativos se perdió el único disparador) | `App.tsx` llama `ensureAppTrackingAuthorization()` al arrancar en iOS, independientemente de los anuncios |
| Falta descripción de uso | Sin `NSUserTrackingUsageDescription` | Ya en `Info.plist` |
| Anuncios antes de ATT | `GADMobileAds.start()` antes del popup | `initAdMob()` espera ATT en iOS |
| Rastreo global desactivado | Usuario tiene desactivado “Permitir que las apps soliciten rastreo” | El popup no aparece; la app sigue con anuncios no personalizados (`npa`) |

**Nota para revisión:** En App Store Connect → Información de la app → Privacidad, declara que la app recopila datos para publicidad y que usas el identificador con fines de seguimiento, coherente con ATT.

## Comandos útiles

| Comando           | Descripción                          |
|-------------------|--------------------------------------|
| `npm run ios`     | Build + sync + abrir Xcode           |
| `npm run ios:sync`| Build + sync (sin abrir Xcode)       |
| `npm run ios:open`| Solo abrir Xcode en el proyecto iOS  |

## Problemas frecuentes

- **“No such module 'Capacitor'”:** Ejecuta en `ios/App`: `pod install`. Luego abre de nuevo el `.xcworkspace`.
- **Firma / provisioning:** Asegúrate de tener un Team válido en Signing & Capabilities y de que el bundle ID coincida con el de App Store Connect si vas a subir.
- **Cámara no funciona en simulador:** El escáner QR usa cámara real; pruébalo en dispositivo o en un simulador con cámara simulada si está disponible.
