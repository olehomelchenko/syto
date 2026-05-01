// Timestamp strings with various timezone designators. The current schema-engine
// regex matches the first 19 characters (YYYY-MM-DDTHH:MM:SS or YYYY-MM-DD HH:MM:SS)
// and accepts anything that follows. Pinning here surfaces what is and isn't
// recognised as 'datetime' versus 'date' versus falling through to 'string'.

// UTC zulu form.
export const utcZulu: string[] = ['2024-01-01T00:00:00Z', '2024-06-15T12:30:00Z'];

// Numeric offset.
export const offsetTimezones: string[] = ['2024-01-01T00:00:00+05:30', '2024-06-15T12:30:00-08:00'];

// Naive datetime (no timezone designator). SQL-style space separator.
export const naiveDatetimeSql: string[] = ['2024-01-01 00:00:00', '2024-06-15 12:30:00'];

// ISO-form naive datetime (T separator, no offset).
export const naiveDatetimeIso: string[] = ['2024-01-01T00:00:00', '2024-06-15T12:30:00'];

// Mixed: zulu and offset in the same column. Both still match the regex prefix.
export const mixedTimezones: string[] = ['2024-01-01T00:00:00Z', '2024-01-01T00:00:00+05:30'];

// With sub-second precision. The regex prefix matches; everything after the seconds
// is currently ignored by the type detector.
export const withMilliseconds: string[] = ['2024-01-01T00:00:00.123Z', '2024-06-15T12:30:00.456Z'];

// SURPRISE candidate: trailing garbage after the 19-char prefix.
// "2024-01-01T00:00:00ABC" — current regex still matches, so this infers as datetime.
export const trailingGarbageDatetime: string[] = [
  '2024-01-01T00:00:00ABC',
  '2024-06-15T12:30:00XYZ',
];
