'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClockBanner } from '@/components/ui/clock-banner';
import { Wordmark } from '@/components/ui/wordmark';
import {
  Landmark,
  TrendingUp,
  ShoppingCart,
  Users,
  Package,
  Truck,
  Building,
  Radio,
  ArrowRight,
  ShieldAlert,
  Coins,
  CheckCircle2,
  Clock,
} from 'lucide-react';

const DESK_CONFIGS: Record<string, { icon: any; color: string; desc: string }> = {
  bank: {
    icon: Landmark,
    color: 'text-vc-gold border-vc-gold/30',
    desc: 'Apex Reserve Bank: 80,000 VB Lending Pool, 10% Interest, Resource Stock (400/res). Enforces 1 open loan per company.',
  },
  investor: {
    icon: TrendingUp,
    color: 'text-vc-emerald border-vc-emerald/30',
    desc: 'Frontier Venture Fund: 140,000 VB Fund Size, Dilutive Equity Investments (Max 7 Deals), Cap Table Dilution.',
  },
  enterprise_customer: {
    icon: ShoppingCart,
    color: 'text-vc-blue border-vc-blue/30',
    desc: 'Customer Desk: 10 Anchor Contracts, 20 Open Customer Cards, Milestone Acceptance & Payment Release.',
  },
  talent_exchange: {
    icon: Users,
    color: 'text-purple-400 border-purple-500/30',
    desc: 'Talent Exchange: 10 Specialist Contracts, Free Agent Marketplace, Employment Agreements.',
  },
  supplier: {
    icon: Package,
    color: 'text-amber-400 border-amber-500/30',
    desc: 'Prime Supplier Market: 200 units/res/tick at 10% below Bank price, Direct Dispatch & Restock.',
  },
  logistics: {
    icon: Truck,
    color: 'text-cyan-400 border-cyan-500/30',
    desc: 'Swift Logistics Provider: 150 Standard units/tick, 70 Priority units/tick routing capacity.',
  },
  government: {
    icon: Building,
    color: 'text-rose-400 border-rose-500/30',
    desc: 'Department of Commerce: 30,000 VB Grant Pool, Regulatory Licences, City Compliance Tenders.',
  },
  media: {
    icon: Radio,
    color: 'text-pink-400 border-pink-500/30',
    desc: 'Daily Chronicle & Media: 2 Featured Story Slots per tick, 1,200 Audience Reach, Public Broadcasts.',
  },
};

import { useRouter } from 'next/navigation';

