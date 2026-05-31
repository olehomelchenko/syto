# Architecture Decision Records

Key design decisions and their rationale, preserved from project research and analysis.

---

## 1. Expression Parser: jsep + Custom Interpreter

**Date**: 2025 (Phase 0)
**Research basis**: 8 production systems (Arquero, Vega-Lite, jsep, filtrex, OpenRefine, ag-Grid, Tidyjs, danfo.js)

**Decision**: Hybrid approach — structured predicate objects for GUI-driven cases (80%), jsep-parsed expression strings as escape hatch (20%). AST interpretation, never code generation.

**Why jsep over alternatives**:

| Option           | Verdict     | Reason                                                                                         |
| ---------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| jsep             | **Chosen**  | Parser-only (returns AST, no execution), zero deps, ~600 LOC, ESTree-compatible, plugin system |
| Arquero/Acorn    | Too complex | Full JS parser, still uses `Function()` constructor internally                                 |
| ag-Grid approach | Insecure    | Direct `eval` / `new Function()` on user input                                                 |
| Custom parser    | Unnecessary | jsep covers the expression subset we need                                                      |

**Key architectural principles**:

- **Parse → Validate → Interpret** pipeline (never compile to JS)
- **AST whitelist**: Only explicitly allowed node types and operators pass validation
- **Schema-aware validation**: Column names checked against model schema, with suggestions for typos
- **Errors-as-values**: Bad cells return error objects instead of throwing (one bad cell shouldn't fail 10,000 good ones)
- **Position-aware errors**: Point to exact character offset with `↑` indicator and fix suggestions
- **Null propagation**: Null flows through operators (like SQL), except `==` and `!=`

**Revisit if**: Expression needs grow beyond what jsep supports (e.g., lambdas, pipe operators).

---

## 2. Data Engine: Custom AST + Arquero Delegation

**Date**: 2025-2026
**Research basis**: Arquero verb coverage analysis

**Decision**: Two-layer architecture — custom AST interpretation for user expressions (security-critical), Arquero verb delegation for data operations (well-tested, performant).

**Why not all-Arquero**: Arquero's expression system uses `Function()` constructor internally. User expressions must never reach that path.

**Why not all-custom**: Arquero provides 35+ battle-tested verbs for data operations (pivot, fold, join, dedupe, etc.). Reimplementing these would be wasteful and error-prone.

**Principles**:

- Transforms are thin wrappers around Arquero verbs (10-60 lines each)
- User expressions go through custom AST pipeline with full validation
- Never use `Function()` constructor with any user input
- Never reinvent an Arquero verb when one exists

---

## 3. Design System: Custom CSS, Not a Framework

**Date**: March 2026
**Research basis**: IBM Carbon, Open Props, Shoelace/Web Awesome, Radix/Ark UI, Tailwind

**Decision**: Stay with custom CSS + CSS Modules + postcss-nested. Adopt Carbon's _design documentation_ (principles, patterns, guidelines) but not its code or components.

**Why no component library works**:

| Blocker                   | Detail                                                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Preact vs React           | Carbon requires React; `preact/compat` breaks on complex component internals. Headless libraries (Radix, Ark UI) also don't support Preact. |
| Sass vs PostCSS           | Carbon requires Dart Sass (+10s build). Syto uses PostCSS.                                                                                  |
| Data table is the product | No generic table provides floating context toolbars, type badges, expression editors, error-as-value rendering.                             |
| Bundle discipline         | App JS is 178KB gzip. Carbon CSS alone adds ~26KB gzip.                                                                                     |

**What we took from Carbon**: Content writing guidelines (→ `CONTENT-GUIDELINES.md`), form design patterns, empty state taxonomy, disabled state variants, design principles (→ `UX-SPECIFICATION.md`).

**Preact assessment**: Net positive trade-off. 10KB gzip, native Signals support (excellent for data table reactivity), simpler API. The missing generic components (combobox, toggle) are bounded implementation tasks, not a systemic problem.

**Revisit if**: Preact falls behind on browser API support, or rich text editing (ProseMirror/TipTap, React-heavy) becomes needed.

---

## 4. Non-Destructive Architecture Decisions

**Date**: January 2026

### Model deletion: Hard-block over shadow sources

**Decision**: Deleting a model that others depend on (via joins/unions) is blocked with a message naming the dependent models.

**Alternative rejected**: "Shadow Sources" (hidden frozen snapshots of deleted models). Would add hidden state that conflicts with the project's transparency values, for marginal benefit in an edge case (reorganizing 4+ interconnected models).

### Aggregate silent exclusion: Acceptable

**Decision**: Aggregations (sum, mean) silently skip error objects.

**Rationale**: Error counts are already visible per-column in the EDA sidebar before aggregation. Adding post-aggregation warnings would require a warnings sideband in the transform pipeline — significant architectural cost for marginal transparency gain.
