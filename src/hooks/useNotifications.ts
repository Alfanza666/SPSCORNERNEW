import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/useAuthStore';

export interface NotificationItem {
  id: string;
  type: 'transaction' | 'withdrawal' | 'system';
  title: string;
  message: string;
  time: string;
  path: string;
  isRead: boolean;
}

/**
 * Gets existing service worker registration.
 * Uses the same SW registered by main.tsx via vite-plugin-pwa.
 */
async function getSWRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    return registrations[0] || null;
  } catch (e) {
    console.error('[SW] Get registration failed:', e);
    return null;
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function useNotifications() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // ── Get existing service worker and listen for navigate messages ──────────
  useEffect(() => {
    getSWRegistration();

    if (!navigator.serviceWorker) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NAVIGATE' && event.data?.url) {
        navigate(event.data.url);
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleMessage);
  }, [navigate]);

  // ── Fetch & Realtime notifications ────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) throw error;

        if (data) {
          const formattedNotifs: NotificationItem[] = data.map(n => ({
            id: n.id,
            type: n.type as any,
            title: n.title,
            message: n.message,
            path: n.path || '/',
            time: n.created_at,
            isRead: n.is_read
          }));

          setNotifications(formattedNotifs);
          setUnreadCount(formattedNotifs.filter(n => !n.isRead).length);
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotifications();

    // Realtime subscription
    const channelName = `notifs-${user.id}-${Date.now()}`;
    const notifSub = supabase.channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newNotif = payload.new;

          // Show native browser notification (foreground - when app is open)
          if (Notification.permission === 'granted') {
            try {
              // Use Service Worker notification if available (persists even when tab is minimized)
              if (navigator.serviceWorker?.controller) {
                navigator.serviceWorker.controller.postMessage({
                  type: 'SHOW_NOTIFICATION',
                  title: newNotif.title,
                  body: newNotif.message,
                  url: newNotif.path || '/'
                });
              } else {
                // Fallback to Notification API
                new Notification(newNotif.title, {
                  body: newNotif.message,
                  icon: '/logos/sps-logo-icon.png',
                  tag: newNotif.id,
                  data: { url: newNotif.path || '/' }
                });
              }
            } catch (e) {
              console.warn('[Notif] Failed to show notification:', e);
            }
          }
        }
        fetchNotifications();
      })
      .subscribe();

    // Auto-subscribe to push when user is available
    subscribeToWebPush();

    return () => {
      supabase.removeChannel(notifSub);
    };
  }, [user]);

  const markAllAsRead = async () => {
    if (!user) return;

    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;
    } catch (error) {
      console.error('Error marking notifications as read:', error);
    }
  };

  const markOneAsRead = async (notificationId: string) => {
    if (!user) return;

    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));

    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId)
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const subscribeToWebPush = async () => {
    if (!user) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[Push] Not supported in this browser');
      return;
    }

    // Request permission first
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.warn('[Push] Permission denied');
        return;
      }
    }

    if (Notification.permission !== 'granted') return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const applicationServerKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      if (!applicationServerKey) {
        console.warn('[Push] VITE_VAPID_PUBLIC_KEY is missing');
        return;
      }

      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(applicationServerKey)
        });
      }

      // Save subscription to server
      const { data: { session } } = await supabase.auth.getSession();
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({ user_id: user.id, subscription })
      });

      console.log('[Push] Subscribed successfully!');
    } catch (error) {
      console.error('[Push] Subscription failed:', error);
    }
  };

  return { notifications, unreadCount, isLoading, markAllAsRead, markOneAsRead, subscribeToWebPush };
}
