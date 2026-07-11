import { describe, expect, it } from 'vitest';
import {
  buildDeterministicUuid,
  buildRegistrationQuote,
  getActiveWorkflowFields,
  getVisibleWorkflowFields,
  paymentInstructions,
  resolveWorkflowPaymentMethod,
  validateWorkflowAnswers,
} from '../routes/programRegistrationWorkflow';

const workflow = {
  field_bindings: {
    attendance: 'attendance',
    shirt_size: 'shirt',
    camping: 'camping',
    bringing_family: 'family',
    family_count: 'family_count',
  },
  pricing_rules: {
    currency: 'IDR',
    shirt_surcharge: { S: 0, XXL: 25_000, XXXL: 40_000 },
    family: { entry_unit_price: 30_000, meal_unit_price: 15_000, max_members: 5 },
  },
};

describe('Program Registration Workflow V2 pricing', () => {
  it('ends a declined RSVP with zero charges', () => {
    expect(buildRegistrationQuote(workflow, { attendance: 'Tidak Hadir' })).toMatchObject({
      attendance_status: 'declined',
      family_count: 0,
      total_amount: 0,
      requires_payment: false,
    });
  });

  it('calculates shirt surcharge plus entry and meal per family member', () => {
    const quote = buildRegistrationQuote(workflow, {
      attendance: 'Ya',
      shirt: 'XXL',
      camping: 'Ya',
      family: 'Ya',
      family_count: 2,
    });
    expect(quote).toMatchObject({
      attendance_status: 'attending',
      shirt_size: 'XXL',
      is_camping: true,
      family_count: 2,
      total_amount: 115_000,
      requires_payment: true,
    });
    expect(quote.items).toHaveLength(3);
  });

  it('ignores malicious hidden family answers when camping is declined', () => {
    const quote = buildRegistrationQuote(workflow, {
      attendance: 'Ya',
      shirt: 'S',
      camping: 'Tidak',
      family: 'Ya',
      family_count: 20,
    });
    expect(quote.family_count).toBe(0);
    expect(quote.total_amount).toBe(0);
  });

  it('rejects a family count above the configured maximum', () => {
    expect(() => buildRegistrationQuote(workflow, {
      attendance: 'Ya',
      shirt: 'S',
      camping: 'Ya',
      family: 'Ya',
      family_count: 6,
    })).toThrow(/antara 1 dan 5/);
  });

  it('derives family count from repeater rows without trusting a client total', () => {
    const quote = buildRegistrationQuote(workflow, {
      attendance: 'Ya',
      shirt: 'S',
      camping: 'Ya',
      family: 'Ya',
      family_count: [{ name: 'Ani' }, { name: 'Budi' }, { name: 'Citra' }],
    });
    expect(quote.family_count).toBe(3);
    expect(quote.total_amount).toBe(135_000);
  });
});

describe('Program Registration Workflow V2 form logic', () => {
  it('keeps conditional descendants hidden when their parent is hidden', () => {
    const fields = [
      { id: 'attendance' },
      { id: 'camping', condition: { fieldId: 'attendance', operator: 'eq', value: 'yes' } },
      { id: 'family', condition: { fieldId: 'camping', operator: 'eq', value: 'yes' } },
    ];
    expect(getVisibleWorkflowFields(fields, { attendance: 'no', camping: 'yes' }).map(field => field.id))
      .toEqual(['attendance']);
  });

  it('builds a stable UUID for retry-safe form responses', () => {
    const first = buildDeterministicUuid('program:user:form');
    expect(first).toBe(buildDeterministicUuid('program:user:form'));
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('stops the active path after a terminal outcome', () => {
    const fields = [
      {
        id: 'attendance',
        type: 'radio',
        options: [
          { value: 'yes', label: 'Hadir' },
          { value: 'no', label: 'Tidak Hadir', outcome_id: 'declined' },
        ],
      },
      { id: 'shirt', type: 'select', required: true },
    ];
    expect(getActiveWorkflowFields(fields, { attendance: 'no', shirt: 'XXL' }).map(field => field.id))
      .toEqual(['attendance']);
  });

  it('validates repeater limits and required member details on the server', () => {
    const fields = [{
      id: 'family_members',
      type: 'repeater',
      label: 'Anggota keluarga',
      required: true,
      min_items: 1,
      max_items: 2,
      subfields: [{ id: 'name', type: 'text', label: 'Nama', required: true }],
    }];

    expect(() => validateWorkflowAnswers(fields, { family_members: [{ name: '' }] }))
      .toThrow(/Nama anggota ke-1 wajib diisi/);
    expect(() => validateWorkflowAnswers(fields, {
      family_members: [{ name: 'Ani' }, { name: 'Budi' }, { name: 'Citra' }],
    })).toThrow(/antara 1 dan 2/);
    expect(() => validateWorkflowAnswers(fields, { family_members: [{ name: 'Ani' }] }))
      .not.toThrow();
  });

  it('rejects option spoofing and out-of-range numbers', () => {
    const optionField = {
      id: 'shirt',
      type: 'select',
      label: 'Ukuran baju',
      required: true,
      options: [{ value: 'S', label: 'Small' }],
    };
    const numberField = { id: 'count', type: 'number', label: 'Jumlah', required: true, min: 1, max: 5 };

    expect(() => validateWorkflowAnswers([optionField], { shirt: 'XXXXL' }))
      .toThrow(/pilihan yang tidak tersedia/);
    expect(() => validateWorkflowAnswers([numberField], { count: 6 }))
      .toThrow(/maksimal 5/);
  });

  it('accepts only payment methods enabled by the workflow', () => {
    const paymentWorkflow = {
      payment_rules: {
        methods: ['bank_transfer'],
        method: 'manual_transfer',
        bank_name: 'Bank SPS',
      },
    };

    expect(paymentInstructions(paymentWorkflow)).toMatchObject({
      payment_methods: ['bank_transfer'],
      method: 'bank_transfer',
      bank_name: 'Bank SPS',
    });
    expect(resolveWorkflowPaymentMethod(paymentWorkflow, 'manual_qris')).toBe('bank_transfer');
    expect(resolveWorkflowPaymentMethod(paymentWorkflow, 'bank_transfer')).toBe('bank_transfer');
  });
});
