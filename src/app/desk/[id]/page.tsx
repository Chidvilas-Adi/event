'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Coins,
  ShieldCheck,
  RefreshCw,
  PlusCircle,
  Layers,
  FileCheck,
  Plus,
  Send,
  Key,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';
import { ModalDialog } from '@/components/ui/modal-dialog';
import { STATION_FLAGS } from '@/lib/data/station-flags';

const DESK_META: Record<string, { name: string; title: string; icon: any; color: string }> = {
  bank: { name: 'Apex Reserve Bank', title: 'LENDING & RESOURCE VAULT', icon: Landmark, color: 'text-vc-gold' },
  investor: { name: 'Frontier Venture Fund', title: 'VENTURE EQUITY & CAP TABLE DESK', icon: TrendingUp, color: 'text-vc-emerald' },
  enterprise_customer: { name: 'Customer Desk', title: 'ANCHOR CONTRACTS & ENTERPRISE PROCUREMENT', icon: ShoppingCart, color: 'text-vc-blue' },
  talent_exchange: { name: 'Talent Exchange', title: 'SPECIALIST CONTRACTS & CAREER DESK', icon: Users, color: 'text-purple-400' },
  supplier: { name: 'Prime Supplier Market', title: 'WHOLESALE INVENTORY & INPUTS', icon: Package, color: 'text-amber-400' },
  logistics: { name: 'Swift Logistics Provider', title: 'FLEET CAPACITY & DISPATCH DESK', icon: Truck, color: 'text-cyan-400' },
  government: { name: 'City Department of Commerce', title: 'CIVIC GRANTS & REGULATORY TENDERS', icon: Building, color: 'text-rose-400' },
  media: { name: 'The Daily Chronicle & Media', title: 'FEATURED STORIES & BROADCAST SLOTS', icon: Radio, color: 'text-pink-400' },
};

