import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { NotificationItem } from '../../hooks/useNotifications';

const DISMISSED_KEY = 'sps-notification-popup-dismissed';
function dismissedIds(): string[] { try { return JSON.parse(sessionStorage.getItem(DISMISSED_KEY) || '[]'); } catch { return []; } }

export default function NotificationPopup({ notifications, markOneAsRead }: { notifications: NotificationItem[]; markOneAsRead: (id: string) => Promise<void> }) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState<NotificationItem[]>([]);
  useEffect(() => { const dismissed = new Set(dismissedIds()); setVisible(notifications.filter(n => !n.isRead && !dismissed.has(n.id)).slice(0, 3)); }, [notifications]);
  if (!visible.length) return null;
  const dismiss = (id: string) => { sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(new Set([...dismissedIds(), id])).slice(-50))); setVisible(prev => prev.filter(n => n.id !== id)); };
  const open = async (n: NotificationItem) => { await markOneAsRead(n.id); dismiss(n.id); navigate(n.path || '/'); };
  return <div className="fixed inset-x-3 top-20 z-[70] space-y-3 sm:left-auto sm:right-6 sm:w-[min(24rem,calc(100vw-2rem))] sm:inset-x-auto" role="status" aria-live="polite">
    {visible.map(n => <div key={n.id} className="rounded-2xl border border-blue-100 bg-white p-4 shadow-2xl shadow-blue-900/15 dark:border-zinc-700 dark:bg-zinc-900"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300"><Bell className="h-5 w-5" /></div><button className="min-w-0 flex-1 text-left" onClick={() => void open(n)}><p className="text-sm font-black text-zinc-900 dark:text-white">{n.title}</p><p className="mt-1 text-xs font-medium leading-relaxed text-zinc-600 dark:text-zinc-300">{n.message}</p><span className="mt-2 inline-block text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">Lihat detail</span></button><button aria-label="Tutup notifikasi" onClick={() => dismiss(n.id)} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button></div></div>)}
  </div>;
}
