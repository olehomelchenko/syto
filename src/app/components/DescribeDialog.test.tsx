/**
 * DescribeDialog Component Tests
 *
 * Covers default selection (numeric columns auto-selected), preview
 * button + label rendering, help section content, and editing-step
 * initialisation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/preact';
import { renderWithI18n } from '../test-utils';
import { DescribeDialog } from './DescribeDialog';
import { AppStore } from '../stores/AppStore';

describe('DescribeDialog', () => {
  beforeEach(() => {
    AppStore.columns.value = ['name', 'age', 'salary', 'dept'];
    AppStore.selectedColumns.value = [];
    AppStore.selectedColumn.value = null;
    AppStore.editingStepIndex.value = null;
    AppStore.activeModel.value = {
      steps: [],
      schema: [
        { name: 'name', type: 'string' },
        { name: 'age', type: 'integer' },
        { name: 'salary', type: 'float' },
        { name: 'dept', type: 'string' },
      ],
      id: 'test-model',
      name: 'test',
    } as any;
    AppStore.currentData.value = [
      { name: 'Alice', age: 30, salary: 50000, dept: 'Eng' },
      { name: 'Bob', age: 25, salary: 60000, dept: 'Sales' },
    ];
  });

  it('renders columns label, help title, and preview button', () => {
    renderWithI18n(<DescribeDialog />);

    expect(screen.getByText('Columns to describe')).toBeDefined();
    expect(screen.getByText('Computed statistics')).toBeDefined();
    expect(screen.getByText('Preview result')).toBeDefined();
  });

  it('renders all column chips and includes statistic categories', () => {
    renderWithI18n(<DescribeDialog />);

    // Each column appears as a chip
    expect(screen.getByText('age')).toBeDefined();
    expect(screen.getByText('salary')).toBeDefined();
    expect(screen.getByText('dept')).toBeDefined();

    // Help section lists category headings
    expect(screen.getByText('All columns')).toBeDefined();
    expect(screen.getByText('Numeric columns')).toBeDefined();
    expect(screen.getByText('Text / categorical columns')).toBeDefined();
  });

  it('shows statistic example codes (count, mean, top)', () => {
    renderWithI18n(<DescribeDialog />);

    expect(screen.getByText('count')).toBeDefined();
    expect(screen.getByText('unique')).toBeDefined();
    expect(screen.getByText('mean')).toBeDefined();
    expect(screen.getByText('median')).toBeDefined();
    expect(screen.getByText('top')).toBeDefined();
    expect(screen.getByText('freq')).toBeDefined();
  });

  it('preview button is enabled when numeric columns are auto-selected', () => {
    renderWithI18n(<DescribeDialog />);

    const previewBtn = screen.getByText('Preview result') as HTMLButtonElement;
    // Auto-selected age + salary → not disabled
    expect(previewBtn.disabled).toBe(false);
  });

  it('clicking preview does not throw and keeps the button visible', () => {
    renderWithI18n(<DescribeDialog />);

    const previewBtn = screen.getByText('Preview result') as HTMLButtonElement;
    fireEvent.click(previewBtn);

    // Button still in DOM after click (preview.compute bypasses debounce and runs synchronously)
    expect(screen.getByText('Preview result')).toBeDefined();
  });

  it('initializes from editing step with explicit columns', () => {
    AppStore.editingStepIndex.value = 0;
    AppStore.activeModel.value = {
      steps: [
        {
          describe: {
            columns: ['name', 'dept'],
          },
        },
      ],
      schema: [
        { name: 'name', type: 'string' },
        { name: 'age', type: 'integer' },
        { name: 'salary', type: 'float' },
        { name: 'dept', type: 'string' },
      ],
      id: 'test-model',
      name: 'test',
    } as any;

    renderWithI18n(<DescribeDialog />);

    // Dialog rendered with editing-step seed; chips for the chosen columns are visible
    expect(screen.getByText('name')).toBeDefined();
    expect(screen.getByText('dept')).toBeDefined();
  });
});
