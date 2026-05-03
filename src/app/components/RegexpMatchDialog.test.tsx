/**
 * RegexpMatchDialog Component Tests
 *
 * Covers initial render, source-column / pattern / column-name inputs,
 * regex validation error path, help section, and editing-step parsing
 * (regexp_match expression -> dialog state).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/preact';
import { renderWithI18n } from '../test-utils';
import { RegexpMatchDialog } from './RegexpMatchDialog';
import { AppStore } from '../stores/AppStore';

describe('RegexpMatchDialog', () => {
  beforeEach(() => {
    AppStore.columns.value = ['email', 'phone', 'name'];
    AppStore.selectedColumns.value = [];
    AppStore.selectedColumn.value = null;
    AppStore.editingStepIndex.value = null;
    AppStore.activeModel.value = {
      steps: [],
      schema: [
        { name: 'email', type: 'string' },
        { name: 'phone', type: 'string' },
        { name: 'name', type: 'string' },
      ],
      id: 'test-model',
      name: 'test',
    } as any;
    AppStore.currentData.value = [
      { email: 'a@x.com', phone: '123-4567', name: 'Alice' },
      { email: 'b@y.org', phone: '987-6543', name: 'Bob' },
    ];
  });

  it('renders description, source-column selector, pattern + column-name inputs, and help section', () => {
    renderWithI18n(<RegexpMatchDialog />);

    expect(
      screen.getByText('Creates a boolean column indicating whether the pattern matches.')
    ).toBeDefined();
    expect(screen.getByText('Source column:')).toBeDefined();
    expect(screen.getByText('Pattern (regex):')).toBeDefined();
    expect(screen.getByText('New column name:')).toBeDefined();
    expect(screen.getByPlaceholderText('e.g., ^[A-Z]{2}\\d+')).toBeDefined();
    expect(screen.getByPlaceholderText('e.g., is_valid_code')).toBeDefined();

    // Help section
    expect(screen.getByText('Pattern examples')).toBeDefined();
    expect(screen.getByText('Full reference')).toBeDefined();
  });

  it('updates pattern and new column name when typed', () => {
    renderWithI18n(<RegexpMatchDialog />);

    const patternInput = screen.getByPlaceholderText('e.g., ^[A-Z]{2}\\d+') as HTMLInputElement;
    const nameInput = screen.getByPlaceholderText('e.g., is_valid_code') as HTMLInputElement;

    fireEvent.input(patternInput, { target: { value: '^a' } });
    fireEvent.input(nameInput, { target: { value: 'starts_with_a' } });

    expect(patternInput.value).toBe('^a');
    expect(nameInput.value).toBe('starts_with_a');
  });

  it('shows error message for invalid regex pattern', () => {
    renderWithI18n(<RegexpMatchDialog />);

    const patternInput = screen.getByPlaceholderText('e.g., ^[A-Z]{2}\\d+') as HTMLInputElement;
    fireEvent.input(patternInput, { target: { value: '[unclosed' } });

    expect(screen.getByText(/Fix pattern errors before applying:/)).toBeDefined();
  });

  it('clears error after fixing the regex', () => {
    renderWithI18n(<RegexpMatchDialog />);

    const patternInput = screen.getByPlaceholderText('e.g., ^[A-Z]{2}\\d+') as HTMLInputElement;
    fireEvent.input(patternInput, { target: { value: '[broken' } });
    expect(screen.getByText(/Fix pattern errors before applying:/)).toBeDefined();

    fireEvent.input(patternInput, { target: { value: '\\d+' } });
    expect(screen.queryByText(/Fix pattern errors before applying:/)).toBeNull();
  });

  it('renders pattern example help entries', () => {
    renderWithI18n(<RegexpMatchDialog />);

    expect(screen.getByText(/starts with 2 uppercase letters/)).toBeDefined();
    expect(screen.getByText(/phone format 123-4567/)).toBeDefined();
    expect(screen.getByText(/case-insensitive/)).toBeDefined();
    expect(screen.getByText(/ends with @\.\.\.com/)).toBeDefined();
  });

  it('initializes from editing step by parsing the derive expression', () => {
    AppStore.editingStepIndex.value = 0;
    AppStore.activeModel.value = {
      steps: [
        {
          derive: {
            is_valid: 'regexp_match([email], "@.+\\.com$")',
          },
        },
      ],
      schema: [],
      id: 'test-model',
      name: 'test',
    } as any;

    renderWithI18n(<RegexpMatchDialog />);

    const patternInput = screen.getByPlaceholderText('e.g., ^[A-Z]{2}\\d+') as HTMLInputElement;
    const nameInput = screen.getByPlaceholderText('e.g., is_valid_code') as HTMLInputElement;

    expect(nameInput.value).toBe('is_valid');
    // Pattern should be the unescaped pattern (\\. -> \.)
    expect(patternInput.value).toBe('@.+\\.com$');
  });
});
