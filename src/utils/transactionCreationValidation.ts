// @ts-nocheck

const MAX_CART_ITEMS = 100;
const MAX_ITEM_QUANTITY = 1_000;

export class TransactionCreationValidationError extends Error {
  status: number;
  code: string;

  constructor(message: string, { status = 400, code = 'invalid_transaction' } = {}) {
    super(message);
    this.name = 'TransactionCreationValidationError';
    this.status = status;
    this.code = code;
  }
}

function requiredText(value: unknown, fieldName: string, maxLength = 250): string {
  if (typeof value !== 'string') {
    throw new TransactionCreationValidationError(`${fieldName} wajib diisi.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new TransactionCreationValidationError(`${fieldName} tidak valid.`);
  }
  return normalized;
}

function positiveCurrency(value: unknown, fieldName: string): number {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized <= 0) {
    throw new TransactionCreationValidationError(`${fieldName} harus berupa nominal positif yang valid.`);
  }
  return normalized;
}

function positiveQuantity(value: unknown): number {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized <= 0 || normalized > MAX_ITEM_QUANTITY) {
    throw new TransactionCreationValidationError(
      `Jumlah item harus berupa bilangan bulat 1-${MAX_ITEM_QUANTITY}.`,
    );
  }
  return normalized;
}

export function resolveBuyerBinding(
  incomingBuyerId: unknown,
  authenticatedBuyerId: unknown,
): { buyerId: string | null; buyerSubject: string } {
  const incoming = typeof incomingBuyerId === 'string' && incomingBuyerId.trim()
    ? incomingBuyerId.trim()
    : null;
  const authenticated = typeof authenticatedBuyerId === 'string' && authenticatedBuyerId.trim()
    ? authenticatedBuyerId.trim()
    : null;

  if (incoming && !authenticated) {
    throw new TransactionCreationValidationError(
      'Login diperlukan untuk menggunakan identitas anggota.',
      { status: 401, code: 'buyer_auth_required' },
    );
  }
  if (incoming && authenticated && incoming !== authenticated) {
    throw new TransactionCreationValidationError(
      'Identitas pembeli tidak sesuai dengan sesi login.',
      { status: 403, code: 'buyer_identity_mismatch' },
    );
  }

  return {
    buyerId: authenticated,
    buyerSubject: authenticated || 'guest',
  };
}

export function normalizeTransactionItems(rawItems: unknown): any[] {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw new TransactionCreationValidationError('Keranjang transaksi tidak boleh kosong.');
  }
  if (rawItems.length > MAX_CART_ITEMS) {
    throw new TransactionCreationValidationError(`Maksimal ${MAX_CART_ITEMS} item per transaksi.`);
  }

  return rawItems.map((rawItem, index) => {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
      throw new TransactionCreationValidationError(`Item ke-${index + 1} tidak valid.`);
    }

    const isDigital = rawItem.is_digital === true;
    const id = requiredText(rawItem.id, `ID item ke-${index + 1}`);
    const quantity = positiveQuantity(rawItem.quantity);
    const price = positiveCurrency(rawItem.price, `Harga item ke-${index + 1}`);

    if (!isDigital) {
      return {
        ...rawItem,
        id,
        is_digital: false,
        seller_id: requiredText(rawItem.seller_id, `Penjual item ke-${index + 1}`, 100),
        quantity,
        price,
      };
    }

    const sku = requiredText(rawItem.sku ?? rawItem.metadata?.sku, `SKU item digital ke-${index + 1}`);
    const targetNumber = requiredText(
      rawItem.target_number ?? rawItem.metadata?.target_number,
      `Nomor tujuan item digital ke-${index + 1}`,
      250,
    );
    return {
      ...rawItem,
      id,
      is_digital: true,
      seller_id: null,
      sku,
      target_number: targetNumber,
      quantity,
      price,
      metadata: {
        ...(rawItem.metadata || {}),
        is_digital: true,
        sku,
        target_number: targetNumber,
      },
    };
  });
}

export function calculateCartGross(items: any[]): number {
  let total = 0;
  for (const item of items) {
    const subtotal = item.price * item.quantity;
    if (!Number.isSafeInteger(subtotal) || subtotal <= 0 || !Number.isSafeInteger(total + subtotal)) {
      throw new TransactionCreationValidationError('Subtotal keranjang melebihi batas nominal yang didukung.');
    }
    total += subtotal;
  }
  return total;
}

export function normalizeTransactionCreationInput(
  body: unknown,
  { authenticatedBuyerId = null, requireBuyerName = true } = {},
) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new TransactionCreationValidationError('Body transaksi tidak valid.');
  }

  const items = normalizeTransactionItems(body.items);
  const totalAmount = positiveCurrency(body.total_amount ?? body.totalAmount, 'Total transaksi');
  const calculatedTotal = calculateCartGross(items);
  if (calculatedTotal !== totalAmount) {
    throw new TransactionCreationValidationError(
      'Total transaksi tidak sama dengan jumlah harga seluruh item.',
      { status: 409, code: 'cart_total_mismatch' },
    );
  }

  const buyer = resolveBuyerBinding(body.buyer_id ?? body.buyerId, authenticatedBuyerId);
  const buyerName = requireBuyerName
    ? requiredText(body.buyer_name, 'Nama pembeli', 200)
    : null;

  return {
    ...buyer,
    buyerName,
    totalAmount,
    calculatedTotal,
    items,
  };
}

export function reconcilePhysicalItems(items: any[], productRows: any[]): any[] {
  const productsById = new Map((productRows || []).map(product => [String(product.id), product]));

  return items.map((item, index) => {
    if (item.is_digital) return item;

    const product = productsById.get(String(item.id));
    if (!product) {
      throw new TransactionCreationValidationError(
        `Produk pada item ke-${index + 1} sudah tidak tersedia. Muat ulang keranjang.`,
        { status: 409, code: 'product_missing' },
      );
    }
    if (product.is_active !== true) {
      throw new TransactionCreationValidationError(
        `Produk "${product.name || item.id}" sedang tidak aktif.`,
        { status: 409, code: 'product_inactive' },
      );
    }

    const canonicalPrice = Number(product.price);
    if (!Number.isSafeInteger(canonicalPrice) || canonicalPrice <= 0) {
      throw new TransactionCreationValidationError(
        `Harga produk "${product.name || item.id}" tidak valid di katalog.`,
        { status: 409, code: 'product_price_invalid' },
      );
    }
    if (canonicalPrice !== item.price) {
      throw new TransactionCreationValidationError(
        `Harga produk "${product.name || item.id}" telah berubah. Muat ulang keranjang.`,
        { status: 409, code: 'product_price_changed' },
      );
    }
    if (String(product.seller_id) !== String(item.seller_id)) {
      throw new TransactionCreationValidationError(
        `Data penjual produk "${product.name || item.id}" tidak sesuai.`,
        { status: 409, code: 'product_seller_mismatch' },
      );
    }

    return {
      ...item,
      name: product.name || item.name,
      price: canonicalPrice,
      seller_id: String(product.seller_id),
    };
  });
}

export async function loadCanonicalTransactionItems(supabase: any, items: any[]): Promise<any[]> {
  const productIds = [...new Set(
    items.filter(item => !item.is_digital).map(item => String(item.id)),
  )];
  if (productIds.length === 0) return items;

  const { data, error } = await supabase
    .from('products')
    .select('id, seller_id, name, price, is_active')
    .in('id', productIds);
  if (error) {
    throw new TransactionCreationValidationError(
      'Katalog produk sedang tidak dapat diverifikasi. Silakan coba lagi.',
      { status: 503, code: 'product_catalog_unavailable' },
    );
  }
  return reconcilePhysicalItems(items, data || []);
}

export async function resolveOptionalAuthenticatedBuyerId(supabase: any, authorization: unknown) {
  if (authorization === undefined || authorization === null || authorization === '') return null;
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    throw new TransactionCreationValidationError(
      'Sesi login tidak valid.',
      { status: 401, code: 'invalid_authorization' },
    );
  }
  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    throw new TransactionCreationValidationError(
      'Sesi login tidak valid.',
      { status: 401, code: 'invalid_authorization' },
    );
  }

  const { data: { user } = {}, error } = await supabase.auth.getUser(token);
  if (error || !user?.id) {
    throw new TransactionCreationValidationError(
      'Sesi login telah berakhir atau tidak valid.',
      { status: 401, code: 'invalid_authorization' },
    );
  }
  return String(user.id);
}

export function sendTransactionValidationError(res: any, error: unknown): boolean {
  if (!(error instanceof TransactionCreationValidationError)) return false;
  res.status(error.status).json({ error: error.message, code: error.code });
  return true;
}
