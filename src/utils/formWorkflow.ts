import { FormConfig, FormOutcome, FormOutcomeKind } from '../types/form';
import {
  FormAddonOrders,
  FormAnswers,
  FormPricingLine,
  getFormPricingBreakdown,
  getTerminalOutcomeId,
  sanitizeVisibleAnswers,
  validateVisibleAnswers,
} from './formLogic';

export interface FormWorkflowEvaluation {
  valid: boolean;
  errors: Record<string, string>;
  answers: FormAnswers;
  pricing_lines: FormPricingLine[];
  total_amount: number;
  outcome: FormOutcome;
  requires_payment: boolean;
  family_count: number;
}

function createDefaultOutcome(kind: FormOutcomeKind): FormOutcome {
  const defaults: Record<FormOutcomeKind, FormOutcome> = {
    declined: {
      id: 'declined',
      kind: 'declined',
      title: 'Konfirmasi tersimpan',
      message: 'Terima kasih sudah memberikan konfirmasi. Tidak ada tiket yang diterbitkan.',
      issue_entitlements: false,
    },
    confirmed: {
      id: 'confirmed',
      kind: 'confirmed',
      title: 'Kehadiran dikonfirmasi',
      message: 'Konfirmasi Anda berhasil disimpan.',
      issue_entitlements: true,
    },
    pending_payment: {
      id: 'pending_payment',
      kind: 'pending_payment',
      title: 'Menunggu verifikasi pembayaran',
      message: 'Bukti pembayaran akan diperiksa admin sebelum tiket dan kupon diterbitkan.',
      issue_entitlements: false,
    },
    submitted: {
      id: 'submitted',
      kind: 'submitted',
      title: 'Formulir berhasil dikirim',
      message: 'Jawaban Anda berhasil disimpan.',
      issue_entitlements: false,
    },
  };
  return defaults[kind];
}

export function evaluateFormWorkflow(
  form: FormConfig,
  rawAnswers: FormAnswers,
  addonOrders: FormAddonOrders = {},
): FormWorkflowEvaluation {
  const validation = validateVisibleAnswers(form.fields, rawAnswers);
  const answers = sanitizeVisibleAnswers(form.fields, rawAnswers);
  const pricingLines = getFormPricingBreakdown(form.fields, answers, addonOrders);
  const totalAmount = pricingLines.reduce((total, line) => total + line.line_total, 0);
  const selectedOutcomeId = getTerminalOutcomeId(form.fields, answers) || form.default_outcome_id;
  const configuredOutcome = form.outcomes?.find(outcome => outcome.id === selectedOutcomeId);

  let outcome = configuredOutcome;
  if (!outcome) {
    const isProgramForm = Boolean(form.program_automation?.attendance_field_id);
    outcome = createDefaultOutcome(totalAmount > 0 ? 'pending_payment' : isProgramForm ? 'confirmed' : 'submitted');
  }

  const requiresPayment = outcome.kind !== 'declined' && totalAmount > 0;
  if (requiresPayment && outcome.kind !== 'pending_payment') {
    outcome = form.outcomes?.find(candidate => candidate.kind === 'pending_payment') || createDefaultOutcome('pending_payment');
  }

  const familyFieldId = form.program_automation?.family_repeater_field_id
    || form.program_automation?.family_count_field_id;
  const familyValue = familyFieldId ? answers[familyFieldId] : undefined;
  const familyCount = Array.isArray(familyValue)
    ? familyValue.length
    : Math.max(0, Number(familyValue) || 0);

  return {
    valid: validation.valid,
    errors: validation.errors,
    answers,
    pricing_lines: pricingLines,
    total_amount: totalAmount,
    outcome,
    requires_payment: requiresPayment,
    family_count: familyCount,
  };
}

