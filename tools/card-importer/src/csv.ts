/**
 * A small RFC 4180 CSV reader.
 *
 * Fields may be quoted and contain commas, doubled quotes and newlines, so
 * splitting on commas does not work. The importer has no runtime dependencies,
 * so parsing lives here rather than in a library.
 */

/** One parsed row, keyed by column header. */
export type CsvRow = Readonly<Record<string, string>>;

/**
 * Split CSV content into rows of raw fields.
 *
 * @param content - The full file content.
 * @returns Every row, including the header row, as an array of fields.
 */
function splitRows(content: string): string[][] {
  const rows: string[][] = [];
  let fields: string[] = [];
  let field = '';
  let quoted = false;
  let index = 0;

  // Strip a UTF-8 byte order mark so the first header is not corrupted.
  const text = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;

  function endField(): void {
    fields.push(field);
    field = '';
  }

  function endRow(): void {
    endField();
    rows.push(fields);
    fields = [];
  }

  while (index < text.length) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }
      field += char;
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = true;
      index += 1;
      continue;
    }
    if (char === ',') {
      endField();
      index += 1;
      continue;
    }
    if (char === '\r') {
      index += 1;
      continue;
    }
    if (char === '\n') {
      endRow();
      index += 1;
      continue;
    }
    field += char;
    index += 1;
  }

  if (field !== '' || fields.length > 0) {
    endRow();
  }
  return rows;
}

/**
 * Parse CSV content into rows keyed by column header.
 *
 * Rows in which every field is blank are dropped, since the source files end
 * with trailing blank lines.
 *
 * @param content - The full file content.
 * @returns The data rows, keyed by the header row's column names.
 */
export function parseCsv(content: string): CsvRow[] {
  const rows = splitRows(content);
  const header = rows[0];
  if (header === undefined) {
    return [];
  }
  const parsed: CsvRow[] = [];
  for (const row of rows.slice(1)) {
    if (row.every((value) => value.trim() === '')) {
      continue;
    }
    const record: Record<string, string> = {};
    header.forEach((name, columnIndex) => {
      record[name] = row[columnIndex] ?? '';
    });
    parsed.push(record);
  }
  return parsed;
}
