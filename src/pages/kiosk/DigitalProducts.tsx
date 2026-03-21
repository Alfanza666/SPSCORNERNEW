import React from 'react';
import { motion } from 'motion/react';
import { 
  Smartphone, 
  Wifi, 
  Zap, 
  Gamepad2, 
  Tv, 
  CreditCard,
  ArrowLeft,
  Clock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface DigitalCategory {
  id: string;
  name: string;
  icon: React.ElementType;
  description: string;
  color: string;
}

const categories: DigitalCategory[] = [
  { id: 'pulsa', name: 'Pulsa', icon: Smartphone, description: 'Isi ulang pulsa semua operator', color: 'bg-blue-500' },
  { id: 'data', name: 'Paket Data', icon: Wifi, description: 'Kuota internet hemat', color: 'bg-emerald-500' },
  { id: 'pln', name: 'Token PLN', icon: Zap, description: 'Listrik prabayar', color: 'bg-amber-500' },
  { id: 'game', name: 'Voucher Game', icon: Gamepad2, description: 'Top up game favorit', color: 'bg-purple-500' },
  { id: 'e-money', name: 'E-Money', icon: CreditCard, description: 'Top up saldo dompet digital', color: 'bg-indigo-500' },
  { id: 'tv', name: 'TV Kabel', icon: Tv, description: 'Bayar tagihan TV kabel', color: 'bg-rose-500' },
];

export default function DigitalProducts() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 pb-24">
      <div className="max-w-4xl mx-auto px-4 pt-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/kiosk')}
              className="p-2 bg-white dark:bg-zinc-900 rounded-xl shadow-sm hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-zinc-400" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Produk Digital</h1>
              <p className="text-slate-500 dark:text-zinc-500 text-sm">Segera Hadir di Koperasi Kami</p>
            </div>
          </div>
        </div>

        <div className="mb-8 p-6 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/20 flex items-start gap-4">
          <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-2xl h-fit">
            <Clock className="w-6 h-6 text-blue-600 dark:text-blue-500" />
          </div>
          <div>
            <h3 className="font-bold text-blue-900 dark:text-blue-400 mb-1">Fitur Sedang Dikembangkan</h3>
            <p className="text-sm text-blue-800/70 dark:text-blue-500/70 leading-relaxed">
              Saat ini menu digital hanya menampilkan daftar produk yang akan segera tersedia. Fitur pembelian pulsa, paket data, dan produk digital lainnya sedang dalam tahap pengembangan.
            </p>
          </div>
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 md:grid-cols-3 gap-4"
        >
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-slate-100 dark:border-zinc-800 shadow-sm text-left relative overflow-hidden"
            >
              <div className="absolute top-4 right-4 bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded-md">
                <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Segera</span>
              </div>
              <div className={`${cat.color} w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-white`}>
                <cat.icon className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white mb-1">{cat.name}</h3>
              <p className="text-xs text-slate-500 dark:text-zinc-500 leading-relaxed">{cat.description}</p>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
