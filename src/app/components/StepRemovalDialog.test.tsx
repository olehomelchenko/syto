/**
 * StepRemovalDialog Component Tests
 *
 * Covers conditional render, message interpolation with the step name,
 * the affected-steps preview list, mode-toggle radios, and the cancel/
 * confirm resolution paths.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/preact';
import { renderWithI18n } from '../test-utils';
import { StepRemovalDialog } from './StepRemovalDialog';
import { AppStore } from '../stores/AppStore';

describe('StepRemovalDialog', () => {
  beforeEach(() => {
    AppStore.stepRemovalModal.value = {
      visible: false,
      stepIndex: -1,
      stepName: '',
      affectedSteps: [],
      removeMode: 'all',
      resolve: null,
    };
  });

  it('renders nothing when modal is hidden', () => {
    const { container } = renderWithI18n(<StepRemovalDialog />);
    expect(container.firstChild).toBeNull();
  });

  it('renders title, the interpolated step-name message, and both mode labels', () => {
    AppStore.stepRemovalModal.value = {
      visible: true,
      stepIndex: 2,
      stepName: 'Filter rows',
      affectedSteps: [],
      removeMode: 'all',
      resolve: null,
    };

    renderWithI18n(<StepRemovalDialog />);

    expect(screen.getByText('Remove step')).toBeDefined();
    expect(screen.getByText('Remove step "Filter rows"?')).toBeDefined();
    expect(screen.getByText('Remove this step and all following steps')).toBeDefined();
    expect(screen.getByText('Remove only this step')).toBeDefined();
  });

  it('lists each affected step in the preview when removeMode is "all"', () => {
    AppStore.stepRemovalModal.value = {
      visible: true,
      stepIndex: 1,
      stepName: 'Sort rows',
      affectedSteps: ['Derive column', 'Aggregate'],
      removeMode: 'all',
      resolve: null,
    };

    renderWithI18n(<StepRemovalDialog />);

    expect(screen.getByText('Will also remove:')).toBeDefined();
    expect(screen.getByText('Derive column')).toBeDefined();
    expect(screen.getByText('Aggregate')).toBeDefined();
  });

  it('shows the warning text under the "single" option', () => {
    AppStore.stepRemovalModal.value = {
      visible: true,
      stepIndex: 1,
      stepName: 'Sort rows',
      affectedSteps: ['Derive column'],
      removeMode: 'single',
      resolve: null,
    };

    renderWithI18n(<StepRemovalDialog />);

    expect(
      screen.getByText("Following steps may fail if they depend on this step's output")
    ).toBeDefined();
  });

  it('updates removeMode when the "single" radio is clicked', () => {
    AppStore.stepRemovalModal.value = {
      visible: true,
      stepIndex: 1,
      stepName: 'Sort rows',
      affectedSteps: [],
      removeMode: 'all',
      resolve: null,
    };

    renderWithI18n(<StepRemovalDialog />);

    const singleRadio = document.querySelector(
      'input[type="radio"][value="single"]'
    ) as HTMLInputElement;
    fireEvent.click(singleRadio);

    expect(AppStore.stepRemovalModal.value.removeMode).toBe('single');
  });

  it('Cancel hides the modal and resolves with null', () => {
    const resolve = vi.fn();
    AppStore.stepRemovalModal.value = {
      visible: true,
      stepIndex: 1,
      stepName: 'Sort rows',
      affectedSteps: [],
      removeMode: 'all',
      resolve,
    };

    renderWithI18n(<StepRemovalDialog />);

    fireEvent.click(screen.getByText('Cancel'));

    expect(resolve).toHaveBeenCalledWith(null);
    expect(AppStore.stepRemovalModal.value.visible).toBe(false);
  });

  it('Remove resolves with the current removeMode', () => {
    const resolve = vi.fn();
    AppStore.stepRemovalModal.value = {
      visible: true,
      stepIndex: 1,
      stepName: 'Sort rows',
      affectedSteps: [],
      removeMode: 'single',
      resolve,
    };

    renderWithI18n(<StepRemovalDialog />);

    fireEvent.click(screen.getByText('Remove'));

    expect(resolve).toHaveBeenCalledWith('single');
    expect(AppStore.stepRemovalModal.value.visible).toBe(false);
  });
});
