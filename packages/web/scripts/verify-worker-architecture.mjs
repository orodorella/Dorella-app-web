import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const sourceRoot = path.resolve('src');
const forbidden = [
  { pattern: /@prisma\/client/, label: '@prisma/client' },
  { pattern: /\bPrismaClient\b/, label: 'PrismaClient' },
  { pattern: /\bDATABASE_URL\b/, label: 'DATABASE_URL' },
  { pattern: /postgres(?:ql)?:\/\//, label: 'a PostgreSQL connection string' },
];

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.(?:ts|tsx|js|jsx|mjs)$/.test(entry.name) ? [target] : [];
  }));
  return nested.flat();
}

const violations = [];
for (const file of await sourceFiles(sourceRoot)) {
  const contents = await readFile(file, 'utf8');
  for (const rule of forbidden) {
    if (rule.pattern.test(contents)) {
      violations.push(`${path.relative(process.cwd(), file)} imports or references ${rule.label}`);
    }
  }
}

if (violations.length > 0) {
  console.error(
    'Cloudflare architecture check failed. packages/web must access PostgreSQL through the Railway API:\n' +
      violations.map((violation) => `- ${violation}`).join('\n'),
  );
  process.exit(1);
}

console.log('Architecture check passed: packages/web has no direct Prisma/PostgreSQL access.');
