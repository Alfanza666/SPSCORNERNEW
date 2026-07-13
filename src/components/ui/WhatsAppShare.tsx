import { Share2 } from 'lucide-react';
import type { MouseEvent } from 'react';

interface WhatsAppShareProps {
  title: string;
  className?: string;
  compact?: boolean;
  path?: string;
  url?: string;
  category?: string;
  description?: string;
  loginHint?: string;
  message?: string;
}

export default function WhatsAppShare({
  title,
  className = '',
  compact = false,
  path = '/portal/pengumuman',
  url,
  category = 'Pengumuman Baru dari Serikat Pekerja',
  description,
  loginHint = 'Login untuk melihat detail lengkap.',
  message,
}: WhatsAppShareProps) {
  const handleShare = (event?: MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    event?.stopPropagation();

    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://spscorner.store';
    const targetUrl = url || `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const shareMessage = message || [
      `📢 *${category}*`,
      '',
      title,
      description ? `\n${description}` : '',
      '',
      `🔗 Buka di SPS Corner: ${targetUrl}`,
      '',
      `_${loginHint}_`,
    ].filter(Boolean).join('\n');
    const waUrl = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  if (compact) {
    return (
      <button
        onClick={handleShare}
        className={`p-2.5 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-all active:scale-95 ${className}`}
        title="Bagikan ke WhatsApp"
        aria-label="Bagikan ke WhatsApp"
      >
        <Share2 className="w-5 h-5" />
      </button>
    );
  }

  return (
    <button
      onClick={handleShare}
      className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white font-bold text-sm shadow-lg shadow-green-500/25 hover:shadow-green-500/40 transition-all active:scale-95 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
      Bagikan via WhatsApp
    </button>
  );
}
