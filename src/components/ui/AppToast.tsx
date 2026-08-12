import React from 'react';
import toast, { Toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, XCircle, CheckCircle, Info, X, MessageCircle } from 'lucide-react';

// ════════════════════════════════════════════════════════════════
// KAMUS PESAN ERROR — Terjemahan teknis → bahasa manusia
// ════════════════════════════════════════════════════════════════

/**
 * Peta URL path → nama halaman yang mudah dimengerti
 */
const PAGE_NAMES: Record<string, string> = {
  '/': 'Halaman Utama',
  '/login': 'Halaman Login',
  '/register': 'Halaman Registrasi',
  '/kiosk': 'Halaman Belanja',
  '/kiosk/catalog': 'Katalog Produk',
  '/kiosk/cart': 'Keranjang Belanja',
  '/kiosk/checkout': 'Halaman Checkout',
  '/kiosk/history': 'Riwayat Transaksi',
  '/kiosk/profile': 'Profil Saya',
  '/kiosk/digital': 'Produk Digital',
  '/dashboard/admin': 'Dashboard Admin',
  '/dashboard/seller': 'Dashboard Seller',
  '/portal': 'Portal Karyawan',
  '/contact': 'Halaman Kontak',
};

function getPageName(): string {
  const path = window.location.pathname;
  // Exact match dulu
  if (PAGE_NAMES[path]) return PAGE_NAMES[path];
  // Prefix match
  const match = Object.entries(PAGE_NAMES)
    .filter(([key]) => key !== '/' && path.startsWith(key))
    .sort((a, b) => b[0].length - a[0].length)[0];
  return match ? match[1] : `Halaman (${path})`;
}

/**
 * Terjemahan kode/pesan error teknis → pesan yang dimengerti user
 * Format: [keyword_dalam_error] → { user: "...", action: "..." }
 */
const ERROR_TRANSLATIONS: Array<{
  match: string | RegExp;
  user: string;
  action: string;
}> = [
  // Jaringan & Koneksi
  { match: /network|fetch|failed to fetch/i,       user: 'Koneksi internet bermasalah.',                         action: 'Pastikan kamu terhubung ke internet, lalu coba lagi.' },
  { match: /timeout/i,                              user: 'Server membutuhkan waktu terlalu lama untuk merespons.', action: 'Coba lagi dalam beberapa detik.' },
  { match: /abort/i,                                user: 'Permintaan dibatalkan sebelum selesai.',               action: 'Coba lagi.' },

  // Autentikasi
  { match: /unauthorized|401/i,                     user: 'Sesi kamu sudah berakhir.',                           action: 'Silakan login ulang.' },
  { match: /forbidden|403/i,                        user: 'Kamu tidak memiliki akses ke fitur ini.',             action: 'Hubungi Admin jika kamu merasa ini keliru.' },
  { match: /invalid.*token|token.*invalid/i,        user: 'Token keamanan tidak valid.',                         action: 'Coba logout lalu login kembali.' },

  // Pembayaran
  { match: /IPAYMU_UPSTREAM_ERROR/i,                user: 'Payment gateway iPaymu mengalami gangguan.',          action: 'Tunggu beberapa menit lalu coba bayar lagi. Uang belum terpotong.' },
  { match: /IPAYMU_REQUEST_UNCERTAIN/i,             user: 'Status pembayaran tidak dapat dikonfirmasi.',         action: 'Jangan bayar ulang dulu — hubungi Admin untuk cek status transaksi.' },
  { match: /IPAYMU_STATIC_EGRESS_UNAVAILABLE/i,     user: 'Layanan pembayaran sementara tidak tersedia.',       action: 'Coba metode pembayaran lain, atau hubungi Admin.' },
  { match: /double.*pay|already.*paid/i,            user: 'Transaksi ini sudah pernah dibayar.',                 action: 'Jangan bayar lagi. Hubungi Admin untuk konfirmasi.' },
  { match: /points.*insufficient|point.*mencukupi/i, user: 'Point kamu tidak cukup untuk transaksi ini.',       action: 'Kurangi jumlah point yang digunakan, atau pilih metode bayar lain.' },
  { match: /payment.*pending/i,                     user: 'Ada pembayaran yang masih menunggu konfirmasi.',      action: 'Selesaikan pembayaran sebelumnya dulu.' },

  // Stok
  { match: /stock|stok|out.of.stock/i,              user: 'Stok produk tidak tersedia atau tidak mencukupi.',   action: 'Kurangi jumlah item, atau pilih produk lain.' },

  // Validasi
  { match: /validation|required|wajib/i,            user: 'Ada data yang belum lengkap atau tidak valid.',       action: 'Periksa kembali semua isian dan coba lagi.' },

  // Server
  { match: /500|internal server/i,                  user: 'Server mengalami gangguan internal.',                 action: 'Coba lagi dalam beberapa menit. Jika berlanjut, hubungi Admin.' },
  { match: /502|bad gateway/i,                      user: 'Server tidak merespons dengan benar.',                action: 'Coba lagi beberapa saat lagi.' },
  { match: /503|service unavailable/i,              user: 'Layanan sementara tidak tersedia.',                   action: 'Biasanya pulih dalam beberapa menit. Coba lagi.' },
  { match: /404|not found/i,                        user: 'Data atau halaman yang dicari tidak ditemukan.',      action: 'Pastikan link/ID yang kamu gunakan benar.' },

  // Transaksi
  { match: /TRANSACTION_NOT_FOUND/i,                user: 'Transaksi tidak ditemukan di sistem.',               action: 'Cek riwayat transaksi kamu, atau hubungi Admin.' },
  { match: /TRANSACTION_NOT_PENDING/i,              user: 'Transaksi ini sudah tidak bisa diubah.',             action: 'Status transaksi sudah berubah. Refresh halaman.' },
  { match: /TRANSACTION_FORBIDDEN/i,                user: 'Transaksi ini bukan milikmu.',                       action: 'Pastikan kamu login dengan akun yang benar.' },
];

