/**
 * ParseDateDialog Component Tests
 *
 * Covers initial render with string columns, format-preset selection,
 * custom format entry, sample-value display, "no string columns" help,
 * and editing-step seeding via AppStore.selectedColumn.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/preact';
import { renderWithI18n } from '../test-utils';
import { ParseDateDialog } from './ParseDateDialog';
import { AppStore } from '../stores/AppStore';

describe('ParseDateDialog', () => {
  beforeEach(() => {
    AppStore.columns.value = ['order_date', 'amount', 'customer'];
    AppStore.selectedColumns.value = [];
    AppStore.selectedColumn.value = null;
    AppStore.editingStepIndex.value = null;
    AppStore.activeModel.value = {
      steps: [],
      schema: [
        { name: 'order_date', type: 'string' },
        { name: 'amount', type: 'integer' },
        { name: 'customer', type: 'string' },
      ],
      id: 'test-model',
      name: 'test',
    } as any;
    AppStore.currentData.value = [
      { order_date: '2024-03-15', amount: 100, customer: 'Alice' },
      { order_date: '2024-03-16', amount: 200, customer: 'Bob' },
    ];
  });

  it('renders source-column label and format presets when a column is selected', () => {
    // selectedColumn seeds initial column
    AppStore.selectedColumn.value = 'order_date';

    renderWithI18n(<ParseDateDialog />);

    expect(screen.getByText('Source column:')).toBeDefined();
    expect(screen.getByText('Format:')).toBeDefined();

    // Format help text
    expect(screen.getByText('Tokens: YYYY, YY, MM, M, DD, D, HH, H, mm, m, ss, s')).toBeDefined();

    // Format placeholder
    expect(screen.getByPlaceholderText('Or type a custom format...')).toBeDefined();
  });

  it('shows sample value section when column is selected and has data', () => {
    AppStore.selectedColumn.value = 'order_date';

    renderWithI18n(<ParseDateDialog />);

    expect(screen.getByText('Sample value')).toBeDefined();
    expect(screen.getByText('2024-03-15')).toBeDefined();
  });

  it('typing into custom-format input updates the value', () => {
    AppStore.selectedColumn.value = 'order_date';

    renderWithI18n(<ParseDateDialog />);

    const formatInput = screen.getByPlaceholderText(
      'Or type a custom format...'
    ) as HTMLInputElement;
    fireEvent.input(formatInput, { target: { value: 'YYYY-MM-DD' } });

    expect(formatInput.value).toBe('YYYY-MM-DD');
  });

  it('clicking a format preset populates the custom-format input', () => {
    AppStore.selectedColumn.value = 'order_date';

    renderWithI18n(<ParseDateDialog />);

    // The MM/DD/YYYY preset has the literal label "MM/DD/YYYY" (no formatKeyMap entry for plain MM/DD/YYYY... actually yes, "us")
    // formatKeyMap maps 'MM/DD/YYYY' -> 'us' which renders parseDate.formats.us = "US (M/D/YYYY)"
    const usButton = screen.getByText('US (M/D/YYYY)');
    fireEvent.click(usButton);

    const formatInput = screen.getByPlaceholderText(
      'Or type a custom format...'
    ) as HTMLInputElement;
    expect(formatInput.value).toBe('MM/DD/YYYY');
  });

  it('hides format/sample sections when no column is selected', () => {
    // No string columns at all → column defaults to '' → conditional is hidden
    AppStore.activeModel.value = {
      steps: [],
      schema: [
        { name: 'amount', type: 'integer' },
        { name: 'qty', type: 'integer' },
      ],
      id: 'test-model',
      name: 'test',
    } as any;
    AppStore.columns.value = ['amount', 'qty'];

    renderWithI18n(<ParseDateDialog />);

    // Source column section still rendered with no-columns help
    expect(screen.getByText('No string columns found.')).toBeDefined();

    // Format section is not rendered (conditional on column.value)
    expect(screen.queryByText('Format:')).toBeNull();
    expect(screen.queryByText('Sample value')).toBeNull();
  });

  it('renders format presets including localized US/EU labels and raw tokens', () => {
    AppStore.selectedColumn.value = 'order_date';

    renderWithI18n(<ParseDateDialog />);

    // Mapped formats use localized labels
    expect(screen.getByText('US (M/D/YYYY)')).toBeDefined();
    expect(screen.getByText('EU (D/M/YYYY)')).toBeDefined();
    expect(screen.getByText('US + time')).toBeDefined();
    expect(screen.getByText('EU + time')).toBeDefined();
    // Unmapped formats fall through with their raw token strings
    expect(screen.getByText('YYYY.MM.DD')).toBeDefined();
    expect(screen.getByText('YYYY-MM-DD HH:mm:ss')).toBeDefined();
  });

  it('uses first string column as default when no quick-selected column', () => {
    // selectedColumn null → default is first string column ("order_date")
    renderWithI18n(<ParseDateDialog />);

    // Sample value should still appear because order_date is selected by default
    expect(screen.getByText('Sample value')).toBeDefined();
    expect(screen.getByText('2024-03-15')).toBeDefined();
  });
});
