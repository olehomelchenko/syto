import { Config } from 'vega-lite';

/**
 * Syto Theme (Default)
 * Sharp corners, IBM Plex Sans, Vibrant Blue highlights
 */
export const sytoTheme: Config = {
  background: 'transparent',
  font: '"IBM Plex Sans", sans-serif',
  title: {
    font: '"Finlandica", sans-serif',
    fontSize: 16,
    fontWeight: 'normal',
    color: '#2d2a26',
  },
  axis: {
    domain: true,
    domainColor: '#2d2a26',
    grid: true,
    gridColor: '#d0cdc8',
    gridDash: [4, 4],
    tickColor: '#2d2a26',
    labelColor: '#2d2a26',
    labelFontSize: 11,
    titleColor: '#2d2a26',
    titleFontSize: 13,
    titlePadding: 10,
  },
  range: {
    category: [
      '#1789fc', // Primary Blue
      '#fdb833', // Primary Yellow
      '#296EB4',
      '#CCE160',
      '#9FDFDC',
      '#8A983E',
      '#C7C7FA',
      '#D02F2F',
    ],
  },
  mark: {
    color: '#1789fc',
  },
  bar: { fill: '#1789fc' },
  line: { stroke: '#1789fc', strokeWidth: 2 },
  rect: { fill: '#1789fc' },
  boxplot: {
    median: { stroke: 'white' },
    outliers: { fill: '#1789fc' },
    box: { fill: '#1789fc' },
  },
  view: { stroke: 'transparent' },
};

/**
 * Blues Theme (KSE)
 * Rounded (default), Arial, Midnight Blue/Cyan palette
 */
export const bluesTheme: Config = {
  background: 'transparent',
  font: 'Arial, -apple-system, sans-serif',
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#003964',
  },
  axis: {
    domain: true,
    domainColor: '#646464',
    grid: true,
    gridColor: '#e0e0e0',
    tickColor: '#646464',
    labelColor: '#646464',
    labelFontSize: 10,
    titleColor: '#003964',
    titleFontSize: 12,
  },
  range: {
    category: [
      '#003964', // Midnight Blue
      '#00bbce', // Cyan
      '#a7c539', // Green
      '#e4e541', // Yellow
      '#f15b43', // Red
      '#646464',
    ],
  },
  mark: {
    color: '#00bbce',
  },
  bar: { fill: '#00bbce' },
  line: { stroke: '#003964', strokeWidth: 2 },
  rect: { fill: '#00bbce' },
  boxplot: {
    median: { stroke: 'white' },
    outliers: { fill: '#00bbce' },
    box: { fill: '#00bbce' },
  },
  view: { stroke: 'transparent' },
};
