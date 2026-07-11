import { useId, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cx, formatMoney } from './utils';

export interface ChoiceCardProps {
  value: string;
  label: string;
  selected: boolean;
  onChange: (selected: boolean, value: string) => void;
  name?: string;
  type?: 'radio' | 'checkbox';
  description?: string;
  icon?: ReactNode;
  imageUrl?: string;
  imageAlt?: string;
  badge?: ReactNode;
  price?: number;
  priceLabel?: string;
  currency?: string;
  locale?: string;
  disabled?: boolean;
  className?: string;
}

export function ChoiceCard({
  value,
  label,
  selected,
  onChange,
  name,
  type = 'radio',
  description,
  icon,
  imageUrl,
  imageAlt = '',
  badge,
  price,
  priceLabel,
  currency = 'IDR',
  locale = 'id-ID',
  disabled = false,
  className,
}: ChoiceCardProps) {
  const generatedId = useId();
  const inputId = `choice-${generatedId}`;
  const descriptionId = description ? `${inputId}-description` : undefined;
  const resolvedPriceLabel = priceLabel ?? (price !== undefined ? (price === 0 ? 'Termasuk' : `+ ${formatMoney(price, currency, locale)}`) : null);

  return (
    <label
      htmlFor={inputId}
      className={cx(
        'group relative flex min-h-28 cursor-pointer overflow-hidden rounded-3xl border bg-white p-4 text-left shadow-sm transition duration-200 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 motion-reduce:transition-none sm:p-5 dark:bg-zinc-900 dark:focus-within:ring-offset-zinc-950',
        selected
          ? 'border-indigo-500 shadow-[0_18px_45px_-28px_rgba(79,70,229,0.8)] ring-1 ring-indigo-500'
          : 'border-zinc-200 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-lg dark:border-zinc-800 dark:hover:border-zinc-700',
        disabled && 'cursor-not-allowed opacity-55 hover:translate-y-0 hover:shadow-sm',
        imageUrl ? 'flex-col p-0' : 'items-start gap-4',
        className,
      )}
    >
      <input
        id={inputId}
        className="sr-only"
        type={type}
        name={name}
        value={value}
        checked={selected}
        disabled={disabled}
        aria-describedby={descriptionId}
        onChange={event => onChange(event.currentTarget.checked, value)}
      />

      {imageUrl ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          <img src={imageUrl} alt={imageAlt} className="size-full object-cover transition duration-500 group-hover:scale-[1.03] motion-reduce:transition-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/35 to-transparent" />
          <span
            aria-hidden="true"
            className={cx(
              'absolute right-3 top-3 flex size-8 items-center justify-center rounded-full border-2 shadow-lg backdrop-blur transition',
              selected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-white/90 bg-white/80 text-transparent',
            )}
          >
            <Check className="size-4" />
          </span>
        </div>
      ) : (
        <div
          aria-hidden="true"
          className={cx(
            'flex size-11 shrink-0 items-center justify-center rounded-2xl transition',
            selected ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300',
          )}
        >
          {selected ? <Check className="size-5" /> : icon ?? <span className="size-2 rounded-full bg-current" />}
        </div>
      )}

      <div className={cx('min-w-0 flex-1', imageUrl && 'p-4 sm:p-5')}>
        <div className="flex items-start justify-between gap-3">
          <span className="text-sm font-bold leading-5 text-zinc-900 sm:text-base dark:text-white">{label}</span>
          {badge ? <span className="shrink-0">{badge}</span> : null}
        </div>
        {description ? <span id={descriptionId} className="mt-1.5 block text-xs leading-5 text-zinc-500 sm:text-sm dark:text-zinc-400">{description}</span> : null}
        {resolvedPriceLabel ? (
          <span className={cx('mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold', price && price > 0 ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300')}>
            {resolvedPriceLabel}
          </span>
        ) : null}
      </div>
    </label>
  );
}

export default ChoiceCard;

