Objetivo general:
Implementar soporte multilenguaje (i18n) en BarberShow para que la aplicación pueda adaptarse a diferentes idiomas y regiones, manteniendo una base de código única y sincronizada entre plataformas (iOS, Android, y posiblemente web/backend).

Alcance y plataformas objetivo:

iOS (Swift / UIKit / SwiftUI)

Android (Kotlin / Jetpack Compose o XML)

Backend / API (para mensajes de error, notificaciones y correos)

Opcional: Panel web administrativo si existe

Requisitos funcionales y de negocio:

1. Idiomas soportados (iniciales)
Definir un conjunto inicial de idiomas, por ejemplo:

Español (es)

Inglés (en)

Portugués (pt)

(Añadir otros según mercado objetivo)

La selección debe basarse en:

Ubicación geográfica de los clientes actuales.

Mercados a los que se planea expandir BarberShow.

2. Detección de idioma
La app debe detectar automáticamente el idioma del dispositivo al primer inicio.

Permitir al usuario cambiar manualmente el idioma desde la configuración de la app, independientemente del idioma del sistema.

Guardar la preferencia del usuario en almacenamiento local (UserDefaults / SharedPreferences) y persistir entre sesiones.

3. Estructura de archivos de traducción
Definir un estándar para todos los archivos de recursos:

iOS: Archivos .strings y/o .xcstrings (nuevo formato de Apple).

Android: Archivos strings.xml en carpetas values-xx.

Backend / Web: Archivos .json (ej. es.json, en.json, pt.json) para mensajes dinámicos.

Mantener una convención de nomenclatura única para todas las claves (ej. home_title, login_button, error_network).

4. Gestión centralizada de traducciones
Crear un repositorio único (ej. carpeta /locales en el proyecto) donde se almacenen todas las traducciones en formato JSON.

Desde este repositorio, generar automáticamente los archivos nativos para cada plataforma mediante scripts.

Usar herramientas como:

Crowdin o POEditor para gestión colaborativa de traducciones.

Fastlane o scripts en Node.js/Python para sincronizar archivos entre plataformas.

5. Variables y plurales
Soportar:

Variables dinámicas en textos (ej. "Bienvenido, {nombre}").

Pluralización correcta según el idioma (ej. "1 cliente" vs "2 clientes").

Género si es necesario (ej. "asignado" vs "asignada" en español).

6. Fechas, números y monedas (formato regional)
Utilizar el Locale del usuario para formatear:

Fechas (dd/mm/yyyy vs mm/dd/yyyy).

Horas (formato 12h vs 24h).

Números (separador de miles y decimales).

Monedas (símbolo y posición).

No asumir un formato fijo; delegar en las librerías nativas de cada plataforma.

7. Mensajes del backend y notificaciones
El backend debe enviar mensajes traducidos o enviar códigos de clave para que la app los traduzca localmente.

Para notificaciones push, enviar el locale del usuario o enviar múltiples versiones del mensaje.

Correos electrónicos y SMS deben usar plantillas multilenguaje.

8. Flujo de trabajo para nuevos textos
Establecer un proceso claro:

Un diseñador/producto añade un nuevo texto al diseño.

El desarrollador agrega la clave al archivo base (ej. en inglés).

Se sube a la herramienta de gestión (Crowdin/POEditor).

Los traductores añaden las versiones en otros idiomas.

Se sincronizan los archivos con el repositorio.

Se genera el build con las nuevas traducciones.

9. Pruebas y validación
Probar la app en todos los idiomas soportados.

Verificar que no haya textos hardcodeados en el código.

Comprobar que los textos largos no se salgan de los contenedores UI (diseño adaptable).

Validar que fechas, números y monedas se muestren correctamente en cada región.

10. Consideraciones para App Store / Play Store
Actualizar la descripción de la app en cada idioma soportado.

Incluir capturas de pantalla localizadas para mejorar el ASO (App Store Optimization).

Indicar en la ficha de la app los idiomas disponibles.

11. Mantenimiento y evolución
Definir quién es el responsable de gestionar las traducciones.

Establecer una frecuencia de revisión (ej. cada sprint) para actualizar textos nuevos.

Documentar el proceso para nuevos desarrolladores que se incorporen al equipo.

Entregables esperados:

Estructura de carpetas definida para cada plataforma.

Archivos base de traducción (ej. en inglés) creados.

Herramienta de gestión de traducciones seleccionada e integrada.

Documentación del flujo de trabajo para añadir nuevos idiomas.

Pruebas de funcionamiento en al menos 2 idiomas en todas las plataformas.

Restricciones:

No se permite hardcodear textos en el código fuente.

Todas las cadenas deben estar externalizadas.

El rendimiento de la app no debe verse afectado por la carga de archivos de traducción.

El cambio de idioma debe ser instantáneo o tras un reinicio controlado de la interfaz.