/**
 * Multi-step composition scenarios — realistic pipelines covering:
 *   - type drift across stages (parse date → filter → derive → aggregate)
 *   - lookup-then-aggregate (lookup → filter → group-by → sum)
 *   - window-rank-then-trim (rank → filter → aggregate per partition)
 *   - null propagation through a chain (derive → filter → aggregate)
 *
 * These exist because individual transforms can each be correct while their
 * composition drifts: types coerce subtly between stages, nulls propagate
 * differently than expected. Single-transform tests can't catch that class of
 * bug — see TESTING_STRATEGY.md §3.
 */

import { describe, it, expect } from 'vitest';
import * as aq from 'arquero';
import { applyTransform } from './transforms';

// Helper: thread a sequence of transforms through applyTransform, simulating
// what the pipeline executor does step-by-step. Returns the final Arquero table.
function runPipeline(
  initialData: Record<string, unknown>[],
  steps: Array<{ transform: any; context?: any }>
) {
  let table = (aq as any).from(initialData);
  for (const step of steps) {
    const columns = table.columnNames();
    table = applyTransform(table, step.transform, columns, step.context ?? null);
  }
  return table;
}

describe('Multi-step composition scenarios', () => {
  describe('Type drift: parse date → filter → derive month → aggregate by month', () => {
    it('preserves typing through a 4-step type-aware pipeline', () => {
      const data = [
        { date: '2024-01-15', amount: 100 },
        { date: '2024-01-20', amount: 150 },
        { date: '2024-02-05', amount: 200 },
        { date: '2024-02-28', amount: 50 },
        { date: '2023-12-31', amount: 999 }, // outside range — should be filtered out
        { date: '2024-03-10', amount: 75 },
      ];

      const result = runPipeline(data, [
        // 1. Parse date column from string to date type.
        { transform: { types: { date: 'date' } } },
        // 2. Keep only rows in 2024.
        { transform: { filter: 'year(date) == 2024' } },
        // 3. Derive a month column.
        { transform: { derive: { month: 'month(date)' } } },
        // 4. Aggregate amount per month.
        {
          transform: {
            aggregate: {
              groupby: ['month'],
              rollup: { total: 'op.sum(amount)' },
            },
          },
        },
      ]);

      const rows = result.orderby('month').objects();
      expect(rows).toHaveLength(3);
      expect(rows[0]).toEqual({ month: 1, total: 250 });
      expect(rows[1]).toEqual({ month: 2, total: 250 });
      expect(rows[2]).toEqual({ month: 3, total: 75 });
    });
  });

  describe('Lookup-then-aggregate: lookup region price → filter → group-by → sum', () => {
    it('correctly handles unmatched lookup rows in downstream aggregate', () => {
      const orders = [
        { id: 1, region: 'NA', units: 10 },
        { id: 2, region: 'EU', units: 5 },
        { id: 3, region: 'NA', units: 20 },
        { id: 4, region: 'APAC', units: 100 }, // no price — drops to null
        { id: 5, region: 'EU', units: 8 },
      ];

      const priceModel = {
        id: 'mdl_prices',
        name: 'Region Prices',
        data: [
          { region: 'NA', price: 10 },
          { region: 'EU', price: 12 },
          // APAC deliberately missing.
        ],
      };

      const context = { sources: [], models: [priceModel] };

      const result = runPipeline(orders, [
        // 1. Lookup price for each region.
        {
          transform: {
            lookup: { right: 'mdl_prices', on: [['region', 'region']], values: ['price'] },
          },
          context,
        },
        // 2. Derive line revenue. APAC row has price = null → revenue = null.
        { transform: { derive: { revenue: 'units * price' } } },
        // 3. Drop rows with null revenue (the unmatched APAC order).
        { transform: { filter: 'revenue != null' } },
        // 4. Aggregate revenue per region.
        {
          transform: {
            aggregate: {
              groupby: ['region'],
              rollup: { total_revenue: 'op.sum(revenue)' },
            },
          },
        },
      ]);

      const rows = result.orderby('region').objects();
      expect(rows).toHaveLength(2); // APAC filtered out, only NA + EU remain
      expect(rows.find((r: any) => r.region === 'NA').total_revenue).toBe(300); // (10+20)*10
      expect(rows.find((r: any) => r.region === 'EU').total_revenue).toBe(156); // (5+8)*12
    });
  });

  describe('Window-rank-then-trim: rank → keep top-N per partition → aggregate', () => {
    it('computes top-3-per-partition averages via three composed transforms', () => {
      // Five products per category, want top-3 by sales per category, then
      // average sales of those top-3 per category.
      const data = [
        { category: 'A', product: 'a1', sales: 100 },
        { category: 'A', product: 'a2', sales: 80 },
        { category: 'A', product: 'a3', sales: 60 },
        { category: 'A', product: 'a4', sales: 40 },
        { category: 'A', product: 'a5', sales: 20 },
        { category: 'B', product: 'b1', sales: 1000 },
        { category: 'B', product: 'b2', sales: 500 },
        { category: 'B', product: 'b3', sales: 250 },
        { category: 'B', product: 'b4', sales: 100 },
      ];

      const result = runPipeline(data, [
        // 1. Rank within each category by sales desc.
        {
          transform: {
            window: {
              orderBy: [{ field: 'sales', order: 'desc' as const }],
              partitionBy: ['category'],
              derive: { rnk: 'op.rank()' },
            },
          },
        },
        // 2. Keep only ranks 1-3.
        { transform: { filter: 'rnk <= 3' } },
        // 3. Average sales per category over the top-3.
        {
          transform: {
            aggregate: {
              groupby: ['category'],
              rollup: { avg_top3: 'op.mean(sales)' },
            },
          },
        },
      ]);

      const rows = result.orderby('category').objects();
      expect(rows).toHaveLength(2);
      // Category A: top-3 sales are 100, 80, 60 → mean = 80
      expect(rows[0]).toEqual({ category: 'A', avg_top3: 80 });
      // Category B: top-3 sales are 1000, 500, 250 → mean ≈ 583.33
      expect(rows[1].category).toBe('B');
      expect(rows[1].avg_top3).toBeCloseTo(583.333, 2);
    });
  });

  describe('Null propagation: derive on null column → filter → aggregate', () => {
    it('respects Batch 2 contracts: nulls form their own group, all-null rollups → null', () => {
      const data = [
        { region: 'NA', value: 10 },
        { region: 'NA', value: null },
        { region: 'EU', value: 20 },
        { region: 'EU', value: 30 },
        { region: null, value: 5 }, // null region — own group per Batch 2 contract
        { region: null, value: null }, // both null
        { region: 'APAC', value: null }, // APAC has only nulls
        { region: 'APAC', value: null },
      ];

      const result = runPipeline(data, [
        // 1. Derive a doubled value. value*2 propagates null cleanly.
        { transform: { derive: { doubled: 'value * 2' } } },
        // 2. Aggregate with sum and mean per region. APAC is all-null → both should be null.
        {
          transform: {
            aggregate: {
              groupby: ['region'],
              rollup: {
                total: 'op.sum(doubled)',
                avg: 'op.mean(doubled)',
                n: 'op.valid(doubled)', // count of non-null doubled values
              },
            },
          },
        },
      ]);

      const rows = result.objects();

      // Four groups: NA, EU, null, APAC. Per Batch 2, null forms its own group.
      expect(rows).toHaveLength(4);

      const na = rows.find((r: any) => r.region === 'NA')!;
      expect(na.total).toBe(20); // only the non-null 10 doubled
      expect(na.avg).toBe(20);
      expect(na.n).toBe(1);

      const eu = rows.find((r: any) => r.region === 'EU')!;
      expect(eu.total).toBe(100); // 40 + 60
      expect(eu.avg).toBe(50);
      expect(eu.n).toBe(2);

      const nullGroup = rows.find((r: any) => r.region === null)!;
      expect(nullGroup).toBeDefined();
      expect(nullGroup.total).toBe(10); // only one valid doubled value: 5*2
      expect(nullGroup.avg).toBe(10);
      expect(nullGroup.n).toBe(1);

      // APAC — all values were null, doubled stays null. Per SOUL §7 + Batch 2,
      // sum/mean over no valid values normalise to null (not undefined, not NaN).
      const apac = rows.find((r: any) => r.region === 'APAC')!;
      expect(apac.total).toBeNull();
      expect(apac.avg).toBeNull();
      expect(apac.n).toBe(0);
    });
  });

  describe('Type round-trip: derive → select → derive again', () => {
    it('inferred types from derive survive being projected through select', () => {
      // Regression-style scenario: a derive yields an integer column, the user
      // selects it (dropping siblings), then derives off it. The downstream
      // derive should still see an integer, not be confused into string.
      const data = [
        { a: 10, b: 3, label: 'x' },
        { a: 20, b: 7, label: 'y' },
        { a: 30, b: 5, label: 'z' },
      ];

      const result = runPipeline(data, [
        { transform: { derive: { sum: 'a + b' } } },
        { transform: { select: ['label', 'sum'] } },
        { transform: { derive: { doubled_sum: 'sum * 2' } } },
      ]);

      const rows = result.objects();
      expect(rows[0]).toEqual({ label: 'x', sum: 13, doubled_sum: 26 });
      expect(rows[1]).toEqual({ label: 'y', sum: 27, doubled_sum: 54 });
      expect(rows[2]).toEqual({ label: 'z', sum: 35, doubled_sum: 70 });
    });
  });
});
