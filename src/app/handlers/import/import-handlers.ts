import type { DataRow } from '../../types';
import Papa from 'papaparse';
import { DialogStore } from '../../stores/DialogStore';
import { AppStore } from '../../stores/AppStore';
import { Source } from '../../types';
import { SchemaEngine, ColumnSchema } from '../../../core/schema-engine';
import { ReplaceSourceService } from '../../services/ReplaceSourceService';
import { alert, confirm } from '../core/notification-handlers';
import i18n from '../../../i18n';
import { validateV2Workflow, V2Workflow } from '../../../core/workflow-v2';
import { isInInteractiveContext } from '../../orchestration/focus-utils';

/**
 * Callbacks for import operations
 */
export type ImportCallbacks = {
  openDialog: (name: string, section?: string) => void;
  closeDialog: (force?: boolean) => void;
  createSource: (
    file: File,
    name: string,
    columns: string[],
    data: any[],
    headerMode: string,
    delimiter: string,
    customHeaders: string[] | null,
    format?: string
  ) => Promise<void>;
};

let callbacks: ImportCallbacks | null = null;

/**
 * Set import callbacks for store-based operations
 */
export function setImportCallbacks(cb: ImportCallbacks): void {
  callbacks = cb;
}

// Re-exports for backwards compatibility (logic moved to src/core/json-utils.ts)
import {
  resolvePath,
  getSuggestedKeys,
  flattenData,
  serializeNestedData,
  resolveDuplicateHeaders,
} from '../../../core/json-utils';

export { resolvePath, getSuggestedKeys, flattenData, serializeNestedData, resolveDuplicateHeaders };

const LARGE_FILE_WARNING_BYTES = 100 * 1024 * 1024;

async function confirmLargeFileImport(file: File): Promise<boolean> {
  if (file.size <= LARGE_FILE_WARNING_BYTES) return true;
  const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
  const thresholdMb = LARGE_FILE_WARNING_BYTES / (1024 * 1024);
  return confirm(
    i18n.t('confirms.largeFileWarning', { ns: 'common', size: sizeMb, threshold: thresholdMb }),
    i18n.t('confirms.largeFileTitle', { ns: 'common' }),
    i18n.t('buttons.continue', { ns: 'common' })
  );
}

/**
 * Compute schema diff for preview
 */
export function computeSchemaDiffForPreview(
  oldSchema: ColumnSchema[],
  previewColumns: string[],
  previewData: any[][]
): void {
  const rowObjects = previewData.map((row) => {
    const obj: Record<string, any> = {};
    previewColumns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });

  const newSchema = SchemaEngine.createPhysicalSchema(rowObjects);
  const diff = SchemaEngine.compareSchemas(oldSchema, newSchema);
  DialogStore.importCsvState.schemaDiff.value = diff;
}

/**
 * Map a 2D array to DataRow objects using header mode logic.
 * Shared by CSV and Excel confirm paths.
 */
function mapRawDataToRows(
  rawData: unknown[][],
  headerMode: string,
  customHeaders: string[]
): { columns: string[]; data: DataRow[] } {
  let columns: string[];
  let dataRows: unknown[][];

  if (headerMode === 'first-row') {
    columns = customHeaders;
    dataRows = rawData.slice(1);
  } else if (headerMode === 'auto-generate') {
    columns = rawData[0]?.map((_, i) => `Column ${i + 1}`) || [];
    dataRows = rawData;
  } else {
    columns = customHeaders;
    dataRows = rawData;
  }

  const data = dataRows.map((row) => {
    const obj: DataRow = {};
    columns.forEach((col, i) => {
      obj[col] = (row as any[])[i];
    });
    return obj;
  });

  return { columns, data };
}

// ============================================================================
// Event Handlers
// ============================================================================

export function handleFileSelect(event: Event): void {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  showImportDialog(file);
  target.value = '';
}

