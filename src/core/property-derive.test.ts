import * as fc from 'fast-check';
import * as aq from 'arquero';
import { describe, it, expect } from 'vitest';
import { applyTransform } from './transforms';
import { deriveCaseArb } from './property-generators';

describe('Property-based: derive', () => {
  it('preserves row count', () => {
    fc.assert(
      fc.property(deriveCaseArb, ({ rows, op }) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const result = applyTransform(table, { derive: { c: `a ${op} b` } }, columns);
        expect(result.numRows()).toEqual(table.numRows());
      }),
      { numRuns: 100 }
    );
  });

  it('adds exactly one column with the declared name', () => {
    fc.assert(
      fc.property(deriveCaseArb, ({ rows, op }) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const result = applyTransform(table, { derive: { sum: `a ${op} b` } }, columns);
        const resultCols = result.columnNames();
        expect(resultCols.length).toEqual(columns.length + 1);
        expect(resultCols).toContain('sum');
        for (const c of columns) expect(resultCols).toContain(c);
      }),
      { numRuns: 100 }
    );
  });

  it('identity derive: copying a column yields equal values', () => {
    fc.assert(
      fc.property(deriveCaseArb, ({ rows }) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const result = applyTransform(table, { derive: { copy_a: 'a' } }, columns);
        const out = result.objects();
        out.forEach((r: any) => {
          expect(r.copy_a).toEqual(r.a);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('binary expression matches per-row JS computation', () => {
    fc.assert(
      fc.property(deriveCaseArb, ({ rows, op }) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const result = applyTransform(table, { derive: { c: `a ${op} b` } }, columns);
        const out = result.objects();
        out.forEach((r: any) => {
          let expected: number;
          if (op === '+') expected = r.a + r.b;
          else if (op === '-') expected = r.a - r.b;
          else expected = r.a * r.b;
          expect(r.c).toEqual(expected);
        });
      }),
      { numRuns: 100 }
    );
  });
});
