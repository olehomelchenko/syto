// UTF-8 byte-order mark prefixed to a small CSV. Real-world: files exported from
// Excel on Windows often carry a BOM. The first column header should appear clean
// (no leading "﻿") after parsing.

export const bomUtf8Csv = '﻿name,age\nAlice,30\nBob,25\n';

// Same content without the BOM, for comparison assertions.
export const bomUtf8CsvWithoutBom = 'name,age\nAlice,30\nBob,25\n';
