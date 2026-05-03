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

/**
 * Derive case: numeric table + a binary expression on existing columns.
 * Pairs a `{ a, b }` row generator with one of `a + b`, `a - b`, `a * b`.
 * Used to assert row-count preservation, schema delta, and identity.
 */
export const deriveCaseArb = fc.integer({ min: 1, max: 20 }).chain((rowCount) =>
  fc.record({
    rows: fc.array(
      fc.record({
        a: fc.integer({ min: -100, max: 100 }),
        b: fc.integer({ min: -100, max: 100 }),
      }),
      { minLength: rowCount, maxLength: rowCount }
    ),
    op: fc.constantFrom('+', '-', '*'),
  })
);

/**
 * Window case: a partitioned numeric table with a sortable `idx` per row.
 * Used to assert row-count preservation and partition-aware row_number /
 * partition-then-aggregate equivalence.
 */
export const windowCaseArb = fc.integer({ min: 2, max: 20 }).chain((rowCount) =>
  fc.array(
    fc.record({
      partition: fc.constantFrom('A', 'B', 'C'),
      idx: fc.integer({ min: 0, max: 1000 }),
      val: fc.integer({ min: -100, max: 100 }),
    }),
    { minLength: rowCount, maxLength: rowCount }
  )
);

/**
 * Fold/pivot round-trip case: a wide rectangular table whose unfold columns
 * are pure integers (so pivot can use sum aggregation safely). The id column
 * is unique per row to ensure pivot can reconstruct rows 1:1.
 */
export const foldPivotCaseArb = fc.integer({ min: 2, max: 10 }).chain((rowCount) =>
  fc
    .array(
      fc.record({
        x: fc.integer({ min: -100, max: 100 }),
        y: fc.integer({ min: -100, max: 100 }),
        z: fc.integer({ min: -100, max: 100 }),
      }),
      { minLength: rowCount, maxLength: rowCount }
    )
    .map((rows) => rows.map((r, i) => ({ id: i, ...r })))
);

/**
 * Join case: produces a left table and a right table sharing an `id` column.
 * The right table's keys are guaranteed unique so cardinality properties hold.
 * Some left ids may be absent from the right (no match).
 *
 * Returns `{ left, right }` where each is `{id: number, ...}`. Left rows can
 * include null ids (used for null-non-matching contract); right rows never do.
 */
export const joinCaseArb = fc
  .record({
    leftSize: fc.integer({ min: 1, max: 10 }),
    rightSize: fc.integer({ min: 1, max: 10 }),
    keyOverlap: fc.integer({ min: 0, max: 10 }),
  })
  .chain(({ leftSize, rightSize, keyOverlap }) =>
    fc.record({
      // Right keys are unique integers in [0, rightSize).
      right: fc
        .array(fc.record({ score: fc.integer({ min: 0, max: 1000 }) }), {
          minLength: rightSize,
          maxLength: rightSize,
        })
        .map((rows) => rows.map((r, i) => ({ id: i, ...r }))),
      // Left ids draw from [0, keyOverlap) ∪ [rightSize, rightSize + leftSize).
      // Smaller pool ⇒ more matches; disjoint pool ⇒ no matches.
      left: fc
        .array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 4 }),
            // 0..keyOverlap-1 will hit the right side; rightSize..rightSize+leftSize-1 will miss.
            keyDraw: fc.integer({ min: 0, max: leftSize + Math.max(keyOverlap, 1) - 1 }),
          }),
          { minLength: leftSize, maxLength: leftSize }
        )
        .map((rows) =>
          rows.map((r) => {
            // Collapse the keyDraw onto the two pools so most rows tend to match.
            const id =
              r.keyDraw < keyOverlap
                ? r.keyDraw % Math.max(rightSize, 1)
                : rightSize + (r.keyDraw % leftSize);
            return { id, name: r.name };
          })
        ),
    })
  );
