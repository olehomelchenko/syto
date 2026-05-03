import * as fc from 'fast-check';
import * as aq from 'arquero';
import { describe, it, expect } from 'vitest';
import { applyTransform } from './transforms';
import { selectCaseArb, numericTableArb } from './property-generators';

describe('Property-based: select', () => {
  it('preserves row count', () => {
    fc.assert(
      fc.property(selectCaseArb, ({ rows, selected }) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const result = applyTransform(table, { select: selected }, columns);
        expect(result.numRows()).toEqual(table.numRows());
      }),
      { numRuns: 100 }
    );
  });

  it('removes only non-selected columns', () => {
    fc.assert(
      fc.property(selectCaseArb, ({ rows, selected }) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const result = applyTransform(table, { select: selected }, columns);
        const resultCols = result.columnNames();
        expect(resultCols.length).toEqual(selected.length);
        for (const col of selected) {
          expect(resultCols).toContain(col);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(selectCaseArb, ({ rows, selected }) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();

        const once = applyTransform(table, { select: selected }, columns);
        const twice = applyTransform(once, { select: selected }, columns);

        expect(twice.columnNames()).toEqual(once.columnNames());
        expect(twice.numRows()).toEqual(once.numRows());
      }),
      { numRuns: 100 }
    );
  });

  it('select all columns returns identical table', () => {
    fc.assert(
      fc.property(numericTableArb, (rows) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const result = applyTransform(table, { select: columns }, columns);
        expect(result.columnNames()).toEqual(columns);
        expect(result.numRows()).toEqual(table.numRows());
      }),
      { numRuns: 50 }
    );
  });
});
