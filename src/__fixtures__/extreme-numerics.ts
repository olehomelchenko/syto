// Numeric edge cases that test the boundary between integer/float inference and
// the limits of double-precision representation. Some values look fine but lose
// precision when round-tripped through JS Number — those are the interesting cases.

// All values within the safe integer range (|n| < 2^53). inferType should return 'integer'.
export const safeIntegers: number[] = [Number.MAX_SAFE_INTEGER, 1, 2];

// String forms of the same — exercises the numeric-string-detection path.
export const safeIntegerStrings: string[] = ['9007199254740991', '1', '2'];

// Beyond MAX_SAFE_INTEGER — these strings cannot round-trip through Number without
// silent precision loss. "9007199254740993" → 9007199254740992 (off by one).
// We pin current behaviour: inferType still returns 'integer' because Number.isInteger
// is true for the (lossy) parsed value.
export const beyondSafeIntegerStrings: string[] = [
  '9007199254740992',
  '9007199254740993',
  '9007199254740994',
];

// Negative zero: -0 === 0 is true, but Object.is(-0, 0) is false. Number-typed.
export const minusZeroNumbers: number[] = [-0, 0, 1];
// String-typed: " -0 " trims to "-0", Number("-0") === -0, Number.isInteger(-0) === true.
export const minusZeroStrings: string[] = ['-0', '0', '1'];

// Subnormal floats — smallest representable positives. Should infer as 'float'.
export const subnormals: number[] = [Number.MIN_VALUE, 5e-324, 0.5];

// Special-value strings PapaParse will not coerce: pinned as 'string' since
// Number("Infinity") is finite-checked away.
export const specialValueStrings: string[] = ['Infinity', '-Infinity', 'NaN'];