/**
 * Terjemahkan error teknis ke pesan yang mudah dimengerti
 */
export function translateError(rawError: unknown): { user: string; action: string; raw: string } {
  const raw = rawError instanceof Error
    ? rawError.message
    : typeof rawError === 'string'
    ? rawError
    : JSON.stringify(rawError);

  const found = ERROR_TRANSLATIONS.find((t) =>
    typeof t.match === 'string'
      ? raw.toLowerCase().includes(t.match.toLowerCase())
      : t.match.test(raw)
  );

  return {
    user:   found?.user   ?? 'Terjadi kesalahan yang tidak terduga.',
    action: found?.action ?? 'Coba lagi. Jika masalah berlanjut, hubungi Admin.',
    raw,
  };
}

// ════════════════════════════════════════════════════════════════
// WHATSAPP MESSAGE BUILDER — Auto-isi pesan lengkap
// ════════════════════════════════════════════════════════════════
const ADMIN_WA = '620818222604';

function buildWaUrl(opts: {
  title: string;
  userMessage: string;
  action: string;
  rawError?: string;
  context?: string;
}): string {
  const page = getPageName();
  const time = new Date().toLocaleString('id-ID', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Makassar'
  });

  const lines = [
    `Halo Admin SPS Corner, saya mengalami kendala:`,
    ``,
    `📍 *Halaman:* ${page}`,
    `🕐 *Waktu:* ${time} WITA`,
    ``,
    `❗ *Masalah:*`,
    opts.title,
    opts.userMessage,
    ``,
    `💡 *Yang sudah saya coba:*`,
    opts.action,
    ...(opts.context ? [``, `📝 *Info tambahan:*`, opts.context] : []),
    ...(opts.rawError ? [``, `🔧 *Kode error (untuk developer):*`, opts.rawError] : []),
    ``,
    `Mohon bantuannya, terima kasih! 🙏`,
  ];

  const message = lines.join('\n');
  return `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(message)}`;
}

// ════════════════════════════════════════════════════════════════
// SPRING ANIMATION PRESETS
// ════════════════════════════════════════════════════════════════
const springIn  = { type: 'spring', stiffness: 420, damping: 30, mass: 0.8 } as const;
const springOut = { type: 'spring', stiffness: 500, damping: 38, mass: 0.6 } as const;

