import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  FileUp,
  Loader2,
  Minus,
  Plus,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { FormConfig, FormField, FormOutcome, ManualPaymentMethod } from '../../types/form';
import {
  getActiveFormFields,
  getFormPricingBreakdown,
  getTerminalOutcomeId,
  hasAnswer,
  type FormAddonOrders,
  type FormAnswers,
} from '../../utils/formLogic';
import { evaluateFormWorkflow } from '../../utils/formWorkflow';
import {
  ChoiceCard,
  EventCover,
  FamilyRepeater,
  FormExperienceShell,
  ManualPaymentStep,
  OrderSummary,
  OutcomeScreen,
  ReviewStep,
  type FamilyMember,
  type OutcomeStatus,
  type ReviewSection,
} from './experience';

type ExperienceStage = 'cover' | 'questions' | 'review' | 'payment' | 'outcome';

export interface PremiumFormSubmitPayload {
  answers: FormAnswers;
  addonOrders: FormAddonOrders;
  total: number;
  outcomeId: string | null;
  paymentMethod?: ManualPaymentMethod;
  paymentProof?: File;
}

export interface PremiumFormSubmitResult {
  status: 'success' | 'pending' | 'declined';
  title?: string;
  message?: string;
  reference?: string;
  total?: number;
}

export interface PremiumFormExperienceProps {
  form: FormConfig;
  mode?: 'respondent' | 'preview';
  initialAnswers?: FormAnswers;
  initialResult?: PremiumFormSubmitResult | null;
  draftKey?: string;
  respondentName?: string;
  programName?: string;
  submitting?: boolean;
  onBack?: () => void;
  onUploadFile?: (fieldId: string, file: File) => Promise<string>;
  onSubmit?: (payload: PremiumFormSubmitPayload) => Promise<PremiumFormSubmitResult>;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
}

function displayAnswer(field: FormField, value: unknown): ReactNode {
  if (field.type === 'repeater') {
    const rows = Array.isArray(value) ? value : [];
    return rows.length > 0 ? `${rows.length} ${field.item_label || 'data'}` : 'Tidak ada';
  }
  if (field.type === 'checkbox') {
    const values = Array.isArray(value) ? value : [];
    return values.map(item => field.options?.find(option => option.value === item)?.label || String(item)).join(', ');
  }
  if (['radio', 'select', 'image_choice'].includes(field.type)) {
    return field.options?.find(option => option.value === value)?.label || String(value ?? '');
  }
  if (field.type === 'addon_group') return 'Lihat ringkasan pesanan';
  return value === undefined || value === null || value === '' ? '—' : String(value);
}

function isFieldComplete(field: FormField, value: unknown, addonOrders: FormAddonOrders): string | null {
  if (field.type === 'payment_section') return null;
  if (field.type === 'addon_group') {
    if (field.required && !(addonOrders[field.id] || []).some(order => order.quantity > 0)) return 'Pilih minimal satu item.';
    return null;
  }
  if (field.required && !hasAnswer(value)) return 'Pertanyaan ini wajib diisi.';
  if (field.type === 'number' && hasAnswer(value)) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return 'Masukkan angka yang valid.';
    if (field.min !== undefined && numericValue < field.min) return `Minimal ${field.min}.`;
    if (field.max !== undefined && numericValue > field.max) return `Maksimal ${field.max}.`;
  }
  if (field.type === 'repeater') {
    const rows = Array.isArray(value) ? value : [];
    if (field.min_items !== undefined && rows.length < field.min_items) return `Tambahkan minimal ${field.min_items} ${field.item_label || 'data'}.`;
    if (field.max_items !== undefined && rows.length > field.max_items) return `Maksimal ${field.max_items} ${field.item_label || 'data'}.`;
    const requiredSubfields = field.subfields?.filter(subfield => subfield.required) || [];
    if (rows.some(row => requiredSubfields.some(subfield => !hasAnswer((row as Record<string, unknown>)?.[subfield.id])))) return 'Lengkapi data setiap anggota.';
  }
  return null;
}

