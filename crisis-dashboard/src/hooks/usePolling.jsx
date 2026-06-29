/**
 * hooks/usePolling.js
 * Polls an async fetcher on an interval. Used for resources that don't yet
 * have socket events (teams, pending-incidents list) — see lib/api.js notes.
 *
 * Pauses while the tab is hidden to avoid hammering the API in background tabs,
 * and refetches immediately when the tab becomes visible again.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export function usePolling(fetcher, { intervalMs = 5000, enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refetch = useCallback(async () => {
    try {
      const result = await fetcherRef.current();
      setData(result);
      setError(null);
    } catch (err) {
      console.error("Polling fetch failed:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let timer = null;

    function tick() {
      refetch();
      timer = setTimeout(tick, intervalMs);
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") {
        clearTimeout(timer);
        tick();
      } else {
        clearTimeout(timer);
      }
    }

    tick();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, intervalMs, refetch]);

  return { data, error, loading, refetch };
}