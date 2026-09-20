/**
 * StreamLanguage tokenizer for the Syto expression syntax.
 * Used by ExpressionEditor to provide syntax highlighting and autocomplete.
 */

import { StreamLanguage, StringStream } from '@codemirror/language';
import { CompletionContext, CompletionResult, Completion } from '@codemirror/autocomplete';
import { ALLOWED_FUNCTIONS } from '../../core/ast-validator';
import type { ColumnSchema, ColumnType } from '../../core/schema-engine';
import functionDocs from '../../schemas/functions.json';

/** Expression context determines which function categories get boosted */
export type ExpressionContext = 'filter' | 'derive' | 'conditional';

const FUNCTION_NAMES = new Set(Object.keys(ALLOWED_FUNCTIONS));
const KEYWORDS = new Set(['true', 'false', 'null', 'let', 'in']);
const OPERATOR_KEYWORDS = new Set(['and', 'or', 'not']);

interface ExpressionState {
  /** Columns available for highlighting */
  columns: Set<string>;
}

function tokenize(stream: StringStream, state: ExpressionState): string | null {
  // Skip whitespace
  if (stream.eatSpace()) return null;

  const ch = stream.peek();

  // Strings: "..." or '...'
  if (ch === '"' || ch === "'") {
    const quote = ch;
    stream.next();
    while (!stream.eol()) {
      const c = stream.next();
      if (c === '\\') {
        stream.next(); // skip escaped char
      } else if (c === quote) {
        return 'string';
      }
    }
    return 'string'; // unterminated string
  }

  // Bracketed column references: [column name]
  if (ch === '[') {
    stream.next();
    while (!stream.eol()) {
      if (stream.next() === ']') {
        return 'variableName special';
      }
    }
    return 'variableName special'; // unterminated bracket
  }

  // Numbers: 42, 3.14
  if (ch && /\d/.test(ch)) {
    stream.match(/^\d+(\.\d+)?/);
    return 'number';
  }

  // Multi-char operators
  if (stream.match('===') || stream.match('!==')) return 'operator';
  if (stream.match('==') || stream.match('!=')) return 'operator';
  if (stream.match('>=') || stream.match('<=')) return 'operator';
  if (stream.match('&&') || stream.match('||') || stream.match('??')) return 'operator';

  // Single-char operators and punctuation
  if (ch && '+-*/%><!'.includes(ch)) {
    stream.next();
    return 'operator';
  }

  if (ch && '(),.?:'.includes(ch)) {
    stream.next();
    return 'punctuation';
  }

  // Identifiers, keywords, functions, columns
  if (ch && /[a-zA-Z_]/.test(ch)) {
    stream.match(/^[a-zA-Z_]\w*/);
    const word = stream.current();

    // Check operator keywords first
    if (OPERATOR_KEYWORDS.has(word)) return 'operatorKeyword';

    // Check keywords
    if (KEYWORDS.has(word)) return 'keyword';

    // Check if followed by ( — if so, it's a function call
    if (stream.peek() === '(' && FUNCTION_NAMES.has(word)) return 'function definition';

    // Check if it's a known column
    if (state.columns.has(word)) return 'variableName';

    // Unknown identifier — could be a column not yet recognized
    return 'variableName';
  }

  // Skip unknown characters
  stream.next();
  return null;
}

/**
 * Creates a StreamLanguage instance for the expression syntax.
 * @param columns - Set of column names to highlight as variables
 */
export function createExpressionLanguage(columns: Set<string>) {
  return StreamLanguage.define<ExpressionState>({
    startState: () => ({ columns }),
    token: tokenize,
  });
}

// Build function completions from generated docs (single source of truth)
const functionDescriptionMap = new Map(functionDocs.functions.map((fn) => [fn.name, fn]));

/** Map from function category (in functions.json) to column types it's relevant for */
const CATEGORY_TYPE_RELEVANCE: Record<string, ColumnType[]> = {
  Date: ['date', 'datetime'],
  Text: ['string'],
  Regex: ['string'],
  Math: ['integer', 'float'],
  JSON: ['json'],
  Conversion: [], // relevant for all types
};

/** Functions especially useful in filter context (comparisons, checks) */
const FILTER_BOOSTED = new Set([
  'contains',
  'starts_with',
  'ends_with',
  'equals',
  'equals_ci',
  'contains_ci',
  'starts_with_ci',
  'ends_with_ci',
  'regexp_match',
  'is_nan',
  'is_error',
  'is_json',
  'year',
  'month',
  'day',
  'weekday',
]);

