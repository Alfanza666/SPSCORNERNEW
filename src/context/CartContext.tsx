import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase'; // Sesuaikan dengan path konfigurasi supabase Anda

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
  [key: string]: any; // Menampung field tambahan lainnya
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: any, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  syncCartAfterLogin: (userId: string) => Promise<void>;
  loading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // 1. Monitor status login pengguna
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Muat data keranjang awal (dari Supabase jika login, dari localStorage jika guest)
  useEffect(() => {
    const loadCart = async () => {
      setLoading(true);
      if (userId) {
        // Jika sudah login, ambil dari database
        const { data, error } = await supabase
          .from('cart_items')
          .select('*')
          .eq('user_id', userId);
        
        if (!error && data) {
          setCartItems(data.map(item => ({
            id: item.product_id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            image_url: item.image_url
          })));
        }
      } else {
        // Jika guest, ambil dari localStorage
        const localCart = localStorage.getItem('sps_guest_cart');
        if (localCart) {
          setCartItems(JSON.parse(localCart));
        } else {
          setCartItems([]);
        }
      }
      setLoading(false);
    };

    loadCart();
  }, [userId]);

  // 3. Fungsi Tambah ke Keranjang
  const addToCart = async (product: any, quantity: number) => {
    const existingItem = cartItems.find(item => item.id === product.id);
    let updatedCart: CartItem[] = [];

    if (existingItem) {
      updatedCart = cartItems.map(item =>
        item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item
      );
    } else {
      updatedCart = [...cartItems, {
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: quantity,
        image_url: product.image_url
      }];
    }

    setCartItems(updatedCart);

    if (userId) {
      // Simpan ke Supabase jika sudah login (Gunakan upsert)
      await supabase.from('cart_items').upsert({
        user_id: userId,
        product_id: product.id,
        name: product.name,
        price: product.price,
        quantity: existingItem ? existingItem.quantity + quantity : quantity,
        image_url: product.image_url
      }, { onConflict: 'user_id,product_id' });
    } else {
      // Simpan ke localStorage jika guest
      localStorage.setItem('sps_guest_cart', JSON.stringify(updatedCart));
    }
  };

  // 4. Fungsi Hapus dari Keranjang
  const removeFromCart = async (productId: string) => {
    const updatedCart = cartItems.filter(item => item.id !== productId);
    setCartItems(updatedCart);

    if (userId) {
      await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', userId)
        .eq('product_id', productId);
    } else {
      localStorage.setItem('sps_guest_cart', JSON.stringify(updatedCart));
    }
  };

  // 5. Fungsi Bersihkan Keranjang
  const clearCart = async () => {
    setCartItems([]);
    if (userId) {
      await supabase.from('cart_items').delete().eq('user_id', userId);
    } else {
      localStorage.removeItem('sps_guest_cart');
    }
  };

  // 6. Fungsi KRUSIAL: Memindahkan isi keranjang Guest ke Supabase saat Login Berhasil
  const syncCartAfterLogin = async (authenticatedUserId: string) => {
    const localCart = localStorage.getItem('sps_guest_cart');
    if (!localCart) return;

    const parsedLocalCart: CartItem[] = JSON.parse(localCart);
    if (parsedLocalCart.length === 0) return;

    try {
      // Masukkan semua item dari localStorage ke tabel database
      for (const item of parsedLocalCart) {
        await supabase.from('cart_items').upsert({
          user_id: authenticatedUserId,
          product_id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image_url: item.image_url
        }, { onConflict: 'user_id,product_id' });
      }

      // Bersihkan data lokal setelah berhasil disinkronkan
      localStorage.removeItem('sps_guest_cart');
      
      // Muat ulang state komponen agar sinkron dengan database
      const { data } = await supabase
        .from('cart_items')
        .select('*')
        .eq('user_id', authenticatedUserId);
      
      if (data) {
        setCartItems(data.map(i => ({
          id: i.product_id,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          image_url: i.image_url
        })));
      }
    } catch (err) {
      console.error('Gagal melakukan sinkronisasi keranjang belanja:', err);
    }
  };

  return (
    <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, clearCart, syncCartAfterLogin, loading }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart harus digunakan di dalam komponen CartProvider');
  }
  return context;
};