export async function handleFileDrop(event: DragEvent): Promise<void> {
  AppStore.isDragging.value = false;

  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) return;
  const file = files[0];
  const fileName = file.name.toLowerCase();
  if (
    !fileName.endsWith('.csv') &&
    !fileName.endsWith('.tsv') &&
    !fileName.endsWith('.txt') &&
    !fileName.endsWith('.json') &&
    !fileName.endsWith('.xls') &&
    !fileName.endsWith('.xlsx') &&
    !fileName.endsWith('.ods')
  ) {
    await alert(i18n.t('import.dropFile', { ns: 'errors' }));
    return;
  }

  showImportDialog(file);
}

export async function handlePaste(event: ClipboardEvent): Promise<void> {
  if (isInInteractiveContext()) return;
  const clipboardData = event.clipboardData;
  if (!clipboardData) return;
  if (clipboardData.files && clipboardData.files.length > 0) {
    const file = clipboardData.files[0];
    const fn = file.name.toLowerCase();
    if (
      fn.endsWith('.csv') ||
      fn.endsWith('.tsv') ||
      fn.endsWith('.txt') ||
      fn.endsWith('.json') ||
      fn.endsWith('.xls') ||
      fn.endsWith('.xlsx') ||
      fn.endsWith('.ods') ||
      file.type === 'text/csv' ||
      file.type === 'application/json' ||
      file.type === 'text/plain' ||
      file.type === 'text/tab-separated-values' ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'application/vnd.ms-excel' ||
      file.type === 'application/vnd.oasis.opendocument.spreadsheet'
    ) {
      showImportDialog(file);
      return;
    }
  }
  const pastedText = clipboardData.getData('text');
  if (pastedText && pastedText.trim().length > 0) {
    const trimmed = pastedText.trim();
    const isLikelyJson =
      (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
      (trimmed.startsWith('{') && trimmed.endsWith('}'));
    const file = new File([pastedText], isLikelyJson ? 'Pasted Data.json' : 'Pasted Data.csv', {
      type: isLikelyJson ? 'application/json' : 'text/csv',
    });
    showImportDialog(file);
  }
}

export async function promptPaste(): Promise<void> {
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      const text = await navigator.clipboard.readText();
      if (text && text.trim().length > 0) {
        const trimmed = text.trim();
        const isLikelyJson =
          (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
          (trimmed.startsWith('{') && trimmed.endsWith('}'));
        const file = new File([text], isLikelyJson ? 'Pasted Data.json' : 'Pasted Data.csv', {
          type: isLikelyJson ? 'application/json' : 'text/csv',
        });
        showImportDialog(file);
      } else {
        await alert(i18n.t('import.clipboardEmpty', { ns: 'errors' }));
      }
    } else {
      await alert(i18n.t('import.clipboardNotSupported', { ns: 'errors' }));
    }
  } catch (err) {
    console.warn('Clipboard access denied:', err);
    await alert(i18n.t('import.pastePrompt', { ns: 'errors' }));
  }
}

// ============================================================================
// Import Dialog Functions
// ============================================================================

export async function showImportDialog(file: File): Promise<void> {
  if (!(await confirmLargeFileImport(file))) return;

  AppStore.importFileData.value = { file };

  const fileName = file.name.toLowerCase();

  if (fileName.endsWith('.json')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        handleJsonPreview(file, data);
      } catch (err) {
        handleCsvPreview(file);
      }
    };
    reader.readAsText(file);
  } else if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx') || fileName.endsWith('.ods')) {
    handleExcelPreview(file);
  } else {
    handleCsvPreview(file);
  }
}

/**
 * Routes a detected v2 workflow JSON to the workflow import dialog.
 */
function routeToWorkflowImport(data: any): void {
  const workflow = data as V2Workflow;
  const validation = validateV2Workflow(workflow);

  if (!validation.valid) {
    const messages = validation.errors.map((e) => e.message);
    alert(messages.join('\n'), i18n.t('notifications.workflowValidationTitle', { ns: 'common' }));
    return;
  }

  const sourceNames = Object.keys(workflow.sources);

  const wfState = DialogStore.workflowImportState;
  wfState.workflow.value = workflow;
  wfState.sourceNames.value = sourceNames;
  wfState.bindings.value = new Map();
  wfState.validationErrors.value = [];
  wfState.isProcessing.value = false;

  callbacks?.openDialog('workflow-import');
}

