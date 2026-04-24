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
      }, fetchNotifications)
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
      // Revert on error (optional, but good practice)
    }
  };

  return { notifications, unreadCount, isLoading, markAllAsRead };
}
