import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { X, ChevronRight, ChevronLeft, Check, HelpCircle, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getGuideForPage, resetAllGuides, GuideStep } from './guideData';
import { useAuthStore } from '../../store/useAuthStore';

interface Props {
  userId?: string;
  role?: string;
  onRequestRestart?: () => void;
}

export default function InteractiveGuide({ userId, role, onRequestRestart }: Props) {
  const location = useLocation();
  const { user } = useAuthStore();
  const [isVisible, setIsVisible] = useState(false);
  const [steps, setSteps] = useState<GuideStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0, width: 360 });
  const [isDismissed, setIsDismissed] = useState(false);
  const retryRef = useRef<number | null>(null);
  const [tooltipAnchor, setTooltipAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

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
      setTooltipPos({ top: window.innerHeight / 2 - 120, left: (window.innerWidth - 360) / 2, width: 360 });
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

      el.scrollIntoView({ behavior: 'smooth', block: 'center' });

      const tooltipWidth = Math.min(360, window.innerWidth - 32);
      const padding = 16;
      const tooltipHeight = 180;

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
      setTimeout(() => setIsVisible(true), 600);
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

  const step = steps[currentStep];
  if (!isVisible) return null;

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
            className="fixed inset-0 bg-black/60 pointer-events-auto"
          />
        </AnimatePresence>

        {tooltipAnchor && (
          <div
            className="fixed rounded-xl pointer-events-none"
            style={{
              top: tooltipAnchor.y - 8,
              left: tooltipAnchor.x - 8,
              width: tooltipAnchor.w + 16,
              height: tooltipAnchor.h + 16,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
              borderRadius: '12px',
            }}
          />
        )}

        <motion.div
          key="tooltip"
          initial={{ opacity: 0, scale: 0.92, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', damping: 28, stiffness: 350 }}
          className="fixed bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-100 dark:border-zinc-800 pointer-events-auto overflow-hidden"
          style={{
            top: `${tooltipPos.top}px`,
            left: `${tooltipPos.left}px`,
            width: `${tooltipPos.width}px`,
            maxWidth: 'calc(100vw - 32px)',
            zIndex: 99999,
          }}
        >
          <div className="relative p-5">
            <button
              onClick={handleClose}
              className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Tutup panduan"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="pr-7">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-black shrink-0">
                  {currentStep + 1}
                </div>
                <h3 className="text-sm font-black text-blue-600 dark:text-blue-400 uppercase tracking-tight">
                  {step.title}
                </h3>
              </div>
              <p className="text-[13px] text-zinc-600 dark:text-zinc-300 leading-relaxed">
                {step.content}
              </p>
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-1.5">
                {steps.map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      i === currentStep
                        ? 'w-5 bg-blue-600'
                        : i < currentStep
                        ? 'w-1.5 bg-blue-400'
                        : 'w-1.5 bg-zinc-200 dark:bg-zinc-700'
                    }`}
                  />
                ))}
                <span className="text-[10px] text-zinc-400 ml-1 font-medium">
                  {currentStep + 1}/{steps.length}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {currentStep > 0 && (
                  <button
                    onClick={handlePrev}
                    className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                )}
                <button
                  onClick={handleNext}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-colors shadow-sm"
                >
                  {currentStep === steps.length - 1 ? (
                    <>
                      Selesai
                      <Check className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      Lanjut
                      <ChevronRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 px-5 py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={handleRestart}
              className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Mulai Ulang
            </button>
            <span className="text-zinc-200 dark:text-zinc-700 text-[8px]">|</span>
            <button
              onClick={handleClose}
              className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              <EyeOff className="w-3 h-3" />
              Jangan Tampilkan lagi
            </button>
          </div>
        </motion.div>
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
    <div className="relative">
      <button
        onClick={() => setShowMenu(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors border border-blue-200 dark:border-blue-800"
      >
        <HelpCircle className="w-3.5 h-3.5" />
        Panduan
      </button>

      {showMenu && (
        <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-100 dark:border-zinc-800 z-50 overflow-hidden">
          <div className="p-2">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider px-2 py-1">Panduan per Halaman</p>
          </div>
          <div className="border-t border-zinc-100 dark:border-zinc-800">
            {user.role === 'buyer' || user.role === undefined ? (
              <>
                {['/kiosk', '/kiosk/cart', '/kiosk/checkout', '/kiosk/digital', '/kiosk/preorder', '/kiosk/profile'].map(page => (
                  <button
                    key={page}
                    onClick={() => { handleRestart(page); setShowMenu(false); }}
                    className="w-full text-left px-3 py-2 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {page === '/kiosk' ? 'Katalog' :
                     page === '/kiosk/cart' ? 'Keranjang' :
                     page === '/kiosk/checkout' ? 'Checkout' :
                     page === '/kiosk/digital' ? 'Digital' :
                     page === '/kiosk/preorder' ? 'Pre-Order' :
                     page === '/kiosk/profile' ? 'Profil' : page}
                  </button>
                ))}
              </>
            ) : user.role === 'seller' ? (
              <>
                {['/dashboard/seller', '/dashboard/seller/products', '/dashboard/seller/transactions', '/dashboard/seller/withdrawals', '/dashboard/seller/pre-orders'].map(page => (
                  <button
                    key={page}
                    onClick={() => { handleRestart(page); setShowMenu(false); }}
                    className="w-full text-left px-3 py-2 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                  >
                    {page === '/dashboard/seller' ? 'Dashboard' :
                     page === '/dashboard/seller/products' ? 'Produk' :
                     page === '/dashboard/seller/transactions' ? 'Transaksi' :
                     page === '/dashboard/seller/withdrawals' ? 'Penarikan' :
                     page === '/dashboard/seller/pre-orders' ? 'Pre-Order' : page}
                  </button>
                ))}
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}