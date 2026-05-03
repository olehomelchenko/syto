import * as fc from 'fast-check';
import * as aq from 'arquero';
import { describe, it, expect } from 'vitest';
import { applyTransform } from './transforms';
import { joinCaseArb } from './property-generators';

/**
 * Joins consume the right table from a TransformContext (sources/models),
 * referenced by id. Wrap each fast-check run with a fresh context so the
 * generated `right` rows are reachable.
 */
function withContext(rightRows: any[]) {
  return {
    sources: [],
    models: [{ id: 'rt', name: 'Right', data: rightRows }],
  };
}

describe('Property-based: join', () => {
  it('left join with unique right keys preserves the left cardinality', () => {
    fc.assert(
      fc.property(joinCaseArb, ({ left, right }) => {
        const leftTable = (aq as any).from(left);
        const result = applyTransform(
          leftTable,
          { join: { right: 'rt', on: [['id', 'id']], how: 'left' } },
          ['id', 'name'],
          withContext(right)
        );
        // Right keys are unique by construction, so every left row has at
        // most one match — left join therefore produces exactly numRows(left).
        expect(result.numRows()).toEqual(leftTable.numRows());
      }),
      { numRuns: 100 }
    );
  });

  it('inner join never exceeds left cardinality (with unique right keys)', () => {
    fc.assert(
      fc.property(joinCaseArb, ({ left, right }) => {
        const leftTable = (aq as any).from(left);
        const result = applyTransform(
          leftTable,
          { join: { right: 'rt', on: [['id', 'id']], how: 'inner' } },
          ['id', 'name'],
          withContext(right)
        );
        expect(result.numRows()).toBeLessThanOrEqual(leftTable.numRows());
      }),
      { numRuns: 100 }
    );
  });

  it('semijoin + antijoin cardinalities partition the left rows', () => {
    fc.assert(
      fc.property(joinCaseArb, ({ left, right }) => {
        const leftTable = (aq as any).from(left);
        const semi = applyTransform(
          leftTable,
          { semijoin: { right: 'rt', on: [['id', 'id']] } },
          ['id', 'name'],
          withContext(right)
        );
        const anti = applyTransform(
          leftTable,
          { antijoin: { right: 'rt', on: [['id', 'id']] } },
          ['id', 'name'],
          withContext(right)
        );
        // Left rows split cleanly between matched (semi) and unmatched (anti).
        expect(semi.numRows() + anti.numRows()).toEqual(leftTable.numRows());
      }),
      { numRuns: 100 }
    );
  });

  it('antijoin: no row in result has a key present in right', () => {
    fc.assert(
      fc.property(joinCaseArb, ({ left, right }) => {
        const leftTable = (aq as any).from(left);
        const result = applyTransform(
          leftTable,
          { antijoin: { right: 'rt', on: [['id', 'id']] } },
          ['id', 'name'],
          withContext(right)
        );
        const rightIds = new Set(right.map((r: any) => r.id));
        for (const r of result.objects() as any[]) {
          expect(rightIds.has(r.id)).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('inner join: every result key is present in BOTH left and right', () => {
    fc.assert(
      fc.property(joinCaseArb, ({ left, right }) => {
        const leftTable = (aq as any).from(left);
        const result = applyTransform(
          leftTable,
          { join: { right: 'rt', on: [['id', 'id']], how: 'inner' } },
          ['id', 'name'],
          withContext(right)
        );
        const leftIds = new Set(left.map((r) => r.id));
        const rightIds = new Set(right.map((r: any) => r.id));
        for (const r of result.objects() as any[]) {
          expect(leftIds.has(r.id)).toBe(true);
          expect(rightIds.has(r.id)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('left join with empty right produces the left table unchanged (schemaless-right contract)', () => {
    fc.assert(
      fc.property(joinCaseArb, ({ left }) => {
        const leftTable = (aq as any).from(left);
        const result = applyTransform(
          leftTable,
          { join: { right: 'rt', on: [['id', 'id']], how: 'left' } },
          ['id', 'name'],
          withContext([]) // schemaless empty right
        );
        // Per the Batch 1 join.ts contract: left/full → left unchanged when right is schemaless.
        expect(result.numRows()).toEqual(leftTable.numRows());
        expect(result.columnNames()).toEqual(['id', 'name']);
      }),
      { numRuns: 50 }
    );
  });

  it('semijoin with null left key never matches (SQL contract)', () => {
    // Pinned in transforms-join.test.ts; reasserted here as a property over
    // arbitrary right tables. A left row with `id: null` must not appear in
    // a semijoin result, even if the right table also contains `id: null`.
    fc.assert(
      fc.property(joinCaseArb, ({ right }) => {
        const left = [
          { id: null, name: 'X' },
          { id: null, name: 'Y' },
          { id: 999, name: 'Z' }, // not in right (right only has 0..rightSize-1)
        ];
        const leftTable = (aq as any).from(left);
        // Insert a null-keyed row on the right too to make sure null!=null still holds.
        const rightWithNull = [...right, { id: null, score: 0 }];
        const result = applyTransform(
          leftTable,
          { semijoin: { right: 'rt', on: [['id', 'id']] } },
          ['id', 'name'],
          withContext(rightWithNull)
        );
        for (const r of result.objects() as any[]) {
          expect(r.id).not.toBeNull();
        }
      }),
      { numRuns: 30 }
    );
  });
});
