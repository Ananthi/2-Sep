export type CSVRow = Record<string, string>;

// Simple RFC4180-ish CSV parser supporting quoted fields and commas/newlines in quotes.
export function parseCSV(text: string): { headers: string[]; rows: CSVRow[] } {
  const rows: string[][] = [];
  let i = 0, field = '', row: string[] = [], inQuotes = false;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; } // escaped quote
        inQuotes = false; i++; continue;
      } else { field += ch; i++; continue; }
    } else {
      if (ch === '"') { inQuotes = true; i++; continue; }
      if (ch === ',') { row.push(field); field = ''; i++; continue; }
      if (ch === '\n' || ch === '\r') {
        // handle CRLF and LF
        // finalize row only if not empty or we already have fields
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        // ignore completely empty rows
        if (row.length > 1 || (row.length === 1 && row[0].trim() !== '')) rows.push(row);
        row = [];
        i++;
        continue;
      }
      field += ch; i++; continue;
    }
  }
  // push last field/row
  if (field.length > 0 || row.length) { row.push(field); rows.push(row); }
  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1).filter(r => r.some(c => c && c.trim() !== ''));
  const normalizedHeaders = headers.map((h, idx) => h || `col${idx}`);
  const mapped: CSVRow[] = dataRows.map((r) => {
    const o: CSVRow = {};
    for (let j = 0; j < normalizedHeaders.length; j++) {
      o[normalizedHeaders[j]] = (r[j] ?? '').trim();
    }
    return o;
  });
  return { headers: normalizedHeaders, rows: mapped };
}

