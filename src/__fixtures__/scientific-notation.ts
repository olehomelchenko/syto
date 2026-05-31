// Scientific-notation strings as they typically appear in CSV exports from
// scientific instruments and spreadsheets. SOUL.md §7 contract: if Number()
// parses cleanly, we treat it as numeric.
//
// CONTRACT decision (2026-05-01): scientific-notation strings infer as
// integer or float depending on whether the parsed value satisfies
// Number.isInteger.

// All parse to integers (Number.isInteger is true for 1e10 = 10_000_000_000).
export const integerScientific: string[] = ['1e10', '2e5', '3e3'];

// All parse to non-integer floats.
export const floatScientific: string[] = ['1.5e-3', '2.7e-2', '3.14e0'];

// Mixed — should promote to float.
export const mixedScientific: string[] = ['1e10', '2.5e-3'];

// Capital E — same parse semantics as lowercase.
export const upperEScientific: string[] = ['1E10', '2E5'];

// Overflow: Number("1e500") === Infinity, which fails the isFinite check in
// inferType. SURPRISE: these fall through to 'string' rather than 'float'.
export const overflowScientific: string[] = ['1e500', '1e1000'];
