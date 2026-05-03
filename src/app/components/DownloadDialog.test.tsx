/**
 * DownloadDialog Component Tests
 *
 * Covers the three download options (CSV, JSON, Workflow), the prompt
 * heading, and that clicking each option closes the dialog by clearing
 * AppStore.activeDialog. The actual export side-effects (file save,
 * notifications) are owned by ExportService and not asserted here.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/preact';
import { renderWithI18n } from '../test-utils';
import { DownloadDialog } from './DownloadDialog';
import { AppStore } from '../stores/AppStore';

describe('DownloadDialog', () => {
  beforeEach(() => {
    AppStore.activeDialog.value = 'download' as any;
    // No data → ExportService aborts via alert before any download happens.
    AppStore.currentData.value = null;
    AppStore.activeModel.value = null;

    // Stub alert (ExportService calls window.alert via the showAlert callback)
    vi.stubGlobal('alert', vi.fn());
  });

  it('renders the prompt and three download option titles', () => {
    renderWithI18n(<DownloadDialog />);

    expect(screen.getByText('Select what you would like to download:')).toBeDefined();
    expect(screen.getByText('Recent Model (CSV)')).toBeDefined();
    expect(screen.getByText('Recent Model (JSON)')).toBeDefined();
    expect(screen.getByText('Workflow (JSON)')).toBeDefined();
  });

  it('renders option descriptions', () => {
    renderWithI18n(<DownloadDialog />);

    expect(screen.getByText('Export current model data as a CSV file')).toBeDefined();
    expect(screen.getByText('Export current model data as a JSON file')).toBeDefined();
    expect(screen.getByText('Export transformation steps as a JSON workflow')).toBeDefined();
  });

  it('renders three download buttons', () => {
    renderWithI18n(<DownloadDialog />);

    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBe(3);
  });

  it('closes the dialog when CSV option is clicked', () => {
    renderWithI18n(<DownloadDialog />);

    fireEvent.click(screen.getByText('Recent Model (CSV)'));
    expect(AppStore.activeDialog.value).toBeNull();
  });

  it('closes the dialog when JSON option is clicked', () => {
    AppStore.activeDialog.value = 'download' as any;
    renderWithI18n(<DownloadDialog />);

    fireEvent.click(screen.getByText('Recent Model (JSON)'));
    expect(AppStore.activeDialog.value).toBeNull();
  });

  it('closes the dialog when Workflow option is clicked', () => {
    AppStore.activeDialog.value = 'download' as any;
    renderWithI18n(<DownloadDialog />);

    fireEvent.click(screen.getByText('Workflow (JSON)'));
    expect(AppStore.activeDialog.value).toBeNull();
  });
});
