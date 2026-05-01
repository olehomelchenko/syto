import * as aq from 'arquero';
import type { FullTransformStep } from '../types';
import { decodeRollupSpec } from '../rollup-spec';
import { assertNoCollisions } from '../unique-names';

export function handleAggregate(table: any, transform: FullTransformStep): any {
  const { groupby, rollup } = transform.aggregate!;
  const op = (aq as any).op;

  // A rollup output named identically to a groupby column silently clobbers
  // the group label in arquero, leaving an unusable result (no way to tell
  // the groups apart). Reject it up front.
  if (groupby && groupby.length > 0) {
    assertNoCollisions(Object.keys(rollup), groupby, 'Aggregate');
  }

  let groupedTable = table;
  if (groupby && groupby.length > 0) {
    // CONTRACT (SOUL §7): nulls in a groupby column form their own group,
    // following SQL standard and Arquero's default. Null is treated as a
    // value, not absence of a value. Pinned in transforms-aggregate.test.ts.
    groupedTable = table.groupby(groupby);
  }

  const rollupSpecs: any = {};
  const floatCols: string[] = [];

  for (const [outCol, exprString] of Object.entries(rollup)) {
    const { func: funcName, col: colName } = decodeRollupSpec(exprString as string);

    if (!op[funcName]) throw new Error(`Unknown op: ${funcName}`);

    rollupSpecs[outCol] = colName ? op[funcName](colName) : op[funcName]();
    if (['mean', 'average', 'avg', 'sum', 'stdev', 'variance', 'median'].includes(funcName)) {
      floatCols.push(outCol);
    }
  }

  let result = groupedTable.rollup(rollupSpecs).ungroup();

  // Normalise aggregate outputs: round floats, and convert Arquero's
  // `undefined`-on-empty (e.g. sum/mean/min/max of an all-null column) to
  // `null`, matching Syto's "null means missing" convention everywhere else
  // (SOUL.md §7 "Predictable, Not Clever").
  const outCols = Object.keys(rollupSpecs);
  if (outCols.length > 0) {
    const cleanups: any = {};
    const floatSet = new Set(floatCols);
    outCols.forEach((col) => {
      const isFloat = floatSet.has(col);
      cleanups[col] = (aq as any).escape((d: any) => {
        const val = d[col];
        if (val === undefined) return null;
        if (isFloat && typeof val === 'number') return Math.round(val * 1e9) / 1e9;
        return val;
      });
    });
    result = result.derive(cleanups);
  }

  return result;
}

type ColumnCategory = 'numeric' | 'categorical' | 'temporal';

function classifyColumnType(table: any, col: string): ColumnCategory {
  const values = table.array(col);
  const limit = Math.min(100, values.length);
  let hasNonNull = false;
  let allNumbers = true;
  let allDates = true;

  for (let i = 0; i < limit; i++) {
    const v = values[i];
    if (v === null || v === undefined || v === '') continue;
    hasNonNull = true;
    if (typeof v !== 'number') allNumbers = false;
    if (!(v instanceof Date) && !(typeof v === 'string' && /^\d{4}[-/]\d{2}[-/]\d{2}/.test(v)))
      allDates = false;
    if (!allNumbers && !allDates) break;
  }

  if (!hasNonNull) return 'categorical';
  if (allNumbers) return 'numeric';
  if (allDates) return 'temporal';
  return 'categorical';
}

const NUMERIC_STATS = ['count', 'unique', 'mean', 'median', 'stdev', 'min', 'max'] as const;
const CATEGORICAL_STATS = ['count', 'unique', 'top', 'freq'] as const;
const TEMPORAL_STATS = ['count', 'unique', 'min', 'max', 'top', 'freq'] as const;

function buildStatList(columnTypes: Map<string, ColumnCategory>): string[] {
  const hasNumeric = [...columnTypes.values()].some((t) => t === 'numeric');
  const hasCategorical = [...columnTypes.values()].some((t) => t === 'categorical');
  const hasTemporal = [...columnTypes.values()].some((t) => t === 'temporal');

  const stats: string[] = ['count', 'unique'];
  if (hasCategorical || hasTemporal) stats.push('top', 'freq');
  if (hasNumeric) stats.push('mean', 'median', 'stdev');
  if (hasNumeric || hasTemporal) stats.push('min', 'max');
  return stats;
}

function columnHasStat(category: ColumnCategory, stat: string): boolean {
  if (category === 'numeric') return (NUMERIC_STATS as readonly string[]).includes(stat);
  if (category === 'temporal') return (TEMPORAL_STATS as readonly string[]).includes(stat);
  return (CATEGORICAL_STATS as readonly string[]).includes(stat);
}

export function handleDescribe(table: any, transform: FullTransformStep): any {
  const { columns } = transform.describe!;
  if (!columns || columns.length === 0) {
    throw new Error('At least one column is required for describe.');
  }

  const op = (aq as any).op;

  // 1. Classify each column
  const columnTypes = new Map<string, ColumnCategory>();
  for (const col of columns) {
    columnTypes.set(col, classifyColumnType(table, col));
  }

  // 2. Build rollup specs per column type
  const rollupSpecs: any = {};
  for (const col of columns) {
    const type = columnTypes.get(col)!;
    rollupSpecs[`${col}__count`] = op.valid(col);
    rollupSpecs[`${col}__unique`] = op.distinct(col);

    if (type === 'numeric') {
      rollupSpecs[`${col}__mean`] = op.mean(col);
      rollupSpecs[`${col}__median`] = op.median(col);
      rollupSpecs[`${col}__stdev`] = op.stdev(col);
      rollupSpecs[`${col}__min`] = op.min(col);
      rollupSpecs[`${col}__max`] = op.max(col);
    } else if (type === 'temporal') {
      rollupSpecs[`${col}__min`] = op.min(col);
      rollupSpecs[`${col}__max`] = op.max(col);
      rollupSpecs[`${col}__top`] = op.mode(col);
    } else {
      rollupSpecs[`${col}__top`] = op.mode(col);
    }
  }

  const result = table.rollup(rollupSpecs);
  const resultObj = result.objects()[0];

  // 3. Compute freq (count of mode value) for non-numeric columns
  for (const col of columns) {
    const type = columnTypes.get(col)!;
    if (type !== 'numeric') {
      const modeValue = resultObj[`${col}__top`];
      if (modeValue != null) {
        const values = table.array(col);
        let freqCount = 0;
        for (let i = 0; i < values.length; i++) {
          if (values[i] === modeValue) freqCount++;
        }
        resultObj[`${col}__freq`] = freqCount;
      } else {
        resultObj[`${col}__freq`] = 0;
      }
    }
  }

  // 4. Build transposed rows (only stats relevant to selected column types)
  const statsToShow = buildStatList(columnTypes);
  const rows: any[] = [];
  for (const stat of statsToShow) {
    const row: any = { statistic: stat };
    for (const col of columns) {
      const type = columnTypes.get(col)!;
      if (!columnHasStat(type, stat)) {
        row[col] = null;
        continue;
      }
      const val = resultObj[`${col}__${stat}`];
      row[col] = typeof val === 'number' ? Math.round(val * 1e9) / 1e9 : (val ?? null);
    }
    rows.push(row);
  }

  return aq.from(rows);
}

export const aggregateHandlers = {
  aggregate: handleAggregate,
  describe: handleDescribe,
};
