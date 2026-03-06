# Guía para desplegar BarberShow en Firebase

Este proyecto usa **Firebase Hosting** (web), **Realtime Database** (datos) y **Cloud Functions** (WhatsApp/Twilio, auth Master).

## Requisitos

- Node.js 18+
- Cuenta en [Firebase](https://console.firebase.google.com)
- Proyecto Firebase ya creado (el que está en `services/firebase.ts` y `.firebaserc`)

## 1. Instalar dependencias

```bash
npm install
cd functions && npm install && cd ..
```

## 2. Iniciar sesión en Firebase

```bash
npm run firebase:login
```

O directamente:

```bash
npx firebase login
```

Si ya tienes sesión y quieres usar otro proyecto:

```bash
npx firebase use <tu-project-id>
```

## 3. Desplegar todo (recomendado la primera vez)

Construye la app (Vite) y despliega Hosting, Database rules y Functions:

```bash
npm run deploy
```

Esto hace:

1. `npm run build` → genera la carpeta `dist/`
2. `firebase deploy` → sube `dist/` a Hosting, las reglas a Database y el código a Functions

## 4. Desplegar solo una parte

- **Solo la web (Hosting):**  
  `npm run deploy:hosting`  
  (útil después de cambiar solo el frontend)

- **Solo reglas de base de datos:**  
  `npm run deploy:db`  
  (después de editar `database.rules.json`)

- **Solo Cloud Functions:**  
  `npm run deploy:functions`  
  (después de cambiar `functions/src/`)

## 5. URLs después del deploy

- **App web:**  
  `https://gen-lang-client-0624135070.web.app`  
  (o el dominio que tengas en Hosting)

### Cambiar la URL o usar un desvío (redirección)

- **Otra URL (dominio propio):** En [Firebase Console](https://console.firebase.google.com) → **Hosting** → **Añadir dominio personalizado**. Así podrás usar por ejemplo `https://barbershow.com` en lugar de la URL `.web.app`.

- **Desvío (redirigir la URL de Firebase a tu dominio):** Cuando ya tengas un dominio personalizado configurado, puedes hacer que quien entre en `https://....web.app` sea redirigido a tu dominio. En `firebase.json`, dentro de `"hosting"`, añade:
  ```json
  "redirects": [
    {
      "source": "**",
      "destination": "https://tu-dominio-real.com",
      "type": 301
    }
  ]
  ```
  Sustituye `https://tu-dominio-real.com` por tu URL. Vuelve a desplegar con `npm run deploy:hosting`.

- **Consola Firebase:**  
  [https://console.firebase.google.com/project/gen-lang-client-0624135070](https://console.firebase.google.com/project/gen-lang-client-0624135070)

## 6. Variables de entorno / configuración

- La **configuración de Firebase** (apiKey, projectId, etc.) está en `services/firebase.ts`. Para otro proyecto, cambia ahí y en `.firebaserc` el `default` al nuevo project id.
- **Twilio** (envío de WhatsApp desde la app): configurar en Cloud Functions con  
  `firebase functions:config:set twilio.sid="ACxxx" twilio.token="xxx" twilio.whatsapp_from="whatsapp:+14..."`  
  y volver a desplegar Functions.
- **QR de barbería:** Los códigos QR que se imprimen en Configuración deben apuntar a la URL pública de la app. Crea un archivo `.env` o `.env.production` en la raíz con:
  ```bash
  VITE_APP_PUBLIC_URL=https://gen-lang-client-0624135070.web.app
  ```
  (o la URL de tu dominio si usas uno). Sin esta variable, los QR usan la URL desde la que se abre la app (por ejemplo localhost), y al escanear no funcionan. Después de añadirla, haz de nuevo `npm run build` y `npm run deploy:hosting`.

## 7. Verificación AdMob (app-ads.txt)

Para que Google AdMob pueda verificar **Barbershow (Android)** y mostrar anuncios sin el aviso "No hemos podido verificar":

1. **Archivo en el proyecto:** El archivo `public/app-ads.txt` contiene la línea que AdMob indica. Se copia a la raíz del sitio al hacer `npm run build` (queda en `dist/app-ads.txt`).

2. **Que se sirva en la web:** En `firebase.json` hay reglas de rewrite para que `/app-ads.txt` y `/ads.txt` se sirvan como archivos y no redirijan a `index.html`. Tras desplegar Hosting, la URL debe ser accesible, por ejemplo:
   - `https://gen-lang-client-0624135070.web.app/app-ads.txt`
   - o `https://barbershow.net/app-ads.txt` si tienes dominio personalizado.

3. **Dominio en Google Play:** En Play Console, la **URL del sitio web del desarrollador** de la app debe ser **el mismo dominio** donde está desplegada la web (por ejemplo `https://barbershow.net`). Así AdMob puede encontrar el archivo.

4. **Comprobar y esperar:** Abre en el navegador la URL de tu sitio + `/app-ads.txt` y verifica que se vea la línea `google.com, pub-6169287781659857, DIRECT, f08c47fec0942fa0`. La verificación en AdMob puede tardar un tiempo en actualizarse.

## Resumen de comandos

| Comando              | Acción                          |
|----------------------|----------------------------------|
| `npm run deploy`      | Build + desplegar todo          |
| `npm run deploy:hosting` | Build + solo Hosting        |
| `npm run deploy:db`  | Solo reglas de Database         |
| `npm run deploy:functions` | Solo Cloud Functions     |
| `npm run firebase:login` | Iniciar sesión en Firebase  |
