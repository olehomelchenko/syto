/**
 * UnrollDialog Component Tests
 *
 * Covers default rendering, single-column chip selection, the index
 * checkbox + dynamic help text, keep-original toggle, and editing-step
 * initialisation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/preact';
import { renderWithI18n } from '../test-utils';
import { UnrollDialog } from './UnrollDialog';
import { AppStore } from '../stores/AppStore';

describe('UnrollDialog', () => {
  beforeEach(() => {
    AppStore.columns.value = ['id', 'items', 'tags'];
    AppStore.selectedColumns.value = [];
    AppStore.selectedColumn.value = null;
    AppStore.editingStepIndex.value = null;
    AppStore.activeModel.value = {
      steps: [],
      schema: [
        { name: 'id', type: 'integer' },
        { name: 'items', type: 'string' },
        { name: 'tags', type: 'string' },
      ],
      id: 'test-model',
      name: 'test',
    } as any;
    AppStore.currentData.value = [
      { id: 1, items: '["a","b"]', tags: '["x"]' },
      { id: 2, items: '["c"]', tags: '["y","z"]' },
    ];
  });

  it('renders column label, both checkboxes, and help section', () => {
    renderWithI18n(<UnrollDialog />);

    expect(screen.getByText('Column to unroll:')).toBeDefined();
    expect(screen.getByText('Add index column')).toBeDefined();
    expect(screen.getByText('Keep original column')).toBeDefined();
    expect(screen.getByText('How it works')).toBeDefined();
  });

  it('shows index column help text reflecting the current column', () => {
    AppStore.selectedColumn.value = 'items';

    const { container } = renderWithI18n(<UnrollDialog />);

    // Help text uses dangerouslySetInnerHTML and interpolates {{column}}
    expect(container.innerHTML).toContain('items__unroll_index');
  });

  it('toggles add-index checkbox', () => {
    renderWithI18n(<UnrollDialog />);

    const checkbox = screen.getByLabelText('Add index column') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it('toggles keep-original checkbox', () => {
    renderWithI18n(<UnrollDialog />);

    const checkbox = screen.getByLabelText('Keep original column') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  it('initializes from editing step (column, indices, keepOriginal)', () => {
    AppStore.editingStepIndex.value = 0;
    AppStore.activeModel.value = {
      steps: [
        {
          unroll: {
            column: 'tags',
            indices: true,
            keepOriginal: true,
          },
        },
      ],
      schema: [],
      id: 'test-model',
      name: 'test',
    } as any;

    const { container } = renderWithI18n(<UnrollDialog />);

    expect((screen.getByLabelText('Add index column') as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Keep original column') as HTMLInputElement).checked).toBe(true);
    // Index help text reflects the editing-step column
    expect(container.innerHTML).toContain('tags__unroll_index');
  });

  it('falls back to "column" placeholder in index help when no column selected', () => {
    AppStore.columns.value = [];
    AppStore.selectedColumn.value = null;

    const { container } = renderWithI18n(<UnrollDialog />);

    // No column → t('unroll.indexColumnHelp', { column: 'column' }) → "column__unroll_index"
    expect(container.innerHTML).toContain('column__unroll_index');
  });
});
