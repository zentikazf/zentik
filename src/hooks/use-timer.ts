'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api-client';

interface ActiveTimer {
  taskId: string;
  startTime: string;
  elapsed: number;
}

export function useTimer() {
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function fetchActive() {
      try {
        const response = await api.get<ActiveTimer | null>('/time-entries/active');
        if (response.data) {
          setActiveTimer(response.data);
        }
      } catch {
        // No active timer
      }
    }
    fetchActive();
  }, []);

  useEffect(() => {
    if (activeTimer) {
      intervalRef.current = setInterval(() => {
        const start = new Date(activeTimer.startTime).getTime();
        const now = Date.now();
        setActiveTimer((prev) =>
          prev ? { ...prev, elapsed: Math.floor((now - start) / 1000) } : null,
        );
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeTimer?.taskId]);

  const start = useCallback(async (taskId: string) => {
    setLoading(true);
    try {
      await api.post('/time-entries/start', { taskId });
      setActiveTimer({ taskId, startTime: new Date().toISOString(), elapsed: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  const stop = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.post('/time-entries/stop');
      setActiveTimer(null);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return res.data;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { activeTimer, start, stop, loading, isRunning: !!activeTimer };
}
