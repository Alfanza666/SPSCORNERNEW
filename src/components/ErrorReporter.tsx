import React, { useEffect, useState, useCallback, useRef } from 'react';
import * as Sentry from '@sentry/react';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';
import { Bug, X, Send, Loader2, CheckCircle2, Terminal, Info, Globe, Monitor } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

/**
 * ErrorReporter — Enhanced Autonomous System:
 * 1. Captures Unhandled Exceptions (window.onerror)
 * 2. Captures Unhandled Promise Rejections
 * 3. Captures Console Errors (Intercepts console.error)
 * 4. Tracks Breadcrumbs (Last 10 user interactions)
 * 5. Provides Manual Reporting for Users
 */
export default function ErrorReporter() {
  const { user } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  
  // Breadcrumbs to track user path before error
  const breadcrumbs = useRef<{ type: string; value: string; time: string }[]>([]);

  const addBreadcrumb = useCallback((type: string, value: string) => {
    breadcrumbs.current = [
      { type, value, time: new Date().toISOString() },
      ...breadcrumbs.current
    ].slice(0, 15); // Keep last 15 actions
  }, []);

  const autoCaptureError = useCallback(async (errorData: any) => {
    // Skip known non-critical noise
    const msg = String(errorData.message || '').toLowerCase();
    if (
      msg.includes('resizeobserver') ||
      msg.includes('script error') ||
      msg.includes('non-error promise rejection') ||
      msg.includes('extension')
    ) return;

    // Forward to Sentry if configured
    if (errorData.stack) {
      Sentry.captureException(new Error(errorData.message), {
        extra: { ...errorData, breadcrumbs: breadcrumbs.current },
      });
    } else {
      Sentry.captureMessage(errorData.message, 'error');
    }

    try {
      await supabase.from('reports').insert({
        user_id: user?.id || null,
        user_name: user?.name || 'Guest/System',
        type: 'crash',
        message: `[AUTO] ${errorData.type}: ${errorData.message.substring(0, 200)}`,
        status: 'pending',
        metadata: {
          ...errorData,
          breadcrumbs: breadcrumbs.current,
          url: window.location.href,
          userAgent: navigator.userAgent,
          screen: `${window.screen.width}x${window.screen.height}`,
          language: navigator.language,
          timestamp: new Date().toISOString(),
          connection: (navigator as any).connection?.effectiveType || 'unknown'
        }
      });
    } catch (e) {
      console.warn('[ErrorReporter] Failed to auto-capture:', e);
    }
  }, [user]);

  useEffect(() => {
    // 1. Intercept Global Errors
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

    // 2. Intercept Promise Rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      autoCaptureError({
        type: 'promise_rejection',
        message: String(event.reason?.message || event.reason),
        stack: event.reason?.stack
      });
    };

    // 3. Intercept Console Errors (Autonomous)
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
      if (!msg.includes('[ErrorReporter]')) {
        autoCaptureError({
          type: 'console_error',
          message: msg,
          stack: new Error().stack
        });
      }
      originalConsoleError.apply(console, args);
    };

    // 4. Track Clicks as Breadcrumbs
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const className = typeof target.className === 'string' ? target.className : (target.getAttribute && target.getAttribute('class')) || '';
      const info = target.tagName + (target.id ? `#${target.id}` : '') + (className ? `.${className.split(' ')[0]}` : '');
      addBreadcrumb('click', info);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    window.addEventListener('click', handleGlobalClick);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('click', handleGlobalClick);
      console.error = originalConsoleError;
    };
  }, [autoCaptureError, addBreadcrumb]);

  const handleSubmitManual = async () => {
    if (!message.trim()) return;
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
          breadcrumbs: breadcrumbs.current,
          timestamp: new Date().toISOString()
        }
      });
      if (error) throw error;
      setSent(true);
      setMessage('');
      toast.success('Laporan terkirim! Terima kasih bantuannya.');
      setTimeout(() => {
        setShowForm(false);
        setSent(false);
      }, 2000);
    } catch (err: any) {
      toast.error('Gagal kirim: ' + err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <motion.button
        initial={{ scale: 0, rotate: -45 }}
        animate={{ scale: 1, rotate: 0 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setShowForm(true)}
        className="fixed bottom-24 right-4 z-[9999] w-12 h-12 bg-red-600 text-white rounded-2xl shadow-2xl flex items-center justify-center transition-all sm:bottom-8 sm:right-8 group"
      >
        <Bug className="w-6 h-6 group-hover:animate-bounce" />
        <span className="absolute right-full mr-3 px-3 py-1.5 bg-zinc-900 text-white text-[10px] font-bold rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap hidden sm:block shadow-xl">
          Lapor Masalah
        </span>
      </motion.button>

      {/* Modal Interface */}
      <AnimatePresence>
        {showForm && (
          <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md" onClick={() => setShowForm(false)}>
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-zinc-950 w-full sm:max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-red-600 rounded-3xl flex items-center justify-center shadow-lg shadow-red-500/20">
                      <Bug className="w-7 h-7 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-zinc-900 dark:text-white tracking-tight">Lapor Masalah</h3>
                      <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">SPS Corner Support</p>
                    </div>
                  </div>
                  <button onClick={() => setShowForm(false)} className="w-10 h-10 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center text-zinc-500 hover:scale-110 transition-transform">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {sent ? (
                  <div className="py-12 text-center">
                    <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                      <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    </div>
                    <h4 className="text-xl font-black text-zinc-900 dark:text-white mb-2">Berhasil Terkirim!</h4>
                    <p className="text-sm text-zinc-500 font-medium px-8">Tim kami akan segera memeriksa laporan Anda secara otomatis.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-3xl border border-zinc-100 dark:border-zinc-800 space-y-3">
                      <div className="flex items-center gap-3 text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                        <Terminal className="w-3 h-3 text-red-500" /> Informasi Teknis Otomatis
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500">
                          <Globe className="w-3 h-3" /> {window.location.pathname}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500">
                          <Monitor className="w-3 h-3" /> {window.screen.width}x{window.screen.height}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.2em] ml-2">Apa yang terjadi?</label>
                      <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        placeholder="Contoh: 'Halaman kiosk macet saat saya klik bayar...'"
                        className="w-full min-h-[140px] bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-6 text-sm font-bold text-zinc-900 dark:text-white outline-none focus:ring-4 focus:ring-red-500/10 transition-all resize-none"
                      />
                    </div>

                    <button
                      onClick={handleSubmitManual}
                      disabled={sending || !message.trim()}
                      className="w-full h-16 bg-red-600 hover:bg-red-700 text-white rounded-[2rem] font-black text-sm flex items-center justify-center gap-3 shadow-xl shadow-red-600/20 transition-all disabled:opacity-50 disabled:grayscale active:scale-95"
                    >
                      {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                      KIRIM LAPORAN SEKARANG
                    </button>

                    <div className="flex items-center gap-2 justify-center py-2">
                      <Info className="w-3 h-3 text-zinc-300" />
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest text-center">
                        Privasi Anda Terjamin & Laporan Terenkripsi
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
