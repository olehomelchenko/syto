/**
 * WorkflowImportDialog Component Tests
 *
 * Covers conditional render (no workflow), workflow metadata rendering,
 * source binding rows, validation-error display, and the disabled-state
 * transitions of the Import button as bindings/processing change.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/preact';
import { renderWithI18n } from '../test-utils';
import { WorkflowImportDialog } from './WorkflowImportDialog';
import { DialogStore } from '../stores/DialogStore';
import type { V2Workflow } from '../../core/workflow-v2';

function makeWorkflow(overrides: Partial<V2Workflow> = {}): V2Workflow {
  return {
    formatVersion: 2,
    sytoVersion: '0.5.0',
    exportedAt: '2026-01-15T10:00:00.000Z',
    sources: {
      sales: {
        columns: [
          { name: 'id', type: 'integer' },
          { name: 'amount', type: 'float' },
        ],
      },
      customers: {
        columns: [{ name: 'name', type: 'string' }],
      },
    },
    models: {
      summary: { source: 'sales', steps: [] },
    },
    outputs: ['summary'],
    ...overrides,
  };
}

describe('WorkflowImportDialog', () => {
  beforeEach(() => {
    const state = DialogStore.workflowImportState;
    state.workflow.value = null;
    state.sourceNames.value = [];
    state.bindings.value = new Map();
    state.validationErrors.value = [];
    state.isProcessing.value = false;
  });

  it('renders nothing when no workflow is loaded', () => {
    const { container } = renderWithI18n(<WorkflowImportDialog />);
    expect(container.firstChild).toBeNull();
  });

  it('renders workflow metadata (version, model count, sources heading)', () => {
    const state = DialogStore.workflowImportState;
    state.workflow.value = makeWorkflow();
    state.sourceNames.value = ['sales', 'customers'];

    renderWithI18n(<WorkflowImportDialog />);

    // Version label + value
    expect(screen.getByText(/Version/)).toBeDefined();
    expect(screen.getByText(/0\.5\.0/)).toBeDefined();
    // Singular plural form: 1 model
    expect(screen.getByText('1 model')).toBeDefined();
    // Sources heading
    expect(screen.getByText('Bind data files to sources')).toBeDefined();
  });

  it('renders one row per source with column count', () => {
    const state = DialogStore.workflowImportState;
    state.workflow.value = makeWorkflow();
    state.sourceNames.value = ['sales', 'customers'];

    renderWithI18n(<WorkflowImportDialog />);

    expect(screen.getByText('sales')).toBeDefined();
    expect(screen.getByText('customers')).toBeDefined();
    // "2 columns" (sales has 2 columns) and "1 columns" (customers has 1)
    expect(screen.getByText('2 columns')).toBeDefined();
    expect(screen.getByText('1 columns')).toBeDefined();
  });

  it('shows row count for a successfully bound source', () => {
    const state = DialogStore.workflowImportState;
    state.workflow.value = makeWorkflow();
    state.sourceNames.value = ['sales', 'customers'];
    const bindings = new Map();
    bindings.set('sales', {
      file: new File([''], 'sales.csv'),
      data: [
        { id: 1, amount: 10 },
        { id: 2, amount: 20 },
        { id: 3, amount: 30 },
      ],
      columns: ['id', 'amount'],
      error: null,
    });
    state.bindings.value = bindings;

    renderWithI18n(<WorkflowImportDialog />);

    expect(screen.getByText('3 rows')).toBeDefined();
  });

  it('shows binding error text when a source has an error', () => {
    const state = DialogStore.workflowImportState;
    state.workflow.value = makeWorkflow();
    state.sourceNames.value = ['sales'];
    const bindings = new Map();
    bindings.set('sales', {
      file: new File([''], 'sales.csv'),
      data: null,
      columns: null,
      error: 'Could not parse file',
    });
    state.bindings.value = bindings;

    renderWithI18n(<WorkflowImportDialog />);

    expect(screen.getByText('Could not parse file')).toBeDefined();
  });

  it('renders validation errors when present', () => {
    const state = DialogStore.workflowImportState;
    state.workflow.value = makeWorkflow();
    state.sourceNames.value = ['sales'];
    state.validationErrors.value = ['Missing required field', 'Invalid step type'];

    renderWithI18n(<WorkflowImportDialog />);

    expect(screen.getByText('Missing required field')).toBeDefined();
    expect(screen.getByText('Invalid step type')).toBeDefined();
  });

  it('disables Import button when not all sources are bound', () => {
    const state = DialogStore.workflowImportState;
    state.workflow.value = makeWorkflow();
    state.sourceNames.value = ['sales', 'customers'];
    // Only one of the two is bound
    const bindings = new Map();
    bindings.set('sales', {
      file: new File([''], 'sales.csv'),
      data: [{ id: 1, amount: 10 }],
      columns: ['id', 'amount'],
      error: null,
    });
    state.bindings.value = bindings;

    renderWithI18n(<WorkflowImportDialog />);

    const importBtn = screen.getByText('Import').closest('button')!;
    expect(importBtn.getAttribute('aria-disabled')).toBe('true');
  });

  it('enables Import button once every source is bound without error', () => {
    const state = DialogStore.workflowImportState;
    state.workflow.value = makeWorkflow();
    state.sourceNames.value = ['sales', 'customers'];
    const bindings = new Map();
    bindings.set('sales', {
      file: new File([''], 'sales.csv'),
      data: [{ id: 1, amount: 10 }],
      columns: ['id', 'amount'],
      error: null,
    });
    bindings.set('customers', {
      file: new File([''], 'customers.csv'),
      data: [{ name: 'Alice' }],
      columns: ['name'],
      error: null,
    });
    state.bindings.value = bindings;

    renderWithI18n(<WorkflowImportDialog />);

    const importBtn = screen.getByText('Import').closest('button')!;
    expect(importBtn.getAttribute('aria-disabled')).toBeNull();
  });

  it('shows "Processing..." label and disables Import while processing', () => {
    const state = DialogStore.workflowImportState;
    state.workflow.value = makeWorkflow();
    state.sourceNames.value = ['sales'];
    const bindings = new Map();
    bindings.set('sales', {
      file: new File([''], 'sales.csv'),
      data: [{ id: 1, amount: 10 }],
      columns: ['id', 'amount'],
      error: null,
    });
    state.bindings.value = bindings;
    state.isProcessing.value = true;

    renderWithI18n(<WorkflowImportDialog />);

    // Label switches to "Processing..."
    const processingBtn = screen.getByText('Processing...').closest('button')!;
    expect(processingBtn.getAttribute('aria-disabled')).toBe('true');
  });
});
