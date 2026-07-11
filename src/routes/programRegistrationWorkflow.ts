// @ts-nocheck
import crypto from "node:crypto";

const MAX_ANSWER_FIELDS = 150;
const MAX_ANSWER_BYTES = 150_000;
const MAX_FAMILY_MEMBERS_HARD_LIMIT = 20;
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
  if (isCamping && bringingFamilyFieldId) {
    const familyDecision = parseDecision(workflow, "bringing_family", answers[bringingFamilyFieldId]);
    if (familyDecision === null) {
      throw new WorkflowHttpError(422, "MISSING_FAMILY_DECISION", "Pilihan membawa keluarga wajib dijawab.");
    }
    bringingFamily = familyDecision;
  }

  let familyCount = 0;
  const familyCountFieldId = bindingFieldId(workflow, "family_count");
  if (isCamping && (bringingFamily || (!bringingFamilyFieldId && hasAnswer(boundAnswer(workflow, answers, "family_count"))))) {
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

    const entryPrice = safeMoney(pricingRules?.family?.entry_unit_price ?? 0, "tiket keluarga");
    const mealPrice = safeMoney(pricingRules?.family?.meal_unit_price ?? 0, "makan keluarga");
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
  const visibleFields = getVisibleWorkflowFields(fields, answers);
  const snapshot: Record<string, any> = {};
  for (const field of visibleFields) {
    if (Object.prototype.hasOwnProperty.call(answers, field.id)) snapshot[field.id] = answers[field.id];
  }
  return { visibleFields, snapshot };
}