export function handleJsonPreview(file: File, data: any, path = ''): void {
  // Detect v2 workflow format → route to workflow import dialog
  if (!path && data?.formatVersion === 2 && data.sources && data.models) {
    routeToWorkflowImport(data);
    return;
  }

  const defaultName = file.name.replace(/\.json$/i, '');
  let resolvedData = data;

  if (path) {
    resolvedData = resolvePath(data, path);
  }

  const isValidArray =
    Array.isArray(resolvedData) &&
    resolvedData.length > 0 &&
    typeof resolvedData[0] === 'object' &&
    resolvedData[0] !== null;

  const previewLimit = AppStore.uxSettings.value.preview.rowLimit;
  const previewData = isValidArray ? resolvedData.slice(0, previewLimit) : [];
  const headers = isValidArray ? Object.keys(previewData[0]) : [];

  // Get previous flatten/serialize state from store
  const s = DialogStore.importCsvState;
  const prevFlatten = s.flattenJson.value;
  const prevSerialize = s.serializeNested.value;

  // Update DialogStore signals
  s.fileName.value = file.name;
  s.sourceName.value = defaultName;
  s.isJson.value = true;
  s.jsonPath.value = path;
  s.jsonRawValuePreview.value = resolvedData
    ? JSON.stringify(resolvedData, null, 2).slice(0, 1000)
    : '';
  s.suggestedJsonKeys.value = getSuggestedKeys(resolvedData);
  s.flattenJson.value = prevFlatten;
  s.serializeNested.value = prevSerialize !== false; // Default to true
  s.jsonData.value = isValidArray ? resolvedData : null;
  s.fullJsonData.value = data;
  s.delimiter.value = ',';
  s.headerMode.value = 'first-row';
  s.originalHeaders.value = headers;
  s.customHeaders.value = [...headers];
  s.duplicateWarning.value = '';
  s.previewHeaders.value = headers;
  s.previewDataRows.value = previewData.map((row: any) => headers.map((h) => row[h]));

  // If in replace mode, compute schema diff
  if (s.isReplaceMode.value) {
    const sourceId = s.targetSourceId.value;
    const source = AppStore.sources.value.find((src) => src.id === sourceId);
    if (source) {
      computeSchemaDiffForPreview(source.columns, headers, previewData);
    }
  }

  callbacks?.openDialog('import-csv');
}

export function updateJsonPath(): void {
  const s = DialogStore.importCsvState;
  const fullJsonData = s.fullJsonData.value;
  const jsonPath = s.jsonPath.value;
  const fileName = s.fileName.value;

  if (!fullJsonData) return;

  const fileMock = { name: fileName } as File;
  handleJsonPreview(fileMock, fullJsonData, jsonPath);
}

export function selectJsonPathSegment(segment: string): void {
  const currentPath = DialogStore.importCsvState.jsonPath.value;
  const newPath = currentPath ? `${currentPath}.${segment}` : segment;
  DialogStore.importCsvState.jsonPath.value = newPath;
  updateJsonPath();
}

export function resetJsonPath(): void {
  DialogStore.importCsvState.jsonPath.value = '';
  updateJsonPath();
}

