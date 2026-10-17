import React, { useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * PullToRefresh — bungkus konten scrollable; tarik ke bawah dari posisi paling atas
 * untuk memicu onRefresh. Hanya aktif di perangkat sentuh; di desktop tidak mengganggu.
 */
export default function PullToRefresh({
  onRefresh,
  children,
}: {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
}) {
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const THRESHOLD = 72;

  const handleTouchStart = (e: React.TouchEvent) => {
    const el = containerRef.current;
    if (!el || refreshing) return;
    // Hanya mulai pull jika scroll berada persis di atas.
    if (window.scrollY <= 0) startY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0 && window.scrollY <= 0) {
      // Redaman agar tarikan terasa berat, bukan linear.
      setPull(Math.min(delta * 0.45, THRESHOLD * 1.4));
    }
  };

  const handleTouchEnd = async () => {
    if (startY.current === null) return;
    const shouldRefresh = pull >= THRESHOLD;
    startY.current = null;
    if (shouldRefresh && !refreshing) {
      setRefreshing(true);
      setPull(THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  };

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        aria-hidden={pull === 0}
        className="pointer-events-none flex items-center justify-center overflow-hidden transition-[height] duration-150"
        style={{ height: pull > 0 ? pull : 0 }}
      >
        <RefreshCw
          className={`h-5 w-5 text-blue-500 transition-transform duration-150 ${refreshing ? 'animate-spin' : ''}`}
          style={{ transform: refreshing ? undefined : `rotate(${pull * 3}deg)`, opacity: Math.min(pull / THRESHOLD, 1) }}
        />
      </div>
      {children}
    </div>
  );
}
