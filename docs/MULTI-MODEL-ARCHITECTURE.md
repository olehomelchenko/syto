# Multi-Model Architecture: Dependency Graph

> **Purpose**: Reference for Syto's dependency-graph system — how models form a DAG, how staleness cascades, and the invariants multi-model operations (join, concat, union) must preserve.

> **Related**: [BACKLOG.md](BACKLOG.md), [DATA-SPECIFICATION.md](DATA-SPECIFICATION.md) §3 Transform Steps

---

## Architecture

Models are linear pipelines (`Source → [Step1 … StepN] → Final Data`). Multi-model operations (`join`, `concat`, `union`) reference other models by ID. A **dependency graph** layer tracks those references so the app can: detect when a referenced model changed, cascade recomputation to dependents, and warn before deleting a model others depend on.

### Nodes

Both **sources and models** are nodes, at model-level granularity (no per-step nodes). The graph size equals the number of models — typically <20 — and full model recomputation is fast (<100ms typical), so finer granularity isn't worth the complexity.

```typescript
interface DependencyNode {
  id: string; // Source or Model ID
  type: 'source' | 'model';
  dependencies: Set<string>; // IDs this node depends on
  dependents: Set<string>; // IDs that depend on this node
}
```

```
Source: Orders ──────► Model: Clean Orders ──────┐
                                                 ▼
Source: Customers ───► Model: Clean Customers ─► Model: Joined Data ─► Model: Monthly Stats
```

The graph is **derived state** — built on app load by scanning model transforms for references, rebuilt when models change. The single source of truth remains the model transforms; `DependencyService` owns graph building and querying (`getDependencies`, `getDependents`, `getExecutionOrder`, `hasCycle`).

## Design Rationale

**Why not persist the graph?** It's fully reconstructable from model transforms. Persisting it separately would create sync drift, add migration complexity, and violate single-source-of-truth.

**Why include sources as nodes?** Completes the DAG from data origin to final output, enables "what depends on this source?" queries, and lets a re-import cascade to dependent models. Trivial cost — sources have an empty `dependencies` set.

**Why single-target transforms (not arrays)?** `concat`/`union` use `{ with: string }`, matching join's pattern. Simpler mental model; users chain multiple operations if needed. Array syntax can be added later if demand emerges.

**Why lazy recomputation?** Mark stale → compute on view, rather than immediate cascade. Avoids work if the user never views the model, shows the current view immediately, and avoids expensive eager cascades down deep chains.

## Model Chaining

A model's `sourceId` can reference another **model** (not just a source), creating pipeline chains where one model's output feeds the next. This enables the v2 workflow format's `source: "clean-orders"` pattern.

### sourceId Resolution Points

When `sourceId` is resolved, the lookup **must** check sources first, then fall back to models:

- **`StepService.computeModelUpToStep()`** — primary pipeline execution: resolves input data + schema from source or parent model
- **`Sidebar.tsx`** / **`JoinTreeSelector.tsx`** — UI grouping: uses `DependencyService.getRootSourceId()` to group chained models under their root source
- **`ModelInfoView.tsx`** — displays parent model name when source lookup fails
- **`interaction-handlers.ts`** (`extractSelectedRows`) — validates model input exists (source or parent model)
- **`join-handlers.ts`** (`saveAsNewModel`) — resolves root source via `getRootSourceId()` for creating initial steps

### Key Helpers

- **`DependencyService.getRootSourceId(models, sources, modelId)`** — walks `sourceId` chain upward to the first `src_*` ID. Used for Sidebar grouping.
- **`DependencyService.getUpstreamDependencies(graph, targetIds)`** — transitive upstream walk collecting all dependencies. Used for v2 export.

### Cycle Detection

Handled by `DependencyService.checkCircularDependency()` and `hasCycle()`, which operate on the full graph including `sourceId` edges.

---

## Name Uniqueness

Source names are **globally unique**. Model names are **unique per-source** (two different sources can each have a model named "main"). All checks are case-insensitive.

For the v2 workflow format, globally-unique model keys are constructed as `sourceName/modelName` at export time. This composite key is only used in the portable format — the browser UI shows just the model name.

**Enforcement**: `NameService.isModelNameTaken(name, sourceId, excludeId?)` and `isSourceNameTaken(name, excludeId?)` in `src/app/services/NameService.ts`.

**Where enforced**: `ModelService` (create, copy, fork, rename), `ImportService` (auto-dedup on import via `suggestUniqueName`), `join-handlers.ts` (save join as new model), `interaction-handlers.ts` (extract rows to new model).

---

## Implementation Rules

Constraints discovered during implementation. Violating these causes data-correctness bugs.

### Recomputation Order

Both recomputation paths (lazy and eager) **must** recompute stale upstream dependencies in topological order before the target model. Without this, a model can be marked clean but contain data computed from stale intermediaries.

- **Lazy path** (`ModelService.switchToModel`): builds graph, gets execution order for the target, recomputes any stale upstream models first
- **Eager path** (`StepService.handleDependencyImpact`): uses `getExecutionOrder()` on all stale IDs, recomputes in sorted order
- **On error**: keep `isStale` flag, show user-facing warning — never silently mark as clean

### Copy vs Reference Semantics

- **Model creation** (new, copy, fork): always deep-copies data, steps, and schema — models are fully independent objects
- **Multi-model operations** (join, concat, union, etc.): resolve target data at compute time via `resolveTableFromContext()`, which reads `model.data` from the shared context. Data must be loaded first via `ensureModelData()`/`ensureSourceData()` — `model.data` may be `null` if not yet fetched from IndexedDB. Arquero creates a new table, but the source array is read by reference — so stale data in context produces stale results
- **Implication**: the recomputation order rule above is critical because context contains live model objects

### Dependency Dialog Cancellation

When a user applies a step that has downstream dependents, the dependency impact dialog appears. If the user **cancels**:

- The step must be fully rolled back: pop from `model.steps`, recompute data from remaining steps, restore AppStore signals
- The undo snapshot pushed before the step must also be popped (nothing to undo)
