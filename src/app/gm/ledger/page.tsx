'use client';

import React, { useEffect, useState } from 'react';
import { BookOpen, Plus, Search, RefreshCw, AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react';

export default function GmLedgerPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState('');
  const [showGrantModal, setShowGrantModal] = useState(false);

  // Grant Form
  const [targetType, setTargetType] = useState<'company' | 'participant'>('company');
  const [targetId, setTargetId] = useState('');
  const [assetType, setAssetType] = useState('vb');
  const [actionType, setActionType] = useState<'grant' | 'revoke'>('grant');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [granting, setGranting] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; msg: string } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/ledger/transfer');
      if (res.ok) {
        const d = await res.json();
        setEntries(d.ledgerEntries || []);
      }

      const compRes = await fetch('/api/companies');
      if (compRes.ok) {
        const c = await compRes.json();
        setCompanies(c.companies || []);
        if (c.companies.length > 0 && !targetId) {
          setTargetId(c.companies[0].id);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    setGranting(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/ledger/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          targetId: targetId.trim(),
          assetType,
          actionType,
          amount: parseInt(amount, 10),
          reason: reason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to execute grant');

      setFeedback({ success: true, msg: `Successfully executed ${actionType} of ${amount} ${assetType.toUpperCase()} to ${targetId}.` });
      setShowGrantModal(false);
      setAmount('');
      setReason('');
      await loadData();
    } catch (err: any) {
      setFeedback({ success: false, msg: err.message });
    } finally {
      setGranting(false);
    }
  };

  const filteredEntries = entries.filter((e) => {
    const q = filterQuery.toLowerCase();
    return (
      e.id.toLowerCase().includes(q) ||
      (e.reason && e.reason.toLowerCase().includes(q)) ||
      (e.from_id && e.from_id.toLowerCase().includes(q)) ||
      (e.to_id && e.to_id.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-syne font-black text-white">VENTURE BUCKS LEDGER</h1>
          <p className="text-gray-400">
            Immutable, append-only double-entry transaction record. UPDATE and DELETE are blocked at DB level.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGrantModal(true)}
            className="bg-vc-gold hover:bg-vc-gold-hover text-black px-3.5 py-2 rounded-lg font-syne font-bold uppercase flex items-center gap-1.5 shadow"
          >
            <Plus className="w-4 h-4" />
            <span>Manual Grant / Revoke</span>
          </button>
          <button
            onClick={loadData}
            className="p-2 border border-gray-800 rounded bg-vc-card text-gray-400 hover:text-white"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded flex items-center gap-2 ${
            feedback.success
              ? 'bg-vc-emerald/10 border border-vc-emerald/30 text-vc-emerald'
              : 'bg-vc-rose/10 border border-vc-rose/30 text-vc-rose'
          }`}
        >
          {feedback.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{feedback.msg}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter by ID, entity, reason..."
            className="w-full bg-vc-card border border-gray-800 focus:border-vc-gold text-white pl-8 pr-3 py-1.5 rounded text-xs outline-none"
          />
        </div>
        <span className="text-gray-500 text-[11px]">
          Showing {filteredEntries.length} verified entries
        </span>
      </div>

      {/* Ledger Table */}
      <div className="bg-vc-card border border-vc-border rounded-xl shadow-xl overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-[#030712] border-b border-gray-800 text-gray-400 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-2.5 px-3">Entry ID</th>
              <th className="py-2.5 px-3">Time</th>
              <th className="py-2.5 px-3">From</th>
              <th className="py-2.5 px-3">To</th>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3">Reason</th>
              <th className="py-2.5 px-3 text-right">Amount (VB)</th>
              <th className="py-2.5 px-3">Authoriser</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/70">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-gray-500">
                  Streaming ledger records...
                </td>
              </tr>
            ) : filteredEntries.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-gray-500">
                  No ledger entries matching query.
                </td>
              </tr>
            ) : (
              filteredEntries.map((e) => (
                <tr key={e.id} className="hover:bg-gray-900/60 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-vc-gold font-bold">{e.id}</td>
                  <td className="py-2.5 px-3 text-gray-400 whitespace-nowrap">
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="py-2.5 px-3 text-gray-300">
                    {e.from_id ? `${e.from_type}:${e.from_id}` : <span className="text-gray-500">SYSTEM</span>}
                  </td>
                  <td className="py-2.5 px-3 text-gray-300">
                    {e.to_id ? `${e.to_type}:${e.to_id}` : <span className="text-gray-500">SYSTEM</span>}
                  </td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${
                        e.type === 'grant'
                          ? 'bg-vc-emerald/10 text-vc-emerald'
                          : e.type === 'compensation'
                          ? 'bg-vc-rose/10 text-vc-rose'
                          : 'bg-vc-blue/10 text-vc-blue'
                      }`}
                    >
                      {e.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-gray-200 max-w-xs truncate" title={e.reason}>
                    {e.reason}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold text-white font-syne">
                    {e.amount.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-gray-400">{e.authoriser}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Grant / Revoke Modal */}
      {showGrantModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-vc-card border-2 border-vc-gold rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <h2 className="text-base font-syne font-bold text-white uppercase flex items-center gap-2">
              <Plus className="w-4 h-4 text-vc-gold" />
              <span>Direct Asset Grant or Revocation</span>
            </h2>

            <form onSubmit={handleGrant} className="space-y-3 font-mono text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-400 uppercase mb-1">Target Type</label>
                  <select
                    value={targetType}
                    onChange={(e: any) => setTargetType(e.target.value)}
                    className="w-full bg-[#030712] border border-gray-800 text-white p-2 rounded outline-none"
                  >
                    <option value="company">Venture (Company)</option>
                    <option value="participant">Citizen (Participant)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 uppercase mb-1">Action</label>
                  <select
                    value={actionType}
                    onChange={(e: any) => setActionType(e.target.value)}
                    className="w-full bg-[#030712] border border-gray-800 text-white p-2 rounded outline-none"
                  >
                    <option value="grant">Grant (Credit)</option>
                    <option value="revoke">Revoke (Debit)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Target ID</label>
                {targetType === 'company' ? (
                  <select
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full bg-[#030712] border border-gray-800 text-white p-2 rounded outline-none"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.id})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    placeholder="e.g. vc_p_001 or VC-001"
                    className="w-full bg-[#030712] border border-gray-800 text-white p-2 rounded outline-none"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-400 uppercase mb-1">Asset</label>
                  <select
                    value={assetType}
                    onChange={(e) => setAssetType(e.target.value)}
                    className="w-full bg-[#030712] border border-gray-800 text-white p-2 rounded outline-none"
                  >
                    <option value="vb">Venture Bucks (VB)</option>
                    <option value="compute">Compute Units</option>
                    <option value="energy">Clean Energy</option>
                    <option value="logistics">Logistics Slots</option>
                    <option value="materials">Materials</option>
                    <option value="data">Data Feeds</option>
                    <option value="infrastructure">Infra Modules</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-gray-400 uppercase mb-1">Amount</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="1000"
                    className="w-full bg-[#030712] border border-gray-800 text-white p-2 rounded outline-none font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 uppercase mb-1">
                  Written Regulatory Reason (Required)
                </label>
                <textarea
                  rows={2}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Government innovation prize, antitrust penalty, liquidity injection..."
                  className="w-full bg-[#030712] border border-gray-800 text-white p-2 rounded outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGrantModal(false)}
                  className="px-3 py-1.5 text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={granting}
                  className="bg-vc-gold hover:bg-vc-gold-hover text-black px-4 py-1.5 rounded font-syne font-bold uppercase disabled:opacity-50"
                >
                  {granting ? 'Executing...' : 'Commit Asset Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
