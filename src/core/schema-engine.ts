/**
 * Syto Schema Engine
 *
 * Handles granular type inference and schema propagation through transformation steps.
 */

import { tryDecodeRollupSpec } from './transforms/rollup-spec';

export type ColumnType = 'string' | 'integer' | 'float' | 'boolean' | 'date' | 'datetime' | 'json';

// Known column types for validation (future-proofing: handle unknown types gracefully)
const KNOWN_COLUMN_TYPES: readonly ColumnType[] = [
  'string',
  'integer',
  'float',
  'boolean',
  'date',
  'datetime',
  'json',
] as const;

export interface ColumnSchema {
  name: string;
  type: ColumnType;
  format?: Record<string, any>;
  originalPosition?: number;
}

export interface SchemaDiff {
  missingColumns: string[];
  newColumns: string[];
  typeChanges: Array<{
    column: string;
    oldType: ColumnType;
    newType: ColumnType;
  }>;
  compatibilityWarning: string | null;
}

export interface TransformStep {
  select?: string[];
  remove?: string[];
  rename?: Record<string, string>;
  derive?: Record<string, string>;
  filter?: string;
  sort?: { field: string; order: 'asc' | 'desc' } | Array<{ field: string; order: 'asc' | 'desc' }>;
  replace?: {
    column: string;
    find: any;
    replace: any;
    isRegex?: boolean;
    matchMode?: 'errors' | 'null';
  };
  dedupe?: { columns?: string[]; mode?: 'remove' | 'keep' };
  join?: any;
  import?: {
    source: string;
    fileName: string;
    delimiter: string;
    headerMode: string;
    customHeaders?: string[];
  };
  types?: Record<string, ColumnType>;
  aggregate?: {
    groupby: string[];
    rollup: Record<string, string>;
  };
  fold?: {
    columns: string[];
    as: [string, string];
  };
  pivot?: {
    rows?: string[];
    keys: string;
    values: string;
    aggregation: string;
    options?: {
      sort?: boolean;
      limit?: number;
    };
  };
  split?: {
    column: string;
    mode: 'left' | 'right' | 'firstN' | 'lastN' | 'spread';
    keepOriginal: boolean;
    maxColumns?: number;
    delimiter: string;
    isRegex?: boolean;
  };
  sliceRows?: { count: number; mode: 'first' | 'last' | 'removeFirst' | 'removeLast' };
  promoteHeader?: { skipRows: number };
  addIndex?: { columnName: string; startFrom?: number };
  impute?: {
    column: string;
    strategy:
      | 'constant'
      | 'mean'
      | 'median'
      | 'min'
      | 'max'
      | 'forwardFill'
      | 'backwardFill'
      | 'linearInterpolation';
    value?: any;
    includeEmptyString?: boolean;
  };
  selectPattern?: {
    pattern: string;
    matchType: 'prefix' | 'suffix' | 'contains' | 'regex';
    include?: string[];
  };
  removePattern?: {
    pattern: string;
    matchType: 'prefix' | 'suffix' | 'contains' | 'regex';
  };
  conditional?: {
    column: string;
    conditions: Array<{ when: string; then: string }>;
    else: string;
  };
  renamePattern?: {
    find: string;
    replace: string;
    regex?: boolean;
  };
  concat?: { with: string; columns?: string[]; targetColumns?: string[] };
  union?: { with: string; columns?: string[]; targetColumns?: string[] };
  sample?: { count: number; seed?: number };
  semijoin?: { right: string; on: [string, string][] };
  antijoin?: { right: string; on: [string, string][] };
  lookup?: { right: string; on: [string, string][]; values: string[] };
  spread?: { column: string; limit?: number; keepOriginal?: boolean };
  unroll?: { column: string; indices?: boolean; keepOriginal?: boolean };
  window?: {
    orderBy: Array<{ field: string; order: 'asc' | 'desc' }>;
    partitionBy?: string[];
    derive: Record<string, string>;
    frames?: Record<string, [number | null, number | null]>;
  };
  removeRows?: { indices: number[] };
  keepRows?: { indices: number[] };
  describe?: { columns: string[] };
}