function findOutcome(form: FormConfig, outcomeId: string | null): FormOutcome | undefined {
  return form.outcomes?.find(outcome => outcome.id === (outcomeId || form.default_outcome_id));
}

function outcomeStatus(result: PremiumFormSubmitResult): OutcomeStatus {
  if (result.status === 'declined') return 'declined';
  if (result.status === 'pending') return 'pending';
  return 'success';
}

export default function PremiumFormExperience({
  form,
  mode = 'respondent',
  initialAnswers = {},
  initialResult = null,
  draftKey,
  respondentName,
  programName,
  submitting: externalSubmitting = false,
  onBack,
  onUploadFile,
  onSubmit,
}: PremiumFormExperienceProps) {
  const [stage, setStage] = useState<ExperienceStage>(() => initialResult
    ? 'outcome'
    : form.welcome_screen?.enabled === false
      ? (form.fields.some(field => field.type !== 'payment_section') ? 'questions' : 'review')
      : 'cover');
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<FormAnswers>(() => {
    if (!draftKey || typeof window === 'undefined') return initialAnswers;
    try {
      const stored = window.localStorage.getItem(draftKey);
      return stored ? { ...initialAnswers, ...JSON.parse(stored) } : initialAnswers;
    } catch {
      return initialAnswers;
    }
  });
  const [addonOrders, setAddonOrders] = useState<FormAddonOrders>({});
  const [error, setError] = useState<string | null>(null);
  const [uploadingFieldId, setUploadingFieldId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<ManualPaymentMethod | undefined>();
  const [paymentProof, setPaymentProof] = useState<File | undefined>();
  const [paymentProofPreview, setPaymentProofPreview] = useState<string | undefined>();
  const [result, setResult] = useState<PremiumFormSubmitResult | null>(initialResult);
  const [internalSubmitting, setInternalSubmitting] = useState(false);

  const activeFields = useMemo(() => getActiveFormFields(form.fields, answers), [form.fields, answers]);
  const questions = useMemo(() => activeFields.filter(field => field.type !== 'payment_section'), [activeFields]);
  const paymentField = activeFields.find(field => field.type === 'payment_section');
  const terminalOutcomeId = getTerminalOutcomeId(form.fields, answers);
  const evaluation = useMemo(() => evaluateFormWorkflow(form, answers, addonOrders), [form, answers, addonOrders]);
  const pricingLines = useMemo(() => getFormPricingBreakdown(form.fields, answers, addonOrders), [form.fields, answers, addonOrders]);
  const isSubmitting = externalSubmitting || internalSubmitting;
  const currentField = questions[Math.min(questionIndex, Math.max(questions.length - 1, 0))];
  const accentColor = form.theme?.primary_color || form.theme_color || '#4F46E5';

  useEffect(() => {
    setQuestionIndex(index => Math.min(index, Math.max(questions.length - 1, 0)));
  }, [questions.length]);

  useEffect(() => {
    if (!draftKey || stage === 'outcome' || typeof window === 'undefined') return;
    window.localStorage.setItem(draftKey, JSON.stringify(answers));
  }, [answers, draftKey, stage]);

  useEffect(() => {
    if (!paymentProof) {
      setPaymentProofPreview(undefined);
      return;
    }
    const objectUrl = URL.createObjectURL(paymentProof);
    setPaymentProofPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [paymentProof]);

  const updateAnswer = (fieldId: string, value: unknown) => {
    setAnswers(previous => ({ ...previous, [fieldId]: value }));
    setError(null);
  };

  const handleNext = () => {
    if (!currentField) return setStage('review');
    const fieldError = isFieldComplete(currentField, answers[currentField.id], addonOrders);
    if (fieldError) {
      setError(fieldError);
      return;
    }
    setError(null);
    const isTerminal = currentField.options?.some(option => {
      const value = answers[currentField.id];
      const selected = Array.isArray(value) ? value.includes(option.value) : value === option.value;
      return selected && option.outcome_id;
    });
    if (isTerminal || questionIndex >= questions.length - 1) setStage('review');
    else setQuestionIndex(index => index + 1);
  };

  const handlePrevious = () => {
    setError(null);
    if (questionIndex > 0) setQuestionIndex(index => index - 1);
    else setStage('cover');
  };

  const submitForm = async () => {
    if (!evaluation.valid) {
      const firstInvalidIndex = questions.findIndex(field => evaluation.errors[field.id]);
      if (firstInvalidIndex >= 0) {
        setQuestionIndex(firstInvalidIndex);
        setStage('questions');
      }
      setError(Object.values(evaluation.errors)[0] || 'Periksa kembali jawaban Anda.');
      return;
    }
    const proofRequired = paymentField?.proof_required !== false;
    if (evaluation.requires_payment && (!paymentMethod || (proofRequired && !paymentProof))) {
      setStage('payment');
      setError(!paymentMethod ? 'Pilih metode pembayaran.' : 'Unggah bukti pembayaran terlebih dahulu.');
      return;
    }

    setInternalSubmitting(true);
    setError(null);
    try {
      const selectedOutcome = findOutcome(form, terminalOutcomeId);
      const fallback: PremiumFormSubmitResult = terminalOutcomeId
        ? { status: 'declined', title: selectedOutcome?.title, message: selectedOutcome?.message }
        : evaluation.requires_payment
          ? { status: 'pending', title: 'Bukti pembayaran sedang diperiksa', message: 'Tiket dan kupon karyawan tetap aktif. QR keluarga tersedia setelah pembayaran disetujui admin.' }
          : { status: 'success', title: selectedOutcome?.title || 'Konfirmasi berhasil', message: selectedOutcome?.message };
      const submissionResult = onSubmit
        ? await onSubmit({
            answers: evaluation.answers,
            addonOrders,
            total: evaluation.total_amount,
            outcomeId: evaluation.outcome?.id || terminalOutcomeId,
            paymentMethod,
            paymentProof,
          })
        : fallback;
      setResult(submissionResult);
      setStage('outcome');
      if (draftKey && typeof window !== 'undefined') window.localStorage.removeItem(draftKey);
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'Formulir belum berhasil dikirim.');
    } finally {
      setInternalSubmitting(false);
    }
  };

  const reviewSections: ReviewSection[] = [{
    id: 'answers',
    title: terminalOutcomeId ? 'Konfirmasi jawaban akhir' : 'Jawaban Anda',
    description: terminalOutcomeId ? 'Setelah dikirim, konfirmasi ini akan dikunci.' : 'Pastikan data sudah tepat sebelum dikirim.',
    items: questions.map(field => ({ id: field.id, label: field.label, value: displayAnswer(field, answers[field.id]) })),
  }];

  const orderSummary = (
    <OrderSummary
      items={pricingLines.map(line => ({ id: `${line.field_id}-${line.option_value || 'line'}`, label: line.label, quantity: line.quantity, unitPrice: line.unit_price, amount: line.line_total }))}
      total={evaluation.total_amount}
      emptyMessage="Tidak ada biaya tambahan."
      note={evaluation.requires_payment ? 'Hak dasar karyawan tetap aktif. Hanya QR keluarga yang menunggu pembayaran.' : 'Tidak ada pembayaran yang perlu diselesaikan.'}
    />
  );

  const headerProgress = stage === 'questions' && questions.length > 0
    ? { current: questionIndex + 1, total: questions.length, label: `Pertanyaan ${questionIndex + 1} dari ${questions.length}` }
    : undefined;

  return (
    <FormExperienceShell
      title={form.title}
      eyebrow={programName || 'SPS Event Experience'}
      accentColor={accentColor}
      progress={form.theme?.show_progress === false ? undefined : headerProgress}
      onBack={onBack}
      headerActions={mode === 'preview' ? <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">Mode preview</span> : undefined}
      footer={<span className="flex items-center justify-center gap-2 text-xs"><ShieldCheck className="h-4 w-4" /> Jawaban dan bukti pembayaran diproses secara aman.</span>}
    >
      {stage === 'cover' && (
        <EventCover
          title={form.welcome_screen?.title || form.title}
          description={form.welcome_screen?.description || form.description}
          eyebrow={form.welcome_screen?.eyebrow || 'Konfirmasi digital'}
          badge={respondentName ? `Untuk ${respondentName}` : form.welcome_screen?.badge}
          imageUrl={form.banner_url}
          highlights={form.welcome_screen?.highlights || []}
          startLabel={form.welcome_screen?.start_label || 'Mulai konfirmasi'}
          onStart={() => setStage(questions.length ? 'questions' : 'review')}
          aside={form.welcome_screen?.adaptive_note_enabled ? (
            <div className="rounded-3xl border border-white/15 bg-zinc-950/85 p-6 text-white backdrop-blur">
              <Sparkles className="h-6 w-6 text-indigo-300" />
              <p className="mt-4 text-sm font-bold">{form.welcome_screen.adaptive_note_title || 'Formulir mengikuti jawaban Anda.'}</p>
              <p className="mt-2 text-xs leading-6 text-zinc-400">{form.welcome_screen.adaptive_note_description || 'Pertanyaan yang tidak relevan otomatis dilewati. Biaya hanya dihitung dari pilihan aktif.'}</p>
            </div>
          ) : undefined}
        />
      )}

      {stage === 'questions' && currentField && (
        <div className="mx-auto max-w-3xl">
          <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-[0_30px_90px_-50px_rgba(24,24,27,0.7)] sm:rounded-[2rem] sm:p-9 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/50">{questionIndex + 1}</span> Informasi peserta</div>
            <h2 className="mt-5 text-xl font-black leading-tight tracking-tight text-zinc-950 sm:text-3xl dark:text-white">{currentField.label}{currentField.required && <span className="ml-1 text-rose-500">*</span>}</h2>
            {currentField.description && <p className="mt-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{currentField.description}</p>}
            <div className="mt-7">
              <FieldReferenceImages field={currentField} />
              <PremiumField
                field={currentField}
                value={answers[currentField.id]}
                addonOrders={addonOrders[currentField.id] || []}
                uploading={uploadingFieldId === currentField.id}
                onChange={value => updateAnswer(currentField.id, value)}
                onAddonChange={orders => { setAddonOrders(previous => ({ ...previous, [currentField.id]: orders })); setError(null); }}
                onFileSelect={async file => {
                  if (!onUploadFile) return updateAnswer(currentField.id, file.name);
                  setUploadingFieldId(currentField.id);
                  try { updateAnswer(currentField.id, await onUploadFile(currentField.id, file)); }
                  finally { setUploadingFieldId(null); }
                }}
              />
            </div>
            {error && <p role="alert" className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
            <div className="mt-8 flex flex-col-reverse gap-3 border-t border-zinc-100 pt-6 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
              <button type="button" onClick={handlePrevious} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-zinc-200 px-4 py-3 text-sm font-bold text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"><ArrowLeft className="h-4 w-4" /> Kembali</button>
              <button type="button" onClick={handleNext} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-6 py-3 text-sm font-bold text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-indigo-600 dark:bg-white dark:text-zinc-950 dark:hover:bg-indigo-300">{questionIndex >= questions.length - 1 || terminalOutcomeId ? 'Periksa jawaban' : 'Lanjut'} <ArrowRight className="h-4 w-4" /></button>
            </div>
          </div>
          {evaluation.total_amount > 0 && <div className="mt-4 text-center text-xs font-bold text-indigo-600 dark:text-indigo-300">Biaya tambahan sementara: {formatCurrency(evaluation.total_amount)}</div>}
        </div>
      )}

      {stage === 'review' && (
        <ReviewStep
          sections={reviewSections}
          title={terminalOutcomeId ? 'Konfirmasi tidak hadir?' : 'Semua sudah benar?'}
          description={terminalOutcomeId ? 'Jawaban akan dikunci setelah konfirmasi akhir dikirim.' : 'Periksa jawaban dan biaya sebelum melanjutkan.'}
          onEditSection={() => { setQuestionIndex(0); setStage('questions'); }}
          summary={orderSummary}
          footer={(
            <div className="space-y-3">
              {error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p>}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => { setQuestionIndex(Math.max(questions.length - 1, 0)); setStage('questions'); }} className="min-h-12 rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-bold text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">Ubah jawaban</button>
                <button type="button" onClick={() => evaluation.requires_payment ? setStage('payment') : void submitForm()} disabled={isSubmitting} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-6 py-3 text-sm font-bold text-white shadow-xl disabled:opacity-50 dark:bg-white dark:text-zinc-950">{isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{terminalOutcomeId ? 'Ya, konfirmasi tidak hadir' : evaluation.requires_payment ? 'Lanjut ke pembayaran' : 'Kirim konfirmasi'}</button>
              </div>
            </div>
          )}
        />
      )}

      {stage === 'payment' && paymentField && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {paymentField.payment_methods?.includes('bank_transfer') && <ChoiceCard value="bank_transfer" label="Transfer bank" description="Bayar ke rekening panitia." selected={paymentMethod === 'bank_transfer'} onChange={() => { setPaymentMethod('bank_transfer'); setError(null); }} />}
            {paymentField.payment_methods?.includes('manual_qris') && <ChoiceCard value="manual_qris" label="QRIS manual" description="Scan QRIS lalu unggah buktinya." selected={paymentMethod === 'manual_qris'} onChange={() => { setPaymentMethod('manual_qris'); setError(null); }} />}
          </div>
          <ManualPaymentStep
            amount={evaluation.total_amount}
            title="Selesaikan biaya tambahan"
            description={paymentField.payment_description || 'Bayar sesuai total, lalu unggah bukti untuk ditinjau admin.'}
            qrImageUrl={paymentMethod === 'manual_qris' ? paymentField.qris_image_url : undefined}
            bankName={paymentMethod === 'bank_transfer' ? paymentField.bank_accounts?.[0]?.bank_name : undefined}
            accountNumber={paymentMethod === 'bank_transfer' ? paymentField.bank_accounts?.[0]?.account_number : undefined}
            accountName={paymentMethod === 'bank_transfer' ? paymentField.bank_accounts?.[0]?.account_name || paymentField.account_name : undefined}
            status={paymentProof ? 'pending' : 'idle'}
            statusMessage="Bukti akan diperiksa admin. Hak dasar karyawan tetap aktif; QR keluarga menunggu persetujuan."
            proofFileName={paymentProof?.name}
            proofPreviewUrl={paymentProofPreview}
            disabled={isSubmitting}
            onProofSelect={file => { setPaymentProof(file); setError(null); }}
            onRemoveProof={() => setPaymentProof(undefined)}
            onVerify={() => void submitForm()}
            verifyLabel={isSubmitting ? 'Mengirim bukti…' : 'Kirim bukti & akhiri formulir'}
            footer={error ? <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">{error}</p> : undefined}
          />
          <button type="button" onClick={() => setStage('review')} disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-zinc-500 hover:bg-white dark:text-zinc-400 dark:hover:bg-zinc-900"><ArrowLeft className="h-4 w-4" /> Kembali ke ringkasan</button>
        </div>
      )}

      {stage === 'outcome' && result && (
        <OutcomeScreen
          status={outcomeStatus(result)}
          title={result.title || (result.status === 'pending' ? 'Menunggu persetujuan pembayaran' : result.status === 'declined' ? 'Konfirmasi tidak hadir tersimpan' : 'Konfirmasi berhasil')}
          description={result.message}
          reference={result.reference}
          details={[
            { id: 'status', label: 'Status', value: result.status === 'pending' ? 'Menunggu verifikasi admin' : result.status === 'declined' ? 'Tidak hadir' : 'Terkonfirmasi' },
            { id: 'total', label: 'Total tambahan', value: formatCurrency(result.total ?? evaluation.total_amount) },
          ]}

          primaryAction={mode === 'preview' ? { label: 'Ulangi preview', onClick: () => { setAnswers({}); setQuestionIndex(0); setResult(null); setStage('cover'); } } : undefined}
          secondaryAction={onBack ? { label: 'Kembali ke portal', onClick: onBack } : undefined}
        >
          {result.status === 'pending' && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">Tiket masuk dan kupon makan karyawan sudah dapat digunakan. QR keluarga otomatis tersedia setelah admin menyetujui pembayaran.</div>}
        </OutcomeScreen>
      )}
    </FormExperienceShell>
  );
}

interface PremiumFieldProps {
  field: FormField;
  value: unknown;
  addonOrders: Array<{ item_id: string; quantity: number }>;
  uploading: boolean;
  onChange: (value: unknown) => void;
  onAddonChange: (orders: Array<{ item_id: string; quantity: number }>) => void;
  onFileSelect: (file: File) => void;
}

function FieldReferenceImages({ field }: { field: FormField }) {
  const references = (field.reference_images || []).filter(reference => reference.url?.trim());
  if (references.length === 0) return null;

  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2">
      {references.map(reference => (
        <figure key={reference.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-950/50">
          <div className="flex min-h-40 items-center justify-center bg-zinc-50 p-3 dark:bg-zinc-900">
            <img src={reference.url} alt={reference.alt || reference.label} className="max-h-56 w-full object-contain" loading="lazy" />
          </div>
          <figcaption className="border-t border-zinc-100 px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            {reference.label}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function PremiumField({ field, value, addonOrders, uploading, onChange, onAddonChange, onFileSelect }: PremiumFieldProps) {
  const inputClass = 'min-h-14 w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-base text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/10 dark:border-zinc-700 dark:bg-zinc-950/60 dark:text-white dark:focus:bg-zinc-950';

  if (['radio', 'checkbox', 'image_choice'].includes(field.type)) {
    const isCheckbox = field.type === 'checkbox';
    return <div className="grid gap-3 sm:grid-cols-2">{field.options?.map(option => {
      const selected = isCheckbox ? Array.isArray(value) && value.includes(option.value) : value === option.value;
      return <div key={option.value}><ChoiceCard value={option.value} label={option.label} description={option.helper_text} imageUrl={field.type === 'image_choice' ? option.image : undefined} price={option.price} selected={selected} type={isCheckbox ? 'checkbox' : 'radio'} name={field.id} onChange={checked => {
        if (!isCheckbox) return onChange(option.value);
        const selectedValues = Array.isArray(value) ? value : [];
        onChange(checked ? [...selectedValues, option.value] : selectedValues.filter(item => item !== option.value));
      }} /></div>;
    })}</div>;
  }

  if (field.type === 'select') return <select className={inputClass} value={String(value ?? '')} onChange={event => onChange(event.target.value)}><option value="">Pilih jawaban</option>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}{option.price ? ` (+${formatCurrency(option.price)})` : ''}</option>)}</select>;
  if (field.type === 'textarea') return <textarea rows={5} className={inputClass} value={String(value ?? '')} onChange={event => onChange(event.target.value)} placeholder={field.placeholder} />;
  if (field.type === 'text') return <input type="text" className={inputClass} value={String(value ?? '')} onChange={event => onChange(event.target.value)} placeholder={field.placeholder} />;
  if (field.type === 'date') return <div className="relative"><CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" /><input type="date" className={`${inputClass} pl-12`} value={String(value ?? '')} onChange={event => onChange(event.target.value)} /></div>;
  if (field.type === 'number') return <input type="number" min={field.min} max={field.max} step={field.step || 1} className={inputClass} value={String(value ?? '')} onChange={event => onChange(event.target.value === '' ? '' : Number(event.target.value))} placeholder={field.placeholder || '0'} />;

  if (field.type === 'repeater') {
    const members: FamilyMember[] = (Array.isArray(value) ? value : []).map((row: any, index) => ({ id: row.id || `member_${index}`, name: row.name, relation: row.relation }));
    const subfieldIds = new Set(field.subfields?.map(subfield => subfield.id));
    return <FamilyRepeater members={members} minimum={field.min_items || 0} maximum={field.max_items || 10} pricePerPerson={field.item_unit_price || 0} title={field.label} description={field.description} collectDetails={Boolean(subfieldIds.has('name') || subfieldIds.has('relation'))} onAdd={() => onChange([...members, { id: `member_${Date.now()}`, name: '', relation: '' }])} onRemove={memberId => onChange(members.filter(member => member.id !== memberId))} onChange={(memberId, changes) => onChange(members.map(member => member.id === memberId ? { ...member, ...changes } : member))} />;
  }

  if (field.type === 'addon_group') return <div className="space-y-3">{field.items?.map(item => {
    const quantity = addonOrders.find(order => order.item_id === item.id)?.quantity || 0;
    const maximum = Math.min(50, Math.max(1, item.max_quantity || 10));
    const details = [item.sizes?.length ? item.sizes.join(', ') : null, formatCurrency(item.price), `maks. ${maximum}`].filter(Boolean).join(' · ');
    return <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 sm:flex-row sm:items-center dark:border-zinc-700 dark:bg-zinc-950/50"><div className="min-w-0 flex-1"><p className="font-bold text-zinc-900 dark:text-white">{item.name}</p><p className="mt-1 text-xs text-zinc-500">{details}</p></div><div className="flex items-center gap-2 self-end sm:self-auto"><button type="button" disabled={quantity === 0} onClick={() => onAddonChange(quantity <= 1 ? addonOrders.filter(order => order.item_id !== item.id) : addonOrders.map(order => order.item_id === item.id ? { ...order, quantity: order.quantity - 1 } : order))} className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-200 bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-900"><Minus className="h-4 w-4" /></button><span className="w-8 text-center font-bold tabular-nums">{quantity}</span><button type="button" disabled={quantity >= maximum} onClick={() => onAddonChange(quantity === 0 ? [...addonOrders, { item_id: item.id, quantity: 1 }] : addonOrders.map(order => order.item_id === item.id ? { ...order, quantity: order.quantity + 1 } : order))} className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-950 text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-zinc-950"><Plus className="h-4 w-4" /></button></div></div>;
  })}</div>;

  if (field.type === 'file_upload' || field.type === 'image') return <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-6 text-center transition hover:border-indigo-400 hover:bg-indigo-50/40 dark:border-zinc-700 dark:bg-zinc-950/40"><input type="file" className="sr-only" accept={field.type === 'image' ? 'image/*' : field.allowed_types?.join(',')} onChange={event => event.target.files?.[0] && onFileSelect(event.target.files[0])} /><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-indigo-600 shadow-sm dark:bg-zinc-900 dark:text-indigo-300">{uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileUp className="h-5 w-5" />}</span><p className="mt-3 text-sm font-bold text-zinc-700 dark:text-zinc-200">{uploading ? 'Mengunggah…' : hasAnswer(value) ? 'File berhasil diunggah' : 'Pilih file untuk diunggah'}</p></label>;

  if (field.type === 'rating' || field.type === 'scale') {
    const maximum = field.type === 'rating' ? field.max || 5 : field.max_scale || 10;
    return <div className="flex flex-wrap gap-2">{Array.from({ length: maximum }, (_, index) => index + 1).map(number => <button key={number} type="button" onClick={() => onChange(number)} className={`flex h-12 min-w-12 items-center justify-center rounded-xl border text-sm font-bold transition ${Number(value) === number ? 'border-indigo-500 bg-indigo-600 text-white shadow-lg' : 'border-zinc-200 bg-white text-zinc-600 hover:border-indigo-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'}`}>{field.type === 'rating' ? '★' : number}</button>)}</div>;
  }

  return <p className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-500 dark:bg-zinc-950/50">Field ini belum memiliki renderer premium.</p>;
}
