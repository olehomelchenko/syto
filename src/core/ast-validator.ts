import safeRegex from 'safe-regex2';
import { ASTNode } from './expression-parser';

/**
 * Syto AST Validator - Security and schema validation
 */

const ALLOWED_NODE_TYPES = new Set([
  'Literal',
  'Identifier',
  'BinaryExpression',
  'LogicalExpression',
  'UnaryExpression',
  'ConditionalExpression',
  'CallExpression',
  'LetExpression',
]);

const ALLOWED_OPS = {
  binary: new Set([
    '+',
    '-',
    '*',
    '/',
    '%',
    '>',
    '<',
    '>=',
    '<=',
    '==',
    '===',
    '!=',
    '!==',
    '&&',
    '||',
    '??',
    // Word-form boolean operators (beginner-friendly alternatives)
    'and',
    'or',
  ]),
  logical: new Set(['&&', '||', '??', 'and', 'or']),
  unary: new Set(['!', '-', '+', 'not']),
};

export interface FunctionSpec {
  minArgs: number;
  maxArgs: number;
}

export const ALLOWED_FUNCTIONS: Record<string, FunctionSpec> = {
  // Regex functions
  regexp_match: { minArgs: 2, maxArgs: 2 },
  regexp_extract: { minArgs: 2, maxArgs: 3 },
  regexp_replace: { minArgs: 3, maxArgs: 3 },

  // Date extraction - Phase 1
  year: { minArgs: 1, maxArgs: 1 },
  month: { minArgs: 1, maxArgs: 1 },
  day: { minArgs: 1, maxArgs: 1 },
  hour: { minArgs: 1, maxArgs: 1 },
  minute: { minArgs: 1, maxArgs: 1 },
  second: { minArgs: 1, maxArgs: 1 },

  // Date extraction - Phase 2
  weekday: { minArgs: 1, maxArgs: 1 },
  week: { minArgs: 1, maxArgs: 1 },
  quarter: { minArgs: 1, maxArgs: 1 },

  // Date utilities - Phase 3
  today: { minArgs: 0, maxArgs: 0 },
  now: { minArgs: 0, maxArgs: 0 },

  // Date arithmetic - Phase 4
  days_between: { minArgs: 2, maxArgs: 2 },
  date_add: { minArgs: 3, maxArgs: 3 },
  date_trunc: { minArgs: 2, maxArgs: 3 },
  format_date: { minArgs: 2, maxArgs: 2 },
  parse_date: { minArgs: 2, maxArgs: 2 },

  // String functions
  upper: { minArgs: 1, maxArgs: 1 },
  lower: { minArgs: 1, maxArgs: 1 },
  titlecase: { minArgs: 1, maxArgs: 1 },
  trim: { minArgs: 1, maxArgs: 1 },
  substring: { minArgs: 2, maxArgs: 3 },
  len: { minArgs: 1, maxArgs: 1 },
  split: { minArgs: 2, maxArgs: 3 },

  // String comparison functions
  equals: { minArgs: 2, maxArgs: 2 },
  contains: { minArgs: 2, maxArgs: 2 },
  starts_with: { minArgs: 2, maxArgs: 2 },
  ends_with: { minArgs: 2, maxArgs: 2 },

  // Case-insensitive comparison functions
  equals_ci: { minArgs: 2, maxArgs: 2 },
  contains_ci: { minArgs: 2, maxArgs: 2 },
  starts_with_ci: { minArgs: 2, maxArgs: 2 },
  ends_with_ci: { minArgs: 2, maxArgs: 2 },

  // Math functions
  abs: { minArgs: 1, maxArgs: 1 },
  pow: { minArgs: 2, maxArgs: 2 },
  sqrt: { minArgs: 1, maxArgs: 1 },
  cbrt: { minArgs: 1, maxArgs: 1 },
  exp: { minArgs: 1, maxArgs: 1 },
  ln: { minArgs: 1, maxArgs: 1 },
  log10: { minArgs: 1, maxArgs: 1 },
  log2: { minArgs: 1, maxArgs: 1 },
  sin: { minArgs: 1, maxArgs: 1 },
  cos: { minArgs: 1, maxArgs: 1 },
  tan: { minArgs: 1, maxArgs: 1 },
  asin: { minArgs: 1, maxArgs: 1 },
  acos: { minArgs: 1, maxArgs: 1 },
  atan: { minArgs: 1, maxArgs: 1 },
  atan2: { minArgs: 2, maxArgs: 2 },
  radians: { minArgs: 1, maxArgs: 1 },
  degrees: { minArgs: 1, maxArgs: 1 },
  sign: { minArgs: 1, maxArgs: 1 },
  trunc: { minArgs: 1, maxArgs: 1 },
  pi: { minArgs: 0, maxArgs: 0 },
  e: { minArgs: 0, maxArgs: 0 },
  round: { minArgs: 1, maxArgs: 2 },
  floor: { minArgs: 1, maxArgs: 1 },
  ceil: { minArgs: 1, maxArgs: 1 },
  min: { minArgs: 1, maxArgs: Infinity },
  max: { minArgs: 1, maxArgs: Infinity },

  // Type conversion
  parse_int: { minArgs: 1, maxArgs: 1 },
  parse_float: { minArgs: 1, maxArgs: 1 },
  is_nan: { minArgs: 1, maxArgs: 1 },
  is_error: { minArgs: 1, maxArgs: 1 },
  if: { minArgs: 3, maxArgs: 3 },
  coalesce: { minArgs: 1, maxArgs: Infinity },

  // JSON functions
  is_json: { minArgs: 1, maxArgs: 1 },
  json_extract: { minArgs: 2, maxArgs: 2 },
  json_keys: { minArgs: 1, maxArgs: 1 },
  json_array_length: { minArgs: 1, maxArgs: 1 },
  json_type: { minArgs: 1, maxArgs: 1 },
  json_stringify: { minArgs: 1, maxArgs: 1 },
};

