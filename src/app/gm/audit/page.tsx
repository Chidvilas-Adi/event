'use client';

import React, { useEffect, useState } from 'react';
import { FileText, Search, RefreshCw, ShieldCheck } from 'lucide-react';

export default function GmAuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const loadLogs = async (searchStr: string) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/audit?q=${encodeURIComponent(searchStr)}`);
      if (res.ok) {
        const d = await res.json();
        setLogs(d);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs('');
  }, []);

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-syne font-black text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-vc-emerald" />
            <span>IMMUTABLE AUDIT LOG</span>
          </h1>
          <p className="text-gray-400">
            Append-only record of every login, clock adjustment, freeze, ledger movement, and institution edit.
          </p>
        </div>

        <button
          onClick={() => loadLogs(query)}
          className="p-2 border border-gray-800 rounded bg-vc-card text-gray-400 hover:text-white flex items-center gap-1.5 self-start"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Trail</span>
        </button>
      </div>

      {/* Search Input */}
      <div className="relative max-w-sm">
        <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            loadLogs(e.target.value);
          }}
          placeholder="Search actor, action, reason, target..."
          className="w-full bg-vc-card border border-gray-800 focus:border-vc-gold text-white pl-8 pr-3 py-1.5 rounded text-xs outline-none"
        />
      </div>

      {/* Audit Log Table */}
      <div className="bg-vc-card border border-vc-border rounded-xl shadow-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#030712] border-b border-gray-800 text-gray-400 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-2.5 px-3">Timestamp</th>
              <th className="py-2.5 px-3">Actor / Role</th>
              <th className="py-2.5 px-3">Action</th>
              <th className="py-2.5 px-3">Target Object</th>
              <th className="py-2.5 px-3">Reason / Context</th>
              <th className="py-2.5 px-3 text-right">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/70">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  Verifying append-only audit trail...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  No audit log entries found.
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-900/60 transition-colors">
                  <td className="py-2 px-3 text-gray-400 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2 px-3">
                    <span className="font-bold text-white">{log.actor_id}</span>{' '}
                    <span className="text-[10px] text-vc-gold uppercase">[{log.actor_role}]</span>
                  </td>
                  <td className="py-2 px-3">
                    <span className="bg-gray-900 text-gray-200 border border-gray-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-gray-300">
                    {log.object_type}:{log.object_id}
                  </td>
                  <td className="py-2 px-3 text-gray-200 max-w-sm truncate" title={log.reason}>
                    {log.reason || '—'}
                  </td>
                  <td className="py-2 px-3 text-right text-gray-500 uppercase text-[10px]">
                    {log.source}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
