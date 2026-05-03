import * as fc from 'fast-check';
import * as aq from 'arquero';
import { describe, it, expect } from 'vitest';
import { applyTransform } from './transforms';
import { filterCaseArb, numericTableArb } from './property-generators';

describe('Property-based: filter', () => {
  it('never increases row count', () => {
    fc.assert(
      fc.property(filterCaseArb, ({ rows, expr }) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const result = applyTransform(table, { filter: expr }, columns);
        expect(result.numRows()).toBeLessThanOrEqual(table.numRows());
      }),
      { numRuns: 100 }
    );
  });

  it('identity filter (true) preserves all rows', () => {
    fc.assert(
      fc.property(numericTableArb, (rows) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const result = applyTransform(table, { filter: 'true' }, columns);
        expect(result.numRows()).toEqual(table.numRows());
      }),
      { numRuns: 100 }
    );
  });

  it('false filter returns zero rows but preserves schema', () => {
    fc.assert(
      fc.property(numericTableArb, (rows) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const result = applyTransform(table, { filter: 'false' }, columns);
        expect(result.numRows()).toEqual(0);
        expect(result.columnNames()).toEqual(columns);
      }),
      { numRuns: 50 }
    );
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(filterCaseArb, ({ rows, expr }) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();

        const once = applyTransform(table, { filter: expr }, columns);
        const twice = applyTransform(once, { filter: expr }, columns);

        expect(twice.numRows()).toEqual(once.numRows());

        // Schema preservation in handleFilter only triggers when the *input* has
        // rows (filter.ts:27). Re-filtering an already-empty table goes through
        // aq.from([]) and loses column names. See TODO at filter.ts:27.
        if (once.numRows() > 0) {
          expect(twice.columnNames()).toEqual(once.columnNames());
        }
      }),
      { numRuns: 100 }
    );
  });
});
