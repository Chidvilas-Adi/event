'use client';

import React, { useEffect, useState } from 'react';
import { ClockBanner } from '@/components/ui/clock-banner';
import { CitizenPass } from '@/components/ui/citizen-pass';
import { PortalNav } from '@/components/portal-nav';
import { TickerStrip } from '@/components/ui/ticker-strip';
import {
  ArrowUpRight,
  ArrowDownLeft,
  Building2,
  Wallet,
  Bell,
  Send,
  RefreshCw,
  Briefcase,
  Cpu,
  Zap,
  TrendingUp,
  Layers,
  ShieldCheck,
  ArrowRight,
  Package,
} from 'lucide-react';
import Link from 'next/link';
import { ParticipantDossierModal } from '@/components/ui/participant-dossier-modal';

export default function PortalHomePage() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showDossier, setShowDossier] = useState(false);

  const loadData = async () => {
    try {
      setRefreshing(true);
      // 1. Session & balance
      const sessRes = await fetch('/api/auth/session');
      if (sessRes.ok) {
        const sessData = await sessRes.json();
        setSession(sessData.user);
      } else {
        setSession(null);
      }

      // 2. Recent transactions
      const txRes = await fetch('/api/ledger/transfer');
      if (txRes.ok) {
        const txData = await txRes.json();
        setTransactions(Array.isArray(txData.ledgerEntries) ? txData.ledgerEntries : []);
      }

      // 3. Announcements
      const annRes = await fetch('/api/announcements');
      if (annRes.ok) {
        const annData = await annRes.json();
        setAnnouncements(Array.isArray(annData) ? annData : []);
      }
    } catch {
      // Network or parsing error: do not crash
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Polling update
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-vc-bg text-white p-4 font-mono space-y-4 max-w-lg mx-auto">
        <div className="h-10 bg-vc-card rounded animate-pulse" />
        <div className="h-56 bg-vc-card rounded-lg animate-pulse" />
        <div className="h-32 bg-vc-card rounded-lg animate-pulse" />
        <div className="h-40 bg-vc-card rounded-lg animate-pulse" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-vc-bg text-white flex flex-col items-center justify-center p-4 font-mono text-center space-y-4">
        <p className="text-gray-400">Citizen session not detected or expired.</p>
        <Link
          href="/login"
          className="bg-vc-gold text-black font-syne font-bold px-4 py-2 rounded uppercase text-sm"
        >
          Return to Gate
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-vc-bg text-gray-100 flex flex-col pb-24">
      {/* Clock Banner */}
      <ClockBanner />

      {/* Navigation Header */}
      <PortalNav citizenCode={session.citizenCode} pendingCount={session.pendingCount} />

      {/* Ticker Strip */}
      <TickerStrip />

      <main className="w-full max-w-lg mx-auto p-4 space-y-5">
        {/* Citizen Pass Card */}
        <CitizenPass
          citizenCode={session.citizenCode || 'VC-000'}
          name={session.name}
          companyName={session.company?.name || 'Independent Free Agent'}
          companyRole={session.companyRole || (session.role === 'company_lead' ? 'Founder & CEO' : 'Citizen Operator')}
        />

        {/* Classified Operational Dossier Launcher */}
        <div className="bg-gradient-to-r from-[#070e22] via-[#0b1535] to-[#070e22] border border-vc-gold/40 rounded-xl p-4 shadow-xl flex items-center justify-between font-mono">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-vc-gold/10 border border-vc-gold/40 flex items-center justify-center text-vc-gold shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-vc-gold font-bold flex items-center gap-1.5">
                <span>✦ CONFIDENTIAL VENTURE DOSSIER</span>
              </div>
              <div className="text-xs font-syne font-bold text-white mt-0.5">
                {session.company?.name || 'Independent Free Agent'} · Operational Directives
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowDossier(true)}
            className="bg-vc-gold hover:bg-yellow-400 text-black font-syne font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow active:scale-95 transition-all shrink-0"
          >
            <span>Open Dossier</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Wallet Widget */}
        <div className="bg-vc-card border border-vc-border rounded-xl p-5 shadow-lg space-y-4 font-mono">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider">
              <Wallet className="w-4 h-4 text-vc-gold" />
              <span>Personal Treasury</span>
            </div>
            <button
              onClick={loadData}
              disabled={refreshing}
              className="text-gray-400 hover:text-white transition-colors"
              title="Refresh ledger balance"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex items-baseline justify-between border-b border-gray-800 pb-4">
            <div>
              <div className="text-3xl font-syne font-black text-white tracking-wide">
                {(session?.walletBalance ?? 0).toLocaleString()}{' '}
                <span className="text-vc-gold text-xl">VB</span>
              </div>
              <div className="text-[10px] text-gray-500 uppercase mt-0.5">
                Calculated from verified ledger entries
              </div>
            </div>

            <Link
              href="/portal/transfer"
              className="bg-vc-gold hover:bg-vc-gold-hover text-black font-syne font-bold text-xs uppercase px-3.5 py-2 rounded flex items-center gap-1.5 shadow active:scale-95 transition-all"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Send VB</span>
            </Link>
          </div>

          {/* Quick pending badge if counterparty transfers are awaiting confirmation */}
          {(session?.pendingCount ?? 0) > 0 && (
            <Link
              href="/portal/inbox"
              className="bg-vc-rose/10 border border-vc-rose/30 text-vc-rose text-xs px-3 py-2 rounded flex items-center justify-between"
            >
              <span>{session.pendingCount} transfer request(s) awaiting your confirmation</span>
              <span className="font-bold underline">Review &rarr;</span>
            </Link>
          )}
        </div>

        {/* Company Snapshot */}
        {session.company && (
          <div className="bg-vc-card border border-vc-border rounded-xl p-5 shadow space-y-3 font-mono">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-gray-400 uppercase tracking-wider">
                <Building2 className="w-4 h-4 text-vc-blue" />
                <span>Affiliated Venture</span>
              </div>
              <Link
                href="/portal/company"
                className="text-vc-gold text-[11px] hover:underline"
              >
                View Roster &rarr;
              </Link>
            </div>

            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-lg font-syne font-bold text-white">
                  {session.company.name}
                </div>
                <div className="text-xs text-gray-400 italic">
                  {session.company.tagline}
                </div>
              </div>

              {session.company.balance !== undefined && (
                <div className="text-right">
                  <div className="text-xs text-gray-400 uppercase">Venture Vault</div>
                  <div className="text-base font-bold text-vc-emerald">
                    {session.company.balance.toLocaleString()} VB
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Role Operational Workstation Card */}
        {(() => {
          const cRole = session.companyRole || (session.role === 'company_lead' ? 'Founder & CEO' : 'Independent Free Agent');
          let deskTitle = 'Specialist Advisory Desk';
          let deskIcon = Briefcase;
          let deskColor = 'text-purple-400 border-purple-500/30 bg-purple-500/10';
          let deskDesc = 'Independent citizen pass. Pitch specialist advisory services, broker cross-company contracts, or incubate a spin-out.';
          let actionLabel = 'Browse Specialist Gigs';
          let actionHref = '/portal/opportunities';

          if (session.role === 'company_lead' || cRole.toLowerCase().includes('founder')) {
            deskTitle = 'Executive Command & Treasury Desk';
            deskIcon = ShieldCheck;
            deskColor = 'text-vc-gold border-vc-gold/30 bg-vc-gold/10';
            deskDesc = 'You command executive and cap table authority for this venture. Monitor the treasury vault, ratify investment term sheets, and disburse atomic payroll.';
            actionLabel = 'Enter Founder Desk & Vault';
            actionHref = '/founder';
          } else if (cRole.toLowerCase().includes('cto') || cRole.toLowerCase().includes('engineer')) {
            deskTitle = 'Chief Technology Office & Computing Desk';
            deskIcon = Cpu;
            deskColor = 'text-vc-blue border-vc-blue/30 bg-vc-blue/10';
            deskDesc = 'Lead technical infrastructure, high-performance compute clusters, and R&D milestone deliveries. Maintain high system uptime SLA.';
            actionLabel = 'Technical Missions & Compute';
            actionHref = '/portal/missions';
          } else if (cRole.toLowerCase().includes('commercial') || cRole.toLowerCase().includes('growth') || cRole.toLowerCase().includes('sales')) {
            deskTitle = 'Commercial & Revenue Contracts Desk';
            deskIcon = TrendingUp;
            deskColor = 'text-vc-emerald border-vc-emerald/30 bg-vc-emerald/10';
            deskDesc = 'Manage anchor enterprise contracts, customer acceptance criteria, and B2B growth proposals at the Customer Desk.';
            actionLabel = 'Commercial Opportunities Radar';
            actionHref = '/portal/opportunities';
          } else if (cRole.toLowerCase().includes('operations') || cRole.toLowerCase().includes('hardware')) {
            deskTitle = 'Supply Chain & Logistics Desk';
            deskIcon = Package;
            deskColor = 'text-amber-400 border-amber-500/30 bg-amber-500/10';
            deskDesc = 'Coordinate raw material intake at the Supplier Market, grid energy reserves, and priority logistics dispatch corridors.';
            actionLabel = 'Logistics & Supply Missions';
            actionHref = '/portal/missions';
          } else if (cRole.toLowerCase().includes('product') || cRole.toLowerCase().includes('data')) {
            deskTitle = 'Product Architecture & Data Desk';
            deskIcon = Layers;
            deskColor = 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10';
            deskDesc = 'Oversee sprint milestones, enterprise specifications, and proprietary market data telemetry integrations.';
            actionLabel = 'Review RFPs & Specifications';
            actionHref = '/portal/opportunities';
          }

          const DeskIcon = deskIcon;

          return (
            <div className="bg-vc-card border border-vc-border rounded-xl p-5 shadow space-y-3 font-mono">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <DeskIcon className="w-4 h-4 text-vc-gold" />
                  <span className="text-xs text-gray-400 uppercase tracking-wider">Role Operational Desk</span>
                </div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${deskColor}`}>
                  {cRole}
                </span>
              </div>

              <div>
                <h3 className="text-base font-syne font-bold text-white">{deskTitle}</h3>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">{deskDesc}</p>
              </div>

              <div className="pt-2 border-t border-gray-800 flex justify-end">
                <Link
                  href={actionHref}
                  className="bg-vc-gold hover:bg-vc-gold-hover text-black font-syne font-bold text-xs px-3.5 py-1.5 rounded flex items-center gap-1.5 transition-transform active:scale-95 shadow"
                >
                  <span>{actionLabel}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })()}

        {/* Announcements Widget */}
        <div className="bg-vc-card border border-vc-border rounded-xl p-5 shadow space-y-3 font-mono">
          <div className="flex items-center gap-2 text-xs text-gray-400 uppercase tracking-wider border-b border-gray-800 pb-2">
            <Bell className="w-4 h-4 text-vc-gold" />
            <span>City Broadcasts</span>
          </div>

          <div className="space-y-2.5">
            {announcements.length === 0 ? (
              <p className="text-xs text-gray-500">No broadcasts at this time.</p>
            ) : (
              announcements.slice(0, 3).map((ann) => (
                <div
                  key={ann.id}
                  className={`text-xs p-3 rounded border ${
                    ann.priority === 'urgent'
                      ? 'bg-vc-rose/10 border-vc-rose/30 text-white'
                      : 'bg-black/30 border-gray-800 text-gray-300'
                  }`}
                >
                  <p>{ann.message}</p>
                  <div className="text-[10px] text-gray-500 mt-1 flex items-center justify-between">
                    <span>
                      {new Date(ann.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span className="uppercase text-vc-gold">{ann.priority}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-vc-card border border-vc-border rounded-xl p-5 shadow space-y-3 font-mono">
          <div className="flex items-center justify-between border-b border-gray-800 pb-2 text-xs">
            <span className="text-gray-400 uppercase tracking-wider">Recent Activity</span>
            <span className="text-gray-500 text-[10px]">LEDGER AUDITED</span>
          </div>

          <div className="space-y-2">
            {!Array.isArray(transactions) || transactions.length === 0 ? (
              <p className="text-xs text-gray-500 py-2">No transactions recorded yet.</p>
            ) : (
              transactions.slice(0, 5).map((entry) => {
                const isCredit = entry.to_id === session?.userId || (session?.company?.id && entry.to_id === session.company.id);
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-2.5 bg-black/30 rounded border border-gray-800/80 text-xs"
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
                        <div className="text-white font-medium truncate max-w-[160px]">
                          {entry.reason || 'Transaction'}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {isCredit
                            ? `From: ${entry.from_name || entry.from_citizen_code || entry.from_type || 'System'}`
                            : `To: ${entry.to_name || entry.to_citizen_code || entry.to_type || 'System'}`}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`font-bold font-syne text-sm ${
                        isCredit ? 'text-vc-emerald' : 'text-gray-300'
                      }`}
                    >
                      {isCredit ? '+' : '-'}
                      {(entry.amount ?? 0).toLocaleString()} VB
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Classified Participant & Venture Dossier Modal */}
        <ParticipantDossierModal
          isOpen={showDossier}
          onClose={() => setShowDossier(false)}
          participant={session}
        />
      </main>
    </div>
  );
}
