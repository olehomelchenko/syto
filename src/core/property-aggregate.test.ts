import * as fc from 'fast-check';
import * as aq from 'arquero';
import { describe, it, expect } from 'vitest';
import { applyTransform } from './transforms';
import { aggregateCaseArb } from './property-generators';

describe('Property-based: aggregate', () => {
  it('group count never exceeds input row count', () => {
    fc.assert(
      fc.property(aggregateCaseArb, ({ rows, groupCol, valueCol }) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const result = applyTransform(
          table,
          {
            aggregate: {
              groupby: [groupCol],
              rollup: { count: `op.count(${valueCol})` },
            },
          },
          columns
        );
        expect(result.numRows()).toBeLessThanOrEqual(table.numRows());
      }),
      { numRuns: 100 }
    );
  });

  it('sum over groups equals sum over input', () => {
    fc.assert(
      fc.property(aggregateCaseArb, ({ rows, groupCol, valueCol }) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const result = applyTransform(
          table,
          {
            aggregate: {
              groupby: [groupCol],
              rollup: { total: `op.sum(${valueCol})` },
            },
          },
          columns
        );

        const outRows = result.objects();
        const outSum = outRows.reduce((acc: number, r: any) => acc + (r.total ?? 0), 0);

        // op.sum ignores nulls; mirror that with `?? 0` on the input side.
        const inRows = table.objects();
        const inSum = inRows.reduce((acc: number, r: any) => acc + (r[valueCol] ?? 0), 0);

        expect(outSum).toEqual(inSum);
      }),
      { numRuns: 100 }
    );
  });

  it('count over groups equals count over input', () => {
    fc.assert(
      fc.property(aggregateCaseArb, ({ rows, groupCol, valueCol }) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const result = applyTransform(
          table,
          {
            aggregate: {
              groupby: [groupCol],
              rollup: { cnt: `op.count(${valueCol})` },
            },
          },
          columns
        );

        const outRows = result.objects();
        const outCount = outRows.reduce((acc: number, r: any) => acc + (r.cnt ?? 0), 0);

        // Count of non-null values
        const inRows = table.objects();
        const inCount = inRows.filter((r: any) => r[valueCol] != null).length;

        expect(outCount).toEqual(inCount);
      }),
      { numRuns: 100 }
    );
  });

  it('aggregate without groupby returns exactly one row', () => {
    fc.assert(
      fc.property(aggregateCaseArb, ({ rows, valueCol }) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const result = applyTransform(
          table,
          {
            aggregate: {
              groupby: [],
              rollup: { total: `op.sum(${valueCol})` },
            },
          },
          columns
        );
        expect(result.numRows()).toEqual(1);
      }),
      { numRuns: 50 }
    );
  });

  it('column names include groupby columns and rollup output names', () => {
    fc.assert(
      fc.property(aggregateCaseArb, ({ rows, groupCol, valueCol }) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const result = applyTransform(
          table,
          {
            aggregate: {
              groupby: [groupCol],
              rollup: { total: `op.sum(${valueCol})` },
            },
          },
          columns
        );
        const resultCols = result.columnNames();
        expect(resultCols).toContain(groupCol);
        expect(resultCols).toContain('total');
      }),
      { numRuns: 50 }
    );
  });
});
