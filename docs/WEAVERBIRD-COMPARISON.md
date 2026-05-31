# Weaverbird (ToucanToco) — Comparison Summary

**Status**: Research Reference (March 2026)
**Full research**: git history (original was 642 lines with detailed feature parity maps)

---

## What Weaverbird Is

[Weaverbird](https://github.com/ToucanToco/weaverbird) is an open-source visual query builder extracted from ToucanToco (French commercial BI platform). ~52 transform steps, Vue 2 frontend, Python backend with 3 executors (Pandas, MongoDB, SQL via pypika). BSD-3-Clause, 108 stars.

**Critical difference**: Weaverbird's frontend cannot execute transforms — every change requires a server round-trip. Syto runs entirely in-browser.

---

## Key Findings

### Where Weaverbird is stronger

1. **Multi-backend support** — same pipeline JSON runs against Pandas, MongoDB, and 6 SQL dialects. Proven spec-as-contract pattern.
2. **Step count** — ~52 steps vs Syto's 33 (though many are subsumed by Syto's expression engine).

### Where Syto is stronger

1. **Client-side execution** — zero infrastructure, instant preview, works offline.
2. **Single source of truth** — steps defined once in TypeScript (Weaverbird defines twice: TypeScript + Python Pydantic).
3. **Schema propagation** — static type inference through pipeline without execution. Weaverbird must execute to discover output schema.
4. **Expression engine** — 71 functions across 9 categories vs Weaverbird's basic arithmetic only (`+`, `-`, `*`, `/`, `%`). This is why Weaverbird needs ~15 dedicated steps for operations Syto handles through `derive`.
5. **Modern stack** — Preact + Signals vs Vue 2 + class components (abandoned by Vue ecosystem).
6. **Step definition cost** — ~4 files in 1 language vs ~10 files across 2 languages.

### Feature gaps identified (added to BACKLOG)

- **Top N per group** (`top` step) — common analytical need
- **Fill date gaps** (`addmissingdates` step) — important for time series
- **Evolution** (period-over-period change) — achievable with window + derive but a dedicated step would help

---

## Lessons for Syto's CLI

**Validated**: Spec-as-contract pattern works at production scale. Name-keyed dispatch is the right pattern. Frontend and backend can be independently versioned.

**Warnings**: Open-source as company byproduct = low adoption (2,200 PRs but 108 stars in 7 years). Dual-language tax is real. Server requirement kills casual adoption. Vue 2 in 2026 = framework lock-in cautionary tale.

**Worth borrowing**: Pluggable executor/translator interface (design for it even with one backend). Backend capability declarations (`@unsupported` decorator pattern).

---

## The Multi-Backend Future

Weaverbird proves the pipeline spec can outlive any single executor. Syto's roadmap:

```
workflow.json  →  Arquero executor (browser + Node.js CLI)  [current]
               →  DuckDB translator (large datasets, SQL)   [potential]
```

Key advantage: Since `src/core/` is portable JavaScript, the CLI shares 100% of browser engine code. A second implementation is only needed for a genuinely different backend (DuckDB SQL generation).
