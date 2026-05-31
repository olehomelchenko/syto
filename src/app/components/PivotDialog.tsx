import { signal, useComputed, useSignalEffect } from '@preact/signals';
import { useTranslation } from 'preact-i18next';
import { AppStore } from '../stores/AppStore';
import { useDialogState } from '../hooks/useDialogState';
import { useTransformPreview } from '../hooks/useTransformPreview';
import {
  computePivotPreview,
  countUniqueValues,
  type PivotOptions,
} from '../handlers/transform/pivot-handlers';
import { ColumnSelector } from './column-selector';
import formStyles from './form-controls.module.css';
import exprStyles from './expression-help.module.css';
const styles = { ...formStyles, ...exprStyles };
import type { PivotAggregation } from '../../types/modes';

// Re-export for backward compatibility
export type { PivotAggregation } from '../../types/modes';

export function PivotDialog() {
  const { t } = useTranslation('dialogs');
  const columns = AppStore.columns.value;

  const { state } = useDialogState(
    (ctx) => {
      const editing = ctx.editingStep?.pivot;
      return {
        rowColumns: signal<string[]>(editing?.rows ? [...editing.rows] : []),
        columnColumn: signal<string>(editing?.keys ?? ''),
        valueColumn: signal<string>(editing?.values ?? ''),
        aggregation: signal<PivotAggregation>((editing?.aggregation as PivotAggregation) ?? 'sum'),
        options: signal<PivotOptions>({
          sort: editing?.options?.sort ?? true,
          limit: editing?.options?.limit ?? null,
        }),
        uniqueValueCount: signal(0),
        isPreviewing: signal(false),
        previewError: signal<string | null>(null),
      };
    },
    {
      hasError: (s) => !s.columnColumn.value || !s.valueColumn.value,
      getState: (s) => ({
        rowColumns: s.rowColumns.value,
        columnColumn: s.columnColumn.value,
        valueColumn: s.valueColumn.value,
        aggregation: s.aggregation.value,
        options: s.options.value,
      }),
    }
  );

  const {
    rowColumns,
    columnColumn,
    valueColumn,
    aggregation,
    uniqueValueCount,
    options,
    isPreviewing,
    previewError,
  } = state;

  // Compute unique value count when columnColumn changes
  useSignalEffect(() => {
    uniqueValueCount.value = countUniqueValues(columnColumn.value);
  });

  // Pivot previews run on explicit button click rather than live on edit,
  // so we opt out of the hook's auto-trigger and drive `compute()` ourselves.
  const preview = useTransformPreview({
    autoTrigger: false,
    compute: () =>
      computePivotPreview(
        rowColumns.value,
        columnColumn.value,
        valueColumn.value,
        aggregation.value,
        options.value
      ),
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

  // Preview text computed in component to avoid complex templates
  const summaryText = useComputed(() => {
    if (!columnColumn.value || !valueColumn.value) return null;

    const grouping =
      rowColumns.value.length > 0
        ? t('pivot.groupedBy', { columns: rowColumns.value.join(', ') })
        : t('pivot.noRowGrouping');

    return (
      <div>
        <strong>{t('pivot.resultPrefix')}</strong> {grouping} {t('pivot.resultNewColumns')}{' '}
        <strong>{uniqueValueCount.value}</strong> {t('pivot.resultFrom')}{' '}
        <em>{columnColumn.value}</em>, {t('pivot.resultShowing')} <em>{aggregation.value}</em>{' '}
        {t('pivot.resultOf')} <em>{valueColumn.value}</em>
      </div>
    );
  });

  return (
    <div>
      {/* Inline Help */}
      <div class={styles.expressionHelp} style={{ marginBottom: '1rem' }}>
        <div class={styles.expressionHelpTitle}>
          <span>{t('pivot.help.title')}</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-dark-gray)', lineHeight: 1.8 }}>
          <p style={{ margin: 0 }}>{t('pivot.help.description')}</p>
          <div
            class={styles.exampleGrid}
            style={{ marginTop: '0.5rem', fontFamily: 'var(--font-family)' }}
          >
            <div>
              <strong>{t('pivot.help.exampleBefore')}</strong> {t('pivot.help.exampleBeforeValue')}
            </div>
            <div>
              <strong>{t('pivot.help.exampleAfter')}</strong> {t('pivot.help.exampleAfterValue')}
            </div>
          </div>
          <p style={{ margin: '0.25rem 0 0', fontStyle: 'italic', fontSize: '0.7rem' }}>
            {t('pivot.help.usage')}
          </p>
        </div>
      </div>

      {/* Main Layout */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
        {/* Row Columns */}
        <div class={styles.group}>
          <ColumnSelector
            columns={columns}
            selectedColumns={rowColumns.value}
            onSelectionChange={(selected) => (rowColumns.value = selected as string[])}
            mode="multi"
            display="chip"
            allowSelectAll={true}
            disabledColumns={[columnColumn.value, valueColumn.value].filter(Boolean)}
            maxHeight={200}
            label={t('pivot.rowsLabel')}
            helpText={t('pivot.rowsHelp')}
          />
        </div>

        {/* Columns & Values */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {/* Column Column */}
          <div class={styles.group}>
            <label class={styles.label}>{t('pivot.columnsLabel')}</label>
            <select
              class={styles.input}
              value={columnColumn.value}
              onChange={(e) => {
                columnColumn.value = (e.currentTarget as HTMLSelectElement).value;
              }}
              style={{ marginBottom: '0.5rem' }}
            >
              <option value="">{t('pivot.selectColumn')}</option>
              {columns.map((col) => (
                <option
                  key={col}
                  value={col}
                  disabled={rowColumns.value.includes(col) || valueColumn.value === col}
                >
                  {col}
                </option>
              ))}
            </select>
            {columnColumn.value && (
              <div
                style={{
                  fontSize: '0.75rem',
                  padding: '0.5rem',
                  background: 'var(--color-soft-bg)',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color)',
                }}
              >
                {t('pivot.uniqueValues', { count: uniqueValueCount.value })}
                {uniqueValueCount.value > 50 && (
                  <span style={{ color: 'var(--color-red)' }}> {t('pivot.manyColumns')}</span>
                )}
              </div>
            )}
            <p class={styles.helpText} style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>
              {t('pivot.columnsHelp')}
            </p>
          </div>

          {/* Value Column */}
          <div class={styles.group}>
            <label class={styles.label}>{t('pivot.valuesLabel')}</label>
            <select
              class={styles.input}
              value={valueColumn.value}
              onChange={(e) => {
                valueColumn.value = (e.currentTarget as HTMLSelectElement).value;
              }}
              style={{ marginBottom: '0.5rem' }}
            >
              <option value="">{t('pivot.selectColumn')}</option>
              {columns.map((col) => (
                <option
                  key={col}
                  value={col}
                  disabled={rowColumns.value.includes(col) || columnColumn.value === col}
                >
                  {col}
                </option>
              ))}
            </select>
            <select
              class={styles.input}
              value={aggregation.value}
              onChange={(e) => {
                aggregation.value = (e.currentTarget as HTMLSelectElement)
                  .value as PivotAggregation;
              }}
              disabled={!valueColumn.value}
            >
              <option value="sum">{t('pivot.aggregations.sum')}</option>
              <option value="mean">{t('pivot.aggregations.mean')}</option>
              <option value="count">{t('pivot.aggregations.count')}</option>
              <option value="min">{t('pivot.aggregations.min')}</option>
              <option value="max">{t('pivot.aggregations.max')}</option>
              <option value="any">{t('pivot.aggregations.any')}</option>
            </select>
            <p class={styles.helpText} style={{ fontSize: '0.7rem', marginTop: '0.25rem' }}>
              {t('pivot.valuesHelp')}
            </p>
          </div>
        </div>
      </div>

      {/* Summary info */}
      {summaryText.value && <div class={styles.expressionHelp}>{summaryText.value}</div>}

      {/* Advanced Options */}
      <details style={{ marginBottom: '1rem' }}>
        <summary style={{ cursor: 'pointer', fontWeight: 500, marginBottom: '0.5rem' }}>
          {t('pivot.advanced.title')}
        </summary>
        <div
          style={{
            padding: '0.75rem',
            border: '1px solid var(--border-color)',
            borderRadius: '4px',
          }}
        >
          <label class={styles.checkboxLabel} style={{ marginBottom: '0.5rem' }}>
            <input
              type="checkbox"
              checked={options.value.sort}
              onChange={(e) => {
                options.value = { ...options.value, sort: (e.target as HTMLInputElement).checked };
              }}
            />
            <span>{t('pivot.advanced.sortColumns')}</span>
          </label>
          <div class={styles.group} style={{ marginTop: '0.5rem' }}>
            <label class={styles.label} style={{ fontSize: '0.85rem' }}>
              {t('pivot.advanced.limitLabel')}
            </label>
            <input
              type="number"
              class={styles.input}
              value={options.value.limit || ''}
              onInput={(e) => {
                const val = (e.target as HTMLInputElement).value;
                const newLimit = val ? parseInt(val) : null;
                options.value = { ...options.value, limit: newLimit };
              }}
              placeholder={t('pivot.advanced.limitPlaceholder')}
              min="1"
              style={{ width: '120px' }}
            />
            <p class={styles.helpText} style={{ fontSize: '0.75rem' }}>
              {t('pivot.advanced.limitHelp')}
            </p>
          </div>
        </div>
      </details>

      <div class={styles.group} style={{ marginTop: '1rem' }}>
        <button
          type="button"
          class="button button--secondary"
          onClick={handlePreviewClick}
          disabled={isPreviewing.value || !columnColumn.value || !valueColumn.value}
        >
          {isPreviewing.value ? t('pivot.previewing') : t('pivot.previewButton')}
        </button>
      </div>

      {previewError.value && <div class={styles.error}>{previewError.value}</div>}
    </div>
  );
}
