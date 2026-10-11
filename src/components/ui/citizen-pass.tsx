'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CitizenPassProps {
  citizenCode: string;
  name: string;
  companyName?: string | null;
  companyRole?: string | null;
  className?: string;
}

export function CitizenPass({
  citizenCode,
  name,
  companyName = 'Independent Free Agent',
  companyRole = 'Citizen Operator',
  className = '',
}: CitizenPassProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(citizenCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`relative bg-gradient-to-br from-vc-panel via-vc-card to-[#030712] border-2 border-vc-gold/40 rounded-lg p-5 shadow-2xl overflow-hidden font-mono ${className}`}
    >
      {/* Decorative Stamp watermark */}
      <div className="absolute right-3 top-3 border border-vc-gold/20 text-vc-gold/20 text-[9px] uppercase px-2 py-0.5 rounded rotate-12 pointer-events-none select-none tracking-widest">
        VERIFIED CITIZEN
      </div>

      {/* Ticket Cutout notches */}
      <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-[#030712] rounded-full border-r border-vc-gold/40" />
      <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-5 h-5 bg-[#030712] rounded-full border-l border-vc-gold/40" />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-vc-border pb-3 mb-4">
        <div>
          <div className="text-[10px] text-gray-400 uppercase tracking-widest">
            ENTRY PERMIT № VC-2026
          </div>
          <div className="text-xs font-bold text-vc-gold uppercase tracking-wider">
            CITIZEN PASS № {citizenCode}
          </div>
        </div>
        <div className="text-[10px] text-gray-500 font-mono tracking-widest text-right">
          ADMIT ONE
        </div>
      </div>

      {/* Citizen Details */}
      <div className="space-y-3">
        <div>
          <div className="text-[10px] uppercase text-gray-500 tracking-wider">Citizen Name</div>
          <div className="text-xl font-syne font-bold text-white tracking-wide">{name}</div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <div className="text-[10px] uppercase text-gray-500 tracking-wider">Affiliation</div>
            <div className="text-xs text-gray-200 font-medium truncate">
              {companyName || 'Free Agent'}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-gray-500 tracking-wider">Designation</div>
            <div className="text-xs text-gray-300 truncate">
              {companyRole || 'Operator'}
            </div>
          </div>
        </div>
      </div>

      {/* Barcode & Share Code Footer */}
      <div className="mt-5 pt-3 border-t border-dashed border-gray-800 flex items-center justify-between gap-3">
        {/* Mock Barcode */}
        <div className="flex items-center gap-0.5 h-6 opacity-60">
          {[3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3, 8, 4, 6].map((w, i) => (
            <div
              key={i}
              className="bg-white h-full"
              style={{ width: `${(w % 3) + 1.5}px` }}
            />
          ))}
        </div>

        {/* Copy Citizen Code Button */}
        <button
          onClick={handleCopy}
          type="button"
          className="flex items-center gap-1.5 bg-vc-gold/10 hover:bg-vc-gold/20 text-vc-gold text-xs px-3 py-1.5 rounded border border-vc-gold/30 active:scale-95 transition-all"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-vc-emerald" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'COPIED' : citizenCode}</span>
        </button>
      </div>
    </div>
  );
}