export function handleCsvPreview(file: File): void {
  const previewLimit = AppStore.uxSettings.value.preview.rowLimit;

  // TODO: this file has three direct `Papa.parse(file, …)` call sites
  // (here, the full-import flow, and `updateImportPreview`). Extracting them
  // into testable service helpers — like `WorkflowImportService.parseSourceFile`
  // did — would let these handlers be tested without mocking PapaParse.
  Papa.parse(file, {
    preview: previewLimit,
    header: false,
    skipEmptyLines: true,
    complete: (previewResult) => {
      const data = previewResult.data as string[][];
      const firstRow = data[0] || [];
      const defaultName = file.name.replace(/\.(csv|tsv|txt)$/i, '');
      const initialHeaders = firstRow.map((cell, i) => cell || `Column ${i + 1}`);

      const s = DialogStore.importCsvState;
      s.fileName.value = file.name;
      s.sourceName.value = defaultName;
      s.isJson.value = false;
      s.delimiter.value = previewResult.meta.delimiter || ',';
      s.headerMode.value = 'first-row';
      s.originalHeaders.value = initialHeaders;
      s.customHeaders.value = initialHeaders;
      s.rawPreviewData.value = data;
      s.duplicateWarning.value = '';
      s.jsonData.value = null;
      s.fullJsonData.value = null;

      updateHeadersForPreview();

      // If in replace mode, compute schema diff
      if (s.isReplaceMode.value) {
        const sourceId = s.targetSourceId.value;
        const source = AppStore.sources.value.find((src) => src.id === sourceId);
        if (source) {
          computeSchemaDiffForPreview(
            source.columns,
            s.previewHeaders.value,
            s.previewDataRows.value
          );
        }
      }

      callbacks?.openDialog('import-csv');
    },
    error: async (error) => {
      console.error('CSV preview error:', error);
      await alert(i18n.t('import.csvError', { ns: 'errors', message: error.message }));
    },
  });
}

export async function handleExcelPreview(file: File): Promise<void> {
  const previewLimit = AppStore.uxSettings.value.preview.rowLimit;

  try {
    const buffer = await file.arrayBuffer();
    const { parseExcelPreview, parseExcelFile } = await import('../../../core/excel-parser');

    const preview = await parseExcelPreview(buffer, previewLimit);
    const data = preview.data;
    const firstRow = data[0] || [];
    const defaultName = file.name.replace(/\.(xlsx?|ods)$/i, '');
    const initialHeaders = (firstRow as unknown[]).map((cell, i) =>
      cell != null ? String(cell) : `Column ${i + 1}`
    );

    const s = DialogStore.importCsvState;
    s.fileName.value = file.name;
    s.sourceName.value = defaultName;
    s.isJson.value = false;
    s.isExcel.value = true;
    s.delimiter.value = ',';
    s.headerMode.value = 'first-row';
    s.originalHeaders.value = initialHeaders;
    s.customHeaders.value = initialHeaders;
    s.rawPreviewData.value = data;
    s.duplicateWarning.value = '';
    s.jsonData.value = null;
    s.fullJsonData.value = null;
    s.sheetNames.value = preview.sheetNames;
    s.selectedSheetIndex.value = 0;
    s.excelBuffer.value = buffer;

    // Parse full file and store for confirm step (no re-parse needed)
    const full = await parseExcelFile(buffer);
    s.excelData.value = full.data;

    updateHeadersForPreview();

    if (s.isReplaceMode.value) {
      const sourceId = s.targetSourceId.value;
      const source = AppStore.sources.value.find((src) => src.id === sourceId);
      if (source) {
        computeSchemaDiffForPreview(
          source.columns,
          s.previewHeaders.value,
          s.previewDataRows.value
        );
      }
    }

    callbacks?.openDialog('import-csv');
  } catch (error: any) {
    console.error('Excel preview error:', error);
    await alert(i18n.t('import.excelError', { ns: 'errors', message: error.message }));
  }
}

export async function handleSheetChange(sheetIndex: number): Promise<void> {
  const s = DialogStore.importCsvState;
  const buffer = s.excelBuffer.value;
  if (!buffer) return;

  const previewLimit = AppStore.uxSettings.value.preview.rowLimit;

  try {
    const { parseExcelPreview, parseExcelFile } = await import('../../../core/excel-parser');

    const preview = await parseExcelPreview(buffer, previewLimit, sheetIndex);
    const data = preview.data;
    const firstRow = data[0] || [];
    const initialHeaders = (firstRow as unknown[]).map((cell, i) =>
      cell != null ? String(cell) : `Column ${i + 1}`
    );

    s.selectedSheetIndex.value = sheetIndex;
    s.rawPreviewData.value = data;
    s.originalHeaders.value = initialHeaders;
    s.customHeaders.value = initialHeaders;
    s.headerMode.value = 'first-row';
    s.duplicateWarning.value = '';

    const full = await parseExcelFile(buffer, sheetIndex);
    s.excelData.value = full.data;

    updateHeadersForPreview();

    if (s.isReplaceMode.value) {
      const sourceId = s.targetSourceId.value;
      const source = AppStore.sources.value.find((src) => src.id === sourceId);
      if (source) {
        computeSchemaDiffForPreview(
          source.columns,
          s.previewHeaders.value,
          s.previewDataRows.value
        );
      }
    }
  } catch (error: any) {
    console.error('Excel sheet change error:', error);
    await alert(i18n.t('import.excelError', { ns: 'errors', message: error.message }));
  }
}