export default function DeskDirectoryPage() {
  const router = useRouter();
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((d) => {
        if (!d.authenticated || !d.user) {
          router.push('/login');
          return;
        }
        const user = d.user;
        setSession(user);

        // Fetch institutions directory for all roles
        fetch('/api/institutions')
          .then((r) => r.json())
          .then((data) => {
            setInstitutions(data);
            setLoading(false);
          })
          .catch(() => setLoading(false));
      })
      .catch(() => {
        router.push('/login');
      });
  }, [router]);

  const isOperator =
    session?.role === 'volunteer' ||
    session?.role === 'gm' ||
    session?.role === 'admin' ||
    session?.role === 'event_lead';

  const canSeeFounder =
    session?.role === 'company_lead' ||
    session?.role === 'gm' ||
    session?.role === 'admin';

  return (
    <div className="min-h-screen bg-[#030712] text-gray-100 flex flex-col font-mono selection:bg-vc-gold selection:text-black pb-24">
      <ClockBanner />

      <header className="bg-vc-card border-b border-vc-border px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Wordmark size="sm" showTagline={false} />
            <div className="h-6 w-px bg-gray-800" />
            <div className="flex items-center gap-2">
              <Landmark className="w-5 h-5 text-vc-gold" />
              <span className="font-syne font-bold text-white text-base">INSTITUTION DESK CONSOLES</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {canSeeFounder && (
              <Link
                href="/founder"
                className="text-xs bg-gray-900 hover:bg-gray-800 text-gray-300 px-3 py-1.5 rounded border border-gray-700"
              >
                Founder Portal
              </Link>
            )}
            <Link
              href="/portal"
              className="text-xs bg-gray-900 hover:bg-gray-800 text-gray-300 px-3 py-1.5 rounded border border-gray-700"
            >
              Citizen View
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full p-6 space-y-8">
        <div>
          <div className="inline-block px-2.5 py-0.5 rounded bg-vc-gold/10 border border-vc-gold/30 text-vc-gold text-[10px] uppercase font-bold tracking-wider mb-2">
            OFFICIAL VENTURE CITY DIRECTORY
          </div>
          <h1 className="text-2xl font-syne font-black text-white">THE 8 CITY STATIONS & INSTITUTIONS</h1>
          <p className="text-xs text-gray-400 mt-1 max-w-3xl leading-relaxed">
            Every sovereign station plays an essential economic role. Learn what each station operates, their hard limits, and how citizens and venture leads execute deals with them.
          </p>
        </div>

        {/* Stations Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <div key={n} className="h-44 bg-vc-card border border-vc-border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {institutions.map((inst) => {
              const meta = DESK_CONFIGS[inst.id] || {
                icon: Landmark,
                color: 'text-white border-gray-700',
                desc: 'Institution Desk',
              };
              const Icon = meta.icon;

              const isAssignedVolunteer = session?.role === 'volunteer' && session?.institutionId === inst.id;
              const isLeadAdmin = session?.role === 'gm' || session?.role === 'admin' || session?.role === 'event_lead';
              const canAccessConsole = isAssignedVolunteer || isLeadAdmin;

              return (
                <div
                  key={inst.id}
                  className="bg-vc-card border border-vc-border rounded-xl p-5 shadow flex flex-col justify-between hover:border-vc-gold/40 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className={`p-2 bg-gray-900 rounded-lg border ${meta.color}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span
                        className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                          inst.is_open
                            ? 'bg-vc-emerald/10 text-vc-emerald border border-vc-emerald/30'
                            : 'bg-vc-rose/10 text-vc-rose border border-vc-rose/30'
                        }`}
                      >
                        {inst.is_open ? 'OPEN' : 'CLOSED'}
                      </span>
                    </div>

                    <div>
                      <h2 className="text-base font-syne font-bold text-white">{inst.name}</h2>
                      <div className="text-[10px] text-gray-400 capitalize">Station Key: <span className="font-mono text-vc-gold">{inst.id}</span></div>
                    </div>

                    <p className="text-xs text-gray-400 leading-relaxed">{meta.desc}</p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-gray-800">
                    {canAccessConsole ? (
                      <Link
                        href={`/desk/${inst.id}`}
                        className={`w-full font-syne font-bold text-xs py-2 px-3 rounded-lg border flex items-center justify-center gap-1.5 transition-colors ${
                          isAssignedVolunteer
                            ? 'bg-vc-gold text-black border-yellow-400 hover:bg-yellow-400'
                            : 'bg-gray-900 hover:bg-gray-800 text-white border-gray-700'
                        }`}
                      >
                        <span>{isAssignedVolunteer ? 'My Assigned Station' : 'Launch Console'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    ) : session?.role === 'company_lead' ? (
                      <Link
                        href="/founder"
                        className="w-full bg-gray-900 hover:bg-gray-800 text-vc-gold font-syne font-bold text-xs py-2 px-3 rounded-lg border border-gray-700 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <span>Propose Venture Deal</span>
                        <ArrowRight className="w-3.5 h-3.5 text-vc-gold" />
                      </Link>
                    ) : (
                      <Link
                        href="/portal/inbox"
                        className="w-full bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white font-syne font-bold text-xs py-2 px-3 rounded-lg border border-gray-700 flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <span>Propose Deal in Inbox</span>
                        <ArrowRight className="w-3.5 h-3.5 text-vc-gold" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Participant Protocol Guide */}
        <div className="bg-vc-card border border-vc-border rounded-xl p-6 space-y-4">
          <h2 className="text-base font-syne font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Coins className="w-4 h-4 text-vc-gold" />
            <span>HOW TO ENGAGE WITH CITY STATIONS</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-gray-300">
            <div className="bg-gray-900/60 border border-gray-800 p-4 rounded-lg space-y-2">
              <div className="text-vc-gold font-bold uppercase text-[11px]">1. Bilateral Deals & Proposals</div>
              <p className="leading-relaxed text-gray-400">
                You can propose deals directly to any station from your Citizen Inbox (<Link href="/portal/inbox" className="text-vc-gold underline">/portal/inbox</Link>) or Founder Portal. Select the station from the recipient dropdown, set your terms (e.g. loan principal, resource quantities, consulting fee), and dispatch. The station operator reviews and ratifies the transaction at their physical desk.
              </p>
            </div>
            <div className="bg-gray-900/60 border border-gray-800 p-4 rounded-lg space-y-2">
              <div className="text-vc-emerald font-bold uppercase text-[11px]">2. Physical Station Check-Ins</div>
              <p className="leading-relaxed text-gray-400">
                Many missions and procurement runs require visiting the station desk in the live venue. Present your unique Citizen Pass code to the volunteer liaison at the desk. Once verified, the volunteer approves the claim on their console and disburses your reward instantly.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
