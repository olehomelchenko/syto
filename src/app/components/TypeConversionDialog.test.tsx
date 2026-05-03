/**
 * TypeConversionDialog Component Tests
 *
 * Covers preview rendering when source data + target type are present,
 * the empty/no-preview branch, the apply-button gating, and the cancel
 * close path.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/preact';
import { renderWithI18n } from '../test-utils';
import { TypeConversionDialog } from './TypeConversionDialog';
import { AppStore } from '../stores/AppStore';
import { DialogStore } from '../stores/DialogStore';

describe('TypeConversionDialog', () => {
  beforeEach(() => {
    AppStore.columns.value = ['age'];
    AppStore.selectedColumns.value = [];
    AppStore.selectedColumn.value = null;
    AppStore.editingStepIndex.value = null;
    AppStore.activeModel.value = {
      steps: [],
      schema: [{ name: 'age', type: 'string' }],
      id: 'test-model',
      name: 'test',
    } as any;
    AppStore.currentData.value = [{ age: '30' }, { age: '25' }, { age: 'oops' }];

    DialogStore.typeConversionState.column.value = null;
    DialogStore.typeConversionState.targetType.value = null;
    DialogStore.previewState.title.value = '';
    DialogStore.previewState.stats.value = '';
    DialogStore.previewState.columns.value = [];
    DialogStore.previewState.newColumns.value = [];
    DialogStore.previewState.rows.value = [];
  });

  it('renders the dialog with default title and no-preview message when state is empty', () => {
    renderWithI18n(<TypeConversionDialog onCancel={() => {}} onApply={() => {}} />);

    // Default i18n title used when previewState.title is empty
    expect(screen.getByText('Type conversion preview')).toBeDefined();
    expect(screen.getByText('No preview available')).toBeDefined();
  });

  it('renders Cancel and Apply buttons; Apply is disabled when no preview', () => {
    renderWithI18n(<TypeConversionDialog onCancel={() => {}} onApply={() => {}} />);

    const cancel = screen.getByText('Cancel') as HTMLButtonElement;
    const apply = screen.getByText('Apply') as HTMLButtonElement;
    expect(cancel).toBeDefined();
    expect(apply).toBeDefined();
    expect(apply.disabled).toBe(true);
  });

  it('calls onCancel when Cancel button clicked', () => {
    const onCancel = vi.fn();
    renderWithI18n(<TypeConversionDialog onCancel={onCancel} onApply={() => {}} />);

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('runs preview effect and renders before/after columns when column + target type are set', () => {
    DialogStore.typeConversionState.column.value = 'age';
    DialogStore.typeConversionState.targetType.value = 'integer';

    renderWithI18n(<TypeConversionDialog onCancel={() => {}} onApply={() => {}} />);

    // The preview handler should populate before/after column headers
    expect(screen.getByText('age (before)')).toBeDefined();
    expect(screen.getByText('age (after)')).toBeDefined();
  });

  it('enables Apply button once a valid preview is rendered', () => {
    DialogStore.typeConversionState.column.value = 'age';
    DialogStore.typeConversionState.targetType.value = 'integer';

    renderWithI18n(<TypeConversionDialog onCancel={() => {}} onApply={() => {}} />);

    const apply = screen.getByText('Apply') as HTMLButtonElement;
    expect(apply.disabled).toBe(false);
  });

  it('calls onApply when Apply button is clicked (with valid preview)', () => {
    DialogStore.typeConversionState.column.value = 'age';
    DialogStore.typeConversionState.targetType.value = 'integer';
    const onApply = vi.fn();

    renderWithI18n(<TypeConversionDialog onCancel={() => {}} onApply={onApply} />);

    fireEvent.click(screen.getByText('Apply'));
    expect(onApply).toHaveBeenCalled();
  });

  it('uses preview title from DialogStore when set', () => {
    DialogStore.typeConversionState.column.value = 'age';
    DialogStore.typeConversionState.targetType.value = 'integer';

    renderWithI18n(<TypeConversionDialog onCancel={() => {}} onApply={() => {}} />);

    // The previewTypeConversion handler sets a title containing the column name
    const title = DialogStore.previewState.title.value;
    expect(title.length).toBeGreaterThan(0);
    expect(screen.getByText(title)).toBeDefined();
  });

  it('does not call onCancel when clicking inside the dialog content', () => {
    const onCancel = vi.fn();
    renderWithI18n(<TypeConversionDialog onCancel={onCancel} onApply={() => {}} />);

    // Click inside the dialog (on the title) should not propagate to the backdrop
    fireEvent.click(screen.getByText('Type conversion preview'));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
