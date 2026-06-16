/**
 * Backfill de coordenadas (lat/lng) para sedes sin ubicación.
 *
 * Uso:
 *   node scripts/backfill-pos-coordinates.mjs --dry-run
 *   node scripts/backfill-pos-coordinates.mjs --apply --limit=20
 */

const RTDB_BASE_URL = 'https://gen-lang-client-0624135070-default-rtdb.firebaseio.com';
const ROOT = 'barbershow';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const COUNTRY_NAMES = {
  DO: 'Dominican Republic',
  CO: 'Colombia',
  US: 'United States',
  MX: 'Mexico',
  PR: 'Puerto Rico',
  ES: 'Spain',
  PE: 'Peru',
  CL: 'Chile',
  AR: 'Argentina',
  PA: 'Panama',
};

const args = process.argv.slice(2);
const dryRun = !args.includes('--apply');
const limitArg = args.find((a) => a.startsWith('--limit='));
const limit = limitArg ? Number(limitArg.split('=')[1]) : Number.POSITIVE_INFINITY;
const delayMs = 1200;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeCountry(rawCountry) {
  const value = String(rawCountry || '').trim();
  if (!value) return '';
  const upper = value.toUpperCase();
  if (COUNTRY_NAMES[upper]) return COUNTRY_NAMES[upper];
  return value;
}

function normalizeQuery(pos) {
  const country = normalizeCountry(pos.country);
  const chunks = [pos.address, pos.barrio, pos.city, country]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean);
  return chunks.join(', ');
}

async function geocodePos(pos) {
  const q = normalizeQuery(pos);
  const hasCountry = Boolean(normalizeCountry(pos.country));
  const hasCityLike = Boolean(String(pos.city || '').trim() || String(pos.address || '').trim());
  if (!hasCountry || !hasCityLike) return null;
  if (!q) return null;
  const params = new URLSearchParams({
    q,
    format: 'json',
    addressdetails: '1',
    limit: '1',
  });
  const res = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'BarberShow/1.0 (backfill-coordinates)',
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  const first = data[0];
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const expectedCode = String(pos.country || '').trim().toLowerCase();
  const responseCode = String(first?.address?.country_code || '').trim().toLowerCase();
  if (expectedCode && expectedCode.length === 2 && responseCode && expectedCode !== responseCode) {
    return null;
  }
  return { lat, lng, query: q };
}

async function loadPos() {
  const res = await fetch(`${RTDB_BASE_URL}/${ROOT}/pointsOfSale.json`);
  if (!res.ok) throw new Error(`No se pudo cargar pointsOfSale. HTTP ${res.status}`);
  const data = await res.json();
  return data && typeof data === 'object' ? data : {};
}

async function patchPos(id, payload) {
  const res = await fetch(`${RTDB_BASE_URL}/${ROOT}/pointsOfSale/${id}.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`No se pudo actualizar sede ${id}. HTTP ${res.status}`);
}

async function main() {
  const all = await loadPos();
  const entries = Object.entries(all);
  const pending = entries.filter(([, pos]) => {
    const latOk = typeof pos?.lat === 'number' && Number.isFinite(pos.lat);
    const lngOk = typeof pos?.lng === 'number' && Number.isFinite(pos.lng);
    return !(latOk && lngOk);
  });

  console.log(`Sedes totales: ${entries.length}`);
  console.log(`Sedes sin coordenadas: ${pending.length}`);
  console.log(`Modo: ${dryRun ? 'DRY-RUN' : 'APPLY'}`);

  let processed = 0;
  let updated = 0;
  let skipped = 0;

  for (const [id, pos] of pending) {
    if (processed >= limit) break;
    processed += 1;
    const geo = await geocodePos(pos);
    if (!geo) {
      skipped += 1;
      console.log(`- [skip] ${id} "${pos?.name || 'Sin nombre'}" (sin resultado)`);
      await sleep(delayMs);
      continue;
    }

    const payload = {
      lat: geo.lat,
      lng: geo.lng,
      locationUpdatedAt: new Date().toISOString(),
    };
    if (!dryRun) {
      await patchPos(id, payload);
    }
    updated += 1;
    console.log(`- [ok] ${id} "${pos?.name || 'Sin nombre'}" -> ${geo.lat.toFixed(6)}, ${geo.lng.toFixed(6)} | ${geo.query}`);
    await sleep(delayMs);
  }

  console.log('');
  console.log(`Procesadas: ${processed}`);
  console.log(`Actualizadas: ${updated}`);
  console.log(`Omitidas: ${skipped}`);
}

main().catch((err) => {
  console.error('Error en backfill:', err?.message || err);
  process.exit(1);
});

