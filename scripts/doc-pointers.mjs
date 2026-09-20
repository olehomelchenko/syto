#!/usr/bin/env node
// lint:docs — every source path a document sets off as code resolves in the tree.
//
// A pointer is an address, not prose. Checking prose by machine does not work;
// checking an address does, and the rename that misses a document is the drift
// this catches. The 2026-07-26 practice audit measured 27 wrong statements
// across this repository's documents and called a check of exactly this shape
// the cheapest missing instrument in the three sibling repositories.
//
// What it reads: every backticked token in a document that starts with one of
// the ROOTS below. A markdown link's target is read too, because a link that
// lands nowhere fails the reader the same way.
//
// What it skips, each for a reason a reader can check:
//
//   - a token carrying a glob or a brace. `src/core/transforms-*.test.ts` and
//     `src/i18n/locales/{en,uk}/ui.json` are notation for a set, and a document
//     naming a family this way is being precise rather than wrong.
//   - a trailing `:12` or `:12-40` line reference, stripped before the test.
//   - the files in SKIP below.
//
// The check is one-directional on purpose: it fails on a path that names
// nothing. It says nothing about a module no document mentions, which is a
// judgment about what deserves documenting.
//
// docs/HARNESS.md -> The doc-pointer check.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// A path prefix that names a place in this tree. `app/` and `tools/` are left
// out: both exist at the root as HTML entry directories AND as shorthand for
// `src/app/`, so a token starting with either is ambiguous rather than wrong.
const ROOTS = /^(src|scripts|styles|public|docs)\//;

// docs/PRACTICE-AUDIT.md is a frozen audit. It QUOTES broken pointers as its
// evidence — the wrong paths in it are the finding, and correcting them would
// erase what the document reports. A point-in-time memo that cites the tree as
// it was on its own date belongs here for the same reason.
const SKIP = new Set(['docs/PRACTICE-AUDIT.md']);

const DOC_ROOTS = ['docs', 'src/content'];
const ROOT_DOCS = ['README.md', 'AGENTS.md', 'CLAUDE.md', 'SOUL.md'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-cli', '.git']);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (name.endsWith('.md')) out.push(path);
  }
  return out;
}

/** Backticked spans, and the targets of markdown links. */
function pointersIn(line) {
  const found = [];
  for (const m of line.matchAll(/`([^`\n]+)`/g)) found.push(m[1]);
  for (const m of line.matchAll(/\]\(([^)\s]+)\)/g)) found.push(m[1]);
  return found;
}

/** The path a token names, or null when the token is not one to check. */
function resolvable(token) {
  // A backticked span is often a command, not a bare path — `scripts/markers.mjs
  // --file` names a script and then how to call it. The first whitespace-
  // separated field is the path; the rest is the caller's business. Taking the
  // whole span instead reports every documented command as a missing file.
  let path = token.trim().split(/\s+/)[0];
  // A link written relative to docs/ reaches the tree through `../`.
  path = path.replace(/^(\.\.\/)+/, '');
  if (!ROOTS.test(path)) return null;
  if (/[*?{}<>]/.test(path)) return null;
  path = path.replace(/[:#]\d+([-–]\d+)?$/, '').replace(/[.,;:)]+$/, '');
  return path || null;
}

const docs = [...DOC_ROOTS.flatMap((d) => walk(d)), ...ROOT_DOCS.filter(existsSync)].filter(
  (f) => !SKIP.has(f)
);

let checked = 0;
const unresolved = [];
for (const file of docs) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      for (const token of pointersIn(line)) {
        const path = resolvable(token);
        if (!path) continue;
        checked++;
        if (!existsSync(path)) unresolved.push({ file, line: i + 1, path });
      }
    });
}

console.log(`Doc pointers: ${checked} checked in ${docs.length} documents`);

if (unresolved.length) {
  console.error(`\n${unresolved.length} pointer(s) name nothing in the tree:`);
  for (const u of unresolved) console.error(`    ${u.file}:${u.line}  ${u.path}`);
  console.error(
    '\nCorrect the path, or make it a family with a glob when the document means a set.'
  );
  process.exit(1);
}
