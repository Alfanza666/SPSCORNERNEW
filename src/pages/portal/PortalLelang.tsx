import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/useAuthStore';
import toast from 'react-hot-toast';
import { Clock, Image as ImageIcon, CheckCircle, XCircle } from 'lucide-react';
import { format, differenceInSeconds } from 'date-fns';
import { id } from 'date-fns/locale';

interface AuctionItem {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  stock: number;
  start_time: string;
  end_time: string;
}

export default function PortalLelang() {
  const { user } = useAuthStore();
  const [items, setItems] = useState<AuctionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('auction_items')
        .select('*')
        .order('start_time', { ascending: true });

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching auction items:', error);
      toast.error('Gagal memuat daftar lelang');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();

    // Subscribe to realtime updates for stock changes
    const channel = supabase.channel('public:auction_items')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'auction_items' },
        () => {
          fetchItems();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleClaim = async (itemId: string) => {
    if (!user) {
      toast.error('Silakan login terlebih dahulu');
      return;
    }

    setClaimingId(itemId);
    try {
      const { data, error } = await supabase.rpc('claim_auction_item', {
        p_item_id: itemId
      });

      if (error) {
        throw new Error(error.message);
      }

      toast.success('Berhasil mengklaim aset!');
      fetchItems();
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Terjadi kesalahan saat mengklaim');
      }
      fetchItems(); // refresh to get true state
    } finally {
      setClaimingId(null);
    }
  };

  const formatCountdown = (targetDateStr: string) => {
    const targetDate = new Date(targetDateStr);
    const diff = differenceInSeconds(targetDate, now);

    if (diff <= 0) return '00:00:00';

    const h = Math.floor(diff / 3600).toString().padStart(2, '0');
    const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
    const s = (diff % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-lg mb-4"></div>
            <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {items.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <Clock className="w-12 h-12 text-zinc-400 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1">
            Belum Ada Lelang
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">
            Pantau terus halaman ini untuk aset terbaru
          </p>
        </div>
      ) : (
        items.map((item) => {
          const startDate = new Date(item.start_time);
          const endDate = new Date(item.end_time);
          const isNotStarted = now < startDate;
          const isEnded = now > endDate;
          const isOngoing = now >= startDate && now <= endDate;
          const isOutOfStock = item.stock <= 0;

          return (
            <div
              key={item.id}
              className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-sm"
            >
              {item.image_url ? (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-full h-48 object-cover"
                />
              ) : (
                <div className="w-full h-48 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <ImageIcon className="w-12 h-12 text-zinc-400" />
                </div>
              )}

              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                    {item.name}
                  </h3>
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Sisa Stok</span>
                    <span className={`px-2 py-1 rounded text-xs font-bold ${
                      isOutOfStock ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {item.stock} Unit
                    </span>
                  </div>
                </div>

                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4 line-clamp-2">
                  {item.description}
                </p>

                <div className="flex items-center gap-2 mb-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg">
                  <Clock className="w-5 h-5 text-zinc-500" />
                  <div className="flex-1">
                    {isNotStarted ? (
                      <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Dimulai dalam</p>
                        <p className="text-sm font-mono font-bold text-zinc-900 dark:text-white">
                          {formatCountdown(item.start_time)}
                        </p>
                      </div>
                    ) : isOngoing ? (
                      <div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Berakhir dalam</p>
                        <p className="text-sm font-mono font-bold text-red-600 dark:text-red-400">
                          {formatCountdown(item.end_time)}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400">
                        Lelang Berakhir
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleClaim(item.id)}
                  disabled={isNotStarted || isEnded || isOutOfStock || claimingId === item.id}
                  className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors ${
                    isNotStarted
                      ? 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 cursor-not-allowed'
                      : isEnded || isOutOfStock
                      ? 'bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm'
                  }`}
                >
                  {claimingId === item.id ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      Memproses...
                    </span>
                  ) : isNotStarted ? (
                    'Belum Dimulai'
                  ) : isEnded ? (
                    'Waktu Habis'
                  ) : isOutOfStock ? (
                    'Stok Habis'
                  ) : (
                    'Klaim Sekarang'
                  )}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
