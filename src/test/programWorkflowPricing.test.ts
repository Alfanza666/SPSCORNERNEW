import { describe, expect, it } from 'vitest';
import type { FormField } from '../types/form';
import { applyProgramWorkflowPricing } from '../utils/programWorkflowPricing';

function freezeFields(fields: FormField[]): readonly FormField[] {
  fields.forEach(field => {
    field.options?.forEach(Object.freeze);
    field.items?.forEach(item => {
      Object.freeze(item.sizes);
      Object.freeze(item);
    });
    if (field.options) Object.freeze(field.options);
    if (field.items) Object.freeze(field.items);
    Object.freeze(field);
  });
  return Object.freeze(fields);
}

describe('applyProgramWorkflowPricing', () => {
  it('applies shirt surcharges case-insensitively through an object binding', () => {
    const fields = freezeFields([{
      id: 'shirt-field',
      type: 'radio',
      label: 'Ukuran baju',
      required: true,
      options: [
        { value: 'S', label: 'S', price: 9_999 },
        { value: 'M', label: 'M', price: 8_888 },
        { value: 'XXL', label: 'XXL', helper_text: 'Ukuran besar' },
      ],
    }]);

    const result = applyProgramWorkflowPricing(fields, {
      field_bindings: { shirt_size: { field_id: 'shirt-field' } },
      pricing_rules: { shirt_surcharge: { s: 0, xxl: 25_000 } },
    });

    expect(result[0].options).toEqual([
      { value: 'S', label: 'S', price: 0 },
      { value: 'M', label: 'M', price: 0 },
      { value: 'XXL', label: 'XXL', helper_text: 'Ukuran besar', price: 25_000 },
    ]);
    expect(fields[0].options?.[0].price).toBe(9_999);
  });

  it('combines family entry and meal prices for number and repeater fields', () => {
    const numberField: FormField = {
      id: 'family-count', type: 'number', label: 'Jumlah keluarga', required: false, unit_price: 1,
    };
    const repeaterField: FormField = {
      id: 'family-members', type: 'repeater', label: 'Anggota keluarga', required: false, item_unit_price: 1,
    };

    expect(applyProgramWorkflowPricing([numberField], {
      field_bindings: { family_count: 'family-count' },
      pricing_rules: { family: { entry_unit_price: 30_000, meal_unit_price: 15_000, package_unit_price: 99_000 } },
    })[0].unit_price).toBe(45_000);

    expect(applyProgramWorkflowPricing([repeaterField], {
      field_bindings: { family_count: { fieldId: 'family-members' } },
      pricing_rules: { family: { package_unit_price: 40_000 } },
    })[0].item_unit_price).toBe(40_000);
    expect(numberField.unit_price).toBe(1);
    expect(repeaterField.item_unit_price).toBe(1);
  });

  it('applies all supported additional field pricing formats without mutating fields', () => {
    const fields = freezeFields([
      {
        id: 'transport', type: 'select', label: 'Transportasi', required: false,
        options: [{ value: 'BUS', label: 'Bus', price: 1 }, { value: 'own', label: 'Mandiri', price: 1 }],
      },
      { id: 'guests', type: 'number', label: 'Tamu', required: false, min: 0, max: 20, unit_price: 1 },
      { id: 'rows', type: 'repeater', label: 'Peserta', required: false, min_items: 0, max_items: 20, item_unit_price: 1 },
      {
        id: 'extras', type: 'addon_group', label: 'Tambahan', required: false,
        items: [
          { id: 'tent', name: 'Tenda', sizes: ['L'], price: 1, max_quantity: 10 },
          { id: 'mat', name: 'Matras', sizes: [], price: 2, max_quantity: 10 },
        ],
      },
    ]);

    const result = applyProgramWorkflowPricing(fields, {
      field_bindings: {},
      pricing_rules: {
        additional_fields: [
          {
            field_id: 'transport', field_type: 'select',
            options: [{ value: 'bus', label: 'Bus besar', price: 50_000 }],
          },
          { field_id: 'guests', field_type: 'number', unit_price: 12_500, min_quantity: 1, max_quantity: 4 },
          { field_id: 'rows', field_type: 'repeater', unit_price: 20_000, min_quantity: 1, max_quantity: 3 },
          {
            field_id: 'extras', field_type: 'addon_group',
            items: [{ id: 'tent', price: 75_000, max_quantity: 2 }],
          },
        ],
      },
    });

    expect(result[0].options).toEqual([
      { value: 'BUS', label: 'Bus', price: 50_000 },
      { value: 'own', label: 'Mandiri', price: 0 },
    ]);
    expect(result[1]).toMatchObject({ unit_price: 12_500, min: 1, max: 4 });
    expect(result[2]).toMatchObject({ item_unit_price: 20_000, min_items: 1, max_items: 3 });
    expect(result[3].items).toEqual([
      { id: 'tent', name: 'Tenda', sizes: ['L'], price: 75_000, max_quantity: 2 },
      { id: 'mat', name: 'Matras', sizes: [], price: 0, max_quantity: 10 },
    ]);
    expect(fields[1]).toMatchObject({ unit_price: 1, min: 0, max: 20 });
    expect(fields[3].items?.[0]).toMatchObject({ price: 1, max_quantity: 10 });
  });
});
