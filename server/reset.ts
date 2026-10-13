import fs from 'node:fs';
import path from 'node:path';

// Deletes the local database and uploads. Demo data is re-seeded on the next `npm run dev`.
const dataDir = path.resolve(process.cwd(), 'data');
try {
  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log('Removed ./data. Start the server again (npm run dev) to re-seed demo data.');
} catch (err) {
  const code = (err as NodeJS.ErrnoException).code;
  if (code === 'EPERM' || code === 'EBUSY') {
    console.error('Could not reset: the database is in use. Stop the running server (Ctrl+C in its terminal), then run npm run reset-db again.');
    process.exit(1);
  }
  throw err;
}
