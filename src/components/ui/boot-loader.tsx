'use client';

import React, { useEffect, useState } from 'react';
import { Wordmark } from './wordmark';
import { StatusChip } from './status-chip';

interface BootLoaderProps {
  onComplete?: () => void;
  minDurationMs?: number;
}

export function BootLoader({ onComplete, minDurationMs = 800 }: BootLoaderProps) {
  const [progress, setProgress] = useState(15);
  const [step, setStep] = useState(1);
  const [isLive, setIsLive] = useState(false);
  const [isStamped, setIsStamped] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => {
      setProgress(45);
      setStep(2);
    }, minDurationMs * 0.3);

    const t2 = setTimeout(() => {
      setProgress(85);
      setStep(3);
      setIsLive(true);
    }, minDurationMs * 0.65);

    const t3 = setTimeout(() => {
      setProgress(100);
      setIsStamped(true);
    }, minDurationMs * 0.85);

    const t4 = setTimeout(() => {
      if (onComplete) onComplete();
    }, minDurationMs + 100);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [minDurationMs, onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-[#030712] flex flex-col items-center justify-center p-6 text-white font-mono select-none">
      <div className="w-full max-w-sm flex flex-col items-center text-center space-y-6">
        {/* Wordmark */}
        <Wordmark size="md" showTagline={false} />

        {/* Permit Card Mockup */}
        <div className="relative w-full border border-vc-border bg-vc-card/80 p-5 rounded-lg shadow-xl text-left">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2 mb-3 text-[10px] text-gray-400">
            <span>PERMIT BOOTSTRAP</span>
            <span className="font-bold text-vc-gold">VC-OS v0.1</span>
          </div>

          {/* Stamp Effect */}
          {isStamped && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="border-4 border-vc-gold text-vc-gold font-syne font-black text-2xl tracking-widest px-4 py-2 rotate-[-12deg] rounded uppercase animate-ping-once opacity-90 shadow-lg">
                ADMITTED
              </div>
            </div>
          )}

          {/* Status chips transition */}
          <div className="flex flex-wrap gap-2 mb-4">
            <StatusChip
              label={isLive ? 'World ● Live' : 'World ▲▼ Unstable'}
              variant={isLive ? 'emerald' : 'gold'}
            />
            <StatusChip label="Rules ■ Locked" variant="slate" />
            <StatusChip label="State 0x7F3A" variant="slate" />
          </div>

          {/* Step Messages */}
          <div className="space-y-1.5 text-xs text-gray-300">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-white' : 'text-gray-600'}`}>
              <span className="text-vc-gold">01</span>
              <span>CITIZEN REGISTRY CHECK</span>
              {step >= 1 && <span className="ml-auto text-vc-emerald">OK</span>}
            </div>
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-white' : 'text-gray-600'}`}>
              <span className="text-vc-gold">02</span>
              <span>LEDGER STATE SYNC</span>
              {step >= 2 && <span className="ml-auto text-vc-emerald">OK</span>}
            </div>
            <div className={`flex items-center gap-2 ${step >= 3 ? 'text-white' : 'text-gray-600'}`}>
              <span className="text-vc-gold">03</span>
              <span>GATES OPENING</span>
              {step >= 3 && <span className="ml-auto text-vc-emerald">LIVE</span>}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mt-5 pt-3 border-t border-gray-800">
            <div className="flex justify-between text-[11px] text-gray-400 mb-1">
              <span>INITIALIZING</span>
              <span>{progress}%</span>
            </div>
            <div className="w-full bg-gray-900 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-vc-gold h-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="text-[10px] text-gray-500 uppercase tracking-widest">
          Sat 10 Oct 2026 · RR Campus · PESU Venture Labs
        </div>
      </div>
    </div>
  );
}
