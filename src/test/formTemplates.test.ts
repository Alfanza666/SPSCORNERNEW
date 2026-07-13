import { describe, expect, it } from 'vitest';
import { createEventRsvpTemplate } from '../utils/formTemplates';
import { evaluateFormWorkflow } from '../utils/formWorkflow';
import { getVisibleFields } from '../utils/formLogic';

describe('event RSVP template', () => {
  it('membuat form V2 dengan harga dan batas yang configurable', () => {
    const form = createEventRsvpTemplate({
      xxlSurcharge: 20_000,
      xxxlSurcharge: 35_000,
      familyUnitPrice: 30_000,
      maxFamilyMembers: 3,
    });
    const family = form.fields.find(field => field.id === 'family_count');
    const size = form.fields.find(field => field.id === 'shirt_size');

    expect(form.experience_version).toBe(2);
    expect(family?.type).toBe('number');
    expect(family?.unit_price).toBe(30_000);
    expect(family?.max).toBe(3);
    expect(family?.subfields).toBeUndefined();
    expect(form.welcome_screen?.adaptive_note_enabled).toBe(false);
    expect(size?.options?.find(option => option.value === 'xxxl')?.price).toBe(35_000);
  });

  it('menghasilkan total sesuai konfigurasi template', () => {
    const form = createEventRsvpTemplate({ xxlSurcharge: 20_000, familyUnitPrice: 30_000 });
    const evaluation = evaluateFormWorkflow(form, {
      attendance: 'yes',
      shirt_size: 'xxl',
      camping: 'yes',
      bring_family: 'yes',
      family_count: 2,
      payment: '',
    });
    expect(evaluation.total_amount).toBe(80_000);
    expect(evaluation.requires_payment).toBe(true);
  });

  it('tetap menanyakan keluarga baik peserta camping maupun tidak', () => {
    const form = createEventRsvpTemplate();

    expect(getVisibleFields(form.fields, {
      attendance: 'yes',
      camping: 'yes',
    }).map(field => field.id)).toContain('bring_family');
    expect(getVisibleFields(form.fields, {
      attendance: 'yes',
      camping: 'no',
    }).map(field => field.id)).toContain('bring_family');
  });
});
