import { describe, expect, it } from 'vitest';
import {
  normalizeTransactionCreationInput,
  reconcilePhysicalItems,
  resolveBuyerBinding,
} from '../utils/transactionCreationValidation';

const buyerId = '11111111-1111-4111-8111-111111111111';
const sellerId = '22222222-2222-4222-8222-222222222222';
const productId = '33333333-3333-4333-8333-333333333333';

const physicalItem = {
  id: productId,
  seller_id: sellerId,
  name: 'Nasi Kuning',
  price: 12_500,
  quantity: 2,
  is_digital: false,
};

const digitalItem = {
  id: 'digital-PLN-1',
  seller_id: 'DIGIFLAZZ',
  name: 'Token PLN',
  price: 5_000,
  quantity: 1,
  is_digital: true,
  sku: 'PLN20',
  target_number: '1234567890',
};

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    buyer_name: 'Pembeli',
    buyer_id: buyerId,
    total_amount: 30_000,
    items: [physicalItem, digitalItem],
    ...overrides,
  };
}

describe('transaction creation input validation', () => {
  it('accepts a valid mixed physical/digital cart and derives the authenticated buyer', () => {
    const result = normalizeTransactionCreationInput(validBody(), { authenticatedBuyerId: buyerId });

    expect(result).toMatchObject({
      buyerId,
      buyerSubject: buyerId,
      buyerName: 'Pembeli',
      totalAmount: 30_000,
      calculatedTotal: 30_000,
    });
    expect(result.items[1]).toMatchObject({ seller_id: null, sku: 'PLN20', target_number: '1234567890' });
  });

  it.each([
    ['empty cart', { items: [] }],
    ['missing cart', { items: undefined }],
    ['zero total', { total_amount: 0 }],
    ['NaN total', { total_amount: Number.NaN }],
    ['infinite total', { total_amount: Number.POSITIVE_INFINITY }],
    ['zero price', { items: [{ ...physicalItem, price: 0 }, digitalItem] }],
    ['negative price', { items: [{ ...physicalItem, price: -1 }, digitalItem] }],
    ['fractional quantity', { items: [{ ...physicalItem, quantity: 1.5 }, digitalItem] }],
    ['missing physical seller', { items: [{ ...physicalItem, seller_id: '' }, digitalItem] }],
    ['missing digital target', { items: [physicalItem, { ...digitalItem, target_number: '' }] }],
  ])('rejects invalid %s input', (_label, overrides) => {
    expect(() => normalizeTransactionCreationInput(validBody(overrides), { authenticatedBuyerId: buyerId }))
      .toThrow();
  });

  it('rejects a total that differs from the exact item gross sum', () => {
    expect(() => normalizeTransactionCreationInput(
      validBody({ total_amount: 29_999 }),
      { authenticatedBuyerId: buyerId },
    )).toThrow(expect.objectContaining({ code: 'cart_total_mismatch', status: 409 }));
  });

  it('allows a guest only without buyer_id and rejects buyer identity spoofing', () => {
    expect(resolveBuyerBinding(null, null)).toEqual({ buyerId: null, buyerSubject: 'guest' });
    expect(() => resolveBuyerBinding(buyerId, null))
      .toThrow(expect.objectContaining({ code: 'buyer_auth_required', status: 401 }));
    expect(() => resolveBuyerBinding(buyerId, sellerId))
      .toThrow(expect.objectContaining({ code: 'buyer_identity_mismatch', status: 403 }));
    expect(resolveBuyerBinding(null, buyerId)).toEqual({ buyerId, buyerSubject: buyerId });
  });
});

describe('canonical physical product reconciliation', () => {
  const product = {
    id: productId,
    seller_id: sellerId,
    name: 'Nama Katalog',
    price: 12_500,
    is_active: true,
  };

  it('accepts canonical price/seller and preserves the digital flow unchanged', () => {
    const normalized = normalizeTransactionCreationInput(validBody(), { authenticatedBuyerId: buyerId });
    const result = reconcilePhysicalItems(normalized.items, [product]);

    expect(result[0]).toMatchObject({
      id: productId,
      name: 'Nama Katalog',
      seller_id: sellerId,
      price: 12_500,
    });
    expect(result[1]).toEqual(normalized.items[1]);
  });

  it.each([
    ['missing product', [], 'product_missing'],
    ['inactive product', [{ ...product, is_active: false }], 'product_inactive'],
    ['changed price', [{ ...product, price: 13_000 }], 'product_price_changed'],
    ['changed seller', [{ ...product, seller_id: buyerId }], 'product_seller_mismatch'],
  ])('rejects %s', (_label, products, expectedCode) => {
    const normalized = normalizeTransactionCreationInput(validBody(), { authenticatedBuyerId: buyerId });
    expect(() => reconcilePhysicalItems(normalized.items, products))
      .toThrow(expect.objectContaining({ code: expectedCode, status: 409 }));
  });
});
