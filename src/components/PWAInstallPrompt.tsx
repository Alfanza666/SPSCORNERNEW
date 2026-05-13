import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import toast from 'react-hot-toast';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      console.log('[PWA] beforeinstallprompt event fired');
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    const handleAppInstalled = () => {
      console.log('[PWA] App installed');
      setShowPrompt(false);
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      toast.error('Install prompt tidak tersedia. Coba buka via HTTPS atau refresh halaman.');
      return;
    }
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] Install outcome:', outcome);
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const triggerManualInstall = () => {
    console.log('[PWA] Manual trigger - checking prompt availability');
    if (deferredPrompt) {
      handleInstallClick();
    } else {
      toast.error('beforeinstallprompt belum tersedia. Pastikan: 1) HTTPS, 2) Sudah interaksi user, 3) Belum terinstall');
    }
  };

  if (isInstalled) return null;

  // Debug: Log PWA status to console
  useEffect(() => {
    console.log('[PWA Debug]', {
      deferredPromptAvailable: !!deferredPrompt,
      showPrompt,
      isStandalone: window.matchMedia('(display-mode: standalone)').matches,
      userAgent: navigator.userAgent
    });
  }, [deferredPrompt, showPrompt]);

  // Auto-show after 5 seconds if prompt available but not showing
  useEffect(() => {
    if (deferredPrompt && !showPrompt) {
      const timer = setTimeout(() => {
        console.log('[PWA] Auto-showing install prompt after delay');
        setShowPrompt(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [deferredPrompt, showPrompt]);

  if (!showPrompt) {
    // Debug button (can be removed in production)
    return (
      <div className="fixed bottom-4 right-4 z-[9999]">
        <button
          onClick={triggerManualInstall}
          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Install App (Debug)
        </button>
      </div>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-4 left-4 right-4 z-[9999] max-w-md mx-auto"
      >
        <div className="bg-blue-600 text-white rounded-2xl shadow-xl p-4 flex items-center justify-between gap-4 border border-blue-500">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-sm">
              <Download className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Install SPS Corner</h3>
              <p className="text-[10px] text-blue-100 font-medium">Akses lebih cepat langsung dari layar utama Anda</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="bg-white text-blue-600 px-4 py-2 rounded-xl text-xs font-bold shadow-sm hover:bg-blue-50 transition-colors"
            >
              Install
            </button>
            <button
              onClick={() => setShowPrompt(false)}
              className="p-2 bg-blue-700/50 hover:bg-blue-700 rounded-xl transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
