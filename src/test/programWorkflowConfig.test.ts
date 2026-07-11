import { describe, expect, it } from 'vitest';
import { createEventRsvpTemplate } from '../utils/formTemplates';
import { createProgramWorkflowConfig } from '../utils/programWorkflowConfig';

describe('program workflow config builder', () => {
  it('maps configurable RSVP fields, pricing, and entitlements', () => {
    const form = createEventRsvpTemplate({ xxlSurcharge: 25_000, familyUnitPrice: 30_000, maxFamilyMembers: 7 });
    const config = createProgramWorkflowConfig(form, 'program-1', 'form-1', 'admin-1');

    expect(config?.field_bindings).toMatchObject({
      attendance: { field_id: 'attendance' },
      family_count: { field_id: 'family_members', source_type: 'repeater' },
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
});
