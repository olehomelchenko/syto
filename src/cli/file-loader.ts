/**
 * CLI File I/O — Node.js file reading and CSV parsing
 */

import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import type { V2ParsingHints } from '../core/workflow-v2';

/**
 * Reads a file as a string with the specified encoding.
 */
export function readFileAsString(filePath: string, encoding: BufferEncoding = 'utf-8'): string {
  return fs.readFileSync(filePath, { encoding });
}

/**
 * Parses CSV content using PapaParse with optional parsing hints.
 */
export function parseCSV(
  content: string,
  hints?: V2ParsingHints
): { data: any[]; columns: string[] } {
  // TODO: mixed CRLF/LF input throws a parse error because PapaParse infers
  // the row terminator from the first newline and treats the rest of the file
  // as a single row. Consider pre-normalising line endings (or surfacing a
  // clearer error). Pinned in file-loader.test.ts → "mixed CRLF/LF line
  // endings throw a parse error".
  const result = Papa.parse(content, {
    header: hints?.headerMode !== 'auto-generate',
    delimiter: hints?.delimiter || undefined,
    dynamicTyping: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    const firstError = result.errors[0];
    throw new Error(`CSV parse error: ${firstError.message} (row ${firstError.row})`);
  }

  let data = result.data as any[];
  let columns: string[];

  if (hints?.headerMode === 'auto-generate') {
    // PapaParse returns arrays, convert to objects with auto-generated headers
    const firstRow = data[0] as any[];
    columns = firstRow.map((_: any, i: number) => `column_${i + 1}`);
    data = data.map((row: any[]) => {
      const obj: Record<string, any> = {};
      for (let i = 0; i < columns.length; i++) {
        obj[columns[i]] = row[i];
      }
      return obj;
    });
  } else if (hints?.headerMode === 'manual' && hints.customHeaders) {
    columns = hints.customHeaders;
    // Re-parse without header and map to custom headers
    const reparsed = Papa.parse(content, {
      header: false,
      delimiter: hints.delimiter || undefined,
      dynamicTyping: true,
      skipEmptyLines: true,
    });
    const rows = reparsed.data.slice(1) as any[][]; // Skip original header
    data = rows.map((row) => {
      const obj: Record<string, any> = {};
      for (let i = 0; i < columns.length; i++) {
        obj[columns[i]] = row[i];
      }
      return obj;
    });
  } else {
    columns = result.meta.fields || Object.keys(data[0] || {});
  }

  return { data, columns };
}

/**
 * Resolves a path relative to a base directory (typically the workflow file's directory).
 */
export function resolvePath(base: string, relative: string): string {
  return path.resolve(base, relative);
}

/**
 * Reads from stdin until EOF.
 */
export function readFromStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    process.stdin.on('data', (chunk: Buffer) => chunks.push(chunk));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    process.stdin.on('error', reject);
  });
}
