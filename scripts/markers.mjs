#!/usr/bin/env node
// The marker census, in three modes — `npm run lint:todo`.
//
// /alignment writes a `// TODO:` breadcrumb at the code site for every finding
// it notices and does not fix. That half worked. Reading them back did not: the
// markers in this tree were all recorded in one week in May 2026 and none had
// been triaged since. A census is what makes the breadcrumb a queue rather than
// a place findings go to rest.
//
// Two rules, and only one of them is a threshold.
//
// 1. Every marker carries a date. This is a hard failure with no threshold. The
//    date says when the line landed, so `git blame` supplies it and nothing has
//    to be invented. An undated marker is the one a census cannot triage: you
//    cannot tell a deferral made last week from one that has outlived its
//    premise. The population reached zero undated markers when this gate
//    landed. The date is read from anywhere on the marker line.
// 2. The total stays under a ceiling. The ceiling carries deliberate headroom
//    over the measured count, unlike a duplication threshold, which sits on its
//    measurement. Recording a deferral is the behavior this project wants, so a
//    ceiling seeded on the measurement would fail the build for doing the right
//    thing.
//
// The ceiling refuses FORGETTING, never recording. AGENTS.md's "no such thing
// as not my job" rule obliges every session to write down what it finds, and a
// gate that made a session choose between recording a finding and a green build
// would teach it to stay quiet. So a ceiling reached is a signal to discharge
// markers, or to raise the ceiling deliberately — it is never a reason to leave
// a finding unwritten.
//
// Age is reported and never fails. A trigger keyed to a count ("a third
// instance extracts the helper") that has seen two is waiting correctly, and
// nothing about the calendar changes that.
//
// Three modes, one grammar:
//
//   (default)      the gate — count, age, and the two failure rules
//   --list         every marker with its comment block, for triage
//   --file <path>  one file's notice, or nothing — what the hook reports
//
// `--file` exists so that .claude/hooks/markers.sh holds no census of its own.
// A hook that re-implements the grammar is a second definition of what a marker
// is, and the two drift before either has run twice.
//
// docs/HARNESS.md -> The marker census.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';

const { values: flags } = parseArgs({
  options: {
    // One file's notice, for the edit-time hook.
    file: { type: 'string' },
    // Every marker with its comment block, for triage.
    list: { type: 'boolean', default: false },
  },
});

// Seeded at 9 markers on 2026-09-21 with headroom, per rule 2 above. A diff that
// discharges a marker lowers this by one; raising it is a deliberate edit that
// says why in the commit. `git log -L` on this line is the ledger of every move.
const CEILING = 15;

// At most this many markers per file notice, and this many lines per marker.
const FILE_CAP = 5;
const BLOCK_LINES = 6;

// Where markers live. `docs/` is deliberately outside: the specifications and
// the review documents discuss deferrals in prose, so a doc-wide count would be
// noise rather than a census. A deferral recorded in a document is
// docs/BACKLOG.md's to carry.
const ROOTS = [
  ['src', /\.(tsx?|css)$/],
  ['styles', /\.css$/],
];

// Case-sensitive and word-bounded: an identifier holding the letters inflates
// every count under a careless substring search.
const MARKER = /(?:^|[^A-Za-z0-9_])TODO(?:[^A-Za-z0-9_]|$)/;
const DATE = /(\d{4})-(\d{2})-(\d{2})/;
const SKIP = new Set(['node_modules', 'dist', '.git']);

function walk(dir, match, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, match, out);
    else if (match.test(name)) out.push(path);
  }
  return out;
}

