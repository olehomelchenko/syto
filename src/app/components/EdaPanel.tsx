import { useEffect, useRef } from 'preact/hooks';
import { useSignal } from '@preact/signals';
import { useTranslation } from 'preact-i18next';
import { AppStore } from '../stores/AppStore';
import { ChartsEngine, BoxPlotStats } from '../services/charts';
import { buildChartLabels } from './eda/chart-labels';
import { CategoricalStat, selectChartDefaults } from '../../core/eda-engine';
import { SchemaEngine } from '../../core/schema-engine';
import { suggestBivariatePairings } from '../../core/bivariate';
import { computeEdaStats, computeCategoricalOverlay } from '../services/eda-compute';
import { TypeIndicator } from './TypeIndicator';
import {
  EdaOverview,
  EdaNumericSection,
  EdaCategoricalSection,
  EdaBivariateStrip,
  EdaBivariateModal,
} from './eda';
import { executeTransform } from '../infrastructure/executeTransform';
import { positionEdaToolbar } from '../handlers/core/interaction-handlers';
import styles from './EdaPanel.module.css';

/** Sample up to `n` rows with valid numeric values for `column`. Returns sampled rows and total valid count. */
function sampleRows(data: any[], column: string, n: number): { rows: any[]; totalValid: number } {
  const valid = data.filter((row) => {
    const v = row[column];
    return v !== null && v !== undefined && v !== '' && typeof v === 'number' && isFinite(v);
  });
  if (valid.length <= n) return { rows: valid, totalValid: valid.length };
  // Partial Fisher-Yates shuffle to pick n random elements
  const result = valid.slice();
  for (let i = result.length - 1; i > 0 && i >= result.length - n; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return { rows: result.slice(result.length - n), totalValid: valid.length };
}

export function EdaPanel() {
  const { t } = useTranslation('ui');
  const chartLabels = buildChartLabels(t);
  const boxPlotRef = useRef<HTMLDivElement>(null);
  const histogramRef = useRef<HTMLDivElement>(null);
  const temporalChartRef = useRef<HTMLDivElement>(null);
  const categoricalBarRef = useRef<HTMLDivElement>(null);

  const selectedColumn = AppStore.selectedColumn.value;
  const currentData = AppStore.currentData.value;
  const edaStats = AppStore.edaStats.value;
  const theme = AppStore.theme.value;
  const view = AppStore.edaChartView.value;
  const dateTreatment = AppStore.edaDateTreatment.value;
  const numericTreatment = AppStore.edaNumericTreatment.value;
  const brushSelection = AppStore.edaBrushSelection.value;

  const bivariateSuggestions = AppStore.bivariateSuggestions.value;
  const bivariatePreview = AppStore.bivariatePreview.value;

  const categoricalOverlay = useSignal<{ topValues: CategoricalStat[] } | null>(null);
  const boxPlotSampleSize = useSignal<{ sampled: number; total: number } | null>(null);
  const statsRequestId = useRef(0);
  const overlayRequestId = useRef(0);

  const isNumeric = edaStats && ['number', 'integer', 'float'].includes(edaStats.type);
  const isDate = edaStats && ['date', 'datetime'].includes(edaStats.type);
  const isCategorical = edaStats && !isNumeric && !(isDate && dateTreatment === 'temporal');
  const showNumericAsCategorical = isNumeric && numericTreatment === 'categorical';

  // Reset state when column selection changes
  useEffect(() => {
    if (selectedColumn && currentData) {
      let colSchema = null;
      if (AppStore.activeModel.value?.schema) {
        colSchema = AppStore.activeModel.value.schema.find((c) => c.name === selectedColumn);
      } else if (AppStore.activeSource.value?.columns) {
        colSchema = AppStore.activeSource.value.columns.find((c) => c.name === selectedColumn);
      }

      const type = colSchema
        ? colSchema.type
        : SchemaEngine.inferType(currentData.slice(0, 20).map((r) => r[selectedColumn]));

      AppStore.edaBrushSelection.value = null;
      categoricalOverlay.value = null;

      const requestId = ++statsRequestId.current;
      computeEdaStats(currentData, selectedColumn, type).then((stats) => {
        if (requestId === statsRequestId.current) {
          AppStore.edaStats.value = stats;

          // Select smart defaults based on data characteristics
          if (stats) {
            const defaults = selectChartDefaults(stats);
            AppStore.edaNumericTreatment.value = defaults.numericTreatment;
            AppStore.edaChartView.value = defaults.chartView;
            AppStore.edaDateTreatment.value = defaults.dateTreatment;

            // Compute bivariate suggestions
            const schema =
              AppStore.activeModel.value?.schema || AppStore.activeSource.value?.columns || [];
            AppStore.bivariateSuggestions.value = suggestBivariatePairings(
              selectedColumn!,
              type,
              schema
            );
          }
        }
      });
    } else {
      AppStore.edaStats.value = null;
      AppStore.edaBrushSelection.value = null;
      AppStore.bivariateSuggestions.value = [];
      AppStore.bivariatePreview.value = null;
      categoricalOverlay.value = null;
    }
  }, [selectedColumn, currentData]);

  useEffect(() => {
    if (showNumericAsCategorical && selectedColumn && currentData) {
      const requestId = ++overlayRequestId.current;
      computeCategoricalOverlay(currentData, selectedColumn).then((overlay) => {
        if (requestId === overlayRequestId.current) {
          categoricalOverlay.value = overlay;
        }
      });
    } else {
      categoricalOverlay.value = null;
    }
  }, [showNumericAsCategorical, selectedColumn, currentData]);

  useEffect(() => {
    if (!selectedColumn || !currentData || !edaStats) return;

    const renderCharts = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));

      const isInDOM = (el: HTMLElement | null): el is HTMLElement => {
        return el !== null && document.body.contains(el);
      };

      if (
        isNumeric &&
        numericTreatment === 'numeric' &&
        view === 'boxplot' &&
        isInDOM(boxPlotRef.current) &&
        edaStats.raw
      ) {
        try {
          const raw = edaStats.raw;
          const stats: BoxPlotStats = {
            min: raw.min,
            max: raw.max,
            p25: raw.p25,
            median: raw.median,
            p75: raw.p75,
          };
          const { rows: sampleData, totalValid } = sampleRows(currentData, selectedColumn, 1000);
          boxPlotSampleSize.value =
            sampleData.length < totalValid
              ? { sampled: sampleData.length, total: totalValid }
              : null;
          await ChartsEngine.renderBoxPlot(
            boxPlotRef.current,
            sampleData,
            selectedColumn,
            stats,
            theme,
            { labels: chartLabels }
          );
        } catch (error) {
          console.error('Error rendering box plot:', error);
        }
      }

      if (
        isNumeric &&
        numericTreatment === 'numeric' &&
        view === 'histogram' &&
        isInDOM(histogramRef.current)
      ) {
        try {
          await ChartsEngine.renderHistogram(
            histogramRef.current,
            currentData,
            selectedColumn,
            theme,
            (sel) => (AppStore.edaBrushSelection.value = sel),
            { labels: chartLabels }
          );
        } catch (error) {
          console.error('Error rendering histogram:', error);
        }
      }

      if (isDate && dateTreatment === 'temporal' && isInDOM(temporalChartRef.current)) {
        try {
          await ChartsEngine.renderTemporalChart(
            temporalChartRef.current,
            currentData,
            selectedColumn,
            theme,
            { labels: chartLabels }
          );
        } catch (error) {
          console.error('Error rendering temporal chart:', error);
        }
      }

      // Categorical bar: either natural categorical, date-as-categorical, or numeric-as-categorical
      if (isInDOM(categoricalBarRef.current)) {
        const topValues = showNumericAsCategorical
          ? categoricalOverlay.value?.topValues
          : isCategorical && edaStats.topValues
            ? edaStats.topValues
            : null;

        if (topValues) {
          try {
            const chartEl = categoricalBarRef.current;
            await ChartsEngine.renderCategoricalBar(
              chartEl,
              topValues,
              theme,
              (item, event) => selectChartValue(item, chartEl, event),
              { labels: chartLabels }
            );
          } catch (error) {
            console.error('Error rendering categorical bar:', error);
          }
        }
      }
    };

    renderCharts();
  }, [
    selectedColumn,
    currentData,
    edaStats,
    view,
    dateTreatment,
    numericTreatment,
    theme,
    isNumeric,
    isDate,
    isCategorical,
    showNumericAsCategorical,
    categoricalOverlay.value,
  ]);

  if (!selectedColumn || !edaStats || AppStore.selectedColumns.value.length > 1) return null;

  const clearSelection = () => {
    AppStore.selectedColumn.value = null;
  };

  const setView = (v: 'boxplot' | 'histogram') => {
    AppStore.edaChartView.value = v;
  };

  const setDateTreatment = (t: 'temporal' | 'categorical') => {
    AppStore.edaDateTreatment.value = t;
  };

  const setNumericTreatment = (t: 'numeric' | 'categorical') => {
    AppStore.edaNumericTreatment.value = t;
    if (t === 'numeric') {
      AppStore.edaBrushSelection.value = null;
    }
  };

  const applyBrush = async () => {
    if (!brushSelection || !selectedColumn) return;
    const { min, max } = brushSelection;
    const fmtMin = Number.isInteger(min) ? min : min.toFixed(4);
    const fmtMax = Number.isInteger(max) ? max : max.toFixed(4);
    const expr = `[${selectedColumn}] >= ${fmtMin} && [${selectedColumn}] <= ${fmtMax}`;

    executeTransform('Filter', { filter: expr });

    clearSelection();
  };

  const selectChartValue = (
    item: { value: any; isNull?: boolean; isOther?: boolean; isError?: boolean },
    chartEl: HTMLElement,
    event: MouseEvent
  ) => {
    // "Other" is a composite bin — no meaningful value to filter by.
    if (item.isOther || !selectedColumn) return;

    const rect = chartEl.getBoundingClientRect();
    const toolbarPos = positionEdaToolbar(rect, 220, event?.clientX);

    const colType = edaStats?.type || 'string';

    AppStore.selectedCell.value = null;
    setTimeout(() => {
      if (item.isNull) {
        AppStore.selectedCell.value = {
          col: selectedColumn,
          value: null,
          type: colType,
          isEda: true,
          isEdaMissing: true,
          edaLabel: 'missing',
        };
      } else if (item.isError) {
        AppStore.selectedCell.value = {
          col: selectedColumn,
          value: item.value,
          type: colType,
          isEda: true,
          isError: true,
          edaLabel: 'errors',
        };
      } else {
        // Regular value bin — reuse the non-EDA cell toolbar (= / ≠ / replace [+ comparable]).
        AppStore.selectedCell.value = {
          col: selectedColumn,
          value: item.value,
          type: colType,
          rowIdx: -1,
        };
      }
      AppStore.cellToolbarPos.value = toolbarPos;
    }, 0);
  };

  const selectStat = (label: string, value: any, e: MouseEvent) => {
    e.stopPropagation();

    // Null-then-set via setTimeout forces toolbar to remount (see EdaOverview.openToolbar)
    AppStore.selectedCell.value = null;

    const el = e.currentTarget as HTMLElement;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const toolbarPos = positionEdaToolbar(rect, 220);

    setTimeout(() => {
      AppStore.selectedCell.value = {
        col: selectedColumn,
        value: value,
        type: 'number',
        isEda: true,
        edaLabel: label,
      };
      AppStore.cellToolbarPos.value = toolbarPos;
    }, 0);
  };

  const handlePanelClick = (e: MouseEvent) => {
    e.stopPropagation();
    if (!(e.target as HTMLElement).closest(`.${styles.edaFlowItem}`)) {
      AppStore.selectedCell.value = null;
    }
  };

  return (
    <>
      <div class={styles.edaPanel} data-eda-panel="true" onClick={handlePanelClick}>
        <div class={styles.edaPanel__header}>
          <div class={styles.edaPanel__title}>
            <TypeIndicator type={edaStats.type} showLabel={false} size="small" />
            <span class={styles.edaPanel__columnName}>{selectedColumn}</span>
            {isDate && (
              <div class={styles.edaTreatmentToggle}>
                <button
                  class={`${styles.edaTreatmentToggle__btn} ${dateTreatment === 'temporal' ? styles['edaTreatmentToggle__btn--active'] : ''}`}
                  onClick={() => setDateTreatment('temporal')}
                >
                  {t('eda.dateTreatment.temporal')}
                </button>
                <button
                  class={`${styles.edaTreatmentToggle__btn} ${dateTreatment === 'categorical' ? styles['edaTreatmentToggle__btn--active'] : ''}`}
                  onClick={() => setDateTreatment('categorical')}
                >
                  {t('eda.dateTreatment.categorical')}
                </button>
              </div>
            )}
            {isNumeric && (
              <div class={styles.edaTreatmentToggle}>
                <button
                  class={`${styles.edaTreatmentToggle__btn} ${numericTreatment === 'numeric' ? styles['edaTreatmentToggle__btn--active'] : ''}`}
                  onClick={() => setNumericTreatment('numeric')}
                >
                  {t('eda.numericTreatment.numeric')}
                </button>
                <button
                  class={`${styles.edaTreatmentToggle__btn} ${numericTreatment === 'categorical' ? styles['edaTreatmentToggle__btn--active'] : ''}`}
                  onClick={() => setNumericTreatment('categorical')}
                >
                  {t('eda.numericTreatment.categorical')}
                </button>
              </div>
            )}
          </div>
          <button
            class={styles.edaPanel__close}
            onClick={clearSelection}
            aria-label={t('eda.closePanel')}
          >
            ×
          </button>
        </div>

        <div class={styles.edaPanel__content}>
          <EdaOverview edaStats={edaStats} />

          {isNumeric && numericTreatment === 'numeric' && (
            <EdaNumericSection
              edaStats={edaStats}
              view={view}
              brushSelection={brushSelection}
              boxPlotRef={boxPlotRef}
              histogramRef={histogramRef}
              sampleSize={boxPlotSampleSize.value}
              onViewChange={setView}
              onApplyBrush={applyBrush}
              onSelectStat={selectStat}
            />
          )}

          {showNumericAsCategorical && categoricalOverlay.value && (
            <EdaCategoricalSection
              edaStats={categoricalOverlay.value}
              categoricalBarRef={categoricalBarRef}
            />
          )}

          {isDate && dateTreatment === 'temporal' && (
            <div class={`${styles.edaSection} ${styles['edaSection--wide']}`}>
              <div class={styles.edaSection__title}>{t('eda.temporal.title')}</div>
              <div ref={temporalChartRef} style={{ width: '100%', minHeight: '100px' }}></div>
            </div>
          )}

          {isCategorical && (
            <EdaCategoricalSection edaStats={edaStats} categoricalBarRef={categoricalBarRef} />
          )}

          {bivariateSuggestions.length > 0 && currentData && (
            <EdaBivariateStrip
              selectedColumn={selectedColumn}
              suggestions={bivariateSuggestions}
              data={currentData.slice(0, 1000)}
              theme={theme}
            />
          )}
        </div>
      </div>

      {bivariatePreview && currentData && (
        <EdaBivariateModal
          selectedColumn={selectedColumn}
          suggestions={bivariateSuggestions}
          activeIndex={bivariatePreview.index}
          data={currentData.slice(0, 1000)}
          theme={theme}
        />
      )}
    </>
  );
}
