import { describe, expect, it } from 'vitest';
import {
  buildDeterministicUuid,
  buildRegistrationQuote,
  getActiveWorkflowFields,
  getVisibleWorkflowFields,
  paymentInstructions,
  resolveWorkflowPaymentMethod,
  isFamilyEntitlementReleased,
  summarizeRegistrationTicketIntegrity,
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

  it('calculates family charges even when the employee does not camp', () => {
    const quote = buildRegistrationQuote(workflow, {
      attendance: 'Ya',
      shirt: 'S',
      camping: 'Tidak',
      family: 'Ya',
      family_count: 2,
    });
    expect(quote.is_camping).toBe(false);
    expect(quote.family_count).toBe(2);
    expect(quote.total_amount).toBe(90_000);
  });

  it('keeps legacy package-only family pricing consistent with the portal projection', () => {
    const quote = buildRegistrationQuote({
      ...workflow,
      pricing_rules: {
        ...workflow.pricing_rules,
        family: { package_unit_price: 40_000, max_members: 5 },
      },
    }, {
      attendance: 'Ya',
      shirt: 'S',
      camping: 'Tidak',
      family: 'Ya',
      family_count: 2,
    });

    expect(quote.total_amount).toBe(80_000);
    expect(quote.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ item_code: 'family_entry', quantity: 2, unit_price: 40_000 }),
    ]));
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

  it('adds configured checkout items without trusting client prices', () => {
    const quote = buildRegistrationQuote({
      ...workflow,
      pricing_rules: {
        ...workflow.pricing_rules,
        additional_fields: [{
          field_id: 'extras',
          field_type: 'addon_group',
          label: 'Fasilitas tambahan',
          items: [
            { id: 'tent', name: 'Sewa tenda', price: 75_000, max_quantity: 2 },
            { id: 'mat', name: 'Matras', price: 20_000, max_quantity: 4 },
          ],
        }],
      },
    }, {
      attendance: 'Ya',
      shirt: 'S',
      camping: 'Tidak',
      family: 'Tidak',
      extras: [
        { item_id: 'tent', quantity: 1, price: 1 },
        { item_id: 'mat', quantity: 2, price: 1 },
      ],
    });

    expect(quote.total_amount).toBe(115_000);
    expect(quote.items.map((item: any) => item.item_name)).toEqual([
      'Fasilitas tambahan: Sewa tenda',
      'Fasilitas tambahan: Matras',
    ]);
  });

  it('rejects an add-on quantity above the configured maximum', () => {
    expect(() => buildRegistrationQuote({
      ...workflow,
      pricing_rules: {
        ...workflow.pricing_rules,
        additional_fields: [{
          field_id: 'extras',
          field_type: 'addon_group',
          label: 'Fasilitas tambahan',
          items: [{ id: 'tent', name: 'Sewa tenda', price: 75_000, max_quantity: 2 }],
        }],
      },
    }, {
      attendance: 'Ya', shirt: 'S', camping: 'Tidak', family: 'Tidak',
      extras: [{ item_id: 'tent', quantity: 3 }],
    })).toThrow(/antara 1 dan 2/);
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

describe('Program Registration Workflow V2 ticket integrity', () => {
  const entitlementWorkflow = {
    entitlement_rules: { employee: ['attendance', 'meal'], family: ['attendance', 'meal'] },
    payment_rules: { hold_family_entitlements_until_paid: true },
  };

  it('releases family tickets when payment is explicitly not required', () => {
    const registration = {
      attendance_status: 'attending',
      registration_status: 'confirmed',
      payment_status: 'not_required',
      family_count: 1,
    };
    expect(isFamilyEntitlementReleased(registration, entitlementWorkflow)).toBe(true);
    expect(summarizeRegistrationTicketIntegrity(registration, entitlementWorkflow, [
      { entitlement_code: 'employee_attendance', beneficiary_type: 'employee', beneficiary_index: null, status: 'active' },
      { entitlement_code: 'employee_meal', beneficiary_type: 'employee', beneficiary_index: null, status: 'active' },
    ])).toMatchObject({
      expected_count: 4,
      issued_count: 2,
      missing_count: 2,
      family_expected_count: 2,
      family_issued_count: 0,
      repairable: true,
      status: 'missing',
    });
  });

  it('holds only family tickets while a required payment is pending', () => {
    const registration = {
      attendance_status: 'attending',
      registration_status: 'payment_pending',
      payment_status: 'pending',
      family_count: 2,
    };
    expect(isFamilyEntitlementReleased(registration, entitlementWorkflow)).toBe(false);
    expect(summarizeRegistrationTicketIntegrity(registration, entitlementWorkflow, [
      { entitlement_code: 'employee_attendance', beneficiary_type: 'employee', beneficiary_index: null, status: 'active' },
      { entitlement_code: 'employee_meal', beneficiary_type: 'employee', beneficiary_index: null, status: 'active' },
    ])).toMatchObject({
      expected_count: 2,
      issued_count: 2,
      missing_count: 0,
      family_expected_count: 4,
      family_held_count: 4,
      repairable: false,
      status: 'waiting_payment',
    });
  });

  it('counts paid family coupons idempotently by entitlement key', () => {
    const registration = {
      attendance_status: 'attending',
      registration_status: 'confirmed',
      payment_status: 'paid',
      family_count: 1,
    };
    const coupons = [
      { entitlement_code: 'employee_attendance', beneficiary_type: 'employee', beneficiary_index: null, status: 'active' },
      { entitlement_code: 'employee_meal', beneficiary_type: 'employee', beneficiary_index: null, status: 'claimed' },
      { entitlement_code: 'family_attendance', beneficiary_type: 'family', beneficiary_index: 1, status: 'active' },
      { entitlement_code: 'family_meal', beneficiary_type: 'family', beneficiary_index: 1, status: 'active' },
      { entitlement_code: 'family_meal', beneficiary_type: 'family', beneficiary_index: 1, status: 'expired' },
    ];
    expect(summarizeRegistrationTicketIntegrity(registration, entitlementWorkflow, coupons)).toMatchObject({
      expected_count: 4,
      issued_count: 4,
      missing_count: 0,
      family_issued_count: 2,
      repairable: false,
      status: 'complete',
    });
  });

  it('does not offer ticket repair while an unlocked registration is still draft', () => {
    const registration = {
      attendance_status: 'attending',
      registration_status: 'draft',
      payment_status: 'not_required',
      family_count: 1,
    };
    expect(summarizeRegistrationTicketIntegrity(registration, entitlementWorkflow, [])).toMatchObject({
      missing_count: 4,
      repairable: false,
      status: 'missing',
    });
  });

  it('never offers ticket repair for a closed or expired program', () => {
    const registration = {
      attendance_status: 'attending',
      registration_status: 'confirmed',
      payment_status: 'not_required',
      family_count: 1,
    };
    const closedProgram = {
      is_active: false,
      publication_status: 'closed',
      end_date: '2020-01-01',
    };
    expect(summarizeRegistrationTicketIntegrity(
      registration,
      entitlementWorkflow,
      [],
      closedProgram,
    )).toMatchObject({
      missing_count: 4,
      repairable: false,
    });
  });
});
