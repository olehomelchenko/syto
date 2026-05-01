import { describe, it, expect } from 'vitest';
import { parseExpression } from './expression-parser';
import { validateAST, findClosestMatch } from './ast-validator';

describe('findClosestMatch', () => {
  const columns = ['sales', 'revenue', 'cost', 'region', 'order_date'];

  it('should find exact match', () => {
    expect(findClosestMatch('sales', columns)).toBe('sales');
  });

  it('should find match with one character swapped', () => {
    expect(findClosestMatch('salse', columns)).toBe('sales');
  });

  it('should find match with one character missing', () => {
    expect(findClosestMatch('sles', columns)).toBe('sales');
  });

  it('should find match with one extra character', () => {
    expect(findClosestMatch('saless', columns)).toBe('sales');
  });

  it('should be case-insensitive', () => {
    expect(findClosestMatch('Sales', columns)).toBe('sales');
    expect(findClosestMatch('REVENUE', columns)).toBe('revenue');
  });

  it('should return undefined when no close match', () => {
    expect(findClosestMatch('zzzzz', columns)).toBeUndefined();
  });

  it('should return undefined for empty candidates', () => {
    expect(findClosestMatch('sales', [])).toBeUndefined();
  });

  it('should handle short strings', () => {
    expect(findClosestMatch('ab', ['a', 'abc', 'xyz'])).toBe('a');
  });
});