export default function InstitutionDeskConsolePage() {
  const params = useParams();
  const router = useRouter();
  const instId = (params?.id as string) || 'bank';

  const [institution, setInstitution] = useState<any>(null);
  const [deals, setDeals] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [stationClaims, setStationClaims] = useState<any[]>([]);
  const [approvingClaimId, setApprovingClaimId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [volunteerMissions, setVolunteerMissions] = useState<any[]>([]);
  const [missionVerifyingId, setMissionVerifyingId] = useState<string | null>(null);
  const [copiedFlag, setCopiedFlag] = useState(false);

  // Counter Modal State
  const [counterDealId, setCounterDealId] = useState<string | null>(null);
  const [counterTerms, setCounterTerms] = useState<any>({});
  const [counterSubmitting, setCounterSubmitting] = useState(false);
  const [session, setSession] = useState<any>(null);

  // Entities for Propose Deal Dropdowns
  const [companies, setCompanies] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [allInstitutions, setAllInstitutions] = useState<any[]>([]);

  // Propose Deal / Term Sheet Modal State
  const [showProposeModal, setShowProposeModal] = useState(false);
  const [dealTemplate, setDealTemplate] = useState<string>(
    instId === 'bank' ? 'loan' : instId === 'investor' ? 'investment' : 'sale'
  );
  const [dealRecipientType, setDealRecipientType] = useState<'company' | 'participant' | 'institution'>('company');
  const [dealRecipientId, setDealRecipientId] = useState<string>('');
  const [dealTerms, setDealTerms] = useState<any>({
    ...(instId === 'bank'
      ? { principal_vb: 10000, interest_rate_percent: 10, repayment_ticks: 3 }
      : instId === 'investor'
      ? { amount_vb: 20000, equity_percent: 10 }
      : { item: 'Operational Deliverable', quantity: 1, price_vb: 1000 }),
  });
  const [dealSubmitting, setDealSubmitting] = useState(false);

  // Civic Grant Form State (for Government desk)
  const [grantRecipientType, setGrantRecipientType] = useState<'company' | 'participant'>('company');
  const [grantRecipientId, setGrantRecipientId] = useState<string>('');
  const [grantAmount, setGrantAmount] = useState<number>(5000);
  const [grantPurpose, setGrantPurpose] = useState<string>('Non-dilutive innovation and commercialization grant');
  const [grantSubmitting, setGrantSubmitting] = useState(false);

  // Custom Modal Dialog State
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    message?: string;
    type?: 'confirm' | 'alert';
    variant?: 'danger' | 'gold' | 'emerald';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'confirm',
    variant: 'gold',
    onConfirm: () => {},
  });

  const meta = DESK_META[instId] || {
    name: 'Institution Workstation',
    title: 'OPERATIONAL DESK',
    icon: Landmark,
    color: 'text-white',
  };
  const Icon = meta.icon;

  const handleTemplateChange = (tpl: string) => {
    setDealTemplate(tpl);
    if (tpl === 'loan') {
      setDealTerms({ principal_vb: 10000, interest_rate_percent: 10, repayment_ticks: 3 });
      setDealRecipientType('company');
    } else if (tpl === 'investment') {
      setDealTerms({ amount_vb: 20000, equity_percent: 10 });
      setDealRecipientType('company');
    } else if (tpl === 'sale') {
      setDealTerms({ item: 'Commercial Contract Deliverable', quantity: 1, price_vb: 2000 });
    } else if (tpl === 'resource_trade') {
      setDealTerms({ resource_id: 'compute', quantity: 50, payment_vb: 2500 });
    } else if (tpl === 'freelance') {
      setDealTerms({ deliverable: 'Station Specialist Assignment', fee_vb: 500 });
      setDealRecipientType('participant');
    } else if (tpl === 'employment') {
      setDealTerms({ role: 'Station Staff Operator', salary_per_tick_vb: 150 });
      setDealRecipientType('participant');
    } else if (tpl === 'information_trade') {
      setDealTerms({ description: 'Station Market Intelligence', price_vb: 400, permitted_use: 'internal_only' });
    }
  };

  const handleRecipientTypeChange = (type: 'company' | 'participant' | 'institution') => {
    setDealRecipientType(type);
    if (type === 'company' && companies.length > 0) {
      setDealRecipientId(companies[0].id);
    } else if (type === 'participant' && participants.length > 0) {
      setDealRecipientId(participants[0].id);
    } else if (type === 'institution') {
      const other = allInstitutions.find((i) => i.id !== instId);
      setDealRecipientId(other?.id || 'bank');
    } else {
      setDealRecipientId('');
    }
  };

  const loadData = async () => {
    try {
      setRefreshing(true);
      // 1. Session verification & strict authority check
      const sessRes = await fetch('/api/auth/session');
      if (!sessRes.ok) {
        router.push('/login');
        return;
      }
      const sData = await sessRes.json();
      if (!sData.authenticated || !sData.user) {
        router.push('/login');
        return;
      }
      const user = sData.user;
      setSession(user);

      // Strict role-based guard: Desks are operator workstations!
      // Citizens must use /portal
      if (user.role === 'participant') {
        router.push('/portal');
        return;
      }
      // Founders must use /founder
      if (user.role === 'company_lead') {
        router.push('/founder');
        return;
      }
      // Observers must use /gm/monitor
      if (user.role === 'observer') {
        router.push('/gm/monitor');
        return;
      }
      // Station volunteers must stay at their assigned desk
      if (user.role === 'volunteer' && user.institutionId && user.institutionId !== instId) {
        router.push(`/desk/${user.institutionId}`);
        return;
      }

      // 2. Fetch institution details
      const instRes = await fetch('/api/institutions');
      if (instRes.ok) {
        const instList = await instRes.json();
        setAllInstitutions(instList);
        const found = instList.find((i: any) => i.id === instId);
        setInstitution(found);
      }

      // 3. Fetch deals for this institution workstation
      const dealsRes = await fetch(`/api/deals?institutionId=${instId}`);
      if (dealsRes.ok) {
        const dData = await dealsRes.json();
        setDeals(dData.deals || []);
      }

      // 4. If Bank, fetch active loans
      if (instId === 'bank') {
        const loansRes = await fetch('/api/loans');
        if (loansRes.ok) {
          const lData = await loansRes.json();
          setLoans(lData.loans || []);
        }
      }

      // 5. Fetch pending check-in missions for this station
      const claimsRes = await fetch(`/api/missions/station?stationId=${instId}`);
      if (claimsRes.ok) {
        const cData = await claimsRes.json();
        setStationClaims(cData.pendingClaims || []);
      }

      // 6. Fetch companies and participants for deal proposals
      const [compRes, partRes] = await Promise.all([
        fetch('/api/companies'),
        fetch('/api/participants'),
      ]);
      if (compRes.ok) {
        const cData = await compRes.json();
        const compList = cData.companies || [];
        setCompanies(compList);
        setDealRecipientId((prev) => prev || (compList[0]?.id ?? ''));
      }
      if (partRes.ok) {
        const pData = await partRes.json();
        setParticipants(pData.participants || []);
      }

      // 7. Fetch volunteer missions
      const mRes = await fetch('/api/missions');
      if (mRes.ok) {
        const mData = await mRes.json();
        setVolunteerMissions(mData.missions || []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleVerifyVolunteerMission = async (mission: any) => {
    if (!mission?.instance?.id) return;
    setMissionVerifyingId(mission.id);
    try {
      const stationFlag = STATION_FLAGS[instId]?.flag || '';
      const res = await fetch(`/api/missions/${mission.instance.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: mission.verification_secret || stationFlag,
          token: mission.verification_secret || stationFlag,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      setDialogConfig({
        isOpen: true,
        title: 'Mission Completed!',
        message: data.message || `+${mission.reward_vb} VB credited to your ledger!`,
        type: 'alert',
        variant: 'emerald',
        onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
      });
      loadData();
    } catch (err: any) {
      setDialogConfig({
        isOpen: true,
        title: 'Verification Incomplete',
        message: err.message,
        type: 'alert',
        variant: 'danger',
        onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
      });
    } finally {
      setMissionVerifyingId(null);
    }
  };

  const handleApproveClaim = (instanceId: string) => {
    setDialogConfig({
      isOpen: true,
      title: 'Approve Station Check-in',
      message: 'Confirm approval of this citizen station check-in and disburse authorized rewards?',
      type: 'confirm',
      variant: 'emerald',
      onConfirm: async () => {
        setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        setApprovingClaimId(instanceId);
        try {
          const res = await fetch('/api/missions/station', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instanceId, stationId: instId }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to approve check-in');
          setDialogConfig({
            isOpen: true,
            title: 'Check-In Approved',
            message: data.message || 'Check-in approved successfully!',
            type: 'alert',
            variant: 'emerald',
            onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
          });
          loadData();
        } catch (err: any) {
          setDialogConfig({
            isOpen: true,
            title: 'Check-In Error',
            message: err.message,
            type: 'alert',
            variant: 'danger',
            onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
          });
        } finally {
          setApprovingClaimId(null);
        }
      },
    });
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [instId]);

  const handleDealAction = (dealId: string, action: 'accept' | 'reject') => {
    setDialogConfig({
      isOpen: true,
      title: `Confirm Deal ${action.toUpperCase()}`,
      message: `Are you sure you want to ${action.toUpperCase()} this transaction proposal?`,
      type: 'confirm',
      variant: action === 'accept' ? 'emerald' : 'danger',
      onConfirm: async () => {
        setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        setActionLoading(dealId);
        try {
          const res = await fetch(`/api/deals/${dealId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Action failed');
          setDialogConfig({
            isOpen: true,
            title: `Deal ${action === 'accept' ? 'Ratified' : 'Rejected'}`,
            message: `Deal proposal successfully ${action}ed!`,
            type: 'alert',
            variant: action === 'accept' ? 'emerald' : 'gold',
            onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
          });
          loadData();
        } catch (err: any) {
          setDialogConfig({
            isOpen: true,
            title: 'Deal Action Error',
            message: err.message,
            type: 'alert',
            variant: 'danger',
            onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
          });
        } finally {
          setActionLoading(null);
        }
      },
    });
  };

  const handleCounterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counterDealId) return;
    setCounterSubmitting(true);
    try {
      const res = await fetch(`/api/deals/${counterDealId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'counter',
          updatedTerms: counterTerms,
          reason: `Desk ${instId} counter-proposal terms`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Counter failed');

      setCounterDealId(null);
      setDialogConfig({
        isOpen: true,
        title: 'Counter-Offer Dispatched',
        message: `Counter-offer dispatched as Version ${data.version}!`,
        type: 'alert',
        variant: 'emerald',
        onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
      });
      loadData();
    } catch (err: any) {
      setDialogConfig({
        isOpen: true,
        title: 'Counter Error',
        message: err.message,
        type: 'alert',
        variant: 'danger',
        onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
      });
    } finally {
      setCounterSubmitting(false);
    }
  };

  const handleProposeDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dealRecipientId) {
      setDialogConfig({
        isOpen: true,
        title: 'Missing Recipient',
        message: 'Please select a recipient from the dropdown.',
        type: 'alert',
        variant: 'danger',
        onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
      });
      return;
    }
    setDealSubmitting(true);
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asInstitution: true,
          institutionId: instId,
          templateType: dealTemplate,
          recipientType: dealRecipientType,
          recipientId: dealRecipientId,
          terms: dealTerms,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch deal proposal');

      setShowProposeModal(false);
      setDialogConfig({
        isOpen: true,
        title: 'Term Sheet / Deal Dispatched',
        message: `Proposal successfully dispatched to ${dealRecipientType} [${dealRecipientId}]!`,
        type: 'alert',
        variant: 'emerald',
        onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
      });
      loadData();
    } catch (err: any) {
      setDialogConfig({
        isOpen: true,
        title: 'Dispatch Error',
        message: err.message,
        type: 'alert',
        variant: 'danger',
        onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
      });
    } finally {
      setDealSubmitting(false);
    }
  };

  const handleDisburseGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = grantRecipientId || (grantRecipientType === 'company' ? companies[0]?.id : participants[0]?.id);
    if (!targetId) {
      setDialogConfig({
        isOpen: true,
        title: 'Missing Recipient',
        message: 'Please select a recipient company or citizen for the grant.',
        type: 'alert',
        variant: 'danger',
        onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
      });
      return;
    }
    setGrantSubmitting(true);
    try {
      const res = await fetch('/api/desk/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: grantRecipientType,
          targetId,
          amount: Number(grantAmount),
          purpose: grantPurpose,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to disburse civic grant');
      setDialogConfig({
        isOpen: true,
        title: 'Civic Grant Disbursed',
        message: `Successfully disbursed ${Number(grantAmount).toLocaleString()} VB! Remaining civic grant pool: ${Number(data.remainingGrantPool).toLocaleString()} VB.`,
        type: 'alert',
        variant: 'emerald',
        onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
      });
      loadData();
    } catch (err: any) {
      setDialogConfig({
        isOpen: true,
        title: 'Grant Disbursal Error',
        message: err.message,
        type: 'alert',
        variant: 'danger',
        onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
      });
    } finally {
      setGrantSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030712] text-white flex items-center justify-center font-mono">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-vc-gold" />
      </div>
    );
  }

  const config = institution?.config || {};

  return (
    <div className="min-h-screen bg-[#030712] text-gray-100 flex flex-col font-mono selection:bg-vc-gold selection:text-black pb-24">
      <ClockBanner />

      {/* Top Bar */}
      <header className="bg-vc-card border-b border-vc-border px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/desk"
              className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Wordmark size="sm" showTagline={false} />
            <div className="h-6 w-px bg-gray-800" />
            <div className="flex items-center gap-2">
              <Icon className={`w-5 h-5 ${meta.color}`} />
              <span className="font-syne font-bold text-white text-base">{institution?.name || meta.name}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              className="p-1.5 text-gray-400 hover:text-white rounded border border-gray-800"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {(session?.role === 'company_lead' || session?.role === 'gm' || session?.role === 'admin') && (
              <Link
                href="/founder"
                className="text-xs bg-gray-900 hover:bg-gray-800 text-gray-300 px-3 py-1.5 rounded border border-gray-700"
              >
                Founder View
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto w-full p-6 space-y-6">
        {/* Desk Header Card with Status & Live Limits */}
        <div className="bg-vc-card border border-vc-border rounded-xl p-6 shadow-xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-syne font-black text-white">{meta.title}</h1>
                <span
                  className={`text-xs uppercase font-bold px-2 py-0.5 rounded ${
                    institution?.is_open
                      ? 'bg-vc-emerald/10 text-vc-emerald border border-vc-emerald/30'
                      : 'bg-vc-rose/10 text-vc-rose border border-vc-rose/30'
                  }`}
                >
                  {institution?.is_open ? 'STATION ACTIVE / OPEN' : 'STATION CLOSED'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Enforcing statutory limits defined in the Starting World Master Design.
              </p>
            </div>
          </div>

          {/* Hard Limits Meters tailored to this specific institution */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {instId === 'bank' && (
              <>
                <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-lg space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Lending Pool Remaining</div>
                  <div className="text-2xl font-syne font-black text-vc-gold">
                    {(config.lending_pool_remaining ?? 80000).toLocaleString()} <span className="text-sm">VB</span>
                  </div>
                  <div className="text-[10px] text-gray-500">Cap: 80,000 VB (8,000 x 10)</div>
                </div>

                <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-lg space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Resource Stock & Restock</div>
                  <div className="text-2xl font-syne font-black text-white">
                    {config.resource_stock_per_type || 400} <span className="text-sm">units/res</span>
                  </div>
                  <div className="text-[10px] text-vc-emerald font-bold">+100 units/tick restock</div>
                </div>

                <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-lg space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Credit Policy & Limits</div>
                  <div className="text-2xl font-syne font-black text-vc-blue">
                    {config.base_interest_rate_percent || 10}% <span className="text-sm">APR</span>
                  </div>
                  <div className="text-[10px] text-gray-500">Max 1 Open Loan per company</div>
                </div>
              </>
            )}

            {instId === 'investor' && (
              <>
                <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-lg space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Fund Size Remaining</div>
                  <div className="text-2xl font-syne font-black text-vc-emerald">
                    {(config.fund_size_remaining ?? 140000).toLocaleString()} <span className="text-sm">VB</span>
                  </div>
                  <div className="text-[10px] text-gray-500">Fund Pool: 140,000 VB (14,000 x 10)</div>
                </div>

                <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-lg space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Investments Limit</div>
                  <div className="text-2xl font-syne font-black text-white">
                    {config.investments_completed || 0} / {config.max_investments || 7} <span className="text-sm">Deals</span>
                  </div>
                  <div className="text-[10px] text-gray-500">Strict Cap: 7 deals (10 x 0.7)</div>
                </div>

                <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-lg space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Equity Dilution Protocol</div>
                  <div className="text-2xl font-syne font-black text-vc-gold">
                    Cap Table <span className="text-sm">Direct</span>
                  </div>
                  <div className="text-[10px] text-gray-500">Updates cap table equity atomically</div>
                </div>
              </>
            )}

            {instId === 'enterprise_customer' && (
              <>
                <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-lg space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Anchor Contracts</div>
                  <div className="text-2xl font-syne font-black text-vc-blue">
                    10 <span className="text-sm">Contracts</span>
                  </div>
                  <div className="text-[10px] text-gray-500">1 per active company</div>
                </div>

                <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-lg space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Open Customer Cards</div>
                  <div className="text-2xl font-syne font-black text-white">
                    20 <span className="text-sm">Cards</span>
                  </div>
                  <div className="text-[10px] text-gray-500">2 x N demand contracts</div>
                </div>

                <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-lg space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Delivery Validation</div>
                  <div className="text-2xl font-syne font-black text-vc-emerald">
                    Acceptance <span className="text-sm">Required</span>
                  </div>
                  <div className="text-[10px] text-gray-500">Funds released on milestone delivery</div>
                </div>
              </>
            )}

            {instId === 'supplier' && (
              <>
                <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-lg space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Discounted Stock / Tick</div>
                  <div className="text-2xl font-syne font-black text-amber-400">
                    200 <span className="text-sm">units / res</span>
                  </div>
                  <div className="text-[10px] text-gray-500">20 x 10 units replenished each tick</div>
                </div>

                <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-lg space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Pricing Discount</div>
                  <div className="text-2xl font-syne font-black text-vc-emerald">
                    -10% <span className="text-sm">Discount</span>
                  </div>
                  <div className="text-[10px] text-gray-500">10% below Bank base price</div>
                </div>

                <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-lg space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Min Order Quantity</div>
                  <div className="text-2xl font-syne font-black text-white">
                    10 <span className="text-sm">units</span>
                  </div>
                  <div className="text-[10px] text-gray-500">Bulk procurement threshold</div>
                </div>
              </>
            )}

            {instId === 'logistics' && (
              <>
                <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-lg space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Standard Capacity / Tick</div>
                  <div className="text-2xl font-syne font-black text-cyan-400">
                    150 <span className="text-sm">units</span>
                  </div>
                  <div className="text-[10px] text-gray-500">15 x 10 slots / tick @ 30 VB</div>
                </div>

                <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-lg space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Priority Capacity / Tick</div>
                  <div className="text-2xl font-syne font-black text-vc-gold">
                    70 <span className="text-sm">units</span>
                  </div>
                  <div className="text-[10px] text-gray-500">7 x 10 slots / tick @ 60 VB</div>
                </div>

                <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-lg space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Routing Status</div>
                  <div className="text-2xl font-syne font-black text-vc-emerald">
                    ACTIVE <span className="text-sm">Fleet</span>
                  </div>
                  <div className="text-[10px] text-gray-500">Zero physical backlog</div>
                </div>
              </>
            )}

            {instId === 'government' && (
              <>
                <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-lg space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Grant Pool Remaining</div>
                  <div className="text-2xl font-syne font-black text-rose-400">
                    {(config.grant_pool_remaining ?? 30000).toLocaleString()} <span className="text-sm">VB</span>
                  </div>
                  <div className="text-[10px] text-gray-500">Total: 30,000 VB (3,000 x 10)</div>
                </div>

                <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-lg space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Max Grant Per Company</div>
                  <div className="text-2xl font-syne font-black text-white">
                    8,000 <span className="text-sm">VB</span>
                  </div>
                  <div className="text-[10px] text-gray-500">Non-dilutive civic endowment</div>
                </div>

                <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-lg space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Compliance & Tenders</div>
                  <div className="text-2xl font-syne font-black text-vc-blue">
                    REGULATED
                  </div>
                  <div className="text-[10px] text-gray-500">Licence approvals required</div>
                </div>
              </>
            )}

            {instId === 'media' && (
              <>
                <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-lg space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Featured Story Slots / Tick</div>
                  <div className="text-2xl font-syne font-black text-pink-400">
                    2 <span className="text-sm">Slots</span>
                  </div>
                  <div className="text-[10px] text-gray-500">Active since N &ge; 10</div>
                </div>

                <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-lg space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Audience Reach</div>
                  <div className="text-2xl font-syne font-black text-white">
                    1,200 <span className="text-sm">Readers</span>
                  </div>
                  <div className="text-[10px] text-gray-500">Global city distribution</div>
                </div>

                <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-lg space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Slot Price</div>
                  <div className="text-2xl font-syne font-black text-vc-gold">
                    1,000 <span className="text-sm">VB</span>
                  </div>
                  <div className="text-[10px] text-gray-500">Per front-page feature</div>
                </div>
              </>
            )}

            {instId === 'talent_exchange' && (
              <>
                <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-lg space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Specialist Contracts</div>
                  <div className="text-2xl font-syne font-black text-purple-400">
                    10 <span className="text-sm">Contracts</span>
                  </div>
                  <div className="text-[10px] text-gray-500">Active specialist talent pool</div>
                </div>

                <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-lg space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Full-Time Exclusivity</div>
                  <div className="text-2xl font-syne font-black text-white">
                    1 Job <span className="text-sm">/ Citizen</span>
                  </div>
                  <div className="text-[10px] text-gray-500">Freelance contracts permitted</div>
                </div>

                <div className="bg-gray-900/80 border border-gray-800 p-4 rounded-lg space-y-1">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">Standard Salary Base</div>
                  <div className="text-2xl font-syne font-black text-vc-gold">
                    100 <span className="text-sm">VB / tick</span>
                  </div>
                  <div className="text-[10px] text-gray-500">Level 0 default rate</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Station Secret Verification Flag Banner */}
        <div className="bg-vc-card border border-vc-gold/40 rounded-xl p-4 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-vc-gold/10 border border-vc-gold/30 text-vc-gold">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                Official Physical Station Flag (Verification Token)
              </span>
              <div className="text-sm font-mono font-bold text-vc-gold flex items-center gap-2">
                <span>{STATION_FLAGS[instId]?.flag || `FLAG-${instId.toUpperCase()}-2026`}</span>
                <span className="text-[10px] text-gray-400 bg-gray-900 px-2 py-0.5 rounded border border-gray-800">
                  Dispense to visiting citizens upon in-person clearance or paid intel
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              const flag = STATION_FLAGS[instId]?.flag || `FLAG-${instId.toUpperCase()}-2026`;
              navigator.clipboard?.writeText(flag);
              setCopiedFlag(true);
              setTimeout(() => setCopiedFlag(false), 2000);
            }}
            className="bg-gray-900 hover:bg-gray-800 border border-gray-700 text-xs px-3 py-1.5 rounded flex items-center gap-1.5 font-bold transition-all text-gray-200"
          >
            {copiedFlag ? <Check className="w-3.5 h-3.5 text-vc-emerald" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedFlag ? 'Copied Flag!' : 'Copy Flag Code'}</span>
          </button>
        </div>

        {/* Volunteer Station Missions / Operator Directives */}
        {volunteerMissions.length > 0 && (
          <div className="bg-vc-card border border-cyan-500/30 rounded-xl p-5 shadow space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-syne font-bold text-white uppercase tracking-wider">
                    Volunteer Station Directives & Quests
                  </h3>
                  <p className="text-[11px] text-gray-400">
                    Role-tailored station duties, operational audits, and treasure hunt coordination.
                  </p>
                </div>
              </div>
              <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[10px] font-bold px-2 py-0.5 rounded tracking-widest uppercase">
                {volunteerMissions.filter((m) => m.instance?.status === 'completed').length} / {volunteerMissions.length} Complete
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {volunteerMissions.map((m) => {
                const isDone = m.instance?.status === 'completed';
                return (
                  <div
                    key={m.id}
                    className={`p-3 rounded-lg border flex flex-col justify-between space-y-2.5 ${
                      isDone
                        ? 'bg-vc-emerald/5 border-vc-emerald/30'
                        : 'bg-gray-900/70 border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-vc-gold font-bold uppercase">Wave 0{m.wave}</span>
                        <span className="text-vc-emerald font-bold font-syne">+{m.reward_vb} VB</span>
                      </div>
                      <h4 className="text-xs font-bold text-white line-clamp-1">{m.title}</h4>
                      <p className="text-[11px] text-gray-400 leading-snug">{m.objective}</p>
                    </div>

                    <div className="pt-2 border-t border-gray-800 flex items-center justify-between">
                      <span className="text-[9px] uppercase text-gray-500 font-mono">
                        {m.verification_method.replace('_', ' ')}
                      </span>
                      {isDone ? (
                        <span className="text-[10px] text-vc-emerald font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Completed
                        </span>
                      ) : (
                        <button
                          onClick={() => handleVerifyVolunteerMission(m)}
                          disabled={missionVerifyingId === m.id}
                          className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-black font-syne font-bold text-[10px] px-2.5 py-1 rounded transition-all"
                        >
                          {missionVerifyingId === m.id ? 'Verifying...' : 'Verify & Claim'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Bank Active Loans Section (if Bank) */}
        {instId === 'bank' && (
          <div className="bg-vc-card border border-vc-border rounded-xl p-6 shadow space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-vc-gold" />
                <h2 className="text-base font-syne font-bold text-white">ACTIVE BANK LOANS PORTFOLIO</h2>
              </div>
              <span className="text-xs text-gray-400">{loans.length} Borrowers</span>
            </div>

            {loans.length === 0 ? (
              <p className="text-xs text-gray-500 py-4 text-center">No active loans currently disbursed.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-[10px] text-gray-400 uppercase bg-gray-900/60 border-b border-gray-800">
                    <tr>
                      <th className="py-2.5 px-3">Company Name</th>
                      <th className="py-2.5 px-3">Principal</th>
                      <th className="py-2.5 px-3">Remaining Balance</th>
                      <th className="py-2.5 px-3">Interest Rate</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {loans.map((l) => (
                      <tr key={l.id} className="hover:bg-gray-900/30">
                        <td className="py-3 px-3 font-bold text-white">{l.company_name || l.company_id}</td>
                        <td className="py-3 px-3 text-vc-gold font-bold">{l.principal_amount} VB</td>
                        <td className="py-3 px-3 text-vc-rose font-bold">{l.remaining_balance} VB</td>
                        <td className="py-3 px-3 text-gray-300">{l.interest_rate_percent}%</td>
                        <td className="py-3 px-3">
                          <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-vc-emerald/10 text-vc-emerald border border-vc-emerald/30">
                            {l.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Government Civic Grants Disbursal Section */}
        {instId === 'government' && (
          <div className="bg-vc-card border border-vc-border rounded-xl p-6 shadow space-y-4">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-rose-400" />
                <h2 className="text-base font-syne font-bold text-white uppercase">
                  DISBURSE NON-DILUTIVE CIVIC GRANT
                </h2>
              </div>
              <span className="text-xs text-rose-400 font-bold">
                Pool Remaining: {(config.grant_pool_remaining ?? 30000).toLocaleString()} VB
              </span>
            </div>

            <form onSubmit={handleDisburseGrant} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div>
                <label className="block text-gray-400 mb-1 font-bold">Target Entity:</label>
                <select
                  value={grantRecipientType}
                  onChange={(e) => {
                    const t = e.target.value as 'company' | 'participant';
                    setGrantRecipientType(t);
                    setGrantRecipientId(t === 'company' ? companies[0]?.id : participants[0]?.id);
                  }}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                >
                  <option value="company">Active Venture</option>
                  <option value="participant">Individual Citizen</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-bold">Recipient:</label>
                <select
                  value={grantRecipientId || (grantRecipientType === 'company' ? companies[0]?.id : participants[0]?.id)}
                  onChange={(e) => setGrantRecipientId(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono"
                >
                  {grantRecipientType === 'company'
                    ? companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.id})
                        </option>
                      ))
                    : participants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} [{p.citizen_code}]
                        </option>
                      ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-bold">Grant Amount (VB, max 8,000):</label>
                <input
                  type="number"
                  min={1}
                  max={8000}
                  value={grantAmount}
                  onChange={(e) => setGrantAmount(Math.min(8000, Math.max(1, parseInt(e.target.value, 10) || 0)))}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-bold">Endowment Purpose / Tender:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={grantPurpose}
                    onChange={(e) => setGrantPurpose(e.target.value)}
                    placeholder="e.g. Clean Energy Grid Modernization"
                    className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                    required
                  />
                  <button
                    type="submit"
                    disabled={grantSubmitting}
                    className="bg-rose-500 hover:bg-rose-600 text-white font-syne font-bold px-4 py-2 rounded uppercase tracking-wider disabled:opacity-50"
                  >
                    {grantSubmitting ? 'Disbursing...' : 'Disburse'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Company Intelligence & Underwriting Panel */}
        <div className="bg-vc-card border border-vc-border rounded-xl p-6 shadow space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-vc-gold" />
                <h2 className="text-base font-syne font-bold text-white uppercase tracking-wider">
                  CITY VENTURES UNDERWRITING & LIVE INTELLIGENCE
                </h2>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Real-time operational status, vault treasuries, resources, and leadership for all 12 active city companies.
              </p>
            </div>
            <span className="text-xs text-vc-gold font-bold">{companies.length} Operating Companies</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[10px] text-gray-400 uppercase bg-gray-900/60 border-b border-gray-800">
                <tr>
                  <th className="py-2.5 px-3">Company</th>
                  <th className="py-2.5 px-3">Sector & Role</th>
                  <th className="py-2.5 px-3">CEO Persona</th>
                  <th className="py-2.5 px-3">Vault Treasury</th>
                  <th className="py-2.5 px-3">Resources</th>
                  <th className="py-2.5 px-3 text-right">Desk Deal Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {companies.map((c) => {
                  const res = c.resources || {};
                  return (
                    <tr key={c.id} className="hover:bg-gray-900/30">
                      <td className="py-3 px-3">
                        <div className="font-bold text-white text-sm">{c.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{c.id}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-gray-200 capitalize font-medium">{c.cluster || 'Physical'}</div>
                        <div className="text-[10px] text-gray-400">{c.fills_slot || 'Core Slot'}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded bg-gray-800 text-gray-300 font-mono text-[10px]">
                          {c.ceo_persona || 'Operator'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-bold text-vc-gold">
                        {(c.vault_balance ?? 30000).toLocaleString()} VB
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1 text-[10px] font-mono">
                          <span className="px-1.5 py-0.5 bg-gray-900 border border-gray-800 rounded text-cyan-300">
                            C:{res.compute ?? 100}
                          </span>
                          <span className="px-1.5 py-0.5 bg-gray-900 border border-gray-800 rounded text-amber-300">
                            E:{res.energy ?? 100}
                          </span>
                          <span className="px-1.5 py-0.5 bg-gray-900 border border-gray-800 rounded text-emerald-300">
                            M:{res.materials ?? 100}
                          </span>
                          <span className="px-1.5 py-0.5 bg-gray-900 border border-gray-800 rounded text-purple-300">
                            L:{res.logistics ?? 100}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => {
                            setDealRecipientType('company');
                            setDealRecipientId(c.id);
                            setShowProposeModal(true);
                          }}
                          className="bg-gray-800 hover:bg-gray-700 text-vc-gold border border-vc-gold/30 hover:border-vc-gold font-syne font-bold text-[11px] px-3 py-1.5 rounded transition-all shadow"
                        >
                          {instId === 'bank'
                            ? 'Propose Loan'
                            : instId === 'investor'
                            ? 'Propose Term Sheet'
                            : 'Initiate Deal'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Station Missions & Volunteer Check-in Queue */}
        <div className="bg-vc-card border border-vc-border rounded-xl p-6 shadow space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-vc-gold" />
                <h2 className="text-base font-syne font-bold text-white uppercase">
                  Station Mission Verification & Check-in Desk
                </h2>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Volunteers physically authenticate citizens presenting at this station and disburse ledger rewards.
              </p>
            </div>

            {/* Station Verification Codes for Volunteer Reference */}
            <div className="bg-black/50 border border-gray-800 px-3 py-1.5 rounded text-xs flex items-center gap-3">
              <span className="text-gray-400">Desk Station Code:</span>
              <strong className="text-vc-gold font-mono tracking-wider">
                {instId === 'enterprise_customer'
                  ? 'CUST-ANCHOR-2026'
                  : instId === 'logistics'
                  ? 'LOG-CORRIDOR-90'
                  : instId === 'talent_exchange'
                  ? 'TALENT-ADVISORY-77'
                  : instId === 'bank'
                  ? 'SOVEREIGN-FACILITY-99'
                  : 'STATION-CHECKIN-OPEN'}
              </strong>
            </div>
          </div>

          {stationClaims.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-xs">
              No citizens currently in queue awaiting check-in verification at this station.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[10px] text-gray-400 uppercase bg-gray-900/60 border-b border-gray-800">
                  <tr>
                    <th className="py-2.5 px-3">Citizen Code</th>
                    <th className="py-2.5 px-3">Name</th>
                    <th className="py-2.5 px-3">Affiliated Venture</th>
                    <th className="py-2.5 px-3">Mission Title</th>
                    <th className="py-2.5 px-3">Reward</th>
                    <th className="py-2.5 px-3 text-right">Verification Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {stationClaims.map((claim) => (
                    <tr key={claim.instance_id} className="hover:bg-gray-900/30">
                      <td className="py-3 px-3 font-mono font-bold text-vc-gold">
                        {claim.citizen_code}
                      </td>
                      <td className="py-3 px-3 text-white font-medium">{claim.participant_name}</td>
                      <td className="py-3 px-3 text-gray-400">{claim.company_name || 'Free Agent'}</td>
                      <td className="py-3 px-3 text-gray-300 font-medium">{claim.title}</td>
                      <td className="py-3 px-3 text-vc-emerald font-bold">+{claim.reward_vb} VB</td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleApproveClaim(claim.instance_id)}
                          disabled={approvingClaimId === claim.instance_id}
                          className="bg-vc-emerald hover:bg-emerald-400 text-black font-syne font-bold text-xs px-3 py-1.5 rounded inline-flex items-center gap-1 shadow active:scale-95 transition-transform"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            {approvingClaimId === claim.instance_id ? 'Approving...' : 'Approve Check-in'}
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Desk Deals & Queue */}
        <div className="bg-vc-card border border-vc-border rounded-xl p-6 shadow space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
            <div>
              <h2 className="text-base font-syne font-bold text-white uppercase tracking-wider">
                DESK TRANSACTIONS & PROPOSALS QUEUE
              </h2>
              <p className="text-xs text-gray-400">
                Incoming contracts and bilateral deal proposals requiring desk operator signature.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-vc-gold font-bold">{deals.length} Recorded</span>
              <button
                onClick={() => {
                  if (dealRecipientType === 'company' && companies.length > 0 && !dealRecipientId) {
                    setDealRecipientId(companies[0].id);
                  }
                  setShowProposeModal(true);
                }}
                className="bg-vc-gold hover:bg-yellow-400 text-black font-syne font-bold text-xs px-3 py-1.5 rounded inline-flex items-center gap-1.5 shadow active:scale-95 transition-transform"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>
                  {instId === 'bank'
                    ? 'Propose Loan'
                    : instId === 'investor'
                    ? 'Propose Term Sheet'
                    : 'Propose Deal'}
                </span>
              </button>
            </div>
          </div>

          {deals.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-xs">
              No transactions currently queued for this workstation.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[10px] text-gray-400 uppercase bg-gray-900/60 border-b border-gray-800">
                  <tr>
                    <th className="py-2.5 px-3">Deal ID</th>
                    <th className="py-2.5 px-3">Template</th>
                    <th className="py-2.5 px-3">Counterparty</th>
                    <th className="py-2.5 px-3">Terms Summary</th>
                    <th className="py-2.5 px-3">Version</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Desk Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {deals.map((d) => {
                    const isRecipient = d.recipient_type === 'institution' && d.recipient_id === instId;
                    const isSender = (d.sender_type === 'institution' && d.sender_id === instId) || d.sender_id === session?.userId;
                    const canAct = d.status === 'proposed' && isRecipient && !isSender;

                    return (
                      <tr key={d.id} className="hover:bg-gray-900/30">
                        <td className="py-3 px-3 font-mono text-gray-400 text-[10px]">{d.id.slice(0, 10)}...</td>
                        <td className="py-3 px-3 font-bold text-vc-gold uppercase">{d.template_type}</td>
                        <td className="py-3 px-3 text-white">
                          <div className="flex items-center gap-1.5 mb-1">
                            {isSender ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono font-bold uppercase">OUTGOING</span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold uppercase">INCOMING</span>
                            )}
                          </div>
                          <div className="text-[11px] font-bold text-white">
                            From: <span className="text-gray-300">{d.sender_company_name || d.sender_participant_name || d.sender_id}</span>
                          </div>
                          <div className="text-[11px] font-bold text-vc-gold">
                            To: <span className="text-gray-300">{d.recipient_company_name || d.recipient_participant_name || d.recipient_id}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-gray-300 max-w-xs truncate">
                          {JSON.stringify(d.terms)}
                        </td>
                        <td className="py-3 px-3 font-bold text-vc-blue">v{d.version}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                              d.status === 'accepted'
                                ? 'bg-vc-emerald/10 text-vc-emerald border border-vc-emerald/30'
                                : d.status === 'rejected'
                                ? 'bg-vc-rose/10 text-vc-rose border border-vc-rose/30'
                                : 'bg-vc-gold/10 text-vc-gold border border-vc-gold/30'
                            }`}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          {canAct ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleDealAction(d.id, 'accept')}
                                disabled={actionLoading === d.id}
                                className="bg-vc-emerald hover:bg-emerald-600 text-white px-2.5 py-1 rounded text-[10px] font-bold disabled:opacity-50"
                              >
                                {actionLoading === d.id ? 'Processing...' : 'Approve'}
                              </button>
                              <button
                                onClick={() => {
                                  setCounterDealId(d.id);
                                  setCounterTerms(d.terms || {});
                                }}
                                className="bg-vc-blue hover:bg-blue-600 text-white px-2.5 py-1 rounded text-[10px] font-bold"
                              >
                                Counter
                              </button>
                              <button
                                onClick={() => handleDealAction(d.id, 'reject')}
                                disabled={actionLoading === d.id}
                                className="bg-vc-rose hover:bg-rose-600 text-white px-2.5 py-1 rounded text-[10px] font-bold disabled:opacity-50"
                              >
                                Decline
                              </button>
                            </div>
                          ) : d.status === 'proposed' && isSender ? (
                            <span className="text-[10px] text-vc-gold font-bold bg-vc-gold/10 border border-vc-gold/30 px-2 py-0.5 rounded inline-block">
                              Awaiting Recipient Review
                            </span>
                          ) : (
                            <span className="text-[10px] text-gray-500 italic">Settled</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Counter Modal */}
      {counterDealId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-vc-card border border-vc-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="font-syne font-bold text-white text-base">Desk Counter-Proposal (Version N+1)</h3>
              <button onClick={() => setCounterDealId(null)} className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCounterSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-400 mb-1 font-bold">Counter Terms (JSON):</label>
                <textarea
                  rows={5}
                  value={JSON.stringify(counterTerms, null, 2)}
                  onChange={(e) => {
                    try {
                      setCounterTerms(JSON.parse(e.target.value));
                    } catch {}
                  }}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono text-[11px]"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setCounterDealId(null)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={counterSubmitting}
                  className="px-4 py-2 bg-vc-blue hover:bg-blue-600 text-white font-bold rounded"
                >
                  {counterSubmitting ? 'Dispatching...' : 'Dispatch Counter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Propose Deal / Term Sheet Modal */}
      {showProposeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-vc-card border border-vc-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div>
                <h3 className="font-syne font-bold text-white text-base">
                  {instId === 'bank'
                    ? 'Propose Loan / Credit Facility'
                    : instId === 'investor'
                    ? 'Propose Venture Investment / Term Sheet'
                    : 'Dispatch Station Deal Proposal'}
                </h3>
                <p className="text-[11px] text-gray-400">
                  Originating from <span className="text-vc-gold font-bold">{institution?.name || meta.name}</span>
                </p>
              </div>
              <button
                onClick={() => setShowProposeModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProposeDeal} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-400 mb-1 font-bold">Deal Template:</label>
                <select
                  value={dealTemplate}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono"
                >
                  {instId === 'bank' && <option value="loan">1. Bank Loan Facility</option>}
                  {instId === 'investor' && <option value="investment">2. Venture Equity Investment</option>}
                  <option value="sale">Commercial Sale / Contract</option>
                  <option value="resource_trade">Resource Trade</option>
                  <option value="freelance">Freelance Specialist</option>
                  <option value="employment">Employment Contract</option>
                  <option value="information_trade">Market Information Trade</option>
                  {instId !== 'bank' && <option value="loan">Bank Loan Facility</option>}
                  {instId !== 'investor' && <option value="investment">Venture Equity Investment</option>}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1 font-bold">Recipient Category:</label>
                  <select
                    value={dealRecipientType}
                    onChange={(e) => handleRecipientTypeChange(e.target.value as any)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono"
                  >
                    <option value="company">Venture Company</option>
                    <option value="participant">Citizen / Free Agent</option>
                    <option value="institution">Other Institution Desk</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1 font-bold">Recipient Target:</label>
                  {dealRecipientType === 'company' ? (
                    <select
                      value={dealRecipientId}
                      onChange={(e) => setDealRecipientId(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono text-[11px]"
                      required
                    >
                      <option value="">-- Select Company --</option>
                      {companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} (Tier {c.tier})
                        </option>
                      ))}
                    </select>
                  ) : dealRecipientType === 'participant' ? (
                    <select
                      value={dealRecipientId}
                      onChange={(e) => setDealRecipientId(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono text-[11px]"
                      required
                    >
                      <option value="">-- Select Citizen (VC-ID) --</option>
                      {participants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.citizen_code} — {p.name} {p.company_name ? `(${p.company_name})` : '(Free Agent)'}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={dealRecipientId}
                      onChange={(e) => setDealRecipientId(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono text-[11px]"
                      required
                    >
                      <option value="">-- Select Institution --</option>
                      {allInstitutions
                        .filter((i) => i.id !== instId)
                        .map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} ({i.id})
                          </option>
                        ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-bold">Deal Terms Specification (JSON):</label>
                <textarea
                  rows={5}
                  value={JSON.stringify(dealTerms, null, 2)}
                  onChange={(e) => {
                    try {
                      setDealTerms(JSON.parse(e.target.value));
                    } catch {}
                  }}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono text-[11px] focus:border-vc-gold focus:outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowProposeModal(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dealSubmitting}
                  className="px-4 py-2 bg-vc-gold hover:bg-yellow-400 text-black font-syne font-bold rounded flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  {dealSubmitting ? 'Dispatching...' : 'Dispatch Proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Styled Dialog Modal */}
      <ModalDialog
        isOpen={dialogConfig.isOpen}
        title={dialogConfig.title}
        message={dialogConfig.message}
        type={dialogConfig.type}
        variant={dialogConfig.variant}
        onConfirm={dialogConfig.onConfirm}
        onCancel={() => setDialogConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
