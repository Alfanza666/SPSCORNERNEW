import { describe, expect, it } from 'vitest';
import { calculateVisibleFormTotal, getVisibleFields, hasAnswer, matchesCondition } from '../utils/formLogic';
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
});
