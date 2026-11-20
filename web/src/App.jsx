import React, { lazy, Suspense } from 'react';
import { WaterPlatform } from './platform/WaterPlatform.jsx';
const Advanced = lazy(() => import('./LegacyApp.jsx').then((m) => ({ default: m.App })));
export function App(props) {
  const advanced =
    typeof location !== 'undefined' &&
    new URLSearchParams(location.search).get('workspace') === 'advanced';
  return advanced ? (
    <Suspense fallback={<main className="mvp-loading">Loading advanced workspace…</main>}>
      <a className="mvp-return" href="/">
        Return to the water platform
      </a>
      <Advanced {...props} />
    </Suspense>
  ) : (
    <WaterPlatform />
  );
}
