import * as aq from 'arquero';
import type { FullTransformStep, TransformContext } from '../types';
import { resolveTableFromContext } from '../utils';

// A right table built from `data: []` has no columns, which makes Arquero's
// join verbs throw "Invalid column reference" when they try to parse keys.
// Short-circuit here: the semantics of each operation against an empty right
// are well-defined, so we return the correct result without touching Arquero.
function isSchemaless(table: any): boolean {
  return table.numCols() === 0;
}

// CONTRACT (SOUL §7): Syto uses `null` for missing data. Arquero produces
// `undefined` for unmatched cells in left/right/full/lookup joins, and — for
// full join specifically — coalesces unmatched left null keys into `undefined`
// in the merged key column. Coerce all `undefined`s to `null` post-join so
// "missing means null" stays universal across the engine. Same pattern as
// `handleAggregate` does for `undefined`-on-empty rollups.
function normalizeUndefinedToNull(table: any): any {
  if (table.numRows() === 0) return table;
  const cleanups: Record<string, any> = {};
  for (const col of table.columnNames()) {
    cleanups[col] = (aq as any).escape((d: any) => (d[col] === undefined ? null : d[col]));
  }
  return table.derive(cleanups);
}

export function handleJoin(
  table: any,
  transform: FullTransformStep,
  _schema: string[],
  context: TransformContext | null
): any {
  const { right, on, how, suffixes } = transform.join!;
  const rightTable = resolveTableFromContext(context, right, 'Join');

  const leftKeys = on.map((pair: any) => pair[0]);
  const rightKeys = on.map((pair: any) => pair[1]);
  const joinSuffixes = suffixes || ['_x', '_y'];

  const joinOptions = { suffix: joinSuffixes };
  const keys = leftKeys.length === 1 ? [leftKeys[0], rightKeys[0]] : [leftKeys, rightKeys];

  if (isSchemaless(rightTable)) {
    // inner/right/cross: nothing can match an empty right → empty result with left schema.
    // left/full: every left row is unmatched, and there are no right columns to add → left unchanged.
    if (how === 'left' || how === 'full') return table;
    return table.filter(() => false);
  }

  if (how === 'inner' || !how) return table.join(rightTable, keys, null, joinOptions);
  if (how === 'left')
    return normalizeUndefinedToNull(table.join_left(rightTable, keys, null, joinOptions));
  if (how === 'right')
    return normalizeUndefinedToNull(table.join_right(rightTable, keys, null, joinOptions));
  if (how === 'full')
    return normalizeUndefinedToNull(table.join_full(rightTable, keys, null, joinOptions));
  if (how === 'cross') return table.cross(rightTable, null, joinOptions);

  throw new Error(`Unknown join type: ${how}`);
}

export function handleSemijoin(
  table: any,
  transform: FullTransformStep,
  _schema: string[],
  context: TransformContext | null
): any {
  const { right, on } = transform.semijoin!;
  const rightTable = resolveTableFromContext(context, right, 'Semijoin');

  if (isSchemaless(rightTable)) return table.filter(() => false);

  const leftKeys = on.map((pair: [string, string]) => pair[0]);
  const rightKeys = on.map((pair: [string, string]) => pair[1]);
  const keys = leftKeys.length === 1 ? [leftKeys[0], rightKeys[0]] : [leftKeys, rightKeys];

  return table.semijoin(rightTable, keys);
}

export function handleAntijoin(
  table: any,
  transform: FullTransformStep,
  _schema: string[],
  context: TransformContext | null
): any {
  const { right, on } = transform.antijoin!;
  const rightTable = resolveTableFromContext(context, right, 'Antijoin');

  if (isSchemaless(rightTable)) return table;

  const leftKeys = on.map((pair: [string, string]) => pair[0]);
  const rightKeys = on.map((pair: [string, string]) => pair[1]);
  const keys = leftKeys.length === 1 ? [leftKeys[0], rightKeys[0]] : [leftKeys, rightKeys];

  return table.antijoin(rightTable, keys);
}

export function handleLookup(
  table: any,
  transform: FullTransformStep,
  _schema: string[],
  context: TransformContext | null
): any {
  const { right, on, values } = transform.lookup!;
  const rightTable = resolveTableFromContext(context, right, 'Lookup');

  if (isSchemaless(rightTable)) {
    const derives: Record<string, any> = {};
    for (const col of values) derives[col] = (aq as any).escape(() => null);
    return table.derive(derives);
  }

  const leftKeys = on.map((pair: [string, string]) => pair[0]);
  const rightKeys = on.map((pair: [string, string]) => pair[1]);
  const keys = leftKeys.length === 1 ? [leftKeys[0], rightKeys[0]] : [leftKeys, rightKeys];

  return normalizeUndefinedToNull(table.lookup(rightTable, keys, ...values));
}

export const joinHandlers = {
  join: handleJoin,
  semijoin: handleSemijoin,
  antijoin: handleAntijoin,
  lookup: handleLookup,
};
