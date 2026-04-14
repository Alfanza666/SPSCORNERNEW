import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Step {
  target: string;
  content: string;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

export default function Tutorial() {
  const { user } = useAuthStore();
  const location = useLocation();
  const [run, setRun] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleStartTutorial = () => {
      // For Kiosk, we allow guests to see the tutorial
      const isKiosk = location.pathname === '/kiosk';
      
      if (!user && !isKiosk) return;
      
      const userId = user?.id || 'guest';
      const userRole = user?.role || 'buyer';
      
      localStorage.removeItem(`tutorial_seen_${userId}_${userRole}`);
      
      let currentSteps: Step[] = [];

      if (user?.role === 'admin' && location.pathname === '/dashboard/admin') {
        currentSteps = [
          {
            target: 'body',
            content: 'Selamat datang di Dashboard Admin! Mari kita lihat cara mengelola SPS Corner.',
            placement: 'center',
          },
          {
            target: '.tour-admin-sidebar-overview',
            content: 'Ringkasan: Pantau total pendapatan, jumlah pesanan, dan grafik penjualan secara real-time di sini.',
            placement: 'right',
          },
          {
            target: '.tour-admin-sidebar-sellers',
            content: 'Penjual: Verifikasi pendaftaran penjual baru, atur status aktif/nonaktif, dan pantau performa masing-masing toko.',
            placement: 'right',
          },
          {
            target: '.tour-admin-sidebar-transactions',
            content: 'Transaksi: Lacak semua pesanan yang masuk. Anda bisa melihat detail pembeli, item yang dibeli, dan status pembayaran.',
            placement: 'right',
          },
          {
            target: '.tour-admin-sidebar-withdrawals',
            content: 'Penarikan: Proses pencairan dana (withdraw) dari penjual. Pastikan untuk mentransfer dana sebelum menekan tombol "Setujui".',
            placement: 'right',
          }
        ];
      } else if (user?.role === 'seller' && location.pathname === '/dashboard/seller') {
        currentSteps = [
          {
            target: 'body',
            content: 'Selamat datang di Dashboard Penjual! Mari pelajari cara mengelola toko Anda.',
            placement: 'center',
          },
          {
            target: '.tour-seller-sidebar-overview',
            content: 'Ringkasan: Pantau total penjualan harian dan pesanan yang perlu segera Anda proses.',
            placement: 'right',
          },
          {
            target: '.tour-seller-sidebar-products',
            content: 'Produk: Tambahkan barang dagangan Anda di sini. Pastikan foto menarik, harga sesuai, dan stok selalu di-update agar pembeli tidak kecewa.',
            placement: 'right',
          },
          {
            target: '.tour-seller-sidebar-withdrawals',
            content: 'Penarikan: Tarik saldo pendapatan Anda ke rekening bank. Proses pencairan akan diverifikasi oleh Admin.',
            placement: 'right',
          }
        ];
      } else if ((user?.role === 'buyer' || !user) && location.pathname === '/kiosk') {
        currentSteps = [
          {
            target: 'body',
            content: 'Selamat datang di SPS Corner! Kami akan memandu Anda cara berbelanja produk kantin, koperasi, dan produk digital di sini.',
            placement: 'center',
          },
          {
            target: '.tour-kiosk-kantin',
            content: 'Langkah 1: Pilih Kategori. Klik "Kantin" untuk memesan makanan/minuman segar, atau "Koperasi" untuk perlengkapan sekolah dan roti.',
            placement: 'bottom',
          },
          {
            target: '.tour-kiosk-digital',
            content: 'Langkah 2: Produk Digital. Jika ingin beli Pulsa atau Token PLN, klik di sini. Masukkan nomor HP Anda, dan pilihan paket akan muncul otomatis!',
            placement: 'bottom',
          },
          {
            target: '.tour-product-grid',
            content: 'Langkah 3: Tambah ke Keranjang. Klik tombol "Tambah" pada produk yang Anda inginkan. Anda bisa menambah lebih dari satu item.',
            placement: 'top',
          },
          {
            target: '.tour-kiosk-cart',
            content: 'Langkah 4: Periksa Keranjang. Klik ikon keranjang ini untuk melihat daftar belanjaan Anda, mengisi nama, dan lanjut ke pembayaran.',
            placement: 'bottom',
          },
          {
            target: '.tour-kiosk-history',
            content: 'Langkah Terakhir: Pantau Pesanan. Setelah membayar, klik ikon jam ini. Di sana Anda bisa melihat apakah pesanan kantin sedang diproses atau sudah selesai. Untuk produk digital, nomor SN akan muncul di sana!',
            placement: 'bottom',
          }
        ];
      }

      if (currentSteps.length > 0) {
        setSteps(currentSteps);
        setCurrentStepIndex(0);
        setRun(true);
      }
    };

    window.addEventListener('start-tutorial', handleStartTutorial);
    return () => window.removeEventListener('start-tutorial', handleStartTutorial);
  }, [user, location.pathname]);

  useEffect(() => {
    // For Kiosk, we allow guests to see the tutorial
    const isKiosk = location.pathname === '/kiosk';
    
    if (!user && !isKiosk) return;

    const userId = user?.id || 'guest';
    const userRole = user?.role || 'buyer';
    const hasSeenTutorial = localStorage.getItem(`tutorial_seen_${userId}_${userRole}`);
    
    if (!hasSeenTutorial) {
      let currentSteps: Step[] = [];

      if (user?.role === 'admin' && location.pathname === '/dashboard/admin') {
        currentSteps = [
          {
            target: 'body',
            content: 'Selamat datang di Dashboard Admin! Mari kita lihat cara mengelola SPS Corner.',
            placement: 'center',
          },
          {
            target: '.tour-admin-sidebar-overview',
            content: 'Ringkasan: Pantau total pendapatan, jumlah pesanan, dan grafik penjualan secara real-time di sini.',
            placement: 'right',
          },
          {
            target: '.tour-admin-sidebar-sellers',
            content: 'Penjual: Verifikasi pendaftaran penjual baru, atur status aktif/nonaktif, dan pantau performa masing-masing toko.',
            placement: 'right',
          },
          {
            target: '.tour-admin-sidebar-transactions',
            content: 'Transaksi: Lacak semua pesanan yang masuk. Anda bisa melihat detail pembeli, item yang dibeli, dan status pembayaran.',
            placement: 'right',
          },
          {
            target: '.tour-admin-sidebar-withdrawals',
            content: 'Penarikan: Proses pencairan dana (withdraw) dari penjual. Pastikan untuk mentransfer dana sebelum menekan tombol "Setujui".',
            placement: 'right',
          }
        ];
      } else if (user?.role === 'seller' && location.pathname === '/dashboard/seller') {
        currentSteps = [
          {
            target: 'body',
            content: 'Selamat datang di Dashboard Penjual! Mari pelajari cara mengelola toko Anda.',
            placement: 'center',
          },
          {
            target: '.tour-seller-sidebar-overview',
            content: 'Ringkasan: Pantau total penjualan harian dan pesanan yang perlu segera Anda proses.',
            placement: 'right',
          },
          {
            target: '.tour-seller-sidebar-products',
            content: 'Produk: Tambahkan barang dagangan Anda di sini. Pastikan foto menarik, harga sesuai, dan stok selalu di-update agar pembeli tidak kecewa.',
            placement: 'right',
          },
          {
            target: '.tour-seller-sidebar-withdrawals',
            content: 'Penarikan: Tarik saldo pendapatan Anda ke rekening bank. Proses pencairan akan diverifikasi oleh Admin.',
            placement: 'right',
          }
        ];
      } else if ((user?.role === 'buyer' || !user) && location.pathname === '/kiosk') {
        currentSteps = [
          {
            target: 'body',
            content: 'Selamat datang di SPS Corner! Kami akan memandu Anda cara berbelanja produk kantin, koperasi, dan produk digital di sini.',
            placement: 'center',
          },
          {
            target: '.tour-kiosk-kantin',
            content: 'Langkah 1: Pilih Kategori. Klik "Kantin" untuk memesan makanan/minuman segar, atau "Koperasi" untuk perlengkapan sekolah dan roti.',
            placement: 'bottom',
          },
          {
            target: '.tour-kiosk-digital',
            content: 'Langkah 2: Produk Digital. Jika ingin beli Pulsa atau Token PLN, klik di sini. Masukkan nomor HP Anda, dan pilihan paket akan muncul otomatis!',
            placement: 'bottom',
          },
          {
            target: '.tour-product-grid',
            content: 'Langkah 3: Tambah ke Keranjang. Klik tombol "Tambah" pada produk yang Anda inginkan. Anda bisa menambah lebih dari satu item.',
            placement: 'top',
          },
          {
            target: '.tour-kiosk-cart',
            content: 'Langkah 4: Periksa Keranjang. Klik ikon keranjang ini untuk melihat daftar belanjaan Anda, mengisi nama, dan lanjut ke pembayaran.',
            placement: 'bottom',
          },
          {
            target: '.tour-kiosk-history',
            content: 'Langkah Terakhir: Pantau Pesanan. Setelah membayar, klik ikon jam ini. Di sana Anda bisa melihat apakah pesanan kantin sedang diproses atau sudah selesai. Untuk produk digital, nomor SN akan muncul di sana!',
            placement: 'bottom',
          }
        ];
      }

      if (currentSteps.length > 0) {
        setSteps(currentSteps);
        setCurrentStepIndex(0);
        setTimeout(() => setRun(true), 1000);
      }
    }
  }, [user, location.pathname]);

  useEffect(() => {
    if (!run || steps.length === 0) return;

    const step = steps[currentStepIndex];
    if (step.target === 'body') {
      setTargetRect(null);
      return;
    }

    const updateRect = () => {
      const el = document.querySelector(step.target);
      if (el) {
        setTargetRect(el.getBoundingClientRect());
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        // If element not found, skip to next step or center
        setTargetRect(null);
      }
    };

    updateRect();
    
    // Retry finding the element after a short delay in case of animations
    const timer = setTimeout(updateRect, 500);
    return () => clearTimeout(timer);
  }, [run, currentStepIndex, steps, windowSize]);

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleClose = () => {
    setRun(false);
    const userId = user?.id || 'guest';
    const userRole = user?.role || 'buyer';
    localStorage.setItem(`tutorial_seen_${userId}_${userRole}`, 'true');
  };

  if (!run || steps.length === 0) return null;

  const step = steps[currentStepIndex];
  const isCenter = step.target === 'body' || !targetRect;

  // Calculate tooltip position
  let tooltipStyle: React.CSSProperties = {};
  const isMobile = windowSize.width < 640;
  
  if (!isCenter && targetRect) {
    const padding = 12;
    const tooltipWidth = isMobile ? Math.min(windowSize.width - 24, 300) : 320;
    const tooltipHeight = 160; // Estimated
    
    let top = 0;
    let left = 0;

    if (isMobile) {
      // On mobile, prefer bottom or top center to avoid horizontal overflow
      if (targetRect.bottom + tooltipHeight + padding < windowSize.height) {
        top = targetRect.bottom + padding;
      } else {
        top = targetRect.top - tooltipHeight - padding;
      }
      left = (windowSize.width - tooltipWidth) / 2;
    } else {
      switch (step.placement) {
        case 'top':
          top = targetRect.top - tooltipHeight - padding;
          left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
          break;
        case 'bottom':
          top = targetRect.bottom + padding;
          left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
          break;
        case 'left':
          top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
          left = targetRect.left - tooltipWidth - padding;
          break;
        case 'right':
          top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
          left = targetRect.right + padding;
          break;
        default:
          top = targetRect.bottom + padding;
          left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
      }
    }

    // Constrain to viewport
    if (left < padding) left = padding;
    if (left + tooltipWidth > windowSize.width - padding) left = windowSize.width - tooltipWidth - padding;
    if (top < padding) top = padding;
    if (top + tooltipHeight > windowSize.height - padding) top = windowSize.height - tooltipHeight - padding;

    tooltipStyle = {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${tooltipWidth}px`,
      zIndex: 10001,
    };
  } else {
    const tooltipWidth = isMobile ? Math.min(windowSize.width - 24, 300) : 320;
    tooltipStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: `${tooltipWidth}px`,
      zIndex: 10001,
    };
  }

  return (
    <AnimatePresence>
      {run && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[10000] pointer-events-auto"
            onClick={handleClose}
          >
            {/* Spotlight Hole */}
            {!isCenter && targetRect && (
              <div 
                className="absolute bg-transparent rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] transition-all duration-300"
                style={{
                  top: targetRect.top - 8,
                  left: targetRect.left - 8,
                  width: targetRect.width + 16,
                  height: targetRect.height + 16,
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
                }}
              />
            )}
          </motion.div>

          {/* Tooltip */}
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            style={tooltipStyle}
            className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-100 dark:border-zinc-800 p-5 pointer-events-auto"
          >
            <button 
              onClick={handleClose}
              className="absolute top-3 right-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-6 mt-2">
              <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
                {step.content}
              </p>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="flex gap-1">
                {steps.map((_, idx) => (
                  <div 
                    key={idx} 
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === currentStepIndex 
                        ? 'w-4 bg-blue-600' 
                        : 'w-1.5 bg-zinc-200 dark:bg-zinc-700'
                    }`}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                {currentStepIndex > 0 && (
                  <button
                    onClick={handlePrev}
                    className="p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  {currentStepIndex === steps.length - 1 ? (
                    <>Selesai <Check className="w-3.5 h-3.5" /></>
                  ) : (
                    <>Lanjut <ChevronRight className="w-3.5 h-3.5" /></>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
