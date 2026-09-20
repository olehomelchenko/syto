import * as aq from 'arquero';
import { parseExpression } from '../../expression-parser';
import { validateAST } from '../../ast-validator';
import { interpretAST } from '../../ast-interpreter';
import { isConversionError } from '../../type-converter';
import type { FullTransformStep } from '../types';

export function handleFilter(table: any, transform: FullTransformStep, schema: string[]): any {
  const expression = transform.filter!;
  const ast = parseExpression(expression);
  const validation = validateAST(ast, schema);
  if (!validation.valid) {
    throw new Error(`Filter validation failed: ${validation.error?.message}`);
  }

  const rows = table.objects();
  const filteredRows = rows.filter((row: any) => {
    try {
      const result = interpretAST(ast, row);
      // ConversionError objects are truthy in JS but should not pass filters
      return !!result && !isConversionError(result);
    } catch (error) {
      return false;
    }
  });

  if (filteredRows.length === 0 && rows.length > 0) {
    const emptyRow: any = {};
    table.columnNames().forEach((col: string) => (emptyRow[col] = undefined));
    return (aq as any).from([emptyRow]).filter(() => false);
  } else {
    // TODO(2026-05-03): when the input is already empty (rows.length === 0) we fall through
    // to aq.from([]) and lose column names. Filter idempotence on an empty
    // result therefore breaks schema. See property-filter.test.ts idempotence
    // carve-out. Fix would mirror the schema-preservation branch above whenever
    // filteredRows is empty, regardless of input row count.
    return (aq as any).from(filteredRows);
  }
}

export function handleConditional(table: any, transform: FullTransformStep, schema: string[]): any {
  const { column, conditions, else: elseValue } = transform.conditional!;
  let resultRows = table.objects();

  // Validate all expressions first
  for (const cond of conditions) {
    const whenAST = parseExpression(cond.when);
    const whenValidation = validateAST(whenAST, schema);
    if (!whenValidation.valid) {
      throw new Error(`Conditional validation failed for 'when': ${whenValidation.error?.message}`);
    }

    const thenAST = parseExpression(cond.then);
    const thenValidation = validateAST(thenAST, schema);
    if (!thenValidation.valid) {
      throw new Error(`Conditional validation failed for 'then': ${thenValidation.error?.message}`);
    }
  }

  const elseAST = parseExpression(elseValue);
  const elseValidation = validateAST(elseAST, schema);
  if (!elseValidation.valid) {
    throw new Error(`Conditional validation failed for 'else': ${elseValidation.error?.message}`);
  }

  // Evaluate conditions sequentially
  resultRows = resultRows.map((row: any) => {
    let result: any = null;
    let matched = false;

    for (const cond of conditions) {
      if (!matched) {
        try {
          const whenAST = parseExpression(cond.when);
          const whenValue = interpretAST(whenAST, row);
          if (whenValue === true) {
            const thenAST = parseExpression(cond.then);
            result = interpretAST(thenAST, row);
            matched = true;
          }
        } catch (error: any) {
          // Skip this condition on error
        }
      }
    }

    if (!matched) {
      try {
        result = interpretAST(elseAST, row);
      } catch (error: any) {
        result = { type: 'error', message: error.message };
      }
    }

    return { ...row, [column]: result };
  });

  return (aq as any).from(resultRows);
}

export function handleReplace(table: any, transform: FullTransformStep): any {
  const { column, find, replace, isRegex, matchMode } = transform.replace!;
  const rows = table.objects();

  if (matchMode) {
    const shouldReplace =
      matchMode === 'errors'
        ? (v: any) => isConversionError(v)
        : (v: any) => v === null || v === undefined;
    return (aq as any).from(
      rows.map((row: any) => (shouldReplace(row[column]) ? { ...row, [column]: replace } : row))
    );
  }

  const resultRows = rows.map((row: any) => {
    const currentValue = row[column];

    if (isRegex) {
      // Regex mode: use string replacement with regex
      if (currentValue == null) return row;
      try {
        // Parse flags if present (e.g., (?i) for case-insensitive)
        const flagMatch = find.match(/^\(\?([gimsuy]+)\)/);
        let pattern = find;
        let flags = 'g'; // Always global replace
        if (flagMatch) {
          pattern = find.slice(flagMatch[0].length);
          flags = flagMatch[1].includes('g') ? flagMatch[1] : flagMatch[1] + 'g';
        }
        const regex = new RegExp(pattern, flags);
        const newValue = String(currentValue).replace(regex, replace ?? '');
        return { ...row, [column]: newValue };
      } catch (e) {
        // If regex is invalid, return row unchanged
        console.error('Invalid regex in replace transform:', e);
        return row;
      }
    } else {
      // Simple mode: exact value match
      if (currentValue === find || (find === null && currentValue === null)) {
        return { ...row, [column]: replace };
      }
      return row;
    }
  });
  return (aq as any).from(resultRows);
}

export const filterHandlers = {
  filter: handleFilter,
  conditional: handleConditional,
  replace: handleReplace,
};
