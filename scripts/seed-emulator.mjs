/**
 * Siembra la RTDB del emulador con una sede, un peluquero y un cliente.
 * Requiere emuladores en marcha: npm run emulators
 *
 * Uso: npm run seed:emulator
 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const functionsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'functions');
const require = createRequire(join(functionsDir, 'package.json'));
const admin = require('firebase-admin');
const lib = require('./lib/lib.js');

const PROJECT_ID = 'gen-lang-client-0624135070';
const ROOT = 'barbershow';
const PASSWORD = 'Test1234';

process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.FIREBASE_DATABASE_EMULATOR_HOST = '127.0.0.1:9000';
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: PROJECT_ID,
    databaseURL: `http://127.0.0.1:9000?ns=${PROJECT_ID}`,
  });
}

const isoDay = (offset) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const workingHours = {
  1: { start: '09:00', end: '19:00' },
  2: { start: '09:00', end: '19:00' },
  3: { start: '09:00', end: '19:00' },
  4: { start: '09:00', end: '19:00' },
  5: { start: '09:00', end: '19:00' },
  6: { start: '09:00', end: '17:00' },
};
const lunchBreak = {
  1: { start: '13:00', end: '14:00' },
  2: { start: '13:00', end: '14:00' },
  3: { start: '13:00', end: '14:00' },
  4: { start: '13:00', end: '14:00' },
  5: { start: '13:00', end: '14:00' },
};

const POS_ID = 1;
const BARBER_ID = 101;
const CLIENT_ID = 201;
const WALKIN_ID = 202;
const SVC_CORTE = 301;
const SVC_BARBA = 302;
const SVC_FADE = 303;
const today = isoDay(0);
const yesterday = isoDay(-1);
const tomorrow = isoDay(1);

const corte = { id: SVC_CORTE, posId: POS_ID, name: 'Corte clásico', price: 450, duration: 30, barberId: null };
const barba = { id: SVC_BARBA, posId: POS_ID, name: 'Arreglo de barba', price: 250, duration: 20, barberId: null };
const fade = { id: SVC_FADE, posId: POS_ID, name: 'Fade + cejas', price: 650, duration: 45, barberId: null };

const seed = {
  pointsOfSale: {
    [POS_ID]: {
      id: POS_ID,
      name: 'Barbería El Corte',
      address: 'Av. Winston Churchill 12, Piantini',
      country: 'DO',
      city: 'Santo Domingo',
      barrio: 'Piantini',
      lat: 18.4741,
      lng: -69.9312,
      ownerId: 'dueno',
      isActive: true,
      plan: 'pro',
      tier: 'barberia',
      subscriptionExpiresAt: isoDay(60) + 'T23:59:59.000Z',
    },
  },
  settings: {
    [POS_ID]: {
      posId: POS_ID,
      taxRate: 0,
      storeName: 'Barbería El Corte',
      currencySymbol: 'RD$',
    },
  },
  globalSettings: {
    appName: 'BarberShow',
    primaryColor: '#ffd427',
    secondaryColor: '#111827',
    termsAndConditions: 'Términos de prueba del emulador.',
    privacyPolicy: 'Privacidad de prueba del emulador.',
    cookiePolicy: 'Cookies de prueba del emulador.',
    supportEmail: 'soporte@barbershow.test',
    maintenanceMode: false,
  },
  barbers: {
    [BARBER_ID]: {
      id: BARBER_ID,
      posId: POS_ID,
      name: 'Carlos Peña',
      specialty: 'Fade y barba',
      active: true,
      workingHours,
      lunchBreak,
      blockedHours: [],
    },
  },
  clients: {
    [CLIENT_ID]: {
      id: CLIENT_ID,
      posId: POS_ID,
      nombre: 'Ana López',
      telefono: '8095550101',
      email: 'ana@cliente.test',
      ultimaVisita: yesterday,
      notas: 'Cliente frecuente. Prefiere fade medio.',
      fechaRegistro: isoDay(-40),
      puntos: 120,
      status: 'active',
      whatsappOptIn: true,
    },
    [WALKIN_ID]: {
      id: WALKIN_ID,
      posId: POS_ID,
      nombre: 'Pedro Martínez',
      telefono: '8095550102',
      email: '',
      ultimaVisita: yesterday,
      notas: 'Walk-in sin cuenta de app.',
      fechaRegistro: yesterday,
      puntos: 0,
      status: 'active',
      whatsappOptIn: false,
    },
  },
  services: {
    [SVC_CORTE]: corte,
    [SVC_BARBA]: barba,
    [SVC_FADE]: fade,
  },
  products: {
    401: {
      id: 401,
      posId: POS_ID,
      barberId: null,
      producto: 'Cera mate',
      categoria: 'Styling',
      stock: 12,
      precioCompra: 180,
      precioVenta: 350,
      estado: 'activo',
    },
    402: {
      id: 402,
      posId: POS_ID,
      barberId: BARBER_ID,
      producto: 'Aceite para barba',
      categoria: 'Cuidado',
      stock: 8,
      precioCompra: 220,
      precioVenta: 450,
      estado: 'activo',
    },
  },
  users: {
    dueno: {
      username: 'dueno',
      role: 'dueno',
      name: 'Luis Dueño',
      posId: POS_ID,
      status: 'active',
      loginAttempts: 0,
    },
    barbero: {
      username: 'barbero',
      role: 'barbero',
      name: 'Carlos Peña',
      posId: POS_ID,
      barberId: BARBER_ID,
      status: 'active',
      loginAttempts: 0,
    },
    cliente: {
      username: 'cliente',
      role: 'cliente',
      name: 'Ana López',
      posId: POS_ID,
      clientId: CLIENT_ID,
      status: 'active',
      loginAttempts: 0,
    },
  },
  clientPreferences: {
    cliente: { preferredPosId: POS_ID },
  },
  appointments: {
    501: {
      id: 501,
      posId: POS_ID,
      clienteId: CLIENT_ID,
      barberoId: BARBER_ID,
      fecha: yesterday,
      hora: '16:00',
      servicios: [fade],
      notas: 'Fade medio, cejas marcadas.',
      duracionTotal: 45,
      total: 650,
      estado: 'completada',
      fechaCreacion: yesterday + 'T15:10:00.000Z',
    },
    502: {
      id: 502,
      posId: POS_ID,
      clienteId: CLIENT_ID,
      barberoId: BARBER_ID,
      fecha: today,
      hora: '10:00',
      servicios: [corte, barba],
      notas: 'Cita de Ana para hoy.',
      duracionTotal: 50,
      total: 700,
      estado: 'confirmada',
      fechaCreacion: isoDay(-1) + 'T12:00:00.000Z',
    },
    503: {
      id: 503,
      posId: POS_ID,
      clienteId: WALKIN_ID,
      barberoId: BARBER_ID,
      fecha: today,
      hora: '11:00',
      servicios: [corte],
      notas: 'Walk-in de Pedro.',
      duracionTotal: 30,
      total: 450,
      estado: 'pendiente',
      fechaCreacion: today + 'T09:15:00.000Z',
    },
    504: {
      id: 504,
      posId: POS_ID,
      clienteId: CLIENT_ID,
      barberoId: BARBER_ID,
      fecha: tomorrow,
      hora: '15:00',
      servicios: [fade],
      notas: 'Reserva de Ana para mañana.',
      duracionTotal: 45,
      total: 650,
      estado: 'confirmada',
      fechaCreacion: today + 'T08:00:00.000Z',
    },
  },
  sales: {
    601: {
      id: 601,
      posId: POS_ID,
      numeroVenta: 'V-1001',
      clienteId: CLIENT_ID,
      barberoId: BARBER_ID,
      items: [{ id: SVC_FADE, name: fade.name, price: fade.price, quantity: 1, type: 'servicio' }],
      metodoPago: 'efectivo',
      subtotal: 650,
      iva: 0,
      total: 650,
      fecha: yesterday,
      hora: '16:45',
      notas: 'Cita cobrada',
      estado: 'completada',
    },
  },
  finances: {
    701: {
      id: 701,
      posId: POS_ID,
      fecha: yesterday,
      ingresos: 650,
      egresos: 0,
      ventas: [601],
      gastos: [],
    },
  },
};

async function main() {
  const db = admin.database();
  const hash = lib.hashPasswordNode(PASSWORD);
  const now = new Date().toISOString();

  await db.ref(ROOT).set(seed);
  for (const username of Object.keys(seed.users)) {
    await db.ref(`${ROOT}/authSecrets/${username}`).set({
      passwordHash: hash,
      migratedAt: now,
    });
  }

  const users = await db.ref(`${ROOT}/users`).get();
  const secrets = await db.ref(`${ROOT}/authSecrets`).get();
  if (!users.exists() || !secrets.exists()) {
    throw new Error('La siembra no escribió users/authSecrets.');
  }

  console.log('Emulador listo. Base de prueba (no producción).');
  console.log('App: http://localhost:3000');
  console.log('Contraseña de todas las cuentas: ' + PASSWORD);
  console.log('  peluquero  usuario=barbero   rol=barbero');
  console.log('  cliente    usuario=cliente   rol=cliente');
  console.log('  dueño      usuario=dueno     rol=dueno (opcional)');
  console.log('Sede: Barbería El Corte (Piantini). Citas hoy 10:00 y 11:00, mañana 15:00.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
