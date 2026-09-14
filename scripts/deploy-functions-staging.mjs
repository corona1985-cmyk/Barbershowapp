/**
 * Despliega SOLO Cloud Functions a un proyecto staging.
 * Rechaza el proyecto de producción y cualquier deploy que incluya rules/hosting.
 *
 * Uso:
 *   node scripts/deploy-functions-staging.mjs <project-id>
 *   npm run deploy:functions:staging -- <project-id>
 */
import { spawnSync } from 'node:child_process';

const PRODUCTION_PROJECT = 'gen-lang-client-0624135070';
const project = String(process.argv[2] || process.env.FIREBASE_STAGING_PROJECT || '').trim();

if (!project) {
  console.error('[deploy] Falta el project ID de staging.');
  console.error('Ejemplo: npm run deploy:functions:staging -- barbershow-staging');
  process.exit(1);
}

if (project === PRODUCTION_PROJECT) {
  console.error('[deploy] Rechazado: gen-lang-client-0624135070 es producción.');
  console.error('Crea un proyecto Firebase de staging y pásalo como argumento.');
  process.exit(1);
}

const extra = process.argv.slice(3).join(' ');
if (/\b(database|firestore|hosting|storage|rules)\b/i.test(extra)) {
  console.error('[deploy] Rechazado: este comando solo admite --only functions.');
  process.exit(1);
}

console.log(`[deploy] Functions only → ${project} (sin rules, sin hosting, sin prod)`);
const env = { ...process.env, FUNCTIONS_DISCOVERY_TIMEOUT: process.env.FUNCTIONS_DISCOVERY_TIMEOUT || '60' };
const result = spawnSync(
  'npx',
  ['firebase', 'deploy', '--only', 'functions', '--project', project],
  { stdio: 'inherit', shell: process.platform === 'win32', env }
);
process.exit(result.status ?? 1);
