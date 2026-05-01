// Heterogeneous columns — common after careless joins, JSON-flattening, or when
// users hand-edit data. inferType should fall back to 'string' for any column
// where values don't form a single type class.

// Number and string mixed.
export const numberAndString: any[] = [1, 'two', 3];

// Boolean and its string representation.
export const boolAndString: any[] = [true, 'true', false];

// Numeric strings mixed with non-numeric strings.
export const mixedNumericText: string[] = ['2024', 'tomorrow', '2025'];

// Mostly-numeric column with one alphabetic outlier — the kind of "ID with one bad
// value" mistake that breaks downstream type assumptions silently.
export const mostlyNumericOneOutlier: string[] = ['1001', '1002', '1003', 'BAD', '1005'];

// Date strings mixed with free text.
export const datesAndText: string[] = ['2024-01-01', 'tomorrow', '2024-06-15'];

// Bool/null/undefined/empty-string ambiguity in nominal-bool column.
export const fuzzyBools: any[] = [true, false, null, '', 'yes', 'no'];
