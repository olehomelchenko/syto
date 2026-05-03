/**
 * SelectPatternDialog Component Tests
 *
 * Covers initial render, match-type switching (prefix/suffix/contains/regex),
 * pattern input, regex validation error path, and editing-step initialisation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/preact';
import { renderWithI18n } from '../test-utils';
import { SelectPatternDialog } from './SelectPatternDialog';
import { AppStore } from '../stores/AppStore';

describe('SelectPatternDialog', () => {
  beforeEach(() => {
    AppStore.columns.value = ['sales_2023', 'sales_2024', 'temp_a', 'temp_b'];
    AppStore.selectedColumns.value = [];
    AppStore.selectedColumn.value = null;
    AppStore.editingStepIndex.value = null;
    AppStore.activeModel.value = {
      steps: [],
      schema: [
        { name: 'sales_2023', type: 'integer' },
        { name: 'sales_2024', type: 'integer' },
        { name: 'temp_a', type: 'string' },
        { name: 'temp_b', type: 'string' },
      ],
      id: 'test-model',
      name: 'test',
    } as any;
    AppStore.currentData.value = [];
  });

  it('renders pattern input, match-type select, and help text', () => {
    renderWithI18n(<SelectPatternDialog />);

    expect(
      screen.getByText(
        'Select columns matching a pattern. Useful for selecting multiple columns with similar names.'
      )
    ).toBeDefined();
    expect(screen.getByText('Pattern:')).toBeDefined();
    expect(screen.getByText('Match type:')).toBeDefined();
    expect(screen.getByPlaceholderText('e.g., sales_')).toBeDefined();
  });

  it('defaults to prefix match type with corresponding help text', () => {
    renderWithI18n(<SelectPatternDialog />);

    expect(screen.getByText('Columns that start with the pattern')).toBeDefined();
  });

  it('updates pattern input value when typed', () => {
    renderWithI18n(<SelectPatternDialog />);

    const patternInput = screen.getByPlaceholderText('e.g., sales_') as HTMLInputElement;
    fireEvent.input(patternInput, { target: { value: 'sales_' } });

    expect(patternInput.value).toBe('sales_');
  });

  it('switches to suffix match type and updates help text', () => {
    renderWithI18n(<SelectPatternDialog />);

    const select = screen.getByText('Match type:').nextElementSibling as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'suffix' } });

    expect(screen.getByText('Columns that end with the pattern')).toBeDefined();
  });

  it('switches to contains match type and updates help text', () => {
    renderWithI18n(<SelectPatternDialog />);

    const select = screen.getByText('Match type:').nextElementSibling as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'contains' } });

    expect(screen.getByText('Columns that contain the pattern')).toBeDefined();
  });

  it('switches to regex match type and updates help text', () => {
    renderWithI18n(<SelectPatternDialog />);

    const select = screen.getByText('Match type:').nextElementSibling as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'regex' } });

    expect(screen.getByText('Columns matching the regex pattern')).toBeDefined();
  });

  it('shows error message for an invalid regex pattern', () => {
    renderWithI18n(<SelectPatternDialog />);

    // Switch to regex mode
    const select = screen.getByText('Match type:').nextElementSibling as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'regex' } });

    // Type an invalid regex
    const patternInput = screen.getByPlaceholderText('e.g., sales_') as HTMLInputElement;
    fireEvent.input(patternInput, { target: { value: '[unclosed' } });

    expect(screen.getByText(/Fix pattern errors before applying:/)).toBeDefined();
  });

  it('initializes from editing step with pre-filled pattern + match type', () => {
    AppStore.editingStepIndex.value = 0;
    AppStore.activeModel.value = {
      steps: [
        {
          selectPattern: {
            pattern: 'sales_',
            matchType: 'contains',
          },
        },
      ],
      schema: [],
      id: 'test-model',
      name: 'test',
    } as any;

    renderWithI18n(<SelectPatternDialog />);

    const patternInput = screen.getByPlaceholderText('e.g., sales_') as HTMLInputElement;
    expect(patternInput.value).toBe('sales_');
    expect(screen.getByText('Columns that contain the pattern')).toBeDefined();
  });
});
