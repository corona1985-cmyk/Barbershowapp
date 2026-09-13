/**
 * Falla si las reglas RTDB vuelven a abrir acceso anónimo amplio
 * o escrituras públicas.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rules = JSON.parse(readFileSync(join(root, 'database.rules.json'), 'utf8'));

function fail(msg) {
  console.error('[security] ' + msg);
  process.exit(1);
}

const barbershow = rules?.rules?.barbershow;
if (!barbershow) fail('No existe rules.barbershow');
if (barbershow['.read'] === true || barbershow['.read'] === 'true') fail('barbershow tiene .read público');
if (barbershow['.write'] === true || barbershow['.write'] === 'true') fail('barbershow tiene .write público');
if (rules.rules['.read'] === true || rules.rules['.read'] === 'true') fail('raíz .read pública');
if (rules.rules['.write'] === true || rules.rules['.write'] === 'true') fail('raíz .write pública');

const allowedPublicRead = new Set(['globalSettings', 'publicShops']);
const allowedPublicReadPaths = new Set(['barbershow/busySlots/$posId/$fecha']);

function isAllowedPublicRead(path) {
  const leaf = path.split('/').pop();
  return allowedPublicRead.has(leaf) || allowedPublicReadPaths.has(path);
}

function walk(node, path) {
  if (!node || typeof node !== 'object') return;
  if (Object.prototype.hasOwnProperty.call(node, '.write')) {
    const w = node['.write'];
    if (w === true || w === 'true') fail(`write público en ${path || '/'}`);
  }
  if (Object.prototype.hasOwnProperty.call(node, '.read')) {
    const r = node['.read'];
    if (r === true || r === 'true' || (typeof r === 'string' && r.trim() === 'true')) {
      if (!isAllowedPublicRead(path)) fail(`read público no justificado en ${path || '/'}`);
    }
  }
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith('.')) continue;
    walk(v, path ? `${path}/${k}` : k);
  }
}

walk(barbershow, 'barbershow');
console.log('[security] RTDB rules lock check OK');
