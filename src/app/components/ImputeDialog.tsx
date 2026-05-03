import * as aq from 'arquero';
import { signal, useSignalEffect } from '@preact/signals';
import { useTranslation } from 'preact-i18next';
import { AppStore } from '../stores/AppStore';
import { useDialogState } from '../hooks/useDialogState';
import { applyTransform } from '../../core/transforms';
import type { ImputeStrategy } from '../../types/modes';
import formStyles from './form-controls.module.css';
import prevStyles from './preview-table.module.css';
const styles = { ...formStyles, ...prevStyles };

/**
 * ImputeDialog
 *
 * UI for filling missing values (null, NaN) using various strategies.
 */
export function ImputeDialog() {
  const { t } = useTranslation('dialogs');
  const columns = AppStore.columns.value;
  const model = AppStore.activeModel.value;
  const schema = model?.schema || [];

  const { state } = useDialogState(
    (ctx) => {
      const editing = ctx.editingStep?.impute;
      const effectiveColumn = editing?.column ?? ctx.selectedColumns[0] ?? ctx.columns[0] ?? '';
      return {
        column: signal<string>(effectiveColumn),
        strategy: signal<ImputeStrategy>(editing?.strategy ?? 'constant'),
        value: signal<string>(editing?.value || ''),
        includeEmptyString: signal<boolean>(editing?.includeEmptyString ?? false),
        previewRows: signal<any[] | null>(null),
        error: signal<string | null>(null),
      };
    },
    {
      hasError: (s) =>
        !s.column.value || (s.strategy.value === 'constant' && !s.value.value?.trim()),
      getState: (s) => ({
        column: s.column.value,
        strategy: s.strategy.value,
        value: s.value.value,
        includeEmptyString: s.includeEmptyString.value,
      }),
    }
  );

  // Reactive mock preview (not using useTransformPreview since this is a mock, not real data)
  useSignalEffect(() => {
    const strategy = state.strategy.value;
    const value = state.value.value;
    const includeEmptyString = state.includeEmptyString.value;
    try {
      // TODO: this preview runs against a hardcoded 8-row mock table, not the user's
      // `AppStore.currentData`. As a result, the "Strategy preview" panel always shows
      // the same example regardless of the dataset being imputed — surprising for users
      // and a divergence from how every other dialog previews. Consider sampling from
      // the real column (with synthesised nulls if the column has none) so the preview
      // reflects what the user is about to apply.
      const mockData = [
        { val: 10 },
        { val: null },
        { val: 30 },
        { val: null },
        { val: 50 },
        { val: 60 },
        { val: '' },
        { val: 80 },
      ];
      const sampleTable = aq.from(mockData);
      const transform = {
        impute: {
          column: 'val',
          strategy,
          value: strategy === 'constant' ? value : undefined,
          includeEmptyString,
        },
      };
      const resultTable = applyTransform(sampleTable, transform, ['val']);
      const resultRows = resultTable.objects();
      state.previewRows.value = mockData.map((orig: any, i: number) => {
        const resVal = resultRows[i] ? resultRows[i].val : orig.val;
        return {
          _index: i,
          original: orig.val,
          imputed: resVal,
          isImputed: orig.val !== resVal,
        };
      });
    } catch (e) {
      console.error('Impute preview error:', e);
      state.previewRows.value = null;
    }
  });

  const selectedColSchema = schema.find((s) => s.name === state.column.value);
  const isNumeric = selectedColSchema?.type === 'integer' || selectedColSchema?.type === 'float';

  const strategies = [
    // Row 1
    {
      id: 'constant',
      label: t('impute.strategies.constant'),
      icon: 'material-symbols-light:format-quote-rounded',
      numericOnly: false,
    },
    {
      id: 'mean',
      label: t('impute.strategies.mean'),
      icon: 'material-symbols-light:average-rounded',
      numericOnly: true,
    },
    {
      id: 'min',
      label: t('impute.strategies.min'),
      icon: 'material-symbols-light:vertical-align-bottom-rounded',
      numericOnly: true,
    },
    {
      id: 'forwardFill',
      label: t('impute.strategies.forwardFill'),
      icon: 'material-symbols-light:arrow-downward-rounded',
      numericOnly: false,
    },
    // Row 2
    {
      id: 'linearInterpolation',
      label: t('impute.strategies.linear'),
      icon: 'material-symbols-light:show-chart-rounded',
      numericOnly: true,
    },
    {
      id: 'median',
      label: t('impute.strategies.median'),
      icon: 'material-symbols-light:equalizer-rounded',
      numericOnly: true,
    },
    {
      id: 'max',
      label: t('impute.strategies.max'),
      icon: 'material-symbols-light:vertical-align-top-rounded',
      numericOnly: true,
    },
    {
      id: 'backwardFill',
      label: t('impute.strategies.backwardFill'),
      icon: 'material-symbols-light:arrow-upward-rounded',
      numericOnly: false,
    },
  ];

  const handleColumnChange = (e: any) => {
    state.column.value = e.target.value;
  };

  const handleStrategyChange = (id: string) => {
    state.strategy.value = id as any;
  };

  const handleValueChange = (e: any) => {
    state.value.value = e.target.value;
  };

  return (
    <div className={styles.dialogContent}>
      <div className={styles.group}>
        <label className={styles.label}>{t('impute.columnLabel')}</label>
        <select className={styles.input} value={state.column.value} onChange={handleColumnChange}>
          {columns.map((col) => (
            <option key={col} value={col}>
              {col}
            </option>
          ))}
        </select>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '4px',
          }}
        >
          <p className={styles.helpText}>{t('impute.columnHelp')}</p>
          <span
            style={{
              fontSize: '10px',
              color: 'var(--color-dark-gray)',
              background: 'var(--color-light-gray)',
              padding: '2px 4px',
              borderRadius: '3px',
            }}
          >
            {t('impute.typeLabel', { type: selectedColSchema?.type || 'unknown' })}
          </span>
        </div>
      </div>

      <div className={styles.group}>
        <label className={styles.label}>{t('impute.strategyLabel')}</label>
        <div className={styles.chipGrid4}>
          {strategies.map((s) => {
            const disabled = s.numericOnly && !isNumeric;
            return (
              <div
                key={s.id}
                className={`${styles.chip} ${state.strategy.value === s.id ? styles.active : ''} ${disabled ? styles.unselected : ''}`}
                onClick={() => !disabled && handleStrategyChange(s.id)}
                title={disabled ? t('impute.numericOnlyHint') : ''}
                style={{
                  opacity: disabled ? 0.5 : 1,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
              >
                <span className={`iconify ${styles.chipIcon}`} data-icon={s.icon} />
                <span style={{ fontSize: '11px', textAlign: 'center' }}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {(state.strategy.value === 'forwardFill' ||
        state.strategy.value === 'backwardFill' ||
        state.strategy.value === 'linearInterpolation') && (
        <p className={styles.helpText} style={{ marginTop: 0 }}>
          {t('impute.orderDependentHint')}
        </p>
      )}

      <div className={styles.group}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={state.includeEmptyString.value}
            onChange={(e) => (state.includeEmptyString.value = e.currentTarget.checked)}
          />
          <span>{t('impute.includeEmptyString')}</span>
        </label>
        <p className={styles.helpText} style={{ marginLeft: '24px' }}>
          {t('impute.includeEmptyStringHelp')}
        </p>
      </div>

      {state.strategy.value === 'constant' && (
        <div className={styles.group}>
          <label className={styles.label}>{t('impute.replacementValue')}</label>
          <input
            type="text"
            className={styles.input}
            value={state.value.value}
            onInput={handleValueChange}
            placeholder={t('impute.replacementPlaceholder')}
            autoFocus
          />
          <p className={styles.helpText}>{t('impute.replacementHelp')}</p>
        </div>
      )}

      {state.previewRows.value && (
        <div className={styles.group}>
          <label className={styles.label}>{t('impute.previewTitle')}</label>
          <div className={styles.previewScroll}>
            <table className={styles.previewTable}>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>#</th>
                  <th>{t('impute.preview.original')}</th>
                  <th>{t('impute.preview.imputed')}</th>
                </tr>
              </thead>
              <tbody>
                {state.previewRows.value.map((row) => (
                  <tr key={row._index}>
                    <td style={{ color: 'var(--color-dark-gray)' }}>{row._index + 1}</td>
                    <td
                      style={{
                        color:
                          row.original === null || row.original === ''
                            ? 'var(--color-dark-red)'
                            : 'inherit',
                        fontStyle:
                          row.original === null || row.original === '' ? 'italic' : 'normal',
                      }}
                    >
                      {row.original === null
                        ? 'null'
                        : row.original === ''
                          ? '""'
                          : String(row.original)}
                    </td>
                    <td
                      style={{
                        backgroundColor: row.isImputed
                          ? 'rgba(var(--color-cyan-rgb), 0.1)'
                          : 'transparent',
                        fontWeight: row.isImputed ? '600' : '400',
                        color: row.isImputed ? 'var(--color-cyan)' : 'inherit',
                      }}
                    >
                      {row.imputed === null ? 'null' : String(row.imputed)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {state.error.value && (
        <div className={styles.error}>
          <span className="iconify" data-icon="material-symbols-light:error-outline-rounded" />
          <span>{state.error.value}</span>
        </div>
      )}
    </div>
  );
}
