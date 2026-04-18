type SpreadsheetRow = Record<string, unknown>;

export type SpreadsheetSheet = {
  name: string;
  rows: SpreadsheetRow[];
  columns?: string[];
};

type SpreadsheetCell = {
  type: 'String' | 'Number' | 'Boolean';
  value: string;
};

const INVALID_SHEET_NAME_CHARACTERS = new Set([':', '\\', '/', '?', '*', '[', ']']);

function sanitizeXmlText(value: string): string {
  return [...value].filter((character) => isValidXmlCodePoint(character.codePointAt(0))).join('');
}

function escapeXml(value: string): string {
  return sanitizeXmlText(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function normalizeSheetName(name: string, index: number): string {
  const normalized = [...name]
    .map((character) => (INVALID_SHEET_NAME_CHARACTERS.has(character) ? ' ' : character))
    .join('')
    .trim();
  const truncated = normalized.slice(0, 31).trim();

  return truncated || `sheet_${index + 1}`;
}

function isValidXmlCodePoint(codePoint: number | undefined): boolean {
  if (codePoint === undefined) {
    return false;
  }

  return (
    codePoint === 0x09 ||
    codePoint === 0x0a ||
    codePoint === 0x0d ||
    (codePoint >= 0x20 && codePoint <= 0xd7ff) ||
    (codePoint >= 0xe000 && codePoint <= 0xfffd)
  );
}

function collectColumns(sheet: SpreadsheetSheet): string[] {
  if (sheet.columns && sheet.columns.length > 0) {
    return sheet.columns;
  }

  const columns = new Set<string>();

  for (const row of sheet.rows) {
    for (const key of Object.keys(row)) {
      columns.add(key);
    }
  }

  return [...columns];
}

function stringifyObject(value: object): string {
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

function normalizeCell(value: unknown): SpreadsheetCell | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return { type: 'Number', value: String(value) };
  }

  if (typeof value === 'boolean') {
    return { type: 'Boolean', value: value ? '1' : '0' };
  }

  if (value instanceof Date) {
    return { type: 'String', value: value.toISOString() };
  }

  if (Array.isArray(value)) {
    return { type: 'String', value: stringifyObject(value) };
  }

  if (typeof value === 'object') {
    return { type: 'String', value: stringifyObject(value) };
  }

  return { type: 'String', value: String(value) };
}

function serializeHeaderRow(columns: string[]): string {
  return `<Row>${columns
    .map(
      (column) =>
        `<Cell ss:StyleID="header"><Data ss:Type="String">${escapeXml(column)}</Data></Cell>`,
    )
    .join('')}</Row>`;
}

function serializeBodyRow(columns: string[], row: SpreadsheetRow): string {
  return `<Row>${columns
    .map((column) => {
      const cell = normalizeCell(row[column]);

      if (!cell) {
        return '<Cell ss:StyleID="cell"/>';
      }

      return `<Cell ss:StyleID="cell"><Data ss:Type="${cell.type}">${escapeXml(cell.value)}</Data></Cell>`;
    })
    .join('')}</Row>`;
}

function serializeWorksheet(sheet: SpreadsheetSheet, index: number): string {
  const columns = collectColumns(sheet);
  const rows =
    columns.length === 0
      ? ''
      : [
          serializeHeaderRow(columns),
          ...sheet.rows.map((row) => serializeBodyRow(columns, row)),
        ].join('');

  return `<Worksheet ss:Name="${escapeXml(normalizeSheetName(sheet.name, index))}"><Table>${rows}</Table></Worksheet>`;
}

export function buildSpreadsheetWorkbook(sheets: SpreadsheetSheet[]): Buffer {
  const worksheets = sheets.map((sheet, index) => serializeWorksheet(sheet, index)).join('');
  const workbook = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook
  xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40"
>
  <Styles>
    <Style ss:ID="header">
      <Font ss:Bold="1"/>
      <Interior ss:Color="#F5F5F5" ss:Pattern="Solid"/>
      <Alignment ss:Vertical="Top" ss:WrapText="1"/>
    </Style>
    <Style ss:ID="cell">
      <Alignment ss:Vertical="Top" ss:WrapText="1"/>
    </Style>
  </Styles>
  ${worksheets}
</Workbook>`;

  return Buffer.from(workbook, 'utf8');
}
