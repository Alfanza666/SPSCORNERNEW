@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
@import "tailwindcss";
@plugin "@tailwindcss/typography";

@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, SFMono-Regular, monospace;

  /* Sariroti Brand Colors */
  --color-sariroti-blue: #0054a6;
  --color-sariroti-yellow: #ffcc00;
  
  /* Override blue to be Sariroti Blue */
  --color-blue-50: #eef7ff;
  --color-blue-100: #d9eeff;
  --color-blue-200: #bcdfff;
  --color-blue-300: #8ecbff;
  --color-blue-400: #58aeff;
  --color-blue-500: #318fff;
  --color-blue-600: #0054a6; /* Primary */
  --color-blue-700: #1469c1;
  --color-blue-800: #17569c;
  --color-blue-900: #184881;
  --color-blue-950: #102d54;

  /* Override amber to be Sariroti Yellow */
  --color-amber-50: #fffbeb;
  --color-amber-100: #fff3c7;
  --color-amber-200: #ffe68a;
  --color-amber-300: #ffd34d;
  --color-amber-400: #ffcc00; /* Primary */
  --color-amber-500: #f59e0b;
  --color-amber-600: #d97706;
  --color-amber-700: #b45309;
  --color-amber-800: #92400e;
  --color-amber-900: #78350f;
  --color-amber-950: #451a03;
}

@layer base {
  body {
    /* Slightly more tinted background for better contrast with white cards, dark mode support */
    @apply bg-[#e8ebf0] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans antialiased selection:bg-blue-100 selection:text-blue-900 dark:selection:bg-blue-900 dark:selection:text-blue-100;
  }
}

@layer components {
  /* Clean White Cards - Replaces old clay style */
  .clay-card {
    @apply bg-white dark:bg-zinc-900 rounded-2xl sm:rounded-3xl border border-zinc-100 dark:border-zinc-800 shadow-sm transition-all duration-300;
  }
  
  .dark .clay-card {
    @apply shadow-none;
  }

  .clay-card-lg {
    @apply bg-white dark:bg-zinc-900 rounded-3xl sm:rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm transition-all duration-300;
  }

  .dark .clay-card-lg {
    @apply shadow-none;
  }

  .clay-card:hover {
    @apply shadow-md dark:shadow-none;
  }

  .clay-card-lg:hover {
    @apply shadow-md dark:shadow-none;
  }

  .clay-card-blue {
    @apply bg-blue-600 dark:bg-blue-700 text-white rounded-2xl sm:rounded-3xl shadow-sm border border-blue-500 dark:border-blue-600;
  }

  .clay-card-blue-lg {
    @apply bg-blue-600 dark:bg-blue-700 text-white rounded-3xl sm:rounded-[2rem] shadow-sm border border-blue-500 dark:border-blue-600;
  }

  .clay-card-amber {
    @apply bg-amber-400 dark:bg-amber-500 text-amber-950 dark:text-amber-950 rounded-2xl sm:rounded-3xl shadow-sm border border-amber-300 dark:border-amber-400;
  }

  /* Clean Buttons */
  .btn-clay-primary {
    @apply px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 dark:bg-blue-700 text-white font-bold rounded-xl transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm hover:bg-blue-700 dark:hover:bg-blue-600 hover:shadow-md hover:-translate-y-0.5;
  }

  .btn-clay-primary-lg {
    @apply px-4 py-2 sm:px-6 sm:py-3 bg-blue-600 dark:bg-blue-700 text-white font-bold rounded-xl sm:rounded-2xl transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm hover:bg-blue-700 dark:hover:bg-blue-600 hover:shadow-md hover:-translate-y-0.5;
  }

  .btn-clay-primary:hover {
    /* Handled via @apply */
  }

  .btn-clay-secondary {
    @apply px-3 py-1.5 sm:px-4 sm:py-2 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 sm:gap-2 border border-zinc-200 dark:border-zinc-700 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-700 hover:shadow-md hover:-translate-y-0.5;
  }

  .dark .btn-clay-secondary {
    @apply shadow-none;
  }

  .btn-clay-danger {
    @apply px-3 py-1.5 sm:px-4 sm:py-2 bg-red-500 dark:bg-red-600 text-white font-bold rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 sm:gap-2 shadow-sm hover:bg-red-600 dark:hover:bg-red-500 hover:shadow-md hover:-translate-y-0.5;
  }

  /* Clean Inputs */
  .input-clay {
    @apply w-full px-3 py-1.5 sm:px-4 sm:py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none transition-all font-medium text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 shadow-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500;
  }

  .dark .input-clay {
    @apply shadow-none;
  }

  .input-clay:focus {
    /* Handled via @apply */
  }

  .dark .input-clay:focus {
    /* Handled via @apply */
  }

  /* Clean Icons */
  .clay-icon {
    @apply rounded-xl flex items-center justify-center transition-all duration-300 bg-white dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 shadow-sm;
  }

  .dark .clay-icon {
    @apply shadow-none;
  }

  .clay-icon-blue {
    @apply bg-blue-600 dark:bg-blue-700 text-white rounded-xl flex items-center justify-center transition-all shadow-sm border border-blue-500 dark:border-blue-600;
  }

  .clay-icon-amber {
    @apply bg-amber-400 dark:bg-amber-500 text-amber-950 dark:text-amber-950 rounded-xl flex items-center justify-center transition-all shadow-sm border border-amber-300 dark:border-amber-400;
  }

  /* Badges */
  .clay-badge {
    @apply px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider dark:bg-zinc-800 dark:text-zinc-200 border border-zinc-100 dark:border-zinc-700 shadow-sm;
  }
  
  .dark .clay-badge {
    @apply shadow-none;
  }
}

.markdown-body {
  @apply prose prose-zinc dark:prose-invert max-w-none prose-headings:font-black prose-p:text-zinc-600 dark:prose-p:text-zinc-400;
}
