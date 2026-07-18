import crypto from 'node:crypto';

const TOKEN_VERSION = 2;
const DEFAULT_TTL_MS = 10 * 60 * 1000;

export type ReceiptValidationPayload = {
  v: number;
  jti: string;
  amount: number;
  imageHash: string;
  cartDigest: string;
  buyerSubject: string;
  issuedAt: number;
  expiresAt: number;
};

export type ReceiptValidationInput = {
  amount: unknown;
  imageBase64: string;
  items: unknown[];
  buyerId?: unknown;
};

type ReceiptTokenOptions = {
  secret?: string;
  now?: number;
  ttlMs?: number;
  jti?: string;
};

function signingSecret(explicitSecret?: string): string {
  return explicitSecret
    || process.env.RECEIPT_VALIDATION_SECRET
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || '';
}

function normalizedAmount(value: unknown): number {
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error('Nominal validasi pembayaran tidak valid.');
  }
  return amount;
}

function normalizedBuyerSubject(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : 'guest';
}

function normalizedImageBase64(value: string): string {
  return String(value || '')
    .replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '')
    .replace(/\s+/g, '');
}

export function receiptImageHash(value: string): string {
  const normalized = normalizedImageBase64(value);
  if (!normalized) throw new Error('Bukti pembayaran kosong.');
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function positiveInteger(value: unknown, label: string): number {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    throw new Error(`${label} tidak valid.`);
  }
  return normalized;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} tidak valid.`);
  return value.trim();
}

function digestItem(rawItem: any) {
  const isDigital = rawItem?.is_digital === true;
  const price = positiveInteger(rawItem?.price, 'Harga item');
  const quantity = positiveInteger(rawItem?.quantity, 'Jumlah item');
  const id = requiredString(rawItem?.id, 'ID item');

  if (!isDigital) {
    return {
      kind: 'physical',
      productId: id,
      sellerId: requiredString(rawItem?.seller_id, 'ID penjual'),
      price,
      quantity,
    };
  }

  return {
    kind: 'digital',
    id,
    sku: requiredString(rawItem?.sku ?? rawItem?.metadata?.sku, 'SKU item digital'),
    targetNumber: requiredString(
      rawItem?.target_number ?? rawItem?.metadata?.target_number,
      'Nomor tujuan item digital',
    ),
    name: typeof rawItem?.name === 'string' ? rawItem.name.trim() : '',
    price,
    quantity,
    isPostpaid: rawItem?.metadata?.is_postpaid === true,
    customerName: typeof rawItem?.metadata?.customer_name === 'string'
      ? rawItem.metadata.customer_name.trim()
      : '',
    segmentPower: typeof rawItem?.metadata?.segment_power === 'string'
      ? rawItem.metadata.segment_power.trim()
      : '',
  };
}

export function receiptCartDigest(items: unknown[]): string {
  if (!Array.isArray(items) || items.length === 0) throw new Error('Keranjang validasi kosong.');
  const canonicalItems = items
    .map(digestItem)
    .map(item => JSON.stringify(item))
    .sort();
  return crypto.createHash('sha256').update(JSON.stringify(canonicalItems)).digest('hex');
}

function signature(body: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('base64url');
}

function signedToken(payload: ReceiptValidationPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${signature(body, secret)}`;
}

export function issueReceiptValidationAttestation(
  input: ReceiptValidationInput,
  options: ReceiptTokenOptions = {},
): { token: string; payload: ReceiptValidationPayload } {
  const secret = signingSecret(options.secret);
  if (!secret) throw new Error('Server belum memiliki secret validasi pembayaran.');
  const now = options.now ?? Date.now();
  const ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
  if (!Number.isSafeInteger(now) || !Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
    throw new Error('Masa berlaku pengesahan tidak valid.');
  }

  const payload: ReceiptValidationPayload = {
    v: TOKEN_VERSION,
    jti: options.jti || crypto.randomUUID(),
    amount: normalizedAmount(input.amount),
    imageHash: receiptImageHash(input.imageBase64),
    cartDigest: receiptCartDigest(input.items),
    buyerSubject: normalizedBuyerSubject(input.buyerId),
    issuedAt: now,
    expiresAt: now + ttlMs,
  };
  return { token: signedToken(payload, secret), payload };
}

