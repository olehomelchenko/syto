import { useEffect, useRef } from 'preact/hooks';
import { useTranslation } from 'preact-i18next';
import { AppStore } from '../../stores/AppStore';
import { ChartsEngine } from '../../services/charts';
import type { BivariateSuggestion } from '../../../core/bivariate';
import styles from './EdaBivariateStrip.module.css';

interface EdaBivariateStripProps {
  selectedColumn: string;
  suggestions: BivariateSuggestion[];
  data: any[];
  theme: 'syto' | 'blues';
}

export function EdaBivariateStrip({
  selectedColumn,
  suggestions,
  data,
  theme,
}: EdaBivariateStripProps) {
  const { t } = useTranslation('ui');

  if (suggestions.length === 0) return null;

  return (
    <div class={styles.strip}>
      <span class={styles.stripTitle}>{t('eda.bivariate.related')}</span>
      {suggestions.map((suggestion, index) => (
        <Thumbnail
          key={`${selectedColumn}-${suggestion.partnerColumn}`}
          selectedColumn={selectedColumn}
          suggestion={suggestion}
          index={index}
          data={data}
          theme={theme}
        />
      ))}
    </div>
  );
}

interface ThumbnailProps {
  selectedColumn: string;
  suggestion: BivariateSuggestion;
  index: number;
  data: any[];
  theme: 'syto' | 'blues';
}

function Thumbnail({ selectedColumn, suggestion, index, data, theme }: ThumbnailProps) {
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = chartRef.current;
    if (!el || !document.body.contains(el) || data.length === 0) return;

    const opts = { thumbnail: true, width: 100 as number | 'container', height: 50 };
    ChartsEngine.renderBivariate(el, data, selectedColumn, suggestion, theme, opts);
  }, [selectedColumn, suggestion.partnerColumn, suggestion.chartType, data, theme]);

  const handleClick = () => {
    AppStore.bivariatePreview.value = { index };
  };

  return (
    <div class={styles.thumbnail} onClick={handleClick}>
      <div ref={chartRef} class={styles.thumbnail__chart} />
      <div class={styles.thumbnail__label} title={suggestion.partnerColumn}>
        {suggestion.partnerColumn}
      </div>
    </div>
  );
}
