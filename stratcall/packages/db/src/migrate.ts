import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url) {
    console.error('TURSO_DATABASE_URL is required');
    process.exit(1);
  }

  console.log(`Migrating database: ${url}`);

  const client = createClient({ url, authToken });
  const db = drizzle(client);

  await migrate(db, { migrationsFolder: './migrations' });

  console.log('Migration complete');
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
