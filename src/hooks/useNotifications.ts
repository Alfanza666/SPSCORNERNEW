import { useState, useEffect } from 'react';
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

export function useNotifications() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

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

    // Set up realtime subscriptions
    const channelName = `notifs-${user.id}-${Date.now()}`;
    const notifSub = supabase.channel(channelName)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          // Attempt to show browser notification
          if (Notification.permission === 'granted') {
            try {
              new Notification(payload.new.title, {
                body: payload.new.message,
                icon: '/logos/sps-logo-icon.png'
              });
            } catch (e) {
              console.error('Failed to show push notification', e);
            }
          }
        }
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(notifSub);
    };
  }, [user]);

  const markAllAsRead = async () => {
    if (!user) return;
    
    // Optimistic update
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

    // Optimistic update
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
    if ('serviceWorker' in navigator && 'PushManager' in window && user) {
      try {
        const registration = await navigator.serviceWorker.ready;
        
        // Convert base64 to Uint8Array for applicationServerKey
        const urlBase64ToUint8Array = (base64String: string) => {
          const padding = '='.repeat((4 - base64String.length % 4) % 4);
          const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
          const rawData = window.atob(base64);
          const outputArray = new Uint8Array(rawData.length);
          for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
          }
          return outputArray;
        };

        const applicationServerKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if (!applicationServerKey) {
          console.warn('VITE_VAPID_PUBLIC_KEY is missing');
          return;
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(applicationServerKey)
        });

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: user.id,
            subscription: subscription
          })
        });
        
        console.log('Berhasil langganan push notifikasi latar belakang!');
      } catch (error) {
        console.error('Gagal langganan web push', error);
      }
    }
  };

  return { notifications, unreadCount, isLoading, markAllAsRead, markOneAsRead, subscribeToWebPush };
}
