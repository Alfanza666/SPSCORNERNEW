// @ts-nocheck
import crypto from "node:crypto";

const MAX_ANSWER_FIELDS = 150;
const MAX_ANSWER_BYTES = 150_000;
const MAX_FAMILY_MEMBERS_HARD_LIMIT = 20;
const MAX_ADDON_QUANTITY_HARD_LIMIT = 50;
const MAX_TOTAL_AMOUNT = 100_000_000;
const DEFAULT_CURRENCY = "IDR";

class WorkflowHttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "WorkflowHttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function isPlainObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeWorkflowValue(value: unknown): string {
  return String(value ?? "").trim().toLocaleLowerCase("id-ID");
}

function hasAnswer(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== undefined && value !== null;
}

function optionValue(field: any, value: unknown): string {
  const normalized = normalizeWorkflowValue(value);
  const option = (field?.options || []).find((candidate: any) =>
    normalizeWorkflowValue(candidate?.value) === normalized
    || normalizeWorkflowValue(candidate?.label) === normalized
  );
  return String(option?.value ?? value ?? "");
}

function conditionMatches(condition: any, answers: Record<string, any>, parentField?: any): boolean {
  if (!condition?.fieldId || !hasAnswer(answers[condition.fieldId])) return false;

  const actual = Array.isArray(answers[condition.fieldId])
    ? answers[condition.fieldId]
    : [answers[condition.fieldId]];
  const expected = Array.isArray(condition.value) ? condition.value : [condition.value];
  const actualValues = actual.map(value => normalizeWorkflowValue(optionValue(parentField, value)));
  const expectedValues = expected.map(value => normalizeWorkflowValue(optionValue(parentField, value)));
  const matched = actualValues.some(value => expectedValues.includes(value));
  return condition.operator === "neq" ? !matched : matched;
}

export function getVisibleWorkflowFields(fields: any[], answers: Record<string, any>): any[] {
  const fieldsById = new Map((fields || []).map(field => [field.id, field]));
  const visibleIds = new Set<string>();

  return (fields || []).filter(field => {
    if (!field?.condition) {
      visibleIds.add(field.id);
      return true;
    }

    const parentField = fieldsById.get(field.condition.fieldId);
    if (!parentField || !visibleIds.has(parentField.id)) return false;
    const visible = conditionMatches(field.condition, answers, parentField);
    if (visible) visibleIds.add(field.id);
    return visible;
  });
}

/**
 * Terminal outcomes (for example "Tidak Hadir") close the respondent path.
 * Answers after that option are intentionally excluded from validation,
 * pricing, and persistence even if they were submitted by a modified client.
 */
export function getActiveWorkflowFields(fields: any[], answers: Record<string, any>): any[] {
  const activeFields: any[] = [];

  for (const field of getVisibleWorkflowFields(fields, answers)) {
    activeFields.push(field);
    if (!Array.isArray(field?.options) || field.options.length === 0) continue;

    const rawAnswer = answers[field.id];
    const selectedValues = (Array.isArray(rawAnswer) ? rawAnswer : [rawAnswer])
      .map(normalizeWorkflowValue)
      .filter(Boolean);
    const reachesTerminalOutcome = field.options.some((option: any) =>
      option?.outcome_id
      && (
        selectedValues.includes(normalizeWorkflowValue(option.value))
        || selectedValues.includes(normalizeWorkflowValue(option.label))
      )
    );
    if (reachesTerminalOutcome) break;
  }

  return activeFields;
}

function bindingDefinition(workflow: any, key: string): any {
  const binding = workflow?.field_bindings?.[key];
  return typeof binding === "string" ? { field_id: binding } : (isPlainObject(binding) ? binding : null);
}

function bindingFieldId(workflow: any, key: string): string | null {
  const binding = bindingDefinition(workflow, key);
  const fieldId = binding?.field_id || binding?.fieldId;
  return typeof fieldId === "string" && fieldId.trim() ? fieldId.trim() : null;
}

function boundAnswer(workflow: any, answers: Record<string, any>, key: string): unknown {
  const fieldId = bindingFieldId(workflow, key);
  return fieldId ? answers[fieldId] : undefined;
}

function configuredDecisionValues(workflow: any, key: string, positive: boolean): string[] {
  const binding = bindingDefinition(workflow, key) || {};
  const valueMaps = workflow?.metadata?.value_maps?.[key] || {};
  const candidates = positive
    ? binding.attending_values || binding.true_values || binding.yes_values
      || valueMaps.attending || valueMaps.true || valueMaps.yes
    : binding.declined_values || binding.false_values || binding.no_values
      || valueMaps.declined || valueMaps.false || valueMaps.no;
  return Array.isArray(candidates) ? candidates.map(normalizeWorkflowValue).filter(Boolean) : [];
}

function parseDecision(workflow: any, key: string, value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  const normalized = normalizeWorkflowValue(value);
  if (!normalized) return null;

  const configuredTrue = configuredDecisionValues(workflow, key, true);
  const configuredFalse = configuredDecisionValues(workflow, key, false);
  if (configuredTrue.includes(normalized)) return true;
  if (configuredFalse.includes(normalized)) return false;

  const defaultsTrue = ["ya", "iya", "yes", "true", "1", "hadir", "attending", "camping"];
  const defaultsFalse = ["tidak", "no", "false", "0", "tidak hadir", "absent", "declined"];
  if (defaultsTrue.includes(normalized)) return true;
  if (defaultsFalse.includes(normalized)) return false;
  return null;
}

function safeMoney(value: unknown, label: string): number {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_TOTAL_AMOUNT) {
    throw new WorkflowHttpError(422, "INVALID_PRICING_RULE", `Konfigurasi harga ${label} tidak valid.`);
  }
  return Math.round(amount);
}

function safeInteger(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    throw new WorkflowHttpError(422, "INVALID_INTEGER", `${label} harus berupa bilangan bulat.`);
  }
  return parsed;
}

function lookupCaseInsensitive(record: Record<string, any>, key: string): { found: boolean; value: any } {
  const normalizedKey = normalizeWorkflowValue(key);
  const matchedKey = Object.keys(record || {}).find(candidate => normalizeWorkflowValue(candidate) === normalizedKey);
  return matchedKey === undefined ? { found: false, value: undefined } : { found: true, value: record[matchedKey] };
}

function pricingItemCode(...parts: unknown[]): string {
  const code = parts
    .map(part => String(part ?? "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_"))
    .filter(Boolean)
    .join("_")
    .slice(0, 120);
  return code || "form_addon";
}

function buildAdditionalQuoteItems(pricingRules: any, answers: Record<string, any>): any[] {
  const configuredFields = Array.isArray(pricingRules?.additional_fields)
    ? pricingRules.additional_fields
    : [];
  const items: any[] = [];

  for (const field of configuredFields) {
    if (!isPlainObject(field) || typeof field.field_id !== "string") continue;
    const answer = answers[field.field_id];
    if (!hasAnswer(answer)) continue;
    const fieldType = String(field.field_type || "");
    const fieldLabel = String(field.label || "Biaya tambahan");

    if (["radio", "select", "image_choice", "checkbox"].includes(fieldType)) {
      const selectedValues = fieldType === "checkbox" ? answer : [answer];
      if (!Array.isArray(selectedValues)) continue;
      const usedOptions = new Set<string>();
      for (const selectedValue of selectedValues) {
        const normalized = normalizeWorkflowValue(selectedValue);
        const option = (Array.isArray(field.options) ? field.options : []).find((candidate: any) =>
          normalizeWorkflowValue(candidate?.value) === normalized
          || normalizeWorkflowValue(candidate?.label) === normalized
        );
        if (!option || usedOptions.has(String(option.value))) continue;
        usedOptions.add(String(option.value));
        const unitPrice = safeMoney(option.price ?? 0, `${fieldLabel}: ${option.label || option.value}`);
        if (unitPrice <= 0) continue;
        items.push({
          item_code: pricingItemCode("form", field.field_id, option.value),
          item_name: `${fieldLabel}: ${option.label || option.value}`,
          item_type: "other",
          beneficiary_type: "employee",
          beneficiary_index: null,
          quantity: 1,
          unit_price: unitPrice,
          metadata: { field_id: field.field_id, option_value: option.value },
        });
      }
      continue;
    }

    if (fieldType === "number" || fieldType === "repeater") {
      const quantity = fieldType === "repeater"
        ? (Array.isArray(answer) ? answer.length : 0)
        : safeInteger(answer, fieldLabel);
      if (quantity <= 0) continue;
      const maximum = Math.min(
        MAX_ADDON_QUANTITY_HARD_LIMIT,
        Math.max(1, Number(field.max_quantity || MAX_ADDON_QUANTITY_HARD_LIMIT)),
      );
      if (!Number.isInteger(maximum) || quantity > maximum) {
        throw new WorkflowHttpError(422, "ADDON_QUANTITY_OUT_OF_RANGE", `${fieldLabel} maksimal ${maximum}.`);
      }
      const unitPrice = safeMoney(field.unit_price ?? 0, fieldLabel);
      if (unitPrice <= 0) continue;
      items.push({
        item_code: pricingItemCode("form", field.field_id),
        item_name: fieldLabel,
        item_type: "other",
        beneficiary_type: "employee",
        beneficiary_index: null,
        quantity,
        unit_price: unitPrice,
        metadata: { field_id: field.field_id },
      });
      continue;
    }

    if (fieldType === "addon_group") {
      if (!Array.isArray(answer)) {
        throw new WorkflowHttpError(422, "INVALID_ADDON_ORDER", `${fieldLabel} harus berupa daftar pesanan.`);
      }
      const usedItemIds = new Set<string>();
      for (const order of answer) {
        if (!isPlainObject(order)) throw new WorkflowHttpError(422, "INVALID_ADDON_ORDER", `${fieldLabel} tidak valid.`);
        const itemId = String(order.item_id || "");
        if (usedItemIds.has(itemId)) throw new WorkflowHttpError(422, "DUPLICATE_ADDON_ITEM", `${fieldLabel} berisi item ganda.`);
        usedItemIds.add(itemId);
        const configuredItem = (Array.isArray(field.items) ? field.items : []).find((candidate: any) => candidate?.id === itemId);
        if (!configuredItem) continue; // Item valid tanpa harga tidak menghasilkan tagihan.
        const quantity = safeInteger(order.quantity, `Jumlah ${configuredItem.name || fieldLabel}`);
        const maximum = Math.min(
          MAX_ADDON_QUANTITY_HARD_LIMIT,
          Math.max(1, Number(configuredItem.max_quantity || 10)),
        );
        if (!Number.isInteger(maximum) || quantity < 1 || quantity > maximum) {
          throw new WorkflowHttpError(422, "ADDON_QUANTITY_OUT_OF_RANGE", `Jumlah ${configuredItem.name || fieldLabel} harus antara 1 dan ${maximum}.`);
        }
        const unitPrice = safeMoney(configuredItem.price ?? 0, configuredItem.name || fieldLabel);
        if (unitPrice <= 0) continue;
        items.push({
          item_code: pricingItemCode("form", field.field_id, configuredItem.id),
          item_name: `${fieldLabel}: ${configuredItem.name}`,
          item_type: "other",
          beneficiary_type: "employee",
          beneficiary_index: null,
          quantity,
          unit_price: unitPrice,
          metadata: { field_id: field.field_id, addon_item_id: configuredItem.id },
        });
      }
    }
  }

  return items;
}

