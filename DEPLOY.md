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

- **Consola Firebase:**  
  [https://console.firebase.google.com/project/gen-lang-client-0624135070](https://console.firebase.google.com/project/gen-lang-client-0624135070)

## 6. Variables de entorno / configuración

- La **configuración de Firebase** (apiKey, projectId, etc.) está en `services/firebase.ts`. Para otro proyecto, cambia ahí y en `.firebaserc` el `default` al nuevo project id.
- **Twilio** (envío de WhatsApp desde la app): configurar en Cloud Functions con  
  `firebase functions:config:set twilio.sid="ACxxx" twilio.token="xxx" twilio.whatsapp_from="whatsapp:+14..."`  
  y volver a desplegar Functions.

## Resumen de comandos

| Comando              | Acción                          |
|----------------------|----------------------------------|
| `npm run deploy`      | Build + desplegar todo          |
| `npm run deploy:hosting` | Build + solo Hosting        |
| `npm run deploy:db`  | Solo reglas de Database         |
| `npm run deploy:functions` | Solo Cloud Functions     |
| `npm run firebase:login` | Iniciar sesión en Firebase  |