/** Functions especially useful in derive context (transforms, constructors) */
const DERIVE_BOOSTED = new Set([
  'if',
  'coalesce',
  'upper',
  'lower',
  'trim',
  'regexp_replace',
  'substring',
  'round',
  'abs',
  'log10',
  'sqrt',
  'parse_int',
  'parse_float',
  'format_date',
  'date_add',
  'date_trunc',
  'regexp_replace',
  'regexp_extract',
  'json_extract',
]);

interface FunctionCompletionBase {
  label: string;
  type: 'function';
  detail: string;
  info: string | undefined;
  apply: string;
  category: string;
}

function buildFunctionCompletionBases(): FunctionCompletionBase[] {
  return Object.keys(ALLOWED_FUNCTIONS).map((name) => {
    const doc = functionDescriptionMap.get(name);
    return {
      label: name,
      type: 'function' as const,
      detail: doc?.signature ?? name + '()',
      info: doc?.description,
      apply: name + '(',
      category: doc?.category ?? '',
    };
  });
}

const KEYWORD_COMPLETIONS: Completion[] = [
  { label: 'true', type: 'keyword' },
  { label: 'false', type: 'keyword' },
  { label: 'null', type: 'keyword' },
  { label: 'and', type: 'keyword', detail: 'logical AND (&&)' },
  { label: 'or', type: 'keyword', detail: 'logical OR (||)' },
  { label: 'not', type: 'keyword', detail: 'logical NOT (!)' },
  { label: 'let', type: 'keyword', detail: 'local binding: let x = ... in ...' },
  { label: 'in', type: 'keyword', detail: 'body of let binding' },
];

const FUNCTION_COMPLETION_BASES = buildFunctionCompletionBases();

/**
 * Compute the set of column types present in the schema.
 * Used to determine which function categories are relevant.
 */
function getColumnTypes(schema: ColumnSchema[]): Set<ColumnType> {
  const types = new Set<ColumnType>();
  for (const col of schema) {
    types.add(col.type);
  }
  return types;
}

/**
 * Creates an autocomplete source for expression inputs.
 * Suggests column names, function names, and keywords.
 *
 * When schema and context are provided, functions relevant to the
 * column types and expression context are boosted to appear first.
 */
export function createExpressionCompletion(
  columns: string[],
  schema?: ColumnSchema[],
  expressionContext?: ExpressionContext
) {
  // Pre-compute type-relevant categories
  const columnTypes = schema?.length ? getColumnTypes(schema) : null;

  const contextBoostSet =
    expressionContext === 'filter'
      ? FILTER_BOOSTED
      : expressionContext === 'derive' || expressionContext === 'conditional'
        ? DERIVE_BOOSTED
        : null;

  // Build function completions with context-aware boost
  const functionCompletions: Completion[] = FUNCTION_COMPLETION_BASES.map((base) => {
    let boost = 1;

    if (columnTypes) {
      const relevantTypes = CATEGORY_TYPE_RELEVANCE[base.category];
      // Conversion functions are relevant for all types → always boost when schema is present
      if (
        relevantTypes &&
        (relevantTypes.length === 0 || relevantTypes.some((t) => columnTypes.has(t)))
      ) {
        boost = 3;
      }
    }

    if (contextBoostSet?.has(base.label)) {
      boost += 1;
    }

    return {
      label: base.label,
      type: base.type,
      detail: base.detail,
      info: base.info,
      apply: base.apply,
      boost,
    };
  });

  return (context: CompletionContext): CompletionResult | null => {
    // Match word characters, optionally preceded by [ for bracketed column refs
    const word = context.matchBefore(/\[[\w\s]*|[\w]*/);
    if (!word || (word.from === word.to && !context.explicit)) return null;

    const columnCompletions: Completion[] = columns.map((col) => ({
      label: `[${col}]`,
      type: 'variable',
      boost: 2, // prioritize columns over non-boosted functions
    }));

    return {
      from: word.from,
      options: [...columnCompletions, ...functionCompletions, ...KEYWORD_COMPLETIONS],
      validFor: /^(\[[\w\s]*\]?|\w*)$/,
    };
  };
}
