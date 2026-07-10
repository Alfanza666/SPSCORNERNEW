import { Condition, FormField } from '../types/form';

export type FormAnswers = Record<string, unknown>;
export type FormAddonOrders = Record<string, Array<{ item_id: string; quantity: number }>>;

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
  return getVisibleFields(fields, answers).reduce((total, field) => {
    if (field.type === 'radio' || field.type === 'select' || field.type === 'image_choice') {
      const selectedOption = field.options?.find(option => option.value === answers[field.id]);
      return total + (selectedOption?.price || 0);
    }

    if (field.type === 'checkbox') {
      const selectedValues = Array.isArray(answers[field.id]) ? answers[field.id] as unknown[] : [];
      return total + (field.options || []).reduce(
        (subtotal, option) => subtotal + (selectedValues.includes(option.value) ? option.price || 0 : 0),
        0,
      );
    }

    if (field.type === 'addon_group') {
      return total + (addonOrders[field.id] || []).reduce((subtotal, order) => {
        const item = field.items?.find(candidate => candidate.id === order.item_id);
        return subtotal + (item && order.quantity > 0 ? item.price * order.quantity : 0);
      }, 0);
    }

    return total;
  }, 0);
}
