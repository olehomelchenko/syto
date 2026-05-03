/**
 * ImportTextDialog Component Tests
 *
 * Covers the textarea binding, the create-vs-edit label switch,
 * placeholder, help text, and shortcut hint with platform-aware modifier.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/preact';
import { renderWithI18n } from '../test-utils';
import { ImportTextDialog } from './ImportTextDialog';
import { DialogStore } from '../stores/DialogStore';

describe('ImportTextDialog', () => {
  beforeEach(() => {
    DialogStore.importTextState.text.value = '';
    DialogStore.importTextState.isEditMode.value = false;
    DialogStore.importTextState.targetSourceId.value = null;
  });

  it('renders the create-mode label, help text, and placeholder', () => {
    const { container } = renderWithI18n(<ImportTextDialog />);

    expect(screen.getByText('Paste or type your data:')).toBeDefined();
    expect(
      screen.getByText('Enter CSV, TSV, or JSON data. The data will be parsed in the next step.')
    ).toBeDefined();
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea).toBeDefined();
    expect(textarea.placeholder).toContain('Name, Age, City');
    expect(textarea.placeholder).toContain('Alice, 30, London');
  });

  it('shows the edit-mode label when isEditMode is true', () => {
    DialogStore.importTextState.isEditMode.value = true;

    renderWithI18n(<ImportTextDialog />);

    expect(screen.getByText('Edit your data:')).toBeDefined();
    expect(screen.queryByText('Paste or type your data:')).toBeNull();
  });

  it('reflects the text signal value in the textarea', () => {
    DialogStore.importTextState.text.value = 'a,b\n1,2';

    const { container } = renderWithI18n(<ImportTextDialog />);

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(textarea.value).toBe('a,b\n1,2');
  });

  it('updates the text signal when the user types', () => {
    const { container } = renderWithI18n(<ImportTextDialog />);

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: 'foo' } });

    expect(DialogStore.importTextState.text.value).toBe('foo');
  });

  it('renders a shortcut hint that mentions a modifier (Ctrl or Cmd)', () => {
    renderWithI18n(<ImportTextDialog />);

    // The component uses navigator.platform to pick "⌘" or "Ctrl".
    // Either form is acceptable in tests.
    const hint = screen.getByText(
      /Tip: press (Ctrl|⌘)\+V anywhere in the app to quickly create a dataset/
    );
    expect(hint).toBeDefined();
  });
});
