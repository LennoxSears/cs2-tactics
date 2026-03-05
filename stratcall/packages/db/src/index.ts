import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema.js';

export * from './schema.js';
export { schema };

export function createDb(url: string, authToken?: string) {
  const client = createClient({
    url,
    authToken,
  });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;
