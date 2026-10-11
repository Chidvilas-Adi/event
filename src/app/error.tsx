'use client';

import React, { useEffect } from 'react';
import { Wordmark } from '@/components/ui/wordmark';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled runtime error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#030712] text-white font-mono flex flex-col items-center justify-center p-6 text-center select-none">
      <div className="w-full max-w-md bg-vc-card border border-vc-rose/40 p-8 rounded-xl shadow-2xl space-y-6">
        <Wordmark size="md" className="mx-auto" />
        <div className="space-y-2">
          <div className="text-3xl font-syne font-black text-vc-rose">SYSTEM INTERRUPT</div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-200">
            Telemetry Error Detected
          </h2>
          <p className="text-xs text-gray-400">
            An unexpected error occurred within this sector. All transaction ledgers remain ACID-locked and intact.
          </p>
          {error?.message && (
            <p className="text-[11px] text-vc-rose/80 bg-vc-rose/10 p-2 rounded border border-vc-rose/20 break-words font-mono">
              {error.message}
            </p>
          )}
        </div>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-vc-gold hover:bg-yellow-400 text-black font-syne font-bold text-xs rounded uppercase tracking-wider transition-all"
          >
            Retry Connection
          </button>
          <button
            onClick={() => window.location.href = '/'}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-syne font-bold text-xs rounded uppercase tracking-wider transition-all"
          >
            City Gates
          </button>
        </div>
      </div>
    </div>
  );
}