export function showImportUrlDialog(): void {
  DialogStore.importUrlState.url.value = '';
  DialogStore.importUrlState.isFetching.value = false;
  DialogStore.importUrlState.error.value = null;

  callbacks?.openDialog('import-url');
}

export async function fetchAndImportFromUrl(): Promise<void> {
  const { url } = DialogStore.importUrlState;
  const currentUrl = url.value;

  if (!currentUrl || currentUrl.trim() === '') {
    DialogStore.importUrlState.error.value = i18n.t('validation.required.url', { ns: 'errors' });
    return;
  }

  DialogStore.importUrlState.isFetching.value = true;
  DialogStore.importUrlState.error.value = null;

  try {
    const response = await fetch(currentUrl);
    if (!response.ok) {
      throw new Error(
        i18n.t('import.fetchError', {
          ns: 'errors',
          status: `${response.status} ${response.statusText}`,
        })
      );
    }

    const text = await response.text();
    if (!text || text.trim() === '') {
      throw new Error(i18n.t('import.emptyResponse', { ns: 'errors' }));
    }

    let fileName = 'Imported Data.csv';
    let fileType = 'text/csv';
    try {
      const urlObj = new URL(currentUrl);
      const pathParts = urlObj.pathname.split('/');
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart) {
        if (lastPart.toLowerCase().endsWith('.json')) {
          fileName = lastPart;
          fileType = 'application/json';
        } else if (
          lastPart.toLowerCase().endsWith('.csv') ||
          lastPart.toLowerCase().endsWith('.tsv') ||
          lastPart.toLowerCase().endsWith('.txt')
        ) {
          fileName = lastPart;
          if (lastPart.toLowerCase().endsWith('.tsv')) {
            fileType = 'text/tab-separated-values';
          }
        }
      }
    } catch (e) {
      // Fallback to default filename
    }

    const file = new File([text], fileName, { type: fileType });

    // Transition from import-url to import-csv without resetAll()
    // (closeDialog resets all dialog state, which would clear fromUrlImport)
    AppStore.activeDialog.value = null;
    AppStore.dialogSnapshot.value = null;
    DialogStore.importCsvState.fromUrlImport.value = true;
    showImportDialog(file);
  } catch (error: any) {
    console.error('URL import error:', error);
    DialogStore.importUrlState.error.value =
      error.message || i18n.t('import.fetchGenericError', { ns: 'errors' });
  } finally {
    DialogStore.importUrlState.isFetching.value = false;
  }
}

export function backToUrlImport(): void {
  const savedUrl = DialogStore.importUrlState.url.value;
  DialogStore.importCsvState.fromUrlImport.value = false;
  callbacks?.closeDialog(true);
  // Restore URL after closeDialog reset, then reopen import-url dialog
  DialogStore.importUrlState.url.value = savedUrl;
  callbacks?.openDialog('import-url');
}

export function confirmTextEntry(): void {
  const { text, isEditMode, targetSourceId } = DialogStore.importTextState;
  const rawText = text.value;

  if (!rawText || rawText.trim().length === 0) return;

  const trimmed = rawText.trim();
  const isLikelyJson =
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    (trimmed.startsWith('{') && trimmed.endsWith('}'));
  const file = new File([rawText], isLikelyJson ? 'Entered Data.json' : 'Entered Data.csv', {
    type: isLikelyJson ? 'application/json' : 'text/csv',
  });

  // Transition from import-text to import-csv without full resetAll
  AppStore.activeDialog.value = null;
  AppStore.dialogSnapshot.value = null;
  DialogStore.importCsvState.fromTextEntry.value = true;

  // If editing an existing source, set replace mode
  if (isEditMode.value && targetSourceId.value) {
    DialogStore.importCsvState.isReplaceMode.value = true;
    DialogStore.importCsvState.targetSourceId.value = targetSourceId.value;
    const source = AppStore.sources.value.find((s) => s.id === targetSourceId.value);
    if (source) {
      DialogStore.importCsvState.sourceName.value = source.name;
    }
  }

  showImportDialog(file);
}

