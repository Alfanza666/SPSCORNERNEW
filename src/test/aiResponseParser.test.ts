import { describe, expect, it } from 'vitest';
import { parseAIResponse } from '../utils/aiResponseParser';
import { FormConfig } from '../types/form';

const emptyForm: FormConfig = {
  title: 'Formulir Tanpa Judul',
  fields: [],
  layout_type: 'classic',
};

describe('AI form response parser', () => {
  it('menerapkan schema wrapper updatedForm', () => {
    const result = parseAIResponse({
      message: 'Form selesai dibuat.',
      updatedForm: {
        title: 'Pendaftaran',
        fields: [{ id: 'nama', type: 'text', label: 'Nama', required: true }],
      },
    }, emptyForm);

    expect(result.updatedForm?.title).toBe('Pendaftaran');
    expect(result.updatedForm?.fields).toHaveLength(1);
  });

  it('tidak menganggap chat biasa sebagai formulir', () => {
    const result = parseAIResponse({ message: 'Boleh, saya bantu.' }, emptyForm);
    expect(result.updatedForm).toBeNull();
  });

  it('mempertahankan id database dan mengabaikan id buatan AI', () => {
    const result = parseAIResponse({
      message: 'Form diperbarui.',
      updatedForm: {
        id: 'id_form_jika_ada',
        title: 'Form Baru',
        fields: [{ id: 'nama', type: 'text', label: 'Nama', required: false }],
      },
    }, { ...emptyForm, id: 'database-form-id' });

    expect(result.updatedForm?.id).toBe('database-form-id');
  });

  it('memetakan condition ke id parent yang sudah disanitasi', () => {
    const result = parseAIResponse({
      message: 'Percabangan dibuat.',
      updatedForm: {
        title: 'Form Bersyarat',
        fields: [
          {
            id: 'Pilihan Ya?', type: 'radio', label: 'Bersedia?', required: true,
            options: [{ value: 'yes', label: 'Ya' }, { value: 'no', label: 'Tidak' }],
          },
          {
            id: 'Alasan', type: 'textarea', label: 'Alasan', required: true,
            condition: { fieldId: 'Pilihan Ya?', operator: 'eq', value: 'Ya' },
          },
        ],
      },
    }, emptyForm);

    expect(result.updatedForm?.fields[0].id).toBe('pilihan_ya');
    expect(result.updatedForm?.fields[1].condition).toEqual({
      fieldId: 'pilihan_ya',
      operator: 'eq',
      value: 'yes',
    });
  });

  it('menangani field model yang rusak tanpa crash', () => {
    const result = parseAIResponse({
      message: 'Form diproses.',
      updatedForm: { title: 'Aman', fields: [null, { label: null, options: [null] }] },
    }, emptyForm);

    expect(result.updatedForm?.fields).toHaveLength(2);
    expect(result.updatedForm?.fields.every(field => field.type === 'text')).toBe(true);
  });
});