export const SchemaEngine = {
  /**
   * Infer granular type from an array of values
   * @param {any[]} values - Sample values from a column
   * @returns {ColumnType}
   */
  inferType(values: any[] | null | undefined): ColumnType {
    if (!values || values.length === 0) return 'string';

    // Filter out nulls/undefined/empty strings for type inference
    const nonNullValues = values.filter((v) => v !== null && v !== undefined && v !== '');
    if (nonNullValues.length === 0) return 'string';

    // 1. Check for Boolean (standard JS type from PapaParse dynamicTyping)
    if (nonNullValues.every((v) => typeof v === 'boolean')) {
      return 'boolean';
    }

    // 2. Check for Numeric (actual numbers)
    if (nonNullValues.every((v) => typeof v === 'number')) {
      const allIntegers = nonNullValues.every((v) => Number.isInteger(v));
      return allIntegers ? 'integer' : 'float';
    }

    // 3. Check for Numeric Strings (strings that parse cleanly as numbers)
    // Common after splitting date strings like "2024-01-15" -> ["2024", "01", "15"]
    //
    // This branch also destroys leading zeros on anything that is an identifier
    // rather than a number: 449 of superstore.csv's 10,194 rows come out with a
    // damaged postal code (05401 -> 5401), silently, in both the browser and the
    // CLI. Measured 2026-09-21. The fix is ranked work with three options and a
    // real tension against the date-split case above — see BACKLOG.md -> "Leading
    // zeros are destroyed on import, silently". Read it before narrowing this.
    if (nonNullValues.every((v) => typeof v === 'string')) {
      // Check if all strings are valid numbers (not NaN, not empty after trim)
      const allNumericStrings = nonNullValues.every((v) => {
        const trimmed = (v as string).trim();
        if (trimmed === '') return false;
        const num = Number(trimmed);
        return !isNaN(num) && isFinite(num);
      });

      if (allNumericStrings) {
        // Determine if integers or floats
        const allIntegers = nonNullValues.every((v) => {
          const num = Number((v as string).trim());
          return Number.isInteger(num);
        });
        return allIntegers ? 'integer' : 'float';
      }
    }

    // 3.5. Check for JSON (strings that look like JSON objects/arrays)
    if (nonNullValues.every((v) => typeof v === 'string')) {
      const allLookLikeJson = nonNullValues.every((v) => {
        const trimmed = (v as string).trim();
        return (
          (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
          (trimmed.startsWith('[') && trimmed.endsWith(']'))
        );
      });

      if (allLookLikeJson) {
        // Verify at least one actually parses as valid JSON
        const anyValidJson = nonNullValues.some((v) => {
          try {
            JSON.parse(v as string);
            return true;
          } catch {
            return false;
          }
        });
        if (anyValidJson) return 'json';
      }
    }

    // 4. Check for Date/DateTime (strings matching patterns)
    if (nonNullValues.every((v) => typeof v === 'string')) {
      // ISO DateTime: 2024-01-01T12:00:00...
      // ISO DateTime: 2024-01-01T12:00:00... OR SQL: 2024-01-01 12:00:00...
      // TODO(2026-05-01): regex is unanchored at the end — "2024-01-01T00:00:00ABC" matches
      // and infers as datetime. Pinned in schema-engine.test.ts → "Adversarial
      // fixtures — timezones and date strings → trailing garbage".
      const isDateTime = nonNullValues.every((v) =>
        /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/.test(v as string)
      );
      if (isDateTime) return 'datetime';

      // Simple Date: 2024-01-01 or 2024/01/01
      const isDate = nonNullValues.every((v) => /^\d{4}[-\/]\d{2}[-\/]\d{2}/.test(v as string));
      if (isDate) return 'date';

      // American Date: MM/DD/YYYY or M/D/YYYY
      const isAmericanDate = nonNullValues.every((v) =>
        /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v as string)
      );
      if (isAmericanDate) return 'date';
    }

    // Default to string
    return 'string';
  },

  /**
   * Promotes two types to a common compatible type.
   * @param {ColumnType} t1
   * @param {ColumnType} t2
   * @returns {ColumnType}
   */
  getPromotedType(t1: ColumnType, t2: ColumnType): ColumnType {
    if (t1 === t2) return t1;

    const types = new Set([t1, t2]);

    // Numeric promotions
    if (types.has('integer') && types.has('float')) {
      return 'float';
    }

    // Date promotions
    if (types.has('date') && types.has('datetime')) {
      return 'datetime';
    }

    // JSON + any other type → string
    if (types.has('json')) {
      return 'string';
    }

    // Fallback to string if anything is string or incompatible
    return 'string';
  },

  /**
   * Create initial schema from imported data using PHYSICAL types only.
   * Physical types are what the parser (PapaParse with dynamicTyping, or JSON.parse) gives us.
   * No inference is applied - we just classify the JavaScript runtime types.
   *
   * For CSV with dynamicTyping=true:
   * - Numbers → 'integer' or 'float'
   * - Booleans → 'boolean'
   * - Everything else → 'string'
   *
   * For JSON:
   * - number → 'integer' or 'float'
   * - boolean → 'boolean'
   * - string → 'string'
   * - null/undefined → 'string' (fallback)
   *
   * @param {Record<string, any>[]} data - Array of row objects
   * @returns {ColumnSchema[]} Array of ColumnSchema with physical types
   */
  createPhysicalSchema(data: Record<string, any>[]): ColumnSchema[] {
    if (!data || data.length === 0) return [];

    const columns = Object.keys(data[0]);
    return columns.map((name, index) => {
      const sample = data.slice(0, 20).map((row) => row[name]);
      return {
        name,
        type: this.detectPhysicalType(sample),
        format: {},
        originalPosition: index,
      };
    });
  },

  /**
   * Detect the physical type based on JavaScript runtime types.
   * This examines what PapaParse/JSON.parse actually returned, without inference.
   *
   * @param {any[]} values - Sample values from a column
   * @returns {ColumnType} The physical type
   */
  detectPhysicalType(values: any[]): ColumnType {
    if (!values || values.length === 0) return 'string';

    // Filter out nulls/undefined for type detection
    const nonNullValues = values.filter((v) => v !== null && v !== undefined && v !== '');
    if (nonNullValues.length === 0) return 'string';

    // Check for boolean (actual JS boolean type)
    if (nonNullValues.every((v) => typeof v === 'boolean')) {
      return 'boolean';
    }

    // Check for number (actual JS number type)
    if (nonNullValues.every((v) => typeof v === 'number')) {
      const allIntegers = nonNullValues.every((v) => Number.isInteger(v));
      return allIntegers ? 'integer' : 'float';
    }

    // Check for native objects/arrays (from JSON import with serializeNested: false)
    if (nonNullValues.every((v) => typeof v === 'object' && v !== null && !(v instanceof Date))) {
      return 'json';
    }

    // Everything else is a string (including Date objects serialized as strings)
    return 'string';
  },

  /**
   * Create logical schema from model data using type inference.
   * This is used for models (not sources) to infer logical types from the data.
   *
   * @param {Record<string, any>[]} data - Array of row objects
   * @returns {ColumnSchema[]} Array of ColumnSchema with logical types
   */
  createLogicalSchema(data: Record<string, any>[]): ColumnSchema[] {
    if (!data || data.length === 0) return [];

    const columns = Object.keys(data[0]);
    return columns.map((name, index) => {
      const sample = data.slice(0, 20).map((row) => row[name]);
      return {
        name,
        type: this.inferType(sample),
        format: {},
        originalPosition: index,
      };
    });
  },

  /**
   * Infer schema from sample data, preserving type info for known columns.
   * Shared helper for transform branches that produce a new column set from sample data.
   */
  inferSchemaFromSample(
    currentSchema: ColumnSchema[],
    sampleData: Record<string, any>[],
    options?: {
      updatePositions?: boolean;
      promoteTypes?: boolean;
      sampleSize?: number;
    }
  ): ColumnSchema[] {
    const sampleSize = options?.sampleSize ?? 20;
    const names = Object.keys(sampleData[0]);
    return names.map((name, i) => {
      const existing = currentSchema.find((c) => c.name === name);
      if (existing) {
        if (options?.promoteTypes) {
          const sample = sampleData.slice(0, sampleSize).map((row) => row[name]);
          const inferredType = this.inferType(sample);
          return {
            ...existing,
            type: this.getPromotedType(existing.type, inferredType),
            originalPosition: i,
          };
        }
        return options?.updatePositions ? { ...existing, originalPosition: i } : { ...existing };
      }
      const sample = sampleData.slice(0, sampleSize).map((row) => row[name]);
      return {
        name,
        type: this.inferType(sample),
        format: {},
        originalPosition: i,
      };
    });
  },

  /**
   * Calculate resulting schema after applying a transform to a model
   *
   * @param {ColumnSchema[]} currentSchema - Current ColumnSchema array
   * @param {TransformStep} transform - Transform step specification
   * @param {Record<string, any>[]} sampleData - Sample of the data AFTER transform
   * @returns {ColumnSchema[]} New ColumnSchema array
   */
  deriveNextSchema(
    currentSchema: ColumnSchema[],
    transform: TransformStep,
    sampleData: Record<string, any>[] = []
  ): ColumnSchema[] {
    // 1. SELECT: Keep only specified columns
    if (transform.select) {
      return transform.select.map((name) => {
        const existing = currentSchema.find((c) => c.name === name);
        return existing ? { ...existing } : { name, type: 'string', format: {} };
      });
    }

    // 2. REMOVE: Drop specified columns
    if (transform.remove) {
      return currentSchema.filter((c) => !transform.remove!.includes(c.name));
    }

    // 3. RENAME: Update column names
    if (transform.rename) {
      const renameMap = transform.rename;
      return currentSchema.map((c) => {
        const newName = renameMap[c.name];
        if (newName) {
          return { ...c, name: newName };
        }
        return { ...c };
      });
    }

    // 3a. SELECT_PATTERN: Keep only columns matching pattern
    if (transform.selectPattern) {
      if (sampleData && sampleData.length > 0) {
        return this.inferSchemaFromSample(currentSchema, sampleData, { updatePositions: true });
      }
      // Fallback: use current schema (pattern matching will be done at runtime)
      return currentSchema;
    }

    // 3b. REMOVE_PATTERN: Drop columns matching pattern
    if (transform.removePattern) {
      if (sampleData && sampleData.length > 0) {
        return this.inferSchemaFromSample(currentSchema, sampleData, { updatePositions: true });
      }
      // Fallback: use current schema
      return currentSchema;
    }

    // 3c. CONDITIONAL: Add/modify column based on conditions
    if (transform.conditional) {
      const { column } = transform.conditional;
      const nextSchema = [...currentSchema];
      const existingIndex = nextSchema.findIndex((c) => c.name === column);

      if (sampleData && sampleData.length > 0) {
        const sampleValues = sampleData.map((row) => row[column]);
        const type = this.inferType(sampleValues);
        const newColSchema: ColumnSchema = {
          name: column,
          type: type,
          format: {},
          originalPosition:
            existingIndex !== -1 ? nextSchema[existingIndex].originalPosition : nextSchema.length,
        };

        if (existingIndex !== -1) {
          nextSchema[existingIndex] = newColSchema;
        } else {
          nextSchema.push(newColSchema);
        }
        return nextSchema;
      }

      // Fallback: add as string type
      if (existingIndex === -1) {
        nextSchema.push({
          name: column,
          type: 'string',
          format: {},
          originalPosition: nextSchema.length,
        });
      }
      return nextSchema;
    }

    // 3d. RENAME_PATTERN: Bulk rename by pattern
    if (transform.renamePattern) {
      if (sampleData && sampleData.length > 0) {
        const names = Object.keys(sampleData[0]);
        return names.map((name, i) => {
          const existing = currentSchema.find((c) => c.name === name);
          if (existing) {
            // Check if this column was renamed
            const originalName = currentSchema.find((c) => {
              const { find, replace: replacement, regex } = transform.renamePattern!;
              if (regex) {
                try {
                  const regexObj = new RegExp(find);
                  return regexObj.test(c.name) && c.name.replace(regexObj, replacement) === name;
                } catch {
                  return false;
                }
              }
              return c.name.includes(find) && c.name.replace(find, replacement) === name;
            });
            if (originalName) {
              return { ...originalName, name, originalPosition: i };
            }
            return { ...existing, originalPosition: i };
          }
          const sample = sampleData.slice(0, 20).map((row) => row[name]);
          return {
            name,
            type: this.inferType(sample),
            format: {},
            originalPosition: i,
          };
        });
      }
      // Fallback: try to match pattern against current schema
      const { find, replace: replacement, regex } = transform.renamePattern;
      return currentSchema.map((c) => {
        let newName: string;
        if (regex) {
          try {
            const regexObj = new RegExp(find);
            newName = c.name.replace(regexObj, replacement);
          } catch {
            return c;
          }
        } else {
          newName = c.name.replace(find, replacement);
        }
        return newName !== c.name ? { ...c, name: newName } : c;
      });
    }

    // 4. DERIVE: Add new columns
    if (transform.derive) {
      if (!sampleData || sampleData.length === 0) {
        console.warn(
          'SchemaEngine: Sample data missing for derive transform, cannot infer new column types'
        );
      }
      const nextSchema = [...currentSchema];
      for (const newColName of Object.keys(transform.derive)) {
        // If column exists, we overwrite it, otherwise append
        const existingIndex = nextSchema.findIndex((c) => c.name === newColName);

        // Get sample values for type inference if available
        const sampleValues = sampleData.map((row) => row[newColName]);
        const type = sampleValues.length > 0 ? this.inferType(sampleValues) : 'string';

        const newColSchema: ColumnSchema = {
          name: newColName,
          type: type,
          format: {},
          originalPosition:
            existingIndex !== -1 ? nextSchema[existingIndex].originalPosition : nextSchema.length,
        };

        if (existingIndex !== -1) {
          nextSchema[existingIndex] = newColSchema;
        } else {
          nextSchema.push(newColSchema);
        }
      }
      return nextSchema;
    }

    // 5. JOIN: Merge schemas from left and right tables
    if (transform.join) {
      if (sampleData && sampleData.length > 0) {
        return this.inferSchemaFromSample(currentSchema, sampleData);
      }
    }

    // 5a. LOOKUP: Add columns from right table
    if (transform.lookup) {
      if (sampleData && sampleData.length > 0) {
        return this.inferSchemaFromSample(currentSchema, sampleData);
      }
    }

    // 5b. SEMIJOIN / ANTIJOIN: Keep left schema
    if (transform.semijoin || transform.antijoin) {
      return currentSchema.map((c) => ({ ...c }));
    }

    // 6. TYPES: Update column types
    if (transform.types) {
      const typesMap = transform.types;
      return currentSchema.map((c) => {
        if (typesMap[c.name]) {
          const newType = typesMap[c.name];
          // Future-proofing: handle unknown types gracefully
          if (!KNOWN_COLUMN_TYPES.includes(newType as ColumnType)) {
            console.warn(
              `Unknown column type "${newType}" for column "${c.name}", treating as string`
            );
            return { ...c, type: 'string' as ColumnType };
          }
          return { ...c, type: newType as ColumnType };
        }
        return { ...c };
      });
    }

    // 7. AGGREGATE: New schema based on groups + rollups
    if (transform.aggregate) {
      const { groupby, rollup } = transform.aggregate;
      const newSchema: ColumnSchema[] = [];
      let pos = 0;

      // Add GroupBy columns
      if (groupby) {
        groupby.forEach((colName) => {
          const existing = currentSchema.find((c) => c.name === colName);
          newSchema.push(
            existing
              ? { ...existing, originalPosition: pos++ }
              : { name: colName, type: 'string', originalPosition: pos++ }
          );
        });
      }

      // Add Rollup columns
      if (rollup) {
        for (const [outName, expr] of Object.entries(rollup)) {
          // Infer type from function
          let type: ColumnType = 'float'; // Default to numeric
          const spec = typeof expr === 'string' ? tryDecodeRollupSpec(expr) : null;
          const funcName = spec ? spec.func : 'unknown';

          if (['count', 'distinct', 'valid', 'invalid'].includes(funcName)) {
            type = 'integer';
          } else if (['first', 'last', 'min', 'max'].includes(funcName)) {
            // Inherit type from input column if possible
            if (spec?.col) {
              const existing = currentSchema.find((c) => c.name === spec.col);
              if (existing) type = existing.type;
            }
          }

          newSchema.push({
            name: outName,
            type: type,
            format: {},
            originalPosition: pos++,
          });
        }
      }
      return newSchema;
    }

    // 7b. DESCRIBE: Summary statistics (transposed)
    if (transform.describe) {
      const { columns } = transform.describe;
      const newSchema: ColumnSchema[] = [
        { name: 'statistic', type: 'string', originalPosition: 0 },
      ];
      let pos = 1;
      for (const colName of columns) {
        newSchema.push({ name: colName, type: 'string', format: {}, originalPosition: pos++ });
      }
      return newSchema;
    }

    // 8. FOLD (Unpivot)
    if (transform.fold) {
      const { columns, as } = transform.fold;
      const keyName = as && as[0] ? as[0] : 'key';
      const valueName = as && as[1] ? as[1] : 'value';

      // 1. Keep columns NOT in the fold list
      const newSchema = currentSchema.filter((c) => !columns.includes(c.name));
      let pos = newSchema.length;

      // 2. Add Key column
      newSchema.push({
        name: keyName,
        type: 'string',
        format: {},
        originalPosition: pos++,
      });

      // 3. Add Value column
      let valType: ColumnType = 'string';
      if (sampleData && sampleData.length > 0) {
        const sampleValues = sampleData.map((row) => row[valueName]);
        const inferred = this.inferType(sampleValues);

        if (inferred === 'string' && sampleValues.every((v) => v === null || v === undefined)) {
          // Sparse column or no values in sample - try to inherit from source columns
          const foldedTypes = currentSchema
            .filter((c) => columns.includes(c.name))
            .map((c) => c.type);
          const uniqueTypes = [...new Set(foldedTypes)];
          if (uniqueTypes.length === 1) {
            valType = uniqueTypes[0];
          } else if (foldedTypes.every((t) => t === 'integer' || t === 'float')) {
            valType = 'float';
          } else {
            valType = 'string';
          }
        } else {
          valType = inferred;
        }
      } else {
        const foldedTypes = currentSchema
          .filter((c) => columns.includes(c.name))
          .map((c) => c.type);
        const uniqueTypes = [...new Set(foldedTypes)];
        if (uniqueTypes.length === 1) {
          valType = uniqueTypes[0];
        } else if (foldedTypes.every((t) => t === 'integer' || t === 'float')) {
          valType = 'float';
        } else {
          valType = 'string';
        }
      }

      newSchema.push({
        name: valueName,
        type: valType,
        format: {},
        originalPosition: pos++,
      });

      return newSchema;
    }

    // 9. PIVOT (Wide)
    if (transform.pivot) {
      const { rows, values, aggregation } = transform.pivot;

      // For pivot, we need sample data to know the new column names
      // since they come from the unique values of the key column
      if (sampleData && sampleData.length > 0) {
        const sampleColumns = Object.keys(sampleData[0]);
        const newSchema: ColumnSchema[] = [];
        let pos = 0;

        for (const colName of sampleColumns) {
          // Check if this is an existing column (row identity from rows array)
          const existing = currentSchema.find((c) => c.name === colName);
          if (existing && rows?.includes(colName)) {
            newSchema.push({ ...existing, originalPosition: pos++ });
          } else {
            // This is a pivoted column - determine type based on aggregation
            let type: ColumnType;
            const sampleValues = sampleData.map((row) => row[colName]);
            if (['count'].includes(aggregation)) {
              type = 'integer';
            } else if (
              ['sum', 'mean', 'avg', 'median', 'stdev', 'variance'].includes(aggregation)
            ) {
              type = 'float';
            } else {
              const inferred = this.inferType(sampleValues);
              if (
                inferred === 'string' &&
                sampleValues.every((v) => v === null || v === undefined)
              ) {
                // Sparse column - fallback to values column type
                const valCol = currentSchema.find((c) => c.name === values);
                type = valCol ? valCol.type : 'string';
              } else {
                type = inferred;
              }
            }

            newSchema.push({
              name: colName,
              type,
              format: {},
              originalPosition: pos++,
            });
          }
        }

        return newSchema;
      }

      // Fallback: keep row columns, can't determine pivoted columns without data
      const rowCols = rows || [];
      const newSchema = currentSchema.filter((c) => rowCols.includes(c.name));
      return newSchema.map((c, i) => ({ ...c, originalPosition: i }));
    }

    // 10. SPLIT: Split column into multiple columns
    if (transform.split) {
      const { column, mode, keepOriginal, maxColumns } = transform.split;

      let newSchema = [...currentSchema];

      if (!keepOriginal) {
        newSchema = newSchema.filter((c) => c.name !== column);
      }

      let newColumnNames: string[] = [];
      if (sampleData && sampleData.length > 0) {
        const sampleColumns = Object.keys(sampleData[0]);
        newColumnNames = sampleColumns.filter((name) => name.startsWith(`${column}_`));
      } else {
        if (mode === 'left' || mode === 'right') {
          newColumnNames = [`${column}_1`];
        } else if ((mode === 'firstN' || mode === 'lastN') && maxColumns) {
          for (let i = 1; i <= maxColumns; i++) {
            newColumnNames.push(`${column}_${i}`);
          }
        } else {
          newColumnNames = [`${column}_1`];
        }
      }

      let pos = newSchema.length;
      for (const newColName of newColumnNames) {
        let type: ColumnType = 'string';
        if (sampleData && sampleData.length > 0) {
          const sampleValues = sampleData.map((row) => row[newColName]);
          type = this.inferType(sampleValues);
        }

        newSchema.push({
          name: newColName,
          type: type,
          format: {},
          originalPosition: pos++,
        });
      }

      return newSchema;
    }

    // 11. SPREAD: Convert array column into multiple columns
    if (transform.spread) {
      const { column, keepOriginal } = transform.spread;

      // Remove the original column unless keepOriginal is true
      let newSchema = keepOriginal
        ? [...currentSchema]
        : currentSchema.filter((c) => c.name !== column);

      // Infer new columns from sample data
      if (sampleData && sampleData.length > 0) {
        const sampleColumns = Object.keys(sampleData[0]);
        const spreadColumns = sampleColumns.filter(
          (name) => !currentSchema.find((c) => c.name === name)
        );

        let pos = newSchema.length;
        for (const newColName of spreadColumns) {
          const sampleValues = sampleData.map((row) => row[newColName]);
          const type = this.inferType(sampleValues);

          newSchema.push({
            name: newColName,
            type: type,
            format: {},
            originalPosition: pos++,
          });
        }
      }

      return newSchema;
    }

    // 12. UNROLL: Expand array values into separate rows (schema mostly unchanged)
    if (transform.unroll) {
      const { column, indices } = transform.unroll;
      // Note: keepOriginal doesn't affect schema since unroll preserves/replaces the column in-place

      let newSchema = [...currentSchema];

      // If indices is true, add an index column named {column}__unroll_index
      if (indices) {
        const indexColName = `${column}__unroll_index`;
        const hasIndexColumn = newSchema.find((c) => c.name === indexColName);
        if (!hasIndexColumn) {
          newSchema.push({
            name: indexColName,
            type: 'integer',
            format: {},
            originalPosition: newSchema.length,
          });
        }
      }

      return newSchema;
    }

    // 13. CONCAT / UNION: Merge schemas from both tables
    if (transform.concat || transform.union) {
      if (sampleData && sampleData.length > 0) {
        return this.inferSchemaFromSample(currentSchema, sampleData, {
          updatePositions: true,
          promoteTypes: true,
          sampleSize: 50,
        });
      }
    }

    // 14. WINDOW: Add new columns from window functions
    if (transform.window) {
      const { derive } = transform.window;
      const nextSchema = [...currentSchema];

      for (const [newColName, exprString] of Object.entries(derive)) {
        const existingIndex = nextSchema.findIndex((c) => c.name === newColName);

        // Infer type from function name
        let type: ColumnType = 'float'; // Default for most window functions
        const funcMatch = typeof exprString === 'string' ? exprString.match(/^op\.(\w+)/) : null;
        const funcName = funcMatch ? funcMatch[1] : '';

        // row_number, rank, dense_rank, ntile, count return integers
        if (['row_number', 'rank', 'dense_rank', 'ntile', 'count'].includes(funcName)) {
          type = 'integer';
        }
        // percent_rank, cume_dist, avg_rank, mean, stdev, variance always return floats
        else if (
          ['percent_rank', 'cume_dist', 'avg_rank', 'mean', 'stdev', 'variance'].includes(funcName)
        ) {
          type = 'float';
        }
        // Functions that inherit type from source column:
        // - Window: lag, lead, first_value, last_value, nth_value, fill_down, fill_up
        // - Aggregate: sum, min, max, product, median, mode
        else if (
          [
            'lag',
            'lead',
            'first_value',
            'last_value',
            'nth_value',
            'fill_down',
            'fill_up',
            'sum',
            'min',
            'max',
            'product',
            'median',
            'mode',
          ].includes(funcName)
        ) {
          const colMatch =
            typeof exprString === 'string' ? exprString.match(/\(['"]?([^'",]+)['"]?/) : null;
          if (colMatch) {
            const sourceCol = currentSchema.find((c) => c.name === colMatch[1]);
            if (sourceCol) type = sourceCol.type;
          }
        }

        // Override with sample data if available
        if (sampleData && sampleData.length > 0) {
          const sampleValues = sampleData.map((row) => row[newColName]);
          type = this.inferType(sampleValues);
        }

        const newColSchema: ColumnSchema = {
          name: newColName,
          type,
          format: {},
          originalPosition:
            existingIndex !== -1 ? nextSchema[existingIndex].originalPosition : nextSchema.length,
        };

        if (existingIndex !== -1) {
          nextSchema[existingIndex] = newColSchema;
        } else {
          nextSchema.push(newColSchema);
        }
      }
      return nextSchema;
    }

    // PROMOTE HEADER: Uses a data row as new column names
    if (transform.promoteHeader) {
      if (sampleData && sampleData.length > transform.promoteHeader.skipRows) {
        const headerRow = sampleData[transform.promoteHeader.skipRows];
        const oldColumns = currentSchema.map((c) => c.name);
        const remainingData = sampleData.slice(transform.promoteHeader.skipRows + 1);

        // Build new column names from header row values
        const seen: Record<string, number> = {};
        const newSchema: ColumnSchema[] = oldColumns.map((oldCol, i) => {
          let newName = headerRow[oldCol];
          if (newName == null || String(newName).trim() === '') {
            newName = `Column ${i + 1}`;
          } else {
            newName = String(newName).trim();
          }
          // Deduplicate
          if (seen[newName] !== undefined) {
            seen[newName]++;
            newName = `${newName}_${seen[newName]}`;
          } else {
            seen[newName] = 1;
          }
          // Infer type from remaining data
          const sample = remainingData.slice(0, 20).map((row) => row[oldCol]);
          return {
            name: newName,
            type: this.inferType(sample),
            format: {},
            originalPosition: i,
          };
        });
        return newSchema;
      }
      // Fallback: can't determine new names without data, return current schema
      return currentSchema.map((c) => ({ ...c }));
    }

    // Future-proofing: Check for unknown transform keys
    // Note: 'import', 'replace', 'sliceRows', 'addIndex', 'dedupe' don't change schema,
    // so they may not have explicit handlers above
    const knownKeys = [
      'select',
      'remove',
      'rename',
      'derive',
      'filter',
      'sort',
      'replace',
      'dedupe',
      'join',
      'import',
      'types',
      'aggregate',
      'fold',
      'pivot',
      'split',
      'sliceRows',
      'addIndex',
      'impute',
      'selectPattern',
      'removePattern',
      'describe',
      'conditional',
      'renamePattern',
      'concat',
      'union',
      'sample',
      'semijoin',
      'antijoin',
      'lookup',
      'spread',
      'unroll',
      'window',
      'removeRows',
      'keepRows',
      'promoteHeader',
    ];
    const transformKeys = Object.keys(transform).filter((k) => k !== '__v'); // Ignore version field
    const unknownKey = transformKeys.find((k) => !knownKeys.includes(k));

    if (unknownKey) {
      console.warn(
        `SchemaEngine: Unknown transform key "${unknownKey}" encountered in deriveNextSchema. ` +
          `Schema will remain unchanged. This may be from a newer version of Syto.`
      );
    }

    // Return schema unchanged (for transforms that don't modify schema or unknown transforms)
    return currentSchema.map((c) => ({ ...c }));
  },

  /**
   * Normalize schema columns by converting unknown types to 'string' (future-proofing)
   * Called when loading data from IndexedDB to handle potentially unknown types
   */
  normalizeSchema(schema: ColumnSchema[]): ColumnSchema[] {
    return schema.map((col) => {
      if (!KNOWN_COLUMN_TYPES.includes(col.type)) {
        console.warn(
          `Unknown column type "${col.type}" for column "${col.name}", treating as string`
        );
        return { ...col, type: 'string' as ColumnType };
      }
      return col;
    });
  },

  /**
   * Compare two schemas to detect differences (missing/new columns, type changes)
   */
  compareSchemas(oldSchema: ColumnSchema[], newSchema: ColumnSchema[]): SchemaDiff {
    const oldCols = oldSchema.map((c) => c.name);
    const newCols = newSchema.map((c) => c.name);

    const missingColumns = oldCols.filter((name) => !newCols.includes(name));
    const newColumns = newCols.filter((name) => !oldCols.includes(name));

    const typeChanges: Array<{ column: string; oldType: ColumnType; newType: ColumnType }> = [];
    for (const oldCol of oldSchema) {
      const newCol = newSchema.find((c) => c.name === oldCol.name);
      if (newCol && newCol.type !== oldCol.type) {
        typeChanges.push({
          column: oldCol.name,
          oldType: oldCol.type,
          newType: newCol.type,
        });
      }
    }

    let compatibilityWarning: string | null = null;
    if (missingColumns.length > 0) {
      compatibilityWarning = `Warning: The new data is missing ${missingColumns.length} column(s) that exist in the current source. Dependent models may break when recomputed.`;
    }

    return {
      missingColumns,
      newColumns,
      typeChanges,
      compatibilityWarning,
    };
  },
};
