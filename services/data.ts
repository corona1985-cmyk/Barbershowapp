import { ref, get, set, remove, query, orderByChild, equalTo, limitToLast } from 'firebase/database';
import { db, getAuthIdToken, loginWithPassword, upsertStaffUser, deleteStaffUser, updateMyProfile, adminUpsertPointOfSale, adminDeletePointOfSale, adminSetPosPlan, checkUsernameAvailable, updateMyClientProfile, getPlatformStats, listDirectoryUsers, cancelMyAppointment, createClientAppointment } from './firebase';
import { getCachedClaims } from './session';
import { Capacitor } from '@capacitor/core';
import { GLOBAL_FREE_MODE, PROMOTIONAL_FREE_TIER, PROMO_GRACE_PERIOD_DAYS, getFreeSignupTierAndPlan } from '../config/app';
import {
  Client,
  Product,
  Service,
  Barber,
  BarberWorkingHours,
  BarberBlockedSlot,
  BarberGalleryPhoto,
  Appointment,
  Sale,
  FinanceRecord,
  SystemUser,
  AppSettings,
  CartItem,
  PointOfSale,
  NotificationLog,
  AuditLog,
  GlobalSettings,
  UserRole,
  ProfessionalCertification,
} from '../types';
import {
  PROFILE_LIMITS,
  sanitizeCertifications,
  sanitizeHighlights,
  sanitizeProfileText,
  sanitizeYearsExperience,
} from '../utils/professionalProfile';

const ROOT = 'barbershow';
const RTDB_BASE_URL = 'https://gen-lang-client-0624135070-default-rtdb.firebaseio.com';

/** Timeout para operaciones de Firebase en milisegundos (iOS WKWebView puede colgarse). */
const FIREBASE_TIMEOUT_MS = 10000;

