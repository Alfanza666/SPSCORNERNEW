import { describe, expect, it } from 'vitest';
import {
  calculateVisibleFormTotal,
  getActiveFormFields,
  getFormPricingBreakdown,
  getTerminalOutcomeId,
  getVisibleFields,
  hasAnswer,
  matchesCondition,
  sanitizeVisibleAnswers,
  validateVisibleAnswers,
} from '../utils/formLogic';
import { FormField } from '../types/form';

const parent: FormField = {
  id: 'bersedia',
  type: 'radio',
  label: 'Apakah Anda bersedia?',
  required: true,
  options: [
    { value: 'ya', label: 'Ya' },
    { value: 'tidak', label: 'Tidak' },
  ],
};

describe('form conditional logic', () => {
  it('menyembunyikan field turunan sampai induknya dijawab', () => {
    expect(matchesCondition({ fieldId: 'bersedia', operator: 'neq', value: 'tidak' }, {})).toBe(false);
  });

  it('mencocokkan nilai tanpa terpengaruh kapitalisasi', () => {
    expect(matchesCondition({ fieldId: 'bersedia', operator: 'eq', value: 'YA' }, { bersedia: 'ya' })).toBe(true);
  });

  it('mendukung branching dari jawaban checkbox', () => {
    expect(matchesCondition(
      { fieldId: 'minat', operator: 'in', value: ['pelatihan', 'koperasi'] },
      { minat: ['konsumsi', 'koperasi'] },
    )).toBe(true);
  });

  it('hanya mengembalikan pertanyaan yang sesuai cabang jawaban', () => {
    const fields: FormField[] = [
      parent,
      { id: 'alasan_ya', type: 'textarea', label: 'Mengapa?', required: true, condition: { fieldId: 'bersedia', operator: 'eq', value: 'ya' } },
      { id: 'alasan_tidak', type: 'textarea', label: 'Apa kendalanya?', required: false, condition: { fieldId: 'bersedia', operator: 'eq', value: 'tidak' } },
    ];

    expect(getVisibleFields(fields, { bersedia: 'ya' }).map(field => field.id)).toEqual(['bersedia', 'alasan_ya']);
    expect(getVisibleFields(fields, { bersedia: 'tidak' }).map(field => field.id)).toEqual(['bersedia', 'alasan_tidak']);
  });

  it('mencocokkan condition label lama dengan option value', () => {
    expect(matchesCondition(
      { fieldId: 'bersedia', operator: 'eq', value: 'Ya' },
      { bersedia: 'ya' },
      parent,
    )).toBe(true);
  });

  it('tidak menampilkan turunan yatim pada percabangan bertingkat', () => {
    const fields: FormField[] = [
      parent,
      {
        id: 'detail', type: 'radio', label: 'Lanjut?', required: false,
        options: [{ value: 'ya', label: 'Ya' }, { value: 'tidak', label: 'Tidak' }],
        condition: { fieldId: 'bersedia', operator: 'eq', value: 'ya' },
      },
      {
        id: 'detail_lanjut', type: 'text', label: 'Detail lanjutan', required: false,
        condition: { fieldId: 'detail', operator: 'eq', value: 'ya' },
      },
    ];

    expect(getVisibleFields(fields, { bersedia: 'tidak', detail: 'ya' }).map(field => field.id)).toEqual(['bersedia']);
  });

  it('menolak jawaban wajib yang hanya berisi spasi', () => {
    expect(hasAnswer('   ')).toBe(false);
  });

  it('tidak menghitung harga dari cabang yang tersembunyi', () => {
    const fields: FormField[] = [
      parent,
      {
        id: 'paket_ya', type: 'radio', label: 'Pilih paket', required: false,
        options: [{ value: 'premium', label: 'Premium', price: 100_000 }],
        condition: { fieldId: 'bersedia', operator: 'eq', value: 'ya' },
      },
    ];

    expect(calculateVisibleFormTotal(fields, { bersedia: 'tidak', paket_ya: 'premium' })).toBe(0);
    expect(calculateVisibleFormTotal(fields, { bersedia: 'ya', paket_ya: 'premium' })).toBe(100_000);
  });

  it('menghitung quantity dan repeater menggunakan harga configurable', () => {
    const fields: FormField[] = [
      { id: 'jumlah', type: 'number', label: 'Jumlah keluarga', required: true, unit_price: 30_000, min: 1, max: 5 },
      {
        id: 'anggota', type: 'repeater', label: 'Data keluarga', required: true,
        item_unit_price: 10_000, min_items: 1, max_items: 5,
        subfields: [{ id: 'nama', type: 'text', label: 'Nama', required: true }],
      },
    ];
    const answers = { jumlah: 2, anggota: [{ nama: 'A' }, { nama: 'B' }] };

    expect(calculateVisibleFormTotal(fields, answers)).toBe(80_000);
    expect(getFormPricingBreakdown(fields, answers)).toHaveLength(2);
  });

  it('menentukan terminal outcome dari opsi yang dipilih', () => {
    const fields: FormField[] = [{
      ...parent,
      options: [
        { value: 'ya', label: 'Ya' },
        { value: 'tidak', label: 'Tidak', outcome_id: 'declined' },
      ],
    }];
    expect(getTerminalOutcomeId(fields, { bersedia: 'tidak' })).toBe('declined');
  });

  it('menghentikan validasi dan harga setelah opsi terminal', () => {
    const fields: FormField[] = [
      {
        ...parent,
        options: [
          { value: 'ya', label: 'Ya' },
          { value: 'tidak', label: 'Tidak', outcome_id: 'declined' },
        ],
      },
      { id: 'biaya', type: 'radio', label: 'Paket', required: true, options: [{ value: 'x', label: 'X', price: 90_000 }] },
    ];
    const answers = { bersedia: 'tidak', biaya: 'x' };

    expect(getActiveFormFields(fields, answers).map(field => field.id)).toEqual(['bersedia']);
    expect(calculateVisibleFormTotal(fields, answers)).toBe(0);
    expect(sanitizeVisibleAnswers(fields, answers)).toEqual({ bersedia: 'tidak' });
    expect(validateVisibleAnswers(fields, { bersedia: 'tidak' }).valid).toBe(true);
  });

  it('membersihkan jawaban cabang tersembunyi dan memvalidasi batas quantity', () => {
    const fields: FormField[] = [
      parent,
      { id: 'alasan', type: 'text', label: 'Alasan', required: true, condition: { fieldId: 'bersedia', operator: 'eq', value: 'ya' } },
      { id: 'jumlah', type: 'number', label: 'Jumlah', required: true, min: 1, max: 3 },
    ];
    const answers = { bersedia: 'tidak', alasan: 'jawaban lama', jumlah: 5 };

    expect(sanitizeVisibleAnswers(fields, answers)).toEqual({ bersedia: 'tidak', jumlah: 5 });
    expect(validateVisibleAnswers(fields, answers).errors.jumlah).toBe('Maksimal 3.');
    expect(validateVisibleAnswers(fields, answers).errors.alasan).toBeUndefined();
  });
});
