import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

/**
 * Export data array to a formatted Excel (.xlsx) file.
 * @param headers - Array of column header strings
 * @param rows    - Array of rows (each row = array of cell values)
 * @param filename - Output file name (without extension)
 * @param sheetName - Name of the sheet tab (default: 'Laporan')
 */
export function exportExcel(
  headers: string[],
  rows: (string | number | null | undefined)[][],
  filename: string,
  sheetName = 'Laporan'
) {
  try {
    // Build worksheet data: header row + data rows
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Auto column widths based on content
    const colWidths = headers.map((h, i) => {
      const maxLen = Math.max(
        String(h).length,
        ...rows.map(r => String(r[i] ?? '').length)
      );
      return { wch: Math.min(maxLen + 4, 50) };
    });
    ws['!cols'] = colWidths;

    // Freeze header row
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Write and trigger download
    XLSX.writeFile(wb, `${filename}.xlsx`);
  } catch (error) {
    console.error('Error exporting Excel:', error);
    toast.error('Gagal mengunduh laporan Excel.');
  }
}

/** @deprecated Use exportExcel instead */
export function exportCSV(csvContent: string, filename: string) {
  try {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    toast.error('Gagal mengunduh laporan.');
  }
}
