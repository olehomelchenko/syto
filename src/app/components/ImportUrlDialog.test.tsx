/**
 * ImportUrlDialog Component Tests
 *
 * Covers the URL input + signal binding, the sample-dataset list, the
 * Enter-key import trigger, the click-to-fill behaviour for sample
 * datasets, and the error / fetching banners.
 *
 * The actual fetch is not exercised — onImport is a parent-supplied
 * callback so we just assert it gets invoked with the expected URL state.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/preact';
import { renderWithI18n } from '../test-utils';
import { ImportUrlDialog } from './ImportUrlDialog';
import { DialogStore } from '../stores/DialogStore';

describe('ImportUrlDialog', () => {
  beforeEach(() => {
    DialogStore.importUrlState.url.value = '';
    DialogStore.importUrlState.isFetching.value = false;
    DialogStore.importUrlState.error.value = null;
  });

  it('renders the URL label, help text, and sample datasets header', () => {
    renderWithI18n(<ImportUrlDialog onImport={() => {}} />);

    expect(screen.getByText('CSV URL:')).toBeDefined();
    expect(screen.getByText('Enter the direct link to a CSV or TSV file.')).toBeDefined();
    expect(screen.getByText('Sample datasets:')).toBeDefined();
  });

  it('renders the sample dataset links (e.g. Iris, Cars)', () => {
    renderWithI18n(<ImportUrlDialog onImport={() => {}} />);

    expect(screen.getByText('Iris')).toBeDefined();
    expect(screen.getByText('Cars (Auto MPG)')).toBeDefined();
    expect(screen.getByText('Superstore')).toBeDefined();
  });

  it('updates the url signal when typing into the input', () => {
    renderWithI18n(<ImportUrlDialog onImport={() => {}} />);

    const input = screen.getByPlaceholderText('https://example.com/data.csv') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'https://foo.com/data.csv' } });

    expect(DialogStore.importUrlState.url.value).toBe('https://foo.com/data.csv');
  });

  it('clears any error when the user edits the URL', () => {
    DialogStore.importUrlState.error.value = 'Bad URL';

    renderWithI18n(<ImportUrlDialog onImport={() => {}} />);

    const input = screen.getByPlaceholderText('https://example.com/data.csv') as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'https://foo.com' } });

    expect(DialogStore.importUrlState.error.value).toBeNull();
  });

  it('calls onImport when Enter is pressed in the URL input', () => {
    const onImport = vi.fn();
    renderWithI18n(<ImportUrlDialog onImport={onImport} />);

    const input = screen.getByPlaceholderText('https://example.com/data.csv') as HTMLInputElement;
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onImport).toHaveBeenCalled();
  });

  it('fills the URL and triggers onImport when a sample dataset is clicked', () => {
    const onImport = vi.fn();
    renderWithI18n(<ImportUrlDialog onImport={onImport} />);

    fireEvent.click(screen.getByText('Iris'));

    expect(DialogStore.importUrlState.url.value).toContain('iris.json');
    expect(onImport).toHaveBeenCalled();
  });

  it('renders the error banner when error signal is set', () => {
    DialogStore.importUrlState.error.value = 'Network failure';
    renderWithI18n(<ImportUrlDialog onImport={() => {}} />);

    expect(screen.getByText('Network failure')).toBeDefined();
  });

  it('renders the fetching indicator when isFetching is true', () => {
    DialogStore.importUrlState.isFetching.value = true;
    renderWithI18n(<ImportUrlDialog onImport={() => {}} />);

    expect(screen.getByText('Fetching data...')).toBeDefined();
  });
});
