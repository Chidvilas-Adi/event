'use client';

import React, { useEffect, useState } from 'react';
import { PortalNav } from '@/components/portal-nav';
import { ClockBanner } from '@/components/ui/clock-banner';
import {
  Building2,
  Users,
  Shield,
  Award,
  Layers,
  Download,
  BookOpen,
  ChevronDown,
  ChevronUp,
  FileText,
  Briefcase,
  Sparkles,
} from 'lucide-react';

export default function CompanyPortalPage() {
  const [session, setSession] = useState<any>(null);
  const [companyDetails, setCompanyDetails] = useState<any>(null);
  const [allCompanies, setAllCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDossierReader, setShowDossierReader] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const sessRes = await fetch('/api/auth/session');
        const sess = await sessRes.json();
        setSession(sess.user);

        if (sess.user?.companyId) {
          const compRes = await fetch(`/api/companies?id=${sess.user.companyId}`);
          const compData = await compRes.json();
          setCompanyDetails(compData.company);
        } else {
          // Free agent: fetch all companies
          const allRes = await fetch('/api/companies');
          if (allRes.ok) {
            const allData = await allRes.json();
            setAllCompanies(Array.isArray(allData.companies) ? allData.companies : []);
          } else {
            setAllCompanies([]);
          }
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-screen bg-vc-bg text-gray-100 flex flex-col pb-24 font-mono">
      <ClockBanner />
      <PortalNav citizenCode={session?.citizenCode} pendingCount={session?.pendingCount} />

      <main className="w-full max-w-2xl mx-auto p-4 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-vc-gold" />
            <h1 className="text-xl font-syne font-bold text-white">Venture Ecosystem</h1>
          </div>
          {companyDetails && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-vc-gold/20 text-vc-gold border border-vc-gold/30">
              {companyDetails.code || 'VENTURE'}
            </span>
          )}
        </div>

        {loading ? (
          <div className="space-y-3">
            <div className="h-32 bg-vc-card rounded-xl animate-pulse" />
            <div className="h-64 bg-vc-card rounded-xl animate-pulse" />
          </div>
        ) : companyDetails ? (
          /* Affiliated Company View */
          <div className="space-y-4">
            <div className="bg-vc-card border border-vc-border rounded-xl p-5 shadow-lg space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                      OPERATIONAL VENTURE
                    </span>
                    <span className="text-[10px] bg-gray-900 text-gray-300 px-1.5 py-0.5 rounded border border-gray-800">
                      {companyDetails.cluster}
                    </span>
                  </div>
                  <h2 className="text-2xl font-syne font-black text-white">{companyDetails.name}</h2>
                  <p className="text-xs text-gray-400 italic mt-0.5">{companyDetails.tagline}</p>
                </div>
                <span className="bg-vc-emerald/10 text-vc-emerald border border-vc-emerald/30 text-[10px] uppercase px-2 py-0.5 rounded font-bold">
                  {companyDetails.status}
                </span>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed">{companyDetails.description}</p>

              {/* Strategic Profile Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="bg-black/40 p-2.5 rounded border border-gray-800/80">
                  <div className="text-[9px] text-gray-500 uppercase font-bold">Sector</div>
                  <div className="text-xs text-white font-bold truncate">{companyDetails.sector}</div>
                </div>
                <div className="bg-black/40 p-2.5 rounded border border-gray-800/80">
                  <div className="text-[9px] text-gray-500 uppercase font-bold">Fills Slots</div>
                  <div className="text-xs text-vc-emerald font-bold truncate">{companyDetails.fills_slots}</div>
                </div>
                <div className="bg-black/40 p-2.5 rounded border border-gray-800/80">
                  <div className="text-[9px] text-gray-500 uppercase font-bold">Critical Slot Need</div>
                  <div className="text-xs text-cyan-400 font-bold truncate">{companyDetails.critical_slot}</div>
                </div>
              </div>

              {/* Dossier Download and In-App View Actions */}
              <div className="pt-2 flex flex-wrap items-center gap-2.5">
                <a
                  href={companyDetails.dossier_url || companyDetails.dossier_slug_url || `/dossiers/${companyDetails.id}.docx`}
                  download
                  className="bg-vc-gold/10 hover:bg-vc-gold/20 text-vc-gold border border-vc-gold/30 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Founder Dossier (.docx)</span>
                </a>

                <button
                  onClick={() => setShowDossierReader(!showDossierReader)}
                  className="bg-gray-900 hover:bg-gray-800 text-gray-200 border border-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <BookOpen className="w-3.5 h-3.5 text-vc-gold" />
                  <span>{showDossierReader ? 'Hide Dossier Brief' : 'Read Founder Dossier'}</span>
                  {showDossierReader ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
                </button>
              </div>

              {/* Collapsible In-App Dossier Reader */}
              {showDossierReader && (
                <div className="mt-3 p-4 bg-black/60 border border-vc-border/80 rounded-xl space-y-4 text-xs animate-fade-in">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                    <span className="text-[10px] text-vc-gold uppercase font-bold tracking-wider">
                      Executive Founder Letter & Strategy
                    </span>
                    <span className="text-[10px] text-gray-500">Official Briefing</span>
                  </div>

                  <div className="text-gray-300 leading-relaxed whitespace-pre-wrap font-sans text-xs sm:text-sm">
                    {companyDetails.founder_letter ||
                      companyDetails.documents?.[0]?.body ||
                      'Founder letter not attached.'}
                  </div>

                  {/* Strategic Picks */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-gray-800 text-xs">
                    <div className="p-2.5 bg-gray-900/60 rounded border border-gray-800">
                      <div className="text-[10px] text-vc-gold uppercase font-bold">Notable Asset</div>
                      <div className="text-white mt-0.5">{companyDetails.notable_asset}</div>
                    </div>
                    <div className="p-2.5 bg-gray-900/60 rounded border border-gray-800">
                      <div className="text-[10px] text-amber-400 uppercase font-bold">Gate / Licence</div>
                      <div className="text-white mt-0.5">{companyDetails.gate}</div>
                    </div>
                    <div className="p-2.5 bg-gray-900/60 rounded border border-gray-800">
                      <div className="text-[10px] text-vc-rose uppercase font-bold">Liability</div>
                      <div className="text-white mt-0.5">{companyDetails.liability}</div>
                    </div>
                    <div className="p-2.5 bg-gray-900/60 rounded border border-gray-800">
                      <div className="text-[10px] text-vc-emerald uppercase font-bold">Workforce Mix</div>
                      <div className="text-white mt-0.5">{companyDetails.workforce_mix}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Company Treasury & Resources */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-800">
                <div className="bg-black/30 p-3 rounded border border-gray-800">
                  <div className="text-[10px] text-gray-500 uppercase">Treasury Vault</div>
                  <div className="text-lg font-syne font-bold text-vc-gold">
                    {session?.role === 'company_lead' || session?.role === 'gm' || session?.role === 'admin'
                      ? companyDetails.vault_balance !== undefined
                        ? `${companyDetails.vault_balance.toLocaleString()} VB`
                        : 'RESTRICTED'
                      : 'RESTRICTED (FOUNDER ONLY)'}
                  </div>
                </div>

                <div className="bg-black/30 p-3 rounded border border-gray-800">
                  <div className="text-[10px] text-gray-500 uppercase">Initial Capital Band</div>
                  <div className="text-xs text-white font-bold mt-1 font-syne">
                    {companyDetails.initial_cash ? `${parseInt(companyDetails.initial_cash).toLocaleString()} VB` : '30,000 VB'}
                  </div>
                </div>
              </div>

              {/* Resource Reserves */}
              {companyDetails.resources && (
                <div className="pt-2">
                  <div className="text-[10px] text-gray-500 uppercase mb-2 font-bold">Resource Inventory (100 Base)</div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {Object.entries(companyDetails.resources).map(([resKey, qty]: any) => (
                      <div key={resKey} className="bg-black/40 p-2 rounded border border-gray-800/80">
                        <div className="text-[10px] text-gray-400 capitalize">{resKey}</div>
                        <div className="font-bold text-white">{qty}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Members Roster */}
            <div className="bg-vc-card border border-vc-border rounded-xl p-5 shadow space-y-3">
              <div className="flex items-center justify-between border-b border-gray-800 pb-2 text-xs">
                <div className="flex items-center gap-2 text-gray-300 uppercase tracking-wider font-bold">
                  <Users className="w-4 h-4 text-vc-gold" />
                  <span>Team Roster ({companyDetails.members?.length || 0})</span>
                </div>
                <span className="text-[10px] text-gray-500">CITIZENS REGISTERED</span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {companyDetails.members?.map((m: any) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-2.5 bg-black/30 rounded border border-gray-800/80 text-xs"
                  >
                    <div>
                      <div className="text-white font-medium">
                        {m.name}{' '}
                        {m.id === session?.userId && (
                          <span className="text-vc-gold text-[10px] font-bold">(You)</span>
                        )}
                      </div>
                      <div className="text-[10px] text-gray-500">{m.role}</div>
                    </div>
                    <span className="text-[11px] text-vc-gold font-mono font-bold bg-vc-gold/10 px-2 py-0.5 rounded border border-vc-gold/20">
                      {m.citizen_code}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Free Agent View */
          <div className="space-y-4">
            <div className="bg-vc-card border border-vc-border rounded-xl p-5 text-center space-y-2">
              <Shield className="w-8 h-8 text-vc-gold mx-auto" />
              <h2 className="text-lg font-syne font-bold text-white">Independent Free Agent</h2>
              <p className="text-xs text-gray-400">
                You currently hold an open citizen pass. You can negotiate contracts with any of the 12 city ventures, offer freelance services, or incorporate a spin-out.
              </p>
            </div>

            <div className="space-y-3">
              <div className="text-xs text-gray-400 uppercase tracking-wider font-bold">
                12 Canonical City Ventures
              </div>
              {(allCompanies || []).map((c) => (
                <div key={c.id} className="bg-vc-card border border-vc-border rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-vc-gold/10 text-vc-gold border border-vc-gold/30 font-bold">
                          {c.code || 'VENTURE'}
                        </span>
                        <h3 className="font-syne font-bold text-white">{c.name}</h3>
                      </div>
                      <p className="text-xs text-gray-400 italic mt-0.5">{c.tagline}</p>
                    </div>
                    <span className="text-[10px] bg-gray-900 text-gray-300 px-2 py-0.5 rounded border border-gray-800">
                      {c.cluster || `Tier ${c.tier}`}
                    </span>
                  </div>

                  <div className="text-[11px] text-gray-400 grid grid-cols-2 gap-2 bg-black/30 p-2 rounded border border-gray-800">
                    <div>
                      <span className="text-[9px] text-gray-500 uppercase block font-bold">Fills Slots</span>
                      <span className="text-vc-gold font-bold">{c.fills_slots || 'Specialist'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-500 uppercase block font-bold">Critical Need</span>
                      <span className="text-cyan-400 font-bold">{c.critical_slot || 'None'}</span>
                    </div>
                  </div>

                  <div className="text-[11px] text-gray-500 flex items-center justify-between pt-2 border-t border-gray-800/60">
                    <span>Team: {c.member_count} citizens</span>
                    <a
                      href={c.dossier_url || c.dossier_slug_url || `/dossiers/${c.id}.docx`}
                      download
                      className="bg-vc-gold/10 hover:bg-vc-gold/20 text-vc-gold border border-vc-gold/30 px-2.5 py-1 rounded text-[11px] font-bold flex items-center gap-1 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      <span>Dossier (.docx)</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
