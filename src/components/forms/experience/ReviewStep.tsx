import type { ReactNode } from 'react';
import { CheckCircle2, Pencil } from 'lucide-react';
import { cx } from './utils';

export interface ReviewItem {
  id: string;
  label: string;
  value: ReactNode;
  hint?: string;
}

export interface ReviewSection {
  id: string;
  title: string;
  description?: string;
  items: readonly ReviewItem[];
}

export interface ReviewStepProps {
  sections: readonly ReviewSection[];
  title?: string;
  description?: string;
  onEditSection?: (sectionId: string) => void;
  editLabel?: string;
  summary?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function ReviewStep({
  sections,
  title = 'Periksa jawaban Anda',
  description = 'Pastikan seluruh informasi sudah benar sebelum melanjutkan.',
  onEditSection,
  editLabel = 'Ubah',
  summary,
  footer,
  className,
}: ReviewStepProps) {
  return (
    <section aria-labelledby="review-step-title" className={cx('space-y-6', className)}>
      <div className="max-w-2xl">
        <span className="mb-4 inline-flex size-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300">
          <CheckCircle2 aria-hidden="true" className="size-5" />
        </span>
        <h2 id="review-step-title" className="text-2xl font-black tracking-tight text-zinc-950 sm:text-3xl dark:text-white">{title}</h2>
        {description ? <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{description}</p> : null}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.45fr)] lg:items-start">
        <div className="space-y-4">
          {sections.map(section => (
            <article key={section.id} className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <header className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4 sm:px-6 dark:border-zinc-800">
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-white">{section.title}</h3>
                  {section.description ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{section.description}</p> : null}
                </div>
                {onEditSection ? (
                  <button
                    type="button"
                    onClick={() => onEditSection(section.id)}
                    aria-label={`${editLabel} ${section.title}`}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-indigo-600 transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
                  >
                    <Pencil aria-hidden="true" className="size-3.5" />
                    {editLabel}
                  </button>
                ) : null}
              </header>
              <dl className="divide-y divide-zinc-100 px-5 sm:px-6 dark:divide-zinc-800">
                {section.items.map(item => (
                  <div key={item.id} className="grid gap-1 py-4 sm:grid-cols-[minmax(8rem,0.38fr)_minmax(0,1fr)] sm:gap-6">
                    <dt className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">{item.label}</dt>
                    <dd className="min-w-0 text-sm font-bold text-zinc-900 dark:text-white">
                      {item.value === null || item.value === undefined || item.value === '' ? <span className="font-medium text-zinc-400">—</span> : item.value}
                      {item.hint ? <span className="mt-1 block text-xs font-normal leading-5 text-zinc-400">{item.hint}</span> : null}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>

        {summary ? <aside className="lg:sticky lg:top-28">{summary}</aside> : null}
      </div>

      {footer ? <div>{footer}</div> : null}
    </section>
  );
}

export default ReviewStep;

