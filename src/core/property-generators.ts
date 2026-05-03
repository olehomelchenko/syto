import * as fc from 'fast-check';

function numCell(): fc.Arbitrary<number | null> {
  return fc.oneof(fc.integer({ min: -100, max: 100 }), fc.constant(null));
}

export const numericTableArb = fc.integer({ min: 1, max: 20 }).chain((rowCount) =>
  fc.array(
    fc.record({
      a: numCell(),
      b: numCell(),
      c: numCell(),
    }),
    { minLength: rowCount, maxLength: rowCount }
  )
);

export const filterCaseArb = fc
  .record({
    rows: fc.integer({ min: 2, max: 20 }).chain((n) =>
      fc.array(
        fc.record({
          v: fc.integer({ min: -100, max: 100 }),
        }),
        { minLength: n, maxLength: n }
      )
    ),
    threshold: fc.integer({ min: -50, max: 50 }),
    operator: fc.constantFrom('>', '<', '>=', '<='),
  })
  .map(({ rows, threshold, operator }) => ({
    rows,
    expr: `v ${operator} ${threshold}`,
  }));

export const selectCaseArb = fc.integer({ min: 1, max: 20 }).chain((rowCount) =>
  fc.record({
    rows: fc.array(
      fc.record({
        a: numCell(),
        b: numCell(),
        c: numCell(),
        d: numCell(),
      }),
      { minLength: rowCount, maxLength: rowCount }
    ),
    selected: fc.shuffledSubarray(['a', 'b', 'c', 'd'], { minLength: 1, maxLength: 3 }),
  })
);

export const sortCaseArb = fc.integer({ min: 2, max: 20 }).chain((rowCount) =>
  fc.record({
    rows: fc.array(
      fc.record({
        score: fc.integer({ min: -100, max: 100 }),
        label: fc.string({ minLength: 1, maxLength: 4 }),
      }),
      { minLength: rowCount, maxLength: rowCount }
    ),
    col: fc.constantFrom('score', 'label'),
    order: fc.constantFrom('asc' as const, 'desc' as const),
  })
);

export const aggregateCaseArb = fc.integer({ min: 2, max: 20 }).chain((rowCount) =>
  fc.record({
    rows: fc.array(
      fc.record({
        group: fc.constantFrom('Cat', 'Dog', 'Fox'),
        val: fc.integer({ min: -100, max: 100 }),
      }),
      { minLength: rowCount, maxLength: rowCount }
    ),
    groupCol: fc.constant('group'),
    valueCol: fc.constant('val'),
  })
);
