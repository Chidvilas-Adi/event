'use client';

import React, { useState, useEffect } from 'react';
import { ClockBanner } from '@/components/ui/clock-banner';
import { PortalNav } from '@/components/portal-nav';
import {
  ShieldAlert,
  Gavel,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileText,
  Clock,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';

export default function DisputesPortalPage() {
  const [session, setSession] = useState<any>(null);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'file'>('list');

  // Form state
  const [respondentType, setRespondentType] = useState<'company' | 'participant'>('company');
  const [respondentId, setRespondentId] = useState('');
  const [amountVb, setAmountVb] = useState('');
  const [reason, setReason] = useState('');
  const [evidence, setEvidence] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadData = async () => {
    try {
      const sessRes = await fetch('/api/auth/session');
      if (sessRes.ok) {
        const sessData = await sessRes.json();
        setSession(sessData.user);
      }

      const dispRes = await fetch('/api/disputes');
      if (dispRes.ok) {
        const data = await dispRes.json();
        setDisputes(data.disputes || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleFileDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/disputes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          respondentType,
          respondentId: respondentId.trim(),
          amountVb: amountVb ? parseInt(amountVb, 10) : undefined,
          reason: reason.trim(),
          evidence: { text: evidence.trim(), filedAt: new Date().toISOString() },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to file dispute');

      setSuccessMsg('Commercial arbitration claim filed successfully! Transmitted to Game Master docket.');
      setReason('');
      setEvidence('');
      setAmountVb('');
      setRespondentId('');
      setActiveTab('list');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-gray-100 flex flex-col font-mono pb-24 selection:bg-vc-gold selection:text-black">
      <ClockBanner />

      <PortalNav
        citizenCode={session?.citizenCode}
        role={session?.role}
        isFounder={session?.role === 'company_lead'}
      />

      <main className="max-w-2xl mx-auto w-full p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div>
            <h1 className="text-xl font-syne font-black text-white flex items-center gap-2">
              <Gavel className="w-5 h-5 text-vc-gold" />
              COMMERCIAL ARBITRATION
            </h1>
            <p className="text-xs text-gray-400">
              Contract breaches, failed deliveries, and legal dispute settlement docket.
            </p>
          </div>
          <button
            onClick={() => {
              setActiveTab(activeTab === 'list' ? 'file' : 'list');
              setErrorMsg('');
              setSuccessMsg('');
            }}
            className="px-3 py-1.5 bg-vc-gold text-black font-syne font-bold text-xs rounded flex items-center gap-1 shadow hover:bg-yellow-400"
          >
            {activeTab === 'list' ? (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>File Claim</span>
              </>
            ) : (
              <span>View Docket</span>
            )}
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-vc-rose/10 border border-vc-rose/30 text-vc-rose rounded text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-vc-emerald/10 border border-vc-emerald/30 text-vc-emerald rounded text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {activeTab === 'file' ? (
          <div className="bg-vc-card border border-vc-border rounded-xl p-5 space-y-4 shadow-xl">
            <h2 className="text-sm font-syne font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-vc-gold" />
              Incept Arbitration Claim (Official Filing)
            </h2>

            <form onSubmit={handleFileDispute} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-400 uppercase tracking-wider text-[10px] mb-1">
                  Respondent Entity Category:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRespondentType('company')}
                    className={`py-2 rounded font-bold border transition-colors ${
                      respondentType === 'company'
                        ? 'bg-vc-gold text-black border-vc-gold'
                        : 'bg-black/40 text-gray-400 border-gray-800'
                    }`}
                  >
                    Venture / Company
                  </button>
                  <button
                    type="button"
                    onClick={() => setRespondentType('participant')}
                    className={`py-2 rounded font-bold border transition-colors ${
                      respondentType === 'participant'
                        ? 'bg-vc-gold text-black border-vc-gold'
                        : 'bg-black/40 text-gray-400 border-gray-800'
                    }`}
                  >
                    Individual Citizen
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 uppercase tracking-wider text-[10px] mb-1">
                  Respondent ID or Citizen Code:
                </label>
                <input
                  type="text"
                  required
                  value={respondentId}
                  onChange={(e) => setRespondentId(e.target.value)}
                  placeholder={respondentType === 'company' ? 'e.g. comp_swiftcart, comp_ledgerly...' : 'e.g. VC-042 or vc_p_042'}
                  className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold rounded px-3 py-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-400 uppercase tracking-wider text-[10px] mb-1">
                  Claimed Damages / Disputed Amount (VB):
                </label>
                <input
                  type="number"
                  min="0"
                  value={amountVb}
                  onChange={(e) => setAmountVb(e.target.value)}
                  placeholder="e.g. 5000"
                  className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold rounded px-3 py-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-400 uppercase tracking-wider text-[10px] mb-1">
                  Factual Grounds for Dispute (Required):
                </label>
                <textarea
                  required
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="State the contract breach, unpaid invoice, failure to deliver resource units, or unauthorized leak..."
                  className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold rounded px-3 py-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-400 uppercase tracking-wider text-[10px] mb-1">
                  Supporting Evidence & Citations:
                </label>
                <textarea
                  rows={3}
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  placeholder="Cite Deal Slip ID, transaction timestamp, witness statements, or counterparty verification code..."
                  className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold rounded px-3 py-2 text-white outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-vc-gold hover:bg-yellow-400 text-black font-syne font-bold rounded flex items-center gap-1.5"
                >
                  <span>{submitting ? 'Submitting Claim...' : 'File Official Claim'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Arbitration Docket Registry ({disputes.length} Cases)</span>
              <button onClick={loadData} className="hover:text-vc-gold flex items-center gap-1">
                <RefreshCw className="w-3 h-3" />
                <span>Refresh</span>
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-gray-500 font-mono text-xs">
                Loading arbitration docket...
              </div>
            ) : disputes.length === 0 ? (
              <div className="bg-vc-card border border-vc-border rounded-xl p-8 text-center space-y-3">
                <Gavel className="w-8 h-8 text-gray-600 mx-auto" />
                <div className="text-sm font-bold text-gray-300">Clean Commercial Record</div>
                <p className="text-xs text-gray-500 max-w-sm mx-auto">
                  No active commercial disputes or contract breaches registered in the city arbitration docket.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {disputes.map((d) => (
                  <div
                    key={d.id}
                    className="bg-vc-card border border-vc-border hover:border-gray-700 rounded-xl p-4 space-y-3 transition-colors text-xs"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-syne font-bold text-white text-sm flex items-center gap-2">
                          <span>Case #{d.id.substring(0, 16)}</span>
                          <span className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-bold border ${
                            d.status === 'ruled_complainant'
                              ? 'bg-vc-emerald/10 text-vc-emerald border-vc-emerald/30'
                              : d.status === 'dismissed' || d.status === 'ruled_respondent'
                              ? 'bg-vc-rose/10 text-vc-rose border-vc-rose/30'
                              : 'bg-vc-gold/10 text-vc-gold border-vc-gold/30'
                          }`}>
                            {d.status.replace(/_/g, ' ')}
                          </span>
                        </div>
                        <div className="text-gray-400 text-[11px] mt-0.5">
                          Filed by: <strong className="text-gray-200">{d.complainant_name || d.complainant_id}</strong> vs{' '}
                          <strong className="text-gray-200">{d.respondent_name || d.respondent_id}</strong>
                        </div>
                      </div>

                      {d.amount_vb > 0 && (
                        <div className="text-right">
                          <div className="text-[10px] text-gray-400 uppercase">Disputed Value</div>
                          <div className="font-bold text-vc-gold">{d.amount_vb.toLocaleString()} VB</div>
                        </div>
                      )}
                    </div>

                    <div className="p-2.5 bg-black/40 border border-gray-800 rounded text-gray-300">
                      <div className="text-[10px] text-gray-500 uppercase font-bold mb-1">Claim Grounds:</div>
                      <div>{d.reason}</div>
                    </div>

                    {d.status.startsWith('ruled_') && (
                      <div className="p-2.5 bg-vc-gold/5 border border-vc-gold/30 rounded space-y-1">
                        <div className="text-[10px] text-vc-gold uppercase font-bold flex items-center gap-1">
                          <Gavel className="w-3 h-3" />
                          <span>GM Arbitration Ruling:</span>
                        </div>
                        {d.awarded_vb > 0 && (
                          <div className="text-vc-emerald font-bold">
                            Awarded Compensation: +{d.awarded_vb.toLocaleString()} VB
                          </div>
                        )}
                        {d.ruling_notes && (
                          <div className="text-gray-300 italic text-[11px]">&ldquo;{d.ruling_notes}&rdquo;</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
