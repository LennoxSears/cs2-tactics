import { createDb } from '@stratcall/db';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Use the same DB file as the migration (packages/db/local.db)
const defaultDbPath = resolve(__dirname, '../../../packages/db/local.db');
const url = process.env.TURSO_DATABASE_URL || `file:${defaultDbPath}`;
const authToken = process.env.TURSO_AUTH_TOKEN;

export const db = createDb(url, authToken);
