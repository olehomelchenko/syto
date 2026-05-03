import Papa from 'papaparse';
import i18n from '../../i18n/core';
import { DialogStore } from '../stores/DialogStore';
import { WorkflowImportService } from '../services/WorkflowImportService';
import { updatePagination } from '../handlers/core/pagination-handlers';
import { closeDialog } from '../handlers/dialog/dialog-handlers';
import formStyles from './form-controls.module.css';
import styles from './WorkflowImportDialog.module.css';

export function WorkflowImportDialog() {
  const state = DialogStore.workflowImportState;
  const workflow = state.workflow.value;
  const sourceNames = state.sourceNames.value;
  const bindings = state.bindings.value;
  const validationErrors = state.validationErrors.value;
  const isProcessing = state.isProcessing.value;

  if (!workflow) return null;

  const allBound = sourceNames.every((name) => {
    const b = bindings.get(name);
    return b && b.data && !b.error;
  });

  // TODO: parsing + presentation entanglement. PapaParse is invoked from inside this
  // component, so the file-input flow can't be tested without mocking PapaParse, and
  // the parser/validator can't be reused outside the dialog. Extract a
  // `parseWorkflowSourceFile()` helper (or move the logic into WorkflowImportService)
  // so the component just dispatches and renders. Tracked under TESTING_PROGRESS.md
  // Session 3 — architectural mocking lift.
  const handleFilePick = (sourceName: string, file: File) => {
    const sourceDef = workflow.sources[sourceName];
    const delimiter = sourceDef.parsing?.delimiter || ',';

    Papa.parse(file, {
      header: true,
      delimiter,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        const data = results.data as any[];
        const columns = results.meta.fields || [];

        // Check column match
        const expectedCols = sourceDef.columns.map((c) => c.name);
        const missing = expectedCols.filter((c) => !columns.includes(c));
        const error =
          missing.length > 0
            ? i18n.t('dialogs:workflowImport.columnMismatch', {
                count: missing.length,
                columns: missing.join(', '),
              })
            : null;

        const newBindings = new Map(state.bindings.value);
        newBindings.set(sourceName, { file, data, columns, error });
        state.bindings.value = newBindings;
      },
      error: (err) => {
        const newBindings = new Map(state.bindings.value);
        newBindings.set(sourceName, { file, data: null, columns: null, error: err.message });
        state.bindings.value = newBindings;
      },
    });
  };

  const handleImport = async () => {
    state.isProcessing.value = true;
    try {
      const sourceData = new Map<string, any[]>();
      for (const [name, binding] of bindings) {
        if (binding.data) {
          sourceData.set(name, binding.data);
        }
      }
      await WorkflowImportService.importWorkflow(workflow, sourceData, {
        updatePagination,
        closeDialog: () => closeDialog(true),
      });
    } catch (err: any) {
      state.validationErrors.value = [err.message];
    } finally {
      state.isProcessing.value = false;
    }
  };

  return (
    <div class={styles.container}>
      {/* Workflow info */}
      <div class={formStyles.helpText}>
        <div>
          {i18n.t('dialogs:workflowImport.version')}: {workflow.sytoVersion}
        </div>
        <div>
          {i18n.t('dialogs:workflowImport.exported')}:{' '}
          {new Date(workflow.exportedAt).toLocaleDateString()}
        </div>
        <div>
          {i18n.t('dialogs:workflowImport.modelCount', {
            count: Object.keys(workflow.models).length,
          })}
        </div>
      </div>

      {/* Source bindings */}
      <div>
        <h4 class={styles.sourcesHeading}>{i18n.t('dialogs:workflowImport.sourcesTitle')}</h4>
        {sourceNames.map((name) => {
          const binding = bindings.get(name);
          const sourceDef = workflow.sources[name];
          const expectedCols = sourceDef.columns.length;

          return (
            <div key={name} class={styles.sourceRow}>
              <div class={styles.sourceName}>
                <strong>{name}</strong>
                <div class={formStyles.helpText}>
                  {expectedCols} {i18n.t('common:labels.columns').toLowerCase()}
                </div>
              </div>

              <div class={styles.sourceFile}>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={(e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handleFilePick(name, file);
                  }}
                />
                {binding?.data && !binding.error && (
                  <span class={styles.successText}>
                    {binding.data.length} {i18n.t('common:labels.rows').toLowerCase()}
                  </span>
                )}
                {binding?.error && <div class={styles.errorText}>{binding.error}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div class={styles.validationErrors}>
          {validationErrors.map((err, i) => (
            <div key={i}>{err}</div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div class={styles.actions}>
        <button class="button button--secondary" onClick={() => closeDialog(true)}>
          {i18n.t('common:buttons.cancel')}
        </button>
        <button
          class="button button--primary"
          onClick={handleImport}
          aria-disabled={!allBound || isProcessing || undefined}
        >
          {isProcessing ? i18n.t('common:statusBar.processing') : i18n.t('common:buttons.import')}
        </button>
      </div>
    </div>
  );
}
