/**
 * Per-dialog store tests
 *
 * Each per-dialog state file is a signal bag plus a reset function. The
 * contract is:
 *  - declared initial values are correct
 *  - signal-bag mutations stick (sanity-check the wiring; this is a
 *    Preact-signal smoke test more than a domain test)
 *  - the reset function returns each signal to its initial value, except
 *    where the file explicitly preserves user prefs (settingsState only)
 *  - the reset function is registered with `reset-registry` so
 *    `resetAllDialogStates()` reaches it
 *
 * `DialogStore` (the orchestrator) has its own coverage in `DialogStore.test.ts`.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  typeConversionState,
  resetTypeConversionState,
  importUrlState,
  resetImportUrlState,
  settingsState,
  resetSettingsState,
  previewState,
  resetPreviewState,
  generateState,
  resetGenerateState,
  importCsvState,
  resetImportCsvState,
  importTextState,
  resetImportTextState,
  workflowImportState,
  resetWorkflowImportState,
  resetAllDialogStates,
  registerResetFunction,
} from './index';

describe('typeConversionState', () => {
  beforeEach(() => resetTypeConversionState());

  it('initial values are null', () => {
    expect(typeConversionState.column.value).toBeNull();
    expect(typeConversionState.targetType.value).toBeNull();
  });

  it('mutations stick', () => {
    typeConversionState.column.value = 'price';
    typeConversionState.targetType.value = 'integer';
    expect(typeConversionState.column.value).toBe('price');
    expect(typeConversionState.targetType.value).toBe('integer');
  });

  it('reset clears mutations', () => {
    typeConversionState.column.value = 'price';
    typeConversionState.targetType.value = 'integer';
    resetTypeConversionState();
    expect(typeConversionState.column.value).toBeNull();
    expect(typeConversionState.targetType.value).toBeNull();
  });
});

describe('importUrlState', () => {
  beforeEach(() => resetImportUrlState());

  it('initial values', () => {
    expect(importUrlState.url.value).toBe('');
    expect(importUrlState.isFetching.value).toBe(false);
    expect(importUrlState.error.value).toBeNull();
  });

  it('reset restores all fields', () => {
    importUrlState.url.value = 'https://example.com/data.csv';
    importUrlState.isFetching.value = true;
    importUrlState.error.value = 'fetch failed';

    resetImportUrlState();

    expect(importUrlState.url.value).toBe('');
    expect(importUrlState.isFetching.value).toBe(false);
    expect(importUrlState.error.value).toBeNull();
  });
});

describe('settingsState', () => {
  beforeEach(() => {
    // Force a clean baseline beyond what reset() touches, since
    // analyticsOptOut/language/engine are user prefs and not reset.
    settingsState.theme.value = 'syto';
    settingsState.rowLimit.value = 100;
    settingsState.analyticsOptOut.value = false;
    settingsState.language.value = 'en';
    settingsState.engine.value = 'arquero';
  });

  it('initial values', () => {
    expect(settingsState.theme.value).toBe('syto');
    expect(settingsState.rowLimit.value).toBe(100);
    expect(settingsState.analyticsOptOut.value).toBe(false);
    expect(settingsState.language.value).toBe('en');
    expect(settingsState.engine.value).toBe('arquero');
  });

  // CONTRACT: reset preserves user preferences (analyticsOptOut, language, engine).
  // Resetting them on every dialog open would clobber the user's chosen
  // language and analytics opt-out — see `settings-state.ts` source comment.
  it('reset restores theme and rowLimit only — user prefs are preserved', () => {
    settingsState.theme.value = 'blues';
    settingsState.rowLimit.value = 500;
    settingsState.analyticsOptOut.value = true;
    settingsState.language.value = 'uk';
    settingsState.engine.value = 'duckdb';

    resetSettingsState();

    expect(settingsState.theme.value).toBe('syto');
    expect(settingsState.rowLimit.value).toBe(100);
    // User prefs not reset:
    expect(settingsState.analyticsOptOut.value).toBe(true);
    expect(settingsState.language.value).toBe('uk');
    expect(settingsState.engine.value).toBe('duckdb');
  });
});

describe('previewState', () => {
  beforeEach(() => resetPreviewState());

  it('initial values', () => {
    expect(previewState.title.value).toBe('');
    expect(previewState.stats.value).toBe('');
    expect(previewState.columns.value).toEqual([]);
    expect(previewState.newColumns.value).toEqual([]);
    expect(previewState.rows.value).toEqual([]);
    expect(previewState.isLoading.value).toBe(false);
  });

  it('reset clears all fields including arrays', () => {
    previewState.title.value = 'Preview';
    previewState.stats.value = '5 rows';
    previewState.columns.value = ['a', 'b'];
    previewState.newColumns.value = ['c'];
    previewState.rows.value = [{ a: 1, b: 2 }];
    previewState.isLoading.value = true;

    resetPreviewState();

    expect(previewState.title.value).toBe('');
    expect(previewState.stats.value).toBe('');
    expect(previewState.columns.value).toEqual([]);
    expect(previewState.newColumns.value).toEqual([]);
    expect(previewState.rows.value).toEqual([]);
    expect(previewState.isLoading.value).toBe(false);
  });
});

describe('generateState', () => {
  beforeEach(() => resetGenerateState());

  it('initial values match generate-state.ts defaults', () => {
    expect(generateState.sourceName.value).toBe('generated_data');
    expect(generateState.rowCount.value).toBe(100);
    expect(generateState.isRowAuto.value).toBe(false);
    expect(generateState.columnName.value).toBe('id');
    expect(generateState.type.value).toBe('numberSequence');
    expect(generateState.config.value).toEqual({
      type: 'numberSequence',
      start: 1,
      step: 1,
      decimals: 0,
    });
    expect(generateState.error.value).toBeNull();
  });

  it('reset restores config object as a fresh value (not a stale reference)', () => {
    const original = generateState.config.value;
    generateState.config.value = { type: 'random', min: 0, max: 99 };
    resetGenerateState();
    expect(generateState.config.value).toEqual({
      type: 'numberSequence',
      start: 1,
      step: 1,
      decimals: 0,
    });
    // Sanity: the post-reset value isn't the same object instance we
    // mutated through the setter — confirms reset rebuilds the default.
    expect(generateState.config.value).not.toBe(original);
  });

  it('reset clears error and other fields', () => {
    generateState.sourceName.value = 'custom';
    generateState.rowCount.value = 50;
    generateState.isRowAuto.value = true;
    generateState.columnName.value = 'idx';
    generateState.type.value = 'random';
    generateState.error.value = 'bad config';

    resetGenerateState();

    expect(generateState.sourceName.value).toBe('generated_data');
    expect(generateState.rowCount.value).toBe(100);
    expect(generateState.isRowAuto.value).toBe(false);
    expect(generateState.columnName.value).toBe('id');
    expect(generateState.type.value).toBe('numberSequence');
    expect(generateState.error.value).toBeNull();
  });
});

describe('importCsvState', () => {
  beforeEach(() => resetImportCsvState());

  it('initial values for the most-touched fields', () => {
    expect(importCsvState.fileName.value).toBe('');
    expect(importCsvState.sourceName.value).toBe('');
    expect(importCsvState.delimiter.value).toBe(',');
    expect(importCsvState.headerMode.value).toBe('first-row');
    expect(importCsvState.isJson.value).toBe(false);
    expect(importCsvState.isExcel.value).toBe(false);
    expect(importCsvState.isReplaceMode.value).toBe(false);
  });

  it('initial values for collection fields are empty', () => {
    expect(importCsvState.suggestedJsonKeys.value).toEqual([]);
    expect(importCsvState.originalHeaders.value).toEqual([]);
    expect(importCsvState.customHeaders.value).toEqual([]);
    expect(importCsvState.rawPreviewData.value).toEqual([]);
    expect(importCsvState.previewHeaders.value).toEqual([]);
    expect(importCsvState.previewDataRows.value).toEqual([]);
    expect(importCsvState.sheetNames.value).toEqual([]);
  });

  it('initial values for nullable fields are null', () => {
    expect(importCsvState.jsonData.value).toBeNull();
    expect(importCsvState.fullJsonData.value).toBeNull();
    expect(importCsvState.targetSourceId.value).toBeNull();
    expect(importCsvState.schemaDiff.value).toBeNull();
    expect(importCsvState.excelData.value).toBeNull();
    expect(importCsvState.excelBuffer.value).toBeNull();
  });

  it('reset returns a heavily-mutated state to defaults', () => {
    importCsvState.fileName.value = 'data.csv';
    importCsvState.sourceName.value = 'data';
    importCsvState.delimiter.value = ';';
    importCsvState.headerMode.value = 'no-header';
    importCsvState.isJson.value = true;
    importCsvState.isExcel.value = true;
    importCsvState.isReplaceMode.value = true;
    importCsvState.originalHeaders.value = ['a', 'b'];
    importCsvState.customHeaders.value = ['x', 'y'];
    importCsvState.targetSourceId.value = 'src-1';
    importCsvState.selectedSheetIndex.value = 3;

    resetImportCsvState();

    expect(importCsvState.fileName.value).toBe('');
    expect(importCsvState.sourceName.value).toBe('');
    expect(importCsvState.delimiter.value).toBe(',');
    expect(importCsvState.headerMode.value).toBe('first-row');
    expect(importCsvState.isJson.value).toBe(false);
    expect(importCsvState.isExcel.value).toBe(false);
    expect(importCsvState.isReplaceMode.value).toBe(false);
    expect(importCsvState.originalHeaders.value).toEqual([]);
    expect(importCsvState.customHeaders.value).toEqual([]);
    expect(importCsvState.targetSourceId.value).toBeNull();
    expect(importCsvState.selectedSheetIndex.value).toBe(0);
  });
});

describe('importTextState', () => {
  beforeEach(() => resetImportTextState());

  it('initial values', () => {
    expect(importTextState.text.value).toBe('');
    expect(importTextState.isEditMode.value).toBe(false);
    expect(importTextState.targetSourceId.value).toBeNull();
  });

  it('reset clears text and edit-mode flags', () => {
    importTextState.text.value = 'col1,col2\n1,2';
    importTextState.isEditMode.value = true;
    importTextState.targetSourceId.value = 'src-42';

    resetImportTextState();

    expect(importTextState.text.value).toBe('');
    expect(importTextState.isEditMode.value).toBe(false);
    expect(importTextState.targetSourceId.value).toBeNull();
  });
});

describe('workflowImportState', () => {
  beforeEach(() => resetWorkflowImportState());

  it('initial values', () => {
    expect(workflowImportState.workflow.value).toBeNull();
    expect(workflowImportState.sourceNames.value).toEqual([]);
    expect(workflowImportState.bindings.value).toBeInstanceOf(Map);
    expect(workflowImportState.bindings.value.size).toBe(0);
    expect(workflowImportState.validationErrors.value).toEqual([]);
    expect(workflowImportState.isProcessing.value).toBe(false);
  });

  it('reset replaces bindings Map with a fresh empty Map', () => {
    const original = workflowImportState.bindings.value;
    workflowImportState.bindings.value = new Map([
      ['users', { file: null, data: [{ a: 1 }], columns: ['a'], error: null }],
    ]);

    resetWorkflowImportState();

    expect(workflowImportState.bindings.value).toBeInstanceOf(Map);
    expect(workflowImportState.bindings.value.size).toBe(0);
    // Sanity: the post-reset Map isn't the same instance we replaced.
    expect(workflowImportState.bindings.value).not.toBe(original);
  });

  it('reset clears workflow + validation errors', () => {
    workflowImportState.workflow.value = { formatVersion: '2.0' } as any;
    workflowImportState.sourceNames.value = ['users', 'orders'];
    workflowImportState.validationErrors.value = ['bad'];
    workflowImportState.isProcessing.value = true;

    resetWorkflowImportState();

    expect(workflowImportState.workflow.value).toBeNull();
    expect(workflowImportState.sourceNames.value).toEqual([]);
    expect(workflowImportState.validationErrors.value).toEqual([]);
    expect(workflowImportState.isProcessing.value).toBe(false);
  });
});

describe('reset-registry', () => {
  it('resetAllDialogStates fans out to every per-dialog reset', () => {
    typeConversionState.column.value = 'col';
    importUrlState.url.value = 'http://x';
    previewState.title.value = 'preview';
    generateState.error.value = 'oops';
    importCsvState.fileName.value = 'a.csv';
    importTextState.text.value = 'hi';
    workflowImportState.isProcessing.value = true;

    resetAllDialogStates();

    expect(typeConversionState.column.value).toBeNull();
    expect(importUrlState.url.value).toBe('');
    expect(previewState.title.value).toBe('');
    expect(generateState.error.value).toBeNull();
    expect(importCsvState.fileName.value).toBe('');
    expect(importTextState.text.value).toBe('');
    expect(workflowImportState.isProcessing.value).toBe(false);
  });

  it('registerResetFunction adds a callback that fires on resetAllDialogStates', () => {
    let calls = 0;
    registerResetFunction(() => {
      calls += 1;
    });

    resetAllDialogStates();
    expect(calls).toBe(1);

    resetAllDialogStates();
    expect(calls).toBe(2);
  });
});
