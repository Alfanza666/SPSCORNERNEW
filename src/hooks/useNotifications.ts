import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

export interface NotificationItem {
  id: string;
  type: 'transaction' | 'withdrawal' | 'system';
  title: string;
  message: string;
  time: string;
  path: string;
  isRead: boolean;
}

export function useNotifications() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      setIsLoading(true);
      const notifs: NotificationItem[] = [];

      try {
        if (user.role === 'admin') {
          // 1. Pending Transactions (status = 'paid')
          const { data: txData } = await supabase
            .from('transactions')
            .select('id, created_at, buyer_name')
            .eq('status', 'paid')
            .order('created_at', { ascending: false });

          if (txData) {
            txData.forEach(tx => {
              notifs.push({
                id: `tx-${tx.id}`,
                type: 'transaction',
                title: 'Pesanan Perlu Diproses',
                message: `Pembayaran dari ${tx.buyer_name || 'Pelanggan'} telah diterima. Segera proses pesanan ini.`,
                time: new Date(tx.created_at).toISOString(),
                path: '/dashboard/admin/transactions',
                isRead: false
              });
            });
          }

          // 2. Pending Withdrawals
          const { data: wdData } = await supabase
            .from('withdrawals')
            .select('id, created_at, seller_id, profiles(name)')
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

          if (wdData) {
            wdData.forEach(wd => {
              const sellerName = Array.isArray(wd.profiles) ? wd.profiles[0]?.name : (wd.profiles as any)?.name;
              notifs.push({
                id: `wd-${wd.id}`,
                type: 'withdrawal',
                title: 'Permintaan Penarikan',
                message: `Penjual ${sellerName || 'Unknown'} mengajukan penarikan saldo.`,
                time: new Date(wd.created_at).toISOString(),
                path: '/dashboard/admin/withdrawals',
                isRead: false
              });
            });
          }
        } else if (user.role === 'seller') {
          // 1. Transactions containing their products (status = 'paid')
          const { data: txItems } = await supabase
            .from('transaction_items')
            .select('id, created_at, transactions!inner(id, status, buyer_name)')
            .eq('seller_id', user.id)
            .eq('transactions.status', 'paid')
            .order('created_at', { ascending: false });

          if (txItems) {
            const uniqueTxs = new Map();
            txItems.forEach(item => {
              const tx = Array.isArray(item.transactions) ? item.transactions[0] : item.transactions;
              if (tx && !uniqueTxs.has(tx.id)) {
                uniqueTxs.set(tx.id, {
                  id: `tx-${tx.id}`,
                  type: 'transaction',
                  title: 'Pesanan Baru',
                  message: `Ada pesanan baru dari ${tx.buyer_name || 'Pelanggan'} yang mengandung produk Anda.`,
                  time: new Date(item.created_at).toISOString(),
                  path: '/dashboard/seller/products',
                  isRead: false
                });
              }
            });
            notifs.push(...Array.from(uniqueTxs.values()));
          }

          // 2. Processed Withdrawals (approved/rejected/paid)
          const { data: wdData } = await supabase
            .from('withdrawals')
            .select('id, created_at, status, amount')
            .eq('seller_id', user.id)
            .in('status', ['approved', 'rejected', 'paid'])
            .order('created_at', { ascending: false })
            .limit(5);

          if (wdData) {
            wdData.forEach(wd => {
              notifs.push({
                id: `wd-${wd.id}`,
                type: 'withdrawal',
                title: `Penarikan ${wd.status === 'rejected' ? 'Ditolak' : 'Disetujui'}`,
                message: `Penarikan saldo sebesar Rp ${wd.amount.toLocaleString('id-ID')} telah ${wd.status === 'rejected' ? 'ditolak' : 'disetujui/dibayar'}.`,
                time: new Date(wd.created_at).toISOString(),
                path: '/dashboard/seller/withdrawals',
                isRead: true // Mark historical as read
              });
            });
          }
        }

        // Sort all by time descending
        notifs.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        
        setNotifications(notifs);
        setUnreadCount(notifs.filter(n => !n.isRead).length);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotifications();

    // Set up realtime subscriptions
    const txSub = supabase.channel('public:transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchNotifications)
      .subscribe();
      
    const wdSub = supabase.channel('public:withdrawals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, fetchNotifications)
      .subscribe();

    return () => {
      supabase.removeChannel(txSub);
      supabase.removeChannel(wdSub);
    };
  }, [user]);

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  return { notifications, unreadCount, isLoading, markAllAsRead };
}
