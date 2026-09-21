/**
 * Debug helpers for development
 */

import { AppStore } from '../stores/AppStore';
import { isConversionError } from '../../core/type-converter';

/**
 * Log current page data to console for debugging
 */
export function debugLogCurrentPage() {
  const data = AppStore.currentData.value;
  const columns = AppStore.columns.value;
  const currentPage = AppStore.currentPage.value;
  const pageSize = AppStore.pageSize.value;
  const start = (currentPage - 1) * pageSize; // Page is 1-indexed
  const end = start + pageSize;
  const pageData = data ? data.slice(start, end) : [];

  console.group('🔍 Syto Debug: Current Page Data');
  console.log('Page:', currentPage + 1);
  console.log('Page size:', pageSize);
  console.log('Total rows:', data?.length || 0);
  console.log('Columns:', columns);
  console.log('Rows in this page:', pageData.length);
  console.log('');
  console.log('Raw page data (with types):');
  console.table(
    pageData.map((row: any) => {
      const typedRow: any = {};
      columns.forEach((col: string) => {
        const value = row[col];
        typedRow[col] = value;
        typedRow[`${col} (type)`] =
          value === null || value === undefined
            ? 'null/undefined'
            : isConversionError(value)
              ? 'error'
              : typeof value;
        typedRow[`${col} (formatted)`] = formatValue(value);
      });
      return typedRow;
    })
  );
  console.log('');
  console.log('Full page data objects:');
  pageData.forEach((row: any, idx: number) => {
    console.log(`Row ${start + idx}:`, row);
  });
  console.groupEnd();
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return 'null';
  if (isConversionError(value)) {
    return `Error: ${value.message}`;
  }
  if (value instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    if (value.getHours() !== 0 || value.getMinutes() !== 0 || value.getSeconds() !== 0) {
      return `${dateStr}T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
    }
    return dateStr;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * Log all current data to console
 */
export function debugLogAllData() {
  const data = AppStore.currentData.value;
  const columns = AppStore.columns.value;
  const schema = AppStore.activeModel.value?.schema || AppStore.activeSource.value?.columns || [];

  console.group('🔍 Syto Debug: All Data');
  console.log('Total rows:', data?.length || 0);
  console.log('Columns:', columns);
  console.log('Schema:', schema);
  console.log('');
  console.log('Sample (first 10 rows):');
  if (data && data.length > 0) {
    console.table(data.slice(0, 10));
  } else {
    console.log('No data available');
  }
  console.groupEnd();
}

/**
 * Check service worker status and cache information
 */
export async function debugLogServiceWorkerStatus() {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    console.warn('Service Workers are not supported in this browser');
    return;
  }

  console.group('🔍 Syto Debug: Service Worker Status');

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    console.log('Registered service workers:', registrations.length);

    if (registrations.length === 0) {
      console.warn('⚠️ No service worker registered!');
      console.log('Make sure:');
      console.log('1. You are using a production build (npm run preview, not npm run dev)');
      console.log('2. You have visited the page with internet connection first');
    } else {
      registrations.forEach((registration, idx) => {
        console.log(`Service Worker ${idx + 1}:`);
        console.log('  URL:', registration.scope);
        console.log('  State:', registration.active?.state || 'Not active');
        console.log('  Installing:', registration.installing?.state || 'None');
        console.log('  Waiting:', registration.waiting?.state || 'None');
      });
    }

    // Check caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      console.log('');
      console.log('Cache Storage:', cacheNames.length, 'cache(s)');
      if (cacheNames.length === 0) {
        console.warn('⚠️ No caches found!');
        console.log('Visit the page with internet first to populate caches.');
      } else {
        // Use Promise.all to properly await all cache inspections
        await Promise.all(
          cacheNames.map(async (cacheName) => {
            const cache = await caches.open(cacheName);
            const keys = await cache.keys();
            console.log(`  ${cacheName}: ${keys.length} entries`);
          })
        );
      }
    }
  } catch (error) {
    console.error('Error checking service worker status:', error);
  }

  console.log('');
  console.log('Current online status:', navigator.onLine ? '✅ Online' : '❌ Offline');
  console.groupEnd();
}

/**
 * One JSON-serializable picture of app state, for a driver outside the page.
 *
 * `sytoDebug.store` exposes every signal, which is right for a human at a
 * console and wrong for `page.evaluate`: the bridge drops anything that does
 * not survive `structuredClone`, so a driver that reaches for the wrong
 * accessor gets `{}` or `null` and reads it as "the app is empty" rather than
 * "I asked wrong". That happened twice while writing the /verify recipe —
 * `columns` is a `string[]` and not column objects, and `currentData` is a
 * plain row array with no Arquero methods on it.
 *
 * So this is the shape a driver reads, and it is a contract: every value here
 * is a string, a number, a boolean, or an array of those. Widen it rather than
 * teaching a second driver to walk the store.
 *
 * `rows` sampling stays small on purpose — a 10k-row dataset crossing the
 * bridge on every poll makes the poll the slowest thing in the run.
 *
 * See docs/HARNESS.md -> The app's own verification surface.
 */
function debugSnapshot(sampleRows = 0) {
  const data = AppStore.currentData.value;
  const model = AppStore.activeModel.value;
  const source = AppStore.activeSource.value;
  const schema = AppStore.viewingSchema.value;

  return {
    hasData: AppStore.hasData.value,
    sources: AppStore.sources.value.map((s: any) => ({ id: s.id, name: s.name })),
    models: AppStore.models.value.map((m: any) => ({
      id: m.id,
      name: m.name,
      sourceId: m.sourceId,
      steps: m.steps?.length ?? 0,
    })),
    activeSourceId: source?.id ?? null,
    activeModelId: model?.id ?? null,
    rowCount: data?.length ?? 0,
    columns: AppStore.columns.value.slice(),
    // A step is a single-key object (DATA-SPECIFICATION §2). The key is the
    // transform kind, which is what a driver asserts on.
    steps: (model?.steps ?? []).map((step: any) => Object.keys(step)[0]),
    types: (schema ?? model?.schema ?? []).map((c: any) => ({ name: c.name, type: c.type })),
    isTransforming: AppStore.isTransforming.value,
    activeDialog: AppStore.activeDialog.value ?? null,
    notifications: AppStore.notifications.value.map((n: any) => ({
      type: n.type,
      message: n.message,
    })),
    rows: sampleRows > 0 && data ? JSON.parse(JSON.stringify(data.slice(0, sampleRows))) : [],
  };
}

/**
 * Set up debug helpers on window object for console access
 */
export function setupDebugHelpers() {
  if (typeof window !== 'undefined') {
    (window as any).sytoDebug = {
      page: debugLogCurrentPage,
      all: debugLogAllData,
      sw: debugLogServiceWorkerStatus,
      snapshot: debugSnapshot,
      store: AppStore, // Expose AppStore for inspection
    };
    console.log(
      '%c🔍 Syto Debug Helpers Available',
      'color: #4CAF50; font-weight: bold; font-size: 14px;'
    );
    console.log('Use in console:');
    console.log('  sytoDebug.page() - Log current page data');
    console.log('  sytoDebug.all() - Log all data');
    console.log('  sytoDebug.sw() - Check service worker status');
    console.log('  sytoDebug.snapshot(n) - JSON state picture, n sample rows');
    console.log('  sytoDebug.store - Access AppStore');
  }
}
