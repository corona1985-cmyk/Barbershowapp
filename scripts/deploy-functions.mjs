import { spawnSync } from 'node:child_process';

const env = {
  ...process.env,
  FUNCTIONS_DISCOVERY_TIMEOUT: process.env.FUNCTIONS_DISCOVERY_TIMEOUT || '60',
};

const extra = process.argv.slice(2);
const args = extra.length ? extra : ['--only', 'functions'];
if (!args.includes('--only')) {
  args.unshift('--only', 'functions');
}

const result = spawnSync('npx', ['firebase', 'deploy', ...args], {
  stdio: 'inherit',
  shell: true,
  env,
});
process.exit(result.status ?? 1);
