import { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/utils/cn';

/** Indicador de rede real (navigator.onLine + eventos online/offline) —
 * mesmo mecanismo da V2, distinto do indicador de latência do Firestore
 * (não portado ainda). */
export function NetworkStatus() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return (
    <div
      className={cn('flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold', online ? 'text-success' : 'text-destructive')}
      title={online ? 'Conectado' : 'Sem conexão — algumas ações podem falhar'}
    >
      {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{online ? 'Online' : 'Offline'}</span>
    </div>
  );
}
