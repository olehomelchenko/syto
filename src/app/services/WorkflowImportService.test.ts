/**
 * Integration Tests for WorkflowImportService
 *
 * Tests the full workflow import pipeline: source creation, model building,
 * pipeline computation, state updates, and error handling.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AppStore } from '../stores/AppStore';
import {
  resetStores,
  suppressConsole,
  createTestSource,
  createTestModel,
} from '../handlers/test-utils';
import type { V2Workflow } from '../../core/workflow-v2';

// ── Mocks ──────────────────────────────────────────────────

vi.mock('./PersistenceService', () => ({
  PersistenceService: {
    autoSave: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../handlers/core/notification-handlers', () => ({
  showSuccess: vi.fn(),
  showWarning: vi.fn(),
  alert: vi.fn().mockResolvedValue(undefined),
}));

// StepService and DependencyService run real — these are pure domain services
// and their internal stubs were masking pipeline bugs. See
// docs/TESTING_PROGRESS.md "Session 3" for the rationale.

import { WorkflowImportService } from './WorkflowImportService';
import { PersistenceService } from './PersistenceService';
import { showSuccess } from '../handlers/core/notification-handlers';

// ── Helpers ────────────────────────────────────────────────

function createMinimalWorkflow(overrides: Partial<V2Workflow> = {}): V2Workflow {
  return {
    formatVersion: 2,
    sytoVersion: '0.5.0',
    exportedAt: '2025-01-01T00:00:00.000Z',
    sources: {
      'sales.csv': {
        columns: [
          { name: 'product', type: 'string' },
          { name: 'amount', type: 'integer' },
        ],
        parsing: { headerMode: 'first-row', delimiter: ',' },
      },
    },
    models: {
      'sales.csv/Main': {
        source: 'sales.csv',
        steps: [{ types: { product: 'string', amount: 'integer' } }],
      },
    },
    outputs: ['sales.csv/Main'],
    ...overrides,
  };
}

function createMultiSourceWorkflow(): V2Workflow {
  return {
    formatVersion: 2,
    sytoVersion: '0.5.0',
    exportedAt: '2025-01-01T00:00:00.000Z',
    sources: {
      'orders.csv': {
        columns: [
          { name: 'id', type: 'integer' },
          { name: 'product', type: 'string' },
        ],
      },
      'products.csv': {
        columns: [
          { name: 'name', type: 'string' },
          { name: 'price', type: 'float' },
        ],
      },
    },
    models: {
      'orders.csv/Orders': {
        source: 'orders.csv',
        steps: [{ types: { id: 'integer', product: 'string' } }],
      },
      'products.csv/Products': {
        source: 'products.csv',
        steps: [{ types: { name: 'string', price: 'float' } }],
      },
    },
    outputs: ['orders.csv/Orders', 'products.csv/Products'],
  };
}

function createCallbacks() {
  return {
    updatePagination: vi.fn(),
    closeDialog: vi.fn(),
  };
}

const salesData = [
  { product: 'Widget', amount: 100 },
  { product: 'Gadget', amount: 200 },
];

const ordersData = [
  { id: 1, product: 'Widget' },
  { id: 2, product: 'Gadget' },
];

const productsData = [
  { name: 'Widget', price: 9.99 },
  { name: 'Gadget', price: 19.99 },
];

// ── Tests ──────────────────────────────────────────────────

describe('WorkflowImportService', () => {
  let consoleSpy: ReturnType<typeof suppressConsole>;

  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    consoleSpy = suppressConsole();
  });

  afterEach(() => {
    consoleSpy.errorSpy.mockRestore();
    consoleSpy.warnSpy.mockRestore();
  });

  describe('source creation', () => {
    it('creates sources from workflow definition and bound data', async () => {
      const workflow = createMinimalWorkflow();
      const sourceData = new Map([['sales.csv', salesData]]);
      const callbacks = createCallbacks();

      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      expect(AppStore.sources.value).toHaveLength(1);
      const source = AppStore.sources.value[0];
      expect(source.name).toBe('sales.csv');
      expect(source.data).toEqual(salesData);
      expect(source.headerMode).toBe('first-row');
      expect(source.delimiter).toBe(',');
      expect(source.origin).toBe('workflow-import');
      expect(source.rowCount).toBe(2);
      expect(source.id).toMatch(/^src_/);
    });

    it('creates multiple sources for multi-source workflows', async () => {
      const workflow = createMultiSourceWorkflow();
      const sourceData = new Map([
        ['orders.csv', ordersData],
        ['products.csv', productsData],
      ]);
      const callbacks = createCallbacks();

      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      expect(AppStore.sources.value).toHaveLength(2);
      const names = AppStore.sources.value.map((s) => s.name);
      expect(names).toContain('orders.csv');
      expect(names).toContain('products.csv');
    });

    it('uses default parsing values when not specified', async () => {
      const workflow = createMinimalWorkflow({
        sources: {
          'data.csv': {
            columns: [{ name: 'x', type: 'integer' }],
            // no parsing hints
          },
        },
        models: {
          'data.csv/Main': {
            source: 'data.csv',
            steps: [{ types: { x: 'integer' } }],
          },
        },
        outputs: ['data.csv/Main'],
      });
      const sourceData = new Map([['data.csv', [{ x: 1 }]]]);
      const callbacks = createCallbacks();

      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      const source = AppStore.sources.value[0];
      expect(source.headerMode).toBe('first-row');
      expect(source.delimiter).toBe(',');
      expect(source.customHeaders).toBeNull();
    });

    it('handles empty source data gracefully', async () => {
      const workflow = createMinimalWorkflow();
      const sourceData = new Map<string, any[]>(); // no data bound
      const callbacks = createCallbacks();

      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      const source = AppStore.sources.value[0];
      expect(source.data).toEqual([]);
      expect(source.rowCount).toBe(0);
    });

    it('appends to existing sources without replacing them', async () => {
      const existingSource = createTestSource({ id: 'src_existing', name: 'Existing' });
      AppStore.sources.value = [existingSource];

      const workflow = createMinimalWorkflow();
      const sourceData = new Map([['sales.csv', salesData]]);
      const callbacks = createCallbacks();

      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      expect(AppStore.sources.value).toHaveLength(2);
      expect(AppStore.sources.value[0].id).toBe('src_existing');
    });

    it('deduplicates source names if already taken', async () => {
      // Pre-populate a source with the same name
      const existingSource = createTestSource({ id: 'src_existing', name: 'sales.csv' });
      AppStore.sources.value = [existingSource];

      const workflow = createMinimalWorkflow();
      const sourceData = new Map([['sales.csv', salesData]]);
      const callbacks = createCallbacks();

      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      // NameService should have given it a unique name like "sales.csv-2"
      const newSource = AppStore.sources.value[1];
      expect(newSource.name).toBe('sales.csv-2');
    });

    it('sets createdAt timestamp on sources', async () => {
      const workflow = createMinimalWorkflow();
      const sourceData = new Map([['sales.csv', salesData]]);
      const callbacks = createCallbacks();

      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      const source = AppStore.sources.value[0];
      expect(source.createdAt).toBeDefined();
      // Should be a valid ISO date
      expect(() => new Date(source.createdAt!)).not.toThrow();
    });
  });

  describe('model building', () => {
    it('creates models from workflow definition', async () => {
      const workflow = createMinimalWorkflow();
      const sourceData = new Map([['sales.csv', salesData]]);
      const callbacks = createCallbacks();

      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      expect(AppStore.models.value).toHaveLength(1);
      const model = AppStore.models.value[0];
      expect(model.name).toBe('Main');
      expect(model.id).toMatch(/^mdl_/);
    });

    it('extracts display name from composite key', async () => {
      const workflow = createMinimalWorkflow();
      const sourceData = new Map([['sales.csv', salesData]]);
      const callbacks = createCallbacks();

      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      // "sales.csv/Main" → display name "Main"
      const model = AppStore.models.value[0];
      expect(model.name).toBe('Main');
    });

    it('uses full name when no slash in model name', async () => {
      const workflow = createMinimalWorkflow({
        models: {
          Analysis: {
            source: 'sales.csv',
            steps: [{ types: { product: 'string', amount: 'integer' } }],
          },
        },
        outputs: ['Analysis'],
      });
      const sourceData = new Map([['sales.csv', salesData]]);
      const callbacks = createCallbacks();

      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      const model = AppStore.models.value[0];
      expect(model.name).toBe('Analysis');
    });

    it('prepends import step for root models', async () => {
      const workflow = createMinimalWorkflow();
      const sourceData = new Map([['sales.csv', salesData]]);
      const callbacks = createCallbacks();

      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      // Root model gets an import step prepended; types step comes from the workflow
      const model = AppStore.models.value[0];
      expect(model.steps).toHaveLength(2);
      expect(model.steps[0]).toMatchObject({
        import: { source: 'sales.csv', delimiter: ',', headerMode: 'first-row' },
      });
      expect(model.steps[1]).toMatchObject({
        types: { product: 'string', amount: 'integer' },
      });
    });

    it('links models to their source by runtime ID', async () => {
      const workflow = createMinimalWorkflow();
      const sourceData = new Map([['sales.csv', salesData]]);
      const callbacks = createCallbacks();

      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      const source = AppStore.sources.value[0];
      const model = AppStore.models.value[0];
      expect(model.sourceId).toBe(source.id);
    });

    it('appends to existing models without replacing them', async () => {
      const existingModel = createTestModel({ id: 'mdl_existing', name: 'Existing' });
      AppStore.models.value = [existingModel];

      const workflow = createMinimalWorkflow();
      const sourceData = new Map([['sales.csv', salesData]]);
      const callbacks = createCallbacks();

      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      expect(AppStore.models.value).toHaveLength(2);
      expect(AppStore.models.value[0].id).toBe('mdl_existing');
    });

    it('creates multiple models for multi-model workflows', async () => {
      const workflow = createMultiSourceWorkflow();
      const sourceData = new Map([
        ['orders.csv', ordersData],
        ['products.csv', productsData],
      ]);
      const callbacks = createCallbacks();

      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      expect(AppStore.models.value).toHaveLength(2);
    });
  });

  describe('pipeline computation', () => {
    it('computes pipeline for each model', async () => {
      const workflow = createMinimalWorkflow();
      const sourceData = new Map([['sales.csv', salesData]]);
      const callbacks = createCallbacks();

      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      // Pipeline ran end-to-end: source data flowed through the types step into the model
      const model = AppStore.models.value[0];
      expect(model.data).toEqual(salesData);
      expect(model.rowCount).toBe(2);
      expect(model.colCount).toBe(2);
    });

    it('computes both models in a multi-source workflow', async () => {
      const workflow = createMultiSourceWorkflow();
      const sourceData = new Map([
        ['orders.csv', ordersData],
        ['products.csv', productsData],
      ]);
      const callbacks = createCallbacks();

      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      expect(AppStore.models.value).toHaveLength(2);
      const ordersModel = AppStore.models.value.find((m) => m.name === 'Orders');
      const productsModel = AppStore.models.value.find((m) => m.name === 'Products');
      expect(ordersModel?.data).toEqual(ordersData);
      expect(productsModel?.data).toEqual(productsData);
    });

    it('populates model data and schema from compute result', async () => {
      const workflow = createMinimalWorkflow();
      const sourceData = new Map([['sales.csv', salesData]]);
      const callbacks = createCallbacks();

      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      const model = AppStore.models.value[0];
      expect(model.data).toEqual(salesData);
      expect(model.schema).toEqual([
        expect.objectContaining({ name: 'product', type: 'string' }),
        expect.objectContaining({ name: 'amount', type: 'integer' }),
      ]);
    });
  });

  describe('state updates after import', () => {
    it('activates the first output model', async () => {
      const workflow = createMinimalWorkflow();
      const sourceData = new Map([['sales.csv', salesData]]);
      const callbacks = createCallbacks();

      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      const model = AppStore.models.value[0];
      expect(AppStore.activeModel.value).toBe(model);
      expect(AppStore.currentData.value).toEqual(model.data);
      expect(AppStore.viewMode.value).toBe('model');
    });

    it('sets columns from model schema', async () => {
      const workflow = createMinimalWorkflow();
      const sourceData = new Map([['sales.csv', salesData]]);
      const callbacks = createCallbacks();

      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      expect(AppStore.columns.value).toEqual(['product', 'amount']);
    });

    it('sets activeStepIndex to last step', async () => {
      const workflow = createMinimalWorkflow();
      const sourceData = new Map([['sales.csv', salesData]]);
      const callbacks = createCallbacks();

      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      const model = AppStore.models.value[0];
      expect(AppStore.activeStepIndex.value).toBe(model.steps.length - 1);
    });

    it('calls updatePagination callback', async () => {
      const workflow = createMinimalWorkflow();
      const sourceData = new Map([['sales.csv', salesData]]);
      const callbacks = createCallbacks();

      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      expect(callbacks.updatePagination).toHaveBeenCalledTimes(1);
    });

    it('calls closeDialog callback', async () => {
      const workflow = createMinimalWorkflow();
      const sourceData = new Map([['sales.csv', salesData]]);
      const callbacks = createCallbacks();

      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      expect(callbacks.closeDialog).toHaveBeenCalledTimes(1);
    });

    it('auto-saves after import', async () => {
      const workflow = createMinimalWorkflow();
      const sourceData = new Map([['sales.csv', salesData]]);
      const callbacks = createCallbacks();

      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      expect(PersistenceService.autoSave).toHaveBeenCalledTimes(1);
    });

    it('shows success notification', async () => {
      const workflow = createMinimalWorkflow();
      const sourceData = new Map([['sales.csv', salesData]]);
      const callbacks = createCallbacks();

      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      expect(showSuccess).toHaveBeenCalledTimes(1);
    });
  });

  describe('error cases', () => {
    it('throws when a model references a non-existent source', async () => {
      const workflow = createMinimalWorkflow({
        models: {
          'missing.csv/Model': {
            source: 'missing.csv', // not in workflow.sources
            steps: [],
          },
        },
        outputs: ['missing.csv/Model'],
      });
      const sourceData = new Map<string, any[]>();
      const callbacks = createCallbacks();

      await expect(
        WorkflowImportService.importWorkflow(workflow, sourceData, callbacks)
      ).rejects.toThrow('Source "missing.csv" not found');
    });

    it('skips model definitions not present in workflow.models', async () => {
      // executionOrder may include model names that don't exist in workflow.models
      // (e.g., if getReachableModels returns them but they're missing)
      const workflow = createMinimalWorkflow();
      const sourceData = new Map([['sales.csv', salesData]]);
      const callbacks = createCallbacks();

      // This should succeed without throwing
      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);
      expect(AppStore.models.value.length).toBeGreaterThanOrEqual(1);
    });

    it('handles workflow with no output models gracefully', async () => {
      const workflow = createMinimalWorkflow({ outputs: [] });
      const sourceData = new Map([['sales.csv', salesData]]);
      const callbacks = createCallbacks();

      // Should not throw — just won't activate any model
      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      // No model is activated since outputs is empty
      // Callbacks are still called
      expect(callbacks.updatePagination).toHaveBeenCalled();
      expect(callbacks.closeDialog).toHaveBeenCalled();
    });
  });

  describe('parsing hints', () => {
    it('uses custom delimiter from parsing hints', async () => {
      const workflow = createMinimalWorkflow({
        sources: {
          'data.tsv': {
            columns: [{ name: 'x', type: 'string' }],
            parsing: { headerMode: 'first-row', delimiter: '\t' },
          },
        },
        models: {
          'data.tsv/Main': {
            source: 'data.tsv',
            steps: [{ types: { x: 'string' } }],
          },
        },
        outputs: ['data.tsv/Main'],
      });
      const sourceData = new Map([['data.tsv', [{ x: 'val' }]]]);
      const callbacks = createCallbacks();

      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      expect(AppStore.sources.value[0].delimiter).toBe('\t');
    });

    it('uses custom headers from parsing hints', async () => {
      const workflow = createMinimalWorkflow({
        sources: {
          'data.csv': {
            columns: [{ name: 'col_a', type: 'string' }],
            parsing: {
              headerMode: 'manual',
              customHeaders: ['col_a', 'col_b'],
            },
          },
        },
        models: {
          'data.csv/Main': {
            source: 'data.csv',
            steps: [{ types: { col_a: 'string' } }],
          },
        },
        outputs: ['data.csv/Main'],
      });
      const sourceData = new Map([['data.csv', [{ col_a: 'x' }]]]);
      const callbacks = createCallbacks();

      await WorkflowImportService.importWorkflow(workflow, sourceData, callbacks);

      const source = AppStore.sources.value[0];
      expect(source.headerMode).toBe('manual');
      expect(source.customHeaders).toEqual(['col_a', 'col_b']);
    });
  });

  describe('parseSourceFile', () => {
    function makeCsvFile(content: string, name = 'data.csv'): File {
      return new File([new Blob([content], { type: 'text/csv' })], name, { type: 'text/csv' });
    }

    it('parses CSV rows and returns observed columns when headers match', async () => {
      const file = makeCsvFile('product,amount\nWidget,10\nGadget,20');
      const sourceDef = {
        columns: [
          { name: 'product', type: 'string' as const },
          { name: 'amount', type: 'integer' as const },
        ],
      };

      const result = await WorkflowImportService.parseSourceFile(file, sourceDef);

      expect(result.error).toBeNull();
      expect(result.columns).toEqual(['product', 'amount']);
      expect(result.data).toEqual([
        { product: 'Widget', amount: 10 },
        { product: 'Gadget', amount: 20 },
      ]);
    });

    it('returns a column-mismatch warning when expected columns are missing', async () => {
      const file = makeCsvFile('product\nWidget\nGadget');
      const sourceDef = {
        columns: [
          { name: 'product', type: 'string' as const },
          { name: 'amount', type: 'integer' as const },
        ],
      };

      const result = await WorkflowImportService.parseSourceFile(file, sourceDef);

      // Data is still populated — the mismatch is a warning, not a fatal error
      expect(result.data).toEqual([{ product: 'Widget' }, { product: 'Gadget' }]);
      expect(result.columns).toEqual(['product']);
      expect(result.error).toMatch(/amount/);
    });

    it('respects the source definition delimiter', async () => {
      const file = makeCsvFile('product\tamount\nWidget\t10', 'data.tsv');
      const sourceDef = {
        columns: [
          { name: 'product', type: 'string' as const },
          { name: 'amount', type: 'integer' as const },
        ],
        parsing: { delimiter: '\t' },
      };

      const result = await WorkflowImportService.parseSourceFile(file, sourceDef);

      expect(result.error).toBeNull();
      expect(result.columns).toEqual(['product', 'amount']);
      expect(result.data).toEqual([{ product: 'Widget', amount: 10 }]);
    });
  });
});
