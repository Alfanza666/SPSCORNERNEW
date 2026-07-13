import { describe, expect, it } from 'vitest';
import { createEventRsvpTemplate } from '../utils/formTemplates';
import { createProgramWorkflowConfig } from '../utils/programWorkflowConfig';

describe('program workflow config builder', () => {
  it('maps configurable RSVP fields, pricing, and entitlements', () => {
    const form = createEventRsvpTemplate({ xxlSurcharge: 25_000, familyUnitPrice: 30_000, maxFamilyMembers: 7 });
    const config = createProgramWorkflowConfig(form, 'program-1', 'form-1', 'admin-1');

    expect(config?.field_bindings).toMatchObject({
      attendance: { field_id: 'attendance' },
      family_count: { field_id: 'family_count', source_type: 'number' },
    });
    expect(config?.pricing_rules).toMatchObject({
      shirt_surcharge: { xxl: 25_000 },
      family: { entry_unit_price: 30_000, max_members: 7 },
    });
    expect(config?.entitlement_rules).toEqual({ employee: ['attendance', 'meal'], family: ['attendance', 'meal'] });
    expect(config?.payment_rules).toMatchObject({
      provider: 'manual',
      methods: ['bank_transfer', 'manual_qris'],
    });
  });

  it('does not activate event workflow without an attendance binding', () => {
    expect(createProgramWorkflowConfig({ title: 'Survey', fields: [] }, 'program-1', 'form-1')).toBeNull();
  });

  it('snapshots add-on checkout prices for server-side calculation', () => {
    const form = createEventRsvpTemplate();
    form.fields.splice(-1, 0, {
      id: 'extras',
      type: 'addon_group',
      label: 'Fasilitas tambahan',
      required: false,
      items: [
        { id: 'tent', name: 'Sewa tenda', sizes: [], price: 75_000, max_quantity: 2 },
        { id: 'mat', name: 'Matras', sizes: [], price: 20_000, max_quantity: 4 },
      ],
      condition: { fieldId: 'attendance', operator: 'eq', value: 'yes' },
    });

    const config = createProgramWorkflowConfig(form, 'program-1', 'form-1');

    expect(config?.pricing_rules).toMatchObject({
      additional_fields: [{
        field_id: 'extras',
        field_type: 'addon_group',
        items: [
          { id: 'tent', price: 75_000, max_quantity: 2 },
          { id: 'mat', price: 20_000, max_quantity: 4 },
        ],
      }],
    });
  });
});
