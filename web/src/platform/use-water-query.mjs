import { useEffect, useState, useCallback } from 'react';
import { api } from '../operations/api-client.mjs';
export function useWaterQuery(path, requestBody = null) {
  const [state, setState] = useState({ path: null, data: null, error: '', loading: Boolean(path) }),
    [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    setState({ path, requestBody, data: null, error: '', loading: true });
    api('/water/' + path, {
      signal: controller.signal,
      ...(requestBody ? { method: 'POST', body: JSON.parse(requestBody) } : {}),
    })
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ path, requestBody, data, error: '', loading: false });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setState({ path, requestBody, data: null, error: e.message, loading: false });
      });
    return () => controller.abort();
  }, [path, revision, requestBody]);
  return {
    ...(state.path === path && state.requestBody === requestBody
      ? state
      : { path, data: null, error: '', loading: Boolean(path) }),
    reload,
  };
}
