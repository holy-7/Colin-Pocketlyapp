import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { syncManager, type SyncManager, type SyncStatus } from '@/services/syncManager';

const SyncContext = createContext<SyncManager | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    syncManager.initialize().then(() => setReady(true));
    return () => { syncManager.destroy(); };
  }, []);

  if (!ready) return null;

  return (
    <SyncContext.Provider value={syncManager}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSync(): SyncManager {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSync must be used within SyncProvider');
  return ctx;
}

export function useSyncStatus(): SyncStatus {
  const sync = useSync();
  const [status, setStatus] = useState<SyncStatus>(() => sync.getStatus());

  useEffect(() => {
    setStatus(sync.getStatus());
    const unsubscribe = sync.onStatusChange(setStatus);
    return () => { unsubscribe(); };
  }, [sync]);

  return status;
}
