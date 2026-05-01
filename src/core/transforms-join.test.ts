import { describe, it, expect } from 'vitest';
import * as aq from 'arquero';
import { applyTransform, describeTransform } from './transforms';

describe('Transform Engine - Join and Array Operations', () => {
  describe('applyTransform() - SPREAD', () => {
    it('should spread array column into multiple columns', () => {
      const table = (aq as any).from([
        { id: 1, tags: ['a', 'b', 'c'] },
        { id: 2, tags: ['x', 'y'] },
      ]);
      const transform = { spread: { column: 'tags' } };
      const result = applyTransform(table, transform, ['id', 'tags']);
      const columns = result.columnNames();

      // Should have id column and spread tag columns
      // Note: Arquero uses 1-based indexing for spread columns
      expect(columns).toContain('id');
      expect(columns).toContain('tags_1');
      expect(columns).toContain('tags_2');
      expect(columns).toContain('tags_3');
      expect(columns).not.toContain('tags'); // Original column removed

      const rows = result.objects();
      expect(rows[0].tags_1).toBe('a');
      expect(rows[0].tags_2).toBe('b');
      expect(rows[0].tags_3).toBe('c');
      expect(rows[1].tags_1).toBe('x');
      expect(rows[1].tags_2).toBe('y');
    });

    it('should respect limit parameter', () => {
      const table = (aq as any).from([{ id: 1, tags: ['a', 'b', 'c', 'd', 'e'] }]);
      const transform = { spread: { column: 'tags', limit: 2 } };
      const result = applyTransform(table, transform, ['id', 'tags']);
      const columns = result.columnNames();

      // Should only have 2 spread columns (1-based indexing)
      expect(columns).toContain('tags_1');
      expect(columns).toContain('tags_2');
      expect(columns).not.toContain('tags_3');
    });

    it('should handle empty arrays', () => {
      const table = (aq as any).from([
        { id: 1, tags: [] },
        { id: 2, tags: ['a'] },
      ]);
      const transform = { spread: { column: 'tags' } };
      const result = applyTransform(table, transform, ['id', 'tags']);

      expect(result.numRows()).toBe(2);
      // Empty array row should have undefined/null values
    });

    it('should handle JSON string arrays', () => {
      const table = (aq as any).from([
        { id: 1, tags: '["a", "b", "c"]' },
        { id: 2, tags: '["x", "y"]' },
      ]);
      const transform = { spread: { column: 'tags' } };
      const result = applyTransform(table, transform, ['id', 'tags']);
      const columns = result.columnNames();

      // Should parse JSON strings and spread them
      expect(columns).toContain('id');
      expect(columns).toContain('tags_1');
      expect(columns).toContain('tags_2');
      expect(columns).toContain('tags_3');
      expect(columns).not.toContain('tags'); // Original column removed

      const rows = result.objects();
      expect(rows[0].tags_1).toBe('a');
      expect(rows[0].tags_2).toBe('b');
      expect(rows[0].tags_3).toBe('c');
      expect(rows[1].tags_1).toBe('x');
      expect(rows[1].tags_2).toBe('y');
    });

    it('should handle JSON string arrays with limit', () => {
      const table = (aq as any).from([{ id: 1, tags: '["a", "b", "c", "d"]' }]);
      const transform = { spread: { column: 'tags', limit: 2 } };
      const result = applyTransform(table, transform, ['id', 'tags']);
      const columns = result.columnNames();

      expect(columns).toContain('tags_1');
      expect(columns).toContain('tags_2');
      expect(columns).not.toContain('tags_3');
    });

    it('should keep original column when keepOriginal is true', () => {
      const table = (aq as any).from([
        { id: 1, tags: ['a', 'b', 'c'] },
        { id: 2, tags: ['x', 'y'] },
      ]);
      const transform = { spread: { column: 'tags', keepOriginal: true } };
      const result = applyTransform(table, transform, ['id', 'tags']);
      const columns = result.columnNames();

      // Should keep the original column
      expect(columns).toContain('tags');
      expect(columns).toContain('tags_1');
      expect(columns).toContain('tags_2');
      expect(columns).toContain('tags_3');

      const rows = result.objects();
      // Original column should still have array values
      expect(rows[0].tags).toEqual(['a', 'b', 'c']);
      expect(rows[1].tags).toEqual(['x', 'y']);
    });
  });

  describe('applyTransform() - UNROLL', () => {
    it('should unroll array values into separate rows', () => {
      const table = (aq as any).from([
        { id: 1, items: ['a', 'b', 'c'] },
        { id: 2, items: ['x'] },
      ]);
      const transform = { unroll: { column: 'items' } };
      const result = applyTransform(table, transform, ['id', 'items']);

      expect(result.numRows()).toBe(4); // 3 + 1
      const rows = result.objects();

      // First row unrolled into 3 rows
      expect(rows.filter((r) => r.id === 1).length).toBe(3);
      expect(rows.filter((r) => r.id === 2).length).toBe(1);

      // Check values
      expect(rows[0].items).toBe('a');
      expect(rows[1].items).toBe('b');
      expect(rows[2].items).toBe('c');
      expect(rows[3].items).toBe('x');
    });

    it('should add index column when indices is true', () => {
      const table = (aq as any).from([{ id: 1, items: ['a', 'b'] }]);
      const transform = { unroll: { column: 'items', indices: true } };
      const result = applyTransform(table, transform, ['id', 'items']);
      const columns = result.columnNames();

      expect(columns).toContain('items__unroll_index');
      const rows = result.objects();
      expect(rows[0].items__unroll_index).toBe(0);
      expect(rows[1].items__unroll_index).toBe(1);
    });

    it('should handle empty arrays', () => {
      const table = (aq as any).from([
        { id: 1, items: [] },
        { id: 2, items: ['a'] },
      ]);
      const transform = { unroll: { column: 'items' } };
      const result = applyTransform(table, transform, ['id', 'items']);

      // Empty array row is removed by unroll
      expect(result.numRows()).toBe(1);
      const rows = result.objects();
      expect(rows[0].id).toBe(2);
    });

    it('should handle JSON string arrays', () => {
      const table = (aq as any).from([
        { id: 1, items: '["a", "b", "c"]' },
        { id: 2, items: '["x"]' },
      ]);
      const transform = { unroll: { column: 'items' } };
      const result = applyTransform(table, transform, ['id', 'items']);

      expect(result.numRows()).toBe(4); // 3 + 1
      const rows = result.objects();

      // Check that JSON was parsed and unrolled correctly
      expect(rows.filter((r) => r.id === 1).length).toBe(3);
      expect(rows.filter((r) => r.id === 2).length).toBe(1);

      expect(rows[0].items).toBe('a');
      expect(rows[1].items).toBe('b');
      expect(rows[2].items).toBe('c');
      expect(rows[3].items).toBe('x');
    });

    it('should handle JSON string arrays with indices', () => {
      const table = (aq as any).from([{ id: 1, items: '["a", "b"]' }]);
      const transform = { unroll: { column: 'items', indices: true } };
      const result = applyTransform(table, transform, ['id', 'items']);
      const columns = result.columnNames();

      expect(columns).toContain('items__unroll_index');
      const rows = result.objects();
      expect(rows[0].items__unroll_index).toBe(0);
      expect(rows[1].items__unroll_index).toBe(1);
    });

    it('should keep original column when keepOriginal is true', () => {
      const table = (aq as any).from([
        { id: 1, items: ['a', 'b', 'c'] },
        { id: 2, items: ['x'] },
      ]);
      const transform = { unroll: { column: 'items', keepOriginal: true } };
      const result = applyTransform(table, transform, ['id', 'items']);
      const columns = result.columnNames();

      // Should keep the original column
      expect(columns).toContain('items');

      expect(result.numRows()).toBe(4); // 3 + 1
      const rows = result.objects();

      // Original column should still have array values
      expect(rows[0].items).toEqual(['a', 'b', 'c']);
      expect(rows[1].items).toEqual(['a', 'b', 'c']);
      expect(rows[2].items).toEqual(['a', 'b', 'c']);
      expect(rows[3].items).toEqual(['x']);
    });
  });

  describe('applyTransform() - SEMIJOIN', () => {
    it('should keep rows that match right table', () => {
      const leftTable = (aq as any).from([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' },
        { id: 4, name: 'Diana' },
      ]);

      const models = [
        {
          id: 'mdl_right',
          name: 'Right Model',
          data: [
            { id: 1, score: 100 },
            { id: 3, score: 200 },
          ],
        },
      ];

      const context = { sources: [], models: models };
      const transform = { semijoin: { right: 'mdl_right', on: [['id', 'id']] } };
      const result = applyTransform(leftTable, transform, ['id', 'name'], context);
      const rows = result.objects();

      // Only rows that match (id 1 and 3)
      expect(rows.length).toBe(2);
      expect(rows.map((r) => r.id).sort()).toEqual([1, 3]);
      // Should NOT have columns from right table
      expect(rows[0]).not.toHaveProperty('score');
    });

    it('should use source data for semijoin', () => {
      const leftTable = (aq as any).from([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
      ]);

      const sources = [
        {
          id: 'src_1',
          name: 'Source',
          data: [{ id: 1, extra: 'info' }],
        },
      ];

      const context = { sources: sources, models: [] };
      const transform = { semijoin: { right: 'src_1', on: [['id', 'id']] } };
      const result = applyTransform(leftTable, transform, ['id', 'name'], context);
      const rows = result.objects();

      expect(rows.length).toBe(1);
      expect(rows[0].id).toBe(1);
    });

    it('should throw error when semijoin target not found', () => {
      const table = (aq as any).from([{ id: 1 }]);
      const transform = { semijoin: { right: 'nonexistent', on: [['id', 'id']] } };

      expect(() => {
        applyTransform(table, transform, ['id'], { sources: [], models: [] });
      }).toThrow("Semijoin target with ID 'nonexistent' not found");
    });
  });

  describe('applyTransform() - ANTIJOIN', () => {
    it('should keep rows that do NOT match right table', () => {
      const leftTable = (aq as any).from([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' },
        { id: 4, name: 'Diana' },
      ]);

      const models = [
        {
          id: 'mdl_right',
          name: 'Right Model',
          data: [
            { id: 1, score: 100 },
            { id: 3, score: 200 },
          ],
        },
      ];

      const context = { sources: [], models: models };
      const transform = { antijoin: { right: 'mdl_right', on: [['id', 'id']] } };
      const result = applyTransform(leftTable, transform, ['id', 'name'], context);
      const rows = result.objects();

      // Only rows that DON'T match (id 2 and 4)
      expect(rows.length).toBe(2);
      expect(rows.map((r) => r.id).sort()).toEqual([2, 4]);
    });

    it('should return all rows when no matches exist', () => {
      const leftTable = (aq as any).from([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
      ]);

      const models = [
        {
          id: 'mdl_right',
          name: 'Right',
          data: [{ id: 99, score: 999 }],
        },
      ];

      const context = { sources: [], models: models };
      const transform = { antijoin: { right: 'mdl_right', on: [['id', 'id']] } };
      const result = applyTransform(leftTable, transform, ['id', 'name'], context);

      expect(result.numRows()).toBe(2);
    });

    it('should return empty table when all rows match', () => {
      const leftTable = (aq as any).from([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
      ]);

      const models = [
        {
          id: 'mdl_right',
          name: 'Right',
          data: [
            { id: 1, score: 100 },
            { id: 2, score: 200 },
          ],
        },
      ];

      const context = { sources: [], models: models };
      const transform = { antijoin: { right: 'mdl_right', on: [['id', 'id']] } };
      const result = applyTransform(leftTable, transform, ['id', 'name'], context);

      expect(result.numRows()).toBe(0);
    });

    it('should throw error when antijoin target not found', () => {
      const table = (aq as any).from([{ id: 1 }]);
      const transform = { antijoin: { right: 'nonexistent', on: [['id', 'id']] } };

      expect(() => {
        applyTransform(table, transform, ['id'], { sources: [], models: [] });
      }).toThrow("Antijoin target with ID 'nonexistent' not found");
    });
  });

  describe('applyTransform() - LOOKUP', () => {
    it('should lookup and add columns from right table', () => {
      const leftTable = (aq as any).from([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
        { id: 3, name: 'Charlie' },
      ]);

      const models = [
        {
          id: 'mdl_right',
          name: 'Right Model',
          data: [
            { id: 1, score: 100, grade: 'A' },
            { id: 2, score: 85, grade: 'B' },
            { id: 4, score: 70, grade: 'C' },
          ],
        },
      ];

      const context = { sources: [], models: models };
      const transform = {
        lookup: { right: 'mdl_right', on: [['id', 'id']], values: ['score', 'grade'] },
      };
      const result = applyTransform(leftTable, transform, ['id', 'name'], context);
      const rows = result.objects();

      expect(rows.length).toBe(3);
      expect(result.columnNames()).toContain('score');
      expect(result.columnNames()).toContain('grade');

      // id 1 matches
      expect(rows[0].score).toBe(100);
      expect(rows[0].grade).toBe('A');

      // id 2 matches
      expect(rows[1].score).toBe(85);
      expect(rows[1].grade).toBe('B');

      // id 3 doesn't match — unmatched cells are normalised to null (SOUL §7).
      expect(rows[2].score).toBeNull();
      expect(rows[2].grade).toBeNull();
    });

    it('should lookup single column', () => {
      const leftTable = (aq as any).from([
        { id: 1, name: 'A' },
        { id: 2, name: 'B' },
      ]);

      const models = [
        {
          id: 'mdl_ref',
          name: 'Reference',
          data: [
            { id: 1, code: 'X01' },
            { id: 2, code: 'X02' },
          ],
        },
      ];

      const context = { sources: [], models: models };
      const transform = { lookup: { right: 'mdl_ref', on: [['id', 'id']], values: ['code'] } };
      const result = applyTransform(leftTable, transform, ['id', 'name'], context);
      const rows = result.objects();

      expect(rows[0].code).toBe('X01');
      expect(rows[1].code).toBe('X02');
    });

    it('should lookup from source', () => {
      const leftTable = (aq as any).from([{ id: 1, name: 'A' }]);

      const sources = [
        {
          id: 'src_ref',
          name: 'Reference Source',
          data: [{ id: 1, category: 'Premium' }],
        },
      ];

      const context = { sources: sources, models: [] };
      const transform = { lookup: { right: 'src_ref', on: [['id', 'id']], values: ['category'] } };
      const result = applyTransform(leftTable, transform, ['id', 'name'], context);
      const rows = result.objects();

      expect(rows[0].category).toBe('Premium');
    });

    it('should throw error when lookup target not found', () => {
      const table = (aq as any).from([{ id: 1 }]);
      const transform = { lookup: { right: 'nonexistent', on: [['id', 'id']], values: ['col'] } };

      expect(() => {
        applyTransform(table, transform, ['id'], { sources: [], models: [] });
      }).toThrow("Lookup target with ID 'nonexistent' not found");
    });
  });

  // Degenerate inputs — no-match right, duplicate keys, and empty-schema
  // inputs. These pin cardinality invariants plus one real gotcha: a model
  // with `data: []` is schema-less and throws in join parsing. That's a bug
  // at the Syto↔Arquero seam worth surfacing.
  describe('applyTransform() - Join degenerate cases', () => {
    const left = () =>
      (aq as any).from([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ]);

    it('semijoin with no matching right rows returns zero rows', () => {
      const ctx = {
        sources: [],
        models: [{ id: 'mdl_r', name: 'R', data: [{ id: 999, score: 1 }] }],
      };
      const result = applyTransform(
        left(),
        { semijoin: { right: 'mdl_r', on: [['id', 'id']] } },
        ['id', 'name'],
        ctx
      );
      expect(result.numRows()).toBe(0);
    });

    it('antijoin with no matching right rows returns all left rows', () => {
      const ctx = {
        sources: [],
        models: [{ id: 'mdl_r', name: 'R', data: [{ id: 999, score: 1 }] }],
      };
      const result = applyTransform(
        left(),
        { antijoin: { right: 'mdl_r', on: [['id', 'id']] } },
        ['id', 'name'],
        ctx
      );
      expect(result.numRows()).toBe(2);
    });

    it('lookup with no matching right rows preserves left cardinality with null values', () => {
      // CONTRACT (SOUL §7): missing data is `null`, never `undefined`. Arquero
      // emits `undefined` for unmatched lookup cells; the join handler
      // normalises these to `null` before returning.
      const ctx = {
        sources: [],
        models: [{ id: 'mdl_r', name: 'R', data: [{ id: 999, score: 1 }] }],
      };
      const result = applyTransform(
        left(),
        { lookup: { right: 'mdl_r', on: [['id', 'id']], values: ['score'] } },
        ['id', 'name'],
        ctx
      );
      expect(result.numRows()).toBe(2);
      expect(result.columnNames()).toContain('score');
      const rows = result.objects();
      expect(rows[0].score).toBeNull();
      expect(rows[1].score).toBeNull();
    });

    it('semijoin on empty-but-schemad left returns zero rows', () => {
      // A filter-to-empty left retains its schema, unlike aq.from([]).
      const empty = (aq as any).from([{ id: 1, name: 'A' }]).filter(() => false);
      const ctx = {
        sources: [],
        models: [{ id: 'mdl_r', name: 'R', data: [{ id: 1, x: 'a' }] }],
      };
      const result = applyTransform(
        empty,
        { semijoin: { right: 'mdl_r', on: [['id', 'id']] } },
        ['id', 'name'],
        ctx
      );
      expect(result.numRows()).toBe(0);
    });

    it('semijoin against a `data: []` model returns empty result', () => {
      // Empty `data` produces a schema-less Arquero table. The handler
      // detects this and short-circuits to the correct empty result
      // rather than letting Arquero's key parser throw.
      const ctx = {
        sources: [],
        models: [{ id: 'mdl_r', name: 'R', data: [] as any[] }],
      };
      const result = applyTransform(
        left(),
        { semijoin: { right: 'mdl_r', on: [['id', 'id']] } },
        ['id', 'name'],
        ctx
      );
      expect(result.numRows()).toBe(0);
      expect(result.columnNames()).toEqual(['id', 'name']);
    });

    it('antijoin against a `data: []` model returns the left table unchanged', () => {
      const ctx = {
        sources: [],
        models: [{ id: 'mdl_r', name: 'R', data: [] as any[] }],
      };
      const result = applyTransform(
        left(),
        { antijoin: { right: 'mdl_r', on: [['id', 'id']] } },
        ['id', 'name'],
        ctx
      );
      expect(result.numRows()).toBe(2);
      expect(result.objects()).toEqual([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ]);
    });

    // Inner/right/cross joins against a schema-less right have no possible
    // matches, so the result is empty-but-schemad with the left's columns.
    // Left/full joins have nothing to add from the right, so the left table
    // is returned unchanged. Without the guard, Arquero throws "Invalid column
    // reference" when it tries to parse keys against a zero-column right.
    it('inner join against a `data: []` model returns empty result with left schema', () => {
      const ctx = {
        sources: [],
        models: [{ id: 'mdl_r', name: 'R', data: [] as any[] }],
      };
      const result = applyTransform(
        left(),
        { join: { right: 'mdl_r', on: [['id', 'id']], how: 'inner' } },
        ['id', 'name'],
        ctx
      );
      expect(result.numRows()).toBe(0);
      expect(result.columnNames()).toEqual(['id', 'name']);
    });

    it('left join against a `data: []` model returns the left table unchanged', () => {
      const ctx = {
        sources: [],
        models: [{ id: 'mdl_r', name: 'R', data: [] as any[] }],
      };
      const result = applyTransform(
        left(),
        { join: { right: 'mdl_r', on: [['id', 'id']], how: 'left' } },
        ['id', 'name'],
        ctx
      );
      expect(result.objects()).toEqual([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ]);
    });

    it('right join against a `data: []` model returns empty result', () => {
      const ctx = {
        sources: [],
        models: [{ id: 'mdl_r', name: 'R', data: [] as any[] }],
      };
      const result = applyTransform(
        left(),
        { join: { right: 'mdl_r', on: [['id', 'id']], how: 'right' } },
        ['id', 'name'],
        ctx
      );
      expect(result.numRows()).toBe(0);
    });

    it('full join against a `data: []` model returns the left table unchanged', () => {
      const ctx = {
        sources: [],
        models: [{ id: 'mdl_r', name: 'R', data: [] as any[] }],
      };
      const result = applyTransform(
        left(),
        { join: { right: 'mdl_r', on: [['id', 'id']], how: 'full' } },
        ['id', 'name'],
        ctx
      );
      expect(result.objects()).toEqual([
        { id: 1, name: 'Alice' },
        { id: 2, name: 'Bob' },
      ]);
    });

    it('cross join against a `data: []` model returns empty result', () => {
      // Cartesian product with zero rows on the right is zero rows total.
      // Note: Arquero's cross() does NOT throw here — it silently returns
      // the left table unchanged, which is wrong (n × 0 ≠ n). The guard
      // gives us the correct cardinality.
      const ctx = {
        sources: [],
        models: [{ id: 'mdl_r', name: 'R', data: [] as any[] }],
      };
      const result = applyTransform(
        left(),
        { join: { right: 'mdl_r', on: [['id', 'id']], how: 'cross' } },
        ['id', 'name'],
        ctx
      );
      expect(result.numRows()).toBe(0);
    });

    it('lookup against a `data: []` model adds null-valued columns', () => {
      const ctx = {
        sources: [],
        models: [{ id: 'mdl_r', name: 'R', data: [] as any[] }],
      };
      const result = applyTransform(
        left(),
        { lookup: { right: 'mdl_r', on: [['id', 'id']], values: ['score', 'grade'] } },
        ['id', 'name'],
        ctx
      );
      expect(result.numRows()).toBe(2);
      expect(result.columnNames()).toContain('score');
      expect(result.columnNames()).toContain('grade');
      const rows = result.objects();
      expect(rows[0].score).toBeNull();
      expect(rows[0].grade).toBeNull();
    });

    it('lookup with duplicate keys on right picks one match (1:1 cardinality)', () => {
      // Arquero's lookup matches at most one right row per left row.
      // This test pins that behaviour so a change would be explicit.
      const ctx = {
        sources: [],
        models: [
          {
            id: 'mdl_r',
            name: 'R',
            data: [
              { id: 1, score: 100 },
              { id: 1, score: 999 },
            ],
          },
        ],
      };
      const result = applyTransform(
        left(),
        { lookup: { right: 'mdl_r', on: [['id', 'id']], values: ['score'] } },
        ['id', 'name'],
        ctx
      );
      expect(result.numRows()).toBe(2); // left cardinality preserved
      const rows = result.objects();
      // id=1 gets exactly one of the two candidate scores (not both, not summed)
      expect([100, 999]).toContain(rows[0].score);
    });

    it('semijoin with duplicate right keys preserves left cardinality', () => {
      const ctx = {
        sources: [],
        models: [
          {
            id: 'mdl_r',
            name: 'R',
            data: [
              { id: 1, x: 'a' },
              { id: 1, x: 'b' },
              { id: 1, x: 'c' },
            ],
          },
        ],
      };
      const result = applyTransform(
        left(),
        { semijoin: { right: 'mdl_r', on: [['id', 'id']] } },
        ['id', 'name'],
        ctx
      );
      // Left has one row with id=1; should produce exactly one row, not three
      const rows = result.objects().filter((r: any) => r.id === 1);
      expect(rows.length).toBe(1);
    });
  });

  // CONTRACT (SOUL §7): null does not match null in join keys, following SQL
  // standard. Arquero's join verbs already implement this; these tests pin it
  // so a future engine swap (e.g. DuckDB) cannot silently change semantics.
  // Preserve-side semantics: null-keyed rows are kept where the join would
  // keep an unmatched row (left/right/full/anti/lookup) and dropped where it
  // would not (inner/semi).
  describe('applyTransform() - Null-in-join-keys contract', () => {
    const leftWithNulls = () =>
      (aq as any).from([
        { id: 1, name: 'Alice' },
        { id: null, name: 'NullLeft' },
        { id: 2, name: 'Bob' },
      ]);
    const rightWithNulls = () => [
      { id: 1, score: 100 },
      { id: null, score: 999 },
      { id: 3, score: 300 },
    ];
    const ctx = () => ({
      sources: [],
      models: [{ id: 'mdl_r', name: 'R', data: rightWithNulls() }],
    });

    it('inner join: null-keyed rows on either side are dropped', () => {
      const result = applyTransform(
        leftWithNulls(),
        { join: { right: 'mdl_r', on: [['id', 'id']], how: 'inner' } },
        ['id', 'name'],
        ctx()
      );
      const rows = result.objects();
      expect(rows.length).toBe(1);
      expect(rows[0].id).toBe(1);
    });

    it('left join: null-keyed left rows are kept, unmatched, with right cols null', () => {
      const result = applyTransform(
        leftWithNulls(),
        { join: { right: 'mdl_r', on: [['id', 'id']], how: 'left' } },
        ['id', 'name'],
        ctx()
      );
      const rows = result.objects();
      expect(rows.length).toBe(3);
      const nullLeft = rows.find((r: any) => r.name === 'NullLeft');
      expect(nullLeft.id).toBeNull();
      expect(nullLeft.score).toBeNull();
      const bob = rows.find((r: any) => r.name === 'Bob');
      expect(bob.score).toBeNull();
    });

    it('right join: null-keyed right rows are kept, unmatched, with left cols null', () => {
      const result = applyTransform(
        leftWithNulls(),
        { join: { right: 'mdl_r', on: [['id', 'id']], how: 'right' } },
        ['id', 'name'],
        ctx()
      );
      const rows = result.objects();
      expect(rows.length).toBe(3);
      const nullRight = rows.find((r: any) => r.score === 999);
      expect(nullRight.id).toBeNull();
      expect(nullRight.name).toBeNull();
    });

    it('full join: null-keyed rows from both sides kept as unmatched', () => {
      const result = applyTransform(
        leftWithNulls(),
        { join: { right: 'mdl_r', on: [['id', 'id']], how: 'full' } },
        ['id', 'name'],
        ctx()
      );
      const rows = result.objects();
      // 1 match (id=1) + 2 left-only (id=null, id=2) + 2 right-only (id=null, id=3) = 5
      expect(rows.length).toBe(5);
      // All "missing" cells must be null (not undefined) — SOUL §7.
      for (const r of rows) {
        for (const v of Object.values(r)) {
          expect(v).not.toBeUndefined();
        }
      }
      // Left null-keyed row should appear with id=null (not undefined) and score=null.
      const leftNullRow = rows.find((r: any) => r.name === 'NullLeft');
      expect(leftNullRow.id).toBeNull();
      expect(leftNullRow.score).toBeNull();
      // Right null-keyed row should appear with id=null and name=null.
      const rightNullRows = rows.filter((r: any) => r.score === 999 && r.name === null);
      expect(rightNullRows.length).toBe(1);
    });

    it('semijoin: null-keyed left rows are dropped (no match in right)', () => {
      const result = applyTransform(
        leftWithNulls(),
        { semijoin: { right: 'mdl_r', on: [['id', 'id']] } },
        ['id', 'name'],
        ctx()
      );
      const rows = result.objects();
      expect(rows.length).toBe(1);
      expect(rows[0].id).toBe(1);
    });

    it('antijoin: null-keyed left rows are kept (no match in right)', () => {
      const result = applyTransform(
        leftWithNulls(),
        { antijoin: { right: 'mdl_r', on: [['id', 'id']] } },
        ['id', 'name'],
        ctx()
      );
      const rows = result.objects();
      expect(rows.length).toBe(2);
      expect(rows.map((r: any) => r.id).sort()).toEqual([2, null]);
    });

    it('lookup: null-keyed left rows get null in lookup values', () => {
      const result = applyTransform(
        leftWithNulls(),
        { lookup: { right: 'mdl_r', on: [['id', 'id']], values: ['score'] } },
        ['id', 'name'],
        ctx()
      );
      const rows = result.objects();
      expect(rows.length).toBe(3);
      const nullLeft = rows.find((r: any) => r.name === 'NullLeft');
      expect(nullLeft.score).toBeNull();
    });
  });

  describe('describeTransform() - Join and Array Transforms', () => {
    it('should describe semijoin transform', () => {
      expect(describeTransform({ semijoin: { right: 'mdl_test', on: [['id', 'id']] } })).toBe(
        'Semijoin: model'
      );
      expect(describeTransform({ semijoin: { right: 'src_test', on: [['id', 'id']] } })).toBe(
        'Semijoin: source'
      );
    });

    it('should describe antijoin transform', () => {
      expect(describeTransform({ antijoin: { right: 'mdl_test', on: [['id', 'id']] } })).toBe(
        'Antijoin: model'
      );
      expect(describeTransform({ antijoin: { right: 'src_test', on: [['id', 'id']] } })).toBe(
        'Antijoin: source'
      );
    });

    it('should describe lookup transform', () => {
      expect(
        describeTransform({ lookup: { right: 'mdl_ref', on: [['id', 'id']], values: ['score'] } })
      ).toBe('Lookup: 1 column from model');
      expect(
        describeTransform({
          lookup: { right: 'src_ref', on: [['id', 'id']], values: ['a', 'b', 'c'] },
        })
      ).toBe('Lookup: 3 columns from source');
    });

    it('should describe spread transform', () => {
      expect(describeTransform({ spread: { column: 'tags' } })).toBe('Spread: tags');
      expect(describeTransform({ spread: { column: 'items', limit: 5 } })).toBe(
        'Spread: items (max 5 cols)'
      );
    });

    it('should describe unroll transform', () => {
      expect(describeTransform({ unroll: { column: 'items' } })).toBe('Unroll: items');
      expect(describeTransform({ unroll: { column: 'data', indices: true } })).toBe(
        'Unroll: data (with indices)'
      );
    });
  });
});
