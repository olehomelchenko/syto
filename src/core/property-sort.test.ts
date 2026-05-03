import * as fc from 'fast-check';
import * as aq from 'arquero';
import { describe, it, expect } from 'vitest';
import { applyTransform } from './transforms';
import { sortCaseArb, numericTableArb } from './property-generators';

describe('Property-based: sort', () => {
  it('preserves row count', () => {
    fc.assert(
      fc.property(sortCaseArb, ({ rows, col, order }) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const result = applyTransform(table, { sort: { field: col, order } }, columns);
        expect(result.numRows()).toEqual(table.numRows());
      }),
      { numRuns: 100 }
    );
  });

  it('preserves column count and names', () => {
    fc.assert(
      fc.property(sortCaseArb, ({ rows, col, order }) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const result = applyTransform(table, { sort: { field: col, order } }, columns);
        expect(result.columnNames()).toEqual(columns);
        expect(result.numCols()).toEqual(table.numCols());
      }),
      { numRuns: 100 }
    );
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(sortCaseArb, ({ rows, col, order }) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();

        const once = applyTransform(table, { sort: { field: col, order } }, columns);
        const twice = applyTransform(once, { sort: { field: col, order } }, columns);

        const onceRows = once.objects();
        const twiceRows = twice.objects();
        expect(twiceRows).toEqual(onceRows);
      }),
      { numRuns: 100 }
    );
  });

  it('sort produces a permutation of the input rows', () => {
    fc.assert(
      fc.property(sortCaseArb, ({ rows, col, order }) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const result = applyTransform(table, { sort: { field: col, order } }, columns);

        const inputRows = table.objects();
        const outputRows = result.objects();

        expect(inputRows.length).toEqual(outputRows.length);

        // Multiset equality: every input row should match exactly one output row
        const remaining = outputRows.map((r: any) => ({ ...r }));
        for (const inputRow of inputRows) {
          const idx = remaining.findIndex((r: any) =>
            Object.keys(inputRow).every(
              (k) => inputRow[k] === r[k] || (inputRow[k] == null && r[k] == null)
            )
          );
          expect(idx).toBeGreaterThanOrEqual(0);
          remaining.splice(idx, 1);
        }
        expect(remaining.length).toEqual(0);
      }),
      { numRuns: 100 }
    );
  });
});
