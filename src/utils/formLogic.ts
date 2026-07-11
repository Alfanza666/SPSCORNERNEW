import { Condition, FormField } from '../types/form';

export type FormAnswers = Record<string, unknown>;
export type FormAddonOrders = Record<string, Array<{ item_id: string; quantity: number }>>;

export interface FormPricingLine {
  field_id: string;
  label: string;
  option_value?: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface FormValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

export function hasAnswer(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return value !== undefined && value !== null;
}

function asComparableValues(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values
    .filter(hasAnswer)
    .map(item => String(item).trim().toLocaleLowerCase('id-ID'));
}

export function matchesCondition(condition: Condition, answers: FormAnswers, parentField?: FormField): boolean {
  const answer = answers[condition.fieldId];
  if (!hasAnswer(answer)) return false;

  const normalize = (value: unknown) => parentField
    ? normalizeConditionValue(parentField, String(value))
    : String(value);
  const actualValues = asComparableValues(Array.isArray(answer) ? answer.map(normalize) : normalize(answer));
  const conditionValues = Array.isArray(condition.value) ? condition.value : [condition.value];
  const expectedValues = asComparableValues(conditionValues.map(normalize));
  const hasMatch = actualValues.some(value => expectedValues.includes(value));

  if (condition.operator === 'neq') return !hasMatch;
  return hasMatch;
}

export function isFieldVisible(field: FormField, answers: FormAnswers): boolean {
  return !field.condition || matchesCondition(field.condition, answers);
}

export function getVisibleFields(fields: FormField[], answers: FormAnswers): FormField[] {
  const fieldsById = new Map(fields.map(field => [field.id, field]));
  const visibleIds = new Set<string>();

  return fields.filter(field => {
    if (!field.condition) {
      visibleIds.add(field.id);
      return true;
    }

    const parentField = fieldsById.get(field.condition.fieldId);
    if (!parentField || !visibleIds.has(parentField.id)) return false;
    const visible = matchesCondition(field.condition, answers, parentField);
    if (visible) visibleIds.add(field.id);
    return visible;
  });
}

/**
 * Returns the visible path that is still reachable. An option with outcome_id
 * is a terminal branch, so fields after that answer must not be priced,
 * validated, or persisted even when they would otherwise be visible.
 */
export function getActiveFormFields(fields: FormField[], answers: FormAnswers): FormField[] {
  const activeFields: FormField[] = [];
  for (const field of getVisibleFields(fields, answers)) {
    activeFields.push(field);
    if (!field.options?.length) continue;
    const rawValue = answers[field.id];
    const selectedValues: unknown[] = Array.isArray(rawValue) ? rawValue : [rawValue];
    if (field.options.some(option => selectedValues.includes(option.value) && option.outcome_id)) break;
  }
  return activeFields;
}

export function normalizeConditionValue(parentField: FormField, value: string): string {
  const normalizedValue = value.trim().toLocaleLowerCase('id-ID');
  const matchingOption = parentField.options?.find(option =>
    option.value.trim().toLocaleLowerCase('id-ID') === normalizedValue
    || option.label.trim().toLocaleLowerCase('id-ID') === normalizedValue
  );
  return matchingOption?.value ?? value;
}

export function calculateVisibleFormTotal(
  fields: FormField[],
  answers: FormAnswers,
  addonOrders: FormAddonOrders = {},
): number {
  return getFormPricingBreakdown(fields, answers, addonOrders)
    .reduce((total, line) => total + line.line_total, 0);
}

export function getFormPricingBreakdown(
  fields: FormField[],
  answers: FormAnswers,
  addonOrders: FormAddonOrders = {},
): FormPricingLine[] {
  return getActiveFormFields(fields, answers).flatMap(field => {
    if (field.type === 'radio' || field.type === 'select' || field.type === 'image_choice') {
      const selectedOption = field.options?.find(option => option.value === answers[field.id]);
      const price = selectedOption?.price || 0;
      return price > 0 ? [{
        field_id: field.id,
        label: `${field.label}: ${selectedOption?.label || ''}`,
        option_value: selectedOption?.value,
        quantity: 1,
        unit_price: price,
        line_total: price,
      }] : [];
    }

    if (field.type === 'checkbox') {
      const selectedValues = Array.isArray(answers[field.id]) ? answers[field.id] as unknown[] : [];
      return (field.options || []).flatMap(option => {
        const price = selectedValues.includes(option.value) ? option.price || 0 : 0;
        return price > 0 ? [{
          field_id: field.id,
          label: `${field.label}: ${option.label}`,
          option_value: option.value,
          quantity: 1,
          unit_price: price,
          line_total: price,
        }] : [];
      });
    }

    if (field.type === 'number' && field.unit_price) {
      const quantity = Number(answers[field.id]);
      if (!Number.isFinite(quantity) || quantity <= 0) return [];
      return [{
        field_id: field.id,
        label: field.label,
        quantity,
        unit_price: field.unit_price,
        line_total: quantity * field.unit_price,
      }];
    }

    if (field.type === 'repeater' && field.item_unit_price) {
      const rawRows = answers[field.id];
      const rows: unknown[] = Array.isArray(rawRows) ? rawRows : [];
      if (rows.length === 0) return [];
      return [{
        field_id: field.id,
        label: field.label,
        quantity: rows.length,
        unit_price: field.item_unit_price,
        line_total: rows.length * field.item_unit_price,
      }];
    }

    if (field.type === 'addon_group') {
      return (addonOrders[field.id] || []).flatMap(order => {
        const item = field.items?.find(candidate => candidate.id === order.item_id);
        if (!item || order.quantity <= 0 || item.price <= 0) return [];
        return [{
          field_id: field.id,
          label: `${field.label}: ${item.name}`,
          option_value: item.id,
          quantity: order.quantity,
          unit_price: item.price,
          line_total: item.price * order.quantity,
        }];
      });
    }

    return [];
  });
}

export function getTerminalOutcomeId(fields: FormField[], answers: FormAnswers): string | null {
  for (const field of getVisibleFields(fields, answers)) {
    if (!field.options?.length) continue;
    const rawValue = answers[field.id];
    const selectedValues: unknown[] = Array.isArray(rawValue) ? rawValue : [rawValue];
    const outcome = field.options.find(option => selectedValues.includes(option.value) && option.outcome_id);
    if (outcome?.outcome_id) return outcome.outcome_id;
  }
  return null;
}

export function sanitizeVisibleAnswers(fields: FormField[], answers: FormAnswers): FormAnswers {
  const visibleIds = new Set(getActiveFormFields(fields, answers).map(field => field.id));
  return Object.fromEntries(Object.entries(answers).filter(([fieldId]) => visibleIds.has(fieldId)));
}

export function validateVisibleAnswers(fields: FormField[], answers: FormAnswers): FormValidationResult {
  const errors: Record<string, string> = {};

  for (const field of getActiveFormFields(fields, answers)) {
    const value = answers[field.id];
    if (field.required && field.type !== 'payment_section' && !hasAnswer(value)) {
      errors[field.id] = 'Pertanyaan ini wajib diisi.';
      continue;
    }

    if (field.type === 'number' && hasAnswer(value)) {
      const numberValue = Number(value);
      if (!Number.isFinite(numberValue)) errors[field.id] = 'Masukkan angka yang valid.';
      else if (field.min !== undefined && numberValue < field.min) errors[field.id] = `Minimal ${field.min}.`;
      else if (field.max !== undefined && numberValue > field.max) errors[field.id] = `Maksimal ${field.max}.`;
    }

    if (field.type === 'repeater') {
      const count = Array.isArray(value) ? value.length : 0;
      if (field.min_items !== undefined && count < field.min_items) errors[field.id] = `Minimal ${field.min_items} ${field.item_label || 'data'}.`;
      if (field.max_items !== undefined && count > field.max_items) errors[field.id] = `Maksimal ${field.max_items} ${field.item_label || 'data'}.`;
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
