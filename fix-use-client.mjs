import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

function walkDir(dir, exts) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkDir(full, exts));
    } else if (exts.includes(extname(full))) {
      results.push(full);
    }
  }
  return results;
}

function fixFile(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const lines = raw.split('\n');

  // Find 'use client'; line index
  const ucIndex = lines.findIndex(l => l.trim() === "'use client';");
  if (ucIndex <= 0) return false; // already first or not present

  // Remove it from current position
  lines.splice(ucIndex, 1);

  // Prepend to top
  const joined = lines.join('\n');
  // Remove any leading blank lines before first content
  const withDirective = "'use client';\n" + joined.replace(/^\n+/, '');

  if (withDirective !== raw) {
    writeFileSync(filePath, withDirective, 'utf8');
    return true;
  }
  return false;
}

const root = 'D:\\Projects\\GregLite\\app';
const dirs = [join(root, 'components'), join(root, 'app')];
const exts = ['.tsx', '.ts'];

let fixed = 0;
for (const dir of dirs) {
  for (const file of walkDir(dir, exts)) {
    if (fixFile(file)) {
      console.log('Fixed:', file.replace(root + '\\', ''));
      fixed++;
    }
  }
}
console.log(`\nDone. Fixed ${fixed} files.`);