export interface ValidationResult {
  valid: boolean;
  error?: {
    message: string;
    position: number;
    type: string;
    suggestion?: string;
    [key: string]: any;
  };
}

/**
 * Find the closest match to `input` from `candidates` using Levenshtein distance.
 * Returns the match if within a reasonable threshold, otherwise undefined.
 */
export function findClosestMatch(input: string, candidates: string[]): string | undefined {
  if (candidates.length === 0) return undefined;

  const inputLower = input.toLowerCase();
  let bestMatch: string | undefined;
  let bestDistance = Infinity;

  for (const candidate of candidates) {
    const dist = levenshtein(inputLower, candidate.toLowerCase());
    if (dist < bestDistance) {
      bestDistance = dist;
      bestMatch = candidate;
    }
  }

  // Threshold: allow up to 40% of the longer string's length, minimum 1, maximum 3
  const maxLen = Math.max(input.length, bestMatch?.length ?? 0);
  const threshold = Math.min(3, Math.max(1, Math.floor(maxLen * 0.4)));

  return bestDistance <= threshold ? bestMatch : undefined;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);

  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }

  return dp[n];
}

export function validateAST(ast: ASTNode, schema: string[]): ValidationResult {
  try {
    validateNode(ast, schema);
    return { valid: true };
  } catch (error: any) {
    return {
      valid: false,
      error: {
        message: error.message,
        position: error.position || 0,
        type: error.type || 'validation-error',
        ...error,
      },
    };
  }
}

function validateNode(node: ASTNode, schema: string[]) {
  if (!node || typeof node !== 'object') {
    throw { message: 'Invalid AST node', position: 0 };
  }

  if (!ALLOWED_NODE_TYPES.has(node.type)) {
    throw {
      message: `Expression type '${node.type}' is not allowed`,
      position: node.start || 0,
      type: 'disallowed-node-type',
    };
  }

  switch (node.type) {
    case 'Literal':
      break;

    case 'Identifier':
      if (node.name && !schema.includes(node.name)) {
        const suggestion = findClosestMatch(node.name, schema);
        throw {
          message: `Column '${node.name}' not found`,
          position: node.start || 0,
          type: 'unknown-column',
          columnName: node.name,
          availableColumns: schema,
          ...(suggestion && { suggestion }),
        };
      }
      break;

    case 'BinaryExpression':
    case 'LogicalExpression':
      const opSet = node.type === 'LogicalExpression' ? ALLOWED_OPS.logical : ALLOWED_OPS.binary;
      if (node.operator && !opSet.has(node.operator)) {
        throw {
          message: `Operator '${node.operator}' is not allowed`,
          position: node.start || 0,
          type: 'disallowed-operator',
        };
      }
      if (node.left) validateNode(node.left, schema);
      if (node.right) validateNode(node.right, schema);
      break;

    case 'UnaryExpression':
      if (node.operator && !ALLOWED_OPS.unary.has(node.operator)) {
        throw {
          message: `Unary operator '${node.operator}' is not allowed`,
          position: node.start || 0,
          type: 'disallowed-operator',
        };
      }
      if (node.argument) validateNode(node.argument, schema);
      break;

    case 'ConditionalExpression':
      if (node.test) validateNode(node.test, schema);
      if (node.consequent) validateNode(node.consequent, schema);
      if (node.alternate) validateNode(node.alternate, schema);
      break;

    case 'CallExpression':
      validateCallExpression(node, schema);
      break;

    case 'LetExpression': {
      if (!Array.isArray(node.bindings) || node.bindings.length === 0 || !node.body) {
        throw {
          message: 'Malformed let expression',
          position: node.start || 0,
          type: 'malformed-let',
        };
      }
      let scope = schema;
      for (const binding of node.bindings) {
        if (!binding.name || typeof binding.name !== 'string' || !binding.value) {
          throw {
            message: 'Malformed let binding',
            position: node.start || 0,
            type: 'malformed-let',
          };
        }
        if (ALLOWED_FUNCTIONS[binding.name]) {
          throw {
            message: `Cannot use function name '${binding.name}' as let binding`,
            position: node.start || 0,
            type: 'reserved-name',
          };
        }
        validateNode(binding.value, scope);
        scope = scope.includes(binding.name) ? scope : [...scope, binding.name];
      }
      validateNode(node.body, scope);
      break;
    }
  }
}