// ════════════════════════════════════════════════════════════════
// CRITICAL TOAST — Modal besar, ada tombol WA otomatis terisi
// ════════════════════════════════════════════════════════════════
interface CriticalProps {
  t: Toast;
  title: string;
  userMessage: string;
  action: string;
  rawError?: string;
  context?: string;
}

function CriticalToast({ t, title, userMessage, action, rawError, context }: CriticalProps) {
  const waHref = buildWaUrl({ title, userMessage, action, rawError, context });

  return (
    <AnimatePresence>
      {t.visible && (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, y: -36, scale: 0.90 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.95 }}
          transition={springIn}
          style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
          className="
            w-[340px] sm:w-[390px]
            bg-white dark:bg-zinc-900
            rounded-3xl overflow-hidden
            shadow-2xl shadow-black/20 dark:shadow-black/60
            border border-zinc-100 dark:border-zinc-800
          "
        >
          {/* ── Header ── */}
          <div className="relative bg-gradient-to-br from-red-500 to-rose-600 px-6 pt-8 pb-10 flex flex-col items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.2, backgroundColor: 'rgba(255,255,255,0.25)' }}
              whileTap={{ scale: 0.88 }}
              onClick={() => toast.dismiss(t.id)}
              className="absolute top-3.5 right-3.5 p-1.5 rounded-full bg-white/10 transition-colors"
              aria-label="Tutup"
            >
              <X size={14} className="text-white" strokeWidth={2.5} />
            </motion.button>

            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ ...springIn, delay: 0.07 }}
              className="w-[60px] h-[60px] rounded-2xl bg-white/20 backdrop-blur-sm border border-white/25 flex items-center justify-center shadow-inner"
            >
              <AlertTriangle size={28} className="text-white" strokeWidth={2.5} />
            </motion.div>

            <motion.h3
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.11, duration: 0.22 }}
              className="text-white font-black text-xl text-center leading-tight tracking-tight"
            >
              {title}
            </motion.h3>
          </div>

          {/* ── Body ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14, duration: 0.26 }}
            className="px-6 py-5 bg-white dark:bg-zinc-900 flex flex-col gap-3"
          >
            {/* Pesan user */}
            <p className="text-zinc-600 dark:text-zinc-300 text-sm text-center leading-relaxed">
              {userMessage}
            </p>

            {/* Tindakan yang harus dilakukan */}
            <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/40 rounded-2xl px-3.5 py-3">
              <span className="text-amber-500 mt-0.5 flex-shrink-0 text-base">💡</span>
              <p className="text-amber-700 dark:text-amber-300 text-xs leading-relaxed font-medium">
                <span className="font-bold">Apa yang harus dilakukan: </span>
                {action}
              </p>
            </div>

            {/* Kode error teknis */}
            {rawError && (
              <div className="rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3.5 py-2.5">
                <p className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500 leading-relaxed break-all">
                  <span className="text-rose-400 font-bold select-none">ERR › </span>
                  {rawError}
                </p>
              </div>
            )}

            {/* Buttons */}
            <div className="flex flex-col gap-2 pt-0.5">
              <motion.a
                whileHover={{ scale: 1.02, boxShadow: '0 8px 24px rgba(239,68,68,0.35)' }}
                whileTap={{ scale: 0.97 }}
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => toast.dismiss(t.id)}
                className="
                  flex items-center justify-center gap-2
                  bg-gradient-to-r from-red-500 to-rose-500
                  hover:from-red-600 hover:to-rose-600
                  text-white font-bold text-sm
                  py-3 px-4 rounded-2xl
                  shadow-lg shadow-red-500/25
                  transition-colors duration-150
                "
              >
                <MessageCircle size={16} strokeWidth={2.5} />
                Hubungi Admin via WhatsApp
              </motion.a>

              <button
                onClick={() => toast.dismiss(t.id)}
                className="text-zinc-400 dark:text-zinc-600 hover:text-zinc-500 text-xs py-1.5 transition-colors"
              >
                Tutup notifikasi
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ════════════════════════════════════════════════════════════════
// LIGHT TOAST — Pill elegan untuk kondisi ringan
// ════════════════════════════════════════════════════════════════
type Variant = 'error' | 'warning' | 'success' | 'info';

