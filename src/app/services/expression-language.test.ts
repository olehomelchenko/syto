import { describe, it, expect } from 'vitest';
import { createExpressionLanguage, createExpressionCompletion } from './expression-language';

describe('createExpressionLanguage', () => {
  it('creates a language instance with columns', () => {
    const lang = createExpressionLanguage(new Set(['col1']));
    expect(lang).toBeDefined();
    expect(lang.parser).toBeDefined();
  });

  it('creates a language with empty columns', () => {
    const lang = createExpressionLanguage(new Set());
    expect(lang).toBeDefined();
  });
});

describe('createExpressionCompletion', () => {
  it('returns null when no word is being typed', () => {
    const source = createExpressionCompletion(['col1', 'col2']);
    const result = source({
      matchBefore: () => null,
      explicit: false,
    } as any);
    expect(result).toBeNull();
  });

  it('returns null for empty match at cursor (non-explicit)', () => {
    const source = createExpressionCompletion(['col1']);
    const result = source({
      matchBefore: () => ({ from: 5, to: 5, text: '' }),
      explicit: false,
    } as any);
    expect(result).toBeNull();
  });

  it('returns completions for explicit trigger on empty match', () => {
    const source = createExpressionCompletion(['col1']);
    const result = source({
      matchBefore: () => ({ from: 0, to: 0, text: '' }),
      explicit: true,
    } as any);
    expect(result).not.toBeNull();
    expect(result!.options.length).toBeGreaterThan(0);
  });

  it('includes column names in completions', () => {
    const source = createExpressionCompletion(['sales', 'profit']);
    const result = source({
      matchBefore: () => ({ from: 0, to: 1, text: 's' }),
      explicit: false,
    } as any);
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toContain('[sales]');
    expect(labels).toContain('[profit]');
  });

  it('includes function names in completions', () => {
    const source = createExpressionCompletion([]);
    const result = source({
      matchBefore: () => ({ from: 0, to: 1, text: 'y' }),
      explicit: false,
    } as any);
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toContain('year');
    expect(labels).toContain('upper');
    expect(labels).toContain('round');
  });

  it('includes keywords in completions', () => {
    const source = createExpressionCompletion([]);
    const result = source({
      matchBefore: () => ({ from: 0, to: 1, text: 't' }),
      explicit: false,
    } as any);
    expect(result).not.toBeNull();
    const labels = result!.options.map((o) => o.label);
    expect(labels).toContain('true');
    expect(labels).toContain('false');
    expect(labels).toContain('null');
    expect(labels).toContain('and');
    expect(labels).toContain('or');
    expect(labels).toContain('not');
  });

  it('columns have higher boost than functions', () => {
    const source = createExpressionCompletion(['sales']);
    const result = source({
      matchBefore: () => ({ from: 0, to: 1, text: 's' }),
      explicit: false,
    } as any);
    const salesOpt = result!.options.find((o) => o.label === '[sales]');
    const fnOpt = result!.options.find((o) => o.label === 'sqrt');
    expect(salesOpt!.boost).toBeGreaterThan(fnOpt!.boost!);
  });

  it('function completions include signature as detail', () => {
    const source = createExpressionCompletion([]);
    const result = source({
      matchBefore: () => ({ from: 0, to: 1, text: 'y' }),
      explicit: false,
    } as any);
    const yearOpt = result!.options.find((o) => o.label === 'year');
    expect(yearOpt).toBeDefined();
    expect(yearOpt!.detail).toContain('year');
    expect(yearOpt!.type).toBe('function');
  });

  it('boosts type-relevant functions when schema is provided', () => {
    const schema = [
      { name: 'col1', type: 'string' as const },
      { name: 'col2', type: 'integer' as const },
    ];
    const source = createExpressionCompletion([], schema);
    const result = source({
      matchBefore: () => ({ from: 0, to: 0, text: '' }),
      explicit: true,
    } as any);
    // Text function: relevant to string columns → boosted
    const upperOpt = result!.options.find((o) => o.label === 'upper');
    // Math function: relevant to integer columns → boosted
    const roundOpt = result!.options.find((o) => o.label === 'round');
    // Date function: no date columns → not boosted
    const yearOpt = result!.options.find((o) => o.label === 'year');
    expect(upperOpt!.boost).toBeGreaterThan(yearOpt!.boost!);
    expect(roundOpt!.boost).toBeGreaterThan(yearOpt!.boost!);
  });

  it('boosts filter-context functions in filter mode', () => {
    const source = createExpressionCompletion([], [], 'filter');
    const result = source({
      matchBefore: () => ({ from: 0, to: 0, text: '' }),
      explicit: true,
    } as any);
    const containsOpt = result!.options.find((o) => o.label === 'contains');
    const upperOpt = result!.options.find((o) => o.label === 'upper');
    // contains is filter-boosted, upper is not
    expect(containsOpt!.boost).toBeGreaterThan(upperOpt!.boost!);
  });

  it('boosts derive-context functions in derive mode', () => {
    const source = createExpressionCompletion([], [], 'derive');
    const result = source({
      matchBefore: () => ({ from: 0, to: 0, text: '' }),
      explicit: true,
    } as any);
    const regexpReplaceOpt = result!.options.find((o) => o.label === 'regexp_replace');
    const containsOpt = result!.options.find((o) => o.label === 'contains');
    // regexp_replace is derive-boosted, contains is not
    expect(regexpReplaceOpt!.boost).toBeGreaterThan(containsOpt!.boost!);
  });

  it('combines type and context boosts', () => {
    const schema = [{ name: 'col1', type: 'string' as const }];
    const source = createExpressionCompletion([], schema, 'filter');
    const result = source({
      matchBefore: () => ({ from: 0, to: 0, text: '' }),
      explicit: true,
    } as any);
    // contains: Text category (matches string) + filter-boosted → highest boost
    const containsOpt = result!.options.find((o) => o.label === 'contains');
    // round: Math category (no float/int columns) + not filter-boosted → base boost
    const roundOpt = result!.options.find((o) => o.label === 'round');
    expect(containsOpt!.boost).toBeGreaterThan(roundOpt!.boost!);
  });
});
