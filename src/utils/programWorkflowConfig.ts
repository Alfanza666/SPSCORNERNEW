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

function additionalPricingFields(form: FormConfig, excludedFieldIds: Set<string>): Array<Record<string, unknown>> {
  return form.fields.flatMap<Record<string, unknown>>(field => {
    if (excludedFieldIds.has(field.id) || field.type === 'payment_section') return [];

    if (['radio', 'checkbox', 'select', 'image_choice'].includes(field.type)) {
      const options = (field.options || [])
        .filter(option => Number(option.price || 0) > 0)
        .map(option => ({
          value: option.value,
          label: option.label,
          price: Math.max(0, Number(option.price || 0)),
        }));
      return options.length > 0 ? [{ field_id: field.id, field_type: field.type, label: field.label, options }] : [];
    }

    if (field.type === 'number' && Number(field.unit_price || 0) > 0) {
      return [{
        field_id: field.id,
        field_type: field.type,
        label: field.label,
        unit_price: Math.max(0, Number(field.unit_price || 0)),
        min_quantity: field.min,
        max_quantity: field.max,
      }];
    }

    if (field.type === 'repeater' && Number(field.item_unit_price || 0) > 0) {
      return [{
        field_id: field.id,
        field_type: field.type,
        label: field.label,
        unit_price: Math.max(0, Number(field.item_unit_price || 0)),
        min_quantity: field.min_items,
        max_quantity: field.max_items,
      }];
    }

    if (field.type === 'addon_group') {
      const items = (field.items || [])
        .filter(item => item.name.trim() && Number(item.price || 0) > 0)
        .map(item => ({
          id: item.id,
          name: item.name,
          price: Math.max(0, Number(item.price || 0)),
          max_quantity: Math.min(50, Math.max(1, Number(item.max_quantity || 10))),
        }));
      return items.length > 0 ? [{ field_id: field.id, field_type: field.type, label: field.label, items }] : [];
    }

    return [];
  });
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
  const bankAccounts = (payment?.bank_accounts || []).filter(account =>
    account.bank_name.trim() && account.account_number.trim() && account.account_name.trim(),
  );

  const employeeEntitlements: string[] = [];
  if (automation.issue_employee_attendance !== false) employeeEntitlements.push('attendance');
  if (automation.issue_employee_meal !== false) employeeEntitlements.push('meal');
  const familyEntitlements: string[] = [];
  if (automation.issue_family_attendance !== false) familyEntitlements.push('attendance');
  if (automation.issue_family_meal !== false) familyEntitlements.push('meal');
  const excludedPricingFieldIds = new Set([
    shirtSize?.id,
    family?.id,
  ].filter((fieldId): fieldId is string => Boolean(fieldId)));

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
        package_unit_price: Math.max(0, Number(family?.type === 'repeater' ? family.item_unit_price || 0 : family?.unit_price || 0)),
        entry_unit_price: Math.max(0, Number(family?.type === 'repeater' ? family.item_unit_price || 0 : family?.unit_price || 0)),
        meal_unit_price: 0,
        max_members: family?.type === 'repeater' ? family.max_items || 5 : family?.max || 5,
      },
      additional_fields: additionalPricingFields(form, excludedPricingFieldIds),
    },
    entitlement_rules: {
      employee: employeeEntitlements,
      family: familyEntitlements,
    },
    payment_rules: {
      provider: 'manual',
      methods: payment?.payment_methods?.length ? payment.payment_methods : ['bank_transfer'],
      method: payment?.payment_methods?.includes('manual_qris') && payment.payment_methods.includes('bank_transfer')
        ? 'manual_transfer_or_qris'
        : payment?.payment_methods?.includes('manual_qris') ? 'manual_qris' : 'manual_transfer',
      qris_image_url: payment?.qris_image_url || null,
      account_name: bank?.account_name || payment?.account_name || null,
      account_number: bank?.account_number || null,
      bank_name: bank?.bank_name || null,
      bank_accounts: bankAccounts,
      instructions: payment?.payment_description || null,
      proof_required: payment?.proof_required !== false,
      verify_with_ai: payment?.verify_with_ai !== false,
      hold_entitlements_until_paid: false,
      hold_employee_entitlements_until_paid: false,
      hold_family_entitlements_until_paid: automation.hold_family_entitlements_until_paid !== false,
    },
    metadata: {
      experience_version: form.experience_version || 1,
      family_source_type: family?.type || null,
      generated_from_builder: true,
      form_snapshot: JSON.parse(JSON.stringify({
        ...form,
        id: dynamicFormId,
        dynamic_form_id: dynamicFormId,
      })),
    },
    created_by: actorId,
    updated_by: actorId,
  };
}
