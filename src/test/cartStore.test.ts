import { describe, it, expect, beforeEach } from 'vitest';
import { useCartStore, type Product } from '../store/useCartStore';

const mockProduct: Product = {
  id: 'prod-1',
  seller_id: 'seller-1',
  name: 'Nasi Goreng',
  price: 15000,
  stock: 10,
  image_url: '/test.jpg',
};

const mockProduct2: Product = {
  id: 'prod-2',
  seller_id: 'seller-2',
  name: 'Es Teh',
  price: 5000,
  stock: 20,
  image_url: '/test2.jpg',
};

describe('useCartStore', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], reservations: [] });
  });

  it('starts with empty cart', () => {
    const { items } = useCartStore.getState();
    expect(items).toHaveLength(0);
  });

  it('adds item to cart', () => {
    useCartStore.getState().addItem(mockProduct);
    const { items } = useCartStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Nasi Goreng');
    expect(items[0].quantity).toBe(1);
  });

  it('increments quantity when adding existing item', () => {
    useCartStore.getState().addItem(mockProduct);
    useCartStore.getState().addItem(mockProduct);
    const { items } = useCartStore.getState();
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(2);
  });

  it('caps quantity at stock limit', () => {
    useCartStore.getState().addItem(mockProduct);
    for (let i = 0; i < 15; i++) {
      useCartStore.getState().addItem(mockProduct);
    }
    const { items } = useCartStore.getState();
    expect(items[0].quantity).toBe(10);
  });

  it('removes item from cart', () => {
    useCartStore.getState().addItem(mockProduct);
    useCartStore.getState().removeItem(mockProduct.id);
    const { items } = useCartStore.getState();
    expect(items).toHaveLength(0);
  });

  it('updates item quantity', () => {
    useCartStore.getState().addItem(mockProduct);
    useCartStore.getState().updateQuantity(mockProduct.id, 5);
    const { items } = useCartStore.getState();
    expect(items[0].quantity).toBe(5);
  });

  it('calculates total correctly', () => {
    useCartStore.getState().addItem(mockProduct);
    useCartStore.getState().addItem(mockProduct2);
    useCartStore.getState().updateQuantity(mockProduct2.id, 2);
    const total = useCartStore.getState().getTotal();
    expect(total).toBe(15000 + 5000 * 2);
  });

  it('clears cart', () => {
    useCartStore.getState().addItem(mockProduct);
    useCartStore.getState().addItem(mockProduct2);
    useCartStore.getState().clearCart();
    const { items, reservations } = useCartStore.getState();
    expect(items).toHaveLength(0);
    expect(reservations).toHaveLength(0);
  });

  it('handles multiple products', () => {
    useCartStore.getState().addItem(mockProduct);
    useCartStore.getState().addItem(mockProduct2);
    const { items } = useCartStore.getState();
    expect(items).toHaveLength(2);
  });
});
