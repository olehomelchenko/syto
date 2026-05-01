// Headers and cell values exercising Unicode normalisation forms and
// zero-width characters. Two strings that look identical to a human can be
// byte-distinct, which matters for column-name lookups (object keys are
// compared by code unit, not by Unicode equivalence class).
//
// Re-uses the canonical NFC/NFD/ZWJ/ZWNJ strings from combining-marks.ts.
// That module constructs them via String.fromCharCode to defeat the editor
// pipeline's NFC normalisation on save.

import { cafeNfc, cafeNfd, withZwj, withZwnj } from './combining-marks';

export { cafeNfc, cafeNfd };

// Two columns that render identically but are distinct keys.
export const ambiguousHeadersCsv: string = `${cafeNfc},${cafeNfd}\n1,2\n3,4\n`;

// Zero-width joiner (U+200D) and non-joiner (U+200C) — invisible characters that
// can sneak into pasted column names.
export const zwjHeader: string = withZwj;
export const zwnjHeader: string = withZwnj;
export const invisibleCharHeadersCsv: string = `${zwjHeader},${zwnjHeader}\n1,2\n`;

// Header with leading/trailing whitespace (also invisible-ish).
export const paddedHeadersCsv: string = '  name  , age \nAlice,30\n';