export function showEditTextDialog(source: Source): void {
  if (!source.rawText) return;

  DialogStore.importTextState.text.value = source.rawText;
  DialogStore.importTextState.isEditMode.value = true;
  DialogStore.importTextState.targetSourceId.value = source.id;

  callbacks?.openDialog('import-text');
}

export function backToTextEntry(): void {
  const savedText = DialogStore.importTextState.text.value;
  const savedIsEditMode = DialogStore.importTextState.isEditMode.value;
  const savedTargetSourceId = DialogStore.importTextState.targetSourceId.value;

  DialogStore.importCsvState.fromTextEntry.value = false;
  callbacks?.closeDialog(true);

  // Restore text state after closeDialog reset, then reopen import-text dialog
  DialogStore.importTextState.text.value = savedText;
  DialogStore.importTextState.isEditMode.value = savedIsEditMode;
  DialogStore.importTextState.targetSourceId.value = savedTargetSourceId;
  callbacks?.openDialog('import-text');
}

export function showReplaceSourceDialog(source: Source): void {
  DialogStore.importCsvState.isReplaceMode.value = true;
  DialogStore.importCsvState.targetSourceId.value = source.id;
  DialogStore.importCsvState.sourceName.value = source.name;

  const input = document.getElementById('file-input') as HTMLInputElement;
  input?.click();
}

/**
 * After source creation/replacement via text entry, store the raw text on the source
 * so the user can later re-edit it.
 */
function setRawTextIfTextEntry(): void {
  if (!DialogStore.importCsvState.fromTextEntry.value) return;
  const rawText = DialogStore.importTextState.text.value;
  if (!rawText) return;

  // For new sources: the last source added is the one just created
  const sources = AppStore.sources.value;
  const source = sources[sources.length - 1];
  if (source) {
    source.rawText = rawText;
    AppStore.sources.value = [...sources];
  }
}

function setRawTextOnReplacedSource(sourceId: string): void {
  if (!DialogStore.importCsvState.fromTextEntry.value) return;
  const rawText = DialogStore.importTextState.text.value;
  if (!rawText) return;

  const source = AppStore.sources.value.find((s) => s.id === sourceId);
  if (source) {
    source.rawText = rawText;
    AppStore.sources.value = [...AppStore.sources.value];
  }
}