function validateCallExpression(node: ASTNode, schema: string[]) {
  if (!node.callee || node.callee.type !== 'Identifier') {
    throw {
      message: 'Invalid function call syntax',
      position: node.start || 0,
      type: 'invalid-call',
    };
  }

  const fnName = node.callee.name!;
  const fnSpec = ALLOWED_FUNCTIONS[fnName];

  if (!fnSpec) {
    const suggestion = findClosestMatch(fnName, Object.keys(ALLOWED_FUNCTIONS));
    throw {
      message: `Function '${fnName}' is not allowed`,
      position: node.callee.start || 0,
      type: 'unknown-function',
      ...(suggestion && { suggestion }),
    };
  }

  const argCount = node.arguments ? node.arguments.length : 0;
  if (argCount < fnSpec.minArgs || argCount > fnSpec.maxArgs) {
    const expected =
      fnSpec.minArgs === fnSpec.maxArgs
        ? `${fnSpec.minArgs}`
        : `${fnSpec.minArgs}-${fnSpec.maxArgs}`;
    throw {
      message: `Function '${fnName}' expects ${expected} arguments, got ${argCount}`,
      position: node.start || 0,
      type: 'wrong-arity',
    };
  }

  if (node.arguments) {
    node.arguments.forEach((arg) => validateNode(arg, schema));
  }

  if (fnName === 'regexp_match' || fnName === 'regexp_extract' || fnName === 'regexp_replace') {
    const patternArg = node.arguments![1];
    if (patternArg && patternArg.type === 'Literal' && typeof patternArg.value === 'string') {
      validateRegexPattern(patternArg.value, patternArg.start || 0);
    }
  }
}

function parseRegexFlags(pattern: string) {
  const flagMatch = pattern.match(/^\(\?([gimsuy]+)\)/);
  if (flagMatch) {
    return {
      pattern: pattern.slice(flagMatch[0].length),
      flags: flagMatch[1],
    };
  }
  return { pattern, flags: '' };
}

function validateRegexPattern(pattern: string, position: number) {
  let parsed: { pattern: string; flags: string };
  try {
    parsed = parseRegexFlags(pattern);
    new RegExp(parsed.pattern, parsed.flags);
  } catch (e: any) {
    throw {
      message: `Invalid regex pattern: ${e.message}`,
      position,
      type: 'invalid-regex',
    };
  }

  // SOUL §1: reject patterns prone to catastrophic backtracking. A pattern
  // like (a+)+ compiles fine but freezes the tab on long inputs, which would
  // be a denial-of-service surface for any user (or LLM-generated workflow)
  // that lands an unsafe pattern. Phase 1 covers literal patterns only;
  // dynamic patterns (column references) skip validation. See BACKLOG.md
  // for Phase 2 (RE2-WASM at execution time).
  if (!safeRegex(parsed.pattern)) {
    throw {
      message:
        'Regex pattern may cause catastrophic backtracking. Avoid nested quantifiers (e.g. (a+)+ or (.*)*).',
      position,
      type: 'unsafe-regex',
    };
  }
}
