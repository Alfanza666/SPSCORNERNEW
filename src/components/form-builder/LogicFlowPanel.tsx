import { useId, useState, type ReactNode } from 'react';
import {
  ArrowDown,
  CheckCircle2,
  CircleDot,
  Flag,
  GitBranch,
  Info,
  Route,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type { Condition, FormConfig, FormField, FormOption } from '../../types/form';
import type { FieldUpdateHandler } from './types';

export interface LogicFlowPanelProps {
  form: FormConfig;
  selectedFieldId?: string | null;
  onSelectField?: (fieldId: string) => void;
  onUpdateField?: FieldUpdateHandler;
  className?: string;
  showEditor?: boolean;
}

const OPERATOR_LABEL: Record<Condition['operator'], string> = {
  eq: 'sama dengan',
  neq: 'tidak sama dengan',
  in: 'salah satu dari',
};

const CONDITION_PARENT_TYPES = new Set<FormField['type']>([
  'radio',
  'select',
  'checkbox',
  'image_choice',
]);

export function LogicFlowPanel({
  form,
  selectedFieldId,
  onSelectField,
  onUpdateField,
  className = '',
  showEditor = true,
}: LogicFlowPanelProps) {
  const generatedId = useId();
  const [internalFieldId, setInternalFieldId] = useState<string | null>(null);
  const activeFieldId = selectedFieldId === undefined ? internalFieldId : selectedFieldId;
  const selectedIndex = form.fields.findIndex((field) => field.id === activeFieldId);
  const selectedField = selectedIndex >= 0 ? form.fields[selectedIndex] : null;
  const fieldsById = new Map(form.fields.map((field) => [field.id, field]));
  const conditionalFields = form.fields.filter((field) => field.condition);
  const invalidConditionCount = conditionalFields.filter(
    (field) => !fieldsById.has(field.condition?.fieldId || ''),
  ).length;
  const terminalOptionCount = form.fields.reduce(
    (total, field) => total + (field.options?.filter((option) => option.outcome_id).length || 0),
    0,
  );

  const selectField = (fieldId: string) => {
    if (selectedFieldId === undefined) setInternalFieldId(fieldId);
    onSelectField?.(fieldId);
  };

  return (
    <section
      aria-label="Peta alur formulir"
      className={`min-h-0 bg-slate-50/70 dark:bg-zinc-950 ${className}`}
    >
      <div className="border-b border-slate-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-[0_10px_28px_-12px_rgba(79,70,229,0.9)]">
            <Route className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
              Journey map
            </p>
            <h2 className="mt-1 text-sm font-bold text-slate-950 dark:text-white">Alur jawaban</h2>
            <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-zinc-400">
              Lihat urutan, percabangan, dan hasil akhir dalam satu peta.
            </p>
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-3 gap-2">
          <FlowMetric label="Langkah" value={form.fields.length} tone="slate" />
          <FlowMetric label="Cabang" value={conditionalFields.length} tone="violet" />
          <FlowMetric label="Outcome" value={terminalOptionCount || form.outcomes?.length || 0} tone="emerald" />
        </dl>
      </div>

      <div className="space-y-5 px-3 py-4 sm:px-4">
        {invalidConditionCount > 0 && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[10px] leading-4 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-300"
          >
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {invalidConditionCount} kondisi merujuk pertanyaan yang sudah tidak tersedia. Pilih field tersebut untuk memperbaikinya.
          </div>
        )}

        <div aria-label="Urutan pertanyaan" className="relative">
          <FlowStart />

          {form.fields.length === 0 ? (
            <div className="ml-4 mt-3 rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center dark:border-zinc-700 dark:bg-zinc-900">
              <Sparkles className="mx-auto h-6 w-6 text-slate-300 dark:text-zinc-600" aria-hidden="true" />
              <p className="mt-3 text-xs font-bold text-slate-700 dark:text-zinc-200">Alur masih kosong</p>
              <p className="mt-1 text-[10px] leading-4 text-slate-400 dark:text-zinc-500">
                Tambahkan pertanyaan dari panel elemen untuk mulai membentuk journey.
              </p>
            </div>
          ) : (
            <ol className="mt-2 list-none p-0">
              {form.fields.map((field, index) => {
                const isActive = field.id === activeFieldId;
                const parent = field.condition ? fieldsById.get(field.condition.fieldId) : undefined;

                return (
                  <li key={field.id} className="relative pl-8">
                    <span
                      aria-hidden="true"
                      className="absolute bottom-0 left-[13px] top-0 w-px bg-slate-200 dark:bg-zinc-800"
                    />
                    <span
                      aria-hidden="true"
                      className={`absolute left-[8px] top-6 h-3 w-3 rounded-full border-[3px] border-slate-50 dark:border-zinc-950 ${
                        field.condition ? 'bg-violet-500' : 'bg-slate-400 dark:bg-zinc-500'
                      }`}
                    />

                    {field.condition && (
                      <ConditionSummary field={field} parent={parent} />
                    )}

                    <button
                      type="button"
                      onClick={() => selectField(field.id)}
                      aria-pressed={isActive}
                      aria-describedby={`${generatedId}-field-${index}-meta`}
                      className={`group mb-3 w-full rounded-2xl border bg-white p-3 text-left shadow-[0_10px_28px_-24px_rgba(15,23,42,0.55)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 dark:bg-zinc-900 dark:focus-visible:ring-offset-zinc-950 ${
                        isActive
                          ? 'border-violet-400 ring-4 ring-violet-500/10 dark:border-violet-600'
                          : 'border-slate-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-zinc-800 dark:hover:border-zinc-700'
                      }`}
                    >
                      <span className="flex items-start gap-3">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[10px] font-extrabold ${
                            field.condition
                              ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300'
                          }`}
                        >
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold text-slate-800 dark:text-zinc-100">
                            {field.label || 'Pertanyaan tanpa judul'}
                          </span>
                          <span
                            id={`${generatedId}-field-${index}-meta`}
                            className="mt-1 flex flex-wrap items-center gap-1.5 text-[9px] font-semibold text-slate-400 dark:text-zinc-500"
                          >
                            <span className="uppercase tracking-wider">{field.type.replace(/_/g, ' ')}</span>
                            {field.required && (
                              <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-red-600 dark:bg-red-950/30 dark:text-red-300">
                                Wajib
                              </span>
                            )}
                            {field.condition && (
                              <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-violet-600 dark:bg-violet-950/30 dark:text-violet-300">
                                Bersyarat
                              </span>
                            )}
                          </span>
                        </span>
                        <ArrowDown
                          className={`mt-1 h-3.5 w-3.5 shrink-0 -rotate-90 transition group-hover:translate-x-0.5 ${
                            isActive ? 'text-violet-600' : 'text-slate-300 dark:text-zinc-600'
                          }`}
                          aria-hidden="true"
                        />
                      </span>

                      {field.options?.some((option) => option.outcome_id) && (
                        <span className="mt-3 block border-t border-slate-100 pt-2 dark:border-zinc-800">
                          {field.options
                            .filter((option) => option.outcome_id)
                            .map((option) => (
                              <span
                                key={`${option.value}-${option.outcome_id}`}
                                className="mr-1.5 mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
                              >
                                <Flag className="h-2.5 w-2.5" aria-hidden="true" />
                                {option.label} → {getOutcomeTitle(form, option.outcome_id)}
                              </span>
                            ))}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          )}

          {form.fields.length > 0 && <FlowFinish form={form} />}
        </div>

        {showEditor && selectedField && (
          <ConditionEditor
            form={form}
            field={selectedField}
            fieldIndex={selectedIndex}
            onUpdateField={onUpdateField}
          />
        )}
      </div>
    </section>
  );
}

function ConditionEditor({
  form,
  field,
  fieldIndex,
  onUpdateField,
}: {
  form: FormConfig;
  field: FormField;
  fieldIndex: number;
  onUpdateField?: FieldUpdateHandler;
}) {
  const controlId = useId();
  const parentCandidates = form.fields
    .slice(0, fieldIndex)
    .filter((candidate) => CONDITION_PARENT_TYPES.has(candidate.type) && candidate.options?.length);
  const selectedParent = parentCandidates.find((candidate) => candidate.id === field.condition?.fieldId);
  const disabled = !onUpdateField;

  const updateCondition = (condition?: Condition) => onUpdateField?.(field.id, { condition });
  const selectParent = (parentId: string) => {
    const parent = parentCandidates.find((candidate) => candidate.id === parentId);
    if (!parent) return updateCondition(undefined);
    updateCondition({ fieldId: parent.id, operator: 'eq', value: parent.options?.[0]?.value || '' });
  };

  return (
    <div className="overflow-hidden rounded-[22px] border border-violet-200 bg-white shadow-[0_18px_48px_-36px_rgba(79,70,229,0.75)] dark:border-violet-900/60 dark:bg-zinc-900">
      <div className="flex items-start gap-3 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-indigo-50 px-4 py-3 dark:border-violet-900/40 dark:from-violet-950/30 dark:to-indigo-950/20">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white">
          <GitBranch className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-300">
            Visibility rule
          </p>
          <h3 className="mt-0.5 truncate text-xs font-bold text-slate-900 dark:text-white">
            {field.label || 'Pertanyaan tanpa judul'}
          </h3>
        </div>
        {field.condition && (
          <button
            type="button"
            onClick={() => updateCondition(undefined)}
            disabled={disabled}
            aria-label={`Hapus kondisi untuk ${field.label}`}
            title="Hapus kondisi"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-slate-400 transition hover:bg-white hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-800"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="space-y-4 p-4">
        <LogicControl label="Tampilkan pertanyaan ini" htmlFor={`${controlId}-parent`}>
          <select
            id={`${controlId}-parent`}
            value={field.condition?.fieldId || ''}
            onChange={(event) => selectParent(event.target.value)}
            disabled={disabled || parentCandidates.length === 0}
            className={CONTROL_CLASS}
          >
            <option value="">Selalu tampil</option>
            {parentCandidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                Jika: {candidate.label || 'Pertanyaan tanpa judul'}
              </option>
            ))}
          </select>
        </LogicControl>

        {field.condition && selectedParent && (
          <>
            <LogicControl label="Operator" htmlFor={`${controlId}-operator`}>
              <select
                id={`${controlId}-operator`}
                value={field.condition.operator}
                onChange={(event) => {
                  const operator = event.target.value as Condition['operator'];
                  const currentValues = asValues(field.condition?.value);
                  updateCondition({
                    fieldId: selectedParent.id,
                    operator,
                    value: operator === 'in' ? currentValues : currentValues[0] || '',
                  });
                }}
                disabled={disabled}
                className={CONTROL_CLASS}
              >
                <option value="eq">Sama dengan</option>
                <option value="neq">Tidak sama dengan</option>
                <option value="in">Salah satu dari</option>
              </select>
            </LogicControl>

            <LogicControl label="Nilai jawaban">
              {field.condition.operator === 'in' ? (
                <div className="space-y-2" role="group" aria-label="Nilai jawaban pemicu">
                  {selectedParent.options?.map((option) => {
                    const currentValues = asValues(field.condition?.value);
                    const checked = currentValues.includes(option.value);
                    return (
                      <label
                        key={option.value}
                        className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 text-xs transition focus-within:ring-2 focus-within:ring-violet-500 ${
                          checked
                            ? 'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-200'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300 dark:border-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const nextValues = checked
                              ? currentValues.filter((value) => value !== option.value)
                              : [...currentValues, option.value];
                            updateCondition({ ...field.condition!, value: nextValues });
                          }}
                          disabled={disabled}
                          className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                        />
                        <span className="min-w-0 flex-1 truncate font-semibold">{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <select
                  aria-label="Nilai jawaban pemicu"
                  value={asValues(field.condition.value)[0] || ''}
                  onChange={(event) => updateCondition({ ...field.condition!, value: event.target.value })}
                  disabled={disabled}
                  className={CONTROL_CLASS}
                >
                  {selectedParent.options?.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              )}
            </LogicControl>

            <div className="flex items-start gap-2 rounded-2xl bg-slate-50 p-3 text-[10px] leading-4 text-slate-500 dark:bg-zinc-800/70 dark:text-zinc-400">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" aria-hidden="true" />
              Pertanyaan tampil jika jawaban <strong className="font-bold text-slate-700 dark:text-zinc-200">{selectedParent.label}</strong>{' '}
              {OPERATOR_LABEL[field.condition.operator]} nilai yang dipilih.
            </div>
          </>
        )}

        {field.condition && !selectedParent && (
          <div role="alert" className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[10px] leading-4 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/25 dark:text-amber-300">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1">Sumber kondisi tidak valid atau tidak lagi berada sebelum pertanyaan ini.</span>
            <button
              type="button"
              onClick={() => updateCondition(undefined)}
              disabled={disabled}
              className="shrink-0 rounded-lg bg-amber-100 px-2 py-1 font-bold transition hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-50 dark:bg-amber-900/40 dark:hover:bg-amber-900/60"
            >
              Reset
            </button>
          </div>
        )}

        {parentCandidates.length === 0 && !field.condition && (
          <div className="flex items-start gap-2 rounded-2xl border border-dashed border-slate-200 p-3 text-[10px] leading-4 text-slate-400 dark:border-zinc-700 dark:text-zinc-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Letakkan pertanyaan pilihan sebelum field ini untuk membuat percabangan.
          </div>
        )}
      </div>
    </div>
  );
}

function ConditionSummary({
  field,
  parent,
}: {
  field: FormField;
  parent?: FormField;
}) {
  if (!field.condition) return null;
  const values = asValues(field.condition.value);
  const optionLabels = values.map((value) => getOptionLabel(parent?.options, value)).join(', ');

  return (
    <div className="mb-2 flex min-w-0 items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/75 px-2.5 py-2 text-[9px] leading-4 text-violet-700 dark:border-violet-900/50 dark:bg-violet-950/25 dark:text-violet-300">
      <GitBranch className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="min-w-0 truncate">
        {parent ? parent.label : 'Referensi tidak ditemukan'} · {OPERATOR_LABEL[field.condition.operator]} · {optionLabels || 'nilai kosong'}
      </span>
    </div>
  );
}

function FlowStart() {
  return (
    <div className="flex items-center gap-3 pl-0.5">
      <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-4 border-slate-50 bg-slate-900 text-white shadow-sm dark:border-zinc-950 dark:bg-white dark:text-zinc-900">
        <CircleDot className="h-3 w-3" aria-hidden="true" />
      </span>
      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
        Mulai
      </span>
    </div>
  );
}

function FlowFinish({ form }: { form: FormConfig }) {
  const defaultOutcome = form.outcomes?.find((outcome) => outcome.id === form.default_outcome_id)
    || form.outcomes?.[0];

  return (
    <div className="relative flex items-center gap-3 pl-0.5">
      <span aria-hidden="true" className="absolute bottom-1/2 left-[13px] top-[-12px] w-px bg-slate-200 dark:bg-zinc-800" />
      <span className="relative z-10 flex h-7 w-7 items-center justify-center rounded-full border-4 border-slate-50 bg-emerald-500 text-white shadow-sm dark:border-zinc-950">
        <Flag className="h-3 w-3" aria-hidden="true" />
      </span>
      <span className="min-w-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[9px] font-bold text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
        Selesai{defaultOutcome ? ` · ${defaultOutcome.title}` : ''}
      </span>
    </div>
  );
}

function FlowMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'slate' | 'violet' | 'emerald';
}) {
  const toneClass = {
    slate: 'text-slate-800 dark:text-zinc-100',
    violet: 'text-violet-700 dark:text-violet-300',
    emerald: 'text-emerald-700 dark:text-emerald-300',
  }[tone];

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-center dark:border-zinc-800 dark:bg-zinc-900">
      <dd className={`text-sm font-extrabold ${toneClass}`}>{value}</dd>
      <dt className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">{label}</dt>
    </div>
  );
}

function LogicControl({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  const Label = htmlFor ? 'label' : 'div';
  return (
    <div>
      <Label
        {...(htmlFor ? { htmlFor } : {})}
        className="mb-2 block text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-zinc-400"
      >
        {label}
      </Label>
      {children}
    </div>
  );
}

function asValues(value: Condition['value'] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

function getOptionLabel(options: FormOption[] | undefined, value: string): string {
  return options?.find((option) => option.value === value)?.label || value;
}

function getOutcomeTitle(form: FormConfig, outcomeId: string | undefined): string {
  if (!outcomeId) return 'Selesai';
  return form.outcomes?.find((outcome) => outcome.id === outcomeId)?.title || 'Selesai';
}

const CONTROL_CLASS =
  'h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-800 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-500/15 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:focus:bg-zinc-900';

export default LogicFlowPanel;
