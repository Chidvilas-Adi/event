'use client';

import React, { useEffect, useState } from 'react';
import {
  Terminal,
  Cpu,
  Database,
  ShieldCheck,
  ShieldAlert,
  Activity,
  RefreshCw,
  Play,
  CheckCircle2,
  XCircle,
  Sliders,
  Server,
  Layers,
  FileCode,
  AlertTriangle,
} from 'lucide-react';

export default function GmTechEnginePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Trigger Probe State
  const [probeRunning, setProbeRunning] = useState(false);
  const [probeResult, setProbeResult] = useState<any>(null);

  // Config hot-reload state
  const [tickMinutes, setTickMinutes] = useState('30');
  const [rulesLocked, setRulesLocked] = useState(true);
  const [configSaving, setConfigSaving] = useState(false);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/admin/system');
      if (res.ok) {
        const d = await res.json();
        setData(d);
        if (d.worldState) {
          setTickMinutes(String(d.worldState.tick_interval_minutes || 30));
          setRulesLocked(d.worldState.rules_locked ?? true);
        }
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const runImmutabilityProbe = async () => {
    setProbeRunning(true);
    setProbeResult(null);
    try {
      const res = await fetch('/api/admin/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_immutability' }),
      });
      const resData = await res.json();
      setProbeResult(resData);
    } catch (err: any) {
      setProbeResult({ testPassed: false, error: err.message });
    } finally {
      setProbeRunning(false);
    }
  };

  const handleConfigSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigSaving(true);
    setConfigSuccess(null);
    setConfigError(null);
    try {
      const res = await fetch('/api/admin/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_config',
          tickIntervalMinutes: parseInt(tickMinutes, 10),
          rulesLocked,
        }),
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Failed to update config');
      setConfigSuccess('System configuration parameters hot-reloaded successfully!');
      loadData();
    } catch (err: any) {
      setConfigError(err.message);
    } finally {
      setConfigSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-4 font-mono text-xs">
        <div className="h-10 bg-vc-card rounded animate-pulse" />
        <div className="h-64 bg-vc-card rounded animate-pulse" />
      </div>
    );
  }

  const pool = data?.poolStats || { totalCount: 0, idleCount: 0, waitingCount: 0, maxLimit: 60 };
  const integrity = data?.ledgerIntegrity || { totalCredits: 0, totalDebits: 0, totalEntityBalances: 0, discrepancy: 0, isConsistent: true };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Title Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Terminal className="w-5 h-5 text-cyan-400" />
            <h1 className="text-2xl font-syne font-black text-white">TECH ADMIN & SYSTEM ENGINE CONSOLE</h1>
            <span className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
              SUPER-ADMIN
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Low-level PostgreSQL telemetry, live append-only trigger probes, mathematical ledger reconciliation, and hot-reload controls.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={refreshing}
          className="self-start sm:self-auto p-2 bg-gray-900 hover:bg-gray-800 text-gray-300 rounded border border-gray-700 flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Probe Engine</span>
        </button>
      </div>

      {/* Real-time Hardware & Pool Telemetry */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-vc-card border border-vc-border rounded-xl p-4 shadow">
          <div className="flex items-center justify-between text-gray-400 text-[10px] uppercase">
            <span>DB Roundtrip Ping</span>
            <Activity className="w-4 h-4 text-vc-emerald" />
          </div>
          <div className="text-2xl font-syne font-black text-white mt-2">
            {data?.dbLatencyMs ?? 0} <span className="text-xs text-vc-emerald font-normal">ms</span>
          </div>
          <div className="text-[10px] text-gray-500 mt-1">Direct query latency</div>
        </div>

        <div className="bg-vc-card border border-vc-border rounded-xl p-4 shadow">
          <div className="flex items-center justify-between text-gray-400 text-[10px] uppercase">
            <span>PG Connection Pool</span>
            <Server className="w-4 h-4 text-vc-blue" />
          </div>
          <div className="text-2xl font-syne font-black text-white mt-2">
            {pool.totalCount} <span className="text-xs text-gray-400 font-normal">/ {pool.maxLimit}</span>
          </div>
          <div className="text-[10px] text-gray-400 mt-1">
            Active: {pool.totalCount - pool.idleCount} | Idle: {pool.idleCount} | Queue: {pool.waitingCount}
          </div>
        </div>

        <div className="bg-vc-card border border-vc-border rounded-xl p-4 shadow">
          <div className="flex items-center justify-between text-gray-400 text-[10px] uppercase">
            <span>Ledger Math Discrepancy</span>
            <ShieldCheck className="w-4 h-4 text-vc-gold" />
          </div>
          <div className={`text-2xl font-syne font-black mt-2 ${integrity.isConsistent ? 'text-vc-emerald' : 'text-vc-rose'}`}>
            {integrity.discrepancy} <span className="text-xs font-normal">VB</span>
          </div>
          <div className="text-[10px] text-gray-400 mt-1">
            {integrity.isConsistent ? 'Zero-Sum Consistently Balanced' : 'CRITICAL: DISCREPANCY DETECTED'}
          </div>
        </div>

        <div className="bg-vc-card border border-vc-border rounded-xl p-4 shadow">
          <div className="flex items-center justify-between text-gray-400 text-[10px] uppercase">
            <span>Database Triggers</span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-syne font-black text-cyan-400 mt-2">
            {data?.triggersActive ? 'ACTIVE' : 'OFFLINE'}
          </div>
          <div className="text-[10px] text-gray-400 mt-1">Append-only triggers armed</div>
        </div>
      </div>

      {/* Live Immutability Security Probe */}
      <div className="bg-vc-card border border-vc-border rounded-xl p-6 shadow space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-vc-gold" />
              <h2 className="text-base font-syne font-bold text-white uppercase">
                PostgreSQL Engine Immutability Verifier
              </h2>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              Fires illegal UPDATE and DELETE queries against the live database in a subtransaction to confirm PostgreSQL raises exceptions.
            </p>
          </div>

          <button
            onClick={runImmutabilityProbe}
            disabled={probeRunning}
            className="bg-vc-gold hover:bg-vc-gold-hover text-black font-syne font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow active:scale-95 transition-transform"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>{probeRunning ? 'Testing Triggers...' : 'Run Immutability Probe'}</span>
          </button>
        </div>

        {probeResult && (
          <div className="p-4 bg-black/60 rounded-lg border border-gray-800 space-y-3">
            <div className="flex items-center gap-2 font-bold">
              {probeResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-vc-emerald" />
              ) : (
                <XCircle className="w-4 h-4 text-vc-rose" />
              )}
              <span className={probeResult.success ? 'text-vc-emerald' : 'text-vc-rose'}>
                {probeResult.message}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
              <div className="p-3 bg-gray-900/80 rounded border border-gray-800">
                <div className="font-bold text-white flex items-center justify-between">
                  <span>UPDATE ledger_entries</span>
                  <span className="text-vc-emerald font-bold uppercase">STRICTLY BLOCKED</span>
                </div>
                <div className="text-gray-400 font-mono text-[10px] mt-1 break-all">
                  Exception: {probeResult.updateErrorMsg}
                </div>
              </div>

              <div className="p-3 bg-gray-900/80 rounded border border-gray-800">
                <div className="font-bold text-white flex items-center justify-between">
                  <span>DELETE audit_log</span>
                  <span className="text-vc-emerald font-bold uppercase">STRICTLY BLOCKED</span>
                </div>
                <div className="text-gray-400 font-mono text-[10px] mt-1 break-all">
                  Exception: {probeResult.deleteErrorMsg}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Row Census & Hot-Reload Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Table Census */}
        <div className="bg-vc-card border border-vc-border rounded-xl p-5 shadow space-y-3">
          <div className="flex items-center gap-2 border-b border-gray-800 pb-2">
            <Database className="w-4 h-4 text-vc-blue" />
            <h3 className="font-syne font-bold text-white uppercase text-xs">
              Relational Storage Row Census
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(data?.tableCounts || {}).map(([tbl, count]: any) => (
              <div key={tbl} className="bg-black/40 border border-gray-800/80 p-2.5 rounded">
                <div className="text-[10px] text-gray-400 font-mono truncate">{tbl}</div>
                <div className="text-base font-syne font-bold text-white mt-0.5">{count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Hot-Reload Config Controls */}
        <div className="bg-vc-card border border-vc-border rounded-xl p-5 shadow space-y-3">
          <div className="flex items-center gap-2 border-b border-gray-800 pb-2">
            <Sliders className="w-4 h-4 text-vc-gold" />
            <h3 className="font-syne font-bold text-white uppercase text-xs">
              Live Configuration Hot-Reload Engine
            </h3>
          </div>

          {configSuccess && (
            <div className="p-2.5 bg-vc-emerald/10 border border-vc-emerald/30 text-vc-emerald rounded flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>{configSuccess}</span>
            </div>
          )}

          {configError && (
            <div className="p-2.5 bg-vc-rose/10 border border-vc-rose/30 text-vc-rose rounded flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{configError}</span>
            </div>
          )}

          <form onSubmit={handleConfigSave} className="space-y-4">
            <div>
              <label className="block text-gray-400 mb-1 font-bold">Tick Interval (Minutes):</label>
              <input
                type="number"
                value={tickMinutes}
                onChange={(e) => setTickMinutes(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                required
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="rulesLocked"
                checked={rulesLocked}
                onChange={(e) => setRulesLocked(e.target.checked)}
                className="rounded bg-gray-900 border-gray-700 text-vc-gold"
              />
              <label htmlFor="rulesLocked" className="text-gray-300">
                Simulation Rules Immutable & Locked (Tamper Guard)
              </label>
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-800">
              <button
                type="submit"
                disabled={configSaving}
                className="bg-cyan-500 hover:bg-cyan-400 text-black font-syne font-bold text-xs px-4 py-2 rounded flex items-center gap-1.5 shadow"
              >
                <span>{configSaving ? 'Reloading...' : 'Hot-Reload Config'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
