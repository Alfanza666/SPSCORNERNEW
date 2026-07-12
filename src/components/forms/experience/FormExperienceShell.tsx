import type { CSSProperties, ReactNode } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { cx } from './utils';

export interface FormExperienceProgress {
  current: number;
  total: number;
  label?: string;
}

export interface FormExperienceShellProps {
  children: ReactNode;
  title: string;
  eyebrow?: string;
  brandName?: string;
  brandMark?: ReactNode;
  accentColor?: string;
  progress?: FormExperienceProgress;
  onBack?: () => void;
  backLabel?: string;
  headerActions?: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}

export function FormExperienceShell({
  children,
  title,
  eyebrow,
  brandName = 'SPS Corner',
  brandMark,
  accentColor = '#4f46e5',
  progress,
  onBack,
  backLabel = 'Kembali',
  headerActions,
  footer,
  className,
  contentClassName,
}: FormExperienceShellProps) {
  const total = Math.max(progress?.total ?? 0, 0);
  const current = Math.min(Math.max(progress?.current ?? 0, 0), total || 0);
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  const shellStyle = {
    '--experience-accent': accentColor,
    backgroundImage:
      'radial-gradient(circle at 12% 8%, color-mix(in srgb, var(--experience-accent) 12%, transparent), transparent 30rem), radial-gradient(circle at 88% 88%, color-mix(in srgb, var(--experience-accent) 8%, transparent), transparent 28rem)',
  } as CSSProperties;

  return (
    <div
      className={cx('min-h-dvh bg-zinc-50 text-zinc-950 dark:bg-zinc-950 dark:text-white', className)}
      style={shellStyle}
    >
      <header className="sticky top-0 z-40 border-b border-zinc-200/70 bg-white/85 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/85">
        <div className="mx-auto flex min-h-14 max-w-6xl items-center gap-2 px-3 py-2.5 sm:min-h-16 sm:gap-3 sm:px-6 sm:py-3 lg:px-8">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              aria-label={backLabel}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:-translate-y-0.5 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--experience-accent)] focus-visible:ring-offset-2 sm:size-10 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-white dark:focus-visible:ring-offset-zinc-950"
            >
              <ArrowLeft aria-hidden="true" className="size-4" />
            </button>
          ) : null}

          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg sm:size-10"
              style={{ backgroundColor: accentColor, boxShadow: `0 10px 24px ${accentColor}33` }}
              aria-hidden="true"
            >
              {brandMark ?? <ShieldCheck className="size-5" />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-400">{eyebrow ?? brandName}</p>
              <h1 className="truncate text-sm font-bold text-zinc-900 sm:text-base dark:text-white">{title}</h1>
            </div>
          </div>

          {headerActions ? <div className="flex shrink-0 items-center gap-2">{headerActions}</div> : null}
        </div>

        {progress && total > 0 ? (
          <div className="mx-auto max-w-6xl px-3 pb-3 sm:px-6 lg:px-8">
            <div className="mb-1.5 flex items-center justify-between gap-4 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
              <span className="truncate">{progress.label ?? `Langkah ${current} dari ${total}`}</span>
              <span className="tabular-nums" aria-hidden="true">{percentage}%</span>
            </div>
            <div
              role="progressbar"
              aria-label={progress.label ?? 'Progres pengisian formulir'}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={current}
              className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
            >
              <div
                className="h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${percentage}%`, backgroundColor: accentColor }}
              />
            </div>
          </div>
        ) : null}
      </header>

      <main className={cx('mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-10 lg:px-8', contentClassName)}>
        {children}
      </main>

      {footer ? (
        <footer className="border-t border-zinc-200/70 bg-white/70 dark:border-zinc-800 dark:bg-zinc-950/70">
          <div className="mx-auto max-w-6xl px-4 py-5 text-sm text-zinc-500 sm:px-6 lg:px-8 dark:text-zinc-400">
            {footer}
          </div>
        </footer>
      ) : null}
    </div>
  );
}

export default FormExperienceShell;
