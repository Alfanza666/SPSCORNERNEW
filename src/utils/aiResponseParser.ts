import { FormConfig, FormField } from '../types/form';

interface ParsedAIResult {
  chatContent: string;
  updatedForm: FormConfig | null;
}

function sanitizeFields(updatedForm: any): FormField[] {
  return (updatedForm.fields || []).map((f: any) => ({
    id: f.id || Math.random().toString(36).substr(2, 9),
    type: f.type || 'text',
    label: f.label || 'Pertanyaan',
    required: f.required || false,
    placeholder: f.placeholder || '',
    description: f.description || '',
    options: ['select', 'radio', 'checkbox', 'image_choice'].includes(f.type) && f.options
      ? f.options.filter((o: any) => o.label?.trim())
      : undefined,
    max: f.type === 'rating' ? (f.max || 5) : undefined,
    max_scale: f.type === 'scale' ? (f.max_scale || 10) : undefined,
    condition: f.condition || undefined,
    items: f.type === 'addon_group' ? f.items : undefined,
    allow_multiple: f.type === 'addon_group' ? (f.allow_multiple ?? true) : undefined,
    qris_image_url: f.type === 'payment_section' ? (f.qris_image_url || '') : undefined,
    account_name: f.type === 'payment_section' ? (f.account_name || '') : undefined,
    payment_description: f.type === 'payment_section' ? (f.payment_description || '') : undefined,
    verify_with_ai: f.type === 'payment_section' ? (f.verify_with_ai ?? true) : undefined,
  }));
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

export function parseAIResponse(response: { message: string; updatedForm?: any }): ParsedAIResult {
  let chatContent = response.message || '';
  let formUpdates: any = response.updatedForm || null;

  if (!formUpdates && response.message) {
    const { cleaned, json } = extractJSON(response.message);
    chatContent = cleaned;
    if (json && (json.fields || json.updatedForm)) {
      formUpdates = json.updatedForm || json;
    }
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
  if (formUpdates) {
    updatedForm = {
      title: formUpdates.title || 'Formulir Tanpa Judul',
      description: formUpdates.description || '',
      theme_color: formUpdates.theme_color || '#673AB7',
      banner_url: formUpdates.banner_url || '',
      layout_type: formUpdates.layout_type || 'classic',
      font_family: formUpdates.font_family || 'Inter',
      input_style: formUpdates.input_style || 'rounded',
      bg_image_url: formUpdates.bg_image_url || '',
      card_glassmorphism: formUpdates.card_glassmorphism || false,
      fields: sanitizeFields(formUpdates),
    };
  }

  return { chatContent, updatedForm };
}