const VARIANTS: Record<Variant, {
  pill: string; border: string;
  iconWrap: string; icon: React.ReactNode;
  title: string; msg: string;
  close: string;
}> = {
  error: {
    pill:     'bg-rose-50 dark:bg-rose-950/70',
    border:   'border-rose-200 dark:border-rose-800/60',
    iconWrap: 'bg-rose-100 dark:bg-rose-900/70',
    icon:     <XCircle size={18} className="text-rose-500" strokeWidth={2.5} />,
    title:    'text-rose-800 dark:text-rose-200',
    msg:      'text-rose-600 dark:text-rose-400',
    close:    'text-rose-300 hover:text-rose-500 dark:text-rose-700 dark:hover:text-rose-400',
  },
  warning: {
    pill:     'bg-amber-50 dark:bg-amber-950/70',
    border:   'border-amber-200 dark:border-amber-800/60',
    iconWrap: 'bg-amber-100 dark:bg-amber-900/70',
    icon:     <AlertTriangle size={18} className="text-amber-500" strokeWidth={2.5} />,
    title:    'text-amber-800 dark:text-amber-200',
    msg:      'text-amber-600 dark:text-amber-400',
    close:    'text-amber-300 hover:text-amber-500 dark:text-amber-700 dark:hover:text-amber-400',
  },
  success: {
    pill:     'bg-emerald-50 dark:bg-emerald-950/70',
    border:   'border-emerald-200 dark:border-emerald-800/60',
    iconWrap: 'bg-emerald-100 dark:bg-emerald-900/70',
    icon:     <CheckCircle size={18} className="text-emerald-500" strokeWidth={2.5} />,
    title:    'text-emerald-800 dark:text-emerald-200',
    msg:      'text-emerald-600 dark:text-emerald-400',
    close:    'text-emerald-300 hover:text-emerald-500 dark:text-emerald-700 dark:hover:text-emerald-400',
  },
  info: {
    pill:     'bg-blue-50 dark:bg-blue-950/70',
    border:   'border-blue-200 dark:border-blue-800/60',
    iconWrap: 'bg-blue-100 dark:bg-blue-900/70',
    icon:     <Info size={18} className="text-blue-500" strokeWidth={2.5} />,
    title:    'text-blue-800 dark:text-blue-200',
    msg:      'text-blue-600 dark:text-blue-400',
    close:    'text-blue-300 hover:text-blue-500 dark:text-blue-700 dark:hover:text-blue-400',
  },
};

interface LightProps {
  t: Toast;
  variant: Variant;
  title: string;
  message?: string;
}