export function buildRegistrationQuote(workflow: any, answers: Record<string, any>) {
  const attendanceFieldId = bindingFieldId(workflow, "attendance");
  if (!attendanceFieldId) {
    throw new WorkflowHttpError(422, "MISSING_ATTENDANCE_BINDING", "Workflow belum memiliki binding pertanyaan kehadiran.");
  }

  const isAttending = parseDecision(workflow, "attendance", answers[attendanceFieldId]);
  if (isAttending === null) {
    throw new WorkflowHttpError(422, "INVALID_ATTENDANCE", "Jawaban kehadiran wajib dipilih.");
  }

  const pricingRules = isPlainObject(workflow?.pricing_rules) ? workflow.pricing_rules : {};
  const currency = typeof pricingRules.currency === "string" && pricingRules.currency.length === 3
    ? pricingRules.currency.toUpperCase()
    : DEFAULT_CURRENCY;

  if (!isAttending) {
    return {
      attendance_status: "declined",
      shirt_size: null,
      is_camping: false,
      family_count: 0,
      currency,
      items: [],
      subtotal_amount: 0,
      total_amount: 0,
      requires_payment: false,
    };
  }

  const items: any[] = [];
  let shirtSize: string | null = null;
  const shirtFieldId = bindingFieldId(workflow, "shirt_size");
  if (shirtFieldId) {
    shirtSize = String(answers[shirtFieldId] ?? "").trim().toUpperCase();
    if (!shirtSize) {
      throw new WorkflowHttpError(422, "MISSING_SHIRT_SIZE", "Ukuran baju wajib dipilih.");
    }

    const surchargeRules = isPlainObject(pricingRules.shirt_surcharge) ? pricingRules.shirt_surcharge : {};
    const surcharge = lookupCaseInsensitive(surchargeRules, shirtSize);
    if (Object.keys(surchargeRules).length > 0 && !surcharge.found) {
      throw new WorkflowHttpError(422, "INVALID_SHIRT_SIZE", "Ukuran baju tidak tersedia pada konfigurasi program.");
    }
    const surchargeAmount = safeMoney(surcharge.value ?? 0, `ukuran ${shirtSize}`);
    if (surchargeAmount > 0) {
      items.push({
        item_code: `shirt_surcharge_${shirtSize.toLowerCase()}`,
        item_name: `Tambahan ukuran baju ${shirtSize}`,
        item_type: "shirt_surcharge",
        beneficiary_type: "employee",
        beneficiary_index: null,
        quantity: 1,
        unit_price: surchargeAmount,
        metadata: { shirt_size: shirtSize },
      });
    }
  }

  const campingFieldId = bindingFieldId(workflow, "camping");
  let isCamping = false;
  if (campingFieldId) {
    const campingDecision = parseDecision(workflow, "camping", answers[campingFieldId]);
    if (campingDecision === null) {
      throw new WorkflowHttpError(422, "MISSING_CAMPING", "Pilihan camping wajib dijawab.");
    }
    isCamping = campingDecision;
  }

  let bringingFamily = false;
  const bringingFamilyFieldId = bindingFieldId(workflow, "bringing_family");
  if (bringingFamilyFieldId) {
    const familyDecision = parseDecision(workflow, "bringing_family", answers[bringingFamilyFieldId]);
    if (familyDecision === null) {
      throw new WorkflowHttpError(422, "MISSING_FAMILY_DECISION", "Pilihan membawa keluarga wajib dijawab.");
    }
    bringingFamily = familyDecision;
  }

  let familyCount = 0;
  const familyCountFieldId = bindingFieldId(workflow, "family_count");
  if (bringingFamily || (!bringingFamilyFieldId && hasAnswer(boundAnswer(workflow, answers, "family_count")))) {
    if (!familyCountFieldId) {
      throw new WorkflowHttpError(422, "MISSING_FAMILY_COUNT_BINDING", "Workflow belum memiliki binding jumlah anggota keluarga.");
    }
    const familyAnswer = answers[familyCountFieldId];
    familyCount = Array.isArray(familyAnswer)
      ? familyAnswer.length
      : safeInteger(familyAnswer, "Jumlah anggota keluarga");
    const configuredMax = Number(pricingRules?.family?.max_members ?? 5);
    const maxMembers = Number.isInteger(configuredMax)
      ? Math.min(Math.max(configuredMax, 1), MAX_FAMILY_MEMBERS_HARD_LIMIT)
      : 5;
    if (familyCount < 1 || familyCount > maxMembers) {
      throw new WorkflowHttpError(
        422,
        "INVALID_FAMILY_COUNT",
        `Jumlah anggota keluarga harus antara 1 dan ${maxMembers}.`,
      );
    }

    const familyRules = isPlainObject(pricingRules?.family) ? pricingRules.family : {};
    const hasSplitFamilyPrice = Object.prototype.hasOwnProperty.call(familyRules, "entry_unit_price")
      || Object.prototype.hasOwnProperty.call(familyRules, "meal_unit_price");
    const entryPrice = safeMoney(
      hasSplitFamilyPrice ? familyRules.entry_unit_price ?? 0 : familyRules.package_unit_price ?? 0,
      "tiket keluarga",
    );
    const mealPrice = safeMoney(hasSplitFamilyPrice ? familyRules.meal_unit_price ?? 0 : 0, "makan keluarga");
    if (entryPrice > 0) {
      items.push({
        item_code: "family_entry",
        item_name: "Tiket masuk keluarga",
        item_type: "family_entry",
        beneficiary_type: "family",
        beneficiary_index: null,
        quantity: familyCount,
        unit_price: entryPrice,
        metadata: {},
      });
    }
    if (mealPrice > 0) {
      items.push({
        item_code: "family_meal",
        item_name: "Kupon makan keluarga",
        item_type: "family_meal",
        beneficiary_type: "family",
        beneficiary_index: null,
        quantity: familyCount,
        unit_price: mealPrice,
        metadata: {},
      });
    }
  }

  items.push(...buildAdditionalQuoteItems(pricingRules, answers));

  const subtotal = items.reduce((total, item) => total + item.quantity * item.unit_price, 0);
  if (!Number.isSafeInteger(subtotal) || subtotal > MAX_TOTAL_AMOUNT) {
    throw new WorkflowHttpError(422, "TOTAL_OUT_OF_RANGE", "Total pembayaran berada di luar batas yang diizinkan.");
  }

  return {
    attendance_status: "attending",
    shirt_size: shirtSize,
    is_camping: isCamping,
    family_count: familyCount,
    currency,
    items,
    subtotal_amount: subtotal,
    total_amount: subtotal,
    requires_payment: subtotal > 0,
  };
}

function validateAnswersPayload(answers: unknown): Record<string, any> {
  if (!isPlainObject(answers)) {
    throw new WorkflowHttpError(400, "INVALID_ANSWERS", "answers harus berupa object JSON.");
  }
  const keys = Object.keys(answers);
  if (keys.length > MAX_ANSWER_FIELDS || Buffer.byteLength(JSON.stringify(answers), "utf8") > MAX_ANSWER_BYTES) {
    throw new WorkflowHttpError(413, "ANSWERS_TOO_LARGE", "Payload jawaban terlalu besar.");
  }
  return answers;
}

function visibleAnswerSnapshot(fields: any[], answers: Record<string, any>) {
  const visibleFields = getActiveWorkflowFields(fields, answers);
  const snapshot: Record<string, any> = {};
  for (const field of visibleFields) {
    if (Object.prototype.hasOwnProperty.call(answers, field.id)) snapshot[field.id] = answers[field.id];
  }
  return { visibleFields, snapshot };
}

function assertConfiguredOption(field: any, value: unknown, label: string) {
  if (!Array.isArray(field?.options) || field.options.length === 0) return;
  const normalized = normalizeWorkflowValue(value);
  const allowed = field.options.some((option: any) =>
    normalizeWorkflowValue(option?.value) === normalized
    || normalizeWorkflowValue(option?.label) === normalized
  );
  if (!allowed) {
    throw new WorkflowHttpError(422, "INVALID_OPTION", `${label} berisi pilihan yang tidak tersedia.`, {
      field_id: field.id,
    });
  }
}

function validateFieldValue(field: any, value: unknown, label: string) {
  if (!hasAnswer(value)) return;

  if (["select", "radio", "image_choice"].includes(field.type)) {
    if (Array.isArray(value) || isPlainObject(value)) {
      throw new WorkflowHttpError(422, "INVALID_OPTION", `${label} harus berisi satu pilihan.`, {
        field_id: field.id,
      });
    }
    assertConfiguredOption(field, value, label);
  }

  if (field.type === "checkbox") {
    if (!Array.isArray(value)) {
      throw new WorkflowHttpError(422, "INVALID_OPTION", `${label} harus berupa daftar pilihan.`, {
        field_id: field.id,
      });
    }
    value.forEach(selectedValue => assertConfiguredOption(field, selectedValue, label));
  }

  if (field.type === "number") {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
      throw new WorkflowHttpError(422, "INVALID_NUMBER", `${label} harus berupa angka yang valid.`, {
        field_id: field.id,
      });
    }
    const minimum = field.min === undefined ? null : Number(field.min);
    const maximum = field.max === undefined ? null : Number(field.max);
    if ((minimum !== null && !Number.isFinite(minimum)) || (maximum !== null && !Number.isFinite(maximum))) {
      throw new WorkflowHttpError(422, "INVALID_NUMBER_CONFIG", `Konfigurasi batas ${label} tidak valid.`, {
        field_id: field.id,
      });
    }
    if (minimum !== null && numberValue < minimum) {
      throw new WorkflowHttpError(422, "NUMBER_OUT_OF_RANGE", `${label} minimal ${field.min}.`, {
        field_id: field.id,
      });
    }
    if (maximum !== null && numberValue > maximum) {
      throw new WorkflowHttpError(422, "NUMBER_OUT_OF_RANGE", `${label} maksimal ${field.max}.`, {
        field_id: field.id,
      });
    }
  }

  if (field.type === "addon_group") {
    if (!Array.isArray(value)) {
      throw new WorkflowHttpError(422, "INVALID_ADDON_ORDER", `${label} harus berupa daftar pesanan.`, {
        field_id: field.id,
      });
    }
    const usedItemIds = new Set<string>();
    for (const order of value) {
      if (!isPlainObject(order)) {
        throw new WorkflowHttpError(422, "INVALID_ADDON_ORDER", `${label} berisi pesanan tidak valid.`, { field_id: field.id });
      }
      const itemId = String(order.item_id || "");
      const configuredItem = (Array.isArray(field.items) ? field.items : []).find((item: any) => item?.id === itemId);
      if (!configuredItem) {
        throw new WorkflowHttpError(422, "INVALID_ADDON_ITEM", `${label} berisi item yang tidak tersedia.`, { field_id: field.id });
      }
      if (usedItemIds.has(itemId)) {
        throw new WorkflowHttpError(422, "DUPLICATE_ADDON_ITEM", `${label} berisi item ganda.`, { field_id: field.id });
      }
      usedItemIds.add(itemId);
      const quantity = Number(order.quantity);
      const maximum = Math.min(MAX_ADDON_QUANTITY_HARD_LIMIT, Math.max(1, Number(configuredItem.max_quantity || 10)));
      if (!Number.isInteger(quantity) || quantity < 1 || !Number.isInteger(maximum) || quantity > maximum) {
        throw new WorkflowHttpError(422, "ADDON_QUANTITY_OUT_OF_RANGE", `Jumlah ${configuredItem.name || label} harus antara 1 dan ${maximum}.`, { field_id: field.id });
      }
    }
  }
}

