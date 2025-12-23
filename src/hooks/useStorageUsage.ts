/**
 * useStorageUsage - React hook for storage usage tracking
 */
import { useState, useCallback, useEffect } from 'react';
import { VlibeStorage } from '../VlibeStorage';
import type { StorageStats } from '../types';

export interface UseStorageUsageOptions {
  /** Auto-fetch usage on mount */
  autoFetch?: boolean;
  /** Refresh interval in milliseconds (0 = disabled) */
  refreshInterval?: number;
}

export interface UseStorageUsageReturn {
  /** Storage usage statistics */
  usage: StorageStats | null;
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Check if a file of given size can be uploaded */
  canUpload: (size: number) => boolean;
  /** Refresh usage data */
  refresh: () => Promise<void>;
  /** Usage percentage (0-100) */
  usagePercent: number;
  /** Formatted usage string (e.g., "1.5 GB of 5 GB") */
  usageFormatted: string;
  /** Whether storage limit is reached */
  isLimitReached: boolean;
  /** Whether usage is above 80% */
  isNearLimit: boolean;
}

export function useStorageUsage(
  client: VlibeStorage,
  options: UseStorageUsageOptions = {}
): UseStorageUsageReturn {
  const { autoFetch = true, refreshInterval = 0 } = options;

  const [usage, setUsage] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsage = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const stats = await client.getUsage();
      setUsage(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch usage');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    if (autoFetch) {
      fetchUsage();
    }
  }, [autoFetch, fetchUsage]);

  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(fetchUsage, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, fetchUsage]);

  const canUpload = useCallback(
    (size: number): boolean => {
      if (!usage) return true;
      if (usage.storageLimit === 0) return true; // Unlimited

      return usage.bytesUsed + size <= usage.storageLimit;
    },
    [usage]
  );

  const usagePercent = usage?.usagePercent ?? 0;
  const isLimitReached = usagePercent >= 100;
  const isNearLimit = usagePercent >= 80;

  const usageFormatted = usage
    ? `${usage.bytesUsedFormatted} of ${usage.storageLimitFormatted}`
    : 'Loading...';

  return {
    usage,
    loading,
    error,
    canUpload,
    refresh: fetchUsage,
    usagePercent,
    usageFormatted,
    isLimitReached,
    isNearLimit,
  };
}
