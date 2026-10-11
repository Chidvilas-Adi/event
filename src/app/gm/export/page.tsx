'use client';

import React from 'react';
import { Download, Printer, FileSpreadsheet, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function GmExportPage() {
  const downloadCsv = (type: string) => {
    window.location.href = `/api/export/${type}`;
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div>
        <h1 className="text-2xl font-syne font-black text-white flex items-center gap-2">
          <Download className="w-6 h-6 text-vc-gold" />
          <span>PAPER FALLBACK EXPORT REPOSITORY</span>
        </h1>
        <p className="text-gray-400">
          Core operating principle: If software terminates, the simulation proceeds seamlessly on paper.
        </p>
      </div>

      <div className="bg-vc-card border border-vc-border rounded-xl p-5 shadow space-y-2 text-gray-300">
        <div className="text-vc-gold font-bold uppercase text-[11px] flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          <span>OFFLINE EMERGENCY RECONCILIATION PROTOCOL</span>
        </div>
        <p className="text-xs leading-relaxed">
          The exports below download the single source of truth from the database. Event leads can print physical citizen pass ledgers, company ledger sheets, and station sheets for venue stations (Apex Bank, Frontier Investor, etc.).
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Export 1: Ledger CSV */}
        <div className="bg-vc-card border border-vc-border rounded-xl p-5 shadow-xl flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-vc-gold/10 border border-vc-gold/30 flex items-center justify-center text-vc-gold">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="text-base font-syne font-bold text-white">Full Ledger Journal</h3>
            <p className="text-gray-400 text-xs">
              Every verified double-entry ledger credit, debit, grant, and compensation with immutable IDs and authorisers.
            </p>
          </div>

          <button
            onClick={() => downloadCsv('ledger')}
            className="w-full bg-vc-gold hover:bg-vc-gold-hover text-black py-2.5 rounded font-syne font-bold uppercase flex items-center justify-center gap-2 shadow active:scale-95 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download Ledger CSV</span>
          </button>
        </div>

        {/* Export 2: Company Balances */}
        <div className="bg-vc-card border border-vc-border rounded-xl p-5 shadow-xl flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-vc-blue/10 border border-vc-blue/30 flex items-center justify-center text-vc-blue">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <h3 className="text-base font-syne font-bold text-white">Company Balances Snapshot</h3>
            <p className="text-gray-400 text-xs">
              Live calculated treasury balances across all 7 ventures, tier rankings, and active lifecycle states.
            </p>
          </div>

          <button
            onClick={() => downloadCsv('balances')}
            className="w-full bg-vc-blue hover:bg-blue-500 text-white py-2.5 rounded font-syne font-bold uppercase flex items-center justify-center gap-2 shadow active:scale-95 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download Balances CSV</span>
          </button>
        </div>

        {/* Export 3: Citizen Roster */}
        <div className="bg-vc-card border border-vc-border rounded-xl p-5 shadow-xl flex flex-col justify-between space-y-4">
          <div className="space-y-2">
            <div className="w-10 h-10 rounded-lg bg-vc-emerald/10 border border-vc-emerald/30 flex items-center justify-center text-vc-emerald">
              <Printer className="w-5 h-5" />
            </div>
            <h3 className="text-base font-syne font-bold text-white">Citizen Pass Roster</h3>
            <p className="text-gray-400 text-xs">
              Complete printable roster of 100 participants with Citizen Codes (№ VC-001 to VC-100), ventures, and designations.
            </p>
          </div>

          <button
            onClick={() => downloadCsv('roster')}
            className="w-full bg-vc-emerald hover:bg-emerald-500 text-black py-2.5 rounded font-syne font-bold uppercase flex items-center justify-center gap-2 shadow active:scale-95 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Download Roster CSV</span>
          </button>
        </div>
      </div>
    </div>
  );
}
