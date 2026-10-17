import React from 'react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';

/**
 * EmptyState — keadaan kosong yang menuntun pengguna ke aksi berikutnya.
 * Aturan UX: icon besar + 1 kalimat ramah + 1 tombol aksi (bukan teks pasif).
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  tone = 'blue',
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  tone?: 'blue' | 'emerald' | 'amber';
}) {
  const tones: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-500 dark:bg-blue-900/30 dark:text-blue-400',
    emerald: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-900/30 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-500 dark:bg-amber-900/30 dark:text-amber-400',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center"
    >
      <div className={`flex h-20 w-20 items-center justify-center rounded-3xl ${tones[tone]}`}>
        <Icon className="h-10 w-10 stroke-[1.5]" />
      </div>
      <p className="text-base font-black text-zinc-900 dark:text-white">{title}</p>
      {description && (
        <p className="max-w-xs text-sm font-medium leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 h-11 cursor-pointer rounded-xl bg-blue-600 px-6 text-sm font-bold text-white shadow-sm shadow-blue-600/20 transition-colors duration-200 hover:bg-blue-700"
        >
          {actionLabel}
        </button>
      )}
    </motion.div>
  );
}
