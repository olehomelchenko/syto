import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AppStore } from './stores/AppStore';
import { ImportService } from './services/ImportService';
import { ExportService } from './services/ExportService';
import { StepService } from './services/StepService';
import * as PaginationHandlers from './handlers/core/pagination-handlers';
import * as DialogHandlers from './handlers/dialog/dialog-handlers';
import Papa from 'papaparse';

/**
 * E2E Critical Path Test
 *
 * Tests the complete workflow: Import CSV -> Filter -> Derive -> Export CSV
 *
 * This test verifies the core functionality end-to-end without requiring
 * a full browser environment, using Vitest with HappyDOM.
 */
describe('E2E Critical Path', () => {
  beforeEach(() => {
    // Reset store state before each test
    AppStore.reset();

    // Mock console methods to keep output clean
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('should complete critical path: Import CSV -> Filter -> Derive -> Export CSV', async () => {
    // Step 1: Import CSV
    const csvData = `name,sales,revenue,cost
Alice,1000,5000,3000
Bob,1500,7000,4000
Carol,800,4000,2500
David,2000,9000,5000`;

    // Create a File object from CSV string
    const csvBlob = new Blob([csvData], { type: 'text/csv' });
    const csvFile = new File([csvBlob], 'test-data.csv', { type: 'text/csv' });

    // Parse CSV manually to get data for ImportService
    const parseResult = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });

    const columns = Object.keys(parseResult.data[0] as any);
    const data = parseResult.data as any[];

    // Use ImportService to create source
    await ImportService.createSource(
      csvFile,
      'test_source',
      columns,
      data,
      'first-row',
      ',',
      null,
      'file',
      () => PaginationHandlers.updatePagination(),
      () => DialogHandlers.closeDialog()
    );

    // Verify import
    expect(AppStore.sources.value.length).toBe(1);
    expect(AppStore.models.value.length).toBe(1);
    expect(AppStore.activeModel.value).toBeTruthy();
    expect(AppStore.currentData.value?.length).toBe(4);

    const initialData = AppStore.currentData.value!;
    expect(initialData[0]).toMatchObject({
      name: 'Alice',
      sales: 1000,
      revenue: 5000,
      cost: 3000,
    });

    // Callbacks for transforms
    const transformCallbacks = {
      onTransformStart: () => {
        AppStore.isTransforming.value = true;
      },
      onTransformEnd: () => {
        AppStore.isTransforming.value = false;
      },
      onError: vi.fn(),
      updatePagination: () => PaginationHandlers.updatePagination(),
    };

    // Step 2: Apply Filter (sales > 1000)
    const filterTransform = {
      filter: 'sales > 1000',
    };

    const filterSuccess = await StepService.runTransform(
      'Filter',
      filterTransform as any,
      transformCallbacks
    );

    expect(filterSuccess).toBe(true);

    // Verify filter result (should have 3 rows: Bob, David - Carol has sales=800, so excluded)
    const filteredData = AppStore.currentData.value!;
    expect(filteredData.length).toBe(2); // Bob (1500), David (2000) - Carol (800) excluded
    expect(filteredData.every((row: any) => row.sales > 1000)).toBe(true);

    // Verify original columns preserved
    expect(AppStore.columns.value).toEqual(['name', 'sales', 'revenue', 'cost']);

    // Step 3: Apply Derive (profit = revenue - cost)
    const deriveTransform = {
      derive: { profit: 'revenue - cost' },
    };

    const deriveSuccess = await StepService.runTransform(
      'Derive',
      deriveTransform as any,
      transformCallbacks
    );

    expect(deriveSuccess).toBe(true);

    // Verify derive result
    const derivedData = AppStore.currentData.value!;
    expect(derivedData.length).toBe(2);
    expect(AppStore.columns.value).toContain('profit');

    // Verify profit calculation
    const firstRow = derivedData[0];
    expect(firstRow.profit).toBe(firstRow.revenue - firstRow.cost);

    // Step 4: Export CSV
    const exportedCsv = await ExportService.exportCSV(vi.fn());

    // Verify export format
    expect(exportedCsv).toBeTruthy();
    expect(typeof exportedCsv).toBe('string');
    const exportedLines = exportedCsv.split('\n');
    expect(exportedLines.length).toBeGreaterThan(1); // Header + data rows

    // Verify exported data contains derived column
    expect(exportedCsv).toContain('profit');

    // Parse exported CSV to verify structure
    const exportedParse = Papa.parse(exportedCsv, {
      header: true,
      skipEmptyLines: true,
    });

    expect(exportedParse.data.length).toBe(2);
    expect(exportedParse.meta.fields).toContain('profit');
  });

  it('should handle filter error gracefully', async () => {
    // Import minimal data
    const csvData = `name,value
Test,100`;
    const csvBlob = new Blob([csvData], { type: 'text/csv' });
    const csvFile = new File([csvBlob], 'test.csv', { type: 'text/csv' });

    const parseResult = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });

    const columns = Object.keys(parseResult.data[0] as any);
    const data = parseResult.data as any[];

    await ImportService.createSource(
      csvFile,
      'test',
      columns,
      data,
      'first-row',
      ',',
      null,
      'file',
      () => {},
      () => {}
    );

    // Try invalid filter expression
    const success = await StepService.runTransform(
      'Filter',
      { filter: 'invalid_column > 100' } as any,
      {
        onError: async (msg) => {
          expect(msg).toContain('Could not apply');
        },
      }
    );

    // Should fail gracefully
    expect(success).toBe(false);
  });

  it('should complete join path: Import two CSVs -> Join -> Derive -> Export CSV', async () => {
    // Use fake timers to ensure unique source/model IDs across imports
    vi.useFakeTimers();
    let mockNow = 1700000000000;
    vi.setSystemTime(mockNow);

    // Step 1: Import products CSV
    const productsCsv = `id,product,price
1,Widget,10
2,Gadget,15
3,Gizmo,20`;

    const productsBlob = new Blob([productsCsv], { type: 'text/csv' });
    const productsFile = new File([productsBlob], 'products.csv', { type: 'text/csv' });
    const productsParse = Papa.parse(productsCsv, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });

    await ImportService.createSource(
      productsFile,
      'products',
      Object.keys(productsParse.data[0] as any),
      productsParse.data as any[],
      'first-row',
      ',',
      null,
      'file',
      () => {},
      () => {}
    );

    expect(AppStore.sources.value.length).toBe(1);
    const productsModelId = AppStore.activeModel.value!.id;

    // Advance time for the second import (unique IDs)
    mockNow += 1000;
    vi.setSystemTime(mockNow);

    // Step 2: Import sales CSV
    const salesCsv = `order_id,product_id,quantity
101,1,5
102,1,3
103,2,2
104,3,10`;

    const salesBlob = new Blob([salesCsv], { type: 'text/csv' });
    const salesFile = new File([salesBlob], 'sales.csv', { type: 'text/csv' });
    const salesParse = Papa.parse(salesCsv, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });

    await ImportService.createSource(
      salesFile,
      'sales',
      Object.keys(salesParse.data[0] as any),
      salesParse.data as any[],
      'first-row',
      ',',
      null,
      'file',
      () => {},
      () => {}
    );

    expect(AppStore.sources.value.length).toBe(2);
    expect(AppStore.models.value.length).toBe(2);
    // Active model is the sales model (last import)
    expect(AppStore.activeModel.value!.id).not.toBe(productsModelId);

    // Store both model references for join
    const models = AppStore.models.value;
    const productsModel = models.find((m) => m.id === productsModelId);
    expect(productsModel).toBeTruthy();

    let joinErrorMsg = '';
    const transformCallbacks = {
      onTransformStart: () => {
        AppStore.isTransforming.value = true;
      },
      onTransformEnd: () => {
        AppStore.isTransforming.value = false;
      },
      onError: async (msg: string) => {
        joinErrorMsg = msg;
      },
      updatePagination: () => PaginationHandlers.updatePagination(),
    };

    // Step 3: Left join products onto sales (sales is active model)
    const joinTransform = {
      join: {
        right: productsModelId,
        on: [['product_id', 'id']],
        how: 'left',
      },
    };

    const joinSuccess = await StepService.runTransform(
      'Join',
      joinTransform as any,
      transformCallbacks
    );
    expect(joinSuccess).toBe(true);

    // Verify join: sales rows should be enriched with product data
    const joinedData = AppStore.currentData.value!;
    expect(joinedData.length).toBe(4); // all 4 sales rows preserved (left join)

    // Each row should have product fields
    expect(joinedData[0]).toHaveProperty('product');
    expect(joinedData[0]).toHaveProperty('price');
    // Row with product_id=1 should have Widget/10
    const widgetRow = joinedData.find((r: any) => r.product_id === 1);
    expect(widgetRow?.product).toBe('Widget');
    expect(widgetRow?.price).toBe(10);

    // Step 4: Derive total (price * quantity)
    const deriveTransform = { derive: { total: 'price * quantity' } };
    const deriveSuccess = await StepService.runTransform(
      'Derive',
      deriveTransform as any,
      transformCallbacks
    );
    expect(deriveSuccess).toBe(true);

    const derivedData = AppStore.currentData.value!;
    expect(derivedData.length).toBe(4);
    expect(AppStore.columns.value).toContain('total');

    // Verify total = price * quantity
    const firstRow = derivedData[0];
    expect(firstRow.total).toBe(firstRow.price * firstRow.quantity);

    // Step 5: Export CSV
    const exportedCsv = await ExportService.exportCSV(vi.fn());
    expect(exportedCsv).toBeTruthy();
    expect(exportedCsv).toContain('product');
    expect(exportedCsv).toContain('total');

    const exportedParse = Papa.parse(exportedCsv, {
      header: true,
      skipEmptyLines: true,
    });
    expect(exportedParse.data.length).toBe(4);
    expect(exportedParse.meta.fields).toContain('total');

    vi.useRealTimers();
  });

  it('should maintain schema consistency through transforms', async () => {
    // Import data with mixed types
    const csvData = `id,name,amount,date
1,Alice,100.5,2024-01-01
2,Bob,200.75,2024-01-02`;

    const csvBlob = new Blob([csvData], { type: 'text/csv' });
    const csvFile = new File([csvBlob], 'test.csv', { type: 'text/csv' });

    const parseResult = Papa.parse(csvData, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
    });

    const columns = Object.keys(parseResult.data[0] as any);
    const data = parseResult.data as any[];

    await ImportService.createSource(
      csvFile,
      'test',
      columns,
      data,
      'first-row',
      ',',
      null,
      'file',
      () => {},
      () => {}
    );

    const model = AppStore.activeModel.value;
    expect(model?.schema).toBeTruthy();
    expect(model?.schema.length).toBe(4);

    // Apply filter
    await StepService.runTransform('Filter', { filter: 'id > 0' } as any, {
      onTransformStart: () => {},
      onTransformEnd: () => {},
      onError: async () => {},
      updatePagination: () => {},
    });

    // Schema should still be consistent
    const updatedModel = AppStore.activeModel.value;
    expect(updatedModel?.schema.length).toBe(4);
    expect(AppStore.columns.value.length).toBe(4);
  });
});
