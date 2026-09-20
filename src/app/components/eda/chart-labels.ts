import type { ChartLabels } from '../../services/charts';

export function buildChartLabels(t: (key: string) => string): ChartLabels {
  return {
    lowerWhisker: t('eda.chartTooltip.lowerWhisker'),
    upperWhisker: t('eda.chartTooltip.upperWhisker'),
    q1: t('eda.chartTooltip.q1'),
    median: t('eda.chartTooltip.median'),
    q3: t('eda.chartTooltip.q3'),
    value: t('eda.chartTooltip.value'),
    count: t('eda.chartTooltip.count'),
    percentage: t('eda.chartTooltip.percentage'),
    date: t('eda.chartTooltip.date'),
  };
}
