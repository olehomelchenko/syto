#!/usr/bin/env node
// lint:house — the absolute source bans, checked over the tree or one file.
//
// Each rule here is stated with no escape hatch in AGENTS.md or SOUL.md, and
// each is decidable by a pattern match. That combination is what makes a rule a
// check that runs rather than prose a session may have dropped forty tool calls
// ago. A rule that needs judgment stays prose and goes to /alignment.
//
// This script is the one implementation. CI runs it over every source file
// (`npm run lint:house`), and .claude/hooks/house-rules.sh runs it with --file
// after each edit, so the refusal an agent meets mid-edit is the refusal the
// build gives. A second grammar in the hook is what that replaces.
//
// Every rule is about what the code DOES, so the check reads code and not
// prose. Comments are stripped first: a ban's own prose names what it bans, and
// src/core/ast-interpreter.ts documents itself as the module that exists so no
// user input is ever evaluated. Stripping can only cause a miss, never a false
// report — a comment holding a real call is not a real call.
//
// Exit 1 with the findings on stderr; exit 0 and silent otherwise. A path
// outside src/ or not a .ts/.tsx file is out of scope and reports nothing, so
// the hook needs no scope test of its own.
//
// docs/HARNESS.md -> The house rules.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';

const root = process.cwd();

const RULES = [
  {
    pattern: /\beval\s*\(|\bnew\s+Function\s*\(/,
    message:
      'eval() or new Function() appears in the source. The ban has no escape\n' +
      '  hatch: user expressions are parsed by jsep and walked by the interpreter\n' +
      '  in src/core/ast-interpreter.ts, against the whitelist in\n' +
      '  src/core/ast-validator.ts. Extend the whitelist to add a capability.\n' +
      '  The reason is in AGENTS.md -> Security Requirements.',
  },
  {
    pattern: /from ['"]preact(\/[\w-]+)?['"]/,
    scope: (rel) => rel.startsWith(`src${sep}core${sep}`),
    message:
      'src/core/ imports preact. Core is portable — it runs in Node under the\n' +
      '  CLI with no DOM and no UI framework, which npm run lint:core proves.\n' +
      '  A module that needs a component lives in src/app/. A module that needs a\n' +
      '  value from one takes it as a parameter.\n' +
      '  The reason is in SOUL.md -> The core engine is architecturally portable.',
  },
];

/** True for a path this check governs: a .ts/.tsx file under src/. */
function inScope(path) {
  const rel = relative(root, resolve(root, path));
  if (rel.startsWith('..') || rel.startsWith(sep)) return false;
  return rel.startsWith(`src${sep}`) && /\.tsx?$/.test(rel);
}

/** Line comments to end of line, and block-comment body lines (leading `*`). */
function stripComments(code) {
  return code
    .replace(/\/\/.*$/gm, '')
    .split('\n')
    .filter((line) => !/^\s*\*/.test(line))
    .join('\n');
}

function findings(path) {
  const rel = relative(root, resolve(root, path));
  const code = stripComments(readFileSync(path, 'utf8'));
  return RULES.filter(
    (rule) => (rule.scope ? rule.scope(rel) : true) && rule.pattern.test(code)
  ).map((rule) => rule.message);
}

/**
 * `git ls-files` lists a file the working tree has already deleted, until that
 * deletion is staged — so a session that removes a module and runs the gate
 * before committing would crash the gate on its own deletion. A file that is
 * gone has no code to check.
 */
function trackedSources() {
  return execFileSync('git', ['ls-files', '-z', '--', 'src'], { encoding: 'utf8' })
    .split('\0')
    .filter((path) => path && inScope(path) && existsSync(resolve(root, path)));
}

const args = process.argv.slice(2);
const fileIndex = args.indexOf('--file');
const files =
  fileIndex >= 0 ? [args[fileIndex + 1]].filter((path) => path && inScope(path)) : trackedSources();

let failed = false;
for (const file of files) {
  const found = findings(resolve(root, file));
  if (found.length === 0) continue;
  failed = true;
  process.stderr.write(`House rule violated in ${file}:\n\n  ${found.join('\n\n  ')}\n`);
}
process.exit(failed ? 1 : 0);
