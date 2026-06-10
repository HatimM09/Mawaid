import { useEffect, useState } from 'react';

export function PushStatus() {
  const [status, setStatus] = useState('pending');

  useEffect(() => {
    const checkStatus = async () => {
      try {
        if (!('Notification' in window) || !('PushManager' in window)) {
          setStatus('blocked');
          return;
        }

        const swReg = await navigator.serviceWorker.ready;
        const subscription = await swReg.pushManager.getSubscription();
        
        if (subscription) {
          setStatus('enabled');
        } else if (Notification.permission === 'granted') {
          setStatus('offline');
        } else if (Notification.permission === 'denied') {
          setStatus('blocked');
        } else {
          setStatus('offline');
        }
      } catch {
        setStatus('blocked');
      }
    };
    checkStatus();
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
