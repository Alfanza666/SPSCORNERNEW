/**
 * Timezone utility — SPS Corner menggunakan WITA (UTC+8, Asia/Makassar)
 * Karena berlokasi di Banjarmasin, Kalimantan Selatan
 */

export const TIMEZONE = 'Asia/Makassar'; // WITA UTC+8
export const LOCALE = 'id-ID';

/**
 * Format Date ke string lokal WITA
 * @example formatDateWITA(new Date()) → "Selasa, 13 Mei 2026, 11:06 WITA"
 */
export function formatDateWITA(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(LOCALE, {
    timeZone: TIMEZONE,
    ...options,
  });
}

/**
 * Format waktu singkat WITA: "11:06 WITA"
 */
export function formatTimeWITA(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const time = d.toLocaleTimeString(LOCALE, {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${time} WITA`;
}

/**
 * Format tanggal singkat WITA: "13 Mei 2026"
 */
export function formatDateShortWITA(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(LOCALE, {
    timeZone: TIMEZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Format tanggal + waktu untuk log/transaksi: "13 Mei 2026, 11:06 WITA"
 */
export function formatDateTimeWITA(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dateStr = formatDateShortWITA(d);
  const timeStr = formatTimeWITA(d);
  return `${dateStr}, ${timeStr}`;
}

/**
 * Ambil jam saat ini dalam WITA (0-23)
 */
export function getCurrentHourWITA(): number {
  return parseInt(
    new Date().toLocaleString(LOCALE, { timeZone: TIMEZONE, hour: '2-digit', hour12: false }),
    10
  );
}

/**
 * Format untuk date-fns: konversi date ke timezone WITA sebagai Date object
 * Gunakan ini sebelum pass ke date-fns format()
 */
export function toWITADate(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  // Offset WITA = UTC+8 = 480 menit
  const utcMs = d.getTime();
  const witaOffsetMs = 8 * 60 * 60 * 1000;
  const localOffsetMs = d.getTimezoneOffset() * 60 * 1000;
  return new Date(utcMs + witaOffsetMs + localOffsetMs);
}