function markersIn(path) {
  const lines = readFileSync(path, 'utf8').split('\n');

  // `openAt[i]` is the block-comment state BEFORE line i. It is precomputed for
  // the whole file, because a continuation line is judged by its own state and
  // not by the marker line's — the marker line of a `{/* … */}` comment opens
  // the block, so reusing its state truncates every JSX and CSS marker to one
  // line and hides the trigger, which usually sits below. Three of this tree's
  // markers are JSX accessibility findings written that way.
  const openAt = [];
  let inBlock = false;
  for (const line of lines) {
    openAt.push(inBlock);
    let rest = line;
    for (;;) {
      const at = inBlock ? rest.indexOf('*/') : rest.indexOf('/*');
      if (at === -1) break;
      rest = rest.slice(at + 2);
      inBlock = !inBlock;
    }
  }

  const found = [];
  for (let i = 0; i < lines.length; i++) {
    if (!MARKER.test(lines[i])) continue;
    const block = [lines[i]];
    for (let j = i + 1; j < lines.length && block.length < BLOCK_LINES; j++) {
      if (MARKER.test(lines[j])) break;
      if (!openAt[j] && !/^\s*(\*|\/\/)/.test(lines[j])) break;
      block.push(lines[j]);
    }
    found.push({ path, line: i + 1, text: lines[i], block });
  }
  return found;
}

function printBlock(m, indent = '    ') {
  console.log(`${m.path}:${m.line}`);
  for (const line of m.block) console.log(`${indent}${line.trim()}`);
  console.log('');
}

// --file: one file's notice for the hook, or nothing at all. The scope test
// lives here rather than in the hook so that one list decides what counts.
if (flags.file !== undefined) {
  const target = flags.file;
  if (!target) process.exit(0);
  const rel = relative(process.cwd(), resolve(target));
  // A session may hold a second working directory, and a marker there is not
  // this project's debt to queue.
  if (!rel || rel.startsWith('..')) process.exit(0);
  const root = rel.split(sep)[0];
  const scoped = ROOTS.some(([name, match]) => name === root && match.test(rel));
  if (!scoped) process.exit(0);

  let found;
  try {
    found = markersIn(rel);
  } catch {
    process.exit(0);
  }
  if (!found.length) process.exit(0);

  const shown = found.slice(0, FILE_CAP);
  const lines = [
    `Markers in ${rel} (${found.length}). This edit is the "next touch" those triggers name.`,
    '',
  ];
  for (const m of shown) {
    lines.push(`  L${m.line}: ${m.block[0].trim()}`);
    for (const cont of m.block.slice(1)) lines.push(`       ${cont.trim()}`);
  }
  if (found.length > shown.length) {
    lines.push(`  (+${found.length - shown.length} more in this file)`);
  }
  lines.push(
    '',
    'Judge each one: fired, or not yet. A fired trigger is acted on in this diff or',
    'queued in docs/BACKLOG.md — it does not get left unread a second time. Say which',
    'you did.'
  );
  console.log(lines.join('\n'));
  process.exit(0);
}

const markers = ROOTS.flatMap(([root, match]) =>
  walk(root, match).flatMap((path) => markersIn(path))
);

if (flags.list) for (const m of markers) printBlock(m);

const undated = markers.filter((m) => !DATE.test(m.text));
const files = new Set(markers.map((m) => m.path)).size;

const today = new Date();
const aged = markers
  .map((m) => {
    const hit = DATE.exec(m.text);
    if (!hit) return null;
    const when = new Date(`${hit[1]}-${hit[2]}-${hit[3]}T00:00:00Z`);
    return { ...m, days: Math.floor((today - when) / 86400000) };
  })
  .filter(Boolean)
  .sort((a, b) => b.days - a.days);

console.log(`Markers: ${markers.length} in ${files} files (ceiling ${CEILING})`);
if (aged.length) {
  const over = (n) => aged.filter((m) => m.days > n).length;
  const oldest = aged[0];
  console.log(
    `Age: oldest ${oldest.days} days (${oldest.path}:${oldest.line}) · over 60 days: ${over(60)} · over 30 days: ${over(30)}`
  );
}

const failures = [];
if (undated.length) {
  failures.push(`${undated.length} marker(s) carry no date. Add the date the line landed:`);
  for (const m of undated) {
    failures.push(`    ${m.path}:${m.line}  git blame -L ${m.line},${m.line} ${m.path}`);
  }
}
if (markers.length > CEILING) {
  failures.push(
    `${markers.length} markers is over the ceiling of ${CEILING}. Discharge markers, or raise CEILING in this script as a deliberate edit that says why.`
  );
}

if (failures.length) {
  console.error(`\n${failures.join('\n')}`);
  process.exit(1);
}
