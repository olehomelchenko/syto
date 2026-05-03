/**
 * GenerateDialog Component Tests
 *
 * Covers the source/column-name inputs, generator-type radio selector,
 * row-count input + auto-calculate toggle, the help-text branches for
 * row count, and the error-banner branch.
 *
 * Generator output is not asserted — that belongs to GeneratorService tests.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/preact';
import { renderWithI18n } from '../test-utils';
import { GenerateDialog } from './GenerateDialog';
import { DialogStore } from '../stores/DialogStore';

describe('GenerateDialog', () => {
  beforeEach(() => {
    DialogStore.generateState.sourceName.value = 'generated_data';
    DialogStore.generateState.rowCount.value = 100;
    DialogStore.generateState.isRowAuto.value = false;
    DialogStore.generateState.columnName.value = 'id';
    DialogStore.generateState.type.value = 'numberSequence';
    DialogStore.generateState.config.value = {
      type: 'numberSequence',
      start: 1,
      step: 1,
      decimals: 0,
    };
    DialogStore.generateState.error.value = null;
  });

  it('renders source-name, column-name, and row-count fields with defaults', () => {
    renderWithI18n(<GenerateDialog />);

    expect(screen.getByText('Source name')).toBeDefined();
    expect(screen.getByText('Column name')).toBeDefined();
    expect(screen.getByText('Number of rows')).toBeDefined();
    expect(screen.getByDisplayValue('generated_data')).toBeDefined();
    expect(screen.getByDisplayValue('id')).toBeDefined();
    expect(screen.getByDisplayValue('100')).toBeDefined();
  });

  it('renders all 6 generator type radios', () => {
    renderWithI18n(<GenerateDialog />);

    expect(screen.getByText('Number sequence')).toBeDefined();
    expect(screen.getByText('Date sequence')).toBeDefined();
    expect(screen.getByText('Random number')).toBeDefined();
    expect(screen.getByText('Random date')).toBeDefined();
    expect(screen.getByText('Random boolean')).toBeDefined();
    expect(screen.getByText('Random category')).toBeDefined();
  });

  it('updates source name signal when typing', () => {
    renderWithI18n(<GenerateDialog />);

    const input = screen.getByDisplayValue('generated_data') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'my_data' } });
    expect(DialogStore.generateState.sourceName.value).toBe('my_data');
  });

  it('updates column name signal when typing', () => {
    renderWithI18n(<GenerateDialog />);

    const input = screen.getByDisplayValue('id') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'order_id' } });
    expect(DialogStore.generateState.columnName.value).toBe('order_id');
  });

  it('updates rowCount when typing into the row count input', () => {
    renderWithI18n(<GenerateDialog />);

    const input = screen.getByDisplayValue('100') as HTMLInputElement;
    fireEvent.input(input, { target: { value: '500' } });
    expect(DialogStore.generateState.rowCount.value).toBe(500);
  });

  it('toggles auto-calculate and disables the row count input', () => {
    renderWithI18n(<GenerateDialog />);

    const autoCheckbox = screen.getByLabelText('Auto-calculate') as HTMLInputElement;
    expect(autoCheckbox.checked).toBe(false);

    fireEvent.click(autoCheckbox);
    expect(DialogStore.generateState.isRowAuto.value).toBe(true);

    const rowInput = screen.getByDisplayValue('100') as HTMLInputElement;
    expect(rowInput.disabled).toBe(true);
  });

  it('shows manual row-count help text by default', () => {
    renderWithI18n(<GenerateDialog />);
    expect(screen.getByText('Maximum: 100,000 rows')).toBeDefined();
  });

  it('shows the auto-calculate "need stop" hint when auto is on without a stop value', () => {
    DialogStore.generateState.isRowAuto.value = true;
    DialogStore.generateState.config.value = {
      type: 'numberSequence',
      start: 1,
      step: 1,
      decimals: 0,
      // no stop
    };

    renderWithI18n(<GenerateDialog />);
    expect(screen.getByText(/Add a sequence with a "Stop" value to calculate rows/)).toBeDefined();
  });

  it('switches generator type when a different type radio is selected', () => {
    const { container } = renderWithI18n(<GenerateDialog />);

    const radios = container.querySelectorAll(
      'input[name="generatorType"]'
    ) as NodeListOf<HTMLInputElement>;
    const booleanRadio = Array.from(radios).find((r) => r.value === 'randomBoolean');
    expect(booleanRadio).toBeDefined();
    fireEvent.change(booleanRadio!, { target: { checked: true } });
    expect(DialogStore.generateState.type.value).toBe('randomBoolean');
  });

  it('renders the error banner when error signal is set', () => {
    DialogStore.generateState.error.value = 'Invalid configuration';
    renderWithI18n(<GenerateDialog />);

    expect(screen.getByText('Invalid configuration')).toBeDefined();
  });
});
