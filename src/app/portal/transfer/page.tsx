'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PortalNav } from '@/components/portal-nav';
import { ClockBanner } from '@/components/ui/clock-banner';
import { Send, ArrowLeft, AlertCircle, CheckCircle2, ArrowUpRight, ArrowDownLeft, ShieldCheck, RefreshCw } from 'lucide-react';
import Link from 'next/link';

export default function TransferPage() {
  const router = useRouter();
  const [recipientCode, setRecipientCode] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSessionAndHistory = async () => {
    try {
      setHistoryLoading(true);
      const sessRes = await fetch('/api/auth/session');
      if (sessRes.ok) {
        const s = await sessRes.json();
        if (s.user) setSession(s.user);
      }

      const txRes = await fetch('/api/ledger/transfer');
      if (txRes.ok) {
        const d = await txRes.json();
        setRecentEntries(d.ledgerEntries || []);
      }
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadSessionAndHistory();
    const interval = setInterval(loadSessionAndHistory, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await fetch('/api/ledger/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientCode: recipientCode.trim(),
          amount: parseInt(amount, 10),
          reason: reason.trim(),
          idempotencyKey: `tx_req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Transfer failed');
      }

      if (data.directSettled) {
        setSuccess(`Transfer of ${data.amount.toLocaleString()} VB to ${data.recipient} completed! Debited from your personal wallet immediately. Your verified balance is ${data.newSenderBalance.toLocaleString()} VB.`);
        setSession((prev: any) => prev ? { ...prev, walletBalance: data.newSenderBalance } : prev);
      } else {
        setSuccess(`Transfer proposal dispatched to ${data.recipient}! Awaiting counterparty confirmation.`);
      }
      setAmount('');
      setReason('');
      setRecipientCode('');
      loadSessionAndHistory();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-vc-bg text-gray-100 flex flex-col pb-24">
      <ClockBanner />
      <PortalNav citizenCode={session?.citizenCode} pendingCount={session?.pendingCount} />

      <main className="w-full max-w-lg mx-auto p-4 space-y-5">
        <div className="flex items-center justify-between">
          <Link
            href="/portal"
            className="text-gray-400 hover:text-white flex items-center gap-1.5 text-xs font-mono"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Pass</span>
          </Link>
          <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
            <span>Available:</span>
            <span className="text-vc-gold font-bold font-syne text-sm">
              {session?.walletBalance !== undefined ? session.walletBalance.toLocaleString() : '...'} VB
            </span>
            <button
              onClick={loadSessionAndHistory}
              disabled={historyLoading}
              className="text-gray-400 hover:text-white"
              title="Refresh ledger balance"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${historyLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Transfer Form Card */}
        <div className="bg-vc-card border border-vc-border rounded-xl p-5 shadow-xl space-y-4 font-mono">
          <div className="border-b border-gray-800 pb-3">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-syne font-bold text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-vc-gold" />
                <span>Send Venture Bucks</span>
              </h1>
              <span className="text-[10px] bg-vc-emerald/10 border border-vc-emerald/30 text-vc-emerald font-bold px-2 py-0.5 rounded">
                ACID ATOMIC
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Funds are debited from your personal wallet and credited to the recipient immediately with verified ACID ledger guarantees.
            </p>
          </div>

          {error && (
            <div className="bg-vc-rose/10 border border-vc-rose/30 text-vc-rose p-3 rounded text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="bg-vc-emerald/10 border border-vc-emerald/30 text-vc-emerald p-3.5 rounded text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Atomic Settlement Verified</span>
              </div>
              <p className="text-gray-300">{success}</p>
              <div className="pt-2 flex items-center gap-2">
                <Link
                  href="/portal"
                  className="bg-vc-emerald/20 hover:bg-vc-emerald/30 text-vc-emerald px-3 py-1.5 rounded inline-block text-[11px] font-bold"
                >
                  Return to Pass
                </Link>
                <button
                  onClick={() => setSuccess(null)}
                  className="px-3 py-1.5 text-gray-400 hover:text-white text-[11px]"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[11px] text-gray-400 uppercase tracking-wider mb-1.5">
                Recipient Citizen Code (or ID)
              </label>
              <input
                type="text"
                required
                value={recipientCode}
                onChange={(e) => setRecipientCode(e.target.value)}
                placeholder="e.g. VC-002, VC-042"
                className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold text-white px-3.5 py-2.5 rounded text-sm outline-none font-bold uppercase tracking-wider"
              />
              <span className="text-[10px] text-gray-500">Ask the counterparty for their Citizen Pass code.</span>
            </div>

            <div>
              <label className="block text-[11px] text-gray-400 uppercase tracking-wider mb-1.5">
                Amount (VB)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Integer VB amount"
                className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold text-white px-3.5 py-2.5 rounded text-sm outline-none font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] text-gray-400 uppercase tracking-wider mb-1.5">
                Reason / Contract Description
              </label>
              <textarea
                rows={2}
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Compute node advisory, Component delivery, Bribe bounty"
                className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold text-white px-3.5 py-2.5 rounded text-sm outline-none resize-none"
              />
              <span className="text-[10px] text-gray-500">Reason is permanently audited in the append-only ledger.</span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-vc-gold hover:bg-vc-gold-hover text-black font-syne font-bold text-sm uppercase py-3 rounded tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{loading ? 'Executing Settlement...' : 'Send Venture Bucks (Instant ACID)'}</span>
            </button>
          </form>
        </div>

        {/* Recent Personal Transfers Widget */}
        <div className="bg-vc-card border border-vc-border rounded-xl p-5 shadow space-y-3 font-mono">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2 text-xs">
            <div className="flex items-center gap-2 text-gray-400 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-vc-gold" />
              <span>Recent Personal Transfers</span>
            </div>
            <span className="text-[10px] text-vc-emerald font-bold">APPEND-ONLY AUDIT</span>
          </div>

          <div className="space-y-2">
            {recentEntries.length === 0 ? (
              <p className="text-xs text-gray-500 py-3 text-center">No personal transfers recorded yet.</p>
            ) : (
              recentEntries.slice(0, 10).map((entry) => {
                const isCredit = entry.to_id === session?.userId;
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-2.5 bg-black/40 rounded border border-gray-800/80 text-xs hover:border-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`p-1.5 rounded-full ${
                          isCredit
                            ? 'bg-vc-emerald/10 text-vc-emerald'
                            : 'bg-vc-rose/10 text-vc-rose'
                        }`}
                      >
                        {isCredit ? (
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div>
                        <div className="text-white font-medium truncate max-w-[170px]">
                          {entry.reason}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {isCredit
                            ? `From: ${entry.from_name || entry.from_citizen_code || 'System'}`
                            : `To: ${entry.to_name || entry.to_citizen_code || 'Counterparty'}`}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`font-bold font-syne text-sm ${
                          isCredit ? 'text-vc-emerald' : 'text-vc-rose'
                        }`}
                      >
                        {isCredit ? '+' : '-'}
                        {entry.amount.toLocaleString()} VB
                      </div>
                      <div className="text-[9px] text-gray-500">
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
