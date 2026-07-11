import { describe, expect, it } from 'vitest';
import { FormConfig } from '../types/form';
import { evaluateFormWorkflow } from '../utils/formWorkflow';

const eventForm: FormConfig = {
  title: 'RSVP',
  experience_version: 2,
  layout_type: 'card',
  fields: [
    {
      id: 'attendance', type: 'radio', label: 'Apakah hadir?', required: true,
      options: [
        { value: 'yes', label: 'Ya' },
        { value: 'no', label: 'Tidak', outcome_id: 'declined' },
      ],
    },
    {
      id: 'size', type: 'radio', label: 'Ukuran baju', required: true,
      condition: { fieldId: 'attendance', operator: 'eq', value: 'yes' },
      options: [{ value: 'xl', label: 'XL' }, { value: 'xxl', label: 'XXL', price: 20_000 }],
    },
    {
      id: 'family', type: 'repeater', label: 'Keluarga', required: false,
      item_unit_price: 30_000, max_items: 4,
      condition: { fieldId: 'attendance', operator: 'eq', value: 'yes' },
      subfields: [{ id: 'name', type: 'text', label: 'Nama', required: true }],
    },
  ],
  outcomes: [{
    id: 'declined', kind: 'declined', title: 'Tidak hadir', issue_entitlements: false,
  }],
  program_automation: {
    attendance_field_id: 'attendance',
    attending_value: 'yes',
    declined_value: 'no',
    family_repeater_field_id: 'family',
  },
};

describe('form workflow evaluation', () => {
  it('mengakhiri declined tanpa harga dan entitlement', () => {
    const result = evaluateFormWorkflow(eventForm, { attendance: 'no', size: 'xxl' });
    expect(result.outcome.kind).toBe('declined');
    expect(result.total_amount).toBe(0);
    expect(result.answers.size).toBeUndefined();
  });

  it('meminta pembayaran dari surcharge dan anggota keluarga', () => {
    const result = evaluateFormWorkflow(eventForm, {
      attendance: 'yes',
      size: 'xxl',
      family: [{ name: 'A' }, { name: 'B' }],
    });
    expect(result.valid).toBe(true);
    expect(result.total_amount).toBe(80_000);
    expect(result.family_count).toBe(2);
    expect(result.requires_payment).toBe(true);
    expect(result.outcome.kind).toBe('pending_payment');
  });
});
