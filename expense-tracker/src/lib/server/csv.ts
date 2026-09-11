import "server-only";

export interface CsvColumn<T> {
  header: string;
  key: Extract<keyof T, string>;
  format?: (value: any, row: T) => string;
}

/**
 * Escapes a single CSV value, dealing with quotes and newlines.
 * Neutralizes spreadsheet formula injection (CSV Injection) by prepending
 * an apostrophe if the value starts with dangerous characters.
 */
function escapeCsvValue(value: any): string {
  if (value === null || value === undefined) {
    return "";
  }

  let str = String(value);

  // CSV Injection Neutralization
  // If the cell starts with =, +, -, @, \t, \r, \n, it can be interpreted as a formula.
  if (/^[=+\-@\t\r\n]/.test(str)) {
    str = "'" + str;
  }

  // If it contains quotes, commas, or newlines, we must enclose in double quotes
  // and double any existing double quotes.
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    str = '"' + str.replace(/"/g, '""') + '"';
  }

  return str;
}

/**
 * Builds a CSV string from an array of records and a column definition.
 */
export function buildCsv<T extends Record<string, any>>(data: T[], columns: CsvColumn<T>[]): string {
  if (!data || !columns || columns.length === 0) {
    return "";
  }

  // 1. Build Headers
  const headerRow = columns.map((col) => escapeCsvValue(col.header)).join(",");
  
  // 2. Build Rows
  const rows = data.map((row) => {
    return columns.map((col) => {
      const val = row[col.key];
      const formatted = col.format ? col.format(val, row) : val;
      return escapeCsvValue(formatted);
    }).join(",");
  });

  return [headerRow, ...rows].join("\n");
}