describe('AST Validator', () => {
  const testSchema = ['sales', 'revenue', 'cost', 'region', 'status', 'active'];

  describe('validateAST()', () => {
    it('should validate simple identifier', () => {
      const ast = parseExpression('sales');
      const result = validateAST(ast, testSchema);
      expect(result.valid).toBe(true);
    });

    it('should validate numeric literal', () => {
      const ast = parseExpression('1000');
      const result = validateAST(ast, testSchema);
      expect(result.valid).toBe(true);
    });

    it('should validate string literal', () => {
      const ast = parseExpression('"North"');
      const result = validateAST(ast, testSchema);
      expect(result.valid).toBe(true);
    });

    it('should validate simple comparison', () => {
      const ast = parseExpression('sales > 1000');
      const result = validateAST(ast, testSchema);
      expect(result.valid).toBe(true);
    });

    it('should validate equality check', () => {
      const ast = parseExpression('region == "North"');
      const result = validateAST(ast, testSchema);
      expect(result.valid).toBe(true);
    });

    it('should validate logical AND', () => {
      const ast = parseExpression('sales > 1000 && region == "North"');
      const result = validateAST(ast, testSchema);
      expect(result.valid).toBe(true);
    });

    it('should validate logical OR', () => {
      const ast = parseExpression('status == "active" || status == "pending"');
      const result = validateAST(ast, testSchema);
      expect(result.valid).toBe(true);
    });

    it('should validate logical NOT', () => {
      const ast = parseExpression('!active');
      const result = validateAST(ast, testSchema);
      expect(result.valid).toBe(true);
    });

    // Word-form boolean operators (beginner-friendly syntax)
    it('should validate word-form "and" operator', () => {
      const ast = parseExpression('sales > 1000 and region == "North"');
      const result = validateAST(ast, testSchema);
      expect(result.valid).toBe(true);
    });

    it('should validate word-form "or" operator', () => {
      const ast = parseExpression('status == "active" or status == "pending"');
      const result = validateAST(ast, testSchema);
      expect(result.valid).toBe(true);
    });

    it('should validate word-form "not" operator', () => {
      const ast = parseExpression('not active');
      const result = validateAST(ast, testSchema);
      expect(result.valid).toBe(true);
    });

    it('should validate mixed word-form and symbolic operators', () => {
      const ast = parseExpression('(sales > 1000 and region == "North") or !active');
      const result = validateAST(ast, testSchema);
      expect(result.valid).toBe(true);
    });

    it('should validate complex nested word-form expression', () => {
      const ast = parseExpression('(sales > 1000 or revenue > 500) and not active');
      const result = validateAST(ast, testSchema);
      expect(result.valid).toBe(true);
    });

    it('should validate arithmetic operators', () => {
      const ast = parseExpression('revenue - cost');
      const result = validateAST(ast, testSchema);
      expect(result.valid).toBe(true);
    });

    it('should validate all arithmetic operators', () => {
      const operators = ['+', '-', '*', '/', '%'];
      operators.forEach((op) => {
        const ast = parseExpression(`revenue ${op} cost`);
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });
    });

    it('should validate all comparison operators', () => {
      const operators = ['>', '<', '>=', '<=', '==', '===', '!=', '!=='];
      operators.forEach((op) => {
        const ast = parseExpression(`sales ${op} 1000`);
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });
    });

    it('should validate all unary operators', () => {
      const ast1 = parseExpression('!active');
      const result1 = validateAST(ast1, testSchema);
      expect(result1.valid).toBe(true);

      const ast2 = parseExpression('-sales');
      const result2 = validateAST(ast2, testSchema);
      expect(result2.valid).toBe(true);

      const ast3 = parseExpression('+sales');
      const result3 = validateAST(ast3, testSchema);
      expect(result3.valid).toBe(true);
    });

    it('should validate complex nested expression', () => {
      const ast = parseExpression('(sales > 1000 && region == "North") || status == "VIP"');
      const result = validateAST(ast, testSchema);
      expect(result.valid).toBe(true);
    });

    it('should validate grouped expression', () => {
      const ast = parseExpression('(revenue - cost) / revenue * 100');
      const result = validateAST(ast, testSchema);
      expect(result.valid).toBe(true);
    });

    it('should reject unknown column', () => {
      const ast = parseExpression('unknownColumn > 1000');
      const result = validateAST(ast, testSchema);
      expect(result.valid).toBe(false);
      expect(result.error?.type).toBe('unknown-column');
      expect(result.error?.message).toContain('unknownColumn');
    });

    it('should reject disallowed node type', () => {
      const invalidAst = {
        type: 'MemberExpression',
        object: { type: 'Identifier', name: 'window' },
        property: { type: 'Identifier', name: 'location' },
      };
      // @ts-ignore
      const result = validateAST(invalidAst, testSchema);
      expect(result.valid).toBe(false);
      expect(result.error?.type).toBe('disallowed-node-type');
    });

    it('should provide column name in error for unknown column', () => {
      const ast = parseExpression('badColumn > 1000');
      const result = validateAST(ast, testSchema);
      expect(result.valid).toBe(false);
      expect(result.error?.type).toBe('unknown-column');
      expect(result.error).toHaveProperty('columnName');
      expect(result.error?.columnName).toBe('badColumn');
    });

    it('should provide available columns in error', () => {
      const ast = parseExpression('badColumn > 1000');
      const result = validateAST(ast, testSchema);
      expect(result.valid).toBe(false);
      expect(result.error).toHaveProperty('availableColumns');
      expect(result.error?.availableColumns).toEqual(testSchema);
    });

    it('should suggest similar column name for typo', () => {
      const ast = parseExpression('salse > 1000');
      const result = validateAST(ast, testSchema);
      expect(result.valid).toBe(false);
      expect(result.error?.type).toBe('unknown-column');
      expect(result.error?.suggestion).toBe('sales');
    });

    it('should not suggest when no column is close enough', () => {
      const ast = parseExpression('zzzzz > 1000');
      const result = validateAST(ast, testSchema);
      expect(result.valid).toBe(false);
      expect(result.error?.type).toBe('unknown-column');
      expect(result.error?.suggestion).toBeUndefined();
    });

    it('should reject unknown column in nested expression', () => {
      const ast = parseExpression('sales > 1000 && unknownColumn == "test"');
      const result = validateAST(ast, testSchema);
      expect(result.valid).toBe(false);
      expect(result.error?.type).toBe('unknown-column');
    });

    it('should validate with empty schema', () => {
      const ast = parseExpression('1000');
      const result = validateAST(ast, []);
      expect(result.valid).toBe(true);
    });

    it('should reject identifier with empty schema', () => {
      const ast = parseExpression('sales');
      const result = validateAST(ast, []);
      expect(result.valid).toBe(false);
      expect(result.error?.type).toBe('unknown-column');
    });

    it('should handle null AST gracefully', () => {
      // @ts-ignore
      const result = validateAST(null, testSchema);
      expect(result.valid).toBe(false);
      expect(result.error?.message).toContain('Invalid AST node');
    });

    it('should include position in error', () => {
      const ast = parseExpression('sales > 1000 && unknownColumn == "test"');
      const result = validateAST(ast, testSchema);
      expect(result.valid).toBe(false);
      expect(result.error).toHaveProperty('position');
    });

    describe('function calls', () => {
      it('should allow regexp_match with 2 arguments', () => {
        const ast = parseExpression('regexp_match(region, "^N")');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });

      it('should allow regexp_extract with 2 arguments', () => {
        const ast = parseExpression('regexp_extract(region, "([A-Z]+)")');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });

      it('should allow regexp_extract with 3 arguments (group)', () => {
        const ast = parseExpression('regexp_extract(region, "([A-Z]+)", 1)');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });

      it('should reject unknown function', () => {
        const ast = parseExpression('alert("xss")');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('unknown-function');
        expect(result.error?.message).toContain('alert');
      });

      it('should suggest similar function name for typo', () => {
        const ast = parseExpression('uper(region)');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('unknown-function');
        expect(result.error?.suggestion).toBe('upper');
      });

      it('should not suggest function when no match is close', () => {
        const ast = parseExpression('foobar(region)');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('unknown-function');
        expect(result.error?.suggestion).toBeUndefined();
      });

      it('should reject regexp_match with too few arguments', () => {
        const ast = parseExpression('regexp_match(region)');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('wrong-arity');
        expect(result.error?.message).toContain('2');
      });

      it('should reject invalid regex pattern', () => {
        const ast = parseExpression('regexp_match(region, "[unclosed")');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('invalid-regex');
        expect(result.error?.message).toContain('Invalid');
      });

      // SOUL §1: literal regex patterns are screened for catastrophic
      // backtracking (ReDoS) by safe-regex2. These tests pin the canonical
      // unsafe shapes — change with care, since loosening here means a
      // pathological pattern can freeze the user's tab.
      describe('ReDoS protection (Phase 1: literal patterns)', () => {
        it.each([
          ['(a+)+$', 'nested + quantifier'],
          ['(a*)*$', 'nested * quantifier'],
          ['(.*)*x', 'nested .* quantifier'],
          ['(.+)+', 'nested .+ quantifier'],
          ['([a-zA-Z]+)*$', 'class with nested + and *'],
        ])('should reject catastrophic pattern %s (%s)', (pattern) => {
          const ast = parseExpression(`regexp_match(region, "${pattern}")`);
          const result = validateAST(ast, testSchema);
          expect(result.valid).toBe(false);
          expect(result.error?.type).toBe('unsafe-regex');
          expect(result.error?.message).toContain('catastrophic backtracking');
        });

        it.each([
          ['^foo$', 'simple anchored literal'],
          ['[a-z]+', 'single character class with +'],
          ['\\\\d{3}-\\\\d{4}', 'bounded quantifier'],
          ['(abc|def)', 'simple alternation'],
          ['\\\\w+@\\\\w+', 'email-shaped'],
        ])('should accept safe pattern %s (%s)', (pattern) => {
          const ast = parseExpression(`regexp_match(region, "${pattern}")`);
          const result = validateAST(ast, testSchema);
          expect(result.valid).toBe(true);
        });

        it('also screens regexp_extract patterns', () => {
          const ast = parseExpression('regexp_extract(region, "(a+)+$")');
          const result = validateAST(ast, testSchema);
          expect(result.valid).toBe(false);
          expect(result.error?.type).toBe('unsafe-regex');
        });

        it('also screens regexp_replace patterns', () => {
          const ast = parseExpression('regexp_replace(region, "(.*)*x", "y")');
          const result = validateAST(ast, testSchema);
          expect(result.valid).toBe(false);
          expect(result.error?.type).toBe('unsafe-regex');
        });
      });
    });

    describe('date function validation', () => {
      const dateSchema = ['order_date', 'created_at', 'start_date', 'end_date'];

      it('should allow year with 1 argument', () => {
        const ast = parseExpression('year(order_date)');
        const result = validateAST(ast, dateSchema);
        expect(result.valid).toBe(true);
      });

      it('should allow all date extraction functions with 1 argument', () => {
        const functions = [
          'year',
          'month',
          'day',
          'hour',
          'minute',
          'second',
          'weekday',
          'week',
          'quarter',
        ];
        functions.forEach((fn) => {
          const ast = parseExpression(`${fn}(order_date)`);
          const result = validateAST(ast, dateSchema);
          expect(result.valid).toBe(true);
        });
      });

      it('should reject date extraction functions with wrong arity', () => {
        const ast = parseExpression('year()');
        const result = validateAST(ast, dateSchema);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('wrong-arity');
      });

      it('should allow today with 0 arguments', () => {
        const ast = parseExpression('today()');
        const result = validateAST(ast, dateSchema);
        expect(result.valid).toBe(true);
      });

      it('should allow now with 0 arguments', () => {
        const ast = parseExpression('now()');
        const result = validateAST(ast, dateSchema);
        expect(result.valid).toBe(true);
      });

      it('should reject today with arguments', () => {
        const ast = parseExpression('today(order_date)');
        const result = validateAST(ast, dateSchema);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('wrong-arity');
      });

      it('should allow days_between with 2 arguments', () => {
        const ast = parseExpression('days_between(start_date, end_date)');
        const result = validateAST(ast, dateSchema);
        expect(result.valid).toBe(true);
      });

      it('should reject days_between with wrong arity', () => {
        const ast = parseExpression('days_between(start_date)');
        const result = validateAST(ast, dateSchema);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('wrong-arity');
      });

      it('should allow date_add with 3 arguments', () => {
        const ast = parseExpression('date_add(order_date, 7, "days")');
        const result = validateAST(ast, dateSchema);
        expect(result.valid).toBe(true);
      });

      it('should reject date_add with wrong arity', () => {
        const ast = parseExpression('date_add(order_date, 7)');
        const result = validateAST(ast, dateSchema);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('wrong-arity');
      });

      it('should allow date_trunc with 2 arguments', () => {
        const ast = parseExpression('date_trunc(created_at, "month")');
        const result = validateAST(ast, dateSchema);
        expect(result.valid).toBe(true);
      });

      it('should allow format_date with 2 arguments', () => {
        const ast = parseExpression('format_date(order_date, "YYYY-MM-DD")');
        const result = validateAST(ast, dateSchema);
        expect(result.valid).toBe(true);
      });

      it('should validate column references in date functions', () => {
        const ast = parseExpression('year(unknown_column)');
        const result = validateAST(ast, dateSchema);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('unknown-column');
      });
    });

    describe('string function validation', () => {
      it('should allow upper with 1 argument', () => {
        const ast = parseExpression('upper(region)');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });

      it('should allow lower with 1 argument', () => {
        const ast = parseExpression('lower(region)');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });

      it('should allow trim with 1 argument', () => {
        const ast = parseExpression('trim(region)');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });

      it('should allow substring with 2 arguments', () => {
        const ast = parseExpression('substring(region, 0)');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });

      it('should allow substring with 3 arguments', () => {
        const ast = parseExpression('substring(region, 0, 3)');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });

      it('should reject substring with wrong arity', () => {
        const ast = parseExpression('substring(region)');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('wrong-arity');
      });
    });

    describe('math function validation', () => {
      it('should allow abs with 1 argument', () => {
        const ast = parseExpression('abs(sales)');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });

      it('should allow round with 1 argument', () => {
        const ast = parseExpression('round(sales)');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });

      it('should allow round with 2 arguments', () => {
        const ast = parseExpression('round(sales, 2)');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });

      it('should allow floor with 1 argument', () => {
        const ast = parseExpression('floor(sales)');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });

      it('should allow ceil with 1 argument', () => {
        const ast = parseExpression('ceil(sales)');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });

      it('should allow min with multiple arguments', () => {
        const ast = parseExpression('min(sales, revenue, cost)');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });

      it('should allow max with multiple arguments', () => {
        const ast = parseExpression('max(sales, revenue, cost)');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });

      it('should allow min with 1 argument', () => {
        const ast = parseExpression('min(sales)');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });
    });

    describe('type conversion function validation', () => {
      it('should allow parse_int with 1 argument', () => {
        const ast = parseExpression('parse_int(region)');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });

      it('should allow parse_float with 1 argument', () => {
        const ast = parseExpression('parse_float(region)');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });

      it('should allow is_nan with 1 argument', () => {
        const ast = parseExpression('is_nan(sales)');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });

      it('should reject type conversion functions with wrong arity', () => {
        const ast = parseExpression('parse_int()');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('wrong-arity');
      });
    });

    describe('JSON function validation', () => {
      it('should allow json_keys with 1 argument', () => {
        const ast = parseExpression('json_keys(region)');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });

      it('should reject json_keys with wrong arity', () => {
        const ast = parseExpression('json_keys()');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('wrong-arity');
      });

      it('should allow json_array_length with 1 argument', () => {
        const ast = parseExpression('json_array_length(region)');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });

      it('should reject json_array_length with wrong arity', () => {
        const ast = parseExpression('json_array_length()');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('wrong-arity');
      });

      it('should allow json_type with 1 argument', () => {
        const ast = parseExpression('json_type(region)');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });

      it('should reject json_type with wrong arity', () => {
        const ast = parseExpression('json_type()');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('wrong-arity');
      });

      it('should allow json_stringify with 1 argument', () => {
        const ast = parseExpression('json_stringify(region)');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });

      it('should reject json_stringify with wrong arity', () => {
        const ast = parseExpression('json_stringify()');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('wrong-arity');
      });
    });

    describe('let bindings', () => {
      it('should validate a simple let with body referencing the binding', () => {
        const ast = parseExpression('let x = sales * 2 in x + 1');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });

      it('should make bindings visible to subsequent bindings (let*)', () => {
        const ast = parseExpression('let x = sales, y = x + 1 in y');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });

      it('should reject earlier bindings that reference later ones', () => {
        const ast = parseExpression('let x = y, y = 1 in x');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('unknown-column');
      });

      it('should reject unknown columns inside a binding value', () => {
        const ast = parseExpression('let x = unknown_col in x');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('unknown-column');
      });

      it('should reject unknown identifiers in the body that are not bound', () => {
        const ast = parseExpression('let x = sales in y + x');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('unknown-column');
      });

      it('should allow bindings to shadow column names', () => {
        const ast = parseExpression('let sales = 0 in sales + 1');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });

      it('should reject using a function name as a binding', () => {
        const ast = parseExpression('let trim = 1 in trim');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('reserved-name');
      });

      it('should validate nested let expressions', () => {
        const ast = parseExpression('let x = let y = sales in y + 1 in x * 2');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(true);
      });

      it('should not leak bindings from sibling lets', () => {
        // `x` is bound only in the first branch; the second branch should not see it.
        const ast = parseExpression('(let x = sales in x) + x');
        const result = validateAST(ast, testSchema);
        expect(result.valid).toBe(false);
        expect(result.error?.type).toBe('unknown-column');
      });
    });
  });
});
