import { useEffect, useState } from 'react';
import { getMessaging, getToken } from 'firebase/messaging';
import { supabase } from '../admin/supabaseClient';

export function PushStatus() {
  const [status, setStatus] = useState('pending');

  useEffect(() => {
    const messaging = getMessaging();
    const checkStatus = async () => {
      try {
        const token = await getToken(messaging, {
          vapidKey: 'BIEVWJ3bbYO2OZW--9AD-uDEevFUa4GNC2BuU6gtopIq0BTSLXVMTWh8EI6SIubsp2_s2o6lckRZDwtNzlYrZKY',
        });
        setStatus(token ? (navigator.serviceWorker.controller ? 'enabled' : 'blocked') : 'offline');
      } catch {
        setStatus('blocked');
      }
    };
    checkStatus();

    messaging.onMessage(() => setStatus('enabled'));
    if (Notification.permission !== 'default') {
      setStatus(Notification.permission === 'granted' ? 'enabled' : 'blocked');
    }
  }, []);

  const color = {
    enabled: '#27ae60',
    blocked: '#c0392b',
    offline: '#95a5a6',
    pending: '#7f8c8d',
  }[status];

  return (
    <span
      style={{
        color: '#fff',
        backgroundColor: color,
        padding: '4px 8px',
        borderRadius: 12,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {status === 'enabled' && 'Push OK'}
      {status === 'blocked' && 'Push Blocked'}
      {status === 'offline' && 'Offline'}
      {status === 'pending' && 'Checking…'}
    </span>
  );
}
