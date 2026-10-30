import type { SyncReport } from '@bartender-lab/client-core';
import { useQueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useClient } from './client-context';

const MIN_INTERVAL_MS = 15_000;

const SyncContext = createContext<(() => Promise<SyncReport>) | null>(null);

/**
 * Syncs on start, when the connection comes back and when the app returns to the foreground.
 * Without a configured server sync is a no-op: the app is fully usable offline.
 */
export function SyncProvider({ children }: { children: ReactNode }) {
  const client = useClient();
  const queryClient = useQueryClient();
  const lastRun = useRef(0);

  const syncNow = useCallback(async () => {
    lastRun.current = Date.now();
    const report = await client.sync.sync();
    await queryClient.invalidateQueries();
    return report;
  }, [client, queryClient]);

  useEffect(() => {
    const maybeSync = () => {
      if (Date.now() - lastRun.current > MIN_INTERVAL_MS) void syncNow();
    };
    maybeSync();
    const network = Network.addNetworkStateListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) maybeSync();
    });
    const appState = AppState.addEventListener('change', (status) => {
      if (status === 'active') maybeSync();
    });
    return () => {
      network.remove();
      appState.remove();
    };
  }, [syncNow]);

  return <SyncContext.Provider value={syncNow}>{children}</SyncContext.Provider>;
}

export function useSyncNow(): () => Promise<SyncReport> {
  const syncNow = useContext(SyncContext);
  if (!syncNow) throw new Error('useSyncNow must be used inside SyncProvider');
  return syncNow;
}
