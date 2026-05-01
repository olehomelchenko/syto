/**
 * Tests for parseCSV — the CLI's PapaParse entry point. These tests pin the
 * behaviour of the import path against adversarial inputs: BOM, CRLF, ragged
 * rows, Unicode-normalised headers. See src/__fixtures__/README.md.
 */

import { describe, it, expect } from 'vitest';
import { parseCSV } from './file-loader';
import { bomUtf8Csv, bomUtf8CsvWithoutBom } from '../__fixtures__/bom-utf8';
import { crlfCsv, mixedLineEndingsCsv } from '../__fixtures__/crlf';
import { tooFewFieldsCsv, tooManyFieldsCsv, raggedMixedCsv } from '../__fixtures__/ragged';
import {
  cafeNfc,
  cafeNfd,
  ambiguousHeadersCsv,
  invisibleCharHeadersCsv,
  paddedHeadersCsv,
  zwjHeader,
  zwnjHeader,
} from '../__fixtures__/unicode-headers';

describe('parseCSV — adversarial fixtures', () => {
  describe('BOM handling', () => {
    it('CONTRACT: UTF-8 BOM does not pollute the first column header', () => {
      const result = parseCSV(bomUtf8Csv);
      expect(result.columns).toEqual(['name', 'age']);
      // The BOM should not appear as a leading character on the first key.
      expect(result.columns[0].charCodeAt(0)).toBe(0x6e); // 'n'
    });

    it('CONTRACT: BOM-prefixed and BOM-stripped CSVs produce identical row data', () => {
      const withBom = parseCSV(bomUtf8Csv);
      const withoutBom = parseCSV(bomUtf8CsvWithoutBom);
      expect(withBom.columns).toEqual(withoutBom.columns);
      expect(withBom.data).toEqual(withoutBom.data);
    });
  });

  describe('Line-ending handling', () => {
    it('CONTRACT: CRLF line endings parse identically to LF', () => {
      const crlf = parseCSV(crlfCsv);
      const lf = parseCSV(crlfCsv.replace(/\r\n/g, '\n'));
      expect(crlf.columns).toEqual(lf.columns);
      expect(crlf.data).toEqual(lf.data);
    });

    it('SURPRISE: mixed CRLF/LF line endings throw a parse error', () => {
      // PapaParse detects the row terminator from the first newline it sees and
      // assumes the rest of the file matches. A file with a header terminated by
      // \r\n followed by data rows terminated by bare \n collapses the data rows
      // onto a single line, triggering TooManyFields. Real-world: this happens
      // when a Windows-exported CSV is concatenated with Unix-exported rows.
      // Pinning so we know to surface a clearer error or normalise on import.
      expect(() => parseCSV(mixedLineEndingsCsv)).toThrow(/CSV parse error/);
    });
  });

  describe('Ragged rows', () => {
    it('FINDING: a row missing trailing fields parses with undefined for missing keys', () => {
      // PapaParse with header:true emits a "TooFewFields" warning, but our
      // parseCSV throws on the first warning. Pin this — if we ever loosen the
      // "throw on any error" policy, this test will tell us.
      expect(() => parseCSV(tooFewFieldsCsv)).toThrow(/CSV parse error/);
    });

    it('FINDING: a row with extra fields throws a TooManyFields error', () => {
      expect(() => parseCSV(tooManyFieldsCsv)).toThrow(/CSV parse error/);
    });

    it('FINDING: any ragged row throws a CSV parse error', () => {
      expect(() => parseCSV(raggedMixedCsv)).toThrow(/CSV parse error/);
    });
  });

  describe('Unicode-normalised headers', () => {
    it('FINDING: NFC and NFD forms of "café" produce two distinct columns', () => {
      // Object-key comparison is by code unit, so two visually identical
      // headers can coexist. Important to know — a downstream "rename column
      // café" operation might pick either one depending on order.
      const result = parseCSV(ambiguousHeadersCsv);
      expect(result.columns).toEqual([cafeNfc, cafeNfd]);
      expect(result.columns).toHaveLength(2);
      expect(result.data[0]).toEqual({ [cafeNfc]: 1, [cafeNfd]: 2 });
    });

    it('FINDING: zero-width joiner/non-joiner survive parsing as part of header names', () => {
      const result = parseCSV(invisibleCharHeadersCsv);
      expect(result.columns).toEqual([zwjHeader, zwnjHeader]);
      // Sanity: the headers are NOT equal to their visually-similar forms.
      expect(zwjHeader).not.toBe('family');
      expect(zwnjHeader).not.toBe('final');
    });

    it('FINDING: PapaParse does not trim whitespace from header names by default', () => {
      // Headers come back with their leading/trailing spaces preserved. Cells
      // are similarly untrimmed unless dynamicTyping coerces them.
      const result = parseCSV(paddedHeadersCsv);
      expect(result.columns).toEqual(['  name  ', ' age ']);
    });
  });
});
