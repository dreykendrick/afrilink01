import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type PushPermission = 'granted' | 'denied' | 'default' | 'unsupported';

interface UsePushNotificationsReturn {
  permission: PushPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  isSupported: boolean;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const usePushNotifications = (): UsePushNotificationsReturn => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<PushPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const vapidKeyRef = useRef<string | null>(null);
  const isSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

  // Check current permission and subscription state
  useEffect(() => {
    if (!isSupported) {
      setPermission('unsupported');
      return;
    }

    setPermission(Notification.permission as PushPermission);

    // Check if already subscribed
    navigator.serviceWorker.ready.then(async (registration) => {
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
    }).catch(() => {
      // SW not ready yet
    });
  }, [isSupported]);

  // Fetch VAPID public key
  const getVapidKey = useCallback(async (): Promise<string | null> => {
    if (vapidKeyRef.current) return vapidKeyRef.current;

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/push-api/vapid-key`,
        {
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch VAPID key');
      const data = await response.json();
      vapidKeyRef.current = data.publicKey;
      return data.publicKey;
    } catch (error) {
      console.error('[Push] Failed to fetch VAPID key:', error);
      return null;
    }
  }, []);

  // Store subscription on backend
  const storeSubscription = useCallback(async (subscription: PushSubscription): Promise<boolean> => {
    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session) return false;

      const subJson = subscription.toJSON();
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/push-api/subscribe`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.data.session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            endpoint: subJson.endpoint,
            p256dh: subJson.keys?.p256dh,
            auth: subJson.keys?.auth,
            platform: 'web',
          }),
        }
      );

      return response.ok;
    } catch (error) {
      console.error('[Push] Failed to store subscription:', error);
      return false;
    }
  }, []);

  // Remove subscription from backend
  const removeSubscription = useCallback(async (endpoint: string): Promise<boolean> => {
    try {
      const session = await supabase.auth.getSession();
      if (!session.data.session) return false;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/push-api/subscribe`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${session.data.session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ endpoint }),
        }
      );

      return response.ok;
    } catch (error) {
      console.error('[Push] Failed to remove subscription:', error);
      return false;
    }
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported || !user) return false;
    setIsLoading(true);

    try {
      // Request permission
      const result = await Notification.requestPermission();
      setPermission(result as PushPermission);

      if (result !== 'granted') {
        console.log('[Push] Permission denied');
        return false;
      }

      // Get VAPID key
      const vapidKey = await getVapidKey();
      if (!vapidKey) {
        console.error('[Push] No VAPID key available');
        return false;
      }

      // Subscribe via service worker
      const registration = await navigator.serviceWorker.ready;
      
      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription();
      
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
        });
      }

      // Store on backend
      const stored = await storeSubscription(subscription);
      if (stored) {
        setIsSubscribed(true);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[Push] Subscribe error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, user, getVapidKey, storeSubscription]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    setIsLoading(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await removeSubscription(endpoint);
      }

      setIsSubscribed(false);
      return true;
    } catch (error) {
      console.error('[Push] Unsubscribe error:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, removeSubscription]);

  // Auto-subscribe on login if permission was previously granted
  useEffect(() => {
    if (!user || !isSupported || isSubscribed) return;
    if (Notification.permission === 'granted') {
      // Silently re-register subscription for this user
      subscribe().catch(() => {});
    }
  }, [user, isSupported, isSubscribed, subscribe]);

  return {
    permission,
    isSubscribed,
    isLoading,
    subscribe,
    unsubscribe,
    isSupported,
  };
};
