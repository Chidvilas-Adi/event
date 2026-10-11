import React from 'react';
import { Wordmark } from './wordmark';

export function RouteLoader({ subtitle = 'Synchronizing City Telemetry...' }: { subtitle?: string }) {
  return (
    <div className="min-h-screen bg-[#030712] text-white font-mono flex flex-col items-center justify-center p-6 select-none animate-fade-in">
      <div className="w-full max-w-sm flex flex-col items-center text-center space-y-6">
        <Wordmark size="md" showTagline={false} />

        <div className="w-full bg-vc-card border border-vc-border/80 p-5 rounded-xl shadow-2xl space-y-4">
          <div className="flex items-center justify-between text-[10px] text-gray-400 border-b border-gray-800 pb-2">
            <span>CITY PROTOCOL</span>
            <span className="font-bold text-vc-gold animate-pulse">CONNECTING</span>
          </div>

          <div className="space-y-2">
            <div className="text-xs text-gray-300 font-bold tracking-wider">{subtitle}</div>
            <div className="w-full bg-gray-900 rounded-full h-1.5 overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-500 via-vc-gold to-yellow-200 h-1.5 rounded-full animate-pulse w-3/4" />
            </div>
          </div>

          <div className="flex items-center justify-between text-[9px] text-gray-500 pt-1">
            <span>NODE: PESU-MAIN</span>
            <span>24 OCT 2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}
