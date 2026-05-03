/**
 * WindowDialog Component Tests
 *
 * Tests the most complex dialog: dynamic window function configuration,
 * conditional UI per function type, auto-naming, editing from step.
 */
import { screen, fireEvent } from '@testing-library/preact';
import { renderWithI18n } from '../test-utils';
import { describe, it, expect, beforeEach } from 'vitest';
import { WindowDialog } from './WindowDialog';
import { AppStore } from '../stores/AppStore';

describe('WindowDialog', () => {
  const columns = ['date', 'sales', 'category', 'region'];

  beforeEach(() => {
    AppStore.columns.value = columns;
    AppStore.selectedColumns.value = [];
    AppStore.editingStepIndex.value = null;
    AppStore.activeModel.value = {
      steps: [],
      schema: [
        { name: 'date', type: 'string' },
        { name: 'sales', type: 'float' },
        { name: 'category', type: 'string' },
        { name: 'region', type: 'string' },
      ],
      id: 'test-model',
      name: 'test',
    } as any;
    AppStore.currentData.value = [
      { date: '2024-01-01', sales: 100, category: 'A', region: 'East' },
      { date: '2024-01-02', sales: 200, category: 'A', region: 'East' },
      { date: '2024-01-03', sales: 150, category: 'B', region: 'West' },
    ];
  });

  it('renders default sections and add buttons', () => {
    renderWithI18n(<WindowDialog />);

    expect(screen.getByText('Order by')).toBeDefined();
    expect(screen.getByText('Window functions')).toBeDefined();
    expect(screen.getByText('Partition by (optional)')).toBeDefined();
    expect(screen.getByText('Preview result')).toBeDefined();
    expect(screen.getByText('What are window functions?')).toBeDefined();
    expect(screen.getByText('+ Add order column')).toBeDefined();
    expect(screen.getByText('+ Add window function')).toBeDefined();
  });

  it('adds an order-by row', () => {
    renderWithI18n(<WindowDialog />);

    // No remove buttons initially (order-by starts empty, no window functions)
    expect(screen.queryAllByTitle('Remove')).toHaveLength(0);

    fireEvent.click(screen.getByText('+ Add order column'));
    // One order-by row → one remove button
    expect(screen.queryAllByTitle('Remove')).toHaveLength(1);
  });

  it('adds a window function row', () => {
    renderWithI18n(<WindowDialog />);

    fireEvent.click(screen.getByText('+ Add window function'));
    // Window functions start empty; after add: 1 window function remove
    expect(screen.queryAllByTitle('Remove')).toHaveLength(1);
  });

  it('adds both order-by and window function, then removes', () => {
    renderWithI18n(<WindowDialog />);

    fireEvent.click(screen.getByText('+ Add order column'));
    fireEvent.click(screen.getByText('+ Add window function'));
    // 1 order-by remove + 1 window function remove = 2
    expect(screen.queryAllByTitle('Remove')).toHaveLength(2);

    // Remove the window function
    fireEvent.click(screen.getAllByTitle('Remove')[1]);
    expect(screen.queryAllByTitle('Remove')).toHaveLength(1);
  });

  it('function selector shows all categories', () => {
    renderWithI18n(<WindowDialog />);
    fireEvent.click(screen.getByText('+ Add window function'));

    // Options from all categories are rendered
    expect(screen.getByText('Row number')).toBeDefined();
    expect(screen.getByText('Rank')).toBeDefined();
    expect(screen.getByText('Lag')).toBeDefined();
    expect(screen.getByText('Lead')).toBeDefined();
    expect(screen.getByText('Fill down')).toBeDefined();
    expect(screen.getByText('Running sum')).toBeDefined();
    expect(screen.getByText('Running mean')).toBeDefined();
  });

  it('shows output column name input', () => {
    renderWithI18n(<WindowDialog />);
    fireEvent.click(screen.getByText('+ Add window function'));

    expect(screen.getByPlaceholderText('Output column name')).toBeDefined();
  });

  it('initializes from editing step', () => {
    AppStore.editingStepIndex.value = 1;
    AppStore.activeModel.value = {
      steps: [
        {
          import: { source: 'test', fileName: 'test.csv', delimiter: ',', headerMode: 'auto' },
        },
        {
          window: {
            orderBy: [{ field: 'date', order: 'asc' }],
            partitionBy: ['category'],
            derive: {
              sales_rank: 'op.rank()',
              sales_sum: "op.sum('sales')",
            },
          },
        },
      ],
      schema: [],
      id: 'test-model',
      name: 'test',
    } as any;

    renderWithI18n(<WindowDialog />);

    // 1 order-by + 2 window functions = 3 removes
    expect(screen.queryAllByTitle('Remove')).toHaveLength(3);
  });
});
