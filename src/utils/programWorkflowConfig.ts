import type { FormConfig, FormField } from '../types/form';

export interface ProgramWorkflowConfigPayload {
  program_id: string;
  dynamic_form_id: string;
  is_active: boolean;
  field_bindings: Record<string, unknown>;
  pricing_rules: Record<string, unknown>;
  entitlement_rules: Record<string, string[]>;
  payment_rules: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_by?: string;
  updated_by?: string;
}

function findField(form: FormConfig, systemKey: string, explicitId?: string): FormField | undefined {
  return form.fields.find(field => field.id === explicitId)
    || form.fields.find(field => field.system_key === systemKey)
    || form.fields.find(field => field.id === systemKey);
}

function decisionValues(field: FormField | undefined, positive: boolean): string[] {
  if (!field?.options?.length) return positive ? ['yes', 'ya', 'hadir'] : ['no', 'tidak', 'declined'];
  const matcher = positive
    ? /^(yes|ya|iya|hadir|attending|true|1)$/i
    : /^(no|tidak|absent|declined|false|0)$/i;
  const matches = field.options
    .filter(option => matcher.test(option.value.trim()) || matcher.test(option.label.trim()))
    .map(option => option.value);
  return matches.length > 0 ? matches : [field.options[positive ? 0 : Math.min(1, field.options.length - 1)].value];
}

export function createProgramWorkflowConfig(
  form: FormConfig,
  programId: string,
  dynamicFormId: string,
  actorId?: string,
): ProgramWorkflowConfigPayload | null {
  const automation = form.program_automation || {};
  const attendance = findField(form, 'attendance', automation.attendance_field_id);
  if (!attendance) return null;
  const shirtSize = findField(form, 'shirt_size');
  const camping = findField(form, 'camping');
  const bringingFamily = findField(form, 'bringing_family') || form.fields.find(field => field.id === 'bring_family');
  const family = findField(form, 'family_members', automation.family_repeater_field_id)
    || findField(form, 'family_count', automation.family_count_field_id);
  const payment = findField(form, 'payment');
  const bank = payment?.bank_accounts?.[0];

  const employeeEntitlements: string[] = [];
  if (automation.issue_employee_attendance !== false) employeeEntitlements.push('attendance');
  if (automation.issue_employee_meal !== false) employeeEntitlements.push('meal');
  const familyEntitlements: string[] = [];
  if (automation.issue_family_attendance !== false) familyEntitlements.push('attendance');
  if (automation.issue_family_meal !== false) familyEntitlements.push('meal');

  return {
    program_id: programId,
    dynamic_form_id: dynamicFormId,
    is_active: true,
    field_bindings: {
      attendance: {
        field_id: attendance.id,
        attending_values: automation.attending_value ? [automation.attending_value] : decisionValues(attendance, true),
        declined_values: automation.declined_value ? [automation.declined_value] : decisionValues(attendance, false),
      },
      ...(shirtSize ? { shirt_size: { field_id: shirtSize.id } } : {}),
      ...(camping ? { camping: { field_id: camping.id, yes_values: decisionValues(camping, true), no_values: decisionValues(camping, false) } } : {}),
      ...(bringingFamily ? { bringing_family: { field_id: bringingFamily.id, yes_values: decisionValues(bringingFamily, true), no_values: decisionValues(bringingFamily, false) } } : {}),
      ...(family ? { family_count: { field_id: family.id, source_type: family.type } } : {}),
    },
    pricing_rules: {
      currency: 'IDR',
      shirt_surcharge: Object.fromEntries((shirtSize?.options || []).map(option => [option.value, Math.max(0, Number(option.price || 0))])),
      family: {
        entry_unit_price: Math.max(0, Number(family?.type === 'repeater' ? family.item_unit_price || 0 : family?.unit_price || 0)),
        meal_unit_price: 0,
        max_members: family?.type === 'repeater' ? family.max_items || 5 : family?.max || 5,
      },
    },
    entitlement_rules: {
      employee: employeeEntitlements,
      family: familyEntitlements,
    },
    payment_rules: {
      provider: 'manual',
      method: payment?.payment_methods?.includes('manual_qris') && payment.payment_methods.includes('bank_transfer')
        ? 'manual_transfer_or_qris'
        : payment?.payment_methods?.includes('manual_qris') ? 'manual_qris' : 'manual_transfer',
      qris_image_url: payment?.qris_image_url || null,
      account_name: bank?.account_name || payment?.account_name || null,
      account_number: bank?.account_number || null,
      bank_name: bank?.bank_name || null,
      instructions: payment?.payment_description || null,
      proof_required: payment?.proof_required !== false,
      hold_entitlements_until_paid: automation.hold_entitlements_until_paid !== false,
    },
    metadata: {
      experience_version: form.experience_version || 1,
      family_source_type: family?.type || null,
      generated_from_builder: true,
    },
    created_by: actorId,
    updated_by: actorId,
  };
}
