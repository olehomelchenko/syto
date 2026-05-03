/**
 * Vitest Test Setup
 *
 * This file runs before all tests to set up the test environment.
 */

import { vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load actual English translations for testing
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const translationsDir = path.join(__dirname, 'i18n/locales/en');
const translations: Record<string, any> = {};

try {
  const files = fs.readdirSync(translationsDir);
  for (const file of files) {
    if (file.endsWith('.json')) {
      const namespace = file.replace('.json', '');
      const content = fs.readFileSync(path.join(translationsDir, file), 'utf-8');
      translations[namespace] = JSON.parse(content);
    }
  }
  console.log(`✓ Loaded ${Object.keys(translations).length} translation namespaces`);
} catch (error) {
  console.error('❌ Failed to load translations:', error);
  console.error('   Directory:', translationsDir);
}

// Helper to get nested value from object using dot notation
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// Helper to interpolate values into translation string
function interpolate(str: string, values?: Record<string, any>): string {
  if (!values) return str;
  return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return values[key] !== undefined ? String(values[key]) : match;
  });
}

// Mock preact-i18next globally for all tests
// Uses actual English translations with interpolation support and English plural resolution.
// When `options.count` is supplied, looks up `key_one` (count === 1) or `key_other` (else)
// before falling back to the bare key. Mirrors i18next's English CLDR plural rules so tests
// catch grammar-form mismatches that the production runtime would surface.
vi.mock('preact-i18next', () => ({
  useTranslation: (namespaceArg: string | string[] = 'common') => ({
    t: (key: string, options?: Record<string, any>) => {
      // Determine namespace: explicit ns option > first namespace from array > string arg
      const defaultNs = Array.isArray(namespaceArg) ? namespaceArg[0] : namespaceArg;
      const ns = options?.ns ?? defaultNs;

      let translation: any;
      if (typeof options?.count === 'number') {
        const suffix = options.count === 1 ? '_one' : '_other';
        translation = getNestedValue(translations[ns], key + suffix);
      }
      if (translation === undefined) {
        translation = getNestedValue(translations[ns], key);
      }
      if (translation === undefined) {
        console.warn(`Missing translation: ${ns}.${key}`);
        return key; // Fallback to key if translation not found
      }
      return interpolate(translation, options);
    },
    i18n: {
      language: 'en',
      changeLanguage: vi.fn(),
    },
  }),
  I18nextProvider: ({ children }: { children: any }) => children,
  initReactI18next: {
    type: '3rdParty',
    init: vi.fn(),
  },
}));
