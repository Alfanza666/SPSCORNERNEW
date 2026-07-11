import type { ReactNode } from 'react';
import { Minus, Plus, UserRound, UsersRound } from 'lucide-react';
import { cx, formatMoney } from './utils';

export interface FamilyMember {
  id: string;
  name?: string;
  relation?: string;
}

export interface FamilyRepeaterProps {
  members: readonly FamilyMember[];
  onAdd: () => void;
  onRemove: (memberId: string) => void;
  onChange?: (memberId: string, changes: Partial<Omit<FamilyMember, 'id'>>) => void;
  title?: string;
  description?: string;
  addLabel?: string;
  minimum?: number;
  maximum?: number;
  pricePerPerson?: number;
  currency?: string;
  locale?: string;
  collectDetails?: boolean;
  nameLabel?: string;
  relationLabel?: string;
  relationOptions?: readonly string[];
  disabled?: boolean;
  footer?: ReactNode;
  className?: string;
}

export function FamilyRepeater({
  members,
  onAdd,
  onRemove,
  onChange,
  title = 'Anggota keluarga',
  description = 'Tambahkan jumlah anggota keluarga yang akan ikut.',
  addLabel = 'Tambah anggota',
  minimum = 0,
  maximum = 10,
  pricePerPerson = 0,
  currency = 'IDR',
  locale = 'id-ID',
  collectDetails = false,
  nameLabel = 'Nama anggota keluarga',
  relationLabel = 'Hubungan',
  relationOptions = ['Pasangan', 'Anak', 'Orang tua', 'Saudara', 'Lainnya'],
  disabled = false,
  footer,
  className,
}: FamilyRepeaterProps) {
  const safeMaximum = Math.max(maximum, minimum);
  const canAdd = !disabled && members.length < safeMaximum;
  const canRemove = !disabled && members.length > Math.max(minimum, 0);
  const total = members.length * Math.max(pricePerPerson, 0);

  return (
    <section aria-labelledby="family-repeater-title" className={cx('rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm sm:p-7 dark:border-zinc-800 dark:bg-zinc-900', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
            <UsersRound aria-hidden="true" className="size-5" />
          </div>
          <div>
            <h2 id="family-repeater-title" className="font-bold text-zinc-950 dark:text-white">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{description}</p>
          </div>
        </div>
        {pricePerPerson > 0 ? (
          <span className="self-start rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            {formatMoney(pricePerPerson, currency, locale)} / orang
          </span>
        ) : null}
      </div>

      <div className="mt-6 space-y-3" aria-live="polite">
        {members.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 px-5 py-8 text-center dark:border-zinc-700 dark:bg-zinc-950/40">
            <UserRound aria-hidden="true" className="mx-auto size-8 text-zinc-300 dark:text-zinc-600" />
            <p className="mt-3 text-sm font-semibold text-zinc-500 dark:text-zinc-400">Belum ada anggota keluarga ditambahkan.</p>
          </div>
        ) : (
          members.map((member, index) => (
            <fieldset key={member.id} className="rounded-3xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
              <legend className="sr-only">Anggota keluarga {index + 1}</legend>
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white text-xs font-black text-violet-600 shadow-sm dark:bg-zinc-900 dark:text-violet-300">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-zinc-900 dark:text-white">{member.name?.trim() || `Anggota keluarga ${index + 1}`}</p>
                    <p className="mt-0.5 text-xs text-zinc-400">{member.relation || (pricePerPerson > 0 ? formatMoney(pricePerPerson, currency, locale) : 'Tiket tambahan')}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(member.id)}
                  disabled={!canRemove}
                  aria-label={`Hapus anggota keluarga ${index + 1}`}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-rose-900 dark:hover:bg-rose-950/40"
                >
                  <Minus aria-hidden="true" className="size-4" />
                </button>
              </div>

              {collectDetails ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">{nameLabel}</span>
                    <input
                      type="text"
                      value={member.name ?? ''}
                      disabled={disabled || !onChange}
                      onChange={event => onChange?.(member.id, { name: event.currentTarget.value })}
                      autoComplete="name"
                      className="min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                      placeholder="Nama lengkap"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-zinc-500">{relationLabel}</span>
                    <select
                      value={member.relation ?? ''}
                      disabled={disabled || !onChange}
                      onChange={event => onChange?.(member.id, { relation: event.currentTarget.value })}
                      className="min-h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                    >
                      <option value="">Pilih hubungan</option>
                      {relationOptions.map(relation => <option key={relation} value={relation}>{relation}</option>)}
                    </select>
                  </label>
                </div>
              ) : null}
            </fieldset>
          ))
        )}
      </div>

      <button
        type="button"
        onClick={onAdd}
        disabled={!canAdd}
        className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-violet-300 bg-violet-50/60 px-4 py-2.5 text-sm font-bold text-violet-700 transition hover:border-violet-500 hover:bg-violet-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 dark:border-violet-800 dark:bg-violet-950/20 dark:text-violet-300 dark:hover:bg-violet-950/40 dark:focus-visible:ring-offset-zinc-900"
      >
        <Plus aria-hidden="true" className="size-4" />
        {members.length >= safeMaximum ? `Maksimal ${safeMaximum} anggota` : addLabel}
      </button>

      <div className="mt-5 flex items-center justify-between gap-4 border-t border-zinc-100 pt-5 dark:border-zinc-800">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">Jumlah keluarga</p>
          <output className="mt-1 block text-lg font-black tabular-nums text-zinc-950 dark:text-white" aria-label={`${members.length} anggota keluarga`}>{members.length} orang</output>
        </div>
        {pricePerPerson > 0 ? (
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-zinc-400">Biaya tambahan</p>
            <output className="mt-1 block text-lg font-black tabular-nums text-violet-600 dark:text-violet-300" aria-label={`Biaya tambahan ${formatMoney(total, currency, locale)}`}>{formatMoney(total, currency, locale)}</output>
          </div>
        ) : null}
      </div>

      {footer ? <div className="mt-5">{footer}</div> : null}
    </section>
  );
}

export default FamilyRepeater;

