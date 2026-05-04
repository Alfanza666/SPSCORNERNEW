import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { Bug, X, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

/**
 * ErrorReporter — Global error boundary helper that:
 * 1. Intercepts unhandled JS errors and promise rejections
 * 2. Auto-saves crash logs to the `reports` table in Supabase
 * 3. Renders a floating "Laporkan Masalah" button in the kiosk
 * 4. Provides a modal form for manual bug reports from users
 */
export default function ErrorReporter() {
  const { user } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  // ── Auto-capture JS errors ────────────────────────────────────────────────
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      autoCaptureError({
        type: 'js_error',
        message: event.message,
        source: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      autoCaptureError({
        type: 'unhandled_promise',
        message: String(event.reason),
        stack: event.reason?.stack
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [user]);

  const autoCaptureError = useCallback(async (errorData: any) => {
    // Skip known non-critical errors
    const msg = String(errorData.message || '').toLowerCase();
    if (
      msg.includes('resizeobserver') ||
      msg.includes('script error') ||
      msg.includes('non-error promise rejection')
    ) return;

    try {
      await supabase.from('reports').insert({
        user_id: user?.id || null,
        user_name: user?.name || 'Guest',
        type: 'crash',
        message: `[AUTO] ${errorData.type}: ${errorData.message}`,
        status: 'pending',
        metadata: {
          ...errorData,
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      });
    } catch (e) {
      // Silent fail — don't create infinite error loops
      console.warn('[ErrorReporter] Failed to auto-capture error:', e);
    }
  }, [user]);

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast.error('Tulis deskripsi masalahnya dahulu');
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.from('reports').insert({
        user_id: user?.id || null,
        user_name: user?.name || 'Guest / Tamu',
        type: 'bug',
        message: message.trim(),
        status: 'pending',
        metadata: {
          url: window.location.href,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        }
      });

      if (error) throw error;

      setSent(true);
      setMessage('');
      toast.success('Laporan terkirim! Admin akan segera menindaklanjuti.');
      setTimeout(() => {
        setShowForm(false);
        setSent(false);
      }, 2500);
    } catch (err: any) {
      toast.error('Gagal mengirim laporan: ' + (err.message || 'Unknown error'));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating Bug Report Button */}
      <button
        id="bug-report-btn"
        onClick={() => setShowForm(true)}
        className="fixed bottom-24 right-4 z-30 w-10 h-10 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95 sm:bottom-6 sm:right-6"
        title="Laporkan Masalah"
        aria-label="Laporkan Masalah"
      >
        <Bug className="w-4 h-4" />
      </button>

      {/* Bug Report Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowForm(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', bounce: 0.2 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 border border-zinc-100 dark:border-zinc-800"
            >
              {/* Handle */}
              <div className="flex justify-center mb-4 sm:hidden">
                <div className="w-10 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
              </div>

              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center">
                    <Bug className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h3 className="font-black text-zinc-900 dark:text-white text-sm">Laporkan Masalah</h3>
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">Bantu kami memperbaiki aplikasi</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowForm(false)}
                  className="w-8 h-8 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {sent ? (
                <div className="text-center py-6">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                  <p className="font-black text-zinc-900 dark:text-white mb-1">Laporan Terkirim!</p>
                  <p className="text-sm text-zinc-500">Admin akan segera menindaklanjuti.</p>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-widest">
                      Ceritakan masalah yang Anda temukan
                    </label>
                    <textarea
                      value={message}
                      onChange={e => setMessage(e.target.value)}
                      rows={4}
                      placeholder="Contoh: Saya tidak bisa checkout, tombol bayar tidak muncul setelah saya pilih QRIS..."
                      className="w-full border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-red-400 resize-none font-medium"
                      maxLength={500}
                    />
                    <p className="text-[10px] text-zinc-300 dark:text-zinc-600 mt-1 text-right">{message.length}/500</p>
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={sending || !message.trim()}
                    className="w-full h-12 bg-red-500 hover:bg-red-600 text-white rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {sending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Mengirim...</>
                    ) : (
                      <><Send className="w-4 h-4" /> Kirim Laporan</>
                    )}
                  </button>

                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 text-center mt-3">
                    Laporan Anda akan langsung diterima oleh admin SPS Corner.
                  </p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
