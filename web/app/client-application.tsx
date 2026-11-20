'use client';

import React, { lazy, Suspense, useEffect, useState } from 'react';
import { WaterPlatform } from '../src/platform/WaterPlatform.jsx';

const Advanced = lazy(() => import('../src/LegacyApp.jsx').then((m) => ({ default: m.App })));

export default function ClientApplication({
  view,
  bangla,
  advanced,
}: {
  view: string;
  bangla: boolean;
  advanced: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!advanced) return <WaterPlatform initialView={view} initialBangla={bangla} />;
  const loading = <p className="water-workspace">Opening the research workspace…</p>;
  return (
    <>
      <a className="mvp-return" href="/">
        Return to Aquavelle
      </a>
      {mounted ? (
        <Suspense fallback={loading}>
          <Advanced />
        </Suspense>
      ) : (
        loading
      )}
    </>
  );
}
