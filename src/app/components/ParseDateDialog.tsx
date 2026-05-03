/**
 * ParseDateDialog - Parse date strings into date values using a format pattern
 */

import { signal } from '@preact/signals';
import { useTranslation } from 'preact-i18next';
import formStyles from './form-controls.module.css';
import exprStyles from './expression-help.module.css';
const styles = { ...formStyles, ...exprStyles };
import { AppStore } from '../stores/AppStore';
import { useDialogState } from '../hooks/useDialogState';
import { useTransformPreview } from '../hooks/useTransformPreview';
import { ColumnSelector } from './column-selector';
import {
  getStringColumns,
  getCommonFormats,
  getSampleValue,
  computeParseDatePreview,
} from '../handlers/transform/parse-date-handlers';

export function ParseDateDialog() {
  const { t } = useTranslation('dialogs');

  const stringColumns = getStringColumns();

  const { state } = useDialogState(
    () => {
      const selectedColumn = AppStore.selectedColumn.value;
      const initialColumn =
        selectedColumn && stringColumns.includes(selectedColumn)
          ? selectedColumn
          : stringColumns[0] || '';
      return {
        column: signal(initialColumn),
        format: signal(''),
        error: signal<string | null>(null),
      };
    },
    {
      hasError: (s) => !s.column.value || !s.format.value,
      getState: (s) => ({
        column: s.column.value,
        format: s.format.value,
      }),
    }
  );

  const { column, format, error } = state;

  useTransformPreview({
    deps: () => {
      column.value;
      format.value;
    },
    compute: () => {
      error.value = null;
      if (!column.value || !format.value) return null;
      return computeParseDatePreview(column.value, format.value);
    },
    onError: (err) => {
      error.value = err.message;
    },
  });

  const commonFormatsRaw = getCommonFormats();

  // TODO: format/i18n drift — `getCommonFormats()` returns 10 presets but only 4 are
  // re-labelled below (us, eu, usTime, euTime). The remaining six fall through with
  // their raw token strings. Conversely, the `parseDate.formats.iso` and
  // `parseDate.formats.unix` keys are defined but unreachable: `getCommonFormats()`
  // doesn't emit `'YYYY-MM-DD'` or `'timestamp'` as preset values, so the `iso` and
  // `unix` entries below never resolve. Either align the preset list with the i18n
  // keys, or drop the unused keys.
  const formatKeyMap: Record<string, string> = {
    'YYYY-MM-DD': 'iso',
    'MM/DD/YYYY': 'us',
    'DD/MM/YYYY': 'eu',
    'MM/DD/YYYY HH:mm': 'usTime',
    'DD/MM/YYYY HH:mm': 'euTime',
    timestamp: 'unix',
  };

  const commonFormats = commonFormatsRaw.map((fmt) => ({
    ...fmt,
    label: formatKeyMap[fmt.value] ? t(`parseDate.formats.${formatKeyMap[fmt.value]}`) : fmt.value,
  }));

  const sampleValue = column.value ? getSampleValue(column.value) : '';

  return (
    <div>
      {/* Source Column */}
      <div class={styles.group}>
        <ColumnSelector
          columns={stringColumns}
          selectedColumns={column.value}
          onSelectionChange={(col) => (column.value = col as string)}
          mode="single"
          display="chip"
          gridColumns={2}
          label={t('parseDate.sourceColumnLabel')}
          helpText={stringColumns.length === 0 ? t('parseDate.noColumnsHelp') : undefined}
        />
      </div>

      {column.value && (
        <>
          {/* Sample value hint */}
          {sampleValue && (
            <div class={styles.group}>
              <div class={styles.expressionHelp} style={{ marginTop: 0 }}>
                <div class={styles.expressionHelpTitle} style={{ display: 'block' }}>
                  {t('parseDate.sampleValueLabel')}
                </div>
                <div
                  style={{
                    fontSize: '0.8125rem',
                    fontFamily: 'var(--font-family-mono)',
                    color: 'var(--color-text)',
                  }}
                >
                  {sampleValue}
                </div>
              </div>
            </div>
          )}

          {/* Format presets */}
          <div class={styles.group}>
            <label class={styles.label}>{t('parseDate.formatLabel')}</label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '0.375rem',
                marginBottom: '0.75rem',
              }}
            >
              {commonFormats.map((fmt) => (
                <button
                  key={fmt.value}
                  type="button"
                  class={`${styles.toggleButton} ${format.value === fmt.value ? styles.active : ''}`}
                  style={{ justifyContent: 'center', fontSize: '0.75rem' }}
                  onClick={() => (format.value = fmt.value)}
                  title={`Example: ${fmt.example}`}
                >
                  {fmt.label}
                </button>
              ))}
            </div>

            {/* Custom format input */}
            <input
              type="text"
              class={styles.input}
              placeholder={t('parseDate.formatPlaceholder')}
              value={format.value}
              onInput={(e) => (format.value = (e.target as HTMLInputElement).value)}
            />
            <div class={styles.helpText}>{t('parseDate.formatHelp')}</div>
          </div>
        </>
      )}

      {/* Error message */}
      {error.value && <div class={styles.error}>{error.value}</div>}
    </div>
  );
}
