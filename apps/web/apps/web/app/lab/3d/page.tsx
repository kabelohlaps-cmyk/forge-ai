'use client';

import Character3DViewer from '../../../components/Character3DViewer';

export default function Lab3DPage() {
  return (
    <div className="max-w-2xl mx-auto p-4 flex flex-col gap-3">
      <h1 className="text-lg font-semibold text-eden-gold-light">3D Studio — Test</h1>
      <p className="text-xs opacity-70">
        Phase 1 check: rigged model loads, orbit controls work, animation plays.
      </p>
      <Character3DViewer />
    </div>
  );
}
