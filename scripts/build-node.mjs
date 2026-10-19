import { spawnSync } from 'node:child_process';
import { mkdirSync, cpSync } from 'node:fs';
const result = spawnSync(process.execPath, ['node_modules/next/dist/bin/next', 'build', '--webpack'], {
  stdio: 'inherit', env: { ...process.env, SATOR_TARGET: 'node', NEXT_TELEMETRY_DISABLED: '1' },
});
if (result.status !== 0) process.exit(result.status || 1);
mkdirSync('.next/standalone/.next', { recursive: true });
cpSync('.next/static', '.next/standalone/.next/static', { recursive: true });
cpSync('public', '.next/standalone/public', { recursive: true });
cpSync('drizzle', '.next/standalone/drizzle', { recursive: true });
console.log('Standalone Node build ready. Set SATOR_DATA_DIR and run node .next/standalone/server.js behind HTTPS.');