export async function confirmImport(): Promise<void> {
  const s = DialogStore.importCsvState;
  const headerMode = s.headerMode.value;
  const delimiter = s.delimiter.value;
  const customHeaders = s.customHeaders.value;
  const sourceName = s.sourceName.value;
  const isJson = s.isJson.value;
  const jsonData = s.jsonData.value;
  const flattenJsonFlag = s.flattenJson.value;
  const serializeNestedFlag = s.serializeNested.value;
  const importFileData = AppStore.importFileData.value;

  if (!importFileData) return;
  const file = importFileData.file;

  if (!sourceName || sourceName.trim() === '') {
    await alert(i18n.t('validation.required.sourceName', { ns: 'errors' }));
    return;
  }

  if (isJson && jsonData) {
    let processedData = jsonData;

    if (flattenJsonFlag) {
      processedData = flattenData(processedData);
    }

    if (serializeNestedFlag) {
      processedData = serializeNestedData(processedData);
    }

    const columns = processedData.length > 0 ? Object.keys(processedData[0]) : customHeaders;

    if (s.isReplaceMode.value) {
      const sourceId = s.targetSourceId.value!;
      const schemaDiff = s.schemaDiff.value;

      const executeReplacement = async () => {
        const fullColumns = SchemaEngine.createPhysicalSchema(processedData);
        await ReplaceSourceService.replaceSource(sourceId, processedData, fullColumns, {
          fileName: file.name,
          headerMode: 'first-row',
          delimiter: ',',
        });

        setRawTextOnReplacedSource(sourceId);
        s.isReplaceMode.value = false;
        s.targetSourceId.value = null;
        s.schemaDiff.value = null;
        callbacks?.closeDialog();
      };

      if (schemaDiff && schemaDiff.missingColumns.length > 0) {
        const msg = i18n.t('confirms.schemaDiffWarning', {
          ns: 'common',
          count: schemaDiff.missingColumns.length,
          columns: schemaDiff.missingColumns.join(', '),
        });
        const confirmed = await confirm(
          msg,
          i18n.t('confirms.confirmReplacement', { ns: 'common' }),
          i18n.t('buttons.replace', { ns: 'common' })
        );
        if (confirmed) {
          await executeReplacement();
        }
      } else {
        await executeReplacement();
      }
    } else {
      await callbacks?.createSource(
        file,
        sourceName.trim(),
        columns,
        processedData,
        'first-row',
        ',',
        columns,
        'json'
      );
      setRawTextIfTextEntry();
    }
    return;
  }

  // Excel: use pre-parsed data (no re-parse needed)
  const isExcel = s.isExcel.value;
  const excelData = s.excelData.value;

  if (isExcel && excelData) {
    if (excelData.length === 0) {
      await alert(
        i18n.t('import.excelError', {
          ns: 'errors',
          message: i18n.t('import.emptyExcelFile', { ns: 'errors' }),
        })
      );
      return;
    }

    const { columns, data } = mapRawDataToRows(excelData, headerMode, customHeaders);
    await finishImport(s, file, sourceName, columns, data, headerMode, delimiter, customHeaders);
    return;
  }

  Papa.parse(file, {
    header: false,
    delimiter: delimiter === '\t' ? '\t' : delimiter,
    skipEmptyLines: true,
    dynamicTyping: true,
    complete: async (results) => {
      const rawData = results.data as unknown[][];
      if (!rawData || rawData.length === 0) {
        await alert(
          i18n.t('import.csvError', {
            ns: 'errors',
            message: i18n.t('import.emptyCsvFile', { ns: 'errors' }),
          })
        );
        return;
      }

      const { columns, data } = mapRawDataToRows(rawData, headerMode, customHeaders);
      await finishImport(s, file, sourceName, columns, data, headerMode, delimiter, customHeaders);
    },
    error: async (error) => {
      console.error('CSV parsing error:', error);
      await alert(i18n.t('import.csvError', { ns: 'errors', message: error.message }));
    },
  });
}

/**
 * Shared logic for finishing CSV/Excel import (replace mode or new source).
 */
async function finishImport(
  s: typeof DialogStore.importCsvState,
  file: File,
  sourceName: string,
  columns: string[],
  data: DataRow[],
  headerMode: string,
  delimiter: string,
  customHeaders: string[]
): Promise<void> {
  if (s.isReplaceMode.value) {
    const sourceId = s.targetSourceId.value!;
    const schemaDiff = s.schemaDiff.value;

    const executeReplacement = async () => {
      const fullColumns = SchemaEngine.createPhysicalSchema(data);
      await ReplaceSourceService.replaceSource(sourceId, data, fullColumns, {
        fileName: file.name,
        headerMode,
        delimiter,
      });

      setRawTextOnReplacedSource(sourceId);
      s.isReplaceMode.value = false;
      s.targetSourceId.value = null;
      s.schemaDiff.value = null;
      callbacks?.closeDialog();
    };

    if (schemaDiff && schemaDiff.missingColumns.length > 0) {
      const msg = i18n.t('confirms.schemaDiffWarning', {
        ns: 'common',
        count: schemaDiff.missingColumns.length,
        columns: schemaDiff.missingColumns.join(', '),
      });
      const confirmed = await confirm(
        msg,
        i18n.t('confirms.confirmReplacement', { ns: 'common' }),
        i18n.t('buttons.replace', { ns: 'common' })
      );
      if (confirmed) {
        await executeReplacement();
      }
    } else {
      await executeReplacement();
    }
    return;
  }

  await callbacks?.createSource(
    file,
    sourceName.trim(),
    columns,
    data,
    headerMode,
    delimiter,
    customHeaders,
    s.isExcel.value ? 'excel' : undefined
  );
  setRawTextIfTextEntry();
}

