// CSV with Windows-style \r\n line endings. PapaParse should detect the line
// terminator from `meta.linebreak` and parse identically to LF input.

export const crlfCsv = 'name,age\r\nAlice,30\r\nBob,25\r\n';

// Mixed line endings — a single \r\n followed by \n. Real-world: files concatenated
// from sources with different platforms.
export const mixedLineEndingsCsv = 'name,age\r\nAlice,30\nBob,25\n';