export function verifyReceiptValidationToken(
  token: unknown,
  input: ReceiptValidationInput,
  options: Pick<ReceiptTokenOptions, 'secret' | 'now'> = {},
): { valid: true; payload: ReceiptValidationPayload } | { valid: false; reason: string } {
  try {
    const secret = signingSecret(options.secret);
    if (!secret) return { valid: false, reason: 'validation_secret_missing' };
    if (typeof token !== 'string') return { valid: false, reason: 'validation_token_missing' };
    const [body, providedSignature, ...extra] = token.split('.');
    if (!body || !providedSignature || extra.length > 0) {
      return { valid: false, reason: 'validation_token_malformed' };
    }

    const expectedSignature = signature(body, secret);
    const expectedBuffer = Buffer.from(expectedSignature);
    const providedBuffer = Buffer.from(providedSignature);
    if (expectedBuffer.length !== providedBuffer.length
      || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
      return { valid: false, reason: 'validation_signature_invalid' };
    }

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ReceiptValidationPayload;
    const now = options.now ?? Date.now();
    if (payload.v !== TOKEN_VERSION) return { valid: false, reason: 'validation_version_invalid' };
    if (typeof payload.jti !== 'string'
      || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.jti)) {
      return { valid: false, reason: 'validation_jti_invalid' };
    }
    if (!Number.isFinite(payload.issuedAt) || !Number.isFinite(payload.expiresAt)
      || payload.issuedAt > now + 30_000 || payload.expiresAt <= now || payload.expiresAt <= payload.issuedAt) {
      return { valid: false, reason: 'validation_token_expired' };
    }
    if (payload.amount !== normalizedAmount(input.amount)) {
      return { valid: false, reason: 'validation_amount_mismatch' };
    }
    if (payload.imageHash !== receiptImageHash(input.imageBase64)) {
      return { valid: false, reason: 'validation_image_mismatch' };
    }
    if (payload.cartDigest !== receiptCartDigest(input.items)) {
      return { valid: false, reason: 'validation_cart_mismatch' };
    }
    if (payload.buyerSubject !== normalizedBuyerSubject(input.buyerId)) {
      return { valid: false, reason: 'validation_buyer_mismatch' };
    }
    return { valid: true, payload };
  } catch {
    return { valid: false, reason: 'validation_token_invalid' };
  }
}

export async function recordReceiptValidationIssuance(supabase: any, payload: ReceiptValidationPayload) {
  const { error } = await supabase.from('receipt_validation_tokens').insert({
    jti: payload.jti,
    amount: payload.amount,
    image_hash: payload.imageHash,
    cart_digest: payload.cartDigest,
    buyer_subject: payload.buyerSubject,
    issued_at: new Date(payload.issuedAt).toISOString(),
    expires_at: new Date(payload.expiresAt).toISOString(),
  });
  if (error) throw new Error(`Gagal mencatat pengesahan bukti: ${error.message || error.code || 'unknown'}`);
}

export async function consumeReceiptValidationIssuance(
  supabase: any,
  payload: ReceiptValidationPayload,
): Promise<{ consumed: true } | { consumed: false; reason: string }> {
  const { data, error } = await supabase.rpc('consume_receipt_validation_token', {
    p_jti: payload.jti,
    p_amount: payload.amount,
    p_image_hash: payload.imageHash,
    p_cart_digest: payload.cartDigest,
    p_buyer_subject: payload.buyerSubject,
    p_issued_at: new Date(payload.issuedAt).toISOString(),
    p_expires_at: new Date(payload.expiresAt).toISOString(),
  });
  if (error) return { consumed: false, reason: 'validation_ledger_unavailable' };
  if (data !== true) return { consumed: false, reason: 'validation_token_consumed_or_unknown' };
  return { consumed: true };
}
