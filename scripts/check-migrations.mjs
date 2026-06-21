import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('../backend/supabase/migrations/', import.meta.url));
const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
if (!files.length) throw new Error('No Supabase migrations were found.');

const seenPrefixes = new Set();
for (const file of files) {
  const match = /^(\d{12})_[a-z0-9_]+\.sql$/.exec(file);
  if (!match) throw new Error(`Migration filename is invalid: ${file}`);
  if (seenPrefixes.has(match[1])) throw new Error(`Migration prefix is duplicated: ${match[1]}`);
  seenPrefixes.add(match[1]);
  const sql = await readFile(join(directory, file), 'utf8');
  if (!sql.trim()) throw new Error(`Migration is empty: ${file}`);
  if (/SUPABASE_(SERVICE_ROLE_KEY|DB_PASSWORD)|postgres(?:ql)?:\/\//i.test(sql)) {
    throw new Error(`Migration appears to contain a credential: ${file}`);
  }
}

console.log(`Validated ${files.length} ordered Supabase migrations.`);