/** Wrapper que agrega timeout a promesas de Firebase (evita cuelgues en iOS WKWebView). */
function withTimeout<T>(promise: Promise<T>, ms: number = FIREBASE_TIMEOUT_MS, operation = 'Firebase operation'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

async function authQuery(): Promise<string> {
  const token = await getAuthIdToken();
  if (!token) throw new Error('Sesión no autenticada.');
  return `auth=${encodeURIComponent(token)}`;
}

/** Resuelve la clave real en RTDB ignorando mayúsculas/minúsculas. */
async function resolveUsernameKey(username: string): Promise<string | null> {
  const searchLower = String(username || '').trim().toLowerCase();
  if (!searchLower) return null;
  const user = await readNode<SystemUser>(`${ROOT}/users/${searchLower}`, 'resolveUsernameKey');
  return user ? searchLower : null;
}

/** Evita cargar en memoria fotos base64 enormes durante el login (ralentizan o agotan el timeout). */
function withoutOversizedProfileBlob(user: SystemUser): SystemUser {
  if (typeof user.photoUrl === 'string' && user.photoUrl.length > 100_000) {
    console.warn(
      `[Auth] photoUrl muy grande en usuario "${user.username}" (${Math.round(user.photoUrl.length / 1024)} KB). ` +
        'Omitida en sesión; sube la foto de nuevo desde Configuración para guardarla como URL.'
    );
    const { photoUrl: _omit, ...rest } = user;
    return rest as SystemUser;
  }
  return user;
}

async function nativeRtdbGet<T>(path: string, operation: string, extraQuery = ''): Promise<T | null> {
  const auth = await authQuery();
  const qs = extraQuery ? `?${auth}&${extraQuery}` : `?${auth}`;
  const response = await withTimeout(
    fetch(`${RTDB_BASE_URL}/${path}.json${qs}`, { method: 'GET' }),
    FIREBASE_TIMEOUT_MS,
    `${operation}.nativeFetch`
  );
  if (!response.ok) {
    throw new Error(`${operation} HTTP ${response.status}`);
  }
  return response.json() as Promise<T | null>;
}

async function nativeRtdbSet(path: string, value: unknown, operation: string): Promise<void> {
  const auth = await authQuery();
  const response = await withTimeout(
    fetch(`${RTDB_BASE_URL}/${path}.json?${auth}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(value),
    }),
    FIREBASE_TIMEOUT_MS,
    `${operation}.nativeSet`
  );
  if (!response.ok) {
    throw new Error(`${operation} HTTP ${response.status}`);
  }
}

async function readNode<T>(path: string, operation: string): Promise<T | null> {
  if (Capacitor.isNativePlatform()) {
    return nativeRtdbGet<T>(path, operation);
  }
  const snap = await withTimeout(get(ref(db, path)), FIREBASE_TIMEOUT_MS, operation);
  return (snap.val() as T | null) ?? null;
}

async function readCollectionByPos<T extends { posId?: number }>(collection: string, posId: number, operation: string): Promise<T[]> {
  if (Capacitor.isNativePlatform()) {
    const extra = `orderBy=${encodeURIComponent('"posId"')}&equalTo=${posId}`;
    const all = await nativeRtdbGet<Record<string, T> | null>(`${ROOT}/${collection}`, operation, extra);
    return snapshotToArray<T>(all);
  }
  const q = query(ref(db, ROOT + '/' + collection), orderByChild('posId'), equalTo(posId));
  const snap = await withTimeout(get(q), FIREBASE_TIMEOUT_MS, operation);
  return snapshotToArray<T>(snap.val());
}

async function writeNode(path: string, value: unknown, operation: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await nativeRtdbSet(path, value, operation);
    return;
  }
  if (value === null) {
    await withTimeout(remove(ref(db, path)), FIREBASE_TIMEOUT_MS, operation);
    return;
  }
  await withTimeout(set(ref(db, path), value), FIREBASE_TIMEOUT_MS, operation);
}

function busySlotKey(barberoId: number, hora: string): string {
  return `${barberoId}_${String(hora).replace(/[.#$\[\]]/g, '_')}`;
}

async function syncAppointmentIndexes(
  apt: Pick<Appointment, 'id' | 'posId' | 'barberoId' | 'fecha' | 'hora' | 'duracionTotal' | 'estado'>,
  gone = false
): Promise<void> {
  const slotPath = `${ROOT}/busySlots/${apt.posId}/${apt.fecha}/${busySlotKey(apt.barberoId, apt.hora)}`;
  const byDate = `${ROOT}/appointmentsByPosDate/${apt.posId}/${apt.fecha}/${apt.id}`;
  if (gone || apt.estado === 'cancelada') {
    await writeNode(slotPath, null, 'clearBusySlot');
    await writeNode(byDate, null, 'clearApptByDate');
    return;
  }
  await writeNode(slotPath, {
    barberoId: apt.barberoId,
    fecha: apt.fecha,
    hora: apt.hora,
    duracionTotal: apt.duracionTotal || 30,
    estado: apt.estado,
    appointmentId: apt.id,
  }, 'busySlot');
  await writeNode(byDate, true, 'apptByDate');
}

async function indexClientPhone(posId: number, phone: string, clientId: number | null): Promise<void> {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 8) return;
  await writeNode(`${ROOT}/clientsByPhone/${posId}/${digits}`, clientId, 'indexClientPhone');
}

const DEFAULT_SETTINGS: AppSettings = {
  taxRate: 0,
  storeName: 'BarberShow',
  currencySymbol: '$',
};

const DEFAULT_GLOBAL_SETTINGS: GlobalSettings = {
  appName: 'BarberShow',
  primaryColor: '#ffd427',
  secondaryColor: '#1e293b',
  termsAndConditions: `TÉRMINOS Y CONDICIONES DE USO
BarberShow — Plataforma de gestión para barberías
Versión vigente | Sitio: https://barbershow.net

═══════════════════════════════════════════════════════════════

1. IDENTIFICACIÓN DEL PRESTADOR

Estos Términos y Condiciones ("Términos") regulan el acceso y uso de BarberShow, plataforma digital de gestión para barberías y peluquerías, operada por ICC Digital Group ("BarberShow", "nosotros" o "el Prestador").

Contacto oficial:
• Correo: corona1985@iccdigitalgroup.com
• WhatsApp / teléfono: 829 599 2941
• Web: https://barbershow.net

Al registrarte, iniciar sesión, agendar una cita, contratar un plan o utilizar BarberShow en cualquiera de sus versiones (sitio web, aplicación móvil para Android/iOS u otros canales autorizados), declaras haber leído, comprendido y aceptado estos Términos. Si no estás de acuerdo, no utilices el servicio.

═══════════════════════════════════════════════════════════════

2. OBJETO DEL SERVICIO

BarberShow es un software en la nube (SaaS) multi-sede que permite a barberías y profesionales del sector:

• Gestionar agenda y citas por barbero o sede
• Administrar clientes, servicios y horarios de trabajo
• Registrar ventas desde punto de venta (POS)
• Controlar inventario, finanzas y reportes
• Comunicarse con clientes (incluida integración con WhatsApp desde el número del usuario)
• Publicar códigos QR para registro y reservas
• Permitir que clientes finales descubran barberías, se registren y agenden citas

BarberShow actúa como proveedor tecnológico. No presta servicios de barbería ni peluquería; la relación comercial entre la barbería y su cliente final es independiente de BarberShow.

═══════════════════════════════════════════════════════════════

3. DEFINICIONES

• "Usuario": persona que accede a BarberShow con credenciales o como invitado en funciones limitadas.
• "Barbería" o "Sede" (Punto de Venta / POS): negocio registrado en la plataforma con agenda, barberos y configuración propia.
• "Dueño" o "Administrador": usuario responsable de una o varias sedes.
• "Barbero" / "Empleado": miembro del equipo asignado a una sede, con permisos según su rol.
• "Cliente final": usuario registrado como cliente para agendar citas y gestionar su perfil.
• "Plan" o "Tier": modalidad de suscripción que determina funciones, límites y precio.
• "Invitado": persona que agenda cita o consulta barberías sin crear cuenta permanente.

═══════════════════════════════════════════════════════════════

4. TIPOS DE USUARIO Y ACCESO

4.1 Barberías y profesionales
Pueden registrarse mediante autoregistro (plan gratuito o de pago), solicitud de acceso revisada por el equipo, o alta por un administrador. Cada sede tiene un dueño identificado y puede incluir barberos, empleados y administradores con distintos permisos (gestión de usuarios, reportes, inventario, citas, etc.).

4.2 Clientes finales
Pueden crear cuenta para agendar citas, guardar historial, marcar barberías favoritas (por ejemplo mediante código QR) y gestionar su perfil. El registro puede vincularse a una barbería específica cuando acceden por QR o enlace de referencia.

4.3 Invitados
BarberShow permite reservar citas sin cuenta en barberías que lo habiliten. Los datos proporcionados (nombre, teléfono, etc.) serán tratados conforme a la Política de Privacidad y bajo responsabilidad de la barbería que recibe la reserva.

4.4 Credenciales
Eres responsable de mantener la confidencialidad de tu usuario y contraseña, y de toda actividad realizada con tu cuenta. Debes notificar de inmediato cualquier uso no autorizado a soporte.

═══════════════════════════════════════════════════════════════

5. PLANES, PRECIOS Y FUNCIONALIDADES

Los planes disponibles, sus precios en USD y sus características se muestran en la aplicación y pueden actualizarse. A la fecha de estos Términos, BarberShow ofrece:

PLAN GRATUITO — USD 0/mes
• Solo agenda de citas: visualización y gestión de citas agendadas
• Límite de hasta 100 citas no canceladas por mes y por sede
• Sin acceso a ventas POS, clientes, reportes avanzados, inventario ni finanzas
• Puede incluir publicidad (banners) en web y aplicación móvil
• Ideal para prueba del servicio o negocios muy pequeños

PLAN SOLO — USD 14,95/mes
• Un profesional, un local
• Dashboard, citas, clientes, ventas (POS) y configuración básica
• Reportes básicos de ventas y citas
• Inventario simple opcional

PLAN BARBERÍA — USD 19,95/mes
• Varios barberos en una sola sede
• Agenda, citas y ventas por barbero; reportes por profesional
• Funciones ampliadas: inventario, finanzas, consola WhatsApp, administración de usuarios (según configuración)

PLAN MULTI-SEDE — USD 29,95/mes
• Varias ubicaciones bajo un mismo dueño
• Selector de sede, reportes comparativos y administración centralizada
• Sin límite de sedes ni barberos dentro de lo razonable para uso comercial normal

Descuento anual: los planes de pago pueden contratarse con ciclo anual con descuento del 40 % sobre el precio mensual, según se indique en la app al contratar.

Plan Pro (notificaciones): algunas sedes pueden tener habilitadas notificaciones de citas para barberos; esta función depende del plan contratado y de la configuración de la sede.

BarberShow se reserva el derecho de modificar precios, límites o funciones de cada plan. Los cambios no afectarán retroactivamente un período ya pagado, salvo disposición legal en contrario.

═══════════════════════════════════════════════════════════════

6. CONTRATACIÓN, PAGOS Y RENOVACIÓN

6.1 Plan gratuito
El plan gratuito puede activarse sin pago, sujeto a verificación de datos y a los límites descritos. BarberShow puede solicitar información adicional antes de aprobar una cuenta.

6.2 Planes de pago
Los planes de pago requieren suscripción activa. En aplicación móvil (Android/iOS), el pago se procesa exclusivamente a través de Google Play o App Store, según corresponda. En la versión web, la contratación de planes de pago puede requerir completar el proceso en la app móvil.

6.3 Renovación y vencimiento
Las suscripciones tienen una fecha de vencimiento (subscriptionExpiresAt). Si la suscripción vence y no se renueva, el acceso a funciones de pago puede bloquearse hasta regularizar el pago. El plan gratuito no requiere pago pero sigue sujeto a sus límites.

6.4 Reembolsos
Los reembolsos de suscripciones contratadas por App Store o Google Play se rigen por las políticas de Apple y Google respectivamente. Para consultas, contacta primero al proveedor de la tienda y, si es necesario, a soporte de BarberShow.

6.5 Impuestos
Los precios publicados pueden no incluir impuestos locales; estos serán aplicados según la legislación vigente y las políticas de la tienda de aplicaciones.

═══════════════════════════════════════════════════════════════

7. USO ACEPTABLE

Queda estrictamente prohibido:

• Utilizar BarberShow para actividades ilegales, fraudulentas o que vulneren derechos de terceros
• Suplantar identidad o registrar barberías falsas
• Intentar acceder sin autorización a datos de otras sedes, usuarios o clientes
• Realizar ingeniería inversa, scraping masivo, ataques o interferencia con la infraestructura
• Revender, sublicenciar o redistribuir el acceso a la plataforma sin autorización escrita
• Cargar contenido ofensivo, difamatorio, obsceno o que infrinja propiedad intelectual
• Eludir límites del plan gratuito (por ejemplo, superar el tope de 100 citas mensuales mediante cuentas duplicadas)
• Usar la consola WhatsApp o mensajería para spam o comunicaciones no solicitadas

BarberShow puede suspender o eliminar cuentas, sedes o contenido que incumplan estos Términos, sin perjuicio de acciones legales.

═══════════════════════════════════════════════════════════════

8. DATOS, PRIVACIDAD Y RESPONSABILIDAD DE LA BARBERÍA

8.1 Datos ingresados por barberías
Las barberías y sus administradores son responsables de la veracidad y legalidad de los datos que ingresan sobre clientes, empleados, ventas, citas e inventario. Deben contar con base legal para tratar datos personales de sus clientes (consentimiento, ejecución de contrato, etc.) conforme a la normativa aplicable.

8.2 BarberShow como encargado tecnológico
BarberShow almacena y procesa datos en infraestructura en la nube (Firebase / Google) para prestar el servicio. El tratamiento de datos personales se describe en la Política de Privacidad, accesible en la aplicación y en https://barbershow.net/?legal=privacidad

8.3 WhatsApp y comunicaciones
Las funciones de mensajería y WhatsApp abren enlaces o flujos desde el dispositivo del usuario; los mensajes se envían desde el número del propio usuario o barbería. BarberShow no es responsable del contenido de mensajes enviados por los usuarios ni de políticas de terceros (WhatsApp/Meta).

8.4 Eliminación de cuenta
Los usuarios pueden solicitar la desactivación o eliminación de su cuenta desde la configuración de la app. Algunos datos operativos e históricos pueden conservarse según obligaciones legales o necesidades de seguridad, como se indica en la Política de Privacidad.

═══════════════════════════════════════════════════════════════

9. PROPIEDAD INTELECTUAL

BarberShow, su nombre, logotipo, diseño, código fuente, documentación y materiales asociados son propiedad de ICC Digital Group o sus licenciantes. Se concede al usuario una licencia limitada, no exclusiva, intransferible y revocable para usar la plataforma conforme al plan contratado y estos Términos.

Los contenidos que subas (fotos de barberos, logos de barbería, etc.) siguen siendo tuyos; otorgas a BarberShow una licencia para almacenarlos y mostrarlos dentro del servicio.

═══════════════════════════════════════════════════════════════

10. DISPONIBILIDAD, MANTENIMIENTO Y SOPORTE

BarberShow se presta "tal cual" y "según disponibilidad". Podemos realizar mantenimientos programados o de emergencia que afecten temporalmente el acceso. En modo mantenimiento, el acceso puede restringirse a usuarios master/administradores de plataforma.

El soporte técnico se presta por los canales indicados (correo y WhatsApp) en horarios comerciales razonables. No garantizamos tiempos de respuesta específicos salvo acuerdo comercial aparte.

═══════════════════════════════════════════════════════════════

11. LIMITACIÓN DE RESPONSABILIDAD

En la máxima medida permitida por la ley:

• BarberShow no garantiza resultados comerciales, aumento de clientes ni ausencia total de errores en el software
• No somos responsables de citas perdidas, conflictos entre barbería y cliente, ni de daños derivados del uso de WhatsApp u otros servicios de terceros
• No respondemos por pérdida de datos debida a causas fuera de nuestro control razonable; se recomienda exportar reportes periódicamente
• La responsabilidad total de BarberShow frente al usuario por cualquier reclamación relacionada con el servicio se limitará al monto pagado por el usuario en los doce (12) meses anteriores al hecho, o a cero en plan gratuito

Nada en estos Términos excluye responsabilidades que no puedan limitarse por ley.

═══════════════════════════════════════════════════════════════

12. SUSPENSIÓN Y TERMINACIÓN

BarberShow puede suspender o terminar el acceso si:
• Incumples estos Términos o la Política de Privacidad
• Tu suscripción está vencida o impaga
• Detectamos actividad fraudulenta o riesgo para la plataforma u otros usuarios
• Lo exige una autoridad competente

Puedes dejar de usar el servicio en cualquier momento. La terminación no exime de obligaciones de pago ya devengadas ni de responsabilidades por uso previo.

═══════════════════════════════════════════════════════════════

13. MODIFICACIONES

Podemos actualizar estos Términos cuando sea necesario. Publicaremos la versión vigente en la aplicación y en https://barbershow.net/?legal=terminos. Los cambios relevantes pueden comunicarse por correo o aviso en la app. El uso continuado del servicio tras la entrada en vigor de los cambios implica aceptación, salvo que la ley exija consentimiento expreso adicional.

═══════════════════════════════════════════════════════════════

14. LEGISLACIÓN APLICABLE Y JURISDICCIÓN

Estos Términos se rigen por las leyes de la República Dominicana, sin perjuicio de normas imperativas de protección al consumidor del país de residencia del usuario cuando resulten aplicables. Cualquier controversia se someterá preferentemente a solución amigable; de no alcanzarse acuerdo, a los tribunales competentes de la República Dominicana.

═══════════════════════════════════════════════════════════════

15. CONTACTO

Para consultas sobre estos Términos, soporte o reclamaciones:

• Email: corona1985@iccdigitalgroup.com
• WhatsApp: 829 599 2941
• Web: https://barbershow.net

Al utilizar BarberShow confirmas que has leído y aceptado estos Términos y Condiciones.`,
  privacyPolicy: `POLÍTICA DE PRIVACIDAD — BARSHOW

1. Introducción
BarberShow ("nosotros") respeta tu privacidad. Esta política explica qué datos recopilamos, para qué los usamos y cuáles son tus derechos.

2. Responsable del tratamiento
ICC Digital Group — BarberShow
Correo de contacto: corona1985@iccdigitalgroup.com

3. Datos que recopilamos
• Datos de cuenta: nombre, usuario, correo, teléfono y contraseña (almacenada de forma segura).
• Datos de barbería: nombre comercial, servicios, horarios, barberos, inventario y ventas.
• Datos de clientes: nombre, teléfono, historial de citas y preferencias registradas por la barbería.
• Datos técnicos: tipo de dispositivo, sistema operativo, registros de uso y cookies (en la versión web).

4. Finalidad del tratamiento
Utilizamos los datos para: prestar el servicio; gestionar citas y ventas; enviar recordatorios; mejorar la plataforma; cumplir obligaciones legales; y ofrecer soporte técnico.

5. Base legal
El tratamiento se basa en la ejecución del contrato de servicio, el consentimiento del usuario cuando corresponda, el interés legítimo en mejorar la plataforma y el cumplimiento de obligaciones legales.

6. Conservación
Conservamos los datos mientras la cuenta esté activa o sea necesario para prestar el servicio. Tras la baja, algunos datos pueden conservarse el tiempo exigido por ley o por motivos de seguridad y resolución de disputas.

7. Compartición con terceros
No vendemos datos personales. Podemos compartir información con proveedores de infraestructura (hosting, bases de datos), procesadores de pago y servicios de mensajería, siempre bajo acuerdos de confidencialidad y solo para las finalidades descritas.

8. Cookies (versión web)
Utilizamos cookies y almacenamiento local para mantener la sesión, recordar preferencias y mejorar la experiencia. Puedes gestionar las cookies desde la configuración de tu navegador.

9. Seguridad
Aplicamos medidas técnicas y organizativas para proteger los datos contra acceso no autorizado, pérdida o alteración. Ningún sistema es 100 % infalible; te recomendamos usar contraseñas robustas.

10. Tus derechos
Puedes solicitar acceso, rectificación, supresión, limitación u oposición al tratamiento de tus datos, así como portabilidad cuando aplique. Escríbenos a corona1985@iccdigitalgroup.com para ejercer tus derechos.

11. Menores
BarberShow no está dirigido a menores de 16 años. Si detectamos datos de menores sin consentimiento parental, procederemos a eliminarlos.

12. Cambios
Podemos actualizar esta política. Publicaremos la versión vigente en la aplicación con la fecha de actualización.

13. Contacto
corona1985@iccdigitalgroup.com`,
  cookiePolicy: 'Utilizamos cookies esenciales para la sesión y preferencias, y cookies analíticas para mejorar la experiencia. Puedes aceptar o configurarlas desde tu navegador.',
  supportEmail: 'corona1985@iccdigitalgroup.com',
  maintenanceMode: false,
};

function toObjectById<T extends { id: number }>(arr: T[]): Record<string, T> {
  const o: Record<string, T> = {};
  arr.forEach((item) => { o[String(item.id)] = item; });
  return o;
}

function toObjectByUsername(users: SystemUser[]): Record<string, SystemUser> {
  const o: Record<string, SystemUser> = {};
  users.forEach((u) => { o[u.username] = u; });
  return o;
}

function snapshotToArray<T>(val: unknown): T[] {
  if (val == null || typeof val !== 'object') return [];
  const obj = val as Record<string, T | null | undefined>;
  return Object.keys(obj)
    .filter((k) => obj[k] != null)
    .map((k) => {
      const item = obj[k]!;
      if (item && typeof item === 'object') {
        const rec = item as T & { id?: number };
        const id = typeof rec.id === 'number' ? rec.id : Number(k) || k;
        return { ...rec, id } as T;
      }
      return item as T;
    });
}

function snapshotToUsers(val: unknown): SystemUser[] {
  if (val == null) return [];
  const obj = val as Record<string, SystemUser>;
  return Object.values(obj).map((u) => {
    const copy = { ...u };
    delete (copy as Record<string, unknown>).password;
    return withoutOversizedProfileBlob(copy);
  });
}

export function isAccountDeactivated(user: SystemUser | null | undefined): boolean {
  if (!user) return false;
  if (user.active === false) return true;
  if (user.accountStatus === 'deactivated') return true;
  return false;
}

let ACTIVE_POS_ID: number | null = null;

/** Genera un ID numérico único para evitar colisiones al crear varios registros en el mismo ms. */
export function generateUniqueId(): number {
  return Date.now() * 1000 + Math.floor(Math.random() * 1000);
}

const CACHE_TTL_MS = 50 * 1000;
const dataCache: Record<string, { data: unknown; ts: number }> = {};
function cacheGet<T>(key: string): T | null {
  const entry = dataCache[key];
  if (!entry || Date.now() - entry.ts > CACHE_TTL_MS) return null;
  return entry.data as T;
}
function cacheSet(key: string, data: unknown) {
  dataCache[key] = { data, ts: Date.now() };
}
function cacheInvalidate(prefix: string) {
  Object.keys(dataCache).forEach((k) => {
    if (k.startsWith(prefix)) delete dataCache[k];
  });
}

/** Lanza si el rol actual no está en la lista permitida. Usar solo como UX; las Rules/Functions autorizan. */
function requireRole(allowedRoles: string[]): void {
  const claims = getCachedClaims();
  const role = claims?.role === 'empleado' ? 'barbero' : (claims?.role || DataService.getCurrentUserRole());
  const normalized = role === 'empleado' ? 'barbero' : role === 'dueno' ? 'admin' : role;
  if (!allowedRoles.includes(normalized) && !allowedRoles.includes(role)) {
    throw new Error('No tienes permiso para realizar esta acción.');
  }
}

export const DataService = {
  initialize: async (): Promise<void> => {
    return;
  },

  /**
   * Sube sedes con tier "gratuito" al Plan Barbería promocional (tier + plan pro).
   * Idempotente: solo toca sedes que sigan en gratuito.
   */
  migrateGratuitoPosToPromotionalTier: async (): Promise<{ updated: number; posIds: number[]; message: string }> => {
    if (!GLOBAL_FREE_MODE) {
      return { updated: 0, posIds: [], message: 'Modo promocional desactivado (GLOBAL_FREE_MODE = false).' };
    }

    const { tier, plan } = getFreeSignupTierAndPlan();
    if (tier !== PROMOTIONAL_FREE_TIER) {
      return { updated: 0, posIds: [], message: 'El tier promocional configurado no es Plan Barbería.' };
    }

    const list = await DataService.getPointsOfSale();
    const posIds: number[] = [];
    for (const pos of list) {
      if (pos.tier !== 'gratuito') continue;
      await adminSetPosPlan(pos.id, tier, plan);
      posIds.push(pos.id);
    }

    if (posIds.length === 0) {
      return { updated: 0, posIds: [], message: 'No hay sedes con Plan Gratuito pendientes de migrar.' };
    }

    cacheInvalidate('pointsOfSale');
    await DataService.logAuditAction('migration_promotional_tier', 'system', `Migración promocional: ${posIds.length} sede(s).`).catch(() => {});

    return {
      updated: posIds.length,
      posIds,
      message: `${posIds.length} sede(s) migrada(s) al Plan Barbería promocional.`,
    };
  },

  /**
   * Asigna periodo de gracia (30 días) a sedes Barbería sin subscriptionExpiresAt
   * (usuarios del periodo promocional al activar cobro Apple).
   */
  migratePromoBarberiaGracePeriod: async (): Promise<{ updated: number; posIds: number[]; message: string }> => {
    if (GLOBAL_FREE_MODE) {
      return { updated: 0, posIds: [], message: 'El modo promocional sigue activo (GLOBAL_FREE_MODE = true).' };
    }

    const list = await DataService.getPointsOfSale();
    const posIds: number[] = [];
    const graceEnd = new Date();
    graceEnd.setDate(graceEnd.getDate() + PROMO_GRACE_PERIOD_DAYS);
    const graceIso = graceEnd.toISOString();

    for (const pos of list) {
      if (pos.tier !== 'barberia') continue;
      if (pos.subscriptionExpiresAt) continue;
      await adminSetPosPlan(pos.id, pos.tier || 'barberia', pos.plan || 'pro', graceIso);
      posIds.push(pos.id);
    }

    if (posIds.length === 0) {
      return { updated: 0, posIds: [], message: 'No hay sedes Barbería sin fecha de vencimiento.' };
    }

    cacheInvalidate('pointsOfSale');
    await DataService.logAuditAction('migration_promo_grace', 'system', `Gracia promocional: ${posIds.length} sede(s).`).catch(() => {});

    return {
      updated: posIds.length,
      posIds,
      message: `${posIds.length} sede(s) Barbería con ${PROMO_GRACE_PERIOD_DAYS} días de gracia.`,
    };
  },

  setActivePosId: (id: number | null) => { ACTIVE_POS_ID = id; },
  getActivePosId: () => ACTIVE_POS_ID,

  getPointsOfSale: async (): Promise<PointOfSale[]> => {
    const claims = getCachedClaims();
    const key = 'pointsOfSale';
    const cached = cacheGet<PointOfSale[]>(key);
    if (cached) return cached;
    const isNative = Capacitor.isNativePlatform();
    let raw: Record<string, PointOfSale> | PointOfSale | null = null;
    try {
      if (claims && (claims.role === 'platform_owner' || claims.role === 'superadmin' || claims.role === 'support' || claims.role === 'financial' || claims.role === 'commercial')) {
        raw = isNative
          ? await nativeRtdbGet<Record<string, PointOfSale> | null>(`${ROOT}/pointsOfSale`, 'getPointsOfSale')
          : (await withTimeout(get(ref(db, ROOT + '/pointsOfSale')), FIREBASE_TIMEOUT_MS, 'getPointsOfSale')).val();
      } else if (claims?.username) {
        let byOwner: Record<string, PointOfSale> | null = null;
        try {
          const ownerSnap = isNative
            ? await nativeRtdbGet<Record<string, PointOfSale> | null>(`${ROOT}/pointsOfSale`, 'getPointsOfSale.owner', `orderBy=${encodeURIComponent('"ownerId"')}&equalTo=${encodeURIComponent(`"${claims.username}"`)}`)
            : (await withTimeout(get(query(ref(db, ROOT + '/pointsOfSale'), orderByChild('ownerId'), equalTo(claims.username))), FIREBASE_TIMEOUT_MS, 'getPointsOfSale.owner')).val();
          byOwner = ownerSnap;
        } catch {
          byOwner = null;
        }
        const ownId = claims.posId;
        let own: PointOfSale | null = null;
        if (ownId != null) {
          try {
            own = isNative
              ? await nativeRtdbGet<PointOfSale | null>(`${ROOT}/pointsOfSale/${ownId}`, 'getPointsOfSale.one')
              : (await withTimeout(get(ref(db, ROOT + '/pointsOfSale/' + ownId)), FIREBASE_TIMEOUT_MS, 'getPointsOfSale.one')).val();
          } catch {
            own = null;
          }
        }
        raw = { ...(byOwner || {}) };
        if (own) (raw as Record<string, PointOfSale>)[String(own.id || ownId)] = own;
      }
    } catch (err) {
      throw err;
    }
    const arr = snapshotToArray<PointOfSale>(raw);
    const out = arr.map((p) => ({ ...p, id: Number(p.id), plan: p.plan || 'basic', tier: p.tier ?? 'barberia' }));
    cacheSet(key, out);
    return out;
  },

  /** True si la sede no tiene fecha de vencimiento o si la fecha es futura. */
  isSubscriptionActive: (pos: PointOfSale | null | undefined): boolean => {
    if (!pos?.subscriptionExpiresAt) return true;
    try {
      return new Date(pos.subscriptionExpiresAt) > new Date();
    } catch {
      return true;
    }
  },

  /** Plan de la sede activa; usado para habilitar funciones Pro (ej. notificaciones barbero). */
  getCurrentPosPlan: async (): Promise<'basic' | 'pro'> => {
    if (ACTIVE_POS_ID == null) return 'basic';
    const list = await DataService.getPointsOfSale();
    const pos = list.find((p) => p.id === ACTIVE_POS_ID);
    return pos?.plan === 'pro' ? 'pro' : 'basic';
  },

  addPointOfSale: async (pos: Omit<PointOfSale, 'id'>): Promise<PointOfSale> => {
    const result = await adminUpsertPointOfSale({ ...pos });
    cacheInvalidate('pointsOfSale');
    return result.pos;
  },

  updatePointOfSale: async (pos: PointOfSale): Promise<void> => {
    const claims = getCachedClaims();
    if (claims?.role === 'platform_owner' || claims?.role === 'superadmin') {
      await adminUpsertPointOfSale(pos as unknown as Record<string, unknown>);
    } else {
      const { tier: _t, plan: _p, isActive: _a, subscriptionExpiresAt: _s, ownerId: _o, ...rest } = pos as PointOfSale & Record<string, unknown>;
      const current = (await DataService.getPointsOfSale()).find((p) => p.id === pos.id);
      const toWrite = {
        ...current,
        ...rest,
        id: pos.id,
        tier: current?.tier,
        plan: current?.plan,
        isActive: current?.isActive,
        subscriptionExpiresAt: current?.subscriptionExpiresAt,
        ownerId: current?.ownerId,
      };
      Object.keys(toWrite).forEach((k) => { if ((toWrite as Record<string, unknown>)[k] === undefined) delete (toWrite as Record<string, unknown>)[k]; });
      await set(ref(db, ROOT + '/pointsOfSale/' + pos.id), toWrite);
    }
    cacheInvalidate('pointsOfSale');
  },

  deletePointOfSale: async (id: number): Promise<void> => {
    await adminDeletePointOfSale(id);
    cacheInvalidate('pointsOfSale');
  },

  getUsers: async (): Promise<SystemUser[]> => {
    const posId = ACTIVE_POS_ID ?? getCachedClaims()?.posId ?? null;
    if (posId == null) return [];
    let raw: Record<string, SystemUser> | null;
    if (Capacitor.isNativePlatform()) {
      raw = await nativeRtdbGet<Record<string, SystemUser> | null>(`${ROOT}/users`, 'getUsers', `orderBy=${encodeURIComponent('"posId"')}&equalTo=${posId}`);
    } else {
      const q = query(ref(db, ROOT + '/users'), orderByChild('posId'), equalTo(posId));
      raw = (await withTimeout(get(q), FIREBASE_TIMEOUT_MS, 'getUsers')).val();
    }
    const users = snapshotToUsers(raw);
    const sedeRoles: UserRole[] = ['admin', 'dueno', 'barbero', 'empleado', 'cliente'];
    return users.filter((u) => sedeRoles.includes(u.role) && u.posId === posId);
  },

  getAllUsersGlobal: async (): Promise<SystemUser[]> => {
    try {
      const listed = await listDirectoryUsers();
      return listed.map((u) => ({
        username: u.username,
        name: u.name,
        role: u.role as SystemUser['role'],
        posId: u.posId,
        status: u.status as SystemUser['status'],
        lastLogin: u.lastLogin,
        ip: u.ip,
      }));
    } catch {
      const raw = await readNode<Record<string, SystemUser>>(`${ROOT}/users`, 'getAllUsersGlobal.fallback');
      return snapshotToUsers(raw).map((u) => {
        const { photoUrl: _omit, ...rest } = u;
        return rest as SystemUser;
      });
    }
  },

  /** Busca usuario por username sin modificar datos (para registro/comprobaciones). */
  getUserByUsername: async (username: string): Promise<SystemUser | null> => {
    const dbKey = await resolveUsernameKey(username);
    if (!dbKey) return null;
    const user = await readNode<SystemUser>(`${ROOT}/users/${dbKey}`, 'getUserByUsername');
    if (!user) return null;
    return { ...user, username: user.username || dbKey };
  },

  /** true si el username ya existe (insensible a mayúsculas). */
  isUsernameTaken: async (username: string): Promise<boolean> => {
    return checkUsernameAvailable(username);
  },

  /** Busca usuario por username (insensible a mayúsculas) sin modificar datos. */
  findUserByUsername: async (username: string): Promise<SystemUser | null> => {
    const dbKey = await resolveUsernameKey(username);
    if (!dbKey) return null;
    const user = await readNode<SystemUser>(`${ROOT}/users/${dbKey}`, 'findUserByUsername');
    if (!user) return null;
    if (user.status === 'suspended' || user.status === 'locked') return null;
    return withoutOversizedProfileBlob({ ...user, username: user.username || dbKey });
  },

  /* Signup/IAP client writes removed: use Cloud Functions in services/firebase.ts */

  /** Autentica con usuario y contraseña. Verifica hash; no devuelve la contraseña. Lanza Error('NO_PASSWORD_SET') si el usuario no tiene contraseña asignada. */
  authenticate: async (username: string, password: string): Promise<SystemUser | null> => {
    try {
      const result = await loginWithPassword(username, password);
      const user = result.user as unknown as SystemUser;
      const updated = { ...user };
      delete (updated as Record<string, unknown>).password;
      DataService.logAuditAction('login', user.username, 'User Logged In', user.posId ?? undefined).catch(() => {});
      return updated as SystemUser;
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      const msg = String(err.message || '');
      if (msg.includes('ACCOUNT_DEACTIVATED')) throw new Error('ACCOUNT_DEACTIVATED');
      if (msg.includes('NO_PASSWORD_SET')) throw new Error('NO_PASSWORD_SET');
      if (err.code === 'functions/unauthenticated' || msg.toLowerCase().includes('incorrectos')) return null;
      throw e;
    }
  },

  authenticateMaster: async (_username: string): Promise<SystemUser | null> => {
    throw new Error('Usa authenticateMasterWithPassword. Este atajo ya no es válido.');
  },

  getCurrentUser: (): SystemUser | null => {
    try {
      const userStr = localStorage.getItem('currentUser');
      if (!userStr) return null;
      const parsed = JSON.parse(userStr);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  },

  /** Obtiene el usuario actual desde Firebase (datos actualizados: name, photoUrl, etc.). */
  getCurrentUserFromFirebase: async (): Promise<SystemUser | null> => {
    const current = DataService.getCurrentUser();
    if (!current?.username) return null;
    const user = await readNode<SystemUser>(`${ROOT}/users/${current.username}`, 'getCurrentUserFromFirebase');
    if (!user) return null;
    return user;
  },

  /** El usuario logueado actualiza solo su propio nombre y/o foto. No toca contraseña ni otros campos. Actualiza localStorage para que la foto se vea en toda la app al instante. */
  updateCurrentUserProfile: async (updates: { name?: string; photoUrl?: string | null }): Promise<void> => {
    const current = DataService.getCurrentUser();
    if (!current?.username) throw new Error('No hay sesión iniciada.');
    await updateMyProfile(updates);
    const nextUser = { ...current, ...updates };
    try {
      localStorage.setItem('currentUser', JSON.stringify(nextUser));
    } catch (_) {}
  },

  getCurrentUserRole: (): string => {
    try {
      const claims = getCachedClaims();
      if (claims?.role) return claims.role === 'empleado' ? 'barbero' : String(claims.role);
      return '';
    } catch {
      return '';
    }
  },

  /** Id del barbero (tabla Barber) cuando el usuario es rol barbero; null en caso contrario. */
  getCurrentBarberId: (): number | null => {
    const claims = getCachedClaims();
    if (claims && (claims.role === 'barbero' || claims.role === 'empleado')) {
      return claims.barberId;
    }
    const user = DataService.getCurrentUser();
    if (!user || (user.role !== 'barbero' && user.role !== 'empleado')) return null;
    const id = user.barberId;
    return id != null && id !== undefined ? id : null;
  },

  /** Id de barbero vinculado: staff barbero, o dueño/admin de plan Solo que se registró con perfil de peluquero. */
  getLinkedBarberId: (): number | null => {
    const fromRole = DataService.getCurrentBarberId();
    if (fromRole != null) return fromRole;
    const claims = getCachedClaims();
    if (claims?.barberId != null && Number.isFinite(Number(claims.barberId))) return Number(claims.barberId);
    const user = DataService.getCurrentUser();
    const id = user?.barberId;
    return typeof id === 'number' && Number.isFinite(id) ? id : null;
  },

  saveUser: async (user: SystemUser): Promise<void> => {
    const payload: Record<string, unknown> = {
      username: (user.username || '').trim().toLowerCase(),
      role: user.role,
      name: user.name,
      posId: user.posId ?? null,
      barberId: user.barberId ?? null,
      clientId: user.clientId ?? null,
      permissions: user.permissions,
    };
    if (user.password) payload.password = user.password;
    await upsertStaffUser(payload);
    cacheInvalidate('users');
  },

  deleteUser: async (username: string): Promise<void> => {
    await deleteStaffUser(username);
  },

  /** Barbería preferida del cliente (por QR o elección). Al iniciar sesión se abre esa barbería. Solo clientes. */
  getClientPreferredPos: async (username: string): Promise<number | null> => {
    const key = encodeURIComponent(username);
    const isNative = Capacitor.isNativePlatform();
    const val = isNative
      ? await nativeRtdbGet<{ preferredPosId?: number } | null>(`${ROOT}/clientPreferences/${key}`, 'getClientPreferredPos')
      : (await withTimeout(
          get(ref(db, ROOT + '/clientPreferences/' + key)),
          FIREBASE_TIMEOUT_MS,
          'getClientPreferredPos'
        )).val();
    if (val == null || typeof val.preferredPosId !== 'number') return null;
    return val.preferredPosId;
  },

  setClientPreferredPos: async (username: string, posId: number | null): Promise<void> => {    const path = `${ROOT}/clientPreferences/${encodeURIComponent(username)}`;
    if (Capacitor.isNativePlatform()) {
      await nativeRtdbSet(path, { preferredPosId: posId }, 'setClientPreferredPos');
    } else {
      await withTimeout(
        set(ref(db, ROOT + '/clientPreferences/' + encodeURIComponent(username)), { preferredPosId: posId }),
        FIREBASE_TIMEOUT_MS,
        'setClientPreferredPos'
      );
    }  },

  getSettings: async (): Promise<AppSettings> => {
    if (ACTIVE_POS_ID == null) return DEFAULT_SETTINGS;
    const posSettings = await readNode<AppSettings>(`${ROOT}/settings/${ACTIVE_POS_ID}`, 'getSettings.byPos');
    return posSettings || DEFAULT_SETTINGS;
  },

  updateSettings: async (settings: AppSettings): Promise<void> => {
    if (ACTIVE_POS_ID == null) throw new Error('No hay sede activa. Selecciona una sede para guardar la configuración.');
    const role = DataService.getCurrentUserRole();
    const posId = ACTIVE_POS_ID;
    if (role === 'barbero') {
      const current = await DataService.getSettings();
      settings = { ...current, taxRate: settings.taxRate, currencySymbol: settings.currencySymbol };
    } else {
      requireRole(['admin', 'superadmin']);
    }
    await set(ref(db, ROOT + '/settings/' + posId), { ...settings, posId });
    await DataService.logAuditAction('update_settings', role === 'barbero' ? 'barbero' : 'admin', 'Updated POS Settings', posId);
  },

  getGlobalSettings: async (): Promise<GlobalSettings> => {
    const settings = await readNode<GlobalSettings>(`${ROOT}/globalSettings`, 'getGlobalSettings');
    return settings || DEFAULT_GLOBAL_SETTINGS;
  },

  updateGlobalSettings: async (settings: GlobalSettings): Promise<void> => {
    requireRole(['platform_owner']);
    await set(ref(db, ROOT + '/globalSettings'), settings);
    await DataService.logAuditAction('update_global_settings', 'master', 'Updated Platform Branding/Settings');
  },

  logAuditAction: async (action: string, actor: string, details: string, posId?: number): Promise<void> => {
    const id = generateUniqueId();
    const log: Record<string, unknown> = {
      id,
      action,
      actor,
      details,
      timestamp: new Date().toISOString(),
      ip: '192.168.1.1',
    };
    if (posId !== undefined && posId !== null) {
      log.posId = posId;
    }
    if (Capacitor.isNativePlatform()) {
      await nativeRtdbSet(`${ROOT}/auditLogs/${id}`, log, 'logAuditAction');
    } else {
      await withTimeout(
        set(ref(db, ROOT + '/auditLogs/' + id), log),
        FIREBASE_TIMEOUT_MS,
        'logAuditAction'
      );
    }
  },

  getAuditLogs: async (limit = 80): Promise<AuditLog[]> => {
    const cap = Math.min(Math.max(Math.floor(limit), 1), 200);
    let obj: Record<string, AuditLog> | null;
    if (Capacitor.isNativePlatform()) {
      obj = await nativeRtdbGet<Record<string, AuditLog> | null>(
        `${ROOT}/auditLogs`,
        'getAuditLogs',
        `orderBy=${encodeURIComponent('"$key"')}&limitToLast=${cap}`
      );
    } else {
      const snap = await withTimeout(
        get(query(ref(db, ROOT + '/auditLogs'), limitToLast(cap))),
        FIREBASE_TIMEOUT_MS,
        'getAuditLogs'
      );
      obj = (snap.val() || {}) as Record<string, AuditLog>;
    }
    const arr = Object.values(obj || {}) as AuditLog[];
    return arr.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  getGlobalFinancialHistory: async () => {
    const stats = await getPlatformStats();
    const posRevenue = stats.revenueByPos || {};
    let sales = (stats.recentSales || []).map((s) => ({
      id: s.id,
      posId: s.posId,
      numeroVenta: s.numeroVenta || String(s.id),
      total: s.total,
      fecha: s.fecha,
      hora: s.hora || '',
      metodoPago: s.metodoPago || '',
      clienteId: null,
      items: [],
      subtotal: s.total,
      iva: 0,
      estado: 'completada' as const,
      notas: '',
    })) as Sale[];
    if (!sales.length) {
      const recent = Capacitor.isNativePlatform()
        ? await nativeRtdbGet<Record<string, Sale> | null>(
            `${ROOT}/sales`,
            'getGlobalFinancialHistory.recent',
            `orderBy=${encodeURIComponent('"$key"')}&limitToLast=20`
          )
        : (await withTimeout(
            get(query(ref(db, ROOT + '/sales'), limitToLast(20))),
            FIREBASE_TIMEOUT_MS,
            'getGlobalFinancialHistory.recent'
          )).val();
      sales = snapshotToArray<Sale>(recent).sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 20);
    }
    return { totalRevenue: stats.totalRevenue, posRevenue, transactions: [] as unknown[], sales };
  },

  getClients: async (): Promise<Client[]> => {
    if (ACTIVE_POS_ID == null) return [];
    const key = `clients_${ACTIVE_POS_ID}`;
    const cached = cacheGet<Client[]>(key);
    if (cached) return cached;
    const arr = await readCollectionByPos<Client>('clients', ACTIVE_POS_ID, 'getClients');
    const out = arr.map((c) => ({ ...c, id: Number(c.id) }));
    cacheSet(key, out);
    return out;
  },

  /** Fuerza recarga de clientes desde Firebase (invalida caché). Para ver fotos y datos actualizados tras Mi perfil. */
  refreshClients: async (): Promise<Client[]> => {
    cacheInvalidate('clients');
    return DataService.getClients();
  },

  /** Igual que refreshClients pero para la lista de barbero (clientes con actividad). */
  refreshClientsWithActivity: async (): Promise<Client[]> => {
    cacheInvalidate('clients');
    return DataService.getClientsWithActivity();
  },

  /** Busca un cliente por teléfono en la sede activa (índice, con fallback a la lista de la sede). */
  findClientByPhone: async (phone: string): Promise<Client | null> => {
    const normalized = String(phone ?? '').replace(/\D/g, '');
    if (normalized.length < 6) return null;
    if (ACTIVE_POS_ID != null) {
      const indexedId = await readNode<number>(`${ROOT}/clientsByPhone/${ACTIVE_POS_ID}/${normalized}`, 'findClientByPhone.index');
      if (indexedId != null) {
        const byId = await DataService.getClientById(Number(indexedId));
        if (byId) return byId;
      }
    }
    const arr = await DataService.getClients();
    const found = arr.find((c) => String(c.telefono || '').replace(/\D/g, '') === normalized);
    return found ? { ...found, id: Number(found.id) } : null;
  },

  /** Solo clientes que tienen al menos una cita o una venta en esta sede (para barberos: solo de este barbero). */
  getClientsWithActivity: async (): Promise<Client[]> => {
    if (ACTIVE_POS_ID == null) return [];
    const barberId = DataService.getCurrentBarberId();
    const key = `clientsActivity_${ACTIVE_POS_ID}_${barberId ?? 'all'}`;
    const cached = cacheGet<Client[]>(key);
    if (cached) return cached;
    const [allClientsRaw, apptsRaw, salesRaw] = await Promise.all([
      readCollectionByPos<Client>('clients', ACTIVE_POS_ID, 'getClientsWithActivity.clients'),
      readCollectionByPos<Appointment>('appointments', ACTIVE_POS_ID, 'getClientsWithActivity.appointments'),
      readCollectionByPos<Sale>('sales', ACTIVE_POS_ID, 'getClientsWithActivity.sales'),
    ]);
    const allClients = allClientsRaw.map((c) => ({ ...c, id: Number(c.id) }));
    let appts = apptsRaw;
    let sales = salesRaw;
    if (barberId != null) {
      appts = appts.filter((a) => a.barberoId === barberId);
      sales = sales.filter((s) => (s.barberoId ?? null) === barberId);
    }
    const clientIdsWithAppt = new Set(appts.map((a) => a.clienteId));
    const clientIdsWithSale = new Set(sales.map((s) => s.clienteId).filter(Boolean));
    const activeIds = new Set([...clientIdsWithAppt, ...clientIdsWithSale]);
    const out = allClients.filter((c) => activeIds.has(c.id));
    cacheSet(key, out);
    return out;
  },

  addClient: async (client: Omit<Client, 'id' | 'posId'>): Promise<Client> => {
    if (DataService.getCurrentUserRole() !== '') requireRole(['admin', 'superadmin', 'barbero', 'cliente']);
    const effectivePosId = ACTIVE_POS_ID ?? 1;
    const newClient = { ...client, id: generateUniqueId(), posId: effectivePosId } as Client;    if (Capacitor.isNativePlatform()) {
      await nativeRtdbSet(`${ROOT}/clients/${newClient.id}`, newClient, 'addClient');
    } else {
      await withTimeout(
        set(ref(db, ROOT + '/clients/' + newClient.id), newClient),
        FIREBASE_TIMEOUT_MS,
        'addClient'
      );
    }    cacheInvalidate('clients');
    DataService.logAuditAction('create_client', 'system', `Registered client: ${client.nombre}`, effectivePosId).catch(() => {});
    await indexClientPhone(effectivePosId, String(client.telefono || ''), newClient.id);
    return newClient;
  },

  /** Busca cliente por teléfono; si existe lo devuelve. Si no, crea uno nuevo. Evita duplicados. */
  addClientOrGetExisting: async (client: Omit<Client, 'id' | 'posId'>): Promise<Client> => {
    const phone = String(client.telefono ?? '').trim();
    if (phone.length >= 6) {
      const existing = await DataService.findClientByPhone(phone);
      if (existing) return existing;
    }
    return DataService.addClient(client);
  },

  updateClient: async (client: Client): Promise<void> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    await set(ref(db, ROOT + '/clients/' + client.id), client);
    cacheInvalidate('clients');
  },

  /** Obtiene un cliente por ID (cualquier sede). */
  getClientById: async (id: number): Promise<Client | null> => {
    const c = await readNode<Client>(`${ROOT}/clients/${id}`, 'getClientById');
    if (!c) return null;
    return { ...c, id: Number(c.id) };
  },

  /** Solo rol cliente: actualiza su propio perfil vía Function (no escribe puntos ni notas). */
  updateClientProfileForCurrentUser: async (updates: { nombre?: string; telefono?: string; photoUrl?: string | null }): Promise<void> => {
    const user = DataService.getCurrentUser();
    if (!user || user.role !== 'cliente') throw new Error('Solo los clientes pueden editar su perfil aquí.');
    const result = await updateMyClientProfile(updates);
    cacheInvalidate('clients');
    const nameValue = String(result.client.nombre || user.name);
    const photoValue = (result.client.photoUrl as string | null | undefined) ?? null;
    try {
      const cur = DataService.getCurrentUser();
      if (cur?.username === user.username) {
        localStorage.setItem('currentUser', JSON.stringify({ ...cur, name: nameValue, photoUrl: photoValue || undefined }));
      }
    } catch (_) {}
  },

  /** Asegura que el usuario cliente tenga un registro Client y clientId; si no existe, lo crea y enlaza. */
  ensureClientProfileForCurrentUser: async (): Promise<Client> => {
    const user = DataService.getCurrentUser();
    if (!user || user.role !== 'cliente') throw new Error('Solo aplica para usuarios con rol cliente.');
    if (user.clientId != null) {
      const existing = await DataService.getClientById(user.clientId);
      if (existing) return existing;
    }
    const effectivePosId = ACTIVE_POS_ID ?? 1;
    const newClient: Client = {
      id: generateUniqueId(),
      posId: effectivePosId,
      nombre: user.name || user.username || 'Cliente',
      telefono: '',
      email: '',
      ultimaVisita: '',
      notas: '',
      fechaRegistro: new Date().toISOString().split('T')[0],
      puntos: 0,
      status: 'active',
    };
    await set(ref(db, ROOT + '/clients/' + newClient.id), newClient);
    cacheInvalidate('clients');
    const userSnap = await get(ref(db, ROOT + '/users/' + user.username));
    const existingUser = userSnap.val() as SystemUser | null;
    if (existingUser) {
      await set(ref(db, ROOT + '/users/' + user.username), { ...existingUser, clientId: newClient.id });
    }
    return newClient;
  },

  toggleClientStatus: async (id: number): Promise<void> => {
    requireRole(['admin', 'superadmin']);
    const snap = await get(ref(db, ROOT + '/clients/' + id));
    if (!snap.exists()) return;
    const client = snap.val() as Client;
    client.status = client.status === 'active' ? 'suspended' : 'active';
    await set(ref(db, ROOT + '/clients/' + id), client);
    await DataService.logAuditAction('toggle_client', 'admin', `Toggled client ${id} status`, client.posId);
  },

  calculatePoints: (amount: number, type: 'product' | 'service') => (type === 'service' ? 20 : Math.floor(amount)),

  /** Si barberId se pasa (barbero), devuelve solo productos de ese barbero. Sin argumento: todos los de la sede (admin). */
  getProducts: async (barberId?: number): Promise<Product[]> => {
    if (ACTIVE_POS_ID == null) return [];
    let list = (await readCollectionByPos<Product>('products', ACTIVE_POS_ID, 'getProducts'))
      .map((p) => ({ ...p, id: Number(p.id), barberId: p.barberId ?? null }));
    if (barberId !== undefined) {
      list = list.filter((p) => p.barberId === barberId);
    }
    return list;
  },

  setProducts: async (data: Product[]): Promise<void> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    if (ACTIVE_POS_ID == null) throw new Error('No hay sede activa.');
    for (const product of data) {
      await set(ref(db, ROOT + '/products/' + product.id), { ...product, posId: product.posId || ACTIVE_POS_ID });
    }
  },

  addProduct: async (product: Omit<Product, 'id' | 'posId' | 'barberId'>): Promise<Product> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    if (ACTIVE_POS_ID == null) throw new Error('No Active POS');
    const role = DataService.getCurrentUserRole();
    const barberId = role === 'barbero' ? DataService.getCurrentBarberId() ?? undefined : undefined;
    const newProduct = { ...product, id: generateUniqueId(), posId: ACTIVE_POS_ID, barberId: barberId ?? null } as Product;
    await set(ref(db, ROOT + '/products/' + newProduct.id), newProduct);
    await DataService.logAuditAction('create_product', role === 'barbero' ? 'barbero' : 'admin', `Created product: ${product.producto}`, ACTIVE_POS_ID);
    return newProduct;
  },

  updateProduct: async (product: Product): Promise<void> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    const barberId = DataService.getCurrentBarberId();
    const role = DataService.getCurrentUserRole();
    if (role === 'barbero' && barberId != null && product.barberId !== barberId) {
      throw new Error('Solo puedes editar tus propios productos.');
    }
    await set(ref(db, ROOT + '/products/' + product.id), product);
  },

  getCart: (): CartItem[] => {
    try {
      const raw = localStorage.getItem('userCart') || '[]';
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },
  addToCart: (product: Product): CartItem[] => {
    const cart = DataService.getCart();
    const existing = cart.find((i) => i.id === product.id && i.type === 'producto');
    if (existing) existing.quantity += 1;
    else cart.push({ id: product.id, name: product.producto, price: product.precioVenta, quantity: 1, type: 'producto' });
    localStorage.setItem('userCart', JSON.stringify(cart));
    return cart;
  },
  updateCartQuantity: (itemId: number, quantity: number, type?: 'producto' | 'servicio'): CartItem[] => {
    let cart = DataService.getCart();
    const item = cart.find((i) => i.id === itemId && (type === undefined || i.type === type));
    if (item) {
      item.quantity = quantity;
      if (item.quantity <= 0) cart = cart.filter((i) => !(i.id === itemId && (type === undefined || i.type === type)));
    }
    localStorage.setItem('userCart', JSON.stringify(cart));
    return cart;
  },
  clearCart: () => localStorage.setItem('userCart', '[]'),

  /** Si barberId se pasa, devuelve solo servicios de la sede (barberId null) + de ese barbero. Sin argumento: todos los de la sede (admin/config). */
  getServices: async (barberId?: number): Promise<Service[]> => {
    if (ACTIVE_POS_ID == null) return [];
    let list = (await readCollectionByPos<Service>('services', ACTIVE_POS_ID, 'getServices'))
      .map((s) => ({ ...s, id: Number(s.id), barberId: s.barberId ?? null }));
    if (barberId !== undefined) {
      list = list.filter((s) => s.barberId == null || s.barberId === barberId);
    }
    return list;
  },

  saveService: async (service: Service): Promise<void> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    const barberId = DataService.getCurrentBarberId();
    const role = DataService.getCurrentUserRole();
    if (role === 'barbero' && barberId != null && service.barberId !== barberId) {
      throw new Error('Solo puedes editar tus propios servicios.');
    }
    await set(ref(db, ROOT + '/services/' + service.id), service);
  },

  addService: async (serviceData: Omit<Service, 'id' | 'posId'>): Promise<Service> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    if (ACTIVE_POS_ID == null) throw new Error('No Active POS');
    const role = DataService.getCurrentUserRole();
    const barberId = role === 'barbero' ? DataService.getCurrentBarberId() ?? undefined : undefined;
    const newService = { ...serviceData, id: generateUniqueId(), posId: ACTIVE_POS_ID, barberId: barberId ?? null } as Service;
    await set(ref(db, ROOT + '/services/' + newService.id), newService);
    await DataService.logAuditAction('create_service', role === 'barbero' ? 'barbero' : 'admin', `Created service: ${serviceData.name}`, ACTIVE_POS_ID);
    return newService;
  },

  deleteService: async (id: number): Promise<void> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    const barberId = DataService.getCurrentBarberId();
    const role = DataService.getCurrentUserRole();
    const snap = await get(ref(db, ROOT + '/services/' + id));
    if (!snap.exists()) return;
    const service = snap.val() as Service;
    if (role === 'barbero' && (service.barberId == null || service.barberId !== barberId)) {
      throw new Error('Solo puedes eliminar tus propios servicios.');
    }
    await remove(ref(db, ROOT + '/services/' + id));
    await DataService.logAuditAction('delete_service', role === 'barbero' ? 'barbero' : 'admin', `Deleted service ID: ${id}`, ACTIVE_POS_ID ?? undefined);
  },

  getBarbers: async (): Promise<Barber[]> => {
    if (ACTIVE_POS_ID == null) return [];
    const key = `barbers_${ACTIVE_POS_ID}`;
    const cached = cacheGet<Barber[]>(key);
    if (cached) return cached;
    const out = (await readCollectionByPos<Barber>('barbers', ACTIVE_POS_ID, 'getBarbers'))
      .map((b) => ({ ...b, id: Number(b.id) }));
    cacheSet(key, out);
    return out;
  },

  /** Barbers de una sede (para Admin al asignar usuario barbero). No depende de ACTIVE_POS_ID. */
  getBarbersForPos: async (posId: number): Promise<Barber[]> => {
    return (await readCollectionByPos<Barber>('barbers', posId, 'getBarbersForPos'))
      .map((b) => ({ ...b, id: Number(b.id) }));
  },

  addBarber: async (barber: Omit<Barber, 'id' | 'posId'>): Promise<Barber> => {
    requireRole(['admin', 'superadmin']);
    if (ACTIVE_POS_ID == null) throw new Error('No Active POS');
    const newBarber = JSON.parse(JSON.stringify({ ...barber, id: generateUniqueId(), posId: ACTIVE_POS_ID })) as Barber;
    if (Capacitor.isNativePlatform()) {
      await nativeRtdbSet(`${ROOT}/barbers/${newBarber.id}`, newBarber, 'addBarber');
    } else {
      await withTimeout(set(ref(db, ROOT + '/barbers/' + newBarber.id), newBarber), FIREBASE_TIMEOUT_MS, 'addBarber');
    }
    cacheInvalidate('barbers');
    await DataService.logAuditAction('create_barber', 'admin', `Created barber: ${barber.name}`, ACTIVE_POS_ID);
    return newBarber;
  },

  updateBarber: async (barber: Barber): Promise<void> => {
    requireRole(['admin', 'superadmin']);
    const sanitized = JSON.parse(JSON.stringify(barber)) as Barber;
    if (Capacitor.isNativePlatform()) {
      await nativeRtdbSet(`${ROOT}/barbers/${barber.id}`, sanitized, 'updateBarber');
    } else {
      await withTimeout(set(ref(db, ROOT + '/barbers/' + barber.id), sanitized), FIREBASE_TIMEOUT_MS, 'updateBarber');
    }
    cacheInvalidate('barbers');
  },

  /** Perfil público del peluquero: especialidad, bio, experiencia y certificaciones. El barbero solo edita el suyo. */
  updateBarberProfile: async (
    barberId: number,
    profile: {
      specialty?: string;
      bio?: string;
      yearsExperience?: number | null;
      certifications?: ProfessionalCertification[];
    }
  ): Promise<void> => {
    const role = DataService.getCurrentUserRole();
    const linkedId = DataService.getLinkedBarberId();
    if (role === 'barbero') {
      if (linkedId !== barberId) throw new Error('Solo puedes editar tu propio perfil profesional.');
    } else {
      requireRole(['admin', 'superadmin', 'dueno']);
    }
    const barber = await readNode<Barber>(`${ROOT}/barbers/${barberId}`, 'updateBarberProfile.get');
    if (!barber) throw new Error('Barbero no encontrado.');
    if (ACTIVE_POS_ID != null && Number(barber.posId) !== ACTIVE_POS_ID && role !== 'superadmin') {
      throw new Error('No puedes editar un barbero de otra sede.');
    }
    const payload: Record<string, unknown> = { ...barber, id: Number(barber.id), posId: Number(barber.posId) };
    payload.specialty = sanitizeProfileText(profile.specialty ?? barber.specialty, 120);
    const bio = sanitizeProfileText(profile.bio, PROFILE_LIMITS.bio);
    if (bio) payload.bio = bio;
    else delete payload.bio;
    const years = sanitizeYearsExperience(profile.yearsExperience);
    if (years) payload.yearsExperience = years;
    else delete payload.yearsExperience;
    const certs = sanitizeCertifications(profile.certifications);
    if (certs.length) payload.certifications = certs;
    else delete payload.certifications;
    const cleaned = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
    if (Capacitor.isNativePlatform()) {
      await nativeRtdbSet(`${ROOT}/barbers/${barberId}`, cleaned, 'updateBarberProfile');
    } else {
      await withTimeout(set(ref(db, ROOT + '/barbers/' + barberId), cleaned), FIREBASE_TIMEOUT_MS, 'updateBarberProfile');
    }
    cacheInvalidate('barbers');
  },

  /** Presentación pública de la sede: about, destacados y certificaciones del negocio. */
  updateShopPublicProfile: async (
    posId: number,
    profile: { about?: string; highlights?: string[]; certifications?: ProfessionalCertification[] }
  ): Promise<void> => {
    requireRole(['admin', 'superadmin', 'dueno']);
    const current = (await DataService.getPointsOfSale()).find((p) => p.id === posId);
    if (!current) throw new Error('Sede no encontrada.');
    const about = sanitizeProfileText(profile.about, PROFILE_LIMITS.about);
    const highlights = sanitizeHighlights(profile.highlights);
    const certifications = sanitizeCertifications(profile.certifications);
    const next: PointOfSale = { ...current };
    if (about) next.about = about;
    else delete next.about;
    if (highlights.length) next.highlights = highlights;
    else delete next.highlights;
    if (certifications.length) next.certifications = certifications;
    else delete next.certifications;
    await DataService.updatePointOfSale(next);
  },

  /** El barbero puede actualizar solo su propio horario de trabajo; admin/superadmin pueden actualizar cualquiera. */
  updateBarberWorkingHours: async (barberId: number, workingHours: BarberWorkingHours): Promise<void> => {
    const role = DataService.getCurrentUserRole();
    const currentBarberId = DataService.getCurrentBarberId();
    if (role === 'barbero' && currentBarberId !== barberId) throw new Error('Solo puedes editar tu propio horario.');
    if (role !== 'barbero') requireRole(['admin', 'superadmin']);
    const snap = await get(ref(db, ROOT + '/barbers/' + barberId));
    if (!snap.exists()) throw new Error('Barbero no encontrado.');
    const barber = snap.val() as Barber;
    const payload: Record<string, unknown> = { ...barber };
    if (workingHours && Object.keys(workingHours).length > 0) payload.workingHours = workingHours;
    else delete payload.workingHours;
    await set(ref(db, ROOT + '/barbers/' + barberId), payload);
    cacheInvalidate('barbers');
  },

  /** Horario de comida. El barbero solo puede editar el suyo. */
  updateBarberLunchBreak: async (barberId: number, lunchBreak: BarberWorkingHours): Promise<void> => {
    const role = DataService.getCurrentUserRole();
    const currentBarberId = DataService.getCurrentBarberId();
    if (role === 'barbero' && currentBarberId !== barberId) throw new Error('Solo puedes editar tu propio horario de comida.');
    if (role !== 'barbero') requireRole(['admin', 'superadmin']);
    const snap = await get(ref(db, ROOT + '/barbers/' + barberId));
    if (!snap.exists()) throw new Error('Barbero no encontrado.');
    const barber = snap.val() as Barber;
    const payload: Record<string, unknown> = { ...barber };
    if (lunchBreak && Object.keys(lunchBreak).length > 0) {
      const sanitized: Record<number, { start: string; end: string }> = {};
      for (const [day, val] of Object.entries(lunchBreak)) {
        if (val && typeof val === 'object' && val.start != null && val.end != null) sanitized[Number(day)] = { start: String(val.start), end: String(val.end) };
      }
      if (Object.keys(sanitized).length > 0) payload.lunchBreak = sanitized;
      else delete payload.lunchBreak;
    } else delete payload.lunchBreak;
    await set(ref(db, ROOT + '/barbers/' + barberId), payload);
    cacheInvalidate('barbers');
  },

  /** Bloquear/desbloquear horas (salidas). El barbero solo puede editar las suyas. */
  updateBarberBlockedHours: async (barberId: number, blockedHours: BarberBlockedSlot[]): Promise<void> => {
    const role = DataService.getCurrentUserRole();
    const currentBarberId = DataService.getCurrentBarberId();
    if (role === 'barbero' && currentBarberId !== barberId) throw new Error('Solo puedes editar tus propias horas bloqueadas.');
    if (role !== 'barbero') requireRole(['admin', 'superadmin']);
    const snap = await get(ref(db, ROOT + '/barbers/' + barberId));
    if (!snap.exists()) throw new Error('Barbero no encontrado.');
    const barber = snap.val() as Barber;
    const payload: Record<string, unknown> = { ...barber };
    if (blockedHours?.length) payload.blockedHours = blockedHours;
    else delete payload.blockedHours;
    await set(ref(db, ROOT + '/barbers/' + barberId), payload);
    cacheInvalidate('barbers');
  },

  getBarberGallery: async (barberId: number): Promise<BarberGalleryPhoto[]> => {
    const snap = await get(ref(db, ROOT + '/barberGallery/' + barberId));
    if (!snap.exists()) return [];
    const val = snap.val();
    if (val == null || typeof val !== 'object') return [];
    const obj = val as Record<string, BarberGalleryPhoto & { id?: number }>;
    return Object.entries(obj)
      .filter(([, v]) => v != null)
      .map(([k, v]) => ({ ...v, id: typeof v.id === 'number' ? v.id : Number(k) || 0 } as BarberGalleryPhoto))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },

  addBarberGalleryPhoto: async (barberId: number, data: { imageUrl?: string; serviceId?: number | null; caption?: string }): Promise<BarberGalleryPhoto> => {
    const role = DataService.getCurrentUserRole();
    const currentBarberId = DataService.getCurrentBarberId();
    if (role === 'barbero' && currentBarberId !== barberId) throw new Error('Solo puedes agregar fotos a tu propia galería.');
    if (role !== 'barbero') requireRole(['admin', 'superadmin']);
    const posId = ACTIVE_POS_ID;
    if (posId == null) throw new Error('No hay sede activa.');
    const imageUrl = data.imageUrl?.trim();
    if (!imageUrl) throw new Error('Indica una imagen (sube un archivo o pega una URL).');
    const id = generateUniqueId();
    const photo: BarberGalleryPhoto = {
      id,
      barberId,
      posId,
      imageUrl,
      serviceId: data.serviceId ?? null,
      caption: data.caption?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    const payload = JSON.parse(JSON.stringify(photo)) as Record<string, unknown>;
    await set(ref(db, ROOT + '/barberGallery/' + barberId + '/' + id), payload);
    return photo;
  },

  deleteBarberGalleryPhoto: async (barberId: number, photoId: number): Promise<void> => {
    const role = DataService.getCurrentUserRole();
    const currentBarberId = DataService.getCurrentBarberId();
    if (role === 'barbero' && currentBarberId !== barberId) throw new Error('Solo puedes eliminar fotos de tu propia galería.');
    if (role !== 'barbero') requireRole(['admin', 'superadmin']);
    await remove(ref(db, ROOT + '/barberGallery/' + barberId + '/' + photoId));
  },

  deleteBarber: async (id: number): Promise<void> => {
    requireRole(['admin', 'superadmin']);
    await remove(ref(db, ROOT + '/barbers/' + id));
    cacheInvalidate('barbers');
    await DataService.logAuditAction('delete_barber', 'admin', `Deleted barber ID: ${id}`, ACTIVE_POS_ID ?? undefined);
  },

  toggleBarberStatus: async (id: number): Promise<void> => {
    requireRole(['admin', 'superadmin']);
    const snap = await get(ref(db, ROOT + '/barbers/' + id));
    if (!snap.exists()) return;
    const barber = snap.val() as Barber;
    barber.active = !barber.active;
    await set(ref(db, ROOT + '/barbers/' + id), barber);
    cacheInvalidate('barbers');
    await DataService.logAuditAction('toggle_barber', 'admin', `Toggled barber ${id} status`, ACTIVE_POS_ID ?? undefined);
  },

  getAppointments: async (): Promise<Appointment[]> => {
    const role = DataService.getCurrentUserRole();
    const claims = getCachedClaims();
    const barberId = DataService.getCurrentBarberId();
    if (role === 'cliente' && claims?.clientId != null) {
      const key = `appointments_client_${claims.clientId}`;
      const cached = cacheGet<Appointment[]>(key);
      if (cached) return cached;
      let arr: Appointment[];
      if (Capacitor.isNativePlatform()) {
        const extra = `orderBy=${encodeURIComponent('"clienteId"')}&equalTo=${claims.clientId}`;
        const raw = await nativeRtdbGet<Record<string, Appointment> | null>(`${ROOT}/appointments`, 'getAppointments.client', extra);
        arr = snapshotToArray<Appointment>(raw).map((a) => ({ ...a, id: Number(a.id) }));
      } else {
        const q = query(ref(db, ROOT + '/appointments'), orderByChild('clienteId'), equalTo(claims.clientId));
        const snap = await withTimeout(get(q), FIREBASE_TIMEOUT_MS, 'getAppointments.client');
        arr = snapshotToArray<Appointment>(snap.val()).map((a) => ({ ...a, id: Number(a.id) }));
      }
      cacheSet(key, arr);
      return arr;
    }
    if (ACTIVE_POS_ID == null) return [];
    if ((role === 'barbero' || role === 'empleado') && barberId == null) return [];
    const key = `appointments_${ACTIVE_POS_ID}_${barberId ?? 'all'}`;
    const cached = cacheGet<Appointment[]>(key);
    if (cached) return cached;
    let arr = (await readCollectionByPos<Appointment>('appointments', ACTIVE_POS_ID, 'getAppointments'))
      .map((a) => ({ ...a, id: Number(a.id) }));
    if (barberId != null) arr = arr.filter((a) => a.barberoId === barberId);
    cacheSet(key, arr);
    return arr;
  },

  checkAppointmentConflict: async (posId: number, barberId: number, date: string, time: string): Promise<boolean> => {
    const slot = await readNode<{ estado?: string } | null>(
      `${ROOT}/busySlots/${posId}/${date}/${busySlotKey(barberId, time)}`,
      'checkAppointmentConflict.slot'
    );
    if (slot && slot.estado !== 'cancelada') return true;
    return false;
  },

  getAppointmentsByDate: async (fecha: string): Promise<Appointment[]> => {
    if (ACTIVE_POS_ID == null) return [];
    const ids = await readNode<Record<string, boolean> | null>(
      `${ROOT}/appointmentsByPosDate/${ACTIVE_POS_ID}/${fecha}`,
      'getAppointmentsByDate.index'
    );
    if (!ids) {
      const all = await DataService.getAppointments();
      return all.filter((a) => a.fecha === fecha);
    }
    const rows = await Promise.all(
      Object.keys(ids).map((id) => readNode<Appointment>(`${ROOT}/appointments/${id}`, 'getAppointmentsByDate.item'))
    );
    return rows.filter((a): a is Appointment => a != null).map((a) => ({ ...a, id: Number(a.id) }));
  },

  bookClientAppointment: async (params: {
    posId: number;
    barberoId: number;
    fecha: string;
    hora: string;
    nombre: string;
    telefono: string;
    servicios: Array<{ id: number }>;
  }): Promise<void> => {
    await createClientAppointment(params);
    cacheInvalidate('appointments');
  },

  cancelClientAppointment: async (appointmentId: number): Promise<void> => {
    await cancelMyAppointment(appointmentId);
    cacheInvalidate('appointments');
  },

  /** Añade una cita sin reemplazar las demás (para reservas de cliente o invitado). Sin undefined para evitar fallos en móvil. */
  addAppointment: async (appointment: Omit<Appointment, 'id'>): Promise<Appointment> => {
    const id = generateUniqueId();
    const apt: Appointment = { ...appointment, id };
    const toWrite = JSON.parse(JSON.stringify(apt)) as Record<string, unknown>;
    await writeNode(`${ROOT}/appointments/${id}`, toWrite, 'addAppointment');
    await syncAppointmentIndexes(apt);
    cacheInvalidate('appointments');
    cacheInvalidate('clientsActivity');
    return apt;
  },

  /** Actualiza una cita (escritura por ítem; evita leer/escribir todo el nodo). */
  updateAppointment: async (apt: Appointment): Promise<void> => {
    const role = DataService.getCurrentUserRole();
    if (role === 'cliente') {
      if (apt.estado !== 'cancelada') throw new Error('Los clientes solo pueden cancelar citas.');
      await DataService.cancelClientAppointment(apt.id);
      return;
    }
    requireRole(['admin', 'superadmin', 'barbero']);
    await set(ref(db, ROOT + '/appointments/' + apt.id), apt);
    await syncAppointmentIndexes(apt);
    cacheInvalidate('appointments');
    cacheInvalidate('clientsActivity');
  },

  /** Elimina una cita (escritura por ítem). */
  deleteAppointment: async (id: number): Promise<void> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    const existing = await readNode<Appointment>(`${ROOT}/appointments/${id}`, 'deleteAppointment.read');
    await remove(ref(db, ROOT + '/appointments/' + id));
    if (existing) await syncAppointmentIndexes(existing, true);
    cacheInvalidate('appointments');
    cacheInvalidate('clientsActivity');
  },

  /** Escribe citas por id (no reemplaza el árbol completo). */
  setAppointments: async (data: Appointment[]): Promise<void> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    for (const apt of data) {
      await set(ref(db, ROOT + '/appointments/' + apt.id), apt);
      await syncAppointmentIndexes(apt);
    }
    cacheInvalidate('appointments');
    cacheInvalidate('clientsActivity');
  },

  getSales: async (): Promise<Sale[]> => {
    if (ACTIVE_POS_ID == null) return [];
    const role = DataService.getCurrentUserRole();
    const barberId = DataService.getCurrentBarberId();
    if ((role === 'barbero' || role === 'empleado') && barberId == null) return [];
    const key = `sales_${ACTIVE_POS_ID}_${barberId ?? 'all'}`;
    const cached = cacheGet<Sale[]>(key);
    if (cached) return cached;
    let arr = (await readCollectionByPos<Sale>('sales', ACTIVE_POS_ID, 'getSales'))
      .map((s) => ({ ...s, id: Number(s.id) }));
    if (barberId != null) arr = arr.filter((s) => (s.barberoId ?? null) === barberId);
    cacheSet(key, arr);
    return arr;
  },

  /** Ventas de una sede concreta (para reportes por sede en Multi-Sede). No depende de ACTIVE_POS_ID. */
  getSalesForPos: async (posId: number): Promise<Sale[]> => {
    return (await readCollectionByPos<Sale>('sales', posId, 'getSalesForPos'))
      .map((s) => ({ ...s, id: Number(s.id) }));
  },

  /** Citas de una sede concreta (para reportes por sede en Multi-Sede). No depende de ACTIVE_POS_ID. */
  getAppointmentsForPos: async (posId: number): Promise<Appointment[]> => {
    return (await readCollectionByPos<Appointment>('appointments', posId, 'getAppointmentsForPos'))
      .map((a) => ({ ...a, id: Number(a.id) }));
  },

  /** Cuenta citas no canceladas del mes en curso para una sede (plan gratuito: límite 100/mes). */
  getAppointmentsCountCurrentMonth: async (posId: number): Promise<number> => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    let count = 0;
    const dates: string[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      dates.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    }
    const snaps = await Promise.all(
      dates.map((fecha) => readNode<Record<string, boolean> | null>(`${ROOT}/appointmentsByPosDate/${posId}/${fecha}`, 'countMonth'))
    );
    const hasIndex = snaps.some((s) => s != null);
    if (!hasIndex) {
      const list = await DataService.getAppointmentsForPos(posId);
      const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
      return list.filter((a) => a.fecha.startsWith(prefix) && a.estado !== 'cancelada').length;
    }
    for (const snap of snaps) {
      if (snap) count += Object.keys(snap).length;
    }
    return count;
  },

  /** Añade una venta (escritura por ítem; evita leer/escribir todo el nodo). */
  addSale: async (sale: Sale): Promise<void> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    if (ACTIVE_POS_ID == null) throw new Error('No hay sede activa. No se puede registrar la venta.');
    const s = { ...sale, posId: sale.posId || ACTIVE_POS_ID, barberoId: sale.barberoId ?? DataService.getCurrentBarberId() ?? undefined };
    await set(ref(db, ROOT + '/sales/' + s.id), s);
    cacheInvalidate('sales');
    cacheInvalidate('clientsActivity');
  },

  /** @deprecated Usar addSale para nuevas ventas; evita contención con muchas sedes. */
  setSales: async (data: Sale[]): Promise<void> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    if (ACTIVE_POS_ID == null) throw new Error('No hay sede activa. No se puede registrar la venta.');
    for (const sale of data) {
      const s = { ...sale, posId: sale.posId || ACTIVE_POS_ID };
      await set(ref(db, ROOT + '/sales/' + s.id), s);
    }
    cacheInvalidate('sales');
    cacheInvalidate('clientsActivity');
  },

  getFinances: async (): Promise<FinanceRecord[]> => {
    if (ACTIVE_POS_ID == null) return [];
    return (await readCollectionByPos<FinanceRecord>('finances', ACTIVE_POS_ID, 'getFinances'))
      .map((f) => ({ ...f, id: Number(f.id) }));
  },

  /** Añade un registro de finanzas (escritura por ítem). */
  addFinanceRecord: async (record: Omit<FinanceRecord, 'id'>): Promise<FinanceRecord> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    if (ACTIVE_POS_ID == null) throw new Error('No hay sede activa.');
    const id = generateUniqueId();
    const full: FinanceRecord = { ...record, id, posId: record.posId ?? ACTIVE_POS_ID };
    await set(ref(db, ROOT + '/finances/' + id), full);
    return full;
  },

  /** Actualiza un registro de finanzas (escritura por ítem). */
  updateFinanceRecord: async (record: FinanceRecord): Promise<void> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    await set(ref(db, ROOT + '/finances/' + record.id), record);
  },

  setFinances: async (data: FinanceRecord[]): Promise<void> => {
    requireRole(['admin', 'superadmin', 'barbero']);
    for (const record of data) {
      await set(ref(db, ROOT + '/finances/' + record.id), record);
    }
  },

  logNotification: async (log: Omit<NotificationLog, 'id'>): Promise<void> => {
    const id = generateUniqueId();
    await set(ref(db, ROOT + '/notificationLogs/' + id), { ...log, id });
    await DataService.logAuditAction('send_notification', 'system', `Notification to client ${log.clientId}`, log.posId);
  },

  getNotificationLogs: async (): Promise<NotificationLog[]> => {
    if (ACTIVE_POS_ID == null) return [];
    const arr = await readCollectionByPos<NotificationLog>('notificationLogs', ACTIVE_POS_ID, 'getNotificationLogs');
    return arr.map((l) => ({ ...l, id: Number(l.id) }));
  },

  logSecurityEvent: (event: string, details: unknown) => {
    console.log('[SECURITY AUDIT]', new Date().toISOString(), event, details);
    DataService.logAuditAction('security_event', 'system', event);
  },

  getGlobalStats: async () => {
    return getPlatformStats();
  },
};

