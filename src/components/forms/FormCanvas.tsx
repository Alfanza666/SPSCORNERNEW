import React, { useState, useEffect, useRef } from 'react';
import { FormConfig, FormField } from '../../types/form';

import FormFieldRenderer from './FormFieldRenderer';
import FormSkeleton from './FormSkeleton';

interface FormCanvasProps {
  form: FormConfig;
  isGenerating: boolean;
  onStart: () => void;
  onFinish: () => void;
  onFieldClick?: (fieldId: string | null) => void;
  activeFieldId?: string | null;
  onFieldsReorder?: (fields: FormField[]) => void;
}

export default function FormCanvas({
  form,
  isGenerating,
  onStart,
  onFinish,
  onFieldClick,
  activeFieldId,
  onFieldsReorder,
}: FormCanvasProps) {
  const themeColor = form.theme_color || '#673AB7';
  const [cardIndex, setCardIndex] = useState(0);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const dragOverIndex = useRef<number | null>(null);

  useEffect(() => {
    setCardIndex(0);
  }, [form.layout_type]);

  useEffect(() => {
    if (form.layout_type === 'card' && cardIndex > form.fields.length) {
      setCardIndex(0);
    }
  }, [form.fields.length, form.layout_type, cardIndex]);

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
                  onClick={onStart}
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
          ) : cardIndex > form.fields.length ? (
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
                  onClick={() => setCardIndex(0)}
                  className="px-8 py-3 border-2 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 rounded-full font-bold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Isi Ulang
                </button>
              </div>
            </div>
          ) : (
            <CardSlide
              field={form.fields[cardIndex - 1]}
              index={cardIndex - 1}
              total={form.fields.length}
              themeColor={themeColor}
              inputStyle={form.input_style || 'rounded'}
              onPrev={() => setCardIndex((p) => Math.max(0, p - 1))}
              onNext={() => setCardIndex((p) => p + 1)}
              isLast={cardIndex === form.fields.length}
              onFinish={onFinish}
              onClick={() => onFieldClick?.(form.fields[cardIndex - 1]?.id || null)}
              isActive={activeFieldId === form.fields[cardIndex - 1]?.id}
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
      style={{ fontFamily: form.font_family || 'Inter' }}
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
          {form.fields.map((field, idx) => (
            <ClassicField
              key={field.id}
              field={field}
              idx={idx}
              themeColor={themeColor}
              inputStyle={form.input_style || 'rounded'}
              isActive={activeFieldId === field.id}
              onClick={() => onFieldClick?.(field.id)}
              isLast={idx === form.fields.length - 1}
            />
          ))}
        </div>

        <div className="pt-6 flex justify-end">
          <button
            type="button"
            onClick={onFinish}
            className="px-8 py-3 text-white rounded-full font-bold text-sm shadow-md hover:opacity-90 transition-all"
            style={{ backgroundColor: themeColor }}
          >
            Kirim Jawaban
          </button>
        </div>
      </div>
    </div>
  );
}

function CardSlide({
  field, index, total, themeColor, inputStyle,
  onPrev, onNext, isLast, onFinish,
  onClick, isActive,
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
        <div className="flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{
                backgroundColor: i === index ? themeColor : '#e4e4e7',
                width: i === index ? 16 : 8,
              }}
            />
          ))}
        </div>
      </div>

      <div
        onClick={onClick}
        className={`rounded-xl p-5 transition-all cursor-pointer ${
          isActive
            ? 'ring-2 shadow-lg'
            : 'border border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700'
        }`}
        style={isActive ? { ringColor: themeColor } : undefined}
      >
        <label className="flex items-start gap-2 text-lg font-bold text-zinc-900 dark:text-white mb-4">
          {field.label}
          {field.required && <span className="text-red-500 text-base">*</span>}
        </label>
        <FormFieldRenderer
          field={field}
          themeColor={themeColor}
          inputStyle={inputStyle}
          disabled
        />
      </div>

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
  idx: number;
  themeColor: string;
  inputStyle: string;
  isActive: boolean;
  onClick: () => void;
  isLast: boolean;
  key?: string;
}) {
  const { field, idx, themeColor, inputStyle, isActive, onClick, isLast } = props;
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border p-5 transition-all cursor-pointer ${
        isActive
          ? 'border-indigo-500 ring-1 ring-indigo-500/20 shadow-sm'
          : 'border-zinc-100 dark:border-zinc-800 hover:border-zinc-200 dark:hover:border-zinc-700'
      } ${!isLast ? 'mb-5' : ''}`}
    >
      <label className="block text-sm font-semibold text-zinc-900 dark:text-white mb-3">
        {field.label}
        {field.required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <FormFieldRenderer
        field={field}
        themeColor={themeColor}
        inputStyle={inputStyle}
        disabled
      />
    </div>
  );
}
