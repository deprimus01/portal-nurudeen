import { useEffect, useState } from 'react';

// navigator.onLine is a reasonable first read but is known to give false
// positives (reports "online" when connected to a network with no real
// internet) - the online/offline events are the more reliable signal for
// state *changes*, so this combines both: trust the events, use
// navigator.onLine only for the initial value before any event has fired.
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}
