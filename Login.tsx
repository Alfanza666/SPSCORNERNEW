import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, HelpCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../lib/supabase';
import Logo from '../components/ui/logo-utama.png';

export default function FAQ() {
  const navigate = useNavigate();
  const [faqs, setFaqs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFaq = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'faq_content')
          .single();

        if (error) throw error;
        if (data && data.value) {
          setFaqs(JSON.parse(data.value));
        }
      } catch (error) {
        console.error('Error fetching FAQ:', error);
        // Fallback to default
        setFaqs([
          {
            question: "Apa itu SPS Corner?",
            answer: "SPS Corner adalah platform pusat belanja internal untuk karyawan Sariroti, menyediakan berbagai kebutuhan mulai dari produk digital, produk Sariroti, hingga makanan dan minuman."
          },
          {
            question: "Bagaimana cara melakukan pembayaran?",
            answer: "Kami menyediakan berbagai metode pembayaran, termasuk QRIS (Otomatis & Manual), Virtual Account (BCA & Mandiri), dan pemotongan saldo bagi karyawan yang telah mendaftar."
          },
          {
            question: "Apakah saya perlu login untuk berbelanja?",
            answer: "Anda dapat berbelanja dan menggunakan metode pembayaran QRIS Manual atau Redirect Payment tanpa login. Namun, untuk menggunakan metode pembayaran otomatis (QRIS Otomatis, VA) dan melihat riwayat transaksi, Anda diwajibkan untuk login."
          },
          {
            question: "Bagaimana cara kerja QRIS Manual?",
            answer: "Pilih metode QRIS Manual saat checkout, scan kode QR yang ditampilkan menggunakan aplikasi pembayaran Anda, masukkan nominal yang sesuai, lalu unggah bukti transfer. Sistem AI kami akan memverifikasi bukti transfer Anda secara otomatis."
          },
          {
            question: "Berapa lama proses verifikasi pembayaran?",
            answer: "Untuk pembayaran otomatis (QRIS Otomatis & VA), verifikasi dilakukan secara instan. Untuk QRIS Manual, verifikasi oleh AI biasanya memakan waktu kurang dari 1 menit setelah bukti transfer diunggah."
          },
          {
            question: "Bagaimana jika pembayaran saya gagal atau bermasalah?",
            answer: "Jika Anda mengalami kendala pembayaran, silakan hubungi tim dukungan kami melalui halaman 'Hubungi Kami' dengan menyertakan ID Transaksi dan bukti pembayaran."
          }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchFaq();
  }, []);

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
            <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <HelpCircle className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-zinc-900 dark:text-white mb-4 tracking-tight">Frequently Asked Questions (FAQ)</h1>
            <p className="text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
              Temukan jawaban untuk pertanyaan yang sering diajukan seputar layanan SPS Corner.
            </p>
          </div>
          
          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="p-6 bg-zinc-50 dark:bg-zinc-800/50 rounded-3xl border border-zinc-200 dark:border-zinc-700">
                <h3 className="text-lg font-black text-zinc-900 dark:text-white mb-3">{faq.question}</h3>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-3xl border border-blue-100 dark:border-blue-800/30 text-center">
            <h3 className="font-black text-zinc-900 dark:text-white mb-2">Masih Punya Pertanyaan?</h3>
            <p className="text-zinc-600 dark:text-zinc-400 mb-6">Tim dukungan kami siap membantu Anda.</p>
            <button
              onClick={() => navigate('/contact')}
              className="btn-clay-primary px-8 py-3"
            >
              Hubungi Kami
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
