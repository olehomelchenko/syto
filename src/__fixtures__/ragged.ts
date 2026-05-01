// Ragged rows: not all data rows have the declared header arity. PapaParse's
// behaviour here is documented as "FieldMismatch" warnings; the parsed rows
// retain whatever fields were present (missing → undefined; extra → __parsed_extra).

export const tooFewFieldsCsv = 'a,b,c\n1,2,3\n4,5\n6,7,8\n';

export const tooManyFieldsCsv = 'a,b,c\n1,2,3\n4,5,6,7,8\n9,10,11\n';

// Both flavours mixed in one file.
export const raggedMixedCsv = 'a,b,c\n1,2\n4,5,6,7\n8,9,10\n';
