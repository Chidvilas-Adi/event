'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Building2,
  Search,
  Activity,
  Coins,
  ShieldAlert,
  Clock,
  Layers,
  FileText,
  Briefcase,
  ExternalLink,
  RefreshCw,
  Cpu,
  Zap,
  Truck,
  Box,
  Database,
} from 'lucide-react';

export default function GmCharacterMonitorPage() {
  const [monitorType, setMonitorType] = useState<'participant' | 'company'>('participant');
  const [participants, setParticipants] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [monitorData, setMonitorData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Load entities lists
  useEffect(() => {
    fetch('/api/participants')
      .then((r) => r.json())
      .then((d) => {
        const list = d.participants || [];
        setParticipants(list);
        if (monitorType === 'participant' && list.length > 0 && !selectedId) {
          setSelectedId(list[0].id);
        }
      });

    fetch('/api/companies')
      .then((r) => r.json())
      .then((d) => {
        const list = d.companies || [];
        setCompanies(list);
        if (monitorType === 'company' && list.length > 0 && !selectedId) {
          setSelectedId(list[0].id);
        }
      });
  }, [monitorType]);

  // 2. Fetch monitor data when selected entity changes
  const loadMonitorData = async (type: string, id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/gm/monitor?type=${type}&id=${encodeURIComponent(id)}`);
      if (res.ok) {
        const data = await res.json();
        setMonitorData(data);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedId) {
      loadMonitorData(monitorType, selectedId);
      const interval = setInterval(() => loadMonitorData(monitorType, selectedId), 5000);
      return () => clearInterval(interval);
    }
  }, [monitorType, selectedId]);

  const filteredParticipants = participants.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.citizen_code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCompanies = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-syne font-black text-white">CHARACTER & VENTURE TELEMETRY MONITOR</h1>
          <p className="text-xs text-gray-400">
            Real-time omniscient supervisor portal. Inspect wallets, live views, pending deals, and historical audit logs.
          </p>
        </div>

        <button
          onClick={() => loadMonitorData(monitorType, selectedId)}
          className="self-start sm:self-auto p-2 bg-gray-900 hover:bg-gray-800 text-gray-300 rounded border border-gray-700 flex items-center gap-1.5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Sync State</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Side: Entity Selector */}
        <div className="bg-vc-card border border-vc-border rounded-xl p-4 space-y-4 shadow">
          {/* Toggle Type */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setMonitorType('participant');
                if (participants.length > 0) setSelectedId(participants[0].id);
              }}
              className={`py-2 rounded font-bold flex items-center justify-center gap-1.5 border transition-colors ${
                monitorType === 'participant'
                  ? 'bg-vc-gold text-black border-vc-gold font-syne'
                  : 'bg-gray-900 text-gray-400 border-gray-800 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Citizens</span>
            </button>
            <button
              onClick={() => {
                setMonitorType('company');
                if (companies.length > 0) setSelectedId(companies[0].id);
              }}
              className={`py-2 rounded font-bold flex items-center justify-center gap-1.5 border transition-colors ${
                monitorType === 'company'
                  ? 'bg-vc-gold text-black border-vc-gold font-syne'
                  : 'bg-gray-900 text-gray-400 border-gray-800 hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Ventures</span>
            </button>
          </div>

          {/* Search box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter names..."
              className="w-full bg-black/60 border border-gray-800 rounded pl-8 pr-2 py-1.5 text-white text-[11px] outline-none"
            />
          </div>

          {/* Entity List */}
          <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
            {monitorType === 'participant' ? (
              filteredParticipants.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                    selectedId === p.id
                      ? 'bg-gray-800 border-vc-gold text-white'
                      : 'bg-gray-900/60 border-transparent text-gray-300 hover:bg-gray-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-vc-gold">{p.citizen_code}</span>
                    <span className="text-[10px] text-gray-400 capitalize">{p.role}</span>
                  </div>
                  <div className="text-white font-medium truncate mt-0.5">{p.name}</div>
                </button>
              ))
            ) : (
              filteredCompanies.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                    selectedId === c.id
                      ? 'bg-gray-800 border-vc-gold text-white'
                      : 'bg-gray-900/60 border-transparent text-gray-300 hover:bg-gray-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white font-syne">{c.name}</span>
                    <span className="text-[10px] text-vc-gold font-bold">Tier {c.tier}</span>
                  </div>
                  <div className="text-[10px] text-gray-400 truncate mt-0.5">{c.tagline}</div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right Side: Omniscient Telemetry Deck */}
        <div className="lg:col-span-3 space-y-6">
          {loading && !monitorData ? (
            <div className="bg-vc-card border border-vc-border rounded-xl p-8 text-center text-gray-500 animate-pulse">
              Querying immutable state and action logs...
            </div>
          ) : !monitorData ? (
            <div className="bg-vc-card border border-vc-border rounded-xl p-8 text-center text-gray-500">
              Select an entity to monitor.
            </div>
          ) : (
            <>
              {/* Profile Card */}
              <div className="bg-vc-card border border-vc-border rounded-xl p-5 shadow space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-800 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-vc-gold" />
                      <h2 className="text-lg font-syne font-black text-white">
                        {monitorData.entity?.name}
                      </h2>
                      {monitorData.entity?.citizen_code && (
                        <span className="text-vc-gold font-bold">[{monitorData.entity.citizen_code}]</span>
                      )}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      Target ID: <span className="text-gray-300">{monitorData.entity?.id}</span> | Status:{' '}
                      <span className="text-vc-emerald font-bold uppercase">{monitorData.entity?.status}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-gray-400 uppercase">Live Vault Balance</div>
                    <div className="text-2xl font-syne font-black text-vc-gold">
                      {(monitorData.balance ?? 0).toLocaleString()} <span className="text-sm">VB</span>
                    </div>
                  </div>
                </div>

                {/* Additional Company Stats if monitoring company */}
                {monitorType === 'company' && monitorData.resources && (
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase font-bold mb-2">
                      Current Resource Stock
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {Object.entries(monitorData.resources).map(([resKey, qty]: any) => (
                        <div key={resKey} className="bg-black/40 border border-gray-800 p-2 rounded text-center">
                          <div className="text-[9px] text-gray-400 uppercase">{resKey}</div>
                          <div className="text-sm font-bold text-white font-syne">{qty}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Active Deals & Pending Contracts */}
              <div className="bg-vc-card border border-vc-border rounded-xl p-5 shadow space-y-3">
                <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-vc-blue" />
                    <h3 className="font-syne font-bold text-white uppercase text-xs">
                      Active Deals & Proposing Pipeline ({monitorData.activeDeals?.length || 0})
                    </h3>
                  </div>
                </div>

                {(monitorData.activeDeals || []).length === 0 ? (
                  <p className="text-gray-500 py-3 text-center">No active deals on record.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="text-[10px] text-gray-400 uppercase bg-gray-900/60 border-b border-gray-800">
                        <tr>
                          <th className="py-2 px-3">Template</th>
                          <th className="py-2 px-3">Parties</th>
                          <th className="py-2 px-3">Terms Summary</th>
                          <th className="py-2 px-3">Version</th>
                          <th className="py-2 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {monitorData.activeDeals.map((d: any) => (
                          <tr key={d.id} className="hover:bg-gray-900/30">
                            <td className="py-2.5 px-3 font-bold text-vc-gold uppercase">{d.template_type}</td>
                            <td className="py-2.5 px-3 text-white">
                              <div>From: {d.sender_id}</div>
                              <div className="text-gray-400">To: {d.recipient_id}</div>
                            </td>
                            <td className="py-2.5 px-3 text-gray-300 max-w-xs truncate">
                              {JSON.stringify(d.terms)}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-vc-blue">v{d.version}</td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`px-2 py-0.5 rounded font-bold uppercase text-[9px] ${
                                  d.status === 'accepted'
                                    ? 'bg-vc-emerald/10 text-vc-emerald border border-vc-emerald/30'
                                    : 'bg-vc-gold/10 text-vc-gold border border-vc-gold/30'
                                }`}
                              >
                                {d.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Chronological Action Logs Done So Far */}
              <div className="bg-vc-card border border-vc-border rounded-xl p-5 shadow space-y-3">
                <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-vc-gold" />
                    <h3 className="font-syne font-bold text-white uppercase text-xs">
                      Historical Action Logs Done Till Now ({monitorData.recentAudits?.length || 0})
                    </h3>
                  </div>
                  <span className="text-[10px] text-gray-400">Chronological Audit Records</span>
                </div>

                {(monitorData.recentAudits || []).length === 0 ? (
                  <p className="text-gray-500 py-3 text-center">No audit trail records found for this character.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="text-[10px] text-gray-400 uppercase bg-gray-900/60 border-b border-gray-800">
                        <tr>
                          <th className="py-2 px-3">Timestamp</th>
                          <th className="py-2 px-3">Action</th>
                          <th className="py-2 px-3">Reason / Narrative</th>
                          <th className="py-2 px-3">Source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800">
                        {monitorData.recentAudits.map((a: any) => (
                          <tr key={a.id} className="hover:bg-gray-900/30">
                            <td className="py-2.5 px-3 text-gray-400 whitespace-nowrap">
                              {new Date(a.timestamp).toLocaleTimeString()}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-white uppercase">
                              <span className="bg-gray-800 px-1.5 py-0.5 rounded text-[10px] border border-gray-700">
                                {a.action}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-gray-300 max-w-sm leading-relaxed">
                              {a.reason || 'N/A'}
                            </td>
                            <td className="py-2.5 px-3 text-gray-500 font-mono text-[10px]">
                              {a.source}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
