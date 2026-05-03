import * as fc from 'fast-check';
import * as aq from 'arquero';
import { describe, it, expect } from 'vitest';
import { applyTransform } from './transforms';
import { foldPivotCaseArb } from './property-generators';

describe('Property-based: fold', () => {
  it('row count multiplies by the number of folded columns', () => {
    fc.assert(
      fc.property(foldPivotCaseArb, (rows) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const folded = applyTransform(
          table,
          { fold: { columns: ['x', 'y', 'z'], as: ['k', 'v'] } },
          columns
        );
        expect(folded.numRows()).toEqual(table.numRows() * 3);
      }),
      { numRuns: 50 }
    );
  });

  it('output schema: untouched columns + the two `as` columns', () => {
    fc.assert(
      fc.property(foldPivotCaseArb, (rows) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const folded = applyTransform(
          table,
          { fold: { columns: ['x', 'y', 'z'], as: ['k', 'v'] } },
          columns
        );
        const out = folded.columnNames();
        // Folded columns disappear from the output schema.
        expect(out).not.toContain('x');
        expect(out).not.toContain('y');
        expect(out).not.toContain('z');
        // Untouched id is preserved.
        expect(out).toContain('id');
        // The two `as` columns are added.
        expect(out).toContain('k');
        expect(out).toContain('v');
      }),
      { numRuns: 50 }
    );
  });

  it('every input cell from the folded columns appears as a (key, value) pair', () => {
    fc.assert(
      fc.property(foldPivotCaseArb, (rows) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const folded = applyTransform(
          table,
          { fold: { columns: ['x', 'y', 'z'], as: ['k', 'v'] } },
          columns
        );
        const out = folded.objects() as any[];
        // For each input row, we expect three output rows tagged x/y/z with the original values.
        for (const inRow of rows) {
          for (const c of ['x', 'y', 'z']) {
            const match = out.find(
              (r) => r.id === inRow.id && r.k === c && r.v === (inRow as any)[c]
            );
            expect(match).toBeDefined();
          }
        }
      }),
      { numRuns: 50 }
    );
  });
});

describe('Property-based: pivot', () => {
  it('without `rows`, output has exactly one row', () => {
    fc.assert(
      fc.property(foldPivotCaseArb, (rows) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();

        // Fold first to produce a long-format input for pivot.
        const folded = applyTransform(
          table,
          { fold: { columns: ['x', 'y', 'z'], as: ['k', 'v'] } },
          columns
        );

        const pivoted = applyTransform(
          folded,
          { pivot: { rows: [], keys: 'k', values: 'v', aggregation: 'sum' } },
          folded.columnNames()
        );
        expect(pivoted.numRows()).toEqual(1);
      }),
      { numRuns: 50 }
    );
  });

  it('output schema includes the row-identity columns and the pivot keys', () => {
    fc.assert(
      fc.property(foldPivotCaseArb, (rows) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();
        const folded = applyTransform(
          table,
          { fold: { columns: ['x', 'y', 'z'], as: ['k', 'v'] } },
          columns
        );
        const pivoted = applyTransform(
          folded,
          { pivot: { rows: ['id'], keys: 'k', values: 'v', aggregation: 'sum' } },
          folded.columnNames()
        );
        const out = pivoted.columnNames();
        expect(out).toContain('id');
        expect(out).toContain('x');
        expect(out).toContain('y');
        expect(out).toContain('z');
      }),
      { numRuns: 50 }
    );
  });

  it('round-trip: pivot(fold(t)) recovers the original table (modulo column ordering)', () => {
    fc.assert(
      fc.property(foldPivotCaseArb, (rows) => {
        const table = (aq as any).from(rows);
        const columns = table.columnNames();

        const folded = applyTransform(
          table,
          { fold: { columns: ['x', 'y', 'z'], as: ['k', 'v'] } },
          columns
        );
        const recovered = applyTransform(
          folded,
          { pivot: { rows: ['id'], keys: 'k', values: 'v', aggregation: 'sum' } },
          folded.columnNames()
        );

        expect(recovered.numRows()).toEqual(table.numRows());

        // Compare row-by-row using id as the join key.
        const original = table.objects() as any[];
        const out = recovered.objects() as any[];
        for (const inRow of original) {
          const match = out.find((r) => r.id === inRow.id);
          expect(match).toBeDefined();
          expect(match.x).toEqual(inRow.x);
          expect(match.y).toEqual(inRow.y);
          expect(match.z).toEqual(inRow.z);
        }
      }),
      { numRuns: 50 }
    );
  });
});
