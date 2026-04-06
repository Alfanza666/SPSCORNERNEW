import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Mail, Phone, MapPin, Clock } from 'lucide-react';
import { motion } from 'motion/react';
import Logo from '../components/ui/logo-utama.png';

export default function Contact() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#e8ebf0] dark:bg-zinc-950 flex flex-col font-sans transition-colors duration-300">
      <header className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 sticky top-0 z-50 shadow-sm dark:shadow-black/20 transition-colors duration-300">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="clay-icon w-10 h-10 bg-white dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
            <img 
              src={Logo} 
              alt="SPS Corner Logo" 
              className="h-12 w-auto object-contain drop-shadow-sm transition-transform group-hover:scale-105" 
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling!.classList.remove('hidden');
              }} 
            />
            <div className="hidden clay-icon-amber w-8 h-8">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg font-black text-zinc-900 dark:text-white tracking-tighter leading-none group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                SPS <span className="text-blue-600 dark:text-blue-400">Corner</span>
              </h1>
            </div>
          </div>
          
          <div className="w-10" /> {/* Spacer for centering */}
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-8 sm:py-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="clay-card p-6 sm:p-10"
        >
          <div className="text-center mb-12">
            <h1 className="text-3xl sm:text-4xl font-black text-zinc-900 dark:text-white mb-4 tracking-tight">Hubungi Kami</h1>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              Punya pertanyaan, keluhan, atau butuh bantuan terkait transaksi di SPS Corner? Tim kami siap membantu Anda.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="flex items-start gap-4 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-3xl border border-blue-100 dark:border-blue-800/30">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-zinc-800 clay-icon-blue flex items-center justify-center flex-shrink-0">
                  <Phone className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-zinc-900 dark:text-white mb-1">Telepon / WhatsApp</h3>
                  <p className="text-zinc-600 dark:text-zinc-400 font-medium">0818222604</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">Senin - Jumat, 08:00 - 17:00 WIB</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-6 bg-amber-50 dark:bg-amber-900/20 rounded-3xl border border-amber-100 dark:border-amber-800/30">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-zinc-800 clay-icon-amber flex items-center justify-center flex-shrink-0">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-black text-zinc-900 dark:text-white mb-1">Email</h3>
                  <p className="text-zinc-600 dark:text-zinc-400 font-medium">Harmonis.bjm@sariroti.com</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">Kami akan membalas dalam 1x24 jam</p>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex items-start gap-4 p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border border-zinc-200 dark:border-zinc-700">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-zinc-800 clay-icon flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div>
                  <h3 className="font-black text-zinc-900 dark:text-white mb-1">Alamat Kantor</h3>
                  <p className="text-zinc-600 dark:text-zinc-400 font-medium leading-relaxed">
                    Bizpark Commercial Estate Blok C2 No.6.<br />
                    Jl. Gubernur Soebardjo, Gambut<br />
                    Kalimantan Selatan
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border border-zinc-200 dark:border-zinc-700">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-zinc-800 clay-icon flex items-center justify-center flex-shrink-0">
                  <Clock className="w-6 h-6 text-zinc-600 dark:text-zinc-400" />
                </div>
                <div>
                  <h3 className="font-black text-zinc-900 dark:text-white mb-1">Jam Operasional Layanan</h3>
                  <p className="text-zinc-600 dark:text-zinc-400 font-medium">
                    Buka 24 Jam<br />
                    Senin - Minggu
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
