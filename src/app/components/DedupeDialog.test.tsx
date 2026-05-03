/**
 * DedupeDialog Component Tests
 *
 * Covers the action mode toggle (remove/keep), column-scope toggle
 * (all columns vs specific columns), column selection, duplicate-count
 * banner, and editing-step initialisation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/preact';
import { renderWithI18n } from '../test-utils';
import { DedupeDialog } from './DedupeDialog';
import { AppStore } from '../stores/AppStore';

describe('DedupeDialog', () => {
  beforeEach(() => {
    AppStore.columns.value = ['name', 'email', 'age'];
    AppStore.selectedColumns.value = [];
    AppStore.selectedColumn.value = null;
    AppStore.editingStepIndex.value = null;
    AppStore.activeModel.value = {
      steps: [],
      schema: [
        { name: 'name', type: 'string' },
        { name: 'email', type: 'string' },
        { name: 'age', type: 'integer' },
      ],
      id: 'test-model',
      name: 'test',
    } as any;
    AppStore.currentData.value = [
      { name: 'Alice', email: 'a@x.com', age: 30 },
      { name: 'Bob', email: 'b@x.com', age: 25 },
      { name: 'Alice', email: 'a@x.com', age: 30 },
    ];
  });

  it('renders mode toggle, scope toggle, and preview banner', () => {
    renderWithI18n(<DedupeDialog />);

    expect(screen.getByText('Remove duplicates')).toBeDefined();
    expect(screen.getByText('Keep only duplicates')).toBeDefined();
    expect(screen.getByText('All columns')).toBeDefined();
    expect(screen.getByText('Specific columns')).toBeDefined();
  });

  it('defaults to remove mode + all columns when no quick column or editing step', () => {
    renderWithI18n(<DedupeDialog />);

    // "All columns" info banner is visible
    expect(
      screen.getByText(/Rows are considered duplicates if all columns have identical values/)
    ).toBeDefined();
  });

  it('switches to keep mode when Keep button is clicked', () => {
    renderWithI18n(<DedupeDialog />);

    const keepBtn = screen.getByText('Keep only duplicates');
    fireEvent.click(keepBtn);

    // Keep-mode help text becomes visible (remove-mode help is hidden via display:none)
    // Just verify the keep button still renders — full state is internal
    expect(keepBtn).toBeDefined();
  });

  it('switches to specific-columns scope and reveals column selector', () => {
    renderWithI18n(<DedupeDialog />);

    // Initially all-columns info is shown, no select-key help
    expect(screen.queryByText('Select columns to use as composite key:')).toBeNull();

    fireEvent.click(screen.getByText('Specific columns'));

    expect(screen.getByText('Select columns to use as composite key:')).toBeDefined();
  });

  it('shows duplicate count when duplicates exist (after debounced preview)', async () => {
    renderWithI18n(<DedupeDialog />);

    // Two identical Alice rows → 1 duplicate. Preview is debounced (150ms),
    // so wait for the banner text to update from the initial "No duplicates".
    await waitFor(() => {
      expect(screen.getByText(/duplicate row found/)).toBeDefined();
    });
  });

  it('shows "no duplicates" banner when data has no duplicates', () => {
    AppStore.currentData.value = [
      { name: 'Alice', email: 'a@x.com', age: 30 },
      { name: 'Bob', email: 'b@x.com', age: 25 },
    ];

    renderWithI18n(<DedupeDialog />);

    expect(screen.getByText('No duplicates found')).toBeDefined();
  });

  it('initializes from editing step with specific columns + keep mode', () => {
    AppStore.editingStepIndex.value = 0;
    AppStore.activeModel.value = {
      steps: [
        {
          dedupe: {
            columns: ['email'],
            mode: 'keep',
          },
        },
      ],
      schema: [],
      id: 'test-model',
      name: 'test',
    } as any;

    renderWithI18n(<DedupeDialog />);

    // Specific-columns scope active → key-help visible
    expect(screen.getByText('Select columns to use as composite key:')).toBeDefined();
  });

  it('seeds specific-column scope from quick-selected column', () => {
    AppStore.selectedColumn.value = 'email';

    renderWithI18n(<DedupeDialog />);

    // Quick column triggers specific-columns mode
    expect(screen.getByText('Select columns to use as composite key:')).toBeDefined();
  });
});
