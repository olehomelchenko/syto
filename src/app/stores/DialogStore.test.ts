/**
 * DialogStore Tests
 *
 * Tests the centralized dialog state management: static references to
 * dialog state objects, bridge signals for useDialogState hook, the
 * createSignalProxy helper, and resetAll behavior.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@preact/signals';
import { DialogStore } from './DialogStore';
import { resetAllDialogStates } from './dialogs/reset-registry';

describe('DialogStore', () => {
  beforeEach(() => {
    // Ensure clean state before each test
    resetAllDialogStates();
    DialogStore.activeDialogState.value = null;
    DialogStore.activeDialogHasError.value = false;
    DialogStore.activeDialogError.value = null;
  });

  describe('static state references', () => {
    it('typeConversionState is defined', () => {
      expect(DialogStore.typeConversionState).toBeDefined();
      expect(typeof DialogStore.typeConversionState).toBe('object');
    });

    it('importUrlState is defined', () => {
      expect(DialogStore.importUrlState).toBeDefined();
      expect(typeof DialogStore.importUrlState).toBe('object');
    });

    it('settingsState is defined with expected keys', () => {
      expect(DialogStore.settingsState).toBeDefined();
      expect(DialogStore.settingsState.theme).toBeDefined();
      expect(DialogStore.settingsState.rowLimit).toBeDefined();
      expect(DialogStore.settingsState.analyticsOptOut).toBeDefined();
      expect(DialogStore.settingsState.language).toBeDefined();
      expect(DialogStore.settingsState.engine).toBeDefined();
    });

    it('previewState is defined', () => {
      expect(DialogStore.previewState).toBeDefined();
      expect(typeof DialogStore.previewState).toBe('object');
    });

    it('generateState is defined', () => {
      expect(DialogStore.generateState).toBeDefined();
      expect(typeof DialogStore.generateState).toBe('object');
    });

    it('importCsvState is defined', () => {
      expect(DialogStore.importCsvState).toBeDefined();
      expect(typeof DialogStore.importCsvState).toBe('object');
    });

    it('importTextState is defined', () => {
      expect(DialogStore.importTextState).toBeDefined();
      expect(typeof DialogStore.importTextState).toBe('object');
    });

    it('workflowImportState is defined', () => {
      expect(DialogStore.workflowImportState).toBeDefined();
      expect(typeof DialogStore.workflowImportState).toBe('object');
    });
  });

  describe('bridge signals', () => {
    it('activeDialogState defaults to null', () => {
      expect(DialogStore.activeDialogState.value).toBeNull();
    });

    it('activeDialogHasError defaults to false', () => {
      expect(DialogStore.activeDialogHasError.value).toBe(false);
    });

    it('activeDialogError defaults to null', () => {
      expect(DialogStore.activeDialogError.value).toBeNull();
    });

    it('bridge signals are writable', () => {
      DialogStore.activeDialogState.value = { test: 1 };
      DialogStore.activeDialogHasError.value = true;
      DialogStore.activeDialogError.value = 'something broke';

      expect(DialogStore.activeDialogState.value).toEqual({ test: 1 });
      expect(DialogStore.activeDialogHasError.value).toBe(true);
      expect(DialogStore.activeDialogError.value).toBe('something broke');
    });
  });

  describe('createSignalProxy', () => {
    it('get returns .value for signal properties', () => {
      const state = { name: signal('Alice'), age: signal(30) };
      const proxy = DialogStore.createSignalProxy(state);

      expect(proxy.name).toBe('Alice');
      expect(proxy.age).toBe(30);
    });

    it('set updates .value for signal properties', () => {
      const state = { name: signal('Alice'), age: signal(30) };
      const proxy = DialogStore.createSignalProxy(state);

      proxy.name = 'Bob';
      proxy.age = 25;

      expect(state.name.value).toBe('Bob');
      expect(state.age.value).toBe(25);
    });

    it('get returns non-signal values as-is', () => {
      const state = { plain: 42, signalProp: signal('hello') };
      const proxy = DialogStore.createSignalProxy(state);

      expect(proxy.plain).toBe(42);
      expect(proxy.signalProp).toBe('hello');
    });

    it('set throws for non-signal properties (Proxy returns false for non-signal set)', () => {
      const state = { plain: 42, signalProp: signal('hello') };
      const proxy = DialogStore.createSignalProxy(state);

      expect(() => {
        proxy.plain = 99;
      }).toThrow();
      // Non-signal value is unchanged
      expect(proxy.plain).toBe(42);
    });

    it('set throws for non-existent properties', () => {
      const state = { name: signal('test') };
      const proxy = DialogStore.createSignalProxy(state);

      expect(() => {
        proxy.nonexistent = 'value';
      }).toThrow();
    });
  });

  describe('resetAll', () => {
    it('resets bridge signals', () => {
      DialogStore.activeDialogState.value = { dirty: true };
      DialogStore.activeDialogHasError.value = true;
      DialogStore.activeDialogError.value = 'some error';

      DialogStore.resetAll();

      expect(DialogStore.activeDialogState.value).toBeNull();
      expect(DialogStore.activeDialogHasError.value).toBe(false);
      expect(DialogStore.activeDialogError.value).toBeNull();
    });

    it('resets theme and rowLimit to defaults (engine/analyticsOptOut/language are user prefs)', () => {
      DialogStore.settingsState.theme.value = 'blues';
      DialogStore.settingsState.rowLimit.value = 500;

      DialogStore.resetAll();

      expect(DialogStore.settingsState.theme.value).toBe('syto');
      expect(DialogStore.settingsState.rowLimit.value).toBe(100);
    });
  });
});
