// ESM wrapper — invokes the self-scan script via tsx in ESM context
import { createRequire } from 'module';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const result = execSync(
  `npx tsx --tsconfig ${path.join(__dirname, '..', 'tsconfig.json')} ${path.join(__dirname, 'self-scan.ts')}`,
  { cwd: path.join(__dirname, '..'), encoding: 'utf8', env: { ...process.env, TSX_TSCONFIG_PATH: path.join(__dirname, '..', 'tsconfig.json') } }
);
process.stdout.write(result);
