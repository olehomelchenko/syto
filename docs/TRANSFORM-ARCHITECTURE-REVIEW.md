# Transform Design Principles

> **Purpose**: Why Syto's transforms are shaped the way they are — the design guardrails, drawn from Power Query M's documented limitations, that any new transform should respect.
>
> **Related Documents**:
>
> - [SPECIFICATION.md](SPECIFICATION.md): Technical architecture and codebase map
> - [DATA-SPECIFICATION.md](DATA-SPECIFICATION.md): Transform schemas and expression syntax
> - [DEVELOPMENT-PATTERNS.md](DEVELOPMENT-PATTERNS.md): How to add new transforms
>
> For the live list of transform gaps and planned additions, see [BACKLOG.md](BACKLOG.md) Tier 3.

---

## What Syto Does Well

Each transform follows the single-responsibility principle — one JSON object does one thing. Compared to Power Query M's documented limitations, Syto already avoids several pitfalls:

| M Limitation                                           | Syto's Approach                                                   |
| ------------------------------------------------------ | ----------------------------------------------------------------- |
| Opaque lazy evaluation causing "time-traveling" errors | Eager sequential execution - transforms run in written order      |
| No native regex support                                | `regexp_match()` and `regexp_extract()` in expressions            |
| Schema drift crashes with "Column not found"           | Graceful handling with warnings, unknown types fallback to string |
| Deferred error propagation                             | AST validation before execution (`ast-validator.ts`)              |
| Turing-complete escape hatches (security risk)         | Sandboxed expressions - no `eval()`, whitelisted functions only   |
| Case-sensitive function names                          | Function names are case-sensitive but documented clearly          |
| Query folding opacity                                  | N/A - browser-only, no push-down optimization needed              |

The expression engine reinforces this: a validated, whitelisted function set, bracket notation for column names with spaces (`[Column Name]`), word-form operators for beginners (`and`, `or`, `not`), and error objects instead of crashes for failed conversions.

---

## Transform Characteristics

### Execution Modes

Transforms can be categorized by execution characteristics. This isn't critical for small browser datasets but is useful for user education ("why is this slow?"), future optimization hints, and a potential "large dataset" mode.

| Mode             | Transforms                                                 | Characteristics               |
| ---------------- | ---------------------------------------------------------- | ----------------------------- |
| **Streaming**    | `filter`, `derive`, `replace`, `types`, `rename`           | Row-by-row, constant memory   |
| **Blocking**     | `sort`, `aggregate`, `dedupe`, `pivot`, `fold`, `addIndex` | Requires full table scan      |
| **Hybrid**       | `split`, `impute`, `sliceRows`                             | Depends on options            |
| **Multi-Source** | `join`, `concat`, `union`                                  | Requires loading second table |

### Column Reference Independence

Column names must be explicit somewhere — that's fundamental to declarative transforms (`select`/`remove` take name arrays, `rename` takes an old→new map, `derive`/`filter` reference names in expressions, `join.on` takes key pairs). The improvement opportunity is **pattern-based operations** for bulk/dynamic selection, which is why `selectPattern`/`removePattern`/`renamePattern` exist alongside the explicit forms.

---

## Design Principles (Lessons from Power Query M)

### What to Preserve

1. **Single-responsibility transforms** — each JSON object does one thing
2. **Eager validation** — check expressions before execution
3. **Explicit execution order** — no lazy reordering surprises
4. **Sandboxed expressions** — whitelist-only, no code injection
5. **Graceful degradation** — unknown transforms/types warn, don't crash

### What NOT to Add

Based on M's documented problems:

1. **No Turing-completeness** — no loops, recursion, or arbitrary code in expressions
2. **No implicit optimization** — execution order matches specification order
3. **No stringly-typed escape hatches** — expressions are parsed and validated, not eval'd
4. **No source-level privacy firewall** — a browser-only tool doesn't need this complexity
5. **No lazy evaluation** — predictable eager execution is easier to debug

### Future Considerations

For large-dataset support, if it's ever needed: an explicit checkpoint/materialization mechanism, streaming-vs-buffering indicators in the UI, and memory warnings that detect problematic patterns before execution. None are justified at current scale.
