'use client';

import React, { useEffect, useState } from 'react';
import { PortalNav } from '@/components/portal-nav';
import { ClockBanner } from '@/components/ui/clock-banner';
import { StatusChip } from '@/components/ui/status-chip';
import {
  Briefcase,
  Building,
  Landmark,
  TrendingUp,
  FileText,
  Send,
  CheckCircle2,
  RefreshCw,
  Coins,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';

export default function OpportunitiesPortalPage() {
  const [session, setSession] = useState<any>(null);
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Proposal Pitch Modal
  const [pitchOpp, setPitchOpp] = useState<any | null>(null);
  const [pitchText, setPitchText] = useState('');
  const [pitchSubmitting, setPitchSubmitting] = useState(false);
  const [pitchSuccess, setPitchSuccess] = useState<string | null>(null);
  const [pitchError, setPitchError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setRefreshing(true);
      const sessRes = await fetch('/api/auth/session');
      if (sessRes.ok) {
        const s = await sessRes.json();
        setSession(s.user);
      }

      const res = await fetch('/api/opportunities');
      if (res.ok) {
        const d = await res.json();
        setOpportunities(d.opportunities || []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handlePitchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pitchOpp) return;
    setPitchSubmitting(true);
    setPitchError(null);
    try {
      const res = await fetch('/api/opportunities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: pitchOpp.id,
          pitchTerms: pitchText,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to submit proposal');

      setPitchSuccess(`Proposal registered! Contract deal #${d.dealId} dispatched to counterparty desk.`);
      setTimeout(() => {
        setPitchOpp(null);
        setPitchText('');
        setPitchSuccess(null);
      }, 2500);
    } catch (err: any) {
      setPitchError(err.message);
    } finally {
      setPitchSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-vc-bg text-gray-100 flex flex-col pb-24 font-mono">
      <ClockBanner />
      <PortalNav citizenCode={session?.citizenCode} pendingCount={session?.pendingCount} />

      <main className="w-full max-w-lg mx-auto p-4 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-vc-gold" />
            <h1 className="text-xl font-syne font-bold text-white">Commercial Radar</h1>
          </div>

          <button
            onClick={loadData}
            disabled={refreshing}
            className="p-1.5 text-gray-400 hover:text-white rounded border border-gray-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Opportunity Banner */}
        <div className="bg-vc-card border border-vc-border rounded-xl p-4 shadow space-y-2">
          <div className="text-xs text-gray-400 uppercase tracking-wider">Market Demand Radar</div>
          <p className="text-xs text-gray-300 leading-relaxed">
            Enterprise procurement budgets, Government tenders, Syndicate funding tranches, and Specialist bounties currently active in the city.
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="h-32 bg-vc-card rounded-xl animate-pulse" />
            <div className="h-32 bg-vc-card rounded-xl animate-pulse" />
          </div>
        ) : opportunities.length === 0 ? (
          <div className="bg-vc-card border-2 border-dashed border-gray-800 rounded-xl p-8 text-center text-gray-500">
            No active commercial opportunities posted at this time.
          </div>
        ) : (
          <div className="space-y-3">
            {opportunities.map((opp) => (
              <div
                key={opp.id}
                className="bg-vc-card border border-vc-border rounded-xl p-5 shadow space-y-3 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded border bg-vc-blue/10 text-vc-blue border-vc-blue/30">
                      {opp.type?.replace('_', ' ').toUpperCase()}
                    </span>
                    <h3 className="text-sm font-syne font-bold text-white">{opp.title}</h3>
                    <div className="text-[10px] text-gray-400">
                      Issuer: <span className="text-gray-300">{opp.institution_name || 'City Institution'}</span>
                    </div>
                  </div>

                  <div className="text-right whitespace-nowrap">
                    <div className="text-sm font-syne font-black text-vc-gold">
                      {opp.budget_vb.toLocaleString()} <span className="text-[10px]">VB</span>
                    </div>
                    <div className="text-[9px] text-gray-500">BUDGET CAP</div>
                  </div>
                </div>

                <p className="text-xs text-gray-400 leading-relaxed">{opp.description}</p>

                {opp.terms && (
                  <div className="bg-black/40 p-2.5 rounded border border-gray-800 text-[10px] text-gray-300 space-y-1">
                    <div className="text-gray-500 uppercase tracking-wider font-bold">Key Terms:</div>
                    <div className="font-mono text-gray-400">
                      {Object.entries(opp.terms).map(([k, v]) => (
                        <div key={k}>
                          <strong className="text-gray-300 capitalize">{k.replace('_', ' ')}:</strong> {String(v)}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-gray-800 flex justify-end">
                  <button
                    onClick={() => {
                      setPitchOpp(opp);
                      setPitchSuccess(null);
                    }}
                    className="bg-vc-gold hover:bg-vc-gold-hover text-black font-syne font-bold text-xs px-3.5 py-1.5 rounded flex items-center gap-1.5 shadow active:scale-95 transition-transform"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit Proposal &rarr;</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pitch Modal */}
        {pitchOpp && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-vc-card border-2 border-vc-gold rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-start justify-between border-b border-gray-800 pb-3">
                <div>
                  <span className="text-[10px] text-vc-gold uppercase tracking-wider font-bold">
                    COMMERCIAL PROPOSAL DRAFT
                  </span>
                  <h3 className="text-base font-syne font-bold text-white mt-0.5">
                    {pitchOpp.title}
                  </h3>
                </div>
                <button
                  onClick={() => setPitchOpp(null)}
                  className="text-gray-400 hover:text-white p-1 text-xs"
                >
                  ✕
                </button>
              </div>

              {pitchError && (
                <div className="p-3 bg-vc-rose/10 border border-vc-rose/30 text-vc-rose rounded text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{pitchError}</span>
                </div>
              )}

              {pitchSuccess ? (
                <div className="p-4 bg-vc-emerald/10 border border-vc-emerald/30 text-vc-emerald rounded-lg text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 mx-auto" />
                  <div className="font-bold text-sm">{pitchSuccess}</div>
                </div>
              ) : (
                <form onSubmit={handlePitchSubmit} className="space-y-4 text-xs">
                  <div>
                    <label className="block text-gray-400 mb-1 font-bold">
                      Delivery Narrative & Specifications:
                    </label>
                    <textarea
                      rows={4}
                      value={pitchText}
                      onChange={(e) => setPitchText(e.target.value)}
                      placeholder="Detail your venture's delivery timeline, technical architecture, and counterparty acceptance conditions..."
                      className="w-full bg-gray-900 border border-gray-700 rounded p-2.5 text-white"
                      required
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                    <button
                      type="button"
                      onClick={() => setPitchOpp(null)}
                      className="px-3 py-1.5 text-gray-400 hover:text-white"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={pitchSubmitting}
                      className="bg-vc-gold hover:bg-vc-gold-hover text-black font-syne font-bold text-xs px-4 py-2 rounded uppercase"
                    >
                      {pitchSubmitting ? 'Dispatching...' : 'Dispatch Proposal Deal'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
