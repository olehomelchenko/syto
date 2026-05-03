/**
 * RegexpExtractDialog Component Tests
 *
 * Covers initial render, source-column / pattern / group / column-name inputs,
 * regex validation error path, help section, and editing-step parsing
 * (regexp_extract expression -> dialog state).
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/preact';
import { renderWithI18n } from '../test-utils';
import { RegexpExtractDialog } from './RegexpExtractDialog';
import { AppStore } from '../stores/AppStore';

describe('RegexpExtractDialog', () => {
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

  it('renders description, source-column selector, pattern / group / column-name inputs', () => {
    renderWithI18n(<RegexpExtractDialog />);

    expect(screen.getByText('Extracts text matching a pattern into a new column.')).toBeDefined();
    expect(screen.getByText('Source column:')).toBeDefined();
    expect(screen.getByText('Pattern (regex):')).toBeDefined();
    expect(screen.getByText('Capture group (0 = entire match):')).toBeDefined();
    expect(screen.getByText('New column name:')).toBeDefined();
    expect(screen.getByPlaceholderText('e.g., @(.+)$ to extract domain')).toBeDefined();
    expect(screen.getByPlaceholderText('e.g., domain')).toBeDefined();
  });

  it('defaults capture group to 0', () => {
    const { container } = renderWithI18n(<RegexpExtractDialog />);

    const groupInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    expect(groupInput).toBeDefined();
    expect(groupInput.value).toBe('0');
  });

  it('updates pattern, group, and column name when input', () => {
    const { container } = renderWithI18n(<RegexpExtractDialog />);

    const patternInput = screen.getByPlaceholderText(
      'e.g., @(.+)$ to extract domain'
    ) as HTMLInputElement;
    const nameInput = screen.getByPlaceholderText('e.g., domain') as HTMLInputElement;
    const groupInput = container.querySelector('input[type="number"]') as HTMLInputElement;

    fireEvent.input(patternInput, { target: { value: '@(.+)$' } });
    fireEvent.input(nameInput, { target: { value: 'domain' } });
    fireEvent.input(groupInput, { target: { value: '1' } });

    expect(patternInput.value).toBe('@(.+)$');
    expect(nameInput.value).toBe('domain');
    expect(groupInput.value).toBe('1');
  });

  it('shows error message for invalid regex pattern', () => {
    renderWithI18n(<RegexpExtractDialog />);

    const patternInput = screen.getByPlaceholderText(
      'e.g., @(.+)$ to extract domain'
    ) as HTMLInputElement;
    fireEvent.input(patternInput, { target: { value: '[unclosed' } });

    expect(screen.getByText(/Fix pattern errors before applying:/)).toBeDefined();
  });

  it('renders pattern example help entries', () => {
    renderWithI18n(<RegexpExtractDialog />);

    expect(screen.getByText('Pattern examples')).toBeDefined();
    expect(screen.getByText(/date parts/)).toBeDefined();
    expect(screen.getByText(/domain from email/)).toBeDefined();
    expect(screen.getByText(/extract level/)).toBeDefined();
    expect(screen.getByText(/first 2 uppercase letters/)).toBeDefined();
  });

  it('initializes from editing step by parsing the derive expression', () => {
    AppStore.editingStepIndex.value = 0;
    AppStore.activeModel.value = {
      steps: [
        {
          derive: {
            domain: 'regexp_extract([email], "@(.+)$", 1)',
          },
        },
      ],
      schema: [],
      id: 'test-model',
      name: 'test',
    } as any;

    const { container } = renderWithI18n(<RegexpExtractDialog />);

    const patternInput = screen.getByPlaceholderText(
      'e.g., @(.+)$ to extract domain'
    ) as HTMLInputElement;
    const nameInput = screen.getByPlaceholderText('e.g., domain') as HTMLInputElement;
    const groupInput = container.querySelector('input[type="number"]') as HTMLInputElement;

    expect(nameInput.value).toBe('domain');
    expect(patternInput.value).toBe('@(.+)$');
    expect(groupInput.value).toBe('1');
  });
});
