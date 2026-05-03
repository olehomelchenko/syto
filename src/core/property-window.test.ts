import * as fc from 'fast-check';
import * as aq from 'arquero';
import { describe, it, expect } from 'vitest';
import { applyTransform } from './transforms';
import { windowCaseArb } from './property-generators';

describe('Property-based: window', () => {
  it('preserves row count (no partition)', () => {
    fc.assert(
      fc.property(windowCaseArb, (rows) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const result = applyTransform(
          table,
          {
            window: {
              orderBy: [{ field: 'idx', order: 'asc' as const }],
              derive: { rn: 'op.row_number()' },
            },
          },
          columns
        );
        expect(result.numRows()).toEqual(table.numRows());
      }),
      { numRuns: 100 }
    );
  });

  it('preserves row count (with partition)', () => {
    fc.assert(
      fc.property(windowCaseArb, (rows) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const result = applyTransform(
          table,
          {
            window: {
              orderBy: [{ field: 'idx', order: 'asc' as const }],
              partitionBy: ['partition'],
              derive: { rn: 'op.row_number()' },
            },
          },
          columns
        );
        expect(result.numRows()).toEqual(table.numRows());
      }),
      { numRuns: 100 }
    );
  });

  it('preserves all original columns and adds the derived one', () => {
    fc.assert(
      fc.property(windowCaseArb, (rows) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const result = applyTransform(
          table,
          {
            window: {
              orderBy: [{ field: 'idx', order: 'asc' as const }],
              derive: { rn: 'op.row_number()' },
            },
          },
          columns
        );
        const out = result.columnNames();
        expect(out).toContain('rn');
        for (const c of columns) expect(out).toContain(c);
      }),
      { numRuns: 100 }
    );
  });

  it('row_number with partition: each partition is numbered 1..k where k = partition size', () => {
    fc.assert(
      fc.property(windowCaseArb, (rows) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const result = applyTransform(
          table,
          {
            window: {
              orderBy: [{ field: 'idx', order: 'asc' as const }],
              partitionBy: ['partition'],
              derive: { rn: 'op.row_number()' },
            },
          },
          columns
        );

        // Group output rows by partition, collect rn values, expect 1..k
        const byPartition = new Map<string, number[]>();
        for (const r of result.objects() as any[]) {
          const arr = byPartition.get(r.partition) ?? [];
          arr.push(r.rn);
          byPartition.set(r.partition, arr);
        }

        for (const [, rns] of byPartition) {
          const sorted = [...rns].sort((a, b) => a - b);
          const expected = Array.from({ length: sorted.length }, (_, i) => i + 1);
          expect(sorted).toEqual(expected);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('partitioned cumulative sum equals partition total at the last position of each partition', () => {
    // Property: arquero's window handler calls `orderby(idx)` on the table
    // before `groupby(partition)` + rolling sum (frame [-Infinity, 0],
    // includePeers=false). So the result iterates in idx-asc order, and the
    // LAST row encountered for each partition is at the highest position in
    // the rolling-sum order — its `running` therefore equals the partition's
    // total sum of `val`. Tracking "last seen per partition" via iteration is
    // robust to idx ties (the row ordered last by arquero is the one we read).
    fc.assert(
      fc.property(windowCaseArb, (rows) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const result = applyTransform(
          table,
          {
            window: {
              orderBy: [{ field: 'idx', order: 'asc' as const }],
              partitionBy: ['partition'],
              derive: { running: "op.sum('val')" },
            },
          },
          columns
        );

        const expectedTotals = new Map<string, number>();
        for (const r of rows) {
          expectedTotals.set(r.partition, (expectedTotals.get(r.partition) ?? 0) + r.val);
        }

        const lastRunningPerPartition = new Map<string, number>();
        for (const r of result.objects() as any[]) {
          lastRunningPerPartition.set(r.partition, r.running);
        }

        for (const [k, total] of expectedTotals) {
          expect(lastRunningPerPartition.get(k)).toEqual(total);
        }
      }),
      { numRuns: 100 }
    );
  });
});
