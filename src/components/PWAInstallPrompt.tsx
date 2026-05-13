import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI to notify the user they can add to home screen
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // If already installed, don't show
    window.addEventListener('appinstalled', () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

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
