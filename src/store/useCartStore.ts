import { create } from 'zustand';

export interface Product {
  id: string;
  seller_id: string;
  name: string;
  price: number;
  stock: number;
  category?: string;
  category_id?: string;
  image_url: string;
  description?: string;
  is_digital?: boolean;
  target_number?: string;
  sku?: string;
  profiles?: { name: string };
  metadata?: any;
  is_preorder?: boolean;
  po_config_id?: string;
  po_seller_id?: string;
  pickup_notes?: string;
  po_pickup_type?: string;
  po_open_days?: number[];
  po_cutoff_time?: string;
  po_stock?: number;
  po_min_order?: number;
  po_max_order?: number;
}

export interface CartItem extends Product {
  quantity: number;
}

interface CartState {
  items: CartItem[];
  reservations: string[];
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getTotal: () => number;
  setReservations: (ids: string[]) => void;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  reservations: [],
  addItem: (product) => {
    set((state) => {
      const existingItem = state.items.find((item) => item.id === product.id);
      if (existingItem) {
        return {
          items: state.items.map((item) =>
            item.id === product.id
              ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) }
              : item
          ),
        };
      }
      return { items: [...state.items, { ...product, quantity: 1 }] };
    });
  },
  removeItem: (productId) => {
    set((state) => ({
      items: state.items.filter((item) => item.id !== productId),
    }));
  },
  updateQuantity: (productId, quantity) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === productId ? { ...item, quantity } : item
      ),
    }));
  },
  clearCart: () => set({ items: [], reservations: [] }),
  getTotal: () => {
    return get().items.reduce((total, item) => total + item.price * item.quantity, 0);
  },
  setReservations: (ids) => set({ reservations: ids }),
}));
