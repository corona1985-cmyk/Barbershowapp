/**
 * Script para buscar un usuario en Firebase Realtime Database por nombre o username.
 * Uso: node scripts/search-user.mjs "alexis corona"
 */
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, get } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyDDHc3BVRBU8CE2SRPhIzqK0aLQ_gcgAhA",
  authDomain: "gen-lang-client-0624135070.firebaseapp.com",
  databaseURL: "https://gen-lang-client-0624135070-default-rtdb.firebaseio.com",
  projectId: "gen-lang-client-0624135070",
  storageBucket: "gen-lang-client-0624135070.firebasestorage.app",
  messagingSenderId: "826588844097",
  appId: "1:826588844097:web:4e5db3f03d7bb52ec7b6c0",
  measurementId: "G-1QKXNNZCWM"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const searchTerm = (process.argv[2] || 'alexis corona').toLowerCase();

/** Un solo nombre de plan: Normal, Pro o Full (según tier de la sede). */
function getDisplayPlanName(tier) {
  if (tier === 'multisede') return 'Full';
  if (tier === 'barberia') return 'Pro';
  return 'Normal';
}

async function main() {
  const usersRef = ref(db, 'barbershow/users');
  const snap = await get(usersRef);
  const data = snap.val() || {};
  const users = Object.entries(data).map(([username, u]) => ({ username, ...u }));

  const matches = users.filter((u) => {
    const name = (u.name || '').toLowerCase();
    const uname = (u.username || '').toLowerCase();
    const terms = searchTerm.split(/\s+/).filter(Boolean);
    return terms.every((t) => name.includes(t) || uname.includes(t));
  });

  if (matches.length === 0) {
    console.log('No se encontró ningún usuario que coincida con:', process.argv[2] || 'alexis corona');
    console.log('Usuarios en la base de datos:', users.length);
    users.forEach((u) => console.log(' -', u.username, '|', u.name, '|', u.role, '| posId:', u.posId, '| plan/tier: ver sede'));
    return;
  }

  console.log('Usuario(s) encontrado(s):\n');
  for (const u of matches) {
    console.log('Username:', u.username);
    console.log('Nombre:', u.name);
    console.log('Rol:', u.role);
    console.log('posId:', u.posId);
    console.log('barberId:', u.barberId);
    console.log('status:', u.status);
    console.log('---');
  }

  // Plan/tier viene de la sede (PointOfSale), no del usuario
  const posRef = ref(db, 'barbershow/pointsOfSale');
  const posSnap = await get(posRef);
  const posData = posSnap.val() || {};
  const sedes = Object.entries(posData).map(([id, p]) => ({ id: Number(id), ...p }));

  for (const u of matches) {
    if (u.posId != null) {
      const sede = sedes.find((s) => s.id === u.posId);
      if (sede) {
        const planName = getDisplayPlanName(sede.tier || 'solo');
        console.log(`Sede de ${u.name}: ${sede.name} | Plan: ${planName}`);
      }
    }
  }
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
