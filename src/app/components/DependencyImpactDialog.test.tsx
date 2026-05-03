/**
 * DependencyImpactDialog Component Tests
 *
 * Covers conditional render (visible flag), dependent-model listing,
 * radio-button action selection, and the cancel/continue resolution
 * paths that drive the modal's external promise.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/preact';
import { renderWithI18n } from '../test-utils';
import { DependencyImpactDialog } from './DependencyImpactDialog';
import { AppStore } from '../stores/AppStore';

describe('DependencyImpactDialog', () => {
  beforeEach(() => {
    AppStore.dependencyImpactModal.value = {
      visible: false,
      dependentModels: [],
      action: 'mark-stale',
      resolve: null,
    };
  });

  it('renders nothing when modal is hidden', () => {
    const { container } = renderWithI18n(<DependencyImpactDialog />);
    expect(container.firstChild).toBeNull();
  });

  it('renders title, dependent model entry, and both action choices', () => {
    AppStore.dependencyImpactModal.value = {
      visible: true,
      dependentModels: [{ id: 'mdl_1', name: 'Sales summary', sourceName: 'sales' }],
      action: 'mark-stale',
      resolve: null,
    };

    renderWithI18n(<DependencyImpactDialog />);

    expect(screen.getByText(/Dependency impact/)).toBeDefined();
    // Dependent model line includes both source and model name
    expect(screen.getByText(/sales/)).toBeDefined();
    expect(screen.getByText(/Sales summary/)).toBeDefined();
    // Both action titles render
    expect(screen.getByText('Mark as stale (recommended)')).toBeDefined();
    expect(screen.getByText('Recalculate now')).toBeDefined();
  });

  it('reflects "mark-stale" as the initially checked radio', () => {
    AppStore.dependencyImpactModal.value = {
      visible: true,
      dependentModels: [{ id: 'mdl_1', name: 'Sales summary', sourceName: 'sales' }],
      action: 'mark-stale',
      resolve: null,
    };

    renderWithI18n(<DependencyImpactDialog />);

    const markStale = document.querySelector(
      'input[type="radio"][value="mark-stale"]'
    ) as HTMLInputElement;
    const recalculate = document.querySelector(
      'input[type="radio"][value="recalculate"]'
    ) as HTMLInputElement;

    expect(markStale.checked).toBe(true);
    expect(recalculate.checked).toBe(false);
  });

  it('switches the selected action when the recalculate radio is clicked', () => {
    AppStore.dependencyImpactModal.value = {
      visible: true,
      dependentModels: [{ id: 'mdl_1', name: 'Sales summary', sourceName: 'sales' }],
      action: 'mark-stale',
      resolve: null,
    };

    renderWithI18n(<DependencyImpactDialog />);

    const recalculate = document.querySelector(
      'input[type="radio"][value="recalculate"]'
    ) as HTMLInputElement;
    fireEvent.click(recalculate);

    expect(AppStore.dependencyImpactModal.value.action).toBe('recalculate');
  });

  it('Cancel hides the modal and resolves the promise with null', () => {
    const resolve = vi.fn();
    AppStore.dependencyImpactModal.value = {
      visible: true,
      dependentModels: [{ id: 'mdl_1', name: 'Sales summary', sourceName: 'sales' }],
      action: 'mark-stale',
      resolve,
    };

    renderWithI18n(<DependencyImpactDialog />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(resolve).toHaveBeenCalledWith(null);
    expect(AppStore.dependencyImpactModal.value.visible).toBe(false);
  });

  it('Continue resolves the promise with the currently selected action', () => {
    const resolve = vi.fn();
    AppStore.dependencyImpactModal.value = {
      visible: true,
      dependentModels: [{ id: 'mdl_1', name: 'Sales summary', sourceName: 'sales' }],
      action: 'recalculate',
      resolve,
    };

    renderWithI18n(<DependencyImpactDialog />);

    fireEvent.click(screen.getByText('Continue'));

    expect(resolve).toHaveBeenCalledWith('recalculate');
    expect(AppStore.dependencyImpactModal.value.visible).toBe(false);
  });

  it('renders one row per dependent model when several are affected', () => {
    AppStore.dependencyImpactModal.value = {
      visible: true,
      dependentModels: [
        { id: 'mdl_1', name: 'Summary', sourceName: 'sales' },
        { id: 'mdl_2', name: 'Cohort', sourceName: 'customers' },
        { id: 'mdl_3', name: 'Churn', sourceName: 'events' },
      ],
      action: 'mark-stale',
      resolve: null,
    };

    renderWithI18n(<DependencyImpactDialog />);

    expect(screen.getByText(/Summary/)).toBeDefined();
    expect(screen.getByText(/Cohort/)).toBeDefined();
    expect(screen.getByText(/Churn/)).toBeDefined();
  });

  it('uses singular message for one dependent model', () => {
    AppStore.dependencyImpactModal.value = {
      visible: true,
      dependentModels: [{ id: 'mdl_1', name: 'Summary', sourceName: 'sales' }],
      action: 'mark-stale',
      resolve: null,
    };

    renderWithI18n(<DependencyImpactDialog />);

    // English message_one: "...affect 1 dependent model:" (singular)
    expect(screen.getByText(/dependent model:/)).toBeDefined();
    expect(screen.queryByText(/dependent models:/)).toBeNull();
  });

  it('uses plural message for multiple dependent models (regression: was rendering raw i18n key)', () => {
    AppStore.dependencyImpactModal.value = {
      visible: true,
      dependentModels: [
        { id: 'mdl_1', name: 'A', sourceName: 's' },
        { id: 'mdl_2', name: 'B', sourceName: 's' },
        { id: 'mdl_3', name: 'C', sourceName: 's' },
      ],
      action: 'mark-stale',
      resolve: null,
    };

    renderWithI18n(<DependencyImpactDialog />);

    // English message_other: "...affect 3 dependent models:" (plural)
    expect(screen.getByText(/dependent models:/)).toBeDefined();
    // Regression: previous code branched on _few/_many keys that don't exist in
    // English, so the literal key string used to render. Make sure that's gone.
    expect(screen.queryByText(/dependencyDialog\.message/)).toBeNull();
  });
});
