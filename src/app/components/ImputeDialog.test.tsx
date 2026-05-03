/**
 * ImputeDialog Component Tests
 *
 * Covers default rendering with strategy chips, conditional UI for the
 * constant value input, the empty-string toggle, the order-dependent hint,
 * the (mock-data) preview table, and editing-step initialisation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/preact';
import { renderWithI18n } from '../test-utils';
import { ImputeDialog } from './ImputeDialog';
import { AppStore } from '../stores/AppStore';

describe('ImputeDialog', () => {
  beforeEach(() => {
    AppStore.columns.value = ['age', 'salary', 'name'];
    AppStore.selectedColumns.value = [];
    AppStore.selectedColumn.value = null;
    AppStore.editingStepIndex.value = null;
    AppStore.activeModel.value = {
      steps: [],
      schema: [
        { name: 'age', type: 'integer' },
        { name: 'salary', type: 'float' },
        { name: 'name', type: 'string' },
      ],
      id: 'test-model',
      name: 'test',
    } as any;
    AppStore.currentData.value = [
      { age: 30, salary: 50000, name: 'Alice' },
      { age: null, salary: 60000, name: 'Bob' },
    ];
  });

  it('renders column selector, strategy chips, and replacement value input', () => {
    renderWithI18n(<ImputeDialog />);

    expect(screen.getByText('Column to impute')).toBeDefined();
    expect(screen.getByText('Imputation strategy')).toBeDefined();

    // All eight strategies render as chips
    expect(screen.getByText('Constant')).toBeDefined();
    expect(screen.getByText('Mean')).toBeDefined();
    expect(screen.getByText('Min')).toBeDefined();
    expect(screen.getByText('Max')).toBeDefined();
    expect(screen.getByText('Median')).toBeDefined();
    expect(screen.getByText('Linear')).toBeDefined();
    expect(screen.getByText('Forward fill')).toBeDefined();
    expect(screen.getByText('Backward fill')).toBeDefined();

    // Default strategy is constant → replacement input is shown
    expect(screen.getByText('Replacement value')).toBeDefined();
  });

  it('hides the replacement-value input when a non-constant strategy is selected', () => {
    // Default column (age) is integer → numeric strategies are enabled
    renderWithI18n(<ImputeDialog />);

    expect(screen.queryByText('Replacement value')).not.toBeNull();

    fireEvent.click(screen.getByText('Mean'));

    // Constant-only label disappears
    expect(screen.queryByText('Replacement value')).toBeNull();
  });

  it('shows the order-dependent hint for forward-fill / backward-fill / linear', () => {
    renderWithI18n(<ImputeDialog />);

    expect(screen.queryByText(/order-dependent/)).toBeNull();

    fireEvent.click(screen.getByText('Forward fill'));
    expect(screen.getByText(/order-dependent/)).toBeDefined();

    fireEvent.click(screen.getByText('Backward fill'));
    expect(screen.getByText(/order-dependent/)).toBeDefined();
  });

  it('toggles the include-empty-string checkbox', () => {
    renderWithI18n(<ImputeDialog />);

    const checkbox = screen.getByLabelText("Include empty strings ('') as missing");
    expect((checkbox as HTMLInputElement).checked).toBe(false);

    fireEvent.click(checkbox);
    expect((checkbox as HTMLInputElement).checked).toBe(true);
  });

  it('updates replacement-value input on typing', () => {
    renderWithI18n(<ImputeDialog />);

    const input = screen.getByPlaceholderText(
      'Enter value (e.g. 0, N/A, Unknown)'
    ) as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'Unknown' } });
    expect(input.value).toBe('Unknown');
  });

  it('renders the strategy preview table (mock data)', () => {
    renderWithI18n(<ImputeDialog />);

    // Preview is computed reactively on mount
    expect(screen.getByText('Strategy preview (example data)')).toBeDefined();
    expect(screen.getByText('Original')).toBeDefined();
    expect(screen.getByText('Imputed')).toBeDefined();
  });

  it('initializes from editing step (column, strategy, value, includeEmptyString)', () => {
    AppStore.editingStepIndex.value = 0;
    AppStore.activeModel.value = {
      steps: [
        {
          impute: {
            column: 'salary',
            strategy: 'mean',
            includeEmptyString: true,
          },
        },
      ],
      schema: [
        { name: 'age', type: 'integer' },
        { name: 'salary', type: 'float' },
        { name: 'name', type: 'string' },
      ],
      id: 'test-model',
      name: 'test',
    } as any;

    renderWithI18n(<ImputeDialog />);

    // Strategy = mean → replacement-value input not shown
    expect(screen.queryByText('Replacement value')).toBeNull();

    // includeEmptyString=true → checkbox is checked
    const checkbox = screen.getByLabelText(
      "Include empty strings ('') as missing"
    ) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });
});
