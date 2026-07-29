// Shared cell encoder for every CSV export in the app. Values coming from
// tenant-editable fields (subcontractor/project names, references, item
// descriptions) could otherwise start with a spreadsheet formula character
// — a cell like `=1+1` or `=HYPERLINK(...)` evaluates on open in Excel/
// Sheets. Prefixing with a leading apostrophe forces it to be read as text;
// RFC 4180 quoting/escaping is applied after that.
const FORMULA_LEAD_CHARS = new Set(["=", "+", "-", "@", "\t", "\r"])

export function csvCell(value: string): string {
  const neutralised = value.length > 0 && FORMULA_LEAD_CHARS.has(value[0]) ? `'${value}` : value
  return neutralised.includes(",") || neutralised.includes('"') || neutralised.includes("\n")
    ? `"${neutralised.replace(/"/g, '""')}"`
    : neutralised
}

export function toCsv(rows: string[][]): string {
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n")
}
