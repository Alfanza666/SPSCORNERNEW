import React, { useState, useEffect } from 'react';
import { FormConfig, FormField } from '../../types/form';

import FormFieldRenderer from './FormFieldRenderer';
import FormSkeleton from './FormSkeleton';
import { getVisibleFields, hasAnswer } from '../../utils/formLogic';

interface FormCanvasProps {
  form: FormConfig;
  isGenerating: boolean;
  onStart: () => void;
  onFinish: () => void;
  onFieldClick?: (fieldId: string | null) => void;
  activeFieldId?: string | null;
}

export default function FormCanvas({
  form,
  isGenerating,
  onStart,
  onFinish,
  onFieldClick,
  activeFieldId,
}: FormCanvasProps) {
  const themeColor = form.theme_color || '#673AB7';
  const [cardIndex, setCardIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    setCardIndex(0);
    setAnswers({});
    setValidationError('');
  }, [form.layout_type]);

  const visibleFields = getVisibleFields(form.fields, answers);

  const updateAnswer = (fieldId: string, value: unknown) => {
    setAnswers(previous => ({ ...previous, [fieldId]: value }));
    setValidationError('');
  };

  const startPreview = () => {
    setCardIndex(visibleFields.length > 0 ? 1 : 0);
    setValidationError(visibleFields.length > 0 ? '' : 'Tambahkan minimal satu pertanyaan untuk memulai preview.');
    onStart();
  };

  const finishPreview = () => {
    const missingField = visibleFields.find(field => field.required && field.type !== 'payment_section' && !hasAnswer(answers[field.id]));
    if (missingField) {
      setValidationError(`Pertanyaan wajib belum diisi: ${missingField.label}`);
      return;
    }
    setCardIndex(visibleFields.length + 1);
    setValidationError('');
    onFinish();
  };

  const advanceCard = () => {
    const currentField = visibleFields[cardIndex - 1];
    if (currentField?.required && currentField.type !== 'payment_section' && !hasAnswer(answers[currentField.id])) {
      setValidationError('Pertanyaan ini wajib diisi sebelum melanjutkan.');
      return;
    }
    if (cardIndex >= visibleFields.length) finishPreview();
    else setCardIndex(index => index + 1);
  };

  useEffect(() => {
    if (form.layout_type === 'card' && cardIndex > visibleFields.length + 1) {
      setCardIndex(0);
    }
  }, [visibleFields.length, form.layout_type, cardIndex]);

  if (isGenerating) {
    return <FormSkeleton />;
  }

  if (form.layout_type === 'card') {
    return (
      <div
        className="w-full rounded-2xl overflow-hidden transition-all relative"
        style={{
          background: form.card_glassmorphism
            ? 'rgba(255,255,255,0.85)'
            : undefined,
          backdropFilter: form.card_glassmorphism ? 'blur(12px)' : undefined,
          WebkitBackdropFilter: form.card_glassmorphism ? 'blur(12px)' : undefined,
          border: form.card_glassmorphism
            ? '1px solid rgba(255,255,255,0.25)'
            : undefined,
          backgroundImage: form.bg_image_url ? `url(${form.bg_image_url})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {!form.banner_url && (
          <div className="h-3 w-full" style={{ backgroundColor: themeColor }} />
        )}

        <div
          className={`p-6 md:p-10 ${
            form.card_glassmorphism
              ? 'bg-white/80 dark:bg-zinc-900/80'
              : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl'
          }`}
          style={{ fontFamily: form.font_family || 'Inter' }}
        >
          {cardIndex === 0 ? (
            <div className="text-center py-10 space-y-6">
              {form.banner_url && (
                <div className="w-full h-48 md:h-64 overflow-hidden rounded-2xl mb-6">
                  <img src={form.banner_url} alt="Banner" className="w-full h-full object-cover" />
                </div>
              )}
              <h2 className="text-3xl md:text-4xl font-black text-zinc-900 dark:text-white">
                {form.title}
              </h2>
              <p className="text-zinc-500 leading-relaxed max-w-xl mx-auto">
                {form.description || 'Silakan isi formulir berikut'}
              </p>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={startPreview}
                  className="px-10 py-4 text-white rounded-full font-black text-base shadow-lg hover:opacity-90 active:scale-95 transition-all"
                  style={{
                    backgroundColor: themeColor,
                    boxShadow: `0 10px 25px -5px ${themeColor}55`,
                  }}
                >
                  Mulai Mengisi
                </button>
              </div>
            </div>
          ) : cardIndex > visibleFields.length ? (
            <div className="text-center py-12 space-y-6">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 className="text-3xl font-black text-zinc-900 dark:text-white">
                Terima Kasih!
              </h2>
              <p className="text-zinc-500 leading-relaxed text-sm max-w-md mx-auto">
                Respons Anda telah dikirim.
              </p>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => { setAnswers({}); setCardIndex(0); }}
                  className="px-8 py-3 border-2 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-full font-bold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Isi Ulang
                </button>
              </div>
            </div>
          ) : (
            <CardSlide
              field={visibleFields[cardIndex - 1]}
              index={cardIndex - 1}
              total={visibleFields.length}
              themeColor={themeColor}
              inputStyle={form.input_style || 'rounded'}
              onPrev={() => setCardIndex((p) => Math.max(0, p - 1))}
              onNext={advanceCard}
              isLast={cardIndex === visibleFields.length}
              onFinish={finishPreview}
              onClick={() => onFieldClick?.(visibleFields[cardIndex - 1]?.id || null)}
              isActive={activeFieldId === visibleFields[cardIndex - 1]?.id}
              value={answers[visibleFields[cardIndex - 1]?.id]}
              onChange={(value) => updateAnswer(visibleFields[cardIndex - 1].id, value)}
              validationError={validationError}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`w-full rounded-2xl overflow-hidden transition-all ${
        form.card_glassmorphism
          ? 'bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border border-white/25 dark:border-zinc-800/50 shadow-xl'
          : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm'
      }`}
      style={{
        fontFamily: form.font_family || 'Inter',
        backgroundImage: form.bg_image_url ? `url(${form.bg_image_url})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      data-layout="classic"
    >
      {!form.banner_url && (
        <div className="h-3 w-full" style={{ backgroundColor: themeColor }} />
      )}

      <div className="p-6 md:p-10">
        {form.banner_url && (
          <div className="w-full h-48 md:h-64 overflow-hidden rounded-2xl mb-6">
            <img src={form.banner_url} alt="Banner" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="mb-8">
          <h2 className="text-3xl font-black text-zinc-900 dark:text-white">{form.title}</h2>
          <p className="text-zinc-500 leading-relaxed text-sm mt-2">
            {form.description || 'Silakan isi formulir berikut'}
          </p>
        </div>

        <div className="space-y-6 pt-6 border-t border-zinc-100 dark:border-zinc-800">
          {visibleFields.map((field, idx) => (
            <ClassicField
              key={field.id}
              field={field}
              themeColor={themeColor}
              inputStyle={form.input_style || 'rounded'}
              isActive={activeFieldId === field.id}
              onClick={() => onFieldClick?.(field.id)}
              isLast={idx === visibleFields.length - 1}
              value={answers[field.id]}
              onChange={(value) => updateAnswer(field.id, value)}
            />
          ))}
        </div>

        <div className="pt-6 flex justify-end">
          <button
            type="button"
            onClick={finishPreview}
            className="px-8 py-3 text-white rounded-full font-bold text-sm shadow-md hover:opacity-90 transition-all"
            style={{ backgroundColor: themeColor }}
          >
            Kirim Jawaban
          </button>
        </div>
        {validationError && <p className="pt-3 text-sm font-semibold text-red-500" role="alert">{validationError}</p>}
      </div>
    </div>
  );
}

function CardSlide({
  field, index, total, themeColor, inputStyle,
  onPrev, onNext, isLast, onFinish,
  onClick, isActive, value, onChange, validationError,
}: {
  field: FormField;
  index: number;
  total: number;
  themeColor: string;
  inputStyle: string;
  onPrev: () => void;
  onNext: () => void;
  isLast: boolean;
  onFinish: () => void;
  onClick: () => void;
  isActive: boolean;
  value?: unknown;
  onChange: (value: unknown) => void;
  validationError: string;
}) {
  return (
    <div className="space-y-6 py-4">
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full"
          style={{ color: themeColor, backgroundColor: `${themeColor}15` }}
        >
          Pertanyaan {index + 1} / {total}
        </span>
        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700" aria-label={`Progres ${index + 1} dari ${total}`}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ backgroundColor: themeColor, width: `${((index + 1) / Math.max(total, 1)) * 100}%` }}
          />
        </div>
      </div>

      <div
        onClick={onClick}
        className={`rounded-xl p-5 transition-all cursor-pointer ${
          isActive
            ? 'ring-2 shadow-lg'
            : 'border border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700'
        }`}
        style={isActive ? { borderColor: themeColor, boxShadow: `0 0 0 2px ${themeColor}33` } : undefined}
      >
        <label className="flex items-start gap-2 text-lg font-bold text-zinc-900 dark:text-white mb-4">
          {field.label}
          {field.required && <span className="text-red-500 text-base">*</span>}
        </label>
        <FormFieldRenderer
          field={field}
          themeColor={themeColor}
          inputStyle={inputStyle}
          value={value}
          onChange={onChange}
        />
        {field.description && <p className="mt-2 text-xs text-zinc-400">{field.description}</p>}
      </div>

      {validationError && <p className="text-sm font-semibold text-red-500" role="alert">{validationError}</p>}

      <div className="pt-6 flex items-center justify-between gap-4 border-t border-zinc-100 dark:border-zinc-800">
        <button
          type="button"
          onClick={onPrev}
          className="px-6 py-3 border-2 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-full font-bold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Kembali
        </button>
        <button
          type="button"
          onClick={isLast ? onFinish : onNext}
          className="px-8 py-3 text-white rounded-full font-bold text-sm shadow-md hover:opacity-90 transition-all"
          style={{ backgroundColor: themeColor }}
        >
          {isLast ? 'Kirim' : 'Selanjutnya'}
        </button>
      </div>
    </div>
  );
}

function ClassicField(props: {
  field: FormField;
  themeColor: string;
  inputStyle: string;
  isActive: boolean;
  onClick: () => void;
  isLast: boolean;
  value?: unknown;
  onChange: (value: unknown) => void;
  key?: string;
}) {
  const { field, themeColor, inputStyle, isActive, onClick, isLast, value, onChange } = props;
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border p-5 transition-all cursor-pointer ${
        isActive
          ? 'ring-2 shadow-sm'
          : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700'
      } ${!isLast ? 'mb-5' : ''}`}
      style={isActive ? { borderColor: themeColor, boxShadow: `0 0 0 2px ${themeColor}22` } : undefined}
    >
      <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-3">
        {field.label}
        {field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <FormFieldRenderer
        field={field}
        themeColor={themeColor}
        inputStyle={inputStyle}
        value={value}
        onChange={onChange}
      />
      {field.description && <p className="mt-2 text-xs text-zinc-400">{field.description}</p>}
    </div>
  );
}
