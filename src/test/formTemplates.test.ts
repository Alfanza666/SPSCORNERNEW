import { describe, expect, it } from 'vitest';
import { createEventRsvpTemplate } from '../utils/formTemplates';
import { evaluateFormWorkflow } from '../utils/formWorkflow';

describe('event RSVP template', () => {
  it('membuat form V2 dengan harga dan batas yang configurable', () => {
    const form = createEventRsvpTemplate({
      xxlSurcharge: 20_000,
      xxxlSurcharge: 35_000,
      familyUnitPrice: 30_000,
      maxFamilyMembers: 3,
    });
    const family = form.fields.find(field => field.id === 'family_members');
    const size = form.fields.find(field => field.id === 'shirt_size');

    expect(form.experience_version).toBe(2);
    expect(family?.item_unit_price).toBe(30_000);
    expect(family?.max_items).toBe(3);
    expect(size?.options?.find(option => option.value === 'xxxl')?.price).toBe(35_000);
  });

  it('menghasilkan total sesuai konfigurasi template', () => {
    const form = createEventRsvpTemplate({ xxlSurcharge: 20_000, familyUnitPrice: 30_000 });
    const evaluation = evaluateFormWorkflow(form, {
      attendance: 'yes',
      shirt_size: 'xxl',
      camping: 'yes',
      bring_family: 'yes',
      family_members: [{ name: 'A' }, { name: 'B' }],
      payment: '',
    });
    expect(evaluation.total_amount).toBe(80_000);
    expect(evaluation.requires_payment).toBe(true);
  });
});
