import { useEffect, useRef } from 'preact/hooks';
import { useTranslation } from 'preact-i18next';
import { AppStore } from '../../stores/AppStore';
import { ChartsEngine } from '../../services/charts';
import type { BivariateSuggestion } from '../../../core/bivariate';
import { buildChartLabels } from './chart-labels';
import styles from './EdaBivariateModal.module.css';

const CHART_TYPE_LABELS: Record<string, string> = {
  scatter: 'eda.bivariate.chartTypes.scatter',
  'grouped-bar': 'eda.bivariate.chartTypes.groupedBar',
  'line-temporal': 'eda.bivariate.chartTypes.lineTemporal',
  heatmap: 'eda.bivariate.chartTypes.heatmap',
};

interface EdaBivariateModalProps {
  selectedColumn: string;
  suggestions: BivariateSuggestion[];
  activeIndex: number;
  data: any[];
  theme: 'syto' | 'blues';
}

export function EdaBivariateModal({
  selectedColumn,
  suggestions,
  activeIndex,
  data,
  theme,
}: EdaBivariateModalProps) {
  const { t } = useTranslation('ui');
  const chartRef = useRef<HTMLDivElement>(null);
  const active = suggestions[activeIndex];

  useEffect(() => {
    const el = chartRef.current;
    if (!el || !document.body.contains(el) || !active || data.length === 0) return;

    el.innerHTML = '';
    const opts = { width: 'container' as const, height: 300, labels: buildChartLabels(t) };
    ChartsEngine.renderBivariate(el, data, selectedColumn, active, theme, opts);
  }, [selectedColumn, active?.partnerColumn, active?.chartType, data, theme, t]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        AppStore.bivariatePreview.value = null;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!active) return null;

  const close = () => {
    AppStore.bivariatePreview.value = null;
  };

  const selectItem = (index: number) => {
    AppStore.bivariatePreview.value = { index };
  };

  const title = `${selectedColumn} × ${active.partnerColumn}`;

  return (
    <div class={styles.backdrop} onClick={close}>
      <div class={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div class={styles.header}>
          <h3>{title}</h3>
          <button class={styles.closeButton} onClick={close} aria-label={t('common:buttons.close')}>
            ×
          </button>
        </div>
        <div class={styles.body}>
          <div class={styles.chartArea}>
            <div ref={chartRef} class={styles.chartContainer} />
          </div>
          <div class={styles.sidebar}>
            {suggestions.map((suggestion, index) => (
              <div
                key={suggestion.partnerColumn}
                class={`${styles.sidebarItem} ${index === activeIndex ? styles['sidebarItem--active'] : ''}`}
                onClick={() => selectItem(index)}
              >
                <div>
                  <div class={styles.sidebarItem__name} title={suggestion.partnerColumn}>
                    {suggestion.partnerColumn}
                  </div>
                  <div class={styles.sidebarItem__type}>
                    {t(CHART_TYPE_LABELS[suggestion.chartType])}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
