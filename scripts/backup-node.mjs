import { backup } from 'node:sqlite';
import { mkdir, cp, access } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { env } from '../runtime/node.mjs';
// Stop the application first so the DB snapshot and media inventory agree.
const destination = process.argv[2];
if (!destination || !process.env.SATOR_DATA_DIR) throw new Error('Usage: SATOR_DATA_DIR=/persistent/data node scripts/backup-node.mjs /new/snapshot-directory (with app stopped)');
try { await access(destination); throw new Error('Choose a new backup directory; existing backups are never replaced.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const source = resolve(process.env.SATOR_DATA_DIR);
if (resolve(destination) === source || resolve(destination).startsWith(source + '/')) throw new Error('Backup destination must be outside the data directory.');
void env.BUCKET;
await mkdir(destination, { recursive: true, mode: 0o700 });
await backup(env.DB.sqlite, join(resolve(destination), 'sator.sqlite'));
await cp(join(resolve(process.env.SATOR_DATA_DIR), 'assets'), join(resolve(destination), 'assets'), { recursive: true });
env.DB.close();
console.log('Database and private media snapshot created. Keep it outside the source repository and encrypt any off-server copy.');
