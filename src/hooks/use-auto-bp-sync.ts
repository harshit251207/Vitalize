import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';

import {
  fetchBPReadings,
  getAvailability,
  hasBPPermission,
  initialize,
  requestBPPermission,
  type HealthConnectAvailability,
} from '@/services/healthConnectBP';
import { saveAutoBPReadings } from '@/services/autoBpService';

const SYNC_OVERLAP_MS = 5 * 60 * 1000;
const INITIAL_IMPORT_DAYS = 30;

interface SyncResult {
  completedAt: Date;
}

const inFlightSyncs = new Map<string, Promise<SyncResult>>();

function storageKey(uid: string): string {
  return `@vitalize/auto-bp-last-sync/${uid}`;
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected Health Connect error.';
}

export interface UseAutoBPSyncOptions {
  uid: string | null;
  syncOnAppActive?: boolean;
  onSyncError?: (message: string) => void;
}

export function useAutoBpSync({
  uid,
  syncOnAppActive = false,
  onSyncError,
}: UseAutoBPSyncOptions) {
  const syncLock = useRef(false);
  const [availability, setAvailability] =
    useState<HealthConnectAvailability | null>(null);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const refreshStatus = useCallback(async (): Promise<boolean> => {
    if (!uid) {
      setAvailability('unsupported');
      setPermissionGranted(false);
      setLastSyncedAt(null);
      return false;
    }

    try {
      const currentAvailability = await getAvailability();
      setAvailability(currentAvailability);
      if (currentAvailability !== 'available') {
        setPermissionGranted(false);
        return false;
      }

      const initialized = await initialize();
      if (!initialized) {
        throw new Error('Health Connect could not be initialized.');
      }

      const granted = await hasBPPermission();
      setPermissionGranted(granted);
      const storedLastSync = await AsyncStorage.getItem(storageKey(uid));
      const parsedLastSync = storedLastSync ? new Date(storedLastSync) : null;
      const validLastSync =
        parsedLastSync && Number.isFinite(parsedLastSync.getTime())
          ? parsedLastSync
          : null;
      setLastSyncedAt(validLastSync);
      if (granted) setSyncError(null);
      return granted;
    } catch (error) {
      const message = `Could not check Health Connect: ${readError(error)}`;
      setSyncError(message);
      onSyncError?.(message);
      return false;
    }
  }, [onSyncError, uid]);

  const connect = useCallback(async (): Promise<boolean> => {
    setSyncError(null);
    try {
      const granted = await requestBPPermission();
      setPermissionGranted(granted);
      if (!granted) {
        setSyncError('Blood pressure access was not granted. You can change it in Health Connect settings.');
        return false;
      }
      return true;
    } catch (error) {
      const message = `Could not request Health Connect access: ${readError(error)}`;
      setSyncError(message);
      onSyncError?.(message);
      return false;
    }
  }, [onSyncError]);

  const syncNow = useCallback(async (): Promise<void> => {
    if (!uid || syncLock.current) return;
    syncLock.current = true;
    setIsSyncing(true);
    setSyncError(null);

    try {
      if (!(await refreshStatus())) return;

      let activeSync = inFlightSyncs.get(uid);
      if (!activeSync) {
        activeSync = (async () => {
          const storedLastSync = await AsyncStorage.getItem(storageKey(uid));
          const previousSync = storedLastSync ? new Date(storedLastSync) : null;
          const since =
            previousSync && Number.isFinite(previousSync.getTime())
              ? new Date(previousSync.getTime() - SYNC_OVERLAP_MS)
              : new Date(Date.now() - INITIAL_IMPORT_DAYS * 24 * 60 * 60 * 1000);

          const readings = await fetchBPReadings(since);
          await saveAutoBPReadings(uid, readings);
          const completedAt = new Date();
          await AsyncStorage.setItem(storageKey(uid), completedAt.toISOString());
          return { completedAt };
        })();
        inFlightSyncs.set(uid, activeSync);
      }

      try {
        const result = await activeSync;
        setLastSyncedAt(result.completedAt);
      } finally {
        if (inFlightSyncs.get(uid) === activeSync) inFlightSyncs.delete(uid);
      }
    } catch (error) {
      const message = `Blood pressure sync failed: ${readError(error)}`;
      setSyncError(message);
      onSyncError?.(message);
    } finally {
      syncLock.current = false;
      setIsSyncing(false);
    }
  }, [onSyncError, refreshStatus, uid]);

  useEffect(() => {
    if (!syncOnAppActive || !uid || Platform.OS !== 'android') return;

    let initialSyncTimer: ReturnType<typeof setTimeout> | undefined;
    if (AppState.currentState === 'active') {
      initialSyncTimer = setTimeout(() => void syncNow(), 0);
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncNow();
    });
    return () => {
      if (initialSyncTimer) clearTimeout(initialSyncTimer);
      subscription.remove();
    };
  }, [syncNow, syncOnAppActive, uid]);

  return {
    availability,
    permissionGranted,
    isSyncing,
    lastSyncedAt,
    syncError,
    refreshStatus,
    connect,
    syncNow,
  };
}
