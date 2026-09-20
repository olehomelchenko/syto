---
name: wrap-up
description: Invoke when the user signals the session is wrapping — asks to commit, says it's done, says it's wrapped, or asks for the wrap-up. The review pass that runs before anything is committed — the knowledge flush, the clean-context reviewer, then typecheck and the suite green on the arbitrated tree.
---

# Session wrap-up protocol

Run this review pass **before** anything is committed.

## 1. Flush knowledge first — `/doc-update`, in-session

Start with the advisories. They advise and never block: each printed line is a
question, answered by updating the document it names or by saying in the wrap-up
why that document still holds.

```bash
npm run lint:docs   # a source path a document names that is not in the tree
npm run lint:todo   # the marker census: count, age, the undated failure
```

Then read the diff for drift the scripts cannot see. These pairs are the ones
this repository keeps breaking — a rename lands in the code and the document
that teaches it keeps the old name:

| The diff touches                            | Re-read                                                           |
| ------------------------------------------- | ----------------------------------------------------------------- |
| `src/core/transforms/`                      | `docs/DATA-SPECIFICATION.md`, `docs/DEVELOPMENT-PATTERNS.md` §1   |
| `src/core/ast-validator.ts` or `functions/` | `AGENTS.md` → Security Requirements, the generated function docs  |
| `src/core/schema-engine.ts`                 | `docs/DATA-SPECIFICATION.md`, `docs/DATE-STORAGE-ARCHITECTURE.md` |
| `src/core/workflow-v2.ts`                   | `docs/DATA-SPECIFICATION.md` §7.2, `docs/FUTURE-PROOFING.md`      |
| a dialog or a component pattern             | `docs/UX-SPECIFICATION.md`, `docs/UI-VOCAB.md`                    |
| `src/cli/` or `src/cli.ts`                  | `docs/SPECIFICATION.md` §3.6                                      |
| a module moved between `core/` and `app/`   | `docs/SPECIFICATION.md` §3, and every document naming its path    |

**The failure this step exists for.** The session that ships a refactor has
every reason to believe the docs are fine, because it spent the session inside
the new pattern. `docs/FUTURE-PROOFING.md` documented an architecture the
transform-handler refactor had already replaced, and it survived because nobody
re-read it. Eight of the practice audit's 27 wrong statements live in the two
documents nobody re-reads.

Then capture what this session decided or discovered: rationale for non-obvious
choices, specification gaps, decisions made in conversation that never landed in
writing. Each goes to one home — a code comment at the site, the matching
document, or `docs/DECISIONS.md` when the decision would otherwise be
relitigated. Never two.

`docs/BACKLOG.md` is part of this flush. A session that quietly does a queued
item's work leaves the entry open, and a backlog of already-done work is a
backlog nobody reads. Read it against the diff and end each match three ways:
strike the entry, correct it, or say in the wrap-up why it still stands. **An
entry whose premise the diff falsified is corrected rather than struck** — the
stale claim is the thing the next session would act on.

This step cannot be delegated — only the session knows what was decided — and it
runs first so the clean-context reviewer below judges against recorded rationale
instead of flagging deliberate choices as oversights.

## 2. Alignment — clean-context subagent

Spawn an agent with no session context beyond this prompt:

> Read `.claude/skills/alignment/SKILL.md` and execute it against the current
> uncommitted/staged diff. Fix directly per the skill, run `npm run typecheck`
> and `npm test`, and return the skill's summary as your final message.

The clean slate is the point. The reviewer simulates the future maintainer and
must not inherit the session's rationalizations.

This step IS the session's diff review. A clean-context diff review already run
on the same diff earlier in the session is this step run twice: each reviewer's
fixes land unreviewed, and the second one spends its pass patching the first
one's patches.

## 3. Cold reader — conditional

Only when the session wrote or rewrote a page someone follows: a section of
`README.md`, a guide under `docs/`, a page under `src/content/`, or the
transform recipe in `docs/DEVELOPMENT-PATTERNS.md`. Spawn the `cold-reader`
agent (`.claude/agents/cold-reader.md`) with the four things its brief asks for:
the page, the reader, the task in that reader's words, and the mode.

A wording edit owes no test. A new page or a new task section does.

## Running the reviewers and arbitrating

Run the subagents **sequentially**, not in parallel — both may edit the working
tree.

Relay each report back to the user, then arbitrate each finding to one of three
ends — **accept and fix**, **accept but defer**, or **overrule** — and **write
down the ones you don't act on now**, because a subagent's report is ephemeral
and chat is not a record. A deferred finding gets a dated `// TODO(YYYY-MM-DD):`
at the relevant code site when it belongs to one site, and an entry in
`docs/BACKLOG.md` when it is ranked work rather than a site-local note. Never
both: a marker and a backlog entry for one fact are two homes for one fact, and
the pair drifts the moment either moves. An overruled finding records the
missing rationale where the reviewer looked.

Out of scope for _this session_ is not out of scope for the _project_. This is
`AGENTS.md`'s **"no such thing as not my job"** rule at the moment it bites
hardest: with a single maintainer there is no "someone else's problem", so an
unrecorded deferral is not deferred work — it is work thrown away, and the next
session pays to rediscover it. A finding that reached the chat and no file did
not survive this session.

## 4. Green tree — the last act before the commit invitation

Run every gate on the tree as it stands **after** arbitration:

```bash
npm run typecheck && npm test && npm run lint:core && npm run lint:house && npm run lint:todo && npm run lint:docs && npm run i18n:check
```

All exit 0, or the wrap-up is not finished.

The reviewer ran typecheck and the suite too, and that is not this run: its
edits, your fixes, and your overrules all land afterwards, so the last green
suite anybody saw was on a tree that no longer exists.

Fix a failure here instead of deferring it. The session that made the change is
still loaded, which is why this gate sits at the wrap-up signal and not at the
push — `.husky/pre-push` catches the same failure later, against a context that
has gone cold.

Then commit only when invited (`AGENTS.md` → AI Developer Protocol). The subject
is one line saying what shipped. The reasoning lives where the next session
looks for it — the specification, `docs/DECISIONS.md`, a comment at the site.
