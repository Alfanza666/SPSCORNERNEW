import React from 'react';
import { Sparkles } from 'lucide-react';

export default function FormSkeleton() {
  return (
    <div className="w-full rounded-2xl overflow-hidden bg-white/90 dark:bg-zinc-900/90 backdrop-blur-sm border border-zinc-200 dark:border-zinc-800 shadow-xl animate-pulse">
      <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-700" />

      <div className="p-8 md:p-10 space-y-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
          <span className="text-xs font-bold text-purple-500 tracking-widest uppercase">
            AI sedang menyusun formulir...
          </span>
        </div>

        <div className="space-y-3 text-center">
          <div className="h-8 w-2/3 bg-zinc-200 dark:bg-zinc-700 rounded-lg mx-auto" />
          <div className="h-4 w-1/2 bg-zinc-100 dark:bg-zinc-800 rounded-lg mx-auto" />
        </div>

        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-zinc-100 dark:border-zinc-800 p-5 space-y-4"
              style={{ animationDelay: `${i * 150}ms` }}
            >
              <div className="flex items-center gap-2">
                <div className="h-2 w-16 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
                <div className="h-4 w-1/3 bg-zinc-200 dark:bg-zinc-700 rounded-lg" />
              </div>
              <div className="h-10 w-full bg-zinc-100 dark:bg-zinc-800 rounded-xl" />
              <div className="flex gap-2">
                <div className="h-8 w-20 bg-zinc-100 dark:bg-zinc-800 rounded-lg" />
                <div className="h-8 w-20 bg-zinc-100 dark:bg-zinc-800 rounded-lg" />
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <div className="h-10 w-24 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
          <div className="h-10 w-28 bg-zinc-200 dark:bg-zinc-700 rounded-full" />
        </div>
      </div>
    </div>
  );
}
