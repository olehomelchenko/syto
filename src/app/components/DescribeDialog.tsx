import { signal } from '@preact/signals';
import { useTranslation } from 'preact-i18next';
import { AppStore } from '../stores/AppStore';
import { useDialogState } from '../hooks/useDialogState';
import { useTransformPreview } from '../hooks/useTransformPreview';
import { computeDescribePreview } from '../handlers/transform/describe-handlers';
import { ColumnSelector } from './column-selector';
import formStyles from './form-controls.module.css';
import exprStyles from './expression-help.module.css';
const styles = { ...formStyles, ...exprStyles };

export function DescribeDialog() {
  const { t } = useTranslation('dialogs');
  const columns = AppStore.columns.value;

  const { state } = useDialogState(
    (ctx) => {
      const editing = ctx.editingStep?.describe;
      const initialColumns = editing
        ? [...editing.columns]
        : ctx.schema.filter((c) => ['integer', 'float'].includes(c.type)).map((c) => c.name);
      return {
        selectedColumns: signal<string[]>(initialColumns),
        isPreviewing: signal(false),
        previewError: signal<string | null>(null),
      };
    },
    {
      hasError: (s) => s.selectedColumns.value.length === 0,
      getState: (s) => ({
        selectedColumns: s.selectedColumns.value,
      }),
    }
  );

  const { selectedColumns, isPreviewing, previewError } = state;

  // Describe previews run on explicit button click rather than live on edit,
  // so we opt out of the hook's auto-trigger and drive `compute()` ourselves.
  const preview = useTransformPreview({
    autoTrigger: false,
    compute: () => computeDescribePreview(selectedColumns.value),
    onError: (error) => {
      previewError.value = error.message;
    },
  });

  const handlePreviewClick = () => {
    isPreviewing.value = true;
    previewError.value = null;
    try {
      preview.compute();
    } finally {
      isPreviewing.value = false;
    }
  };

  return (
    <div>
      <div class={styles.group}>
        <ColumnSelector
          columns={columns}
          selectedColumns={selectedColumns.value}
          onSelectionChange={(selected) => (selectedColumns.value = selected as string[])}
          mode="multi"
          display="chip"
          allowSelectAll={true}
          label={t('describe.columnsLabel')}
          helpText={t('describe.columnsHelp')}
          searchable
        />
      </div>

      <div class={styles.expressionHelp}>
        <div class={styles.expressionHelpTitle}>
          <span>{t('describe.help.title')}</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-dark-gray)', lineHeight: 1.8 }}>
          <p style={{ margin: '0 0 0.5rem' }}>{t('describe.help.description')}</p>

          <strong>{t('describe.help.allTitle')}</strong>
          <div class={styles.exampleGrid}>
            <div>
              <code class={styles.exampleCode}>count</code>
            </div>
            <div class={styles.exampleDescription}>{t('describe.help.countDesc')}</div>
            <div>
              <code class={styles.exampleCode}>unique</code>
            </div>
            <div class={styles.exampleDescription}>{t('describe.help.uniqueDesc')}</div>
          </div>

          <strong>{t('describe.help.numericTitle')}</strong>
          <div class={styles.exampleGrid}>
            <div>
              <code class={styles.exampleCode}>mean</code>
            </div>
            <div class={styles.exampleDescription}>{t('describe.help.meanDesc')}</div>
            <div>
              <code class={styles.exampleCode}>median</code>
            </div>
            <div class={styles.exampleDescription}>{t('describe.help.medianDesc')}</div>
            <div>
              <code class={styles.exampleCode}>stdev</code>
            </div>
            <div class={styles.exampleDescription}>{t('describe.help.stdevDesc')}</div>
            <div>
              <code class={styles.exampleCode}>min / max</code>
            </div>
            <div class={styles.exampleDescription}>{t('describe.help.minMaxDesc')}</div>
          </div>

          <strong>{t('describe.help.categoricalTitle')}</strong>
          <div class={styles.exampleGrid}>
            <div>
              <code class={styles.exampleCode}>top</code>
            </div>
            <div class={styles.exampleDescription}>{t('describe.help.topDesc')}</div>
            <div>
              <code class={styles.exampleCode}>freq</code>
            </div>
            <div class={styles.exampleDescription}>{t('describe.help.freqDesc')}</div>
          </div>
        </div>
      </div>

      <div class={styles.group} style={{ marginTop: '1rem' }}>
        <button
          class="button button--secondary"
          onClick={handlePreviewClick}
          disabled={isPreviewing.value}
        >
          {isPreviewing.value ? t('describe.previewing') : t('describe.previewButton')}
        </button>
      </div>

      {previewError.value && <div class={styles.error}>{previewError.value}</div>}
    </div>
  );
}
