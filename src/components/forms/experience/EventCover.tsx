import type { ReactNode } from 'react';
import { ArrowRight, CalendarDays, Loader2, Sparkles } from 'lucide-react';
import { cx } from './utils';

export interface EventCoverMetaItem {
  id: string;
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}

export interface EventCoverProps {
  title: string;
  description?: string;
  eyebrow?: string;
  badge?: string;
  imageUrl?: string;
  imageAlt?: string;
  meta?: readonly EventCoverMetaItem[];
  highlights?: readonly string[];
  startLabel?: string;
  onStart?: () => void;
  loading?: boolean;
  disabled?: boolean;
  aside?: ReactNode;
  className?: string;
}

export function EventCover({
  title,
  description,
  eyebrow = 'Formulir acara',
  badge,
  imageUrl,
  imageAlt = '',
  meta = [],
  highlights = [],
  startLabel = 'Mulai konfirmasi',
  onStart,
  loading = false,
  disabled = false,
  aside,
  className,
}: EventCoverProps) {
  return (
    <section
      aria-labelledby="event-cover-title"
      className={cx('overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-[0_30px_90px_-45px_rgba(24,24,27,0.45)] dark:border-zinc-800 dark:bg-zinc-900', className)}
    >
      <div className="grid lg:grid-cols-[minmax(0,0.95fr)_minmax(22rem,1.05fr)]">
        <div className="order-2 flex flex-col justify-center p-6 sm:p-10 lg:order-1 lg:p-14">
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
              <Sparkles aria-hidden="true" className="size-3.5" />
              {eyebrow}
            </span>
            {badge ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                {badge}
              </span>
            ) : null}
          </div>

          <h2 id="event-cover-title" className="max-w-3xl text-3xl font-black leading-[1.08] tracking-[-0.035em] text-zinc-950 sm:text-5xl dark:text-white">
            {title}
          </h2>
          {description ? <p className="mt-5 max-w-2xl text-sm leading-7 text-zinc-600 sm:text-base dark:text-zinc-300">{description}</p> : null}

          {meta.length > 0 ? (
            <dl className="mt-8 grid gap-3 sm:grid-cols-2">
              {meta.map(item => (
                <div key={item.id} className="flex items-start gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm dark:bg-zinc-900 dark:text-indigo-300">
                    {item.icon ?? <CalendarDays aria-hidden="true" className="size-4" />}
                  </div>
                  <div className="min-w-0">
                    <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">{item.label}</dt>
                    <dd className="mt-1 text-sm font-bold text-zinc-800 dark:text-zinc-100">{item.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
          ) : null}

          {highlights.length > 0 ? (
            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Informasi penting">
              {highlights.map(highlight => (
                <li key={highlight} className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  {highlight}
                </li>
              ))}
            </ul>
          ) : null}

          {onStart ? (
            <div className="mt-9">
              <button
                type="button"
                onClick={onStart}
                disabled={disabled || loading}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-zinc-950/20 transition hover:-translate-y-0.5 hover:bg-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto dark:bg-white dark:text-zinc-950 dark:hover:bg-indigo-300 dark:focus-visible:ring-offset-zinc-900"
              >
                {loading ? <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : null}
                {startLabel}
                {!loading ? <ArrowRight aria-hidden="true" className="size-4" /> : null}
              </button>
            </div>
          ) : null}
        </div>

        <div className="relative order-1 min-h-64 overflow-hidden bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 lg:order-2 lg:min-h-[30rem]">
          {imageUrl ? (
            <>
              <img src={imageUrl} alt="" aria-hidden="true" className="absolute inset-0 size-full scale-110 object-cover opacity-45 blur-2xl" />
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-950/75 via-zinc-950/20 to-zinc-950/70" />
              <div className="relative z-10 flex min-h-64 items-center justify-center p-3 sm:p-5 lg:min-h-[30rem]">
                <img src={imageUrl} alt={imageAlt} className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl ring-1 ring-white/15" />
              </div>
            </>
          ) : (
            <div aria-hidden="true" className="absolute inset-0">
              <div className="absolute -right-16 -top-16 size-64 rounded-full border border-white/25 bg-white/10" />
              <div className="absolute -bottom-28 -left-20 size-80 rounded-full border border-white/20 bg-black/10" />
              <div className="absolute left-1/2 top-1/2 size-40 -translate-x-1/2 -translate-y-1/2 rotate-12 rounded-[2.5rem] border border-white/30 bg-white/10 shadow-2xl backdrop-blur" />
            </div>
          )}
          {!imageUrl ? <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/70 via-zinc-950/5 to-transparent" /> : null}
          {aside ? <div className="absolute inset-x-5 bottom-5 rounded-3xl border border-white/20 bg-zinc-950/35 p-5 text-white shadow-2xl backdrop-blur-xl sm:inset-x-8 sm:bottom-8 sm:p-6">{aside}</div> : null}
        </div>
      </div>
    </section>
  );
}

export default EventCover;
