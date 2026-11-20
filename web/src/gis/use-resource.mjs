import { useCallback, useEffect, useState } from 'react';

const cache = new Map();
function request(url) {
  if (!cache.has(url))
    cache.set(
      url,
      fetch(url).then((response) => {
        if (!response.ok) throw Error('Dataset request failed (' + response.status + ').');
        return response.json();
      }),
    );
  return cache.get(url);
}
export function useResource(url) {
  const [state, setState] = useState({ data: null, error: '' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setState({ data: null, error: '' });
    request(url)
      .then((data) => {
        if (active) setState({ data, error: '' });
      })
      .catch(() => {
        if (active)
          setState({
            data: null,
            error:
              'The local dataset could not load. Check the connection or start the app from its project folder.',
          });
      });
    return () => {
      active = false;
    };
  }, [url, attempt]);
  const retry = useCallback(() => {
    cache.delete(url);
    setAttempt((a) => a + 1);
  }, [url]);
  return { ...state, retry };
}