export function validateWorkflowAnswers(visibleFields: any[], answers: Record<string, any>) {
  const missing = visibleFields.filter(field => {
    if (!field?.required || field.type === "payment_section") return false;
    const answer = answers[field.id];
    if (field.type === "addon_group" && Array.isArray(answer)) {
      return !answer.some(order => Number(order?.quantity) > 0);
    }
    return !hasAnswer(answer);
  });
  if (missing.length > 0) {
    throw new WorkflowHttpError(
      422,
      "MISSING_REQUIRED_FIELDS",
      `Kolom wajib belum diisi: ${missing.map(field => field.label).join(", ")}.`,
      { field_ids: missing.map(field => field.id) },
    );
  }

  for (const field of visibleFields) {
    const answer = answers[field.id];
    const fieldLabel = field.label || field.id || "Pertanyaan";

    if (field.type !== "repeater") {
      validateFieldValue(field, answer, fieldLabel);
      continue;
    }

    const rows = answer === undefined || answer === null ? [] : answer;
    if (!Array.isArray(rows)) {
      throw new WorkflowHttpError(422, "INVALID_REPEATER", `${fieldLabel} harus berupa daftar data.`, {
        field_id: field.id,
      });
    }

    const configuredMin = field.min_items === undefined ? 0 : Number(field.min_items);
    const configuredMax = field.max_items === undefined
      ? MAX_FAMILY_MEMBERS_HARD_LIMIT
      : Number(field.max_items);
    if (!Number.isInteger(configuredMin) || !Number.isInteger(configuredMax)
      || configuredMin < 0 || configuredMin > MAX_FAMILY_MEMBERS_HARD_LIMIT
      || configuredMax < configuredMin) {
      throw new WorkflowHttpError(422, "INVALID_REPEATER_CONFIG", `Konfigurasi ${fieldLabel} tidak valid.`);
    }
    const maximum = Math.min(configuredMax, MAX_FAMILY_MEMBERS_HARD_LIMIT);
    if (rows.length < configuredMin || rows.length > maximum) {
      throw new WorkflowHttpError(
        422,
        "REPEATER_OUT_OF_RANGE",
        `${fieldLabel} harus berisi antara ${configuredMin} dan ${maximum} data.`,
        { field_id: field.id },
      );
    }

    const subfields = Array.isArray(field.subfields) ? field.subfields : [];
    rows.forEach((row: unknown, rowIndex: number) => {
      if (!isPlainObject(row)) {
        throw new WorkflowHttpError(
          422,
          "INVALID_REPEATER_ROW",
          `${fieldLabel} baris ${rowIndex + 1} tidak valid.`,
          { field_id: field.id, row_index: rowIndex },
        );
      }
      for (const subfield of subfields) {
        const subfieldValue = row[subfield.id];
        const subfieldLabel = `${subfield.label || subfield.id} anggota ke-${rowIndex + 1}`;
        if (subfield.required && !hasAnswer(subfieldValue)) {
          throw new WorkflowHttpError(422, "MISSING_REPEATER_FIELD", `${subfieldLabel} wajib diisi.`, {
            field_id: field.id,
            subfield_id: subfield.id,
            row_index: rowIndex,
          });
        }
        validateFieldValue(subfield, subfieldValue, subfieldLabel);
      }
    });
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function buildDeterministicUuid(seed: string): string {
  const bytes = crypto.createHash("sha256").update(seed).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function quoteItemsForInsert(registrationId: string, quote: any[]) {
  return quote.map(item => ({ ...item, registration_id: registrationId }));
}

function isUuid(value: unknown): boolean {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isProgramExpired(endDate: unknown): boolean {
  if (!endDate) return false;
  const raw = String(endDate);
  const end = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T23:59:59.999`) : new Date(raw);
  return Number.isNaN(end.getTime()) || end.getTime() < Date.now();
}

function sanitizeProofReference(value: unknown): string {
  if (typeof value !== "string" || value.trim().length < 3 || value.length > 2048) {
    throw new WorkflowHttpError(400, "INVALID_PROOF_REFERENCE", "Referensi bukti pembayaran tidak valid.");
  }
  const proof = value.trim();
  if (proof.startsWith("https://")) {
    try {
      const proofUrl = new URL(proof);
      const configuredOrigins = [
        process.env.VITE_SUPABASE_URL,
        ...(process.env.PROGRAM_PAYMENT_PROOF_ALLOWED_ORIGINS || "").split(","),
      ]
        .map(origin => origin?.trim())
        .filter(Boolean)
        .map(origin => new URL(origin).origin);
      if (configuredOrigins.includes(proofUrl.origin) && proofUrl.pathname.includes("/storage/")) return proof;
    } catch {
      // Handled by the validation error below.
    }
    throw new WorkflowHttpError(400, "UNTRUSTED_PROOF_ORIGIN", "URL bukti pembayaran bukan berasal dari storage yang diizinkan.");
  }
  if (/^[a-zA-Z0-9/_\-.]+$/.test(proof) && !proof.includes("..")) return proof;
  throw new WorkflowHttpError(400, "INVALID_PROOF_REFERENCE", "Bukti pembayaran harus berupa URL HTTPS atau storage path yang valid.");
}

function inferProofMimeType(reference: unknown, fallback = "image/jpeg"): string {
  const cleanReference = String(reference || "").split("?")[0].toLowerCase();
  if (cleanReference.endsWith(".png")) return "image/png";
  if (cleanReference.endsWith(".webp")) return "image/webp";
  if (cleanReference.endsWith(".jpg") || cleanReference.endsWith(".jpeg")) return "image/jpeg";
  return fallback;
}

async function loadPaymentProofForKioskValidator(supabase: any, proofReference: string) {
  if (proofReference.startsWith("https://")) {
    const response = await fetch(proofReference);
    if (!response.ok) throw new Error(`Proof image fetch failed: ${response.status}`);
    const mimeType = response.headers.get("content-type")?.split(";")[0] || inferProofMimeType(proofReference);
    const buffer = Buffer.from(await response.arrayBuffer());
    return { buffer, mimeType };
  }

  const { data, error } = await supabase.storage.from("program-files").download(proofReference);
  if (error || !data) throw new Error(error?.message || "Proof image download failed");
  const mimeType = data.type || inferProofMimeType(proofReference);
  const buffer = Buffer.from(await data.arrayBuffer());
  return { buffer, mimeType };
}

async function validateProgramPaymentProofWithKioskRules(groq: any, supabase: any, proofReference: string, expectedAmount: number) {
  const attemptedAt = new Date().toISOString();
  if (!groq || !process.env.GROQ_API_KEY) {
    return {
      attempted_at: attemptedAt,
      provider: "groq",
      source: "kiosk_receipt_validator",
      valid: false,
      fallback_to_manual: true,
      reason: "GROQ_API_KEY belum dikonfigurasi di backend. Bukti disimpan untuk review admin.",
    };
  }

  const visionModel = process.env.GROQ_VISION_MODEL?.trim();
  if (!visionModel) {
    return {
      attempted_at: attemptedAt,
      provider: "groq",
      source: "kiosk_receipt_validator",
      valid: false,
      fallback_to_manual: true,
      reason: "Verifikasi gambar otomatis belum tersedia. Bukti disimpan untuk review admin.",
    };
  }

  try {
    const { buffer, mimeType } = await loadPaymentProofForKioskValidator(supabase, proofReference);
    if (buffer.length > 10 * 1024 * 1024) {
      return {
        attempted_at: attemptedAt,
        provider: "groq",
        source: "kiosk_receipt_validator",
        valid: false,
        fallback_to_manual: true,
        reason: "Ukuran bukti terlalu besar untuk verifikasi AI. Bukti disimpan untuk review admin.",
      };
    }

    const imageBase64 = buffer.toString("base64");
    const amountNum = Number(expectedAmount || 0);
    const amountFormatted = Number.isNaN(amountNum) ? String(expectedAmount) : amountNum.toLocaleString("id-ID");
    const prompt = `
      Kamu adalah sistem verifikasi bukti pembayaran untuk toko kantin digital.
      Analisis gambar berikut dan tentukan apakah ini adalah bukti transfer/pembayaran yang valid.

      Nominal transaksi yang harus dibayar: Rp ${amountFormatted}

      INSTRUKSI PENTING:
      - Gambar bisa berupa screenshot panjang dari aplikasi mobile banking, QRIS, GoPay, OVO, DANA, ShopeePay, atau aplikasi transfer lainnya.
      - JANGAN tolak hanya karena gambar tidak ter-crop atau ada elemen lain di sekitar nota.
      - Fokus mencari bukti pembayaran di MANA PUN lokasinya dalam gambar.
      - Cari teks nominal seperti: "${expectedAmount}", "Rp ${amountFormatted}", atau angka yang mendekati ± 5%.
      - Cari indikator keberhasilan seperti: "Berhasil", "Sukses", "Success", "Selesai", tanda centang hijau, atau teks serupa.
      - Cari nama pengirim, nama penerima, atau nama bank/dompet digital sebagai konteks tambahan.
      - JANGAN tolak berdasarkan tanggal transaksi — customer mungkin upload bukti dari hari sebelumnya, itu TETAP VALID.
      - Jika nominal TERLIHAT dan status BERHASIL terdeteksi, anggap valid meskipun gambar tidak sempurna.

      TOLAK hanya jika:
      - Gambar bukan bukti pembayaran sama sekali (foto biasa, meme, dll)
      - Nominal yang terlihat JELAS berbeda jauh dari Rp ${amountFormatted}
      - Status transaksi JELAS menunjukkan gagal/pending/dibatalkan

      Balas HANYA dengan JSON tanpa markdown:
      {
        "valid": boolean,
        "reason": "Pesan singkat dalam Bahasa Indonesia. Jika valid sebutkan nominalnya. Jika tidak valid jelaskan alasannya."
      }
    `;

    const result = await groq.chat.completions.create({
      model: visionModel,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        },
      ],
      max_tokens: 300,
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const responseText = result.choices?.[0]?.message?.content || "";
    let parsed: any;
    try {
      parsed = JSON.parse(responseText.trim());
    } catch {
      return {
        attempted_at: attemptedAt,
        provider: "groq",
        source: "kiosk_receipt_validator",
        model: visionModel,
        valid: false,
        fallback_to_manual: true,
        reason: "AI belum mengembalikan hasil yang dapat dibaca. Bukti disimpan untuk review admin.",
        raw_response_preview: responseText.slice(0, 200),
      };
    }

    return {
      attempted_at: attemptedAt,
      provider: "groq",
      source: "kiosk_receipt_validator",
      model: visionModel,
      valid: Boolean(parsed.valid),
      fallback_to_manual: Boolean(parsed.fallbackToPending || parsed.fallback_to_pending),
      reason: String(parsed.reason || (parsed.valid ? "Bukti pembayaran valid." : "Bukti pembayaran belum valid.")).slice(0, 500),
      raw: parsed,
    };
  } catch (error: any) {
    console.error("[ProgramWorkflowV2] Kiosk receipt validator failed:", error);
    return {
      attempted_at: attemptedAt,
      provider: "groq",
      source: "kiosk_receipt_validator",
      model: visionModel,
      valid: false,
      fallback_to_manual: true,
      reason: "Layanan verifikasi otomatis sedang sibuk. Bukti pembayaran disimpan untuk review admin.",
      error: String(error?.message || error).slice(0, 300),
    };
  }
}

export function paymentInstructions(workflow: any) {
  const rules = isPlainObject(workflow?.payment_rules) ? workflow.payment_rules : {};
  const configuredMethods = Array.isArray(rules.methods)
    ? rules.methods.filter((method: unknown) => ["bank_transfer", "manual_qris"].includes(String(method)))
    : [];
  const fallbackMethod = String(rules.method || "");
  const paymentMethods = configuredMethods.length > 0
    ? configuredMethods
    : fallbackMethod === "manual_qris"
      ? ["manual_qris"]
      : fallbackMethod === "manual_transfer_or_qris"
        ? ["bank_transfer", "manual_qris"]
        : ["bank_transfer"];
  return {
    provider: String(rules.provider || "manual"),
    method: paymentMethods[0],
    payment_methods: paymentMethods,
    qris_image_url: typeof rules.qris_image_url === "string" ? rules.qris_image_url : null,
    bank_name: typeof rules.bank_name === "string" ? rules.bank_name : null,
    account_name: typeof rules.account_name === "string" ? rules.account_name : null,
    account_number: typeof rules.account_number === "string" ? rules.account_number : null,
    instructions: typeof rules.instructions === "string" ? rules.instructions : null,
    proof_required: rules.proof_required !== false,
    verify_with_ai: rules.verify_with_ai !== false,
  };
}

function workflowFormSnapshot(workflow: any): Record<string, any> | null {
  const snapshot = isPlainObject(workflow?.metadata?.form_snapshot)
    ? workflow.metadata.form_snapshot
    : null;
  if (!snapshot || !Array.isArray(snapshot.fields)) return null;
  const snapshotFormId = String(snapshot.dynamic_form_id || snapshot.id || "");
  if (!snapshotFormId || snapshotFormId !== String(workflow?.dynamic_form_id || "")) return null;
  return snapshot;
}

function workflowPricingForClient(workflow: any) {
  return {
    workflow_config_id: workflow?.id || null,
    workflow_version: workflow?.version || null,
    dynamic_form_id: workflow?.dynamic_form_id || null,
    field_bindings: isPlainObject(workflow?.field_bindings) ? workflow.field_bindings : {},
    pricing_rules: isPlainObject(workflow?.pricing_rules) ? workflow.pricing_rules : {},
    form_snapshot: workflowFormSnapshot(workflow),
  };
}

export function resolveWorkflowPaymentMethod(workflow: any, requestedMethod?: unknown): string {
  const instructions = paymentInstructions(workflow);
  const requested = String(requestedMethod || "");
  return instructions.payment_methods.includes(requested) ? requested : instructions.method;
}

async function authenticateRequest(supabase: any, req: any) {
  const authHeader = req.headers.authorization;
  const match = typeof authHeader === "string" ? authHeader.match(/^Bearer\s+(.+)$/i) : null;
  if (!match?.[1]) throw new WorkflowHttpError(401, "UNAUTHORIZED", "Sesi login tidak valid.");
  const { data: { user }, error } = await supabase.auth.getUser(match[1]);
  if (error || !user) throw new WorkflowHttpError(401, "UNAUTHORIZED", "Sesi login tidak valid.");
  return user;
}

async function getProfile(supabase: any, user: any) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nik, name, role")
    .eq("id", user.id)
    .single();
  if (error || !data) throw new WorkflowHttpError(403, "PROFILE_NOT_FOUND", "Profil karyawan tidak ditemukan.");
  return data;
}

async function requireAdmin(supabase: any, req: any) {
  const user = req.user || await authenticateRequest(supabase, req);
  const profile = req.profile?.role
    ? req.profile
    : await getProfile(supabase, user);
  if (!profile || !["admin", "superadmin"].includes(profile.role)) {
    throw new WorkflowHttpError(403, "FORBIDDEN", "Akses hanya untuk admin.");
  }
  return { user, profile };
}

function throwDatabaseError(error: any, fallbackMessage: string): never {
  const message = String(error?.message || "");
  const schemaMissing = error?.code === "42P01"
    || error?.code === "PGRST205"
    || message.includes("program_registrations")
    || message.includes("program_workflow_configs");
  if (schemaMissing) {
    throw new WorkflowHttpError(503, "WORKFLOW_SCHEMA_NOT_READY", "Migration Program Workflow V2 belum diterapkan.");
  }
  throw new WorkflowHttpError(500, "DATABASE_ERROR", fallbackMessage, { database_code: error?.code });
}

async function loadProgramContext(
  supabase: any,
  programId: string,
  profile: any,
  pinnedWorkflowConfigId?: string | null,
  options: { enforceDeadline?: boolean } = {},
) {
  const { data: program, error: programError } = await supabase
    .from("union_programs")
    .select("id, name, program_type, is_active, is_targeted, start_date, end_date, rsvp_deadline, publication_status, config_version, dynamic_form_id")
    .eq("id", programId)
    .single();
  if (programError || !program) {
    if (programError?.code === "PGRST116") throw new WorkflowHttpError(404, "PROGRAM_NOT_FOUND", "Program tidak ditemukan.");
    throwDatabaseError(programError, "Gagal memuat program.");
  }
  if (!program.is_active || isProgramExpired(program.end_date)) {
    throw new WorkflowHttpError(409, "PROGRAM_CLOSED", "Program sudah ditutup atau melewati batas waktu.");
  }
  if (program.program_type === "gathering" && program.publication_status !== "published") {
    throw new WorkflowHttpError(409, "PROGRAM_NOT_PUBLISHED", "Program belum diterbitkan atau sudah ditutup.");
  }
  if (options.enforceDeadline !== false
    && program.rsvp_deadline
    && new Date(program.rsvp_deadline).getTime() <= Date.now()) {
    throw new WorkflowHttpError(409, "RSVP_DEADLINE_PASSED", "Batas waktu RSVP sudah berakhir.");
  }

  const usesFrozenSnapshot = program.program_type === "gathering" && program.publication_status === "published";
  if (program.is_targeted || usesFrozenSnapshot) {
    const { data: eligible, error: eligibilityError } = await supabase
      .from("program_eligibility")
      .select("nik")
      .eq("program_id", programId)
      .eq("nik", profile.nik)
      .eq("config_version", program.config_version)
      .maybeSingle();
    if (eligibilityError) throwDatabaseError(eligibilityError, "Gagal memvalidasi peserta program.");
    if (!eligible) throw new WorkflowHttpError(403, "NOT_ELIGIBLE", "Anda tidak terdaftar sebagai peserta program ini.");
  }

  let workflowQuery = supabase
    .from("program_workflow_configs")
    .select("*")
    .eq("program_id", programId);
  workflowQuery = pinnedWorkflowConfigId
    ? workflowQuery.eq("id", pinnedWorkflowConfigId)
    : workflowQuery.eq("is_active", true);
  const { data: workflow, error: workflowError } = await workflowQuery.maybeSingle();
  if (workflowError) throwDatabaseError(workflowError, "Gagal memuat konfigurasi workflow.");
  if (!workflow) throw new WorkflowHttpError(409, "WORKFLOW_NOT_ACTIVE", "Workflow V2 belum diaktifkan untuk program ini.");

  const formId = workflow.dynamic_form_id || program.dynamic_form_id;
  if (!formId) throw new WorkflowHttpError(409, "FORM_NOT_LINKED", "Program belum terhubung dengan formulir.");
  const { data: form, error: formError } = await supabase
    .from("dynamic_forms")
    .select("id, title, fields, is_active, target_niks, target_departments, target_cutoff_date")
    .eq("id", formId)
    .single();
  if (formError || !form) throwDatabaseError(formError, "Gagal memuat formulir program.");
  if (!form.is_active) throw new WorkflowHttpError(409, "FORM_NOT_ACTIVE", "Formulir program sedang tidak aktif.");

  const targetNiks = Array.isArray(form.target_niks) ? form.target_niks : [];
  const targetDepartments = Array.isArray(form.target_departments) ? form.target_departments : [];
  if (!usesFrozenSnapshot && (targetNiks.length > 0 || targetDepartments.length > 0)) {
    let formEligible = targetNiks.includes(profile.nik);
    if (!formEligible && targetDepartments.length > 0) {
      const { data: employee, error: employeeError } = await supabase
        .from("employees")
        .select("department, tanggal_masuk")
        .eq("nik", profile.nik)
        .maybeSingle();
      if (employeeError) throwDatabaseError(employeeError, "Gagal memvalidasi target formulir.");
      formEligible = Boolean(employee?.department && targetDepartments.includes(employee.department));
      if (formEligible && form.target_cutoff_date) {
        formEligible = Boolean(
          employee?.tanggal_masuk
          && String(employee.tanggal_masuk) <= String(form.target_cutoff_date),
        );
      }
    }
    if (!formEligible) {
      throw new WorkflowHttpError(403, "FORM_NOT_ELIGIBLE", "Formulir ini tidak ditujukan untuk profil Anda.");
    }
  }

  const snapshot = workflowFormSnapshot(workflow);
  const versionedForm = snapshot
    ? { ...form, ...snapshot, id: form.id, fields: snapshot.fields }
    : form;
  return { program, workflow, form: versionedForm };
}

async function signPaymentProofUrls(supabase: any, payments: any[]) {
  return Promise.all((payments || []).map(async payment => {
    const reference = payment?.proof_url;
    if (!reference || String(reference).startsWith("https://")) return payment;
    const { data, error } = await supabase.storage.from("program-files").createSignedUrl(String(reference), 60 * 60);
    if (error || !data?.signedUrl) {
      return { ...payment, proof_url: null, proof_storage_path: reference };
    }
    return { ...payment, proof_url: data.signedUrl, proof_storage_path: reference };
  }));
}

async function loadRegistrationDetails(supabase: any, registration: any) {
  const [itemsResult, paymentsResult, couponsResult] = await Promise.all([
    supabase.from("program_registration_items").select("*").eq("registration_id", registration.id).order("created_at"),
    supabase.from("program_registration_payments")
      .select("id, registration_id, payment_method, provider, reference_id, expected_amount, paid_amount, currency, status, proof_url, proof_metadata, provider_transaction_id, verified_by, verified_at, paid_at, expires_at, created_at, updated_at")
      .eq("registration_id", registration.id)
      .order("created_at", { ascending: false }),
    supabase.from("program_coupons").select("*").eq("program_registration_id", registration.id).order("issued_at"),
  ]);
  if (itemsResult.error) throwDatabaseError(itemsResult.error, "Gagal memuat rincian biaya.");
  if (paymentsResult.error) throwDatabaseError(paymentsResult.error, "Gagal memuat pembayaran.");
  if (couponsResult.error) throwDatabaseError(couponsResult.error, "Gagal memuat kupon.");
  return {
    ...registration,
    items: itemsResult.data || [],
    payments: await signPaymentProofUrls(supabase, paymentsResult.data || []),
    coupons: couponsResult.data || [],
  };
}

async function loadRegistrationBatchDetails(supabase: any, registrations: any[]) {
  if (registrations.length === 0) return [];
  const ids = registrations.map(registration => registration.id);
  const programIds = [...new Set(registrations.map(registration => registration.program_id).filter(Boolean))];
  const workflowConfigIds = [...new Set(registrations.map(registration => registration.workflow_config_id).filter(Boolean))];
  const [itemsResult, paymentsResult, couponsResult, programsResult, workflowsResult] = await Promise.all([
    supabase.from("program_registration_items").select("*").in("registration_id", ids).order("created_at"),
    supabase.from("program_registration_payments")
      .select("id, registration_id, payment_method, provider, reference_id, expected_amount, paid_amount, currency, status, proof_url, proof_metadata, provider_transaction_id, verified_by, verified_at, paid_at, expires_at, created_at, updated_at")
      .in("registration_id", ids)
      .order("created_at", { ascending: false }),
    supabase.from("program_coupons").select("*").in("program_registration_id", ids).order("issued_at"),
    supabase.from("union_programs").select("id, name, is_active, end_date, publication_status").in("id", programIds),
    workflowConfigIds.length > 0
      ? supabase.from("program_workflow_configs").select("id, entitlement_rules, payment_rules").in("id", workflowConfigIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (itemsResult.error) throwDatabaseError(itemsResult.error, "Gagal memuat rincian biaya.");
  if (paymentsResult.error) throwDatabaseError(paymentsResult.error, "Gagal memuat pembayaran.");
  if (couponsResult.error) throwDatabaseError(couponsResult.error, "Gagal memuat kupon.");
  if (programsResult.error) throwDatabaseError(programsResult.error, "Gagal memuat nama program.");
  if (workflowsResult.error) throwDatabaseError(workflowsResult.error, "Gagal memuat konfigurasi tiket.");

  const groupByRegistration = (rows: any[]) => rows.reduce((groups: Map<string, any[]>, row: any) => {
    const key = row.registration_id || row.program_registration_id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
    return groups;
  }, new Map<string, any[]>());
  const items = groupByRegistration(itemsResult.data || []);
  const signedPayments = await signPaymentProofUrls(supabase, paymentsResult.data || []);
  const payments = groupByRegistration(signedPayments);
  const coupons = groupByRegistration(couponsResult.data || []);
  const programs = new Map((programsResult.data || []).map(program => [program.id, program]));
  const workflows = new Map((workflowsResult.data || []).map(workflow => [workflow.id, workflow]));
  return registrations.map(registration => {
    const registrationCoupons = coupons.get(registration.id) || [];
    const workflow = workflows.get(registration.workflow_config_id) || {};
    return {
      ...registration,
      program: programs.get(registration.program_id) || null,
      items: items.get(registration.id) || [],
      payments: payments.get(registration.id) || [],
      coupons: registrationCoupons,
      ticket_integrity: summarizeRegistrationTicketIntegrity(
        registration,
        workflow,
        registrationCoupons,
        programs.get(registration.program_id),
      ),
    };
  });
}

let couponSchemaCache: { current: boolean; legacy: boolean } | null = null;

async function detectCouponSchema(supabase: any) {
  if (couponSchemaCache) return couponSchemaCache;
  const [current, legacy] = await Promise.all([
    supabase.from("program_coupons").select("coupon_code, gate_type").limit(1),
    supabase.from("program_coupons").select("qr_code, barcode, coupon_type").limit(1),
  ]);
  couponSchemaCache = { current: !current.error, legacy: !legacy.error };
  if (!couponSchemaCache.current && !couponSchemaCache.legacy) {
    throw new WorkflowHttpError(503, "COUPON_SCHEMA_UNSUPPORTED", "Schema kupon legacy belum kompatibel dengan Workflow V2.");
  }
  return couponSchemaCache;
}

function entitlementCodes(workflow: any, beneficiary: "employee" | "family") {
  const configured = workflow?.entitlement_rules?.[beneficiary];
  const values = Array.isArray(configured) ? configured : ["attendance", "meal"];
  return [...new Set(values
    .map(value => normalizeWorkflowValue(value).replace(/[^a-z0-9_-]/g, ""))
    .filter(value => value === "attendance" || value === "meal"))];
}

export function isFamilyEntitlementReleased(registration: any, workflow: any): boolean {
  if (Number(registration?.family_count || 0) <= 0) return false;
  const paymentStatus = normalizeWorkflowValue(registration?.payment_status);
  if (paymentStatus === "paid" || paymentStatus === "not_required") return true;
  return workflow?.payment_rules?.hold_family_entitlements_until_paid === false;
}

const ENTITLEMENT_ELIGIBLE_REGISTRATION_STATUSES = new Set([
  "submitted",
  "pending_payment",
  "payment_pending",
  "payment_review",
  "payment_rejected",
  "confirmed",
  "locked",
]);

const INACTIVE_COUPON_STATUSES = new Set(["expired", "cancelled", "void"]);

function canIssueRegistrationEntitlements(registration: any): boolean {
  return normalizeWorkflowValue(registration?.attendance_status) === "attending"
    && ENTITLEMENT_ELIGIBLE_REGISTRATION_STATUSES.has(normalizeWorkflowValue(registration?.registration_status));
}

function isActiveEntitlementCoupon(coupon: any): boolean {
  return !INACTIVE_COUPON_STATUSES.has(normalizeWorkflowValue(coupon?.status));
}

function entitlementDefinitions(registration: any, workflow: any) {
  const definitions: Array<{ entitlement: string; beneficiary: "employee" | "family"; index: number | null }> = [];
  for (const entitlement of entitlementCodes(workflow, "employee")) {
    definitions.push({ entitlement, beneficiary: "employee", index: null });
  }
  if (isFamilyEntitlementReleased(registration, workflow)) {
    for (let index = 1; index <= Number(registration.family_count || 0); index += 1) {
      for (const entitlement of entitlementCodes(workflow, "family")) {
        definitions.push({ entitlement, beneficiary: "family", index });
      }
    }
  }
  return definitions;
}

export function summarizeRegistrationTicketIntegrity(registration: any, workflow: any, coupons: any[], program?: any) {
  const familyEntitlementCount = Number(registration?.family_count || 0)
    * entitlementCodes(workflow, "family").length;
  const familyReleased = isFamilyEntitlementReleased(registration, workflow);
  const expected = entitlementDefinitions(registration, workflow);
  const expectedKeys = new Set(expected.map(definition =>
    `${definition.entitlement}:${definition.beneficiary}:${definition.index || 0}`
  ));
  const validCoupons = (coupons || []).filter(isActiveEntitlementCoupon);
  const issuedKeys = new Set(validCoupons.map(couponKey));
  const issuedExpectedKeys = [...expectedKeys].filter(key => issuedKeys.has(key));
  const familyIssuedCount = [...issuedKeys].filter(key => key.includes(":family:")).length;
  const missingCount = expectedKeys.size - issuedExpectedKeys.length;

  return {
    expected_count: expectedKeys.size,
    issued_count: issuedExpectedKeys.length,
    missing_count: missingCount,
    family_expected_count: familyEntitlementCount,
    family_issued_count: Math.min(familyIssuedCount, familyEntitlementCount),
    family_held_count: familyReleased ? 0 : familyEntitlementCount,
    family_released: familyReleased,
    repairable: canIssueRegistrationEntitlements(registration)
      && missingCount > 0
      && (!program || (
        program.is_active === true
        && program.publication_status === "published"
        && !isProgramExpired(program.end_date)
      )),
    status: missingCount > 0
      ? "missing"
      : familyEntitlementCount > 0 && !familyReleased
        ? "waiting_payment"
        : "complete",
  };
}

function familyBeneficiaryName(registration: any, workflow: any, index: number): string {
  return `Keluarga ${index}`;
}

function couponKey(row: any) {
  return `${legacyEntitlementCode(row)}:${row.beneficiary_type}:${row.beneficiary_index || 0}`;
}

function legacyEntitlementCode(row: any): string {
  const value = normalizeWorkflowValue(row?.gate_type || row?.coupon_type || row?.entitlement_code);
  if (value === "food" || value.endsWith("_meal")) return "meal";
  if (value.endsWith("_attendance")) return "attendance";
  return value;
}

function createCouponCode(entitlement: string, beneficiary: string, index: number | null) {
  const prefix = entitlement === "meal" ? "MEAL" : "ATT";
  const family = beneficiary === "family" ? `-F${index}` : "-EMP";
  return `${prefix}${family}-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
}

interface EntitlementIssueOptions {
  recoverInactive?: boolean;
  recoverExpired?: boolean;
  recoveryReason?: string;
  recoveryActorId?: string;
}

async function programAllowsEntitlementIssuance(supabase: any, programId: string): Promise<boolean> {
  const { data: program, error } = await supabase
    .from("union_programs")
    .select("is_active, end_date, publication_status")
    .eq("id", programId)
    .maybeSingle();
  if (error) throwDatabaseError(error, "Gagal memeriksa status program sebelum menerbitkan tiket.");
  return Boolean(
    program?.is_active
    && program.publication_status === "published"
    && !isProgramExpired(program.end_date),
  );
}

export async function issueRegistrationEntitlements(
  supabase: any,
  registration: any,
  workflow: any,
  options: EntitlementIssueOptions = {},
  attempt = 0,
) {
  if (!canIssueRegistrationEntitlements(registration)) {
    return [];
  }
  if (!await programAllowsEntitlementIssuance(supabase, registration.program_id)) {
    throw new WorkflowHttpError(
      409,
      "PROGRAM_CLOSED",
      "Tiket tidak dapat diterbitkan karena program tidak aktif, belum published, atau sudah berakhir.",
    );
  }

  const existingResult = await supabase
    .from("program_coupons")
    .select("*")
    .eq("program_registration_id", registration.id);
  if (existingResult.error) throwDatabaseError(existingResult.error, "Gagal memeriksa entitlement program.");
  let existing = existingResult.data || [];
  const existingKeys = new Set(existing.filter(isActiveEntitlementCoupon).map(couponKey));
  const definitions = entitlementDefinitions(registration, workflow);

  let missing = definitions.filter(definition => !existingKeys.has(
    `${definition.entitlement}:${definition.beneficiary}:${definition.index || 0}`,
  ));
  if (missing.length === 0) return existing || [];

  const schema = await detectCouponSchema(supabase);
  const issuedAt = new Date().toISOString();

  // An RSVP that was changed to "tidak hadir" leaves its linked QR expired.
  // Reuse the row with a rotated code when the participant attends again.
  // Cancelled/void rows require an explicit admin reconciliation to avoid
  // silently reviving a deliberately invalidated credential.
  const recoverableStatuses = options.recoverInactive
    ? ["expired", "cancelled", "void"]
    : options.recoverExpired ? ["expired"] : [];
  for (const definition of missing) {
    const expectedKey = `${definition.entitlement}:${definition.beneficiary}:${definition.index || 0}`;
    const candidate = existing.find(coupon =>
      recoverableStatuses.includes(normalizeWorkflowValue(coupon?.status))
      && couponKey(coupon) === expectedKey
    );
    if (!candidate) continue;

    const code = createCouponCode(definition.entitlement, definition.beneficiary, definition.index);
    const beneficiaryName = definition.beneficiary === "family"
      ? familyBeneficiaryName(registration, workflow, definition.index)
      : registration.attendee_name || registration.nik;
    const entitlementMetadata = {
      ...(isPlainObject(candidate.entitlement_metadata) ? candidate.entitlement_metadata : {}),
      ...(isPlainObject(candidate.metadata) ? candidate.metadata : {}),
      workflow_version: registration.workflow_version,
      beneficiary_label: definition.beneficiary === "employee" ? "Karyawan" : `Keluarga ${definition.index}`,
      beneficiary_name: beneficiaryName,
      workflow_v2_reactivated_at: issuedAt,
      workflow_v2_reactivation_reason: options.recoveryReason || "registration_resubmitted",
      ...(options.recoveryActorId ? { workflow_v2_reactivated_by: options.recoveryActorId } : {}),
    };
    const updatePayload: any = {
      status: "active",
      issued_at: issuedAt,
      metadata: entitlementMetadata,
      entitlement_metadata: entitlementMetadata,
    };
    if (schema.current) {
      updatePayload.coupon_code = code;
      updatePayload.gate_type = definition.entitlement;
    }
    if (schema.legacy) {
      updatePayload.qr_code = code;
      updatePayload.barcode = code;
      updatePayload.coupon_type = definition.entitlement === "meal" ? "food" : definition.entitlement;
    }

    const { error: reactivateError } = await supabase
      .from("program_coupons")
      .update(updatePayload)
      .eq("id", candidate.id)
      .in("status", recoverableStatuses);
    if (reactivateError) throwDatabaseError(reactivateError, "Gagal mengaktifkan kembali tiket program.");
  }

  const refreshedResult = await supabase
    .from("program_coupons")
    .select("*")
    .eq("program_registration_id", registration.id);
  if (refreshedResult.error) throwDatabaseError(refreshedResult.error, "Gagal memverifikasi tiket yang diaktifkan kembali.");
  existing = refreshedResult.data || [];
  existingKeys.clear();
  for (const coupon of existing.filter(isActiveEntitlementCoupon)) existingKeys.add(couponKey(coupon));
  missing = definitions.filter(definition => !existingKeys.has(
    `${definition.entitlement}:${definition.beneficiary}:${definition.index || 0}`,
  ));
  if (missing.length === 0) return existing;

  const blockedByInactiveCoupon = missing.some(definition => {
    const expectedKey = `${definition.entitlement}:${definition.beneficiary}:${definition.index || 0}`;
    return existing.some(coupon => INACTIVE_COUPON_STATUSES.has(normalizeWorkflowValue(coupon?.status)) && couponKey(coupon) === expectedKey);
  });
  if (blockedByInactiveCoupon) {
    throw new WorkflowHttpError(
      409,
      "ENTITLEMENT_REQUIRES_ADMIN_REVIEW",
      "Tiket nonaktif memerlukan rekonsiliasi admin sebelum dapat diterbitkan kembali.",
    );
  }

  // Targeted legacy programs may already have employee coupons. Link an active
  // matching coupon to V2 instead of issuing a duplicate code.
  const employeeMissing = missing.filter(definition => definition.beneficiary === "employee");
  if (employeeMissing.length > 0) {
    const { data: adoptable, error: adoptableError } = await supabase
      .from("program_coupons")
      .select("*")
      .eq("program_id", registration.program_id)
      .eq("nik", registration.nik)
      .eq("status", "active")
      .is("program_registration_id", null);
    if (adoptableError) throwDatabaseError(adoptableError, "Gagal memeriksa kupon legacy.");

    for (const definition of employeeMissing) {
      const candidate = (adoptable || []).find(row => legacyEntitlementCode(row) === definition.entitlement);
      if (!candidate) continue;
      const entitlementMetadata = {
        ...(isPlainObject(candidate.metadata) ? candidate.metadata : {}),
        workflow_version: registration.workflow_version,
        beneficiary_label: "Karyawan",
        adopted_from_legacy: true,
      };
      const { error: adoptError } = await supabase
        .from("program_coupons")
        .update({
          program_registration_id: registration.id,
          beneficiary_type: "employee",
          beneficiary_index: null,
          entitlement_code: definition.entitlement,
          entitlement_metadata: entitlementMetadata,
          issued_at: candidate.issued_at || issuedAt,
          metadata: entitlementMetadata,
        })
        .eq("id", candidate.id)
        .is("program_registration_id", null);
      if (adoptError && adoptError.code !== "23505") {
        throwDatabaseError(adoptError, "Gagal menghubungkan kupon legacy.");
      }
    }
    const { data: linkedAfterAdoption, error: linkedAfterAdoptionError } = await supabase
      .from("program_coupons")
      .select("*")
      .eq("program_registration_id", registration.id);
    if (linkedAfterAdoptionError) throwDatabaseError(linkedAfterAdoptionError, "Gagal memverifikasi kupon legacy.");
    existingKeys.clear();
    for (const coupon of (linkedAfterAdoption || []).filter(isActiveEntitlementCoupon)) existingKeys.add(couponKey(coupon));
    missing = definitions.filter(definition => !existingKeys.has(
      `${definition.entitlement}:${definition.beneficiary}:${definition.index || 0}`,
    ));
    if (missing.length === 0) {
      const { data: adoptedRows, error: adoptedRowsError } = await supabase
        .from("program_coupons")
        .select("*")
        .eq("program_registration_id", registration.id)
        .order("issued_at");
      if (adoptedRowsError) throwDatabaseError(adoptedRowsError, "Gagal memuat kupon program.");
      return adoptedRows || [];
    }
  }

  const rows = missing.map(definition => {
    const code = createCouponCode(definition.entitlement, definition.beneficiary, definition.index);
    const beneficiaryName = definition.beneficiary === "family"
      ? familyBeneficiaryName(registration, workflow, definition.index)
      : registration.attendee_name || registration.nik;
    const entitlementMetadata = {
      workflow_version: registration.workflow_version,
      beneficiary_label: definition.beneficiary === "employee"
        ? "Karyawan"
        : `Keluarga ${definition.index}`,
      beneficiary_name: beneficiaryName,
    };
    const row: any = {
      program_id: registration.program_id,
      user_id: registration.user_id,
      nik: registration.nik,
      name: beneficiaryName,
      status: "active",
      metadata: entitlementMetadata,
      program_registration_id: registration.id,
      beneficiary_type: definition.beneficiary,
      beneficiary_index: definition.index,
      entitlement_code: `${definition.beneficiary}_${definition.entitlement === "meal" ? "meal" : "attendance"}`,
      entitlement_metadata: entitlementMetadata,
      issued_at: issuedAt,
    };
    if (schema.current) {
      row.coupon_code = code;
      row.gate_type = definition.entitlement;
    }
    if (schema.legacy) {
      row.qr_code = code;
      row.barcode = code;
      row.coupon_type = definition.entitlement === "meal" ? "food" : definition.entitlement;
    }
    return row;
  });

  const { error: insertError } = await supabase.from("program_coupons").insert(rows);
  if (insertError) {
    if (insertError.code === "23505" && attempt < 2) {
      return issueRegistrationEntitlements(supabase, registration, workflow, options, attempt + 1);
    }
    throwDatabaseError(insertError, "Gagal menerbitkan kupon program.");
  }

  const { data: issued, error: issuedError } = await supabase
    .from("program_coupons")
    .select("*")
    .eq("program_registration_id", registration.id)
    .order("issued_at");
  if (issuedError) throwDatabaseError(issuedError, "Gagal memuat kupon yang diterbitkan.");
  return issued || [];
}

async function appendEntitlementReconciliationAudit(
  supabase: any,
  registrationId: string,
  entry: Record<string, unknown>,
) {
  const { data: latest, error: loadError } = await supabase
    .from("program_registrations")
    .select("metadata")
    .eq("id", registrationId)
    .single();
  if (loadError || !latest) throwDatabaseError(loadError, "Gagal memuat audit rekonsiliasi tiket.");
  const currentMetadata = isPlainObject(latest.metadata) ? latest.metadata : {};
  const history = Array.isArray(currentMetadata.entitlement_reconciliation_history)
    ? currentMetadata.entitlement_reconciliation_history.slice(-19)
    : [];
  const { data: updated, error: auditError } = await supabase
    .from("program_registrations")
    .update({
      metadata: {
        ...currentMetadata,
        entitlement_reconciliation_history: [...history, entry],
      },
    })
    .eq("id", registrationId)
    .select("id")
    .single();
  if (auditError || !updated) throwDatabaseError(auditError, "Audit rekonsiliasi tiket belum dapat disimpan.");
}

async function expireUnlinkedLegacyEntitlements(supabase: any, registration: any, reason: string) {
  await detectCouponSchema(supabase);
  const { data: coupons, error } = await supabase
    .from("program_coupons")
    .select("*")
    .eq("program_id", registration.program_id)
    .eq("nik", registration.nik)
    .eq("status", "active")
    .is("program_registration_id", null);
  if (error) throwDatabaseError(error, "Gagal memeriksa kupon legacy program.");

  const candidates = (coupons || []).filter(row => ["attendance", "meal"].includes(legacyEntitlementCode(row)));
  for (const coupon of candidates) {
    const metadata = {
      ...(isPlainObject(coupon.metadata) ? coupon.metadata : {}),
      workflow_v2_disabled_at: new Date().toISOString(),
      workflow_v2_disabled_reason: reason,
      workflow_v2_registration_id: registration.id,
    };
    const { error: updateError } = await supabase
      .from("program_coupons")
      .update({ status: "expired", metadata })
      .eq("id", coupon.id)
      .eq("status", "active")
      .is("program_registration_id", null);
    if (updateError) throwDatabaseError(updateError, "Gagal menonaktifkan kupon legacy.");
  }
}

async function createOrReusePendingPayment(supabase: any, registration: any, workflow: any, answerHash: string, requestedMethod?: unknown) {
  const instructions = paymentInstructions(workflow);
  const paymentMethod = resolveWorkflowPaymentMethod(workflow, requestedMethod);
  const idempotencyKey = `program-registration:${registration.id}:${answerHash}`;
  const referenceHash = crypto
    .createHash("sha256")
    .update(`${registration.id}:${answerHash}`)
    .digest("hex");
  const referenceId = `PRG-${referenceHash.slice(0, 20).toUpperCase()}`;
  const payload = {
    registration_id: registration.id,
    payment_method: paymentMethod,
    provider: instructions.provider,
    reference_id: referenceId,
    idempotency_key: idempotencyKey,
    expected_amount: registration.total_amount,
    currency: registration.currency,
    status: "pending",
    proof_url: null,
    proof_metadata: {},
    provider_payload: {},
  };
  const { data, error } = await supabase
    .from("program_registration_payments")
    .upsert(payload, { onConflict: "idempotency_key" })
    .select()
    .single();
  if (error) throwDatabaseError(error, "Gagal membuat instruksi pembayaran.");
  return data;
}

function reviewHistory(metadata: any, entry: any) {
  const current = isPlainObject(metadata) ? metadata : {};
  const history = Array.isArray(current.review_history) ? current.review_history.slice(-19) : [];
  return { ...current, review_history: [...history, entry] };
}

function sendWorkflowError(res: any, error: any) {
  if (error instanceof WorkflowHttpError) {
    return res.status(error.status).json({
      success: false,
      error: error.message,
      code: error.code,
      ...(error.details ? { details: error.details } : {}),
    });
  }
  console.error("[ProgramWorkflowV2] Unexpected error:", error);
  return res.status(500).json({ success: false, error: "Terjadi kesalahan sistem.", code: "INTERNAL_ERROR" });
}

export function registerProgramRegistrationWorkflowRoutes(app: any, { supabase, sendNotification, groq }: any) {
  app.post("/api/portal/programs/:programId/registration-v2/submit", async (req: any, res: any) => {
    try {
      const { programId } = req.params;
      if (!isUuid(programId)) throw new WorkflowHttpError(400, "INVALID_PROGRAM_ID", "ID program tidak valid.");
      const user = await authenticateRequest(supabase, req);
      const profile = await getProfile(supabase, user);
      if (!profile.nik) throw new WorkflowHttpError(422, "NIK_REQUIRED", "Profil Anda belum memiliki NIK.");
      const submittedAnswers = validateAnswersPayload(req.body?.answers);

      // Existing RSVP records stay pinned to the workflow version used when
      // they were created. A newly reconciled active workflow only applies to
      // participants who have not registered yet.
      let { data: existingRegistration, error: existingError } = await supabase
        .from("program_registrations")
        .select("*")
        .eq("program_id", programId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (existingError) throwDatabaseError(existingError, "Gagal memeriksa registrasi sebelumnya.");
      if (!existingRegistration) {
        const byNik = await supabase
          .from("program_registrations")
          .select("*")
          .eq("program_id", programId)
          .eq("nik", profile.nik)
          .maybeSingle();
        if (byNik.error) throwDatabaseError(byNik.error, "Gagal memeriksa registrasi sebelumnya.");
        existingRegistration = byNik.data;
      }

      const { workflow, form } = await loadProgramContext(
        supabase,
        programId,
        profile,
        existingRegistration?.workflow_config_id,
      );
      const expectedFormId = req.body?.expectedFormId ?? req.body?.expected_form_id;
      if (expectedFormId && String(expectedFormId) !== String(workflow.dynamic_form_id)) {
        throw new WorkflowHttpError(
          409,
          "FORM_PROGRAM_MISMATCH",
          "Tautan formulir tidak sesuai dengan program. Buka kembali formulir dari halaman program.",
        );
      }

      const { visibleFields, snapshot } = visibleAnswerSnapshot(form.fields || [], submittedAnswers);
      validateWorkflowAnswers(visibleFields, snapshot);
      const quote = buildRegistrationQuote(workflow, snapshot);
      if (req.body?.clientTotal !== undefined && req.body?.clientTotal !== null) {
        const clientTotal = Number(req.body.clientTotal);
        if (!Number.isSafeInteger(clientTotal) || clientTotal < 0 || clientTotal !== quote.total_amount) {
          throw new WorkflowHttpError(
            409,
            "WORKFLOW_PRICING_STALE",
            "Harga formulir telah diperbarui. Muat ulang halaman sebelum melakukan pembayaran.",
            { authoritative_total: quote.total_amount },
          );
        }
      }
      const answerCanonical = canonicalJson(snapshot);
      const answerHash = crypto.createHash("sha256").update(answerCanonical).digest("hex");

      const answersUnchanged = existingRegistration
        ? canonicalJson(existingRegistration.answers_snapshot || {}) === answerCanonical
        : false;
      if (existingRegistration && !answersUnchanged && existingRegistration.payment_status === "under_review") {
        throw new WorkflowHttpError(409, "PROOF_SUBMITTED_LOCKED", "Jawaban dikunci setelah bukti pembayaran diunggah. Hubungi admin untuk membuka registrasi.");
      }
      if (existingRegistration?.payment_status === "paid" && !answersUnchanged) {
        throw new WorkflowHttpError(409, "PAID_REGISTRATION_LOCKED", "Registrasi yang sudah dibayar tidak dapat diubah.");
      }
      if (existingRegistration && !answersUnchanged) {
        const { data: issuedCoupons, error: couponCountError } = await supabase
          .from("program_coupons")
          .select("id, status")
          .eq("program_registration_id", existingRegistration.id)
          .in("status", ["active", "claimed"]);
        if (couponCountError) throwDatabaseError(couponCountError, "Gagal memeriksa kupon registrasi.");
        if ((issuedCoupons || []).some(coupon => coupon.status === "claimed")) {
          throw new WorkflowHttpError(409, "ENTITLEMENT_REDEEMED_LOCKED", "Registrasi tidak dapat diubah setelah tiket digunakan.");
        }
      }

      if (existingRegistration && answersUnchanged && ["paid", "under_review", "not_required"].includes(existingRegistration.payment_status)) {
        if (existingRegistration.payment_status !== "under_review" && existingRegistration.attendance_status === "attending") {
          await issueRegistrationEntitlements(supabase, existingRegistration, workflow);
        }
        return res.json({
          success: true,
          data: await loadRegistrationDetails(supabase, existingRegistration),
          payment_instructions: existingRegistration.total_amount > 0 ? paymentInstructions(workflow) : null,
          idempotent: true,
        });
      }

      const responseId = existingRegistration?.form_response_id
        || buildDeterministicUuid(`program-response:${programId}:${form.id}:${user.id}`);
      const { error: responseError } = await supabase
        .from("dynamic_form_responses")
        .upsert({ id: responseId, form_id: form.id, user_id: user.id, answers: snapshot }, { onConflict: "id" });
      if (responseError) throwDatabaseError(responseError, "Gagal menyimpan jawaban formulir.");

      const now = new Date().toISOString();
      const registrationStatus = quote.attendance_status === "declined"
        ? "declined"
        : quote.requires_payment ? "payment_pending" : "confirmed";
      const paymentStatus = quote.requires_payment ? "pending" : "not_required";
      const entitlementIssueOptions: EntitlementIssueOptions = existingRegistration?.attendance_status === "declined"
        && quote.attendance_status === "attending"
        ? { recoverExpired: true, recoveryReason: "rsvp_resubmitted_after_decline" }
        : {};
      const registrationPayload = {
        ...(existingRegistration?.id ? { id: existingRegistration.id } : {}),
        program_id: programId,
        workflow_config_id: workflow.id,
        workflow_version: workflow.version,
        dynamic_form_id: form.id,
        form_response_id: responseId,
        user_id: user.id,
        nik: profile.nik,
        attendee_name: profile.name || user.user_metadata?.name || profile.nik,
        attendance_status: quote.attendance_status,
        registration_status: registrationStatus,
        shirt_size: quote.shirt_size,
        is_camping: quote.is_camping,
        family_count: quote.family_count,
        currency: quote.currency,
        subtotal_amount: quote.subtotal_amount,
        total_amount: quote.total_amount,
        payment_status: paymentStatus,
        answers_snapshot: snapshot,
        pricing_snapshot: {
          workflow_config_id: workflow.id,
          workflow_version: workflow.version,
          pricing_rules: workflow.pricing_rules || {},
          calculated_at: now,
        },
        metadata: { answer_hash: answerHash },
        submitted_at: now,
        confirmed_at: registrationStatus === "confirmed" ? now : null,
        cancelled_at: null,
      };
      const { data: registration, error: registrationError } = await supabase
        .from("program_registrations")
        .upsert(registrationPayload, { onConflict: existingRegistration?.id ? "id" : "program_id,nik" })
        .select()
        .single();
      if (registrationError) throwDatabaseError(registrationError, "Gagal menyimpan registrasi program.");

      if (quote.attendance_status === "declined" && existingRegistration?.id) {
        const { error: revokeError } = await supabase
          .from("program_coupons")
          .update({ status: "expired" })
          .eq("program_registration_id", existingRegistration.id)
          .eq("status", "active");
        if (revokeError) throwDatabaseError(revokeError, "Gagal menonaktifkan tiket registrasi lama.");
      }

      if (quote.attendance_status === "declined" || quote.requires_payment) {
        await expireUnlinkedLegacyEntitlements(
          supabase,
          registration,
          quote.attendance_status === "declined" ? "rsvp_declined" : "payment_required",
        );
      }

      if (existingRegistration?.payment_status !== "paid") {
        const { error: deleteItemsError } = await supabase
          .from("program_registration_items")
          .delete()
          .eq("registration_id", registration.id);
        if (deleteItemsError) throwDatabaseError(deleteItemsError, "Gagal memperbarui rincian biaya.");
        if (quote.items.length > 0) {
          const { error: itemError } = await supabase
            .from("program_registration_items")
            .insert(quoteItemsForInsert(registration.id, quote.items));
          if (itemError) throwDatabaseError(itemError, "Gagal menyimpan rincian biaya.");
        }
      }

      let payment = null;
      if (quote.requires_payment) {
        payment = await createOrReusePendingPayment(supabase, registration, workflow, answerHash, submittedAnswers._payment_method);
        await issueRegistrationEntitlements(supabase, registration, workflow, entitlementIssueOptions);
      } else {
        const { error: cancelPaymentError } = await supabase
          .from("program_registration_payments")
          .update({ status: "cancelled" })
          .eq("registration_id", registration.id)
          .in("status", ["pending", "under_review", "failed", "rejected"]);
        if (cancelPaymentError) throwDatabaseError(cancelPaymentError, "Gagal menutup pembayaran lama.");
        if (quote.attendance_status === "attending") {
          await issueRegistrationEntitlements(supabase, registration, workflow, entitlementIssueOptions);
        }
      }

      const details = await loadRegistrationDetails(supabase, registration);
      return res.status(existingRegistration ? 200 : 201).json({
        success: true,
        data: details,
        payment: payment ? { ...payment, provider_payload: undefined } : null,
        payment_instructions: quote.requires_payment ? paymentInstructions(workflow) : null,
        idempotent: Boolean(existingRegistration && answersUnchanged),
      });
    } catch (error) {
      return sendWorkflowError(res, error);
    }
  });

  app.get("/api/portal/programs/:programId/registration-v2", async (req: any, res: any) => {
    try {
      const { programId } = req.params;
      if (!isUuid(programId)) throw new WorkflowHttpError(400, "INVALID_PROGRAM_ID", "ID program tidak valid.");
      const user = await authenticateRequest(supabase, req);
      const profile = await getProfile(supabase, user);
      let { data: registration, error } = await supabase
        .from("program_registrations")
        .select("*")
        .eq("program_id", programId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throwDatabaseError(error, "Gagal memuat status registrasi.");
      if (!registration && profile.nik) {
        const byNik = await supabase
          .from("program_registrations")
          .select("*")
          .eq("program_id", programId)
          .eq("nik", profile.nik)
          .maybeSingle();
        if (byNik.error) throwDatabaseError(byNik.error, "Gagal memuat status registrasi.");
        registration = byNik.data;
      }

      // Reuse the same authoritative program/eligibility/form validation as
      // submit, while still allowing an existing participant to view status
      // after the RSVP deadline has passed.
      const { workflow } = await loadProgramContext(
        supabase,
        programId,
        profile,
        registration?.workflow_config_id,
        { enforceDeadline: false },
      );

      let details = registration ? await loadRegistrationDetails(supabase, registration) : null;
      if (registration && details) {
        let ticketIntegrity = summarizeRegistrationTicketIntegrity(registration, workflow, details.coupons || []);
        if (ticketIntegrity.repairable) {
          try {
            await issueRegistrationEntitlements(supabase, registration, workflow);
            details = await loadRegistrationDetails(supabase, registration);
            ticketIntegrity = summarizeRegistrationTicketIntegrity(registration, workflow, details.coupons || []);
          } catch (repairError) {
            console.error("[ProgramWorkflowV2] Entitlement self-heal failed:", repairError);
          }
        }
        details.ticket_integrity = ticketIntegrity;
      }
      return res.json({
        success: true,
        data: details,
        workflow_pricing: workflowPricingForClient(workflow),
        payment_instructions: !registration || Number(registration.total_amount) > 0
          ? paymentInstructions(workflow)
          : null,
        participant: { nik: profile.nik, name: profile.name },
      });
    } catch (error) {
      return sendWorkflowError(res, error);
    }
  });

  app.post("/api/portal/programs/:programId/registration-v2/payment-proof", async (req: any, res: any) => {
    try {
      const { programId } = req.params;
      if (!isUuid(programId)) throw new WorkflowHttpError(400, "INVALID_PROGRAM_ID", "ID program tidak valid.");
      const user = await authenticateRequest(supabase, req);
      const proofUrl = sanitizeProofReference(req.body?.proofUrl || req.body?.proof_url);
      const paymentId = req.body?.paymentId || req.body?.payment_id;
      if (paymentId && !isUuid(paymentId)) throw new WorkflowHttpError(400, "INVALID_PAYMENT_ID", "ID pembayaran tidak valid.");

      const { data: registration, error: registrationError } = await supabase
        .from("program_registrations")
        .select("*")
        .eq("program_id", programId)
        .eq("user_id", user.id)
        .single();
      if (registrationError || !registration) {
        if (registrationError?.code === "PGRST116") throw new WorkflowHttpError(404, "REGISTRATION_NOT_FOUND", "Registrasi belum dibuat.");
        throwDatabaseError(registrationError, "Gagal memuat registrasi.");
      }
      if (registration.attendance_status !== "attending" || Number(registration.total_amount) <= 0) {
        throw new WorkflowHttpError(409, "PAYMENT_NOT_REQUIRED", "Registrasi ini tidak memerlukan pembayaran.");
      }
      if (registration.payment_status === "paid") {
        throw new WorkflowHttpError(409, "PAYMENT_ALREADY_PAID", "Pembayaran sudah disetujui.");
      }
      if (!await programAllowsEntitlementIssuance(supabase, registration.program_id)) {
        throw new WorkflowHttpError(409, "PROGRAM_CLOSED", "Bukti pembayaran tidak dapat diproses karena program sudah ditutup atau berakhir.");
      }

      let paymentQuery = supabase
        .from("program_registration_payments")
        .select("*")
        .eq("registration_id", registration.id);
      paymentQuery = paymentId
        ? paymentQuery.eq("id", paymentId)
        : paymentQuery.order("created_at", { ascending: false }).limit(1);
      const { data: payment, error: paymentError } = await paymentQuery.maybeSingle();
      if (paymentError) throwDatabaseError(paymentError, "Gagal memuat pembayaran.");
      if (!payment) throw new WorkflowHttpError(404, "PAYMENT_NOT_FOUND", "Pembayaran belum dibuat.");
      if (payment.status === "paid") throw new WorkflowHttpError(409, "PAYMENT_ALREADY_PAID", "Pembayaran sudah disetujui.");
      if (["cancelled", "refunded"].includes(payment.status)) {
        throw new WorkflowHttpError(409, "PAYMENT_NOT_SUBMITTABLE", "Pembayaran ini sudah ditutup. Kirim ulang registrasi untuk membuat tagihan baru.");
      }

      const declaredAmount = req.body?.declaredAmount ?? req.body?.declared_amount;
      const proofMetadata = {
        ...(isPlainObject(payment.proof_metadata) ? payment.proof_metadata : {}),
        submitted_at: new Date().toISOString(),
        submitted_by: user.id,
        ...(declaredAmount !== undefined ? { declared_amount: safeMoney(declaredAmount, "nominal bukti") } : {}),
      };
      const { data: updatedPayment, error: updateError } = await supabase
        .from("program_registration_payments")
        .update({ proof_url: proofUrl, proof_metadata: proofMetadata, status: "under_review" })
        .eq("id", payment.id)
        .eq("registration_id", registration.id)
        .select("id, registration_id, payment_method, provider, reference_id, expected_amount, paid_amount, currency, status, proof_url, proof_metadata, created_at, updated_at")
        .single();
      if (updateError) throwDatabaseError(updateError, "Gagal menyimpan bukti pembayaran.");
      const { error: registrationUpdateError } = await supabase
        .from("program_registrations")
        .update({ payment_status: "under_review", registration_status: "payment_review" })
        .eq("id", registration.id);
      if (registrationUpdateError) throwDatabaseError(registrationUpdateError, "Gagal memperbarui status registrasi.");

      const { data: workflow, error: workflowError } = await supabase
        .from("program_workflow_configs")
        .select("*")
        .eq("id", registration.workflow_config_id)
        .maybeSingle();
      if (workflowError) throwDatabaseError(workflowError, "Gagal memuat workflow pembayaran.");
      if (!workflow) throw new WorkflowHttpError(409, "WORKFLOW_NOT_FOUND", "Workflow pembayaran tidak ditemukan.");
      const verifyWithAi = paymentInstructions(workflow).verify_with_ai !== false;

      if (!verifyWithAi) {
        return res.json({ success: true, data: updatedPayment, message: "Bukti pembayaran menunggu verifikasi admin." });
      }

      const expectedAmount = Number(payment.expected_amount || registration.total_amount || 0);
      const aiVerification = await validateProgramPaymentProofWithKioskRules(groq, supabase, proofUrl, expectedAmount);
      const aiMetadata = {
        ...(isPlainObject(updatedPayment.proof_metadata) ? updatedPayment.proof_metadata : proofMetadata),
        ai_verification: aiVerification,
      };

      if (aiVerification.valid) {
        const now = new Date().toISOString();
        const { data: paidPayment, error: paidPaymentError } = await supabase
          .from("program_registration_payments")
          .update({
            status: "paid",
            paid_amount: expectedAmount,
            paid_at: now,
            verified_at: now,
            verified_by: null,
            proof_metadata: reviewHistory(aiMetadata, {
              action: "approved_by_ai",
              at: now,
              by: "groq",
              note: aiVerification.reason,
            }),
          })
          .eq("id", payment.id)
          .eq("registration_id", registration.id)
          .select("id, registration_id, payment_method, provider, reference_id, expected_amount, paid_amount, currency, status, proof_url, proof_metadata, verified_at, paid_at, created_at, updated_at")
          .single();
        if (paidPaymentError) throwDatabaseError(paidPaymentError, "Gagal menyetujui pembayaran otomatis.");

        const { data: confirmedRegistration, error: confirmError } = await supabase
          .from("program_registrations")
          .update({ payment_status: "paid", registration_status: "confirmed", confirmed_at: now })
          .eq("id", registration.id)
          .select()
          .single();
        if (confirmError) throwDatabaseError(confirmError, "Gagal mengonfirmasi registrasi.");
        await issueRegistrationEntitlements(supabase, confirmedRegistration, workflow);

        if (sendNotification && confirmedRegistration.user_id) {
          await sendNotification(confirmedRegistration.user_id, {
            type: "program",
            title: "Pembayaran Program Terverifikasi AI",
            message: "Bukti pembayaran Anda berhasil diverifikasi otomatis. Tiket dan kupon sudah aktif.",
            path: "/portal/program",
          }).catch((error: any) => console.error("[ProgramWorkflowV2] Notification failed:", error));
        }

        return res.json({
          success: true,
          data: paidPayment,
          registration: await loadRegistrationDetails(supabase, confirmedRegistration),
          ai_verified: true,
          message: "Bukti pembayaran berhasil diverifikasi AI Groq. Tiket dan kupon sudah aktif.",
        });
      }

      if (aiVerification.fallback_to_manual) {
        const { data: manualReviewPayment, error: manualReviewError } = await supabase
          .from("program_registration_payments")
          .update({ proof_metadata: aiMetadata, status: "under_review" })
          .eq("id", payment.id)
          .select("id, registration_id, payment_method, provider, reference_id, expected_amount, paid_amount, currency, status, proof_url, proof_metadata, created_at, updated_at")
          .single();
        if (manualReviewError) throwDatabaseError(manualReviewError, "Gagal menyimpan hasil verifikasi AI.");
        return res.json({
          success: true,
          data: manualReviewPayment,
          ai_verified: false,
          fallback_to_manual: true,
          message: aiVerification.reason || "AI belum dapat memastikan bukti pembayaran. Bukti menunggu verifikasi admin.",
        });
      }

      const rejectedMetadata = reviewHistory(aiMetadata, {
        action: "rejected_by_ai",
        at: new Date().toISOString(),
        by: "groq",
        note: aiVerification.reason,
      });
      const { error: rejectPaymentError } = await supabase
        .from("program_registration_payments")
        .update({ status: "rejected", proof_metadata: rejectedMetadata })
        .eq("id", payment.id);
      if (rejectPaymentError) throwDatabaseError(rejectPaymentError, "Gagal menyimpan hasil penolakan AI.");
      const { error: rejectRegistrationError } = await supabase
        .from("program_registrations")
        .update({ payment_status: "failed", registration_status: "payment_rejected", confirmed_at: null })
        .eq("id", registration.id);
      if (rejectRegistrationError) throwDatabaseError(rejectRegistrationError, "Gagal memperbarui status registrasi.");

      throw new WorkflowHttpError(422, "AI_PAYMENT_PROOF_REJECTED", `Bukti pembayaran tidak valid: ${aiVerification.reason}`);
    } catch (error) {
      return sendWorkflowError(res, error);
    }
  });

  app.post("/api/admin/program-registrations-v2/:registrationId/unlock", async (req: any, res: any) => {
    try {
      const { registrationId } = req.params;
      if (!isUuid(registrationId)) throw new WorkflowHttpError(400, "INVALID_ID", "ID registrasi tidak valid.");
      const reason = String(req.body?.reason || "").trim();
      if (reason.length < 3 || reason.length > 500) {
        throw new WorkflowHttpError(400, "UNLOCK_REASON_REQUIRED", "Alasan membuka registrasi wajib diisi.");
      }
      const { user: admin } = await requireAdmin(supabase, req);
      const { data: registration, error: registrationError } = await supabase
        .from("program_registrations")
        .select("*")
        .eq("id", registrationId)
        .single();
      if (registrationError || !registration) {
        if (registrationError?.code === "PGRST116") throw new WorkflowHttpError(404, "REGISTRATION_NOT_FOUND", "Registrasi tidak ditemukan.");
        throwDatabaseError(registrationError, "Gagal memuat registrasi.");
      }
      if (registration.payment_status === "paid") {
        throw new WorkflowHttpError(409, "PAID_UNLOCK_REQUIRES_REFUND", "Registrasi berbayar yang sudah disetujui harus melalui proses koreksi/refund terpisah.");
      }

      const { data: issuedCoupons, error: couponError } = await supabase
        .from("program_coupons")
        .select("id, status, metadata")
        .eq("program_registration_id", registration.id);
      if (couponError) throwDatabaseError(couponError, "Gagal memeriksa kupon registrasi.");
      if ((issuedCoupons || []).some(coupon => coupon.status === "claimed")) {
        throw new WorkflowHttpError(409, "CLAIMED_ENTITLEMENT_LOCKED", "Registrasi memiliki QR yang sudah dipakai dan tidak dapat dibuka tanpa koreksi scan.");
      }
      for (const coupon of issuedCoupons || []) {
        const metadata = {
          ...(isPlainObject(coupon.metadata) ? coupon.metadata : {}),
          workflow_v2_unlinked_at: new Date().toISOString(),
          workflow_v2_unlinked_by: admin.id,
          workflow_v2_unlink_reason: reason,
          previous_registration_id: registration.id,
        };
        const { error: couponUpdateError } = await supabase
          .from("program_coupons")
          .update({
            status: "expired",
            program_registration_id: null,
            beneficiary_type: null,
            beneficiary_index: null,
            entitlement_code: null,
            metadata,
          })
          .eq("id", coupon.id);
        if (couponUpdateError) throwDatabaseError(couponUpdateError, "Gagal menonaktifkan kupon lama.");
      }

      const now = new Date().toISOString();
      const { error: paymentCancelError } = await supabase
        .from("program_registration_payments")
        .update({ status: "cancelled", verified_at: now, verified_by: admin.id })
        .eq("registration_id", registration.id)
        .in("status", ["pending", "under_review", "rejected", "failed"]);
      if (paymentCancelError) throwDatabaseError(paymentCancelError, "Gagal menutup pembayaran lama.");

      const unlockHistory = Array.isArray(registration.metadata?.unlock_history)
        ? registration.metadata.unlock_history.slice(-19)
        : [];
      const metadata = {
        ...(isPlainObject(registration.metadata) ? registration.metadata : {}),
        unlocked_for_editing: true,
        unlock_history: [...unlockHistory, { at: now, by: admin.id, reason }],
      };
      const { data: unlocked, error: unlockError } = await supabase
        .from("program_registrations")
        .update({
          registration_status: "draft",
          payment_status: Number(registration.total_amount) > 0 ? "failed" : "not_required",
          confirmed_at: null,
          metadata,
        })
        .eq("id", registration.id)
        .select()
        .single();
      if (unlockError) throwDatabaseError(unlockError, "Gagal membuka registrasi.");
      return res.json({ success: true, data: await loadRegistrationDetails(supabase, unlocked), message: "Registrasi dibuka kembali untuk diedit peserta." });
    } catch (error) {
      return sendWorkflowError(res, error);
    }
  });

  // Explicit correction flow for a falsely claimed/legacy QR. Keeps audit history,
  // expires every old entitlement, and lets the participant submit again.
  app.post("/api/admin/program-registrations-v2/:registrationId/correct-claimed", async (req: any, res: any) => {
    try {
      const { user: admin } = await requireAdmin(supabase, req);
      const reason = String(req.body?.reason || '').trim();
      if (reason.length < 5) throw new WorkflowHttpError(400, 'CORRECTION_REASON_REQUIRED', 'Alasan koreksi wajib diisi minimal 5 karakter.');
      const { data: registration, error } = await supabase.from('program_registrations').select('*').eq('id', req.params.registrationId).single();
      if (error || !registration) throw new WorkflowHttpError(404, 'REGISTRATION_NOT_FOUND', 'Registrasi tidak ditemukan.');
      const now = new Date().toISOString();
      const { data: coupons, error: couponError } = await supabase.from('program_coupons').select('id,metadata,status').eq('program_registration_id', registration.id);
      if (couponError) throwDatabaseError(couponError, 'Gagal memuat tiket lama.');
      for (const coupon of coupons || []) {
        const metadata = { ...(isPlainObject(coupon.metadata) ? coupon.metadata : {}), correction_reason: reason, corrected_at: now, corrected_by: admin.id, previous_status: coupon.status };
        const { error: updateError } = await supabase.from('program_coupons').update({ status: 'expired', metadata }).eq('id', coupon.id);
        if (updateError) throwDatabaseError(updateError, 'Gagal menonaktifkan tiket lama.');
      }
      const history = Array.isArray(registration.metadata?.correction_history) ? registration.metadata.correction_history.slice(-19) : [];
      const { data: updated, error: updateRegistrationError } = await supabase.from('program_registrations').update({ registration_status: 'draft', payment_status: 'not_required', confirmed_at: null, metadata: { ...(registration.metadata || {}), corrected_for_resubmit: true, correction_history: [...history, { at: now, by: admin.id, reason }] } }).eq('id', registration.id).select().single();
      if (updateRegistrationError) throwDatabaseError(updateRegistrationError, 'Gagal membuka ulang registrasi.');
      return res.json({ success: true, data: await loadRegistrationDetails(supabase, updated), expired_coupon_count: (coupons || []).length });
    } catch (error) { return sendWorkflowError(res, error); }
  });

  app.post("/api/admin/program-registrations-v2/:registrationId/reconcile-entitlements", async (req: any, res: any) => {
    try {
      const { registrationId } = req.params;
      if (!isUuid(registrationId)) throw new WorkflowHttpError(400, "INVALID_ID", "ID registrasi tidak valid.");
      const reason = String(req.body?.reason || "").trim();
      if (reason.length < 3 || reason.length > 500) {
        throw new WorkflowHttpError(400, "RECONCILIATION_REASON_REQUIRED", "Alasan rekonsiliasi tiket wajib diisi.");
      }
      const { user: admin } = await requireAdmin(supabase, req);
      const { data: registration, error: registrationError } = await supabase
        .from("program_registrations")
        .select("*")
        .eq("id", registrationId)
        .single();
      if (registrationError || !registration) {
        if (registrationError?.code === "PGRST116") throw new WorkflowHttpError(404, "REGISTRATION_NOT_FOUND", "Registrasi tidak ditemukan.");
        throwDatabaseError(registrationError, "Gagal memuat registrasi.");
      }
      if (registration.attendance_status !== "attending") {
        throw new WorkflowHttpError(409, "ENTITLEMENT_NOT_APPLICABLE", "Tiket hanya diterbitkan untuk peserta yang hadir.");
      }
      if (!await programAllowsEntitlementIssuance(supabase, registration.program_id)) {
        throw new WorkflowHttpError(409, "PROGRAM_CLOSED", "Tiket tidak dapat diterbitkan karena program tidak aktif, belum published, atau sudah berakhir.");
      }

      const { data: workflow, error: workflowError } = await supabase
        .from("program_workflow_configs")
        .select("*")
        .eq("id", registration.workflow_config_id)
        .single();
      if (workflowError || !workflow) throwDatabaseError(workflowError, "Gagal memuat workflow registrasi.");

      const beforeDetails = await loadRegistrationDetails(supabase, registration);
      const before = summarizeRegistrationTicketIntegrity(registration, workflow, beforeDetails.coupons || []);
      if (!before.repairable) {
        if (before.missing_count > 0 && before.status !== "waiting_payment") {
          throw new WorkflowHttpError(
            409,
            "ENTITLEMENT_REPAIR_NOT_ALLOWED",
            "Status registrasi belum mengizinkan penerbitan ulang tiket.",
          );
        }
        if (before.missing_count === 0) {
          await appendEntitlementReconciliationAudit(supabase, registration.id, {
            at: new Date().toISOString(),
            by: admin.id,
            reason,
            outcome: "verified_complete",
            missing_before: 0,
            issued_after: before.issued_count,
          });
        }
        return res.json({
          success: true,
          idempotent: true,
          data: { ...beforeDetails, ticket_integrity: before },
          message: before.status === "waiting_payment"
            ? "Tiket keluarga masih menunggu penyelesaian pembayaran."
            : "Seluruh tiket yang diwajibkan sudah lengkap.",
        });
      }

      await appendEntitlementReconciliationAudit(supabase, registration.id, {
        at: new Date().toISOString(),
        by: admin.id,
        reason,
        outcome: "started",
        missing_before: before.missing_count,
        issued_before: before.issued_count,
      });
      await issueRegistrationEntitlements(supabase, registration, workflow, {
        recoverInactive: true,
        recoveryReason: reason,
        recoveryActorId: admin.id,
      });
      const afterDetails = await loadRegistrationDetails(supabase, registration);
      const after = summarizeRegistrationTicketIntegrity(registration, workflow, afterDetails.coupons || []);
      if (after.missing_count > 0) {
        throw new WorkflowHttpError(500, "ENTITLEMENT_RECONCILIATION_INCOMPLETE", "Sebagian tiket masih belum berhasil diterbitkan.");
      }

      await appendEntitlementReconciliationAudit(supabase, registration.id, {
        at: new Date().toISOString(),
        by: admin.id,
        reason,
        outcome: "completed",
        missing_before: before.missing_count,
        issued_after: after.issued_count,
      });

      return res.json({
        success: true,
        idempotent: false,
        data: { ...afterDetails, ticket_integrity: after },
        message: `${before.missing_count} tiket yang hilang berhasil diterbitkan tanpa duplikasi.`,
      });
    } catch (error) {
      return sendWorkflowError(res, error);
    }
  });

  app.get("/api/admin/program-registrations-v2", async (req: any, res: any) => {
    try {
      await requireAdmin(supabase, req);
      const programId = req.query.programId || req.query.program_id;
      const attendanceStatus = req.query.attendanceStatus || req.query.attendance_status;
      const paymentStatus = req.query.paymentStatus || req.query.payment_status;
      const registrationStatus = req.query.registrationStatus || req.query.registration_status;
      const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
      const offset = Math.max(Number(req.query.offset) || 0, 0);
      if (programId && !isUuid(programId)) throw new WorkflowHttpError(400, "INVALID_PROGRAM_ID", "ID program tidak valid.");

      let query = supabase
        .from("program_registrations")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);
      if (programId) query = query.eq("program_id", programId);
      if (attendanceStatus) query = query.eq("attendance_status", attendanceStatus);
      if (paymentStatus) query = query.eq("payment_status", paymentStatus);
      if (registrationStatus) query = query.eq("registration_status", registrationStatus);
      const { data: registrations, error, count } = await query;
      if (error) throwDatabaseError(error, "Gagal memuat daftar registrasi.");

      const enriched = await loadRegistrationBatchDetails(supabase, registrations || []);
      return res.json({ success: true, data: enriched, pagination: { count: count || 0, limit, offset } });
    } catch (error) {
      return sendWorkflowError(res, error);
    }
  });

  app.post("/api/admin/program-registrations-v2/:registrationId/payments/:paymentId/approve", async (req: any, res: any) => {
    try {
      const { registrationId, paymentId } = req.params;
      if (!isUuid(registrationId) || !isUuid(paymentId)) {
        throw new WorkflowHttpError(400, "INVALID_ID", "ID registrasi atau pembayaran tidak valid.");
      }
      const { user: admin } = await requireAdmin(supabase, req);
      const { data: registration, error: registrationError } = await supabase
        .from("program_registrations")
        .select("*")
        .eq("id", registrationId)
        .single();
      if (registrationError || !registration) {
        if (registrationError?.code === "PGRST116") throw new WorkflowHttpError(404, "REGISTRATION_NOT_FOUND", "Registrasi tidak ditemukan.");
        throwDatabaseError(registrationError, "Gagal memuat registrasi.");
      }
      if (!await programAllowsEntitlementIssuance(supabase, registration.program_id)) {
        throw new WorkflowHttpError(409, "PROGRAM_CLOSED", "Pembayaran tidak dapat disetujui karena program sudah ditutup atau berakhir.");
      }
      const { data: payment, error: paymentError } = await supabase
        .from("program_registration_payments")
        .select("*")
        .eq("id", paymentId)
        .eq("registration_id", registrationId)
        .single();
      if (paymentError || !payment) {
        if (paymentError?.code === "PGRST116") throw new WorkflowHttpError(404, "PAYMENT_NOT_FOUND", "Pembayaran tidak ditemukan.");
        throwDatabaseError(paymentError, "Gagal memuat pembayaran.");
      }
      if (["cancelled", "refunded"].includes(payment.status)) {
        throw new WorkflowHttpError(409, "PAYMENT_NOT_APPROVABLE", "Pembayaran tidak dapat disetujui dari status saat ini.");
      }
      if (payment.status !== "paid" && (payment.status !== "under_review" || !payment.proof_url)) {
        throw new WorkflowHttpError(409, "PAYMENT_PROOF_NOT_REVIEWED", "Bukti pembayaran belum siap disetujui.");
      }
      if (registration.attendance_status !== "attending" || Number(registration.total_amount) <= 0) {
        throw new WorkflowHttpError(409, "PAYMENT_NOT_REQUIRED", "Registrasi ini tidak memerlukan persetujuan pembayaran.");
      }
      if (Number(payment.expected_amount) !== Number(registration.total_amount)) {
        throw new WorkflowHttpError(409, "STALE_PAYMENT", "Nominal pembayaran tidak lagi sesuai dengan registrasi terbaru.");
      }

      const paidAmount = safeMoney(req.body?.paidAmount ?? req.body?.paid_amount ?? payment.expected_amount, "pembayaran");
      if (paidAmount < Number(payment.expected_amount)) {
        throw new WorkflowHttpError(422, "UNDERPAID", "Nominal pembayaran kurang dari total tagihan.");
      }
      const now = new Date().toISOString();
      if (payment.status !== "paid") {
        const proofMetadata = reviewHistory(payment.proof_metadata, {
          action: "approved",
          at: now,
          by: admin.id,
          note: String(req.body?.note || "").slice(0, 500),
        });
        const { error: approveError } = await supabase
          .from("program_registration_payments")
          .update({
            status: "paid",
            paid_amount: paidAmount,
            paid_at: now,
            verified_at: now,
            verified_by: admin.id,
            proof_metadata: proofMetadata,
          })
          .eq("id", payment.id);
        if (approveError) throwDatabaseError(approveError, "Gagal menyetujui pembayaran.");
      }

      const { data: confirmedRegistration, error: confirmError } = await supabase
        .from("program_registrations")
        .update({ payment_status: "paid", registration_status: "confirmed", confirmed_at: now })
        .eq("id", registration.id)
        .select()
        .single();
      if (confirmError) throwDatabaseError(confirmError, "Gagal mengonfirmasi registrasi.");
      const { data: workflow, error: workflowError } = await supabase
        .from("program_workflow_configs")
        .select("*")
        .eq("id", confirmedRegistration.workflow_config_id)
        .single();
      if (workflowError || !workflow) throwDatabaseError(workflowError, "Gagal memuat workflow registrasi.");
      await issueRegistrationEntitlements(supabase, confirmedRegistration, workflow);

      if (sendNotification && confirmedRegistration.user_id) {
        await sendNotification(confirmedRegistration.user_id, {
          type: "program",
          title: "Pembayaran Program Disetujui",
          message: "Pembayaran Anda telah diverifikasi. Tiket dan kupon makan sudah aktif.",
          path: "/portal/program",
        }).catch((error: any) => console.error("[ProgramWorkflowV2] Notification failed:", error));
      }
      return res.json({
        success: true,
        data: await loadRegistrationDetails(supabase, confirmedRegistration),
        idempotent: payment.status === "paid",
      });
    } catch (error) {
      return sendWorkflowError(res, error);
    }
  });

  app.post("/api/admin/program-registrations-v2/:registrationId/payments/:paymentId/reject", async (req: any, res: any) => {
    try {
      const { registrationId, paymentId } = req.params;
      if (!isUuid(registrationId) || !isUuid(paymentId)) {
        throw new WorkflowHttpError(400, "INVALID_ID", "ID registrasi atau pembayaran tidak valid.");
      }
      const reason = String(req.body?.reason || "").trim();
      if (reason.length < 3 || reason.length > 500) {
        throw new WorkflowHttpError(400, "REJECTION_REASON_REQUIRED", "Alasan penolakan wajib diisi.");
      }
      const { user: admin } = await requireAdmin(supabase, req);
      const { data: payment, error: paymentError } = await supabase
        .from("program_registration_payments")
        .select("*")
        .eq("id", paymentId)
        .eq("registration_id", registrationId)
        .single();
      if (paymentError || !payment) {
        if (paymentError?.code === "PGRST116") throw new WorkflowHttpError(404, "PAYMENT_NOT_FOUND", "Pembayaran tidak ditemukan.");
        throwDatabaseError(paymentError, "Gagal memuat pembayaran.");
      }
      if (payment.status === "paid") {
        throw new WorkflowHttpError(409, "PAID_PAYMENT_LOCKED", "Pembayaran yang sudah disetujui tidak dapat ditolak.");
      }

      const now = new Date().toISOString();
      const proofMetadata = reviewHistory(payment.proof_metadata, {
        action: "rejected",
        reason,
        at: now,
        by: admin.id,
      });
      const { data: rejectedPayment, error: rejectError } = await supabase
        .from("program_registration_payments")
        .update({
          status: "rejected",
          verified_at: now,
          verified_by: admin.id,
          proof_metadata: proofMetadata,
        })
        .eq("id", payment.id)
        .select("id, registration_id, payment_method, provider, reference_id, expected_amount, currency, status, proof_url, proof_metadata, verified_by, verified_at, created_at, updated_at")
        .single();
      if (rejectError) throwDatabaseError(rejectError, "Gagal menolak pembayaran.");
      const { data: registration, error: registrationError } = await supabase
        .from("program_registrations")
        .update({ payment_status: "failed", registration_status: "payment_rejected", confirmed_at: null })
        .eq("id", registrationId)
        .select()
        .single();
      if (registrationError) throwDatabaseError(registrationError, "Gagal memperbarui registrasi.");

      if (sendNotification && registration.user_id) {
        await sendNotification(registration.user_id, {
          type: "program",
          title: "Bukti Pembayaran Ditolak",
          message: `Bukti pembayaran perlu diperbaiki: ${reason}`,
          path: "/portal/program",
        }).catch((error: any) => console.error("[ProgramWorkflowV2] Notification failed:", error));
      }
      return res.json({ success: true, data: rejectedPayment, message: "Pembayaran ditolak dan dapat dikirim ulang." });
    } catch (error) {
      return sendWorkflowError(res, error);
    }
  });
}
