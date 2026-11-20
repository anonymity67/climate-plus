import { useCallback, useEffect, useState } from 'react';
const cache = new Map();
function request(path) {
  if (!cache.has(path))
    cache.set(
      path,
      fetch(path)
        .then((r) => {
          if (!r.ok) throw Error(`Could not load ${path} (${r.status}).`);
          return r.json();
        })
        .catch((error) => {
          cache.delete(path);
          throw error;
        }),
    );
  return cache.get(path);
}
export function useMapData(path, enabled = true) {
  const [state, setState] = useState({ path: null, data: null, error: '', loading: true }),
    [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    cache.delete(path);
    setAttempt((n) => n + 1);
  }, [path]);
  useEffect(() => {
    if (!path || !enabled) return;
    let active = true;
    setState({ path, data: null, error: '', loading: true });
    request(path)
      .then((data) => {
        if (active) setState({ path, data, error: '', loading: false });
      })
      .catch((e) => {
        if (active) setState({ path, data: null, error: e.message, loading: false });
      });
    return () => {
      active = false;
    };
  }, [path, enabled, attempt]);
  return {
    ...(!enabled || !path
      ? { path, data: null, error: '', loading: false }
      : state.path === path
        ? state
        : { path, data: null, error: '', loading: true }),
    retry,
  };
}
