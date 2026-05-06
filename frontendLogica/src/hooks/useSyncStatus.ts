import { useState, useEffect, useCallback, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || "https://optimizalo.app";

// ====================================
// TYPES
// ====================================

export interface SyncTask {
  week: number;
  dateRange: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  startedAt: string | null;
  completedAt: string | null;
  attempts: number;
  maxAttempts: number;
  errorMessage?: string | null;
}

export interface SyncStatus {
  customerId: string;
  totalWeeks: number;
  completed: number;
  processing: number;
  pending: number;
  failed: number;
  progressPercentage: number;
  isCompleted: boolean;
  isCurrentlyProcessing: boolean;
  tasks: SyncTask[];
  queueStatus?: {
    isRunning: boolean;
    totalProcessing: number;
    maxConcurrent: number;
  };
}

export interface QueueStatus {
  isRunning: boolean;
  processingCount: number;
  maxConcurrent: number;
  processingAccounts: string[];
}

export interface SyncSummary {
  accounts: Array<{
    customerId: string;
    totalTasks: number;
    completed: number;
    processing: number;
    pending: number;
    failed: number;
    progressPercentage: number;
    isCompleted: boolean;
    isProcessing: boolean;
    startedAt: string | null;
    lastCompletedAt: string | null;
  }>;
  queueStatus: QueueStatus;
}

// ====================================
// HOOK: useSyncStatus (una cuenta)
// ====================================

interface UseSyncStatusOptions {
  pollingInterval?: number;
  autoCleanup?: boolean;
  onComplete?: () => void;
}

export function useSyncStatus(
  customerId: string | null,
  options: UseSyncStatusOptions = {}
) {
  const {
    pollingInterval = 5000,
    autoCleanup = true,
    onComplete
  } = options;

  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!customerId) {
      setStatus(null);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/sync-status/${customerId}`,
        {
          credentials: "include",
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 404) {
        setStatus(null);
        setLoading(false);
        return;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      setStatus(data);
      setError(null);

      // Auto-cleanup cuando se completa
      if (data.isCompleted && autoCleanup) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        cleanupTimeoutRef.current = setTimeout(async () => {
          try {
            await fetch(
              `${API_URL}/api/sync-queue/${customerId}`,
              {
                method: 'DELETE',
                credentials: "include"
              }
            );
            
            setStatus(null);
            
            if (onComplete) {
              onComplete();
            }
          } catch (err) {
            console.error('Error limpiando cola:', err);
          }
        }, 3000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [customerId, autoCleanup, onComplete]);

  useEffect(() => {
    if (!customerId) {
      setStatus(null);
      setLoading(false);
      return;
    }

    fetchStatus();

    if (status && !status.isCompleted) {
      intervalRef.current = setInterval(fetchStatus, pollingInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
    };
  }, [customerId, fetchStatus, pollingInterval, status?.isCompleted]);

  return {
    status,
    loading,
    error,
    refetch: fetchStatus
  };
}