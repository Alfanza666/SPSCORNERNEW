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
                icon: '/vite.svg'
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

  return { notifications, unreadCount, isLoading, markAllAsRead, markOneAsRead };
}
