import React, { useState } from 'react';
import { Bug, X, Send, AlertTriangle, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuthStore } from '../store/useAuthStore';
import toast from 'react-hot-toast';

export default function FloatingReportButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState('bug');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          message,
          url: window.location.href,
          userAgent: navigator.userAgent,
          userId: user?.id || 'anonymous'
        })
      });
      
      if (!res.ok) throw new Error('Gagal mengirim laporan');
      
      toast.success('Laporan berhasil dikirim. Terima kasih!');
      setIsOpen(false);
      setMessage('');
    } catch (error) {
      toast.error('Gagal mengirim laporan. Silakan coba lagi nanti.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="fixed z-[999] bottom-6 right-6 w-14 h-14 bg-amber-500 hover:bg-amber-600 active:scale-95 transition-all rounded-full shadow-lg shadow-amber-500/20 flex items-center justify-center text-white"
        aria-label="Laporkan Masalah"
      >
        <Bug className="w-6 h-6" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] bg-zinc-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 sm:p-0"
            onClick={() => setIsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                    <Bug className="w-5 h-5 text-amber-600 dark:text-amber-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-white">Ada Masalah?</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Laporkan bug atau beri masukan</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-5">
                <div className="space-y-3">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-widest">
                    Jenis Laporan
                  </label>
                  <div className="grid grid-cols-3 gap-2 text-sm font-medium">
                    <button
                      type="button"
                      onClick={() => setType('bug')}
                      className={`py-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${type === 'bug' ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400' : 'bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800'}`}
                    >
                      <Bug className="w-4 h-4" />
                      <span className="text-[10px]">Bug</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('error')}
                      className={`py-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${type === 'error' ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400' : 'bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800'}`}
                    >
                      <AlertTriangle className="w-4 h-4" />
                      <span className="text-[10px]">Error/Crash</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setType('feedback')}
                      className={`py-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${type === 'feedback' ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-400' : 'bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-700 dark:hover:bg-zinc-800'}`}
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span className="text-[10px]">Masukan</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-widest">
                    Detail Pesan
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Jelaskan apa yang terjadi. Sedetail mungkin lebih baik..."
                    required
                    rows={4}
                    className="w-full px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-800 border-none ring-1 ring-zinc-200 dark:ring-zinc-700 focus:ring-2 focus:ring-amber-500 dark:text-white resize-none text-sm placeholder:text-zinc-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !message.trim()}
                  className="w-full h-12 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:hover:bg-amber-500 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Kirim Laporan
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
