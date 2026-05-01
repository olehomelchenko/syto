// Visually identical strings that differ in code-unit representation.
// Object keys (column names) are compared by code units, not by Unicode
// canonical equivalence — so two columns named "cafe" with different
// normalisation forms can coexist and silently shadow each other in lookups.
//
// IMPORTANT: we construct these strings via String.fromCharCode rather than
// inline literals. The repo's editor pipeline NFC-normalises file contents on
// save, which would silently collapse both literals into the precomposed form
// and defeat the whole fixture. fromCharCode bypasses that because the
// codepoints are arguments at runtime, not source-level characters.

// "café" — precomposed (NFC), 4 codepoints: c, a, f, é (U+00E9).
export const cafeNfc: string =
  String.fromCharCode(0x63) + // c
  String.fromCharCode(0x61) + // a
  String.fromCharCode(0x66) + // f
  String.fromCharCode(0x00e9); // é (precomposed)

// "café" — decomposed (NFD), 5 codepoints: c, a, f, e, U+0301 combining acute.
export const cafeNfd: string =
  String.fromCharCode(0x63) + // c
  String.fromCharCode(0x61) + // a
  String.fromCharCode(0x66) + // f
  String.fromCharCode(0x65) + // e
  String.fromCharCode(0x0301); // ́ combining acute accent

// Sanity assertion data: these two strings render identically but are NOT equal.
export const cafeFormsAreDistinct: boolean = cafeNfc !== cafeNfd;

// Zero-width joiner (U+200D) and non-joiner (U+200C) — invisible characters
// that can sneak in via copy-paste from word processors or messaging apps.
export const withZwj: string = 'fa' + String.fromCharCode(0x200d) + 'mily';
export const withZwnj: string = 'fi' + String.fromCharCode(0x200c) + 'nal';

// Right-to-left override (U+202E), used in some legitimate Arabic/Hebrew
// contexts but also notorious in filename-spoofing attacks. We pin that it's
// preserved as-is by the parser.
export const withRlo: string = 'safe' + String.fromCharCode(0x202e) + 'txt.exe';
