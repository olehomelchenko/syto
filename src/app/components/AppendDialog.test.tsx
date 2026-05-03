/**
 * AppendDialog Component Tests
 *
 * Covers initial render with two source/model selectors, the
 * remove-duplicates toggle (with help text switching),
 * select-all / select-none for both sides, the preview button
 * disabled state, and editing-step initialisation (concat & union).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/preact';
import { renderWithI18n } from '../test-utils';
import { AppendDialog } from './AppendDialog';
import { AppStore } from '../stores/AppStore';

describe('AppendDialog', () => {
  beforeEach(() => {
    const sourceA: any = {
      id: 'src-a',
      name: 'SourceA',
      data: [],
      columns: [
        { name: 'id', type: 'integer' },
        { name: 'amount', type: 'float' },
      ],
      delimiter: ',',
      headerMode: 'first-row',
      customHeaders: null,
      origin: 'file',
    };
    const sourceB: any = {
      id: 'src-b',
      name: 'SourceB',
      data: [],
      columns: [
        { name: 'id', type: 'integer' },
        { name: 'amount', type: 'float' },
        { name: 'note', type: 'string' },
      ],
      delimiter: ',',
      headerMode: 'first-row',
      customHeaders: null,
      origin: 'file',
    };

    AppStore.sources.value = [sourceA, sourceB];
    AppStore.models.value = [];
    AppStore.activeSource.value = sourceA;
    AppStore.activeModel.value = null;
    AppStore.columns.value = ['id', 'amount'];
    AppStore.selectedColumns.value = [];
    AppStore.selectedColumn.value = null;
    AppStore.editingStepIndex.value = null;
    AppStore.currentData.value = [];
  });

  it('renders both side labels, the remove-duplicates toggle, and column lists', () => {
    renderWithI18n(<AppendDialog />);

    expect(screen.getByText('Left table (base)')).toBeDefined();
    expect(screen.getByText('Right table (append)')).toBeDefined();
    expect(screen.getByText('Remove duplicate rows (union)')).toBeDefined();
    expect(screen.getByText('Left columns to include')).toBeDefined();
    expect(screen.getByText('Right columns to include')).toBeDefined();
  });

  it('shows concat help text by default and union help text after toggling', () => {
    renderWithI18n(<AppendDialog />);

    // Off: stacks rows ... keeps all original rows
    expect(screen.getByText(/keeps all original rows/)).toBeDefined();

    const checkbox = screen.getByLabelText('Remove duplicate rows (union)') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);

    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);

    // On: removes complete duplicates across all columns
    expect(screen.getByText(/removes complete duplicates/)).toBeDefined();
  });

  it('renders preview button (enabled because a target was auto-picked)', () => {
    renderWithI18n(<AppendDialog />);

    const previewBtn = screen.getByText('Preview append') as HTMLButtonElement;
    // First non-active source becomes the right side → button enabled
    expect(previewBtn.disabled).toBe(false);
  });

  it('renders Select all / Select none buttons for each side', () => {
    renderWithI18n(<AppendDialog />);

    const selectAllButtons = screen.getAllByText('Select all');
    const selectNoneButtons = screen.getAllByText('Select none');
    // One pair per side
    expect(selectAllButtons.length).toBe(2);
    expect(selectNoneButtons.length).toBe(2);
  });

  it('renders left column names as items', () => {
    renderWithI18n(<AppendDialog />);

    // Left columns come from active source (id, amount)
    expect(screen.getAllByText('id').length).toBeGreaterThan(0);
    expect(screen.getAllByText('amount').length).toBeGreaterThan(0);
  });

  it('initializes from editing concat step (no remove-duplicates)', () => {
    AppStore.editingStepIndex.value = 0;
    AppStore.activeModel.value = {
      id: 'model-1',
      name: 'M1',
      sourceId: 'src-a',
      steps: [
        {
          concat: {
            with: 'src-b',
            columns: ['id'],
            targetColumns: ['id', 'amount'],
          },
        } as any,
      ],
      schema: [
        { name: 'id', type: 'integer' },
        { name: 'amount', type: 'float' },
      ],
      data: [],
    } as any;
    AppStore.models.value = [AppStore.activeModel.value!];

    renderWithI18n(<AppendDialog />);

    const checkbox = screen.getByLabelText('Remove duplicate rows (union)') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('initializes from editing union step (remove-duplicates ON)', () => {
    AppStore.editingStepIndex.value = 0;
    AppStore.activeModel.value = {
      id: 'model-1',
      name: 'M1',
      sourceId: 'src-a',
      steps: [
        {
          union: {
            with: 'src-b',
            columns: ['id', 'amount'],
            targetColumns: ['id', 'amount'],
          },
        } as any,
      ],
      schema: [
        { name: 'id', type: 'integer' },
        { name: 'amount', type: 'float' },
      ],
      data: [],
    } as any;
    AppStore.models.value = [AppStore.activeModel.value!];

    renderWithI18n(<AppendDialog />);

    const checkbox = screen.getByLabelText('Remove duplicate rows (union)') as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    // Union help text is the "on" variant
    expect(screen.getByText(/removes complete duplicates/)).toBeDefined();
  });

  it('Select none on the left side hides nothing visually but keeps button clickable', () => {
    renderWithI18n(<AppendDialog />);

    // The buttons exist for both sides; clicking Select none on the left
    // should not throw. State change is internal — UI continues to render.
    const selectNoneButtons = screen.getAllByText('Select none');
    fireEvent.click(selectNoneButtons[0]);

    // Column items still rendered (just unselected styling)
    expect(screen.getAllByText('id').length).toBeGreaterThan(0);
  });
});
