import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const directory = fileURLToPath(new URL('../.github/workflows/', import.meta.url));
const files = (await readdir(directory)).filter((file) => /\.ya?ml$/.test(file)).sort();
if (!files.length) throw new Error('No GitHub Actions workflows were found.');

for (const file of files) {
  const workflow = parse(await readFile(join(directory, file), 'utf8'));
  if (!workflow || typeof workflow !== 'object') throw new Error(`Workflow is not an object: ${file}`);
  if (!workflow.name || !workflow.on || !workflow.jobs) throw new Error(`Workflow is missing name, on, or jobs: ${file}`);
  if (!Object.keys(workflow.jobs).length) throw new Error(`Workflow has no jobs: ${file}`);
}

console.log(`Validated ${files.length} GitHub Actions workflows.`);
