import { useCallback, useEffect, useState } from 'react';
import { api } from './api-client.mjs';

export function useOperationsResource(path, { interval = 0, enabled = true } = {}) {
  const [state, setState] = useState({
    path,
    data: null,
    error: '',
    loading: true,
    syncedAt: null,
  });
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!enabled || !path) {
      setState({ path, data: null, error: '', loading: false, syncedAt: null });
      return;
    }
    let active = true,
      busy = false;
    const abort = new AbortController();
    async function load() {
      if (busy) return;
      busy = true;
      try {
        const data = await api(path, { signal: abort.signal });
        if (active) setState({ path, data, error: '', loading: false, syncedAt: Date.now() });
      } catch (error) {
        if (active)
          setState((old) => ({
            ...old,
            path,
            error: error.message,
            status: error.status,
            loading: false,
          }));
      } finally {
        busy = false;
      }
    }
    setState((old) =>
      old.path === path
        ? { ...old, loading: old.data === null }
        : { path, data: null, error: '', loading: true, syncedAt: null },
    );
    load();
    const timer = interval ? setInterval(load, interval) : null;
    return () => {
      active = false;
      abort.abort();
      if (timer) clearInterval(timer);
    };
  }, [path, enabled, interval, revision]);
  return {
    ...(state.path === path
      ? state
      : { path, data: null, error: '', loading: true, syncedAt: null }),
    reload,
  };
}
