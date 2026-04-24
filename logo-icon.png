import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import toast from 'react-hot-toast';

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
    // Fallback for environments where download is blocked (like iframes)
    const newWindow = window.open('', '_blank');
    if (newWindow) {
      newWindow.document.write(`<pre>${csvContent}</pre>`);
      newWindow.document.title = filename;
    } else {
      toast.error('Gagal mengunduh laporan. Pastikan popup tidak diblokir.');
    }
  }
}