function validateRequiredFields(visibleFields: any[], answers: Record<string, any>) {
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

function paymentInstructions(workflow: any) {
  const rules = isPlainObject(workflow?.payment_rules) ? workflow.payment_rules : {};
  return {
    provider: String(rules.provider || "manual"),
    method: String(rules.method || "manual_transfer"),
    qris_image_url: typeof rules.qris_image_url === "string" ? rules.qris_image_url : null,
    account_name: typeof rules.account_name === "string" ? rules.account_name : null,
    account_number: typeof rules.account_number === "string" ? rules.account_number : null,
    instructions: typeof rules.instructions === "string" ? rules.instructions : null,
    proof_required: rules.proof_required !== false,
  };
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

async function loadProgramContext(supabase: any, programId: string, profile: any) {
  const { data: program, error: programError } = await supabase
    .from("union_programs")
    .select("id, name, is_active, is_targeted, start_date, end_date, dynamic_form_id")
    .eq("id", programId)
    .single();
  if (programError || !program) {
    if (programError?.code === "PGRST116") throw new WorkflowHttpError(404, "PROGRAM_NOT_FOUND", "Program tidak ditemukan.");
    throwDatabaseError(programError, "Gagal memuat program.");
  }
  if (!program.is_active || isProgramExpired(program.end_date)) {
    throw new WorkflowHttpError(409, "PROGRAM_CLOSED", "Program sudah ditutup atau melewati batas waktu.");
  }

  if (program.is_targeted) {
    const { data: eligible, error: eligibilityError } = await supabase
      .from("program_eligibility")
      .select("nik")
      .eq("program_id", programId)
      .eq("nik", profile.nik)
      .maybeSingle();
    if (eligibilityError) throwDatabaseError(eligibilityError, "Gagal memvalidasi peserta program.");
    if (!eligible) throw new WorkflowHttpError(403, "NOT_ELIGIBLE", "Anda tidak terdaftar sebagai peserta program ini.");
  }

  const { data: workflow, error: workflowError } = await supabase
    .from("program_workflow_configs")
    .select("*")
    .eq("program_id", programId)
    .eq("is_active", true)
    .maybeSingle();
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
  if (targetNiks.length > 0 || targetDepartments.length > 0) {
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

  return { program, workflow, form };
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
  const [itemsResult, paymentsResult, couponsResult, programsResult] = await Promise.all([
    supabase.from("program_registration_items").select("*").in("registration_id", ids).order("created_at"),
    supabase.from("program_registration_payments")
      .select("id, registration_id, payment_method, provider, reference_id, expected_amount, paid_amount, currency, status, proof_url, proof_metadata, provider_transaction_id, verified_by, verified_at, paid_at, expires_at, created_at, updated_at")
      .in("registration_id", ids)
      .order("created_at", { ascending: false }),
    supabase.from("program_coupons").select("*").in("program_registration_id", ids).order("issued_at"),
    supabase.from("union_programs").select("id, name").in("id", programIds),
  ]);
  if (itemsResult.error) throwDatabaseError(itemsResult.error, "Gagal memuat rincian biaya.");
  if (paymentsResult.error) throwDatabaseError(paymentsResult.error, "Gagal memuat pembayaran.");
  if (couponsResult.error) throwDatabaseError(couponsResult.error, "Gagal memuat kupon.");
  if (programsResult.error) throwDatabaseError(programsResult.error, "Gagal memuat nama program.");

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
  return registrations.map(registration => ({
    ...registration,
    program: programs.get(registration.program_id) || null,
    items: items.get(registration.id) || [],
    payments: payments.get(registration.id) || [],
    coupons: coupons.get(registration.id) || [],
  }));
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

function familyBeneficiaryName(registration: any, workflow: any, index: number): string {
  const familyFieldId = bindingFieldId(workflow, "family_count");
  const rows = familyFieldId && Array.isArray(registration?.answers_snapshot?.[familyFieldId])
    ? registration.answers_snapshot[familyFieldId]
    : [];
  const row = rows[index - 1];
  const configuredName = isPlainObject(row) ? String(row.name || row.nama || "").trim() : "";
  return configuredName || `Keluarga ${index} - ${registration.attendee_name || registration.nik}`;
}

function couponKey(row: any) {
  return `${row.entitlement_code}:${row.beneficiary_type}:${row.beneficiary_index || 0}`;
}

function legacyEntitlementCode(row: any): string {
  const value = normalizeWorkflowValue(row?.gate_type || row?.coupon_type || row?.entitlement_code);
  return value === "food" ? "meal" : value;
}

function createCouponCode(entitlement: string, beneficiary: string, index: number | null) {
  const prefix = entitlement === "meal" ? "MEAL" : "ATT";
  const family = beneficiary === "family" ? `-F${index}` : "-EMP";
  return `${prefix}${family}-${crypto.randomBytes(6).toString("hex").toUpperCase()}`;
}

async function issueRegistrationEntitlements(supabase: any, registration: any, workflow: any, attempt = 0) {
  if (registration.attendance_status !== "attending"
    || registration.registration_status !== "confirmed"
    || !["not_required", "paid"].includes(registration.payment_status)) {
    return [];
  }

  const { data: existing, error: existingError } = await supabase
    .from("program_coupons")
    .select("id, entitlement_code, beneficiary_type, beneficiary_index")
    .eq("program_registration_id", registration.id);
  if (existingError) throwDatabaseError(existingError, "Gagal memeriksa entitlement program.");
  const existingKeys = new Set((existing || []).map(couponKey));
  const definitions: any[] = [];

  for (const entitlement of entitlementCodes(workflow, "employee")) {
    definitions.push({ entitlement, beneficiary: "employee", index: null });
  }
  for (let index = 1; index <= Number(registration.family_count || 0); index += 1) {
    for (const entitlement of entitlementCodes(workflow, "family")) {
      definitions.push({ entitlement, beneficiary: "family", index });
    }
  }

  let missing = definitions.filter(definition => !existingKeys.has(
    `${definition.entitlement}:${definition.beneficiary}:${definition.index || 0}`,
  ));
  if (missing.length === 0) return existing || [];

  const schema = await detectCouponSchema(supabase);
  const issuedAt = new Date().toISOString();

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
      .select("id, entitlement_code, beneficiary_type, beneficiary_index")
      .eq("program_registration_id", registration.id);
    if (linkedAfterAdoptionError) throwDatabaseError(linkedAfterAdoptionError, "Gagal memverifikasi kupon legacy.");
    existingKeys.clear();
    for (const coupon of linkedAfterAdoption || []) existingKeys.add(couponKey(coupon));
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
      entitlement_code: definition.entitlement,
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
      return issueRegistrationEntitlements(supabase, registration, workflow, attempt + 1);
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
  const paymentMethod = ["bank_transfer", "manual_qris"].includes(String(requestedMethod || ""))
    ? String(requestedMethod)
    : instructions.method;
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

export function registerProgramRegistrationWorkflowRoutes(app: any, { supabase, sendNotification }: any) {
  app.post("/api/portal/programs/:programId/registration-v2/submit", async (req: any, res: any) => {
    try {
      const { programId } = req.params;
      if (!isUuid(programId)) throw new WorkflowHttpError(400, "INVALID_PROGRAM_ID", "ID program tidak valid.");
      const user = await authenticateRequest(supabase, req);
      const profile = await getProfile(supabase, user);
      if (!profile.nik) throw new WorkflowHttpError(422, "NIK_REQUIRED", "Profil Anda belum memiliki NIK.");
      const submittedAnswers = validateAnswersPayload(req.body?.answers);
      const { workflow, form } = await loadProgramContext(supabase, programId, profile);

      const { visibleFields, snapshot } = visibleAnswerSnapshot(form.fields || [], submittedAnswers);
      validateRequiredFields(visibleFields, snapshot);
      const quote = buildRegistrationQuote(workflow, snapshot);
      const answerCanonical = canonicalJson(snapshot);
      const answerHash = crypto.createHash("sha256").update(answerCanonical).digest("hex");

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

      const answersUnchanged = existingRegistration
        ? canonicalJson(existingRegistration.answers_snapshot || {}) === answerCanonical
        : false;
      if (existingRegistration && !answersUnchanged && existingRegistration.payment_status === "under_review") {
        throw new WorkflowHttpError(409, "PROOF_SUBMITTED_LOCKED", "Jawaban dikunci setelah bukti pembayaran diunggah. Hubungi admin untuk membuka registrasi.");
      }
      if (existingRegistration && !answersUnchanged
        && existingRegistration.attendance_status === "declined"
        && existingRegistration.registration_status === "confirmed") {
        throw new WorkflowHttpError(409, "DECLINED_REGISTRATION_LOCKED", "Konfirmasi tidak hadir sudah final. Hubungi admin untuk membuka registrasi.");
      }
      if (existingRegistration?.payment_status === "paid" && !answersUnchanged) {
        throw new WorkflowHttpError(409, "PAID_REGISTRATION_LOCKED", "Registrasi yang sudah dibayar tidak dapat diubah.");
      }
      if (existingRegistration && !answersUnchanged) {
        const { count, error: couponCountError } = await supabase
          .from("program_coupons")
          .select("id", { count: "exact", head: true })
          .eq("program_registration_id", existingRegistration.id)
          .in("status", ["active", "claimed"]);
        if (couponCountError) throwDatabaseError(couponCountError, "Gagal memeriksa kupon registrasi.");
        if ((count || 0) > 0) {
          throw new WorkflowHttpError(409, "ENTITLEMENTS_ALREADY_ISSUED", "Registrasi tidak dapat diubah setelah kupon diterbitkan.");
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
        ? "confirmed"
        : quote.requires_payment ? "pending_payment" : "confirmed";
      const paymentStatus = quote.requires_payment ? "pending" : "not_required";
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
      } else {
        const { error: cancelPaymentError } = await supabase
          .from("program_registration_payments")
          .update({ status: "cancelled" })
          .eq("registration_id", registration.id)
          .in("status", ["pending", "under_review", "failed", "rejected"]);
        if (cancelPaymentError) throwDatabaseError(cancelPaymentError, "Gagal menutup pembayaran lama.");
        if (quote.attendance_status === "attending") {
          await issueRegistrationEntitlements(supabase, registration, workflow);
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
      const { data: registration, error } = await supabase
        .from("program_registrations")
        .select("*")
        .eq("program_id", programId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throwDatabaseError(error, "Gagal memuat status registrasi.");
      if (!registration) return res.json({ success: true, data: null });
      const { data: workflow } = await supabase
        .from("program_workflow_configs")
        .select("payment_rules")
        .eq("id", registration.workflow_config_id)
        .maybeSingle();
      return res.json({
        success: true,
        data: await loadRegistrationDetails(supabase, registration),
        payment_instructions: registration.total_amount > 0 ? paymentInstructions(workflow) : null,
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
        .update({ payment_status: "under_review", registration_status: "pending_payment" })
        .eq("id", registration.id);
      if (registrationUpdateError) throwDatabaseError(registrationUpdateError, "Gagal memperbarui status registrasi.");

      return res.json({ success: true, data: updatedPayment, message: "Bukti pembayaran menunggu verifikasi admin." });
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
        .update({ payment_status: "failed", registration_status: "pending_payment", confirmed_at: null })
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
