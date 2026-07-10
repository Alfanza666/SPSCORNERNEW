import { FieldType, FormConfig, FormField } from '../types/form';
import { normalizeConditionValue } from './formLogic';

interface ParsedAIResult {
  chatContent: string;
  updatedForm: FormConfig | null;
}

const SUPPORTED_FIELD_TYPES: FieldType[] = [
  'text', 'textarea', 'number', 'select', 'radio', 'checkbox', 'image_choice',
  'rating', 'scale', 'file_upload', 'image', 'addon_group', 'date', 'payment_section',
];

function createSafeId(rawId: unknown, index: number, usedIds: Set<string>): string {
  const base = String(rawId || `field_${index + 1}`)
    .toLocaleLowerCase('id-ID')
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '') || `field_${index + 1}`;
  let candidate = base;
  let suffix = 2;
  while (usedIds.has(candidate)) candidate = `${base}_${suffix++}`;
  usedIds.add(candidate);
  return candidate;
}

function sanitizeFields(updatedForm: any): FormField[] {
  const sourceFields = Array.isArray(updatedForm.fields) ? updatedForm.fields.slice(0, 100) : [];
  const usedIds = new Set<string>();
  const rawIdToSafeId = new Map<string, string>();
  const fields: FormField[] = sourceFields.map((rawField: any, index: number) => {
    const field = rawField && typeof rawField === 'object' ? rawField : {};
    const type = SUPPORTED_FIELD_TYPES.includes(field.type) ? field.type : 'text';
    const options = ['select', 'radio', 'checkbox', 'image_choice'].includes(type)
      ? (Array.isArray(field.options) ? field.options : []).filter((option: any) => String(option?.label || '').trim()).map((option: any, optionIndex: number) => ({
          value: String(option.value || `option_${optionIndex + 1}`),
          label: String(option.label).trim(),
          image: option.image ? String(option.image) : undefined,
          price: Number.isFinite(Number(option.price)) ? Number(option.price) : undefined,
        }))
      : undefined;

    const safeId = createSafeId(field.id, index, usedIds);
    rawIdToSafeId.set(String(field.id || `field_${index + 1}`), safeId);
    rawIdToSafeId.set(safeId, safeId);

    return {
      id: safeId,
      type,
      label: String(field.label || `Pertanyaan ${index + 1}`).trim(),
      required: type === 'payment_section' ? false : field.required === true,
      placeholder: String(field.placeholder || ''),
      description: String(field.description || ''),
      options,
      max: type === 'rating' ? Math.min(10, Math.max(3, Number(field.max) || 5)) : undefined,
      max_scale: type === 'scale' ? Math.min(10, Math.max(2, Number(field.max_scale) || 10)) : undefined,
      items: type === 'addon_group' && Array.isArray(field.items) ? field.items : undefined,
      allow_multiple: type === 'addon_group' ? (field.allow_multiple ?? true) : undefined,
      qris_image_url: type === 'payment_section' ? String(field.qris_image_url || '') : undefined,
      account_name: type === 'payment_section' ? String(field.account_name || '') : undefined,
      payment_description: type === 'payment_section' ? String(field.payment_description || '') : undefined,
      verify_with_ai: type === 'payment_section' ? (field.verify_with_ai ?? true) : undefined,
    };
  });

  return fields.map((field, index) => {
    const condition = sourceFields[index]?.condition;
    const safeParentId = rawIdToSafeId.get(String(condition?.fieldId || '')) || String(condition?.fieldId || '');
    const parentField = fields.slice(0, index).find(candidate => candidate.id === safeParentId);
    if (!parentField || !['eq', 'neq', 'in'].includes(condition?.operator)) return field;

    const rawValues = Array.isArray(condition.value) ? condition.value : [condition.value];
    const normalizedValues = rawValues
      .filter((value: unknown) => value !== undefined && value !== null && value !== '')
      .map((value: unknown) => normalizeConditionValue(parentField, String(value)));
    if (normalizedValues.length === 0) return field;

    return {
      ...field,
      condition: {
        fieldId: parentField.id,
        operator: condition.operator,
        value: condition.operator === 'in' ? normalizedValues : normalizedValues[0],
      },
    };
  });
}

function extractJSON(text: string): { cleaned: string; json: any } {
  let jsonStr: string | null = null;

  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim();
  }

  if (!jsonStr) {
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      jsonStr = braceMatch[0];
    }
  }

  let cleaned = text;
  let json = null;

  if (jsonStr) {
    try {
      json = JSON.parse(jsonStr);
      cleaned = text
        .replace(/```(?:json)?\s*[\s\S]*?```/g, '')
        .replace(/\{[\s\S]*\}/, '')
        .replace(/---GENERATE---[\s\S]*?(?:---END---|$)/g, '')
        .trim();
    } catch {
      json = null;
    }
  }

  return { cleaned, json };
}

export function parseAIResponse(response: { message: string; updatedForm?: any }, currentForm?: FormConfig): ParsedAIResult {
  let chatContent = response.message || '';
  let formUpdates: any = response.updatedForm || null;

  // Fallback 1: extract JSON nested inside message text
  if (!formUpdates && response.message) {
    const { cleaned, json } = extractJSON(response.message);
    chatContent = cleaned;
    if (json && (json.fields || json.updatedForm || json.title)) {
      formUpdates = json.updatedForm || json;
    }
  }

  // Fallback 2: entire message might BE a JSON string
  if (!formUpdates && response.message && response.message.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(response.message);
      if (parsed && (parsed.fields || parsed.updatedForm || parsed.title)) {
        formUpdates = parsed.updatedForm || parsed;
        chatContent = 'Formulir berhasil diproses.';
      }
    } catch {}
  }

  chatContent = chatContent
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .replace(/---GENERATE---/g, '')
    .replace(/---END---/g, '')
    .trim();

  if (!chatContent) {
    chatContent = formUpdates
      ? 'Formulir berhasil diperbarui oleh AI.'
      : 'Maaf, terjadi kesalahan saat memproses permintaan.';
  }

  let updatedForm: FormConfig | null = null;
  if (formUpdates && (formUpdates.fields || formUpdates.title)) {
    updatedForm = {
      // Form identity is controlled by the database, never by model output.
      id: currentForm?.id,
      title: formUpdates.title || currentForm?.title || 'Formulir Tanpa Judul',
      description: formUpdates.description ?? currentForm?.description ?? '',
      theme_color: formUpdates.theme_color || currentForm?.theme_color || '#6366F1',
      banner_url: formUpdates.banner_url ?? currentForm?.banner_url ?? '',
      layout_type: formUpdates.layout_type || currentForm?.layout_type || 'card',
      font_family: formUpdates.font_family || currentForm?.font_family || 'Inter',
      input_style: formUpdates.input_style || currentForm?.input_style || 'rounded',
      bg_image_url: formUpdates.bg_image_url ?? currentForm?.bg_image_url ?? '',
      card_glassmorphism: formUpdates.card_glassmorphism ?? currentForm?.card_glassmorphism ?? false,
      fields: Array.isArray(formUpdates.fields) ? sanitizeFields(formUpdates) : (currentForm?.fields || []),
    };
  }

  return { chatContent, updatedForm };
}
