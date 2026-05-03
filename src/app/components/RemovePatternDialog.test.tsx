/**
 * RemovePatternDialog Component Tests
 *
 * Covers initial render, match-type switching (prefix/suffix/contains/regex),
 * pattern input, regex validation error path, and editing-step initialisation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/preact';
import { renderWithI18n } from '../test-utils';
import { RemovePatternDialog } from './RemovePatternDialog';
import { AppStore } from '../stores/AppStore';

describe('RemovePatternDialog', () => {
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
    renderWithI18n(<RemovePatternDialog />);

    expect(
      screen.getByText(
        'Remove columns matching a pattern. Useful for removing multiple columns with similar names.'
      )
    ).toBeDefined();
    expect(screen.getByText('Pattern:')).toBeDefined();
    expect(screen.getByText('Match type:')).toBeDefined();
    expect(screen.getByPlaceholderText('e.g., temp_')).toBeDefined();
  });

  it('defaults to prefix match type with corresponding help text', () => {
    renderWithI18n(<RemovePatternDialog />);

    expect(screen.getByText('Columns that start with the pattern')).toBeDefined();
  });

  it('updates pattern input value when typed', () => {
    renderWithI18n(<RemovePatternDialog />);

    const patternInput = screen.getByPlaceholderText('e.g., temp_') as HTMLInputElement;
    fireEvent.input(patternInput, { target: { value: 'temp_' } });

    expect(patternInput.value).toBe('temp_');
  });

  it('switches to suffix match type and updates help text', () => {
    renderWithI18n(<RemovePatternDialog />);

    const select = screen.getByText('Match type:').nextElementSibling as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'suffix' } });

    expect(screen.getByText('Columns that end with the pattern')).toBeDefined();
  });

  it('switches to contains match type and updates help text', () => {
    renderWithI18n(<RemovePatternDialog />);

    const select = screen.getByText('Match type:').nextElementSibling as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'contains' } });

    expect(screen.getByText('Columns that contain the pattern')).toBeDefined();
  });

  it('switches to regex match type and updates help text', () => {
    renderWithI18n(<RemovePatternDialog />);

    const select = screen.getByText('Match type:').nextElementSibling as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'regex' } });

    expect(screen.getByText('Columns matching the regex pattern')).toBeDefined();
  });

  it('shows error message for an invalid regex pattern', () => {
    renderWithI18n(<RemovePatternDialog />);

    // Switch to regex mode
    const select = screen.getByText('Match type:').nextElementSibling as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'regex' } });

    // Type an invalid regex
    const patternInput = screen.getByPlaceholderText('e.g., temp_') as HTMLInputElement;
    fireEvent.input(patternInput, { target: { value: '[unclosed' } });

    // Validation engine prefixes the JS error with the localized "Fix pattern errors before applying" string
    expect(screen.getByText(/Fix pattern errors before applying:/)).toBeDefined();
  });

  it('initializes from editing step with regex match type and pre-filled pattern', () => {
    AppStore.editingStepIndex.value = 0;
    AppStore.activeModel.value = {
      steps: [
        {
          removePattern: {
            pattern: '_old$',
            matchType: 'regex',
          },
        },
      ],
      schema: [],
      id: 'test-model',
      name: 'test',
    } as any;

    renderWithI18n(<RemovePatternDialog />);

    const patternInput = screen.getByPlaceholderText('e.g., temp_') as HTMLInputElement;
    expect(patternInput.value).toBe('_old$');

    // Regex help text is rendered
    expect(screen.getByText('Columns matching the regex pattern')).toBeDefined();
  });
});
