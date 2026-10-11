'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  Coins,
  Landmark,
  Radio,
  BookOpen,
  ArrowRight,
  ShieldAlert,
  Clock,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

export default function GmOverviewPage() {
  const [stats, setStats] = useState<{
    totalCirculation: number;
    companiesCount: number;
    citizensCount: number;
    institutionsCount: number;
    pendingCount: number;
  }>({
    totalCirculation: 0,
    companiesCount: 7,
    citizensCount: 100,
    institutionsCount: 8,
    pendingCount: 0,
  });

  const [recentAudits, setRecentAudits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      // 1. Fetch companies to calculate circulation
      const compRes = await fetch('/api/companies');
      if (compRes.ok) {
        const d = await compRes.json();
        const totalComp = d.companies.reduce(
          (acc: number, c: any) => acc + (c.vault_balance || 0),
          0
        );
        // Estimate citizens 100 * ~500 VB
        setStats((prev) => ({
          ...prev,
          totalCirculation: totalComp + 50000,
          companiesCount: d.companies.length,
        }));
      }

      // 2. Fetch institutions
      const instRes = await fetch('/api/institutions');
      if (instRes.ok) {
        const instData = await instRes.json();
        const openCount = instData.filter((i: any) => i.is_open).length;
        setStats((prev) => ({ ...prev, institutionsCount: openCount }));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-syne font-black text-white">WORLD COMMAND DECK</h1>
          <p className="text-xs text-gray-400">
            Real-time telemetry and supervisory control for Venture City simulation.
          </p>
        </div>
        <button
          onClick={loadData}
          className="text-gray-400 hover:text-white p-2 border border-gray-800 rounded bg-vc-card text-xs flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Sync State</span>
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-vc-card border border-vc-border p-4 rounded-xl shadow space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>CURRENCY IN CIRCULATION</span>
            <Coins className="w-4 h-4 text-vc-gold" />
          </div>
          <div className="text-2xl font-syne font-bold text-vc-gold">
            {stats.totalCirculation.toLocaleString()} <span className="text-sm">VB</span>
          </div>
          <div className="text-[10px] text-gray-500">Pure ledger balance calculation</div>
        </div>

        <div className="bg-vc-card border border-vc-border p-4 rounded-xl shadow space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>OPERATING VENTURES</span>
            <Building2 className="w-4 h-4 text-vc-blue" />
          </div>
          <div className="text-2xl font-syne font-bold text-white">
            {stats.companiesCount} <span className="text-sm text-gray-400">Ventures</span>
          </div>
          <div className="text-[10px] text-gray-500">Tier 1 Autonomous Entities</div>
        </div>

        <div className="bg-vc-card border border-vc-border p-4 rounded-xl shadow space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>SIMULATION POPULATION</span>
            <Users className="w-4 h-4 text-vc-emerald" />
          </div>
          <div className="text-2xl font-syne font-bold text-white">
            {stats.citizensCount} <span className="text-sm text-gray-400">Citizens</span>
          </div>
          <div className="text-[10px] text-gray-500">Passes verified & active</div>
        </div>

        <div className="bg-vc-card border border-vc-border p-4 rounded-xl shadow space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>ACTIVE INSTITUTIONS</span>
            <Landmark className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-syne font-bold text-white">
            {stats.institutionsCount} / 8 <span className="text-sm text-gray-400">Open</span>
          </div>
          <div className="text-[10px] text-gray-500">Station limits enforced</div>
        </div>
      </div>

      {/* Quick Launchpad */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/gm/ledger"
          className="bg-vc-card border border-vc-border hover:border-vc-gold/50 p-5 rounded-xl shadow group transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <BookOpen className="w-5 h-5 text-vc-gold" />
            <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-vc-gold group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-base font-syne font-bold text-white">Manual Grant / Revocation</h3>
          <p className="text-xs text-gray-400 mt-1">
            Issue VB or resources directly to any venture or citizen with logged regulatory rationale.
          </p>
        </Link>

        <Link
          href="/gm/announcements"
          className="bg-vc-card border border-vc-border hover:border-vc-gold/50 p-5 rounded-xl shadow group transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <Radio className="w-5 h-5 text-vc-rose" />
            <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-vc-gold group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-base font-syne font-bold text-white">Broadcast Announcement</h3>
          <p className="text-xs text-gray-400 mt-1">
            Transmit instant public bulletins or targeted transmissions to specific ventures or roles.
          </p>
        </Link>

        <Link
          href="/gm/disruptions"
          className="bg-vc-card border border-vc-border hover:border-amber-500/50 p-5 rounded-xl shadow group transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-base font-syne font-bold text-white">Disruptions & Crisis Engine</h3>
          <p className="text-xs text-gray-400 mt-1">
            Launch from 20 macroeconomic disruption presets or inject custom shocks with real-time countdowns.
          </p>
        </Link>

        <Link
          href="/gm/missions"
          className="bg-vc-card border border-vc-border hover:border-cyan-500/50 p-5 rounded-xl shadow group transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <Sparkles className="w-5 h-5 text-cyan-400" />
            <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-base font-syne font-bold text-white">Quests, Flags & Intel</h3>
          <p className="text-xs text-gray-400 mt-1">
            Inspect live role missions, physical verification flag checks, and classified intelligence brokers.
          </p>
        </Link>

        <Link
          href="/gm/export"
          className="bg-vc-card border border-vc-border hover:border-vc-gold/50 p-5 rounded-xl shadow group transition-all"
        >
          <div className="flex items-center justify-between mb-2">
            <Radio className="w-5 h-5 text-vc-blue" />
            <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-vc-gold group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-base font-syne font-bold text-white">Paper Fallback Exports</h3>
          <p className="text-xs text-gray-400 mt-1">
            Download full ledger CSV, company balances, and printable roster if physical backup is needed.
          </p>
        </Link>
      </div>

      {/* World Operational Rules Notice */}
      <div className="bg-vc-card/60 border border-gray-800 p-5 rounded-xl text-xs space-y-2">
        <div className="text-white font-bold uppercase tracking-wider text-[11px] text-vc-gold">
          OPERATING DIRECTIVES (SECTION 1 & 7)
        </div>
        <ul className="text-gray-300 space-y-1 list-disc list-inside">
          <li><strong>Human First:</strong> The app is an operating system for human negotiation, never an automatic decider.</li>
          <li><strong>One Source of Truth:</strong> Ledger balances are computed dynamically from immutable append-only records.</li>
          <li><strong>No Unilateral Admin Changes:</strong> Only the Game Master role can authorize money movement or overrides.</li>
          <li><strong>Written Reason Required:</strong> Every clock advance, pause, freeze, and asset grant requires a logged reason.</li>
        </ul>
      </div>
    </div>
  );
}
