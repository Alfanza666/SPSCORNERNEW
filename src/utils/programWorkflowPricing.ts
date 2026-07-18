import type { FormConfig, FormField } from '../types/form';

export interface ProgramWorkflowPricingPayload {
  dynamic_form_id?: string | null;
  field_bindings?: Record<string, unknown> | null;
  pricing_rules?: Record<string, unknown> | null;
  form_snapshot?: (Partial<FormConfig> & { fields?: FormField[] }) | null;
}

const OPTION_FIELD_TYPES = new Set(['radio', 'checkbox', 'select', 'image_choice']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLocaleLowerCase('id-ID');
}

function bindingFieldId(bindings: Record<string, unknown>, key: string): string | null {
  const binding = bindings[key];
  if (typeof binding === 'string') return binding.trim() || null;
  if (!isRecord(binding)) return null;

  const fieldId = binding.field_id ?? binding.fieldId;
  return typeof fieldId === 'string' && fieldId.trim() ? fieldId.trim() : null;
}

function money(value: unknown): number | null {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : null;
}

function quantity(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function familyUnitPrice(familyRules: Record<string, unknown>): number {
  const hasEntryPrice = hasOwn(familyRules, 'entry_unit_price');
  const hasMealPrice = hasOwn(familyRules, 'meal_unit_price');

  if (hasEntryPrice || hasMealPrice) {
    const entryPrice = hasEntryPrice ? money(familyRules.entry_unit_price) : 0;
    const mealPrice = hasMealPrice ? money(familyRules.meal_unit_price) : 0;
    return (entryPrice ?? 0) + (mealPrice ?? 0);
  }

  return hasOwn(familyRules, 'package_unit_price')
    ? money(familyRules.package_unit_price) ?? 0
    : 0;
}

function findCaseInsensitivePrice(
  prices: Record<string, unknown>,
  value: string,
): number | null {
  const normalizedValue = normalize(value);
  const matchingKey = Object.keys(prices).find(key => normalize(key) === normalizedValue);
  return matchingKey === undefined ? null : money(prices[matchingKey]);
}

function applyOptionPrices(field: FormField, configuredField: Record<string, unknown>): FormField {
  if (!field.options) return field;
  const configuredOptions = Array.isArray(configuredField.options)
    ? configuredField.options.filter(isRecord)
    : [];

  return {
    ...field,
    options: field.options.map(option => {
      const optionValue = normalize(option.value);
      const optionLabel = normalize(option.label);
      const configuredOption = configuredOptions.find(candidate => {
        const candidateValue = normalize(candidate.value);
        const candidateLabel = normalize(candidate.label);
        return candidateValue === optionValue
          || candidateLabel === optionValue
          || candidateValue === optionLabel
          || candidateLabel === optionLabel;
      });
      const price = configuredOption ? money(configuredOption.price) : null;
      return { ...option, price: price ?? 0 };
    }),
  };
}

function applyAdditionalPricing(field: FormField, configuredField: Record<string, unknown>): FormField {
  const configuredType = String(configuredField.field_type ?? '');

  if (OPTION_FIELD_TYPES.has(field.type) && configuredType === field.type) {
    return applyOptionPrices(field, configuredField);
  }

  if (field.type === 'number' && configuredType === 'number') {
    const unitPrice = money(configuredField.unit_price);
    const minimum = quantity(configuredField.min_quantity);
    const maximum = quantity(configuredField.max_quantity);
    return {
      ...field,
      unit_price: unitPrice ?? 0,
      ...(minimum === null ? {} : { min: minimum }),
      ...(maximum === null ? {} : { max: maximum }),
    };
  }

  if (field.type === 'repeater' && configuredType === 'repeater') {
    const unitPrice = money(configuredField.unit_price);
    const minimum = quantity(configuredField.min_quantity);
    const maximum = quantity(configuredField.max_quantity);
    return {
      ...field,
      item_unit_price: unitPrice ?? 0,
      ...(minimum === null ? {} : { min_items: minimum }),
      ...(maximum === null ? {} : { max_items: maximum }),
    };
  }

  if (field.type === 'addon_group' && configuredType === 'addon_group' && field.items) {
    const configuredItems = Array.isArray(configuredField.items)
      ? configuredField.items.filter(isRecord)
      : [];
    return {
      ...field,
      items: field.items.map(item => {
        const configuredItem = configuredItems.find(candidate => String(candidate.id ?? '') === item.id);
        if (!configuredItem) return { ...item, price: 0 };
        const price = money(configuredItem.price);
        const maxQuantity = quantity(configuredItem.max_quantity);
        return {
          ...item,
          price: price ?? 0,
          ...(maxQuantity === null ? {} : { max_quantity: maxQuantity }),
        };
      }),
    };
  }

  return field;
}

function clearAdditionalPricing(field: FormField): FormField {
  if (OPTION_FIELD_TYPES.has(field.type) && field.options) {
    return { ...field, options: field.options.map(option => ({ ...option, price: 0 })) };
  }
  if (field.type === 'number') return { ...field, unit_price: 0 };
  if (field.type === 'repeater') return { ...field, item_unit_price: 0 };
  if (field.type === 'addon_group' && field.items) {
    return { ...field, items: field.items.map(item => ({ ...item, price: 0 })) };
  }
  return field;
}

export function applyProgramWorkflowPricing(
  fields: readonly FormField[],
  payload: ProgramWorkflowPricingPayload,
): FormField[] {
  const bindings = isRecord(payload?.field_bindings) ? payload.field_bindings : {};
  const pricingRules = isRecord(payload?.pricing_rules) ? payload.pricing_rules : {};
  const shirtFieldId = bindingFieldId(bindings, 'shirt_size');
  const familyFieldId = bindingFieldId(bindings, 'family_count');
  const shirtSurcharges = isRecord(pricingRules.shirt_surcharge) ? pricingRules.shirt_surcharge : {};
  const familyRules = isRecord(pricingRules.family) ? pricingRules.family : {};
  const configuredFamilyUnitPrice = familyUnitPrice(familyRules);
  const additionalFields = Array.isArray(pricingRules.additional_fields)
    ? pricingRules.additional_fields.filter(isRecord)
    : [];

  return fields.map(originalField => {
    let field = originalField;

    if (originalField.id === shirtFieldId && originalField.options) {
      field = {
        ...field,
        options: originalField.options.map(option => {
          const price = findCaseInsensitivePrice(shirtSurcharges, option.value);
          return { ...option, price: price ?? 0 };
        }),
      };
      return field;
    }

    if (originalField.id === familyFieldId) {
      if (originalField.type === 'number') {
        field = { ...field, unit_price: configuredFamilyUnitPrice };
      } else if (originalField.type === 'repeater') {
        field = { ...field, item_unit_price: configuredFamilyUnitPrice };
      }
      return field;
    }

    const configuredField = additionalFields.find(candidate => candidate.field_id === originalField.id);
    return configuredField
      ? applyAdditionalPricing(clearAdditionalPricing(field), configuredField)
      : clearAdditionalPricing(field);
  });
}