export function updateImportPreview(): void {
  const importFileData = AppStore.importFileData.value;
  const delimiter = DialogStore.importCsvState.delimiter.value;

  if (!importFileData) return;
  const file = importFileData.file;

  Papa.parse(file, {
    preview: 5,
    header: false,
    skipEmptyLines: true,
    delimiter: delimiter === '\t' ? '\t' : delimiter,
    complete: (previewResult) => {
      const data = previewResult.data as string[][];
      const firstRow = data[0] || [];
      const newHeaders = firstRow.map((cell, i) => cell || `Column ${i + 1}`);

      const s = DialogStore.importCsvState;
      s.rawPreviewData.value = data;
      s.originalHeaders.value = newHeaders;
      s.customHeaders.value = newHeaders;
      updateHeadersForPreview();
    },
    error: async (error) => {
      console.error('CSV preview error:', error);
      await alert(i18n.t('import.csvError', { ns: 'errors', message: error.message }));
    },
  });
}

export function updateHeadersForPreview(): void {
  const s = DialogStore.importCsvState;
  const rawPreviewData = s.rawPreviewData.value;
  const headerMode = s.headerMode.value;
  const originalHeaders = s.originalHeaders.value;
  const customHeaders = s.customHeaders.value;
  const isJson = s.isJson.value;
  const jsonData = s.jsonData.value;
  const flattenJsonFlag = s.flattenJson.value;
  const serializeNestedFlag = s.serializeNested.value;

  if (isJson && jsonData) {
    const previewLimit = AppStore.uxSettings.value.preview.rowLimit;
    let processedData = jsonData.slice(0, previewLimit);

    if (flattenJsonFlag) {
      processedData = flattenData(processedData);
    }

    if (serializeNestedFlag) {
      processedData = serializeNestedData(processedData);
    }

    const headers = processedData.length > 0 ? Object.keys(processedData[0]) : customHeaders;
    const { resolvedHeaders, warning } = resolveDuplicateHeaders(headers);

    s.previewHeaders.value = resolvedHeaders;
    s.previewDataRows.value = processedData.map((row: any) => resolvedHeaders.map((h) => row[h]));
    s.duplicateWarning.value = warning;
    s.customHeaders.value = resolvedHeaders;
    return;
  }

  if (rawPreviewData.length === 0) {
    s.previewHeaders.value = [];
    s.previewDataRows.value = [];
    return;
  }

  let headers: string[] | undefined;
  let previewDataRows: any[][];

  if (headerMode === 'first-row') {
    headers = originalHeaders;
    previewDataRows = rawPreviewData.slice(1);
  } else if (headerMode === 'auto-generate') {
    const numCols = rawPreviewData[0]?.length || 0;
    headers = Array.from({ length: numCols }, (_, i) => `Column ${i + 1}`);
    previewDataRows = rawPreviewData;
  } else if (headerMode === 'manual') {
    headers = customHeaders;
    previewDataRows = rawPreviewData;
  } else {
    previewDataRows = rawPreviewData;
  }

  s.previewDataRows.value = previewDataRows;

  if (headers && headers.length > 0) {
    const { resolvedHeaders, warning } = resolveDuplicateHeaders(headers);

    s.previewHeaders.value = resolvedHeaders;
    s.duplicateWarning.value = warning;
    if (headerMode === 'first-row' || headerMode === 'manual') {
      s.customHeaders.value = resolvedHeaders;
    }
  }

  // Re-compute schema diff if in replace mode
  if (s.isReplaceMode.value) {
    const sourceId = s.targetSourceId.value;
    const source = AppStore.sources.value.find((src) => src.id === sourceId);
    if (source) {
      computeSchemaDiffForPreview(source.columns, s.previewHeaders.value, s.previewDataRows.value);
    }
  }
}
