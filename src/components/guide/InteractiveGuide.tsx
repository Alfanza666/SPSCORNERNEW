import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { X, ChevronRight, ChevronLeft, Check, HelpCircle, RotateCcw, Eye, EyeOff, BookOpen, Sparkles, MousePointer2, Hand } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getGuideForPage, resetAllGuides, GuideStep } from './guideData';
import { useAuthStore } from '../../store/useAuthStore';

interface Props {
  userId?: string;
  role?: string;
  onRequestRestart?: () => void;
}

const STEP_ICONS: Record<string, React.ReactNode> = {
  welcome: <Sparkles className="w-4 h-4" />,
  click: <MousePointer2 className="w-4 h-4" />,
  info: <BookOpen className="w-4 h-4" />,
};

export default function InteractiveGuide({ userId, role, onRequestRestart }: Props) {
  const location = useLocation();
  const { user } = useAuthStore();
  const [isVisible, setIsVisible] = useState(false);
  const [steps, setSteps] = useState<GuideStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0, width: 380 });
  const [isDismissed, setIsDismissed] = useState(false);
  const retryRef = useRef<number | null>(null);
  const [tooltipAnchor, setTooltipAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showHandAnimation, setShowHandAnimation] = useState(false);
  const [pulseKey, setPulseKey] = useState(0);

  const resolvedUserId = userId || user?.id || 'guest';
  const resolvedRole = role || user?.role || 'buyer';

  const getStorageKey = useCallback((page: string) => {
    return `guide_seen_${page}_${resolvedRole}_${resolvedUserId}`;
  }, [resolvedRole, resolvedUserId]);

  const loadGuide = useCallback(() => {
    const guide = getGuideForPage(location.pathname, resolvedRole);
    if (!guide) {
      setSteps([]);
      setIsVisible(false);
      return;
    }

    setSteps(guide.steps);
    setCurrentStep(0);
    setSpotlightRect(null);
    setTooltipAnchor(null);
  }, [location.pathname, resolvedRole]);

  useEffect(() => {
    loadGuide();
  }, [loadGuide]);

  useEffect(() => {
    if (steps.length === 0 || currentStep >= steps.length) return;

    const step = steps[currentStep];
    if (step.selector === 'body') {
      setSpotlightRect(null);
      setTooltipAnchor(null);
      setTooltipPos({ top: window.innerHeight / 2 - 140, left: (window.innerWidth - 380) / 2, width: 380 });
      setShowHandAnimation(false);
      return;
    }

    if (retryRef.current) clearTimeout(retryRef.current);

    const findAndPosition = () => {
      const el = document.querySelector(step.selector);
      if (!el) {
        setSpotlightRect(null);
        setTooltipAnchor(null);
        return;
      }

      const rect = el.getBoundingClientRect();
      setSpotlightRect(rect);
      setTooltipAnchor({ x: rect.left, y: rect.top, w: rect.width, h: rect.height });
      setPulseKey(prev => prev + 1);

      el.scrollIntoView({ behavior: 'smooth', block: 'center' });

      setTimeout(() => setShowHandAnimation(true), 300);
      setTimeout(() => setShowHandAnimation(false), 2000);

      const tooltipWidth = Math.min(380, window.innerWidth - 32);
      const padding = 16;
      const tooltipHeight = 200;

      let top = 0;
      let left = 0;
      const placement = step.placement || 'bottom';

      switch (placement) {
        case 'top':
          top = rect.top - tooltipHeight - padding;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case 'bottom':
          top = rect.bottom + padding;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case 'left':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.left - tooltipWidth - padding;
          break;
        case 'right':
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.right + padding;
          break;
        default:
          if (rect.bottom + tooltipHeight + padding < window.innerHeight) {
            top = rect.bottom + padding;
            left = rect.left + rect.width / 2 - tooltipWidth / 2;
          } else {
            top = rect.top - tooltipHeight - padding;
            left = rect.left + rect.width / 2 - tooltipWidth / 2;
          }
      }

      if (left < padding) left = padding;
      if (left + tooltipWidth > window.innerWidth - padding) left = window.innerWidth - tooltipWidth - padding;
      if (top < padding) top = padding;
      if (top + tooltipHeight > window.innerHeight - padding) top = window.innerHeight - tooltipHeight - padding;

      setTooltipPos({ top, left, width: tooltipWidth });
    };

    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 500);
    setTimeout(findAndPosition, 300);
    retryRef.current = window.setTimeout(findAndPosition, 800);

    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [steps, currentStep]);

  useEffect(() => {
    if (steps.length === 0) return;

    const storageKey = getStorageKey(location.pathname);
    const hasSeen = sessionStorage.getItem(storageKey) || localStorage.getItem(storageKey);

    if (!hasSeen && !isDismissed) {
      setTimeout(() => setIsVisible(true), 800);
    }
  }, [steps, location.pathname, isDismissed, getStorageKey]);

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem(getStorageKey(location.pathname), 'true');
    sessionStorage.setItem(`guide_dismissed_${location.pathname}`, 'true');
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleFinish = () => {
    setIsVisible(false);
    localStorage.setItem(getStorageKey(location.pathname), 'true');
  };

  const handleRestart = () => {
    localStorage.removeItem(getStorageKey(location.pathname));
    setCurrentStep(0);
    setIsDismissed(false);
    setIsVisible(true);
  };

  if (steps.length === 0) return null;
  if (!isVisible) return null;

  const step = steps[currentStep];
  const stepType = step.optional ? 'info' : currentStep === 0 ? 'welcome' : 'click';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[99998] pointer-events-none"
      >
        <AnimatePresence>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-[2px]"
          />
        </AnimatePresence>

        {tooltipAnchor && (
          <>
            <motion.div
              key={`spotlight-${pulseKey}`}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              className="fixed rounded-2xl pointer-events-none"
              style={{
                top: tooltipAnchor.y - 12,
                left: tooltipAnchor.x - 12,
                width: tooltipAnchor.w + 24,
                height: tooltipAnchor.h + 24,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.7)',
              }}
            />
            <motion.div
              key={`pulse-${pulseKey}`}
              initial={{ scale: 1, opacity: 0.8 }}
              animate={{ scale: [1, 1.05, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="fixed rounded-2xl pointer-events-none border-4 border-blue-500"
              style={{
                top: tooltipAnchor.y - 16,
                left: tooltipAnchor.x - 16,
                width: tooltipAnchor.w + 32,
                height: tooltipAnchor.h + 32,
              }}
            />
            {showHandAnimation && (
              <motion.div
                key={`hand-${currentStep}`}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1, x: [0, 10, 0], y: [0, -5, 0] }}
                transition={{ duration: 1.5, repeat: 2 }}
                className="fixed pointer-events-none z-[99997]"
                style={{
                  top: tooltipAnchor.y + tooltipAnchor.h / 2 - 20,
                  left: tooltipAnchor.x + tooltipAnchor.w + 10,
                }}
              >
                <Hand className="w-8 h-8 text-blue-400 drop-shadow-lg" />
              </motion.div>
            )}
          </>
        )}

        <AnimatePresence>
          <motion.div
            key={`tooltip-${currentStep}`}
            initial={{ opacity: 0, scale: 0.85, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed bg-gradient-to-br from-white to-blue-50 dark:from-zinc-900 dark:to-zinc-800 rounded-3xl shadow-2xl border border-blue-100 dark:border-blue-900/50 pointer-events-auto overflow-hidden"
            style={{
              top: `${tooltipPos.top}px`,
              left: `${tooltipPos.left}px`,
              width: `${tooltipPos.width}px`,
              maxWidth: 'calc(100vw - 32px)',
              zIndex: 99999,
            }}
          >
            <div className="relative p-5">
              <motion.div
                animate={{ rotate: isAnimating ? [0, -5, 5, 0] : 0 }}
                transition={{ duration: 0.5 }}
              >
                <button
                  onClick={handleClose}
                  className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  title="Tutup panduan"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>

              <div className="pr-8">
                <div className="flex items-center gap-3 mb-3">
                  <motion.div
                    key={`step-num-${currentStep}`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                      currentStep === 0 
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
                        : 'bg-gradient-to-br from-blue-600 to-blue-700'
                    } text-white shadow-lg`}
                  >
                    {STEP_ICONS[stepType] || <span className="text-sm font-black">{currentStep + 1}</span>}
                  </motion.div>
                  <div>
                    <h3 className="text-sm font-black text-blue-600 dark:text-blue-400 uppercase tracking-tight">
                      {step.title}
                    </h3>
                    <p className="text-[10px] text-blue-400 dark:text-blue-500 font-medium">
                      Langkah {currentStep + 1} dari {steps.length}
                    </p>
                  </div>
                </div>
                <div className="bg-white/60 dark:bg-zinc-800/60 rounded-2xl p-4 backdrop-blur-sm">
                  <p className="text-[13px] text-zinc-700 dark:text-zinc-200 leading-relaxed">
                    {step.content}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-blue-100 dark:border-blue-900/50">
                <div className="flex items-center gap-1.5">
                  {steps.map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className={`h-2 rounded-full transition-all duration-500 ${
                        i === currentStep
                          ? 'w-6 bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg shadow-blue-500/50'
                          : i < currentStep
                          ? 'w-2 bg-blue-400'
                          : 'w-2 bg-zinc-200 dark:bg-zinc-700'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  {currentStep > 0 && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handlePrev}
                      className="flex items-center gap-1 px-4 py-2 text-[11px] font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </motion.button>
                  )}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleNext}
                    className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white text-[11px] font-bold rounded-xl transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50"
                  >
                    {currentStep === steps.length - 1 ? (
                      <>
                        Selesai
                        <Check className="w-4 h-4" />
                      </>
                    ) : (
                      <>
                        Lanjut
                        <ChevronRight className="w-4 h-4" />
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-zinc-800/80 dark:to-blue-900/20 border-t border-blue-100 dark:border-blue-900/50">
              <button
                onClick={handleRestart}
                className="flex items-center gap-1.5 text-[10px] font-bold text-blue-600 hover:text-blue-800 dark:hover:text-blue-400 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Mulai Ulang
              </button>
              <span className="text-blue-200 dark:text-blue-800 text-[8px]">|</span>
              <button
                onClick={handleClose}
                className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              >
                <EyeOff className="w-3 h-3" />
                Jangan Tampilkan lagi
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

export function RestartGuideButton() {
  const { user } = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);

  const handleRestart = (page: string) => {
    if (!user) return;
    localStorage.removeItem(`guide_seen_${page}_${user.role}_${user.id}`);
    window.location.reload();
  };

  if (!user) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative"
    >
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowMenu(v => !v)}
        className="flex items-center gap-2 px-4 py-2 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/20 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/40 dark:hover:to-indigo-900/30 rounded-xl transition-all border border-blue-200 dark:border-blue-800 shadow-sm"
      >
        <HelpCircle className="w-4 h-4" />
        Panduan
      </motion.button>

      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-full right-0 mt-2 w-52 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-100 dark:border-zinc-800 z-50 overflow-hidden"
          >
            <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
              <p className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-wider">Panduan per Halaman</p>
            </div>
            <div className="border-t border-zinc-100 dark:border-zinc-800">
              {user.role === 'buyer' || user.role === undefined ? (
                <>
                  {['/kiosk', '/kiosk/cart', '/kiosk/checkout', '/kiosk/digital', '/kiosk/preorder', '/portal/profile'].map((page, idx) => (
                    <motion.button
                      key={page}
                      initial={{ x: -10, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => { handleRestart(page); setShowMenu(false); }}
                      className="w-full text-left px-4 py-3 text-[12px] font-medium text-zinc-600 dark:text-zinc-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 transition-colors flex items-center gap-2"
                    >
                      <span className="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                        {idx + 1}
                      </span>
                      {page === '/kiosk' ? 'Katalog' :
                       page === '/kiosk/cart' ? 'Keranjang' :
                       page === '/kiosk/checkout' ? 'Checkout' :
                       page === '/kiosk/digital' ? 'Digital' :
                       page === '/kiosk/preorder' ? 'Pre-Order' :
                       page === '/portal/profile' ? 'Profil' : page}
                    </motion.button>
                  ))}
                </>
              ) : user.role === 'seller' ? (
                <>
                  {['/dashboard/seller', '/dashboard/seller/products', '/dashboard/seller/transactions', '/dashboard/seller/withdrawals', '/dashboard/seller/pre-orders'].map((page, idx) => (
                    <motion.button
                      key={page}
                      initial={{ x: -10, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => { handleRestart(page); setShowMenu(false); }}
                      className="w-full text-left px-4 py-3 text-[12px] font-medium text-zinc-600 dark:text-zinc-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 transition-colors flex items-center gap-2"
                    >
                      <span className="w-6 h-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                        {idx + 1}
                      </span>
                      {page === '/dashboard/seller' ? 'Dashboard' :
                       page === '/dashboard/seller/products' ? 'Produk' :
                       page === '/dashboard/seller/transactions' ? 'Transaksi' :
                       page === '/dashboard/seller/withdrawals' ? 'Penarikan' :
                       page === '/dashboard/seller/pre-orders' ? 'Pre-Order' : page}
                    </motion.button>
                  ))}
                </>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}