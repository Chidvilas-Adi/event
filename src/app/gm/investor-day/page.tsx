'use client';

import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  Award,
  Users,
  Coins,
  ShieldCheck,
  Building2,
  FileText,
  ChevronDown,
  ChevronUp,
  Download,
  RefreshCw,
  Sparkles,
  PieChart,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export default function GmInvestorDayPage() {
  const [packets, setPackets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/investor/packets');
      if (res.ok) {
        const d = await res.json();
        setPackets(d.packets || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getVerdictBadge = (verdict: string) => {
    switch (verdict) {
      case 'STRONG_INVEST':
        return <span className="bg-vc-emerald/20 text-vc-emerald border border-vc-emerald/40 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider">★ Strong Buy (Lead)</span>;
      case 'SYNDICATE_FOLLOW_ON':
        return <span className="bg-vc-blue/20 text-vc-blue border border-vc-blue/40 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider">Syndicate Follow-On</span>;
      case 'CONDITIONAL_HOLD':
        return <span className="bg-vc-gold/20 text-vc-gold border border-vc-gold/40 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider">Conditional Hold</span>;
      default:
        return <span className="bg-vc-rose/20 text-vc-rose border border-vc-rose/40 px-2.5 py-1 rounded text-xs font-bold uppercase tracking-wider">Pass</span>;
    }
  };

  const exportPacketJson = (packet: any) => {
    const blob = new Blob([JSON.stringify(packet, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `investor_dossier_${packet.companyId}.json`;
    a.click();
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-syne font-black text-white flex items-center gap-2">
            <Award className="w-6 h-6 text-vc-gold" />
            INVESTOR DAY DOSSIERS & EVALUATION
          </h1>
          <p className="text-gray-400 text-xs">
            Comprehensive venture packets, Founder Ledger evidence, and final investment syndicate recommendations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="px-3 py-1.5 bg-gray-900 border border-gray-800 hover:border-vc-gold text-gray-300 hover:text-white rounded flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Dossiers</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-500">
          Generating complete financial, commercial & behavioural investor packets...
        </div>
      ) : packets.length === 0 ? (
        <div className="p-8 text-center text-gray-400 bg-vc-card border border-vc-border rounded-xl">
          No active company dossiers generated.
        </div>
      ) : (
        <div className="space-y-4">
          {packets.map((p) => {
            const isExpanded = expandedId === p.companyId;
            return (
              <div
                key={p.companyId}
                className="bg-vc-card border border-vc-border rounded-xl shadow-xl overflow-hidden transition-all"
              >
                {/* Header Card */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : p.companyId)}
                  className="p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-gray-900/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-syne font-black text-white text-base">{p.name}</span>
                      <span className="text-[10px] bg-black/40 text-gray-400 border border-gray-800 px-2 py-0.5 rounded uppercase">
                        Tier {p.tier} · {p.status}
                      </span>
                    </div>
                    <div className="text-gray-400 text-xs">{p.tagline}</div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className="text-[10px] text-gray-400 uppercase">Final Position (SPV)</div>
                      <div className="text-sm font-bold text-vc-gold">
                        {p.financials.totalSpvVb.toLocaleString()} VB
                        <span className={`ml-1.5 text-xs ${p.financials.spvGrowthPercent >= 0 ? 'text-vc-emerald' : 'text-vc-rose'}`}>
                          ({p.financials.spvGrowthPercent >= 0 ? '+' : ''}{p.financials.spvGrowthPercent}%)
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] text-gray-400 uppercase">Composite Score</div>
                      <div className="text-sm font-bold text-white">
                        {p.score.totalScore} / 100
                      </div>
                    </div>

                    <div>
                      {getVerdictBadge(p.score.syndicateVerdict)}
                    </div>

                    <button className="text-gray-400 hover:text-white p-1">
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Dossier */}
                {isExpanded && (
                  <div className="border-t border-gray-800 p-6 space-y-6 bg-black/40">
                    {/* Investment Thesis Banner */}
                    <div className="p-3.5 bg-vc-gold/5 border border-vc-gold/30 rounded-lg flex items-start justify-between gap-4">
                      <div>
                        <div className="text-[11px] font-bold text-vc-gold uppercase tracking-wider mb-0.5 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Syndicate Investment Thesis:</span>
                        </div>
                        <div className="text-gray-200 text-xs italic">&ldquo;{p.score.thesisSummary}&rdquo;</div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          exportPacketJson(p);
                        }}
                        className="px-3 py-1 bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-300 rounded flex items-center gap-1 text-[11px] shrink-0"
                      >
                        <Download className="w-3 h-3" />
                        <span>Export JSON</span>
                      </button>
                    </div>

                    {/* Metric Cards Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 bg-vc-card border border-gray-800 rounded">
                        <div className="text-gray-400 text-[10px] uppercase font-bold">Treasury Cash</div>
                        <div className="text-base font-bold text-vc-emerald mt-1">{p.financials.cashBalanceVb.toLocaleString()} VB</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">Verified ledger balance</div>
                      </div>

                      <div className="p-3 bg-vc-card border border-gray-800 rounded">
                        <div className="text-gray-400 text-[10px] uppercase font-bold">Resource Stock</div>
                        <div className="text-base font-bold text-vc-blue mt-1">{p.financials.resourceValuationVb.toLocaleString()} VB</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">Across 6 core commodities</div>
                      </div>

                      <div className="p-3 bg-vc-card border border-gray-800 rounded">
                        <div className="text-gray-400 text-[10px] uppercase font-bold">Commercial Revenue</div>
                        <div className="text-base font-bold text-vc-gold mt-1">{p.commercialTraction.totalRevenueVb.toLocaleString()} VB</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">{p.commercialTraction.completedDealsCount} executed deals</div>
                      </div>

                      <div className="p-3 bg-vc-card border border-gray-800 rounded">
                        <div className="text-gray-400 text-[10px] uppercase font-bold">Outstanding Debt</div>
                        <div className="text-base font-bold text-vc-rose mt-1">{p.financials.outstandingLoansVb.toLocaleString()} VB</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">Apex Bank loans</div>
                      </div>
                    </div>

                    {/* Team & Cap Table */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Founding Team */}
                      <div className="p-4 bg-vc-card border border-gray-800 rounded-lg space-y-3">
                        <div className="font-syne font-bold text-white text-xs uppercase flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-vc-gold" />
                            Core Team Roster ({p.team.length} Members)
                          </span>
                        </div>
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                          {p.team.map((m: any) => (
                            <div key={m.participantId} className="flex items-center justify-between p-2 bg-black/40 rounded border border-gray-800/80 text-[11px]">
                              <div>
                                <span className="text-white font-medium">{m.name}</span>
                                <span className="text-gray-500 text-[10px] ml-2 font-mono">({m.citizenCode})</span>
                                <div className="text-gray-400 text-[10px]">{m.role}</div>
                              </div>
                              <div className="text-right font-mono text-vc-emerald">
                                {m.walletBalance.toLocaleString()} VB
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Cap Table */}
                      <div className="p-4 bg-vc-card border border-gray-800 rounded-lg space-y-3">
                        <div className="font-syne font-bold text-white text-xs uppercase flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <PieChart className="w-3.5 h-3.5 text-vc-blue" />
                            Shareholder Cap Table
                          </span>
                        </div>
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                          {p.capTable.map((c: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-black/40 rounded border border-gray-800/80 text-[11px]">
                              <div>
                                <span className="text-white font-medium">{c.shareholderName}</span>
                                <span className="text-gray-500 text-[10px] ml-2 uppercase">({c.shareholderType})</span>
                              </div>
                              <div className="text-right font-mono font-bold text-vc-gold">
                                {c.sharesOrPercent}%
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Founder Ledger Evidence */}
                    <div className="p-4 bg-vc-card border border-gray-800 rounded-lg space-y-3">
                      <div className="font-syne font-bold text-white text-xs uppercase flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-vc-emerald" />
                          Founder Ledger Qualitative Evidence ({p.founderEvidence.length} Observations)
                        </span>
                      </div>
                      {p.founderEvidence.length === 0 ? (
                        <div className="text-gray-500 text-xs italic p-2">
                          No qualitative behavioral citations logged yet by observers.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                          {p.founderEvidence.map((ev: any) => (
                            <div key={ev.id} className="p-2.5 bg-black/40 border border-gray-800 rounded text-[11px] space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-vc-gold font-bold uppercase text-[10px]">{ev.trait_category.replace(/_/g, ' ')}</span>
                                <span className={`text-[9px] uppercase px-1.5 py-0.5 rounded font-bold ${
                                  ev.rating === 'exemplary' ? 'bg-vc-emerald/20 text-vc-emerald' :
                                  ev.rating === 'prudent' ? 'bg-vc-blue/20 text-vc-blue' :
                                  ev.rating === 'concerning' ? 'bg-vc-gold/20 text-vc-gold' :
                                  'bg-vc-rose/20 text-vc-rose'
                                }`}>
                                  {ev.rating}
                                </span>
                              </div>
                              <div className="text-gray-300 italic">&ldquo;{ev.notes}&rdquo;</div>
                              {ev.incident_citation && (
                                <div className="text-gray-500 text-[10px]">Citation: {ev.incident_citation}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
