import { signal } from '@preact/signals';
import { useTranslation } from 'preact-i18next';
import { AppStore } from '../stores/AppStore';
import { useDialogState } from '../hooks/useDialogState';
import { useTransformPreview } from '../hooks/useTransformPreview';
import {
  computeWindowPreview,
  consumeWindowPreset,
  parseWindowDeriveToFunctions,
  type WindowFunction,
  type OrderByItem,
} from '../handlers/transform/window-handlers';
import { ColumnSelector } from './column-selector';
import formStyles from './form-controls.module.css';
import winStyles from './WindowDialog.module.css';
import aggStyles from './AggregateDialog.module.css';
import exprStyles from './expression-help.module.css';
const styles = { ...formStyles, ...winStyles, ...aggStyles, ...exprStyles };
import {
  AGGREGATE_FUNCTIONS,
  COLUMN_REQUIRED_FUNCTIONS,
} from '../../core/transforms/window-constants';

/** Window functions that use the offset parameter */
const OFFSET_FUNCTIONS = ['lag', 'lead', 'ntile', 'nth_value'];

/** Window functions that can have a default value */
const DEFAULT_VALUE_FUNCTIONS = ['lag', 'lead'];

export function WindowDialog() {
  const { t } = useTranslation('dialogs');
  const columns = AppStore.columns.value;

  const { state } = useDialogState(
    (ctx) => {
      const editing = ctx.editingStep?.window;
      const preset = consumeWindowPreset();

      const initialOrderBy: OrderByItem[] = editing ? [...editing.orderBy] : [];
      const initialPartitionBy: string[] = editing ? [...(editing.partitionBy || [])] : [];
      const initialWindowFunctions: WindowFunction[] = editing
        ? parseWindowDeriveToFunctions(editing.derive, editing.frames)
        : preset || [];

      return {
        orderBy: signal<OrderByItem[]>(initialOrderBy),
        partitionBy: signal<string[]>(initialPartitionBy),
        windowFunctions: signal<WindowFunction[]>(initialWindowFunctions),
        isPreviewing: signal(false),
        previewError: signal<string | null>(null),
      };
    },
    {
      hasError: (s) =>
        s.orderBy.value.filter((o) => o.field !== '').length === 0 ||
        s.windowFunctions.value.length === 0,
      getState: (s) => ({
        orderBy: s.orderBy.value,
        partitionBy: s.partitionBy.value,
        windowFunctions: s.windowFunctions.value,
      }),
    }
  );

  const { orderBy, partitionBy, windowFunctions, isPreviewing, previewError } = state;

  // Window previews run on explicit button click rather than live on edit,
  // so we opt out of the hook's auto-trigger and drive `compute()` ourselves.
  const preview = useTransformPreview({
    autoTrigger: false,
    compute: () => computeWindowPreview(orderBy.value, partitionBy.value, windowFunctions.value),
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

  const functionCategories = [
    {
      label: t('window.functionCategories.ranking'),
      functions: [
        'row_number',
        'rank',
        'dense_rank',
        'avg_rank',
        'percent_rank',
        'cume_dist',
        'ntile',
      ],
    },
    {
      label: t('window.functionCategories.positional'),
      functions: ['lag', 'lead', 'first_value', 'last_value', 'nth_value'],
    },
    {
      label: t('window.functionCategories.fill'),
      functions: ['fill_down', 'fill_up'],
    },
    {
      label: t('window.functionCategories.runningAggregate'),
      functions: [
        'sum',
        'mean',
        'min',
        'max',
        'count',
        'median',
        'mode',
        'product',
        'stdev',
        'variance',
      ],
    },
  ];

  const updateOrderBy = (index: number, field: keyof OrderByItem, value: string) => {
    const newOrderBy = [...orderBy.value];
    newOrderBy[index] = { ...newOrderBy[index], [field]: value };
    orderBy.value = newOrderBy;
  };

  const removeOrderBy = (index: number) => {
    orderBy.value = orderBy.value.filter((_, i) => i !== index);
  };

  const addOrderBy = () => {
    orderBy.value = [...orderBy.value, { field: '', order: 'asc' }];
  };

  const updateWindowFunction = (index: number, field: keyof WindowFunction, value: any) => {
    const newFuncs = [...windowFunctions.value];
    newFuncs[index] = { ...newFuncs[index], [field]: value };

    // Auto-generate output name when function or column changes
    if (field === 'func' || field === 'sourceCol') {
      const wf = newFuncs[index];
      if (!wf.output || wf.output.startsWith('window_')) {
        const funcName = wf.func;
        const colPart = wf.sourceCol ? `_${wf.sourceCol}` : '';
        newFuncs[index].output = `${funcName}${colPart}`;
      }
    }

    // Reset frame to cumulative default when switching to an aggregate function
    if (field === 'func' && AGGREGATE_FUNCTIONS.includes(value as string)) {
      newFuncs[index].frameStart = null;
      newFuncs[index].frameEnd = 0;
    }

    windowFunctions.value = newFuncs;
  };

  const removeWindowFunction = (index: number) => {
    windowFunctions.value = windowFunctions.value.filter((_, i) => i !== index);
  };

  const addWindowFunction = () => {
    windowFunctions.value = [
      ...windowFunctions.value,
      {
        func: 'row_number',
        sourceCol: '',
        offset: 1,
        defaultValue: '',
        output: '',
        frameStart: null,
        frameEnd: 0,
      },
    ];
  };

  return (
    <div>
      {/* Order By Section */}
      <div class={styles.group}>
        <label class={styles.label}>{t('window.orderByLabel')}</label>
        <p class={styles.helpText}>{t('window.orderByHelp')}</p>

        <div style={{ marginBottom: '0.5rem' }}>
          {orderBy.value.map((item, index) => (
            <div key={index} class={styles.aggregationRow}>
              <select
                class={styles.input}
                style={{ flex: 2 }}
                value={item.field}
                onChange={(e) =>
                  updateOrderBy(index, 'field', (e.target as HTMLSelectElement).value)
                }
              >
                <option value="">{t('window.selectColumn')}</option>
                {columns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>

              <select
                class={styles.input}
                style={{ width: '120px' }}
                value={item.order}
                onChange={(e) =>
                  updateOrderBy(index, 'order', (e.target as HTMLSelectElement).value)
                }
              >
                <option value="asc">{t('window.ascending')}</option>
                <option value="desc">{t('window.descending')}</option>
              </select>

              <button
                class="button button--secondary button--small"
                onClick={() => removeOrderBy(index)}
                title={t('window.remove')}
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button class="button button--secondary button--small" onClick={addOrderBy}>
          {t('window.addOrderColumn')}
        </button>
      </div>

      {/* Partition By Section */}
      <div class={styles.group}>
        <ColumnSelector
          columns={columns}
          selectedColumns={partitionBy.value}
          onSelectionChange={(selected) => (partitionBy.value = selected as string[])}
          mode="multi"
          display="chip"
          allowSelectAll={false}
          label={t('window.partitionByLabel')}
          helpText={t('window.partitionByHelp')}
        />
      </div>

      {/* Window Functions Section */}
      <div class={styles.group}>
        <label class={styles.label}>{t('window.windowFunctionsLabel')}</label>

        <div style={{ marginBottom: '0.5rem' }}>
          {windowFunctions.value.map((wf, index) => {
            const needsColumn = COLUMN_REQUIRED_FUNCTIONS.includes(wf.func);
            const needsOffset = OFFSET_FUNCTIONS.includes(wf.func);
            const needsDefault = DEFAULT_VALUE_FUNCTIONS.includes(wf.func);
            const isAggregate = AGGREGATE_FUNCTIONS.includes(wf.func);

            return (
              <div key={index} class={styles.windowRow}>
                <div class={styles.windowRowMain}>
                  {/* Function */}
                  <select
                    class={styles.input}
                    style={{ width: '160px' }}
                    value={wf.func}
                    onChange={(e) =>
                      updateWindowFunction(index, 'func', (e.target as HTMLSelectElement).value)
                    }
                    title={t(`window.functionDescriptions.${wf.func}`)}
                  >
                    {functionCategories.map((cat) => (
                      <optgroup key={cat.label} label={cat.label}>
                        {cat.functions.map((f) => (
                          <option key={f} value={f} title={t(`window.functionDescriptions.${f}`)}>
                            {t(`window.functions.${f}`)}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>

                  {/* Source Column (conditional) */}
                  {needsColumn && (
                    <select
                      class={styles.input}
                      style={{ flex: 1 }}
                      value={wf.sourceCol}
                      onChange={(e) =>
                        updateWindowFunction(
                          index,
                          'sourceCol',
                          (e.target as HTMLSelectElement).value
                        )
                      }
                    >
                      <option value="">{t('window.selectColumn')}</option>
                      {columns.map((col) => (
                        <option key={col} value={col}>
                          {col}
                        </option>
                      ))}
                    </select>
                  )}

                  {/* Offset (conditional) */}
                  {needsOffset && (
                    <input
                      type="number"
                      class={styles.input}
                      style={{ width: '60px' }}
                      value={wf.offset}
                      min={1}
                      onInput={(e) =>
                        updateWindowFunction(
                          index,
                          'offset',
                          parseInt((e.target as HTMLInputElement).value) || 1
                        )
                      }
                      title={
                        wf.func === 'ntile'
                          ? t('window.offsetTitle.ntile')
                          : t('window.offsetTitle.other')
                      }
                      placeholder={
                        wf.func === 'ntile'
                          ? t('window.offsetPlaceholder.ntile')
                          : t('window.offsetPlaceholder.other')
                      }
                    />
                  )}

                  <span>&rarr;</span>

                  {/* Output Name */}
                  <input
                    type="text"
                    class={styles.input}
                    style={{ flex: 1 }}
                    value={wf.output}
                    onInput={(e) =>
                      updateWindowFunction(index, 'output', (e.target as HTMLInputElement).value)
                    }
                    placeholder={t('window.outputPlaceholder')}
                  />

                  <button
                    class="button button--secondary button--small"
                    onClick={() => removeWindowFunction(index)}
                    title={t('window.remove')}
                  >
                    ×
                  </button>
                </div>

                {/* Default value row (conditional) */}
                {needsDefault && (
                  <div class={styles.windowRowExtra}>
                    <label class={styles.smallLabel}>{t('window.defaultValueLabel')}</label>
                    <input
                      type="text"
                      class={styles.input}
                      style={{ width: '120px' }}
                      value={wf.defaultValue}
                      onInput={(e) =>
                        updateWindowFunction(
                          index,
                          'defaultValue',
                          (e.target as HTMLInputElement).value
                        )
                      }
                      placeholder={t('window.defaultValuePlaceholder')}
                    />
                  </div>
                )}

                {/* Frame row (for aggregate functions only) */}
                {isAggregate && (
                  <div class={styles.windowRowExtra}>
                    <label class={styles.smallLabel}>{t('window.frame.label')}:</label>
                    <select
                      class={styles.input}
                      style={{ width: '200px' }}
                      value={wf.frameStart === null && wf.frameEnd === 0 ? 'cumulative' : 'rolling'}
                      onChange={(e) => {
                        const mode = (e.target as HTMLSelectElement).value;
                        const newFuncs = [...windowFunctions.value];
                        newFuncs[index] =
                          mode === 'cumulative'
                            ? { ...newFuncs[index], frameStart: null, frameEnd: 0 }
                            : { ...newFuncs[index], frameStart: -2, frameEnd: 0 };
                        windowFunctions.value = newFuncs;
                      }}
                    >
                      <option value="cumulative">{t('window.frame.cumulative')}</option>
                      <option value="rolling">{t('window.frame.rolling')}</option>
                    </select>

                    {/* Rolling frame inputs */}
                    {!(wf.frameStart === null && wf.frameEnd === 0) && (
                      <>
                        <input
                          type="number"
                          class={styles.input}
                          style={{ width: '50px' }}
                          value={Math.abs(wf.frameStart ?? 0)}
                          min={0}
                          onInput={(e) => {
                            const val = parseInt((e.target as HTMLInputElement).value) || 0;
                            const newFuncs = [...windowFunctions.value];
                            newFuncs[index] = { ...newFuncs[index], frameStart: -val };
                            windowFunctions.value = newFuncs;
                          }}
                        />
                        <span style={{ fontSize: '0.75rem' }}>{t('window.frame.rowsBefore')}</span>
                        <input
                          type="number"
                          class={styles.input}
                          style={{ width: '50px' }}
                          value={wf.frameEnd ?? 0}
                          min={0}
                          onInput={(e) => {
                            const val = parseInt((e.target as HTMLInputElement).value) || 0;
                            const newFuncs = [...windowFunctions.value];
                            newFuncs[index] = { ...newFuncs[index], frameEnd: val };
                            windowFunctions.value = newFuncs;
                          }}
                        />
                        <span style={{ fontSize: '0.75rem' }}>{t('window.frame.rowsAfter')}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button class="button button--secondary button--small" onClick={addWindowFunction}>
          {t('window.addWindowFunction')}
        </button>
      </div>

      {/* Inline Help */}
      <div class={styles.expressionHelp}>
        <div class={styles.expressionHelpTitle}>
          <span>{t('window.help.title')}</span>
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-dark-gray)', lineHeight: 1.8 }}>
          <p style={{ margin: '0 0 0.5rem' }}>{t('window.help.description')}</p>
          <div class={styles.exampleGrid}>
            <div>
              <code class={styles.exampleCode}>row_number</code>
            </div>
            <div class={styles.exampleDescription}>{t('window.help.row_number')}</div>
            <div>
              <code class={styles.exampleCode}>rank</code>
            </div>
            <div class={styles.exampleDescription}>{t('window.help.rank')}</div>
            <div>
              <code class={styles.exampleCode}>lag / lead</code>
            </div>
            <div class={styles.exampleDescription}>{t('window.help.lagLead')}</div>
            <div>
              <code class={styles.exampleCode}>fill_down</code>
            </div>
            <div class={styles.exampleDescription}>{t('window.help.fill_down')}</div>
            <div>
              <code class={styles.exampleCode}>sum</code>
            </div>
            <div class={styles.exampleDescription}>{t('window.help.runningSum')}</div>
            <div>
              <code class={styles.exampleCode}>mean</code>
            </div>
            <div class={styles.exampleDescription}>{t('window.help.rollingMean')}</div>
          </div>
          <p
            style={{ margin: '0.5rem 0 0', fontStyle: 'italic' }}
            dangerouslySetInnerHTML={{ __html: t('window.help.orderByNote') }}
          />
        </div>
      </div>

      {/* Preview Button */}
      <div class={styles.group} style={{ marginTop: '1rem' }}>
        <button
          class="button button--secondary"
          onClick={handlePreviewClick}
          disabled={isPreviewing.value}
        >
          {isPreviewing.value ? t('window.previewing') : t('window.previewButton')}
        </button>
      </div>
    </div>
  );
}
