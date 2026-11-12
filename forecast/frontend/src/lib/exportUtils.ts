import * as XLSX from 'xlsx';

export interface ExportSheet {
  sheetName: string;
  headers: string[];
  rows: (string | number | boolean | null | undefined)[][];
}

export interface ExportData {
  filename: string;
  sheetName?: string;
  headers?: string[];
  rows?: (string | number | boolean | null | undefined)[][];
  sheets?: ExportSheet[];
}

export interface ExportCSVOptions {
  delimiter?: ';' | ',';
}

/**
 * Genera y descarga un archivo CSV con codificación UTF-8 y BOM explícito (0xEF, 0xBB, 0xBF).
 * Esto garantiza que Excel en Windows reconozca los caracteres en español (tildes, eñes, símbolos)
 * sin que aparezcan caracteres corruptos (mojibake como Ã©, Ãº).
 *
 * Además, con el delimitador ';' (predeterminado para Excel en español / Windows), Excel
 * distribuye automáticamente cada celda en su columna correspondiente en vez de agrupar todo en la columna A.
 */
export function exportToCSV(
  data: ExportData,
  options: ExportCSVOptions = { delimiter: ';' }
): void {
  const delimiter = options.delimiter || ';';
  const filename = data.filename;

  const headers = data.headers || data.sheets?.[0]?.headers || [];
  const rows = data.rows || data.sheets?.[0]?.rows || [];

  const formatCell = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    // Escapar comillas dobles, saltos de línea y el delimitador utilizado
    if (str.includes(delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headerRow = headers.map(formatCell).join(delimiter);
  const dataRows = rows.map((row) => row.map(formatCell).join(delimiter));
  const csvContent = [headerRow, ...dataRows].join('\r\n');

  // BOM explícito de 3 bytes (0xEF, 0xBB, 0xBF) para forzar detección UTF-8 en Excel
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  const blob = new Blob([bom, csvContent], { type: 'text/csv;charset=utf-8;' });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const cleanFilename = filename.toLowerCase().endsWith('.csv') ? filename : `${filename}.csv`;
  link.setAttribute('download', cleanFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Genera y descarga un libro de Excel (.xlsx) con autoajuste de anchos de columna y soporte multi-hoja.
 * Al ser formato XLSX nativo, no sufre de problemas de delimitador ni codificación de tildes.
 */
export function exportToExcel(data: ExportData): void {
  const wb = XLSX.utils.book_new();
  const filename = data.filename;

  const sheetsToProcess: ExportSheet[] =
    data.sheets && data.sheets.length > 0
      ? data.sheets
      : [
          {
            sheetName: data.sheetName || 'Datos',
            headers: data.headers || [],
            rows: data.rows || []
          }
        ];

  sheetsToProcess.forEach((sheet) => {
    const aoa = [sheet.headers, ...sheet.rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Auto-ajuste de anchos de columna para presentación profesional
    const colWidths = sheet.headers.map((h, colIdx) => {
      let maxLen = String(h ?? '').length;
      for (let r = 0; r < sheet.rows.length; r++) {
        const cellVal = sheet.rows[r]?.[colIdx];
        const len = cellVal !== null && cellVal !== undefined ? String(cellVal).length : 0;
        if (len > maxLen) maxLen = len;
      }
      return { wch: Math.min(Math.max(maxLen + 3, 10), 60) };
    });
    ws['!cols'] = colWidths;

    const safeSheetName = (sheet.sheetName || 'Datos')
      .replace(/[\\/?*[\]:]/g, '')
      .substring(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
  });

  const cleanFilename = filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(wb, cleanFilename);
}
