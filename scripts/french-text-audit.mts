import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const IGNORED_DIRS = new Set(['.git', '.agents', '.codex', '.next', 'coverage', 'dist', 'node_modules', 'out']);
const IGNORED_FILES = new Set(['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock']);
const TEXT_EXTENSIONS = new Set([
  '.css',
  '.htm',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
  '.txt',
  '.xml',
  '.yaml',
  '.yml',
]);

type AuditIssue = {
  file: string;
  line: number;
  motif: string;
  excerpt: string;
};

const suspiciousPatterns: Array<{ motif: string; pattern: RegExp }> = [
  { motif: 'replacement_character', pattern: /\uFFFD|\u00EF\u00BF\u00BD/gu },
  { motif: 'mojibake_c3', pattern: /\u00C3[\u0080-\u00BF]/gu },
  { motif: 'mojibake_e2', pattern: /\u00E2[\u0080-\u00BF]/gu },
  { motif: 'mojibake_c2', pattern: /\u00C2[\u00A0-\u00BF]/gu },
  { motif: 'mojibake_f0', pattern: /\u00F0[\u009F-\u00BF]/gu },
];

function isIgnoredDirectory(name: string) {
  return IGNORED_DIRS.has(name);
}

function isTextFile(filePath: string) {
  const baseName = path.basename(filePath);
  if (IGNORED_FILES.has(baseName)) {
    return false;
  }

  const ext = path.extname(baseName).toLowerCase();
  if (TEXT_EXTENSIONS.has(ext)) {
    return true;
  }

  return ['Dockerfile', 'LICENSE', 'README', 'README.md'].includes(baseName);
}

function normalizeExcerpt(line: string, maxLength = 160) {
  const compact = line.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength - 1)}...`;
}

function detectControlCharacters(line: string) {
  const codes = new Set<string>();

  for (const char of line) {
    const code = char.codePointAt(0);
    if (code === undefined) {
      continue;
    }

    const isAllowedWhitespace = code === 0x09 || code === 0x0a || code === 0x0d;
    const isC0Control = code >= 0x00 && code <= 0x1f && !isAllowedWhitespace;
    const isC1Control = code >= 0x7f && code <= 0x9f;

    if (isC0Control || isC1Control) {
      codes.add(`U+${code.toString(16).toUpperCase().padStart(4, '0')}`);
    }
  }

  return [...codes];
}

async function* walk(directory: string): AsyncGenerator<string> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith('.') && isIgnoredDirectory(entry.name)) {
      continue;
    }

    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (isIgnoredDirectory(entry.name)) {
        continue;
      }

      yield* walk(fullPath);
      continue;
    }

    if (entry.isFile() && isTextFile(fullPath)) {
      yield fullPath;
    }
  }
}

function relativePath(filePath: string) {
  return path.relative(projectRoot, filePath).split(path.sep).join('/');
}

async function main() {
  const issues: AuditIssue[] = [];
  let scannedFiles = 0;

  for await (const filePath of walk(projectRoot)) {
    scannedFiles += 1;

    let content: string;
    try {
      content = await fs.readFile(filePath, 'utf8');
    } catch {
      continue;
    }

    if (content.includes('\u0000')) {
      issues.push({
        file: relativePath(filePath),
        line: 1,
        motif: 'binary_or_control_character',
        excerpt: '[file skipped: null character detected]',
      });
      continue;
    }

    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const { motif, pattern } of suspiciousPatterns) {
        if (pattern.test(line)) {
          issues.push({
            file: relativePath(filePath),
            line: index + 1,
            motif,
            excerpt: normalizeExcerpt(line),
          });
        }
        pattern.lastIndex = 0;
      }

      const controls = detectControlCharacters(line);
      if (controls.length > 0) {
        issues.push({
          file: relativePath(filePath),
          line: index + 1,
          motif: `control_character:${controls.join(',')}`,
          excerpt: normalizeExcerpt(line),
        });
      }
    });
  }

  if (issues.length === 0) {
    console.log(`No encoding issues detected across ${scannedFiles} text files.`);
    return;
  }

  for (const issue of issues) {
    console.log(`${issue.file}:${issue.line} | ${issue.motif} | ${issue.excerpt}`);
  }

  console.log(`Total: ${issues.length} issue(s) detected across ${scannedFiles} text files.`);
  process.exitCode = 1;
}

void main();
