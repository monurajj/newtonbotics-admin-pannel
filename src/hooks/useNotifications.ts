import { useState, useEffect, useCallback } from 'react';
import { notificationService } from '../services/notificationService';
import { 
  UseNotificationsReturn, 
  UseNotificationSettingsReturn,
  NotificationApiParams,
  NotificationSettings,
  Notification,
  NotificationStats
} from '../types/notifications';

/**
 * Hook for managing notifications
 */
export function useNotifications(params: NotificationApiParams = {}): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats>({ total: 0, unread: 0, read: 0, byType: [], byPriority: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [currentSkip, setCurrentSkip] = useState(0);

  const fetchNotifications = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const skip = reset ? 0 : currentSkip;
      const response = await notificationService.getNotifications({
        ...params,
        skip,
        limit: params.limit || 20,
      });

      if (response.success) {
        const { notifications: newNotifications, stats: newStats, pagination } = response.data;
        
        if (reset) {
          setNotifications(newNotifications);
          setCurrentSkip(newNotifications.length);
        } else {
          setNotifications(prev => [...prev, ...newNotifications]);
          setCurrentSkip(prev => prev + newNotifications.length);
        }
        
        setStats(newStats);
        setHasMore(pagination.hasMore);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  }, [params.limit, params.skip, params.type, params.priority, params.read, currentSkip]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => 
          notif._id === id 
            ? { ...notif, read: true, readAt: new Date().toISOString() }
            : notif
        )
      );
      
      setStats(prev => ({ 
        ...prev, 
        unread: Math.max(0, prev.unread - 1),
        read: prev.read + 1
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark notification as read');
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await notificationService.markAllAsRead();
      
      if (response.success) {
        // Update local state
        setNotifications(prev => 
          prev.map(notif => ({ ...notif, read: true, readAt: new Date().toISOString() }))
        );
        
        setStats(prev => ({ 
          ...prev, 
          unread: 0,
          read: prev.total
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark all notifications as read');
    }
  }, []);

  const refetch = useCallback(() => {
    setCurrentSkip(0);
    return fetchNotifications(true);
  }, [fetchNotifications]);

  const loadMore = useCallback(async () => {
    if (!loading && hasMore) {
      return fetchNotifications(false);
    }
    return Promise.resolve();
  }, [loading, hasMore, fetchNotifications]);

  useEffect(() => {
    // Only fetch if limit is greater than 0
    if ((params.limit || 20) > 0) {
      fetchNotifications(true);
    }
  }, [fetchNotifications, params.limit]);

  return {
    notifications,
    stats,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    refetch,
    loadMore,
    hasMore,
  };
}

/**
 * Hook for managing notification settings
 */
export function useNotificationSettings(): UseNotificationSettingsReturn {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await notificationService.getSettings();
      
      if (response.success) {
        setSettings(response.data.settings);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notification settings');
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(async (newSettings: Partial<NotificationSettings>) => {
    try {
      setError(null);
      
      const response = await notificationService.updateSettings(newSettings);
      
      if (response.success) {
        setSettings(response.data.settings);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update notification settings');
      throw err;
    }
  }, []);

  const refetch = useCallback(() => {
    return fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    loading,
    error,
    updateSettings,
    refetch,
  };
}

/**
 * Hook for getting notification count (for bell icon)
 * Gracefully handles cases where user doesn't have admin access
 */
export function useNotificationCount() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCount = useCallback(async () => {
    try {
      // Check if user is admin before fetching
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          const user = JSON.parse(userData);
          // Only fetch notifications for admin users
          if (user.role !== 'admin') {
            setCount(0);
            setLoading(false);
            return;
          }
        } catch {
          // If we can't parse user data, try fetching anyway
        }
      }

      const response = await notificationService.getNotifications({ limit: 1 });
      
      if (response.success) {
        setCount(response.data.stats.unread);
      }
    } catch (err) {
      // Silently handle errors - this is expected for non-admin users or when backend is unavailable
      const errorMessage = err instanceof Error ? err.message : String(err);
      const statusCode = (err as any)?.statusCode || (err as any)?.status;
      
      // Handle permission errors (non-admin users) - 403 status
      if (
        statusCode === 403 ||
        errorMessage.includes('Admin access required') || 
        errorMessage.includes('403') ||
        errorMessage.includes('Forbidden')
      ) {
        // Non-admin user, set count to 0
        setCount(0);
      } 
      // Handle server errors (backend unavailable, network issues, etc.) - 500 status
      else if (
        statusCode === 500 ||
        errorMessage.includes('Internal server error') ||
        errorMessage.includes('500') ||
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('NetworkError') ||
        errorMessage.includes('Network request failed')
      ) {
        // Server errors - silently fail and set count to 0
        // Don't log to console as these are expected when backend is down
        setCount(0);
      } 
      // Handle authentication errors - 401 status
      else if (
        statusCode === 401 ||
        errorMessage.includes('No authorization token') ||
        errorMessage.includes('401') ||
        errorMessage.includes('Unauthorized')
      ) {
        // User not authenticated, set count to 0
        setCount(0);
      }
      // Other unexpected errors - log but don't throw
      else {
        // Only log unexpected errors that we haven't handled
        console.warn('Failed to fetch notification count:', errorMessage);
        setCount(0);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCount();
    
    // Only refresh count every 30 seconds if user is admin
    const userData = localStorage.getItem('user');
    let isAdmin = false;
    if (userData) {
      try {
        const user = JSON.parse(userData);
        isAdmin = user.role === 'admin';
      } catch {
        // If we can't parse, assume not admin
      }
    }
    
    if (isAdmin) {
      const interval = setInterval(fetchCount, 30000);
      return () => clearInterval(interval);
    }
  }, [fetchCount]);

  return { count, loading, refetch: fetchCount };
}
