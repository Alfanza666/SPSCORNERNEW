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
          // 1. Recent Transactions
          const { data: txData } = await supabase
            .from('transactions')
            .select('id, created_at, buyer_name, status')
            .in('status', ['paid', 'completed', 'cancelled'])
            .order('created_at', { ascending: false })
            .limit(20);

          if (txData) {
            txData.forEach(tx => {
              let title = '';
              let message = '';
              if (tx.status === 'paid') {
                title = 'Pesanan Perlu Diproses';
                message = `Pembayaran dari ${tx.buyer_name || 'Pelanggan'} telah diterima.`;
              } else if (tx.status === 'completed') {
                title = 'Pesanan Selesai';
                message = `Pesanan dari ${tx.buyer_name || 'Pelanggan'} telah selesai.`;
              } else if (tx.status === 'cancelled') {
                title = 'Pesanan Dibatalkan';
                message = `Pesanan dari ${tx.buyer_name || 'Pelanggan'} telah dibatalkan.`;
              }
              
              notifs.push({
                id: `tx-${tx.id}-${tx.status}`,
                type: 'transaction',
                title,
                message,
                time: new Date(tx.created_at).toISOString(),
                path: '/dashboard/admin/transactions',
                isRead: false
              });
            });
          }

          // 2. Recent Withdrawals
          const { data: wdData } = await supabase
            .from('withdrawals')
            .select('id, created_at, seller_id, status, profiles(name)')
            .order('created_at', { ascending: false })
            .limit(10);

          if (wdData) {
            wdData.forEach(wd => {
              const sellerName = Array.isArray(wd.profiles) ? wd.profiles[0]?.name : (wd.profiles as any)?.name;
              let title = '';
              let message = '';
              if (wd.status === 'pending') {
                title = 'Permintaan Penarikan';
                message = `Penjual ${sellerName || 'Unknown'} mengajukan penarikan saldo.`;
              } else {
                title = `Penarikan ${wd.status === 'rejected' ? 'Ditolak' : 'Disetujui'}`;
                message = `Penarikan dari ${sellerName || 'Unknown'} telah ${wd.status === 'rejected' ? 'ditolak' : 'disetujui'}.`;
              }

              notifs.push({
                id: `wd-${wd.id}-${wd.status}`,
                type: 'withdrawal',
                title,
                message,
                time: new Date(wd.created_at).toISOString(),
                path: '/dashboard/admin/withdrawals',
                isRead: false
              });
            });
          }
        } else if (user.role === 'seller') {
          // 1. Transactions containing their products
          const { data: txItems } = await supabase
            .from('transaction_items')
            .select('id, created_at, transactions!inner(id, status, buyer_name)')
            .eq('seller_id', user.id)
            .in('transactions.status', ['paid', 'completed', 'cancelled'])
            .order('created_at', { ascending: false })
            .limit(20);

          if (txItems) {
            const uniqueTxs = new Map();
            txItems.forEach(item => {
              const tx = Array.isArray(item.transactions) ? item.transactions[0] : item.transactions;
              if (tx && !uniqueTxs.has(`${tx.id}-${tx.status}`)) {
                let title = '';
                let message = '';
                if (tx.status === 'paid') {
                  title = 'Pesanan Baru';
                  message = `Ada pesanan baru dari ${tx.buyer_name || 'Pelanggan'} yang mengandung produk Anda.`;
                } else if (tx.status === 'completed') {
                  title = 'Pesanan Selesai';
                  message = `Pesanan dari ${tx.buyer_name || 'Pelanggan'} telah selesai.`;
                } else if (tx.status === 'cancelled') {
                  title = 'Pesanan Dibatalkan';
                  message = `Pesanan dari ${tx.buyer_name || 'Pelanggan'} telah dibatalkan.`;
                }

                uniqueTxs.set(`${tx.id}-${tx.status}`, {
                  id: `tx-${tx.id}-${tx.status}`,
                  type: 'transaction',
                  title,
                  message,
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
            .order('created_at', { ascending: false })
            .limit(10);

          if (wdData) {
            wdData.forEach(wd => {
              let title = '';
              let message = '';
              if (wd.status === 'pending') {
                title = 'Penarikan Diproses';
                message = `Penarikan saldo sebesar Rp ${wd.amount.toLocaleString('id-ID')} sedang diproses.`;
              } else {
                title = `Penarikan ${wd.status === 'rejected' ? 'Ditolak' : 'Disetujui'}`;
                message = `Penarikan saldo sebesar Rp ${wd.amount.toLocaleString('id-ID')} telah ${wd.status === 'rejected' ? 'ditolak' : 'disetujui/dibayar'}.`;
              }

              notifs.push({
                id: `wd-${wd.id}-${wd.status}`,
                type: 'withdrawal',
                title,
                message,
                time: new Date(wd.created_at).toISOString(),
                path: '/dashboard/seller/withdrawals',
                isRead: false
              });
            });
          }
        }

        // Sort all by time descending
        notifs.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
        
        // Apply read status from localStorage
        const readNotifs = JSON.parse(localStorage.getItem(`read_notifs_${user.id}`) || '[]');
        const readNotifsSet = new Set(readNotifs);
        
        const finalNotifs = notifs.map(n => ({
          ...n,
          isRead: n.isRead || readNotifsSet.has(n.id)
        }));
        
        setNotifications(finalNotifs);
        setUnreadCount(finalNotifs.filter(n => !n.isRead).length);
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotifications();

    // Set up realtime subscriptions
    const channelName = `notifs-${user.id}-${Date.now()}`;
    const txSub = supabase.channel(`${channelName}-tx`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, fetchNotifications)
      .subscribe();
      
    const wdSub = supabase.channel(`${channelName}-wd`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'withdrawals' }, fetchNotifications)
      .subscribe();

    return () => {
      supabase.removeChannel(txSub);
      supabase.removeChannel(wdSub);
    };
  }, [user]);

  const markAllAsRead = () => {
    if (!user) return;
    const readIds = notifications.map(n => n.id);
    localStorage.setItem(`read_notifs_${user.id}`, JSON.stringify(readIds));
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  return { notifications, unreadCount, isLoading, markAllAsRead };
}
