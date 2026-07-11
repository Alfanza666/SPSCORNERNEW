import { useId, type ReactNode } from 'react';
import { CheckCircle2, Copy, Loader2, LockKeyhole, ReceiptText, ShieldCheck, Trash2, UploadCloud, XCircle } from 'lucide-react';
import { cx, formatMoney } from './utils';

export type ManualPaymentStatus = 'idle' | 'pending' | 'verifying' | 'verified' | 'rejected';

export interface ManualPaymentStepProps {
  amount: number;
  title?: string;
  description?: string;
  currency?: string;
  locale?: string;
  qrImageUrl?: string;
  qrImageAlt?: string;
  qrContent?: ReactNode;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  reference?: string;
  instructions?: readonly string[];
  status?: ManualPaymentStatus;
  statusMessage?: string;
  proofFileName?: string;
  proofPreviewUrl?: string;
  accept?: string;
  disabled?: boolean;
  onCopyAccount?: () => void;
  onProofSelect?: (file: File) => void;
  onRemoveProof?: () => void;
  onVerify?: () => void;
  verifyLabel?: string;
  footer?: ReactNode;
  className?: string;
}

const statusConfig: Record<ManualPaymentStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  idle: { label: 'Menunggu bukti pembayaran', icon: ReceiptText, className: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300' },
  pending: { label: 'Bukti siap diverifikasi', icon: ShieldCheck, className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  verifying: { label: 'Memverifikasi pembayaran', icon: Loader2, className: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300' },
  verified: { label: 'Pembayaran terverifikasi', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
  rejected: { label: 'Bukti belum dapat diverifikasi', icon: XCircle, className: 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' },
};

export function ManualPaymentStep({
  amount,
  title = 'Selesaikan pembayaran',
  description = 'Bayar sesuai nominal hingga digit terakhir agar verifikasi berjalan lancar.',
  currency = 'IDR',
  locale = 'id-ID',
  qrImageUrl,
  qrImageAlt = 'Kode QR pembayaran',
  qrContent,
  bankName,
  accountNumber,
  accountName,
  reference,
  instructions = [],
  status = 'idle',
  statusMessage,
  proofFileName,
  proofPreviewUrl,
  accept = 'image/jpeg,image/png,image/webp',
  disabled = false,
  onCopyAccount,
  onProofSelect,
  onRemoveProof,
  onVerify,
  verifyLabel = 'Verifikasi pembayaran',
  footer,
  className,
}: ManualPaymentStepProps) {
  const fileInputId = `payment-proof-${useId()}`;
  const config = statusConfig[status];
  const StatusIcon = config.icon;
  const hasProof = Boolean(proofFileName || proofPreviewUrl);

  return (
    <section aria-labelledby="manual-payment-title" className={cx('grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(22rem,1.1fr)]', className)}>
      <div className="rounded-[2rem] bg-zinc-950 p-6 text-white shadow-[0_30px_80px_-35px_rgba(24,24,27,0.75)] sm:p-8 dark:bg-zinc-900">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
          <LockKeyhole aria-hidden="true" className="size-4" />
          Pembayaran aman
        </div>
        <h2 id="manual-payment-title" className="mt-5 text-2xl font-black tracking-tight sm:text-3xl">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-400">{description}</p>

        <div className="mt-7 rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">Total yang harus dibayar</p>
          <p className="mt-2 text-3xl font-black tracking-tight tabular-nums sm:text-4xl">{formatMoney(amount, currency, locale)}</p>
          {reference ? <p className="mt-2 font-mono text-xs text-zinc-500">Ref: {reference}</p> : null}
        </div>

        {(qrImageUrl || qrContent) ? (
          <div className="mt-6 rounded-3xl bg-white p-4 text-center text-zinc-950">
            {qrContent ?? <img src={qrImageUrl} alt={qrImageAlt} className="mx-auto aspect-square w-full max-w-56 object-contain" />}
            <p className="mt-3 text-xs font-bold text-zinc-500">Pindai menggunakan mobile banking atau dompet digital</p>
          </div>
        ) : null}

        {(bankName || accountNumber || accountName) ? (
          <dl className="mt-6 space-y-3 rounded-3xl border border-white/10 p-5 text-sm">
            {bankName ? <div className="flex justify-between gap-4"><dt className="text-zinc-500">Bank</dt><dd className="font-bold">{bankName}</dd></div> : null}
            {accountNumber ? (
              <div className="flex items-center justify-between gap-4">
                <dt className="text-zinc-500">Nomor rekening</dt>
                <dd className="flex items-center gap-2 font-mono font-bold tabular-nums">
                  {accountNumber}
                  {onCopyAccount ? (
                    <button type="button" onClick={onCopyAccount} aria-label="Salin nomor rekening" className="rounded-lg p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
                      <Copy aria-hidden="true" className="size-3.5" />
                    </button>
                  ) : null}
                </dd>
              </div>
            ) : null}
            {accountName ? <div className="flex justify-between gap-4"><dt className="text-zinc-500">Atas nama</dt><dd className="text-right font-bold">{accountName}</dd></div> : null}
          </dl>
        ) : null}
      </div>

      <div className="rounded-[2rem] border border-zinc-200 bg-white p-6 shadow-sm sm:p-8 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
            <UploadCloud aria-hidden="true" className="size-5" />
          </div>
          <div>
            <h3 className="font-bold text-zinc-950 dark:text-white">Unggah bukti pembayaran</h3>
            <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">Pastikan nominal, status berhasil, dan tujuan transfer terlihat jelas.</p>
          </div>
        </div>

        {instructions.length > 0 ? (
          <ol className="mt-6 space-y-3">
            {instructions.map((instruction, index) => (
              <li key={`${index}-${instruction}`} className="flex gap-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{index + 1}</span>
                <span>{instruction}</span>
              </li>
            ))}
          </ol>
        ) : null}

        <div className="mt-6">
          {hasProof ? (
            <div className="overflow-hidden rounded-3xl border border-zinc-200 dark:border-zinc-700">
              {proofPreviewUrl ? <img src={proofPreviewUrl} alt="Pratinjau bukti pembayaran" className="max-h-64 w-full bg-zinc-100 object-contain dark:bg-zinc-950" /> : null}
              <div className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-zinc-900 dark:text-white">{proofFileName ?? 'Bukti pembayaran'}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">File siap diproses</p>
                </div>
                {onRemoveProof ? (
                  <button type="button" onClick={onRemoveProof} disabled={disabled || status === 'verifying'} aria-label="Hapus bukti pembayaran" className="flex size-9 shrink-0 items-center justify-center rounded-full text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50 dark:hover:bg-rose-950/40">
                    <Trash2 aria-hidden="true" className="size-4" />
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <label htmlFor={fileInputId} className={cx('flex min-h-44 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-6 text-center transition hover:border-indigo-400 hover:bg-indigo-50/40 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 dark:border-zinc-700 dark:bg-zinc-950/40 dark:hover:border-indigo-600 dark:hover:bg-indigo-950/20', (disabled || !onProofSelect) && 'cursor-not-allowed opacity-60')}>
              <input
                id={fileInputId}
                type="file"
                accept={accept}
                disabled={disabled || !onProofSelect}
                className="sr-only"
                onChange={event => {
                  const file = event.currentTarget.files?.[0];
                  if (file) onProofSelect?.(file);
                  event.currentTarget.value = '';
                }}
              />
              <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm dark:bg-zinc-900 dark:text-indigo-300"><UploadCloud aria-hidden="true" className="size-5" /></span>
              <span className="mt-4 text-sm font-bold text-zinc-800 dark:text-zinc-100">Pilih foto atau screenshot</span>
              <span className="mt-1 text-xs text-zinc-400">JPG, PNG, atau WebP</span>
            </label>
          )}
        </div>

        <div role={status === 'rejected' ? 'alert' : 'status'} aria-live="polite" className={cx('mt-5 flex items-start gap-3 rounded-2xl p-4 text-sm font-semibold', config.className)}>
          <StatusIcon aria-hidden="true" className={cx('mt-0.5 size-4 shrink-0', status === 'verifying' && 'animate-spin motion-reduce:animate-none')} />
          <span>{statusMessage ?? config.label}</span>
        </div>

        {onVerify && status !== 'verified' ? (
          <button
            type="button"
            onClick={onVerify}
            disabled={disabled || !hasProof || status === 'verifying'}
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:-translate-y-0.5 hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 dark:focus-visible:ring-offset-zinc-900"
          >
            {status === 'verifying' ? <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <ShieldCheck aria-hidden="true" className="size-4" />}
            {status === 'verifying' ? 'Sedang memverifikasi…' : verifyLabel}
          </button>
        ) : null}

        {footer ? <div className="mt-5">{footer}</div> : null}
      </div>
    </section>
  );
}

export default ManualPaymentStep;

