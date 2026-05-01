import { describe, it, expect } from 'vitest';
import * as aq from 'arquero';
import { applyTransform, describeTransform } from './transforms';

describe('Transform Engine - Aggregation Operations', () => {
  // Helper to create test data
  function createTestTable() {
    return (aq as any).from([
      { sales: 1000, revenue: 5000, cost: 3000, region: 'North', status: 'active' },
      { sales: 1500, revenue: 7000, cost: 4000, region: 'South', status: 'active' },
      { sales: 800, revenue: 4000, cost: 2500, region: 'North', status: 'pending' },
      { sales: 2000, revenue: 10000, cost: 6000, region: 'East', status: 'active' },
      { sales: 500, revenue: 3000, cost: 2000, region: 'West', status: 'inactive' },
    ]);
  }

  describe('applyTransform() - AGGREGATE', () => {
    it('should aggregate with count', () => {
      const table = createTestTable();
      const transform = {
        aggregate: {
          groupby: ['region'],
          rollup: { count: 'op.count()' },
        },
      };

      const result = applyTransform(table, transform, ['region']);

      expect(result.numRows()).toBe(4);
      const rows = result.orderby('region').objects();

      expect(rows[0].region).toBe('East');
      expect(rows[0].count).toBe(1);

      expect(rows[1].region).toBe('North');
      expect(rows[1].count).toBe(2);
    });

    it('should aggregate columns whose names contain single quotes', () => {
      const table = (aq as any).from([
        { "O'Brien": 10, group: 'a' },
        { "O'Brien": 20, group: 'a' },
        { "O'Brien": 30, group: 'b' },
      ]);

      const transform = {
        aggregate: {
          groupby: ['group'],
          rollup: { total: 'op.sum("O\'Brien")' },
        },
      };

      const result = applyTransform(table, transform, ['group', "O'Brien"]);
      const rows = result.orderby('group').objects();
      expect(rows[0].total).toBe(30);
      expect(rows[1].total).toBe(30);
    });

    it('should throw when a rollup output name collides with a groupby column', () => {
      // Arquero would silently overwrite the group label with the rollup
      // value, producing an unusable result with no way to identify groups.
      const table = (aq as any).from([
        { region: 'N', amount: 10 },
        { region: 'N', amount: 20 },
        { region: 'S', amount: 5 },
      ]);
      const transform = {
        aggregate: {
          groupby: ['region'],
          rollup: { region: 'op.count()' },
        },
      };
      expect(() => applyTransform(table, transform, ['region', 'amount'])).toThrow(
        /Aggregate would overwrite existing column: "region"/
      );
    });

    it('should mitigate floating point errors in sum/mean', () => {
      const floatTable = (aq as any).from([
        { id: 1, val: 0.1 },
        { id: 1, val: 0.2 },
      ]);

      const transform = {
        aggregate: {
          groupby: ['id'],
          rollup: {
            total: "op.sum('val')",
            avg: "op.mean('val')",
          },
        },
      };

      const result = applyTransform(floatTable, transform, ['id', 'val']);
      const row = result.object(0);

      expect(row.total).toBe(0.3);
      expect(row.avg).toBe(0.15);
    });
  });

  describe('applyTransform() - SPLIT', () => {
    it('should split column with comma delimiter', () => {
      const table = (aq as any).from([
        { name: 'John,Doe,25', id: 1 },
        { name: 'Jane,Smith,30', id: 2 },
      ]);
      const transform = {
        split: {
          column: 'name',
          delimiter: ',',
          mode: 'spread',
          keepOriginal: false,
        },
      };
      const result = applyTransform(table, transform, ['name', 'id']);

      expect(result.columnNames()).toEqual(['id', 'name_1', 'name_2', 'name_3']);
      const rows = result.objects();
      expect(rows[0]).toEqual({ id: 1, name_1: 'John', name_2: 'Doe', name_3: '25' });
    });

    it('should throw when split would overwrite an existing column', () => {
      const table = (aq as any).from([{ name: 'John,Doe', name_1: 'existing', id: 1 }]);
      const transform = {
        split: { column: 'name', delimiter: ',', mode: 'spread', keepOriginal: false },
      };
      expect(() => applyTransform(table, transform, ['name', 'name_1', 'id'])).toThrow(
        /Split would overwrite existing column: "name_1"/
      );
    });
  });

  describe('applyTransform() - UNROLL', () => {
    it('should throw when unroll index column would overwrite an existing column', () => {
      const table = (aq as any).from([{ tags: [1, 2, 3], tags__unroll_index: 'existing', id: 1 }]);
      const transform = {
        unroll: { column: 'tags', indices: true, keepOriginal: false },
      };
      expect(() => applyTransform(table, transform, ['tags', 'tags__unroll_index', 'id'])).toThrow(
        /Unroll would overwrite existing column: "tags__unroll_index"/
      );
    });
  });

  describe('applyTransform() - SPREAD', () => {
    it('should throw when spread would overwrite an existing column', () => {
      const table = (aq as any).from([{ tags: [10, 20], tags_1: 'existing', id: 1 }]);
      const transform = { spread: { column: 'tags', keepOriginal: false } };
      expect(() => applyTransform(table, transform, ['tags', 'tags_1', 'id'])).toThrow(
        /Spread would overwrite existing column: "tags_1"/
      );
    });
  });

  describe('applyTransform() - PIVOT collision', () => {
    it('should throw when a pivot key value collides with a row-identity column', () => {
      const table = (aq as any).from([
        { product: 'X', region: 'North', sales: 100 },
        { product: 'X', region: 'product', sales: 50 },
      ]);
      const transform = {
        pivot: { rows: ['product'], keys: 'region', values: 'sales', aggregation: 'sum' },
      };
      expect(() => applyTransform(table, transform, ['product', 'region', 'sales'])).toThrow(
        /Pivot would overwrite existing column: "product"/
      );
    });
  });

  describe('applyTransform() - PIVOT', () => {
    it('should pivot with rows, columns, and values', () => {
      const table = (aq as any).from([
        { product: 'Widget', region: 'North', sales: 100 },
        { product: 'Widget', region: 'South', sales: 150 },
        { product: 'Gadget', region: 'North', sales: 200 },
        { product: 'Gadget', region: 'South', sales: 250 },
      ]);
      const transform = {
        pivot: {
          rows: ['product'],
          keys: 'region',
          values: 'sales',
          aggregation: 'any',
          options: { sort: true },
        },
      };
      const result = applyTransform(table, transform, ['product', 'region', 'sales']);

      expect(result.columnNames()).toContain('product');
      expect(result.columnNames()).toContain('North');
      expect(result.columnNames()).toContain('South');
      expect(result.numRows()).toBe(2);

      const rows = result.orderby('product').objects();
      expect(rows[0].product).toBe('Gadget');
      expect(rows[0].North).toBe(200);
      expect(rows[0].South).toBe(250);
      expect(rows[1].product).toBe('Widget');
      expect(rows[1].North).toBe(100);
      expect(rows[1].South).toBe(150);
    });

    it('should pivot with sum aggregation', () => {
      const table = (aq as any).from([
        { product: 'Widget', region: 'North', sales: 100 },
        { product: 'Widget', region: 'North', sales: 50 },
        { product: 'Widget', region: 'South', sales: 150 },
      ]);
      const transform = {
        pivot: {
          rows: ['product'],
          keys: 'region',
          values: 'sales',
          aggregation: 'sum',
          options: { sort: true },
        },
      };
      const result = applyTransform(table, transform, ['product', 'region', 'sales']);

      const rows = result.objects();
      expect(rows[0].North).toBe(150); // 100 + 50
      expect(rows[0].South).toBe(150);
    });

    it('should pivot without row columns (single aggregated row)', () => {
      const table = (aq as any).from([
        { product: 'Widget', region: 'North', sales: 100 },
        { product: 'Widget', region: 'South', sales: 150 },
        { product: 'Gadget', region: 'North', sales: 200 },
      ]);
      const transform = {
        pivot: {
          keys: 'region',
          values: 'sales',
          aggregation: 'sum',
          options: { sort: true },
        },
      };
      const result = applyTransform(table, transform, ['product', 'region', 'sales']);

      expect(result.numRows()).toBe(1);
      const rows = result.objects();
      expect(rows[0].North).toBe(300); // 100 + 200
      expect(rows[0].South).toBe(150);
    });

    it('should respect limit option', () => {
      const table = (aq as any).from([
        { product: 'Widget', region: 'North', sales: 100 },
        { product: 'Widget', region: 'South', sales: 150 },
        { product: 'Widget', region: 'East', sales: 120 },
        { product: 'Widget', region: 'West', sales: 80 },
      ]);
      const transform = {
        pivot: {
          rows: ['product'],
          keys: 'region',
          values: 'sales',
          aggregation: 'any',
          options: { sort: true, limit: 2 },
        },
      };
      const result = applyTransform(table, transform, ['product', 'region', 'sales']);

      // Should only have product + 2 pivoted columns
      expect(result.columnNames().length).toBe(3);
    });

    it('should pivot with multiple row columns', () => {
      const table = (aq as any).from([
        { category: 'Electronics', product: 'Phone', region: 'North', sales: 100 },
        { category: 'Electronics', product: 'Phone', region: 'South', sales: 150 },
        { category: 'Electronics', product: 'Laptop', region: 'North', sales: 200 },
      ]);
      const transform = {
        pivot: {
          rows: ['category', 'product'],
          keys: 'region',
          values: 'sales',
          aggregation: 'sum',
          options: { sort: true },
        },
      };
      const result = applyTransform(table, transform, ['category', 'product', 'region', 'sales']);

      expect(result.columnNames()).toContain('category');
      expect(result.columnNames()).toContain('product');
      expect(result.columnNames()).toContain('North');
      expect(result.columnNames()).toContain('South');
      expect(result.numRows()).toBe(2);
    });
  });

  describe('describeTransform() - PIVOT', () => {
    it('should describe pivot transform', () => {
      const transform = {
        pivot: {
          rows: ['product'],
          keys: 'region',
          values: 'sales',
          aggregation: 'sum',
        },
      };
      const desc = describeTransform(transform);
      expect(desc).toBe('Pivot: sum(sales) by region');
    });

    it('should describe pivot transform with count aggregation', () => {
      const transform = {
        pivot: {
          keys: 'category',
          values: 'id',
          aggregation: 'count',
        },
      };
      const desc = describeTransform(transform);
      expect(desc).toBe('Pivot: count(id) by category');
    });
  });

  describe('applyTransform() - IMPUTE', () => {
    function createImputeTable() {
      return (aq as any).from([
        { id: 1, val: 10, category: 'A' },
        { id: 2, val: null, category: null },
        { id: 3, val: 30, category: 'B' },
        { id: 4, val: null, category: 'A' },
        { id: 5, val: 50, category: null },
      ]);
    }

    it('should impute with constant', () => {
      const table = createImputeTable();
      const transform = { impute: { column: 'val', strategy: 'constant' as const, value: 0 } };
      const result = applyTransform(table, transform, ['id', 'val', 'category']);
      const rows = result.objects();
      expect(rows[1].val).toBe(0);
      expect(rows[3].val).toBe(0);
    });

    it('should impute with mean', () => {
      const table = createImputeTable();
      const transform = { impute: { column: 'val', strategy: 'mean' as const } };
      const result = applyTransform(table, transform, ['id', 'val', 'category']);
      const rows = result.objects();
      // (10 + 30 + 50) / 3 = 30
      expect(rows[1].val).toBe(30);
      expect(rows[3].val).toBe(30);
    });

    it('should impute with forward fill', () => {
      const table = createImputeTable();
      const transform = { impute: { column: 'val', strategy: 'forwardFill' as const } };
      const result = applyTransform(table, transform, ['id', 'val', 'category']);
      const rows = result.objects();
      expect(rows[1].val).toBe(10);
      expect(rows[3].val).toBe(30);
    });

    it('should impute with backward fill', () => {
      const table = createImputeTable();
      const transform = { impute: { column: 'val', strategy: 'backwardFill' as const } };
      const result = applyTransform(table, transform, ['id', 'val', 'category']);
      const rows = result.objects();
      expect(rows[1].val).toBe(30);
      expect(rows[3].val).toBe(50);
    });

    it('should impute with linear interpolation', () => {
      const table = createImputeTable();
      const transform = { impute: { column: 'id', strategy: 'linearInterpolation' as const } };
      // id has no nulls, let's create a table with nulls in id
      const tableWithNulls = (aq as any).from([{ id: 10 }, { id: null }, { id: null }, { id: 40 }]);
      const result = applyTransform(
        tableWithNulls,
        {
          impute: { column: 'id', strategy: 'linearInterpolation' as const },
        },
        ['id']
      );
      const rows = result.objects();
      // 10, 20, 30, 40
      expect(rows[2].id).toBe(30);
    });

    it('should impute empty strings when includeEmptyString is true', () => {
      const table = (aq as any).from([
        { id: 1, name: 'Alice' },
        { id: 2, name: '' },
        { id: 3, name: null },
      ]);
      const transform = {
        impute: {
          column: 'name',
          strategy: 'constant' as const,
          value: 'Unknown',
          includeEmptyString: true,
        },
      };
      const result = applyTransform(table, transform, ['id', 'name']);
      const rows = result.objects();
      expect(rows[1].name).toBe('Unknown');
      expect(rows[2].name).toBe('Unknown');
    });

    it('should NOT impute empty strings when includeEmptyString is false', () => {
      const table = (aq as any).from([
        { id: 1, name: 'Alice' },
        { id: 2, name: '' },
        { id: 3, name: null },
      ]);
      const transform = {
        impute: {
          column: 'name',
          strategy: 'constant' as const,
          value: 'Unknown',
          includeEmptyString: false,
        },
      };
      const result = applyTransform(table, transform, ['id', 'name']);
      const rows = result.objects();
      expect(rows[1].name).toBe('');
      expect(rows[2].name).toBe('Unknown');
    });
  });

  describe('applyTransform() - DESCRIBE', () => {
    it('should compute summary statistics for numeric columns', () => {
      const table = createTestTable();
      const transform = { describe: { columns: ['sales', 'revenue'] } };

      const result = applyTransform(table, transform, [
        'sales',
        'revenue',
        'cost',
        'region',
        'status',
      ]);
      const rows = result.objects();

      expect(result.numRows()).toBe(7);
      expect(result.columnNames()).toEqual(['statistic', 'sales', 'revenue']);

      // Check statistic names (numeric only — no top/freq)
      const stats = rows.map((r: any) => r.statistic);
      expect(stats).toEqual(['count', 'unique', 'mean', 'median', 'stdev', 'min', 'max']);

      // Check count (non-null count via op.valid)
      const countRow = rows.find((r: any) => r.statistic === 'count');
      expect(countRow.sales).toBe(5);
      expect(countRow.revenue).toBe(5);

      // Check unique
      const uniqueRow = rows.find((r: any) => r.statistic === 'unique');
      expect(uniqueRow.sales).toBe(5);
      expect(uniqueRow.revenue).toBe(5);

      // Check min/max
      const minRow = rows.find((r: any) => r.statistic === 'min');
      expect(minRow.sales).toBe(500);
      expect(minRow.revenue).toBe(3000);

      const maxRow = rows.find((r: any) => r.statistic === 'max');
      expect(maxRow.sales).toBe(2000);
      expect(maxRow.revenue).toBe(10000);

      // Check mean
      const meanRow = rows.find((r: any) => r.statistic === 'mean');
      expect(meanRow.sales).toBe(1160);
      expect(meanRow.revenue).toBe(5800);
    });

    it('should compute statistics for categorical columns', () => {
      const table = createTestTable();
      const transform = { describe: { columns: ['region', 'status'] } };

      const result = applyTransform(table, transform, ['region', 'status']);
      const rows = result.objects();

      // Categorical: count, unique, top, freq
      const stats = rows.map((r: any) => r.statistic);
      expect(stats).toEqual(['count', 'unique', 'top', 'freq']);

      const countRow = rows.find((r: any) => r.statistic === 'count');
      expect(countRow.region).toBe(5);
      expect(countRow.status).toBe(5);

      const uniqueRow = rows.find((r: any) => r.statistic === 'unique');
      expect(uniqueRow.region).toBe(4); // North, South, East, West
      expect(uniqueRow.status).toBe(3); // active, pending, inactive

      const topRow = rows.find((r: any) => r.statistic === 'top');
      expect(topRow.region).toBe('North'); // appears 2x
      expect(topRow.status).toBe('active'); // appears 3x

      const freqRow = rows.find((r: any) => r.statistic === 'freq');
      expect(freqRow.region).toBe(2);
      expect(freqRow.status).toBe(3);
    });

    it('should compute mixed stats for numeric + categorical columns', () => {
      const table = createTestTable();
      const transform = { describe: { columns: ['sales', 'region'] } };

      const result = applyTransform(table, transform, ['sales', 'region']);
      const rows = result.objects();

      // Union: count, unique, top, freq (categorical), mean, median, stdev, min, max (numeric)
      const stats = rows.map((r: any) => r.statistic);
      expect(stats).toEqual([
        'count',
        'unique',
        'top',
        'freq',
        'mean',
        'median',
        'stdev',
        'min',
        'max',
      ]);

      // Numeric column has null for top/freq
      const topRow = rows.find((r: any) => r.statistic === 'top');
      expect(topRow.sales).toBeNull();
      expect(topRow.region).toBe('North');

      // Categorical column has null for mean/median/stdev/min/max
      const meanRow = rows.find((r: any) => r.statistic === 'mean');
      expect(meanRow.sales).toBe(1160);
      expect(meanRow.region).toBeNull();
    });

    it('should count non-null values (not total rows)', () => {
      const table = (aq as any).from([
        { val: 10, name: 'a' },
        { val: null, name: 'b' },
        { val: 30, name: null },
        { val: 40, name: 'd' },
      ]);
      const transform = { describe: { columns: ['val', 'name'] } };

      const result = applyTransform(table, transform, ['val', 'name']);
      const rows = result.objects();

      const countRow = rows.find((r: any) => r.statistic === 'count');
      expect(countRow.val).toBe(3); // 10, 30, 40 (null excluded)
      expect(countRow.name).toBe(3); // a, b, d (null excluded)
    });

    it('should handle boolean columns as categorical', () => {
      const table = (aq as any).from([
        { active: true },
        { active: true },
        { active: false },
        { active: true },
      ]);
      const transform = { describe: { columns: ['active'] } };

      const result = applyTransform(table, transform, ['active']);
      const rows = result.objects();

      const stats = rows.map((r: any) => r.statistic);
      expect(stats).toEqual(['count', 'unique', 'top', 'freq']);

      expect(rows.find((r: any) => r.statistic === 'unique').active).toBe(2);
      expect(rows.find((r: any) => r.statistic === 'top').active).toBe(true);
      expect(rows.find((r: any) => r.statistic === 'freq').active).toBe(3);
    });

    it('should compute statistics for a single column', () => {
      const table = createTestTable();
      const transform = { describe: { columns: ['cost'] } };

      const result = applyTransform(table, transform, ['cost']);
      const rows = result.objects();

      expect(result.numRows()).toBe(7);
      expect(result.columnNames()).toEqual(['statistic', 'cost']);

      const minRow = rows.find((r: any) => r.statistic === 'min');
      expect(minRow.cost).toBe(2000);
    });

    it('should handle floating point precision', () => {
      const table = (aq as any).from([{ val: 0.1 }, { val: 0.2 }, { val: 0.3 }]);
      const transform = { describe: { columns: ['val'] } };

      const result = applyTransform(table, transform, ['val']);
      const rows = result.objects();

      const meanRow = rows.find((r: any) => r.statistic === 'mean');
      expect(meanRow.val).toBe(0.2);
    });

    it('should throw for empty columns array', () => {
      const table = createTestTable();
      const transform = { describe: { columns: [] } };

      expect(() => applyTransform(table, transform, [])).toThrow('At least one column is required');
    });
  });

  describe('describeTransform() - DESCRIBE', () => {
    it('should describe a describe transform', () => {
      const transform = { describe: { columns: ['sales', 'revenue', 'cost'] } };
      const desc = describeTransform(transform);
      expect(desc).toContain('3');
    });
  });

  describe('applyTransform() - Aggregate degenerate cases', () => {
    it('empty-but-schemad input produces empty aggregate result', () => {
      // Filter-to-empty retains schema; aq.from([]) is schema-less and throws.
      const table = (aq as any).from([{ region: 'N', sales: 0 }]).filter(() => false);
      const transform = {
        aggregate: { groupby: ['region'], rollup: { total: 'op.sum("sales")' } },
      };
      const result = applyTransform(table, transform, ['region', 'sales']);
      expect(result.numRows()).toBe(0);
      expect(result.columnNames()).toContain('region');
      expect(result.columnNames()).toContain('total');
    });

    it('single-row input produces single-row aggregate', () => {
      const table = (aq as any).from([{ region: 'N', sales: 10 }]);
      const transform = {
        aggregate: { groupby: ['region'], rollup: { total: 'op.sum("sales")' } },
      };
      const result = applyTransform(table, transform, ['region', 'sales']);
      expect(result.numRows()).toBe(1);
      expect(result.objects()[0]).toEqual({ region: 'N', total: 10 });
    });

    it('CONTRACT: nulls in groupby form their own group (SQL/Arquero default)', () => {
      // SOUL §7: follow SQL convention. SQL standard groups nulls together
      // (one group per "null"), and Arquero matches that. pandas drops null
      // groups by default but lets you keep them; we keep — null is data, not
      // absence of data. See DATA-SPECIFICATION.md §3 "Null semantics".
      const table = (aq as any).from([
        { region: 'N', sales: 10 },
        { region: null, sales: 20 },
        { region: null, sales: 30 },
        { region: 'N', sales: 5 },
      ]);
      const transform = {
        aggregate: { groupby: ['region'], rollup: { total: 'op.sum("sales")' } },
      };
      const result = applyTransform(table, transform, ['region', 'sales']);
      expect(result.numRows()).toBe(2);
      const rows = result.objects();
      const nRow = rows.find((r: any) => r.region === 'N');
      const nullRow = rows.find((r: any) => r.region === null);
      expect(nRow.total).toBe(15);
      expect(nullRow.total).toBe(50);
    });

    it('sum of an all-null column returns null', () => {
      // Syto normalises Arquero's `undefined`-on-empty to `null` so aggregate
      // outputs are consistent with null-for-missing used elsewhere.
      const table = (aq as any).from([
        { region: 'N', sales: null },
        { region: 'N', sales: null },
      ]);
      const transform = {
        aggregate: { groupby: ['region'], rollup: { total: 'op.sum("sales")' } },
      };
      const result = applyTransform(table, transform, ['region', 'sales']);
      expect(result.objects()[0].total).toBeNull();
    });

    it('mean/min/max of an all-null column return null', () => {
      const table = (aq as any).from([
        { region: 'N', sales: null },
        { region: 'N', sales: null },
      ]);
      const transform = {
        aggregate: {
          groupby: ['region'],
          rollup: {
            avg: 'op.mean("sales")',
            lo: 'op.min("sales")',
            hi: 'op.max("sales")',
          },
        },
      };
      const result = applyTransform(table, transform, ['region', 'sales']);
      const row = result.objects()[0];
      expect(row.avg).toBeNull();
      expect(row.lo).toBeNull();
      expect(row.hi).toBeNull();
    });

    it('valid/distinct of an all-null column return integer counts, not null', () => {
      // These ops have meaningful integer semantics and shouldn't be
      // normalised to null. `valid` counts non-null (0 here); `distinct`
      // treats null as a value (1 here — one distinct null).
      const table = (aq as any).from([
        { region: 'N', sales: null },
        { region: 'N', sales: null },
      ]);
      const transform = {
        aggregate: {
          groupby: ['region'],
          rollup: { n: 'op.valid("sales")', u: 'op.distinct("sales")' },
        },
      };
      const result = applyTransform(table, transform, ['region', 'sales']);
      const row = result.objects()[0];
      expect(row.n).toBe(0);
      expect(row.u).toBe(1);
    });
  });
});
