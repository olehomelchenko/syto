/**
 * RenamePatternDialog Component Tests
 *
 * Covers initial render, find/replace inputs, regex toggle (with help text
 * switching), regex validation error, and editing-step initialisation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/preact';
import { renderWithI18n } from '../test-utils';
import { RenamePatternDialog } from './RenamePatternDialog';
import { AppStore } from '../stores/AppStore';

describe('RenamePatternDialog', () => {
  beforeEach(() => {
    AppStore.columns.value = ['col_old_1', 'col_old_2', 'name'];
    AppStore.selectedColumns.value = [];
    AppStore.selectedColumn.value = null;
    AppStore.editingStepIndex.value = null;
    AppStore.activeModel.value = {
      steps: [],
      schema: [
        { name: 'col_old_1', type: 'string' },
        { name: 'col_old_2', type: 'string' },
        { name: 'name', type: 'string' },
      ],
      id: 'test-model',
      name: 'test',
    } as any;
    AppStore.currentData.value = [];
  });

  it('renders find/replace inputs and regex checkbox', () => {
    renderWithI18n(<RenamePatternDialog />);

    expect(
      screen.getByText('Rename multiple columns by pattern. Useful for bulk renaming operations.')
    ).toBeDefined();
    expect(screen.getByText('Find pattern:')).toBeDefined();
    expect(screen.getByText('Replace with:')).toBeDefined();
    expect(screen.getByText('Use regex pattern')).toBeDefined();
    expect(screen.getByPlaceholderText('e.g., _old$')).toBeDefined();
    expect(screen.getByPlaceholderText('e.g., _new')).toBeDefined();
  });

  it('defaults to plain-text mode (regex unchecked) with corresponding help text', () => {
    renderWithI18n(<RenamePatternDialog />);

    const checkbox = screen.getByLabelText('Use regex pattern') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(screen.getByText('Pattern is plain text (exact match)')).toBeDefined();
  });

  it('updates find and replace inputs when typed', () => {
    renderWithI18n(<RenamePatternDialog />);

    const findInput = screen.getByPlaceholderText('e.g., _old$') as HTMLInputElement;
    const replaceInput = screen.getByPlaceholderText('e.g., _new') as HTMLInputElement;

    fireEvent.input(findInput, { target: { value: '_old' } });
    fireEvent.input(replaceInput, { target: { value: '_new' } });

    expect(findInput.value).toBe('_old');
    expect(replaceInput.value).toBe('_new');
  });

  it('toggles regex mode and switches help text', () => {
    renderWithI18n(<RenamePatternDialog />);

    const checkbox = screen.getByLabelText('Use regex pattern') as HTMLInputElement;
    fireEvent.click(checkbox);

    expect(checkbox.checked).toBe(true);
    expect(
      screen.getByText('Pattern is a regular expression (e.g., ^prefix_ or _suffix$)')
    ).toBeDefined();
  });

  it('shows error message for invalid regex pattern when regex mode is on', () => {
    renderWithI18n(<RenamePatternDialog />);

    // Enable regex mode
    const checkbox = screen.getByLabelText('Use regex pattern') as HTMLInputElement;
    fireEvent.click(checkbox);

    // Type invalid regex
    const findInput = screen.getByPlaceholderText('e.g., _old$') as HTMLInputElement;
    fireEvent.input(findInput, { target: { value: '[broken' } });

    expect(screen.getByText(/Fix pattern errors before applying:/)).toBeDefined();
  });

  it('does not validate as regex when regex mode is off', () => {
    renderWithI18n(<RenamePatternDialog />);

    // Plain mode: same string that would be invalid as regex should not produce an error
    const findInput = screen.getByPlaceholderText('e.g., _old$') as HTMLInputElement;
    fireEvent.input(findInput, { target: { value: '[broken' } });

    expect(screen.queryByText(/Fix pattern errors before applying:/)).toBeNull();
  });

  it('initializes from editing step with regex flag enabled and pre-filled find/replace', () => {
    AppStore.editingStepIndex.value = 0;
    AppStore.activeModel.value = {
      steps: [
        {
          renamePattern: {
            find: '^col_',
            replace: 'column_',
            regex: true,
          },
        },
      ],
      schema: [],
      id: 'test-model',
      name: 'test',
    } as any;

    renderWithI18n(<RenamePatternDialog />);

    const findInput = screen.getByPlaceholderText('e.g., _old$') as HTMLInputElement;
    const replaceInput = screen.getByPlaceholderText('e.g., _new') as HTMLInputElement;
    const checkbox = screen.getByLabelText('Use regex pattern') as HTMLInputElement;

    expect(findInput.value).toBe('^col_');
    expect(replaceInput.value).toBe('column_');
    expect(checkbox.checked).toBe(true);
    expect(
      screen.getByText('Pattern is a regular expression (e.g., ^prefix_ or _suffix$)')
    ).toBeDefined();
  });
});