function LightToast({ t, variant, title, message }: LightProps) {
  const v = VARIANTS[variant];
  return (
    <AnimatePresence>
      {t.visible && (
        <motion.div
          key={t.id}
          initial={{ opacity: 0, y: -20, scale: 0.93 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.96 }}
          transition={springIn}
          style={{ fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" }}
          className={`
            flex items-center gap-3
            ${v.pill} border ${v.border}
            rounded-2xl
            shadow-lg shadow-black/6 dark:shadow-black/30
            px-4 py-3.5
            min-w-[280px] max-w-[360px]
          `}
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...springIn, delay: 0.05 }}
            className={`flex-shrink-0 w-8 h-8 ${v.iconWrap} rounded-xl flex items-center justify-center`}
          >
            {v.icon}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.07, duration: 0.2 }}
            className="flex-1 min-w-0"
          >
            <p className={`font-bold text-sm leading-snug ${v.title}`}>{title}</p>
            {message && (
              <p className={`text-xs mt-0.5 leading-snug ${v.msg}`}>{message}</p>
            )}
          </motion.div>

          <motion.button
            whileHover={{ scale: 1.25 }}
            whileTap={{ scale: 0.85 }}
            onClick={() => toast.dismiss(t.id)}
            className={`flex-shrink-0 p-1 rounded-lg transition-colors ${v.close}`}
            aria-label="Tutup"
          >
            <X size={14} strokeWidth={2.5} />
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ════════════════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════════════════

interface ToastOpts {
  /** ID spesifik — jika diisi, toast sebelumnya dengan ID sama akan di-replace */
  id?: string;
  /** Durasi tampil (ms). Default: error=5000, success=4000, info=4000, loading=Infinity */
  duration?: number;
}

/**
 * Toast KRITIS — untuk error yang user tidak bisa selesaikan sendiri.
 * Otomatis menerjemahkan error teknis & mengisi pesan WA lengkap.
 */
function critical(opts: {
  title: string;
  error: unknown;
  context?: string;
  id?: string;
  duration?: number;
}) {
  const { user, action, raw } = translateError(opts.error);
  return toast.custom(
    (t) => (
      <CriticalToast
        t={t}
        title={opts.title}
        userMessage={user}
        action={action}
        rawError={raw !== user ? raw : undefined}
        context={opts.context}
      />
    ),
    { id: opts.id, duration: opts.duration ?? Infinity, position: 'top-center' }
  );
}

/**
 * Toast loading — spinner dengan pesan.
 * Gunakan ID yang sama dengan success/error untuk replace.
 *
 * @example
 * const toastId = appToast.loading('Memverifikasi...');
 * // ... proses selesai
 * appToast.success('Berhasil!', { id: toastId });
 */
function loading(title: string, opts?: ToastOpts) {
  return toast.custom(
    (t) => (
      <LightToast t={t} variant="info" title={title} message={undefined} />
    ),
    { id: opts?.id, duration: opts?.duration ?? Infinity, position: 'top-center' }
  );
}

/**
 * Toast error ringan — retry-able, validasi, jaringan.
 * Juga bisa terima Error object, otomatis diterjemahkan.
 *
 * @example
 * appToast.error('Gagal memuat data', error)
 * appToast.error('Gagal memuat data', 'Periksa koneksi internet Anda')
 * appToast.error('Gagal', 'Detail', { id: toastId })
 */
function error(title: string, messageOrError?: string | unknown, optsOrDuration?: ToastOpts | number) {
  const opts: ToastOpts = typeof optsOrDuration === 'number'
    ? { duration: optsOrDuration }
    : optsOrDuration ?? {};
  let message: string | undefined;
  if (typeof messageOrError === 'string') {
    message = messageOrError;
  } else if (messageOrError != null) {
    const { user } = translateError(messageOrError);
    message = user;
  }
  return toast.custom(
    (t) => <LightToast t={t} variant="error" title={title} message={message} />,
    { id: opts.id, duration: opts.duration ?? 5000, position: 'top-center' }
  );
}

/**
 * Toast peringatan
 * @example appToast.warning('Stok Hampir Habis!', 'Sisa 2 item tersedia')
 */
function warning(title: string, message?: string, optsOrDuration?: ToastOpts | number) {
  const opts: ToastOpts = typeof optsOrDuration === 'number'
    ? { duration: optsOrDuration }
    : optsOrDuration ?? {};
  return toast.custom(
    (t) => <LightToast t={t} variant="warning" title={title} message={message} />,
    { id: opts.id, duration: opts.duration ?? 5000, position: 'top-center' }
  );
}

/**
 * Toast sukses
 * @example appToast.success('Pembayaran Berhasil!', 'Terima kasih')
 */
function success(title: string, message?: string, optsOrDuration?: ToastOpts | number) {
  const opts: ToastOpts = typeof optsOrDuration === 'number'
    ? { duration: optsOrDuration }
    : optsOrDuration ?? {};
  return toast.custom(
    (t) => <LightToast t={t} variant="success" title={title} message={message} />,
    { id: opts.id, duration: opts.duration ?? 4000, position: 'top-center' }
  );
}

/**
 * Toast informasi
 * @example appToast.info('Sedang diproses...', 'Mohon tunggu sebentar')
 */
function info(title: string, message?: string, optsOrDuration?: ToastOpts | number) {
  const opts: ToastOpts = typeof optsOrDuration === 'number'
    ? { duration: optsOrDuration }
    : optsOrDuration ?? {};
  return toast.custom(
    (t) => <LightToast t={t} variant="info" title={title} message={message} />,
    { id: opts.id, duration: opts.duration ?? 4000, position: 'top-center' }
  );
}

/** Tutup toast by ID atau semua */
function dismiss(id?: string) { toast.dismiss(id); }

export const appToast = { critical, error, warning, success, info, loading, dismiss };
