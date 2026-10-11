'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ClockBanner } from '@/components/ui/clock-banner';
import { Wordmark } from '@/components/ui/wordmark';
import {
  Building2,
  Coins,
  Cpu,
  Zap,
  Truck,
  Box,
  Database,
  Layers,
  Users,
  PieChart,
  FileText,
  Handshake,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  PlusCircle,
  ExternalLink,
  ShieldCheck,
  Briefcase,
  Send,
  Wallet,
  Download,
  BookOpen,
  FileDown,
  X,
  Info,
  Lock,
  Sparkles,
} from 'lucide-react';
import { ModalDialog } from '@/components/ui/modal-dialog';

const RESOURCE_ICONS: Record<string, any> = {
  compute: Cpu,
  energy: Zap,
  logistics: Truck,
  materials: Box,
  data: Database,
  infrastructure: Layers,
};

export default function FounderPortalPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [companyData, setCompanyData] = useState<any>(null);
  const [capTable, setCapTable] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Dossier Reader Modal
  const [showDossierModal, setShowDossierModal] = useState(false);
  const [dossierTab, setDossierTab] = useState<'letter' | 'products' | 'obligations' | 'dependencies' | 'intel'>('letter');

  // Modals & Action States
  const [payrollLoading, setPayrollLoading] = useState(false);
  const [payrollMsg, setPayrollMsg] = useState<{ success: boolean; text: string } | null>(null);

  // Transfer Modal (Personal Wallet)
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferRecipientCode, setTransferRecipientCode] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null);
  const [founderTransfers, setFounderTransfers] = useState<any[]>([]);

  const [showDealModal, setShowDealModal] = useState(false);
  const [dealTemplate, setDealTemplate] = useState('sale');
  const [dealRecipientType, setDealRecipientType] = useState('company');
  const [dealRecipientId, setDealRecipientId] = useState('');
  const [dealTerms, setDealTerms] = useState<any>({ price: 2000, price_vb: 2000, description: 'Standard deliverable contract' });
  const [dealSubmitting, setDealSubmitting] = useState(false);
  const [dealError, setDealError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);

  // Counter Modal
  const [counterDealId, setCounterDealId] = useState<string | null>(null);
  const [counterTerms, setCounterTerms] = useState<any>({});
  const [counterSubmitting, setCounterSubmitting] = useState(false);

  // Repay Loan Modal
  const [repayingLoanId, setRepayingLoanId] = useState<string | null>(null);

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

  const loadInitial = async () => {
    try {
      setRefreshing(true);
      const sessRes = await fetch('/api/auth/session');
      if (!sessRes.ok) {
        router.push('/login');
        return;
      }
      const s = await sessRes.json();
      setSession(s.user);

      // Strict Access Restriction: Founder Desk is for company_lead, GM, and Tech Admin only!
      const isFounderOrAdmin = s.user.role === 'company_lead' || s.user.role === 'gm' || s.user.role === 'admin';
      if (!isFounderOrAdmin) {
        router.push('/portal');
        return;
      }

      // Fetch all companies list, institutions, and participants
      const [compRes, instRes, partRes] = await Promise.all([
        fetch('/api/companies'),
        fetch('/api/institutions'),
        fetch('/api/participants'),
      ]);

      if (compRes.ok) {
        const cd = await compRes.json();
        setCompanies(cd.companies || []);

        const initialCompId = s.user.companyId || (cd.companies[0]?.id ?? '');
        setSelectedCompanyId(initialCompId);
      }

      if (instRes.ok) {
        const idata = await instRes.json();
        setInstitutions(idata || []);
      }

      if (partRes.ok) {
        const pdata = await partRes.json();
        setParticipants(pdata.participants || []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadCompanyDetails = async (compId: string) => {
    if (!compId) return;
    try {
      // 1. Company details (vault, resources, members)
      const res = await fetch(`/api/companies?id=${compId}`);
      if (res.ok) {
        const d = await res.json();
        setCompanyData(d.company);
      }

      // 2. Cap Table
      const capRes = await fetch(`/api/cap-table?companyId=${compId}`);
      if (capRes.ok) {
        const cd = await capRes.json();
        setCapTable(cd.capTable || []);
      }

      // 3. Deals involving this company
      const dealsRes = await fetch('/api/deals');
      if (dealsRes.ok) {
        const dd = await dealsRes.json();
        const filtered = (dd.deals || []).filter(
          (deal: any) =>
            (deal.sender_type === 'company' && deal.sender_id === compId) ||
            (deal.recipient_type === 'company' && deal.recipient_id === compId)
        );
        setDeals(filtered);
      }

      // 4. Loans for this company
      const loansRes = await fetch(`/api/loans?companyId=${compId}`);
      if (loansRes.ok) {
        const ld = await loansRes.json();
        setLoans(ld.loans || []);
      }

      // 5. Live refresh personal session wallet balance & recent transfers
      const [sessRes, txRes] = await Promise.all([
        fetch('/api/auth/session'),
        fetch('/api/ledger/transfer'),
      ]);
      if (sessRes.ok) {
        const s = await sessRes.json();
        setSession(s.user);
      }
      if (txRes.ok) {
        const t = await txRes.json();
        setFounderTransfers(t.ledgerEntries || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransferSubmitting(true);
    setTransferError(null);
    setTransferSuccess(null);
    try {
      const res = await fetch('/api/ledger/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientCode: transferRecipientCode.trim(),
          amount: parseInt(transferAmount, 10),
          reason: transferReason.trim(),
          idempotencyKey: `fnd_tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Transfer failed');

      setTransferSuccess(data.message || `Successfully transferred ${data.amount} VB to ${data.recipient}!`);
      if (data.newSenderBalance !== undefined) {
        setSession((prev: any) => prev ? { ...prev, walletBalance: data.newSenderBalance } : prev);
      }
      setTransferRecipientCode('');
      setTransferAmount('');
      setTransferReason('');
      await loadCompanyDetails(selectedCompanyId);
    } catch (err: any) {
      setTransferError(err.message);
    } finally {
      setTransferSubmitting(false);
    }
  };

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (selectedCompanyId) {
      loadCompanyDetails(selectedCompanyId);
      const interval = setInterval(() => loadCompanyDetails(selectedCompanyId), 6000);
      return () => clearInterval(interval);
    }
  }, [selectedCompanyId]);

  const handleRunPayroll = () => {
    setDialogConfig({
      isOpen: true,
      title: 'Confirm Tick Payroll',
      message: `Execute tick payroll (100 VB per employee) for ${companyData?.name}? Total commitment will be automatically debited from the venture treasury.`,
      type: 'confirm',
      variant: 'gold',
      onConfirm: async () => {
        setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        setPayrollLoading(true);
        setPayrollMsg(null);
        try {
          const res = await fetch('/api/companies/payroll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyId: selectedCompanyId }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Payroll disbursement failed');

          setPayrollMsg({
            success: true,
            text: `Successfully disbursed ${data.totalPayroll} VB across ${data.headcount} team members!`,
          });
          loadCompanyDetails(selectedCompanyId);
        } catch (err: any) {
          setPayrollMsg({ success: false, text: err.message });
        } finally {
          setPayrollLoading(false);
        }
      },
    });
  };

  const handleProposeDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    setDealSubmitting(true);
    setDealError(null);
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateType: dealTemplate,
          asCompany: true,
          recipientType: dealRecipientType,
          recipientId: dealRecipientId,
          terms: dealTerms,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit deal proposal');

      setShowDealModal(false);
      loadCompanyDetails(selectedCompanyId);
    } catch (err: any) {
      setDealError(err.message);
    } finally {
      setDealSubmitting(false);
    }
  };

  const handleDealAction = (dealId: string, action: 'accept' | 'reject') => {
    setDialogConfig({
      isOpen: true,
      title: `Confirm Deal ${action.toUpperCase()}`,
      message: `Confirm ${action.toUpperCase()} for this deal proposal?`,
      type: 'confirm',
      variant: action === 'accept' ? 'emerald' : 'danger',
      onConfirm: async () => {
        setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch(`/api/deals/${dealId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Deal action failed');
          setDialogConfig({
            isOpen: true,
            title: `Deal ${action === 'accept' ? 'Ratified' : 'Rejected'}`,
            message: `Deal proposal successfully ${action}ed!`,
            type: 'alert',
            variant: action === 'accept' ? 'emerald' : 'gold',
            onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
          });
          loadCompanyDetails(selectedCompanyId);
        } catch (err: any) {
          setDialogConfig({
            isOpen: true,
            title: 'Deal Action Error',
            message: err.message,
            type: 'alert',
            variant: 'danger',
            onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
          });
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
          reason: 'Founder counter-proposal adjustment',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Counter failed');

      setCounterDealId(null);
      setDialogConfig({
        isOpen: true,
        title: 'Counter Proposal Submitted',
        message: `Counter proposal submitted as Version ${data.version}!`,
        type: 'alert',
        variant: 'emerald',
        onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
      });
      loadCompanyDetails(selectedCompanyId);
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

  const handleRepayLoan = (loanId: string, amount: number) => {
    setDialogConfig({
      isOpen: true,
      title: 'Repay Bank Loan',
      message: `Repay ${amount.toLocaleString()} VB towards loan #${loanId.slice(-6)}? This will be transferred directly to Apex Reserve Bank.`,
      type: 'confirm',
      variant: 'gold',
      onConfirm: async () => {
        setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch('/api/loans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ loanId, amount }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Loan repayment failed');
          setDialogConfig({
            isOpen: true,
            title: 'Repayment Processed',
            message: 'Loan repayment successfully processed and principal balance reduced!',
            type: 'alert',
            variant: 'emerald',
            onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
          });
          loadCompanyDetails(selectedCompanyId);
        } catch (err: any) {
          setDialogConfig({
            isOpen: true,
            title: 'Repayment Error',
            message: err.message,
            type: 'alert',
            variant: 'danger',
            onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
          });
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030712] text-white flex items-center justify-center font-mono">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-vc-gold" />
      </div>
    );
  }

  const isGmOrAdmin = session?.role === 'gm' || session?.role === 'admin';

  return (
    <div className="min-h-screen bg-[#030712] text-gray-100 flex flex-col font-mono selection:bg-vc-gold selection:text-black pb-24">
      <ClockBanner />

      {/* Top Header */}
      <header className="bg-vc-card border-b border-vc-border px-6 py-4 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Wordmark size="sm" showTagline={false} />
            <div className="h-6 w-px bg-gray-800" />
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-vc-gold" />
              <span className="font-syne font-bold text-white text-base">FOUNDER COMMAND PORTAL</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Founder Personal Wallet Balance */}
            <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5">
              <Coins className="w-3.5 h-3.5 text-vc-gold" />
              <div className="text-[10px] text-gray-400">
                Personal Wallet:{' '}
                <span className="font-bold text-white font-syne text-xs">
                  {(session?.walletBalance ?? 0).toLocaleString()} VB
                </span>
              </div>
            </div>

            {/* Quick Portal Switchers */}
            <Link
              href="/portal"
              className="text-xs bg-gray-900 hover:bg-gray-800 text-gray-300 px-3 py-1.5 rounded border border-gray-700 flex items-center gap-1.5"
            >
              <Briefcase className="w-3.5 h-3.5 text-vc-gold" />
              <span>Citizen View</span>
            </Link>

            {isGmOrAdmin ? (
              <Link
                href="/desk"
                className="text-xs bg-gray-900 hover:bg-gray-800 text-gray-300 px-3 py-1.5 rounded border border-gray-700 flex items-center gap-1.5"
              >
                <span>Station Desks</span>
              </Link>
            ) : (
              <Link
                href="/desk"
                className="text-xs bg-gray-900 hover:bg-gray-800 text-gray-300 px-3 py-1.5 rounded border border-gray-700 flex items-center gap-1.5"
              >
                <span>City Guide</span>
              </Link>
            )}

            {isGmOrAdmin && (
              <Link
                href="/gm"
                className="text-xs bg-vc-gold/10 hover:bg-vc-gold/20 text-vc-gold px-3 py-1.5 rounded border border-vc-gold/30 flex items-center gap-1.5 font-bold"
              >
                <span>GM Deck</span>
              </Link>
            )}

            <button
              onClick={() => loadCompanyDetails(selectedCompanyId)}
              className="p-1.5 text-gray-400 hover:text-white rounded border border-gray-800"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto w-full p-6 space-y-6">
        {/* Company Header Card */}
        <div className="bg-vc-card border border-vc-border rounded-xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-syne font-black text-white">
                  {companyData?.name || 'Company Portal'}
                </h1>
                <span className="text-xs uppercase px-2 py-0.5 rounded font-bold bg-vc-gold/10 text-vc-gold border border-vc-gold/30">
                  {companyData?.status || 'OPERATING'}
                </span>
                <span className="text-xs text-gray-400">Tier {companyData?.tier || 1}</span>
              </div>
              <p className="text-xs text-gray-400 max-w-2xl">{companyData?.tagline}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Dossier Download and Reader Actions */}
              <a
                href={companyData?.dossier_url || companyData?.dossier_slug_url || `/dossiers/${companyData?.id}.docx`}
                download
                className="bg-vc-gold/10 hover:bg-vc-gold/20 text-vc-gold border border-vc-gold/30 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow hover:scale-105 active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Dossier (.docx)</span>
              </a>

              <button
                onClick={() => setShowDossierModal(true)}
                className="bg-gray-900 hover:bg-gray-800 text-white border border-gray-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow hover:scale-105 active:scale-95"
              >
                <BookOpen className="w-3.5 h-3.5 text-vc-gold" />
                <span>Read Dossier</span>
              </button>

              {/* If GM or multiple companies, allow company switcher */}
              {isGmOrAdmin && (
                <div className="flex items-center gap-2 bg-gray-900 p-1.5 rounded-lg border border-gray-800">
                  <span className="text-[11px] text-gray-400 font-bold">Switch:</span>
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                    className="bg-black text-white text-xs border border-gray-700 rounded px-2 py-1 outline-none font-mono"
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Strategic Profile / Master Catalogue Blueprint */}
        <div className="bg-gradient-to-r from-gray-900 via-gray-900/90 to-gray-950 border border-vc-border rounded-xl p-4 shadow-lg grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          <div className="bg-black/40 border border-gray-800/80 p-2.5 rounded-lg">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">CEO Persona</div>
            <div className="text-white font-bold mt-0.5 truncate">{companyData?.ceo_persona || 'Founder'}</div>
          </div>
          <div className="bg-black/40 border border-gray-800/80 p-2.5 rounded-lg">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Deficit Domain</div>
            <div className="text-vc-rose font-bold mt-0.5 truncate">{companyData?.deficit_domain || 'None'}</div>
          </div>
          <div className="bg-black/40 border border-gray-800/80 p-2.5 rounded-lg">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Notable Asset</div>
            <div className="text-vc-gold font-bold mt-0.5 truncate" title={companyData?.notable_asset}>
              {companyData?.notable_asset || 'None'}
            </div>
          </div>
          <div className="bg-black/40 border border-gray-800/80 p-2.5 rounded-lg">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Gate / Licence</div>
            <div className="text-amber-400 font-bold mt-0.5 truncate" title={companyData?.gate}>
              {companyData?.gate || 'Unrestricted'}
            </div>
          </div>
          <div className="bg-black/40 border border-gray-800/80 p-2.5 rounded-lg">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Critical Slot Need</div>
            <div className="text-cyan-400 font-bold mt-0.5 truncate" title={companyData?.critical_slot}>
              {companyData?.critical_slot || 'None'}
            </div>
          </div>
          <div className="bg-black/40 border border-gray-800/80 p-2.5 rounded-lg">
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Fills Slots</div>
            <div className="text-vc-emerald font-bold mt-0.5 truncate">{companyData?.fills_slots || 'Specialist'}</div>
          </div>
        </div>

        {/* 2-Column Grid: Treasury & Cap Table */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Treasury Vault & Resource Stocks (2 Columns) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-vc-card border border-vc-border rounded-xl p-6 shadow space-y-6">
              <div className="flex flex-wrap items-center justify-between border-b border-gray-800 pb-4 gap-4">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-vc-gold" />
                  <div>
                    <h2 className="text-sm font-syne font-bold text-white uppercase tracking-wider">
                      Company Treasury Vault
                    </h2>
                    <div className="text-[10px] text-gray-400">Live Immutable Ledger Balances</div>
                  </div>
                </div>

                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <span className="text-2xl font-syne font-black text-vc-gold">
                      {(companyData?.vault_balance ?? 0).toLocaleString()} <span className="text-sm">VB</span>
                    </span>
                    <div className="text-[10px] text-gray-400">Company Runway</div>
                  </div>

                  <div className="h-8 w-px bg-gray-800" />

                  <div className="text-right">
                    <span className="text-xl font-syne font-black text-white">
                      {(session?.walletBalance ?? 0).toLocaleString()} <span className="text-xs text-vc-gold">VB</span>
                    </span>
                    <div className="text-[10px] text-gray-400">Founder Personal</div>
                  </div>

                  <button
                    onClick={() => {
                      setTransferError(null);
                      setTransferSuccess(null);
                      setShowTransferModal(true);
                    }}
                    className="bg-vc-gold hover:bg-yellow-400 text-black font-syne font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow active:scale-95 transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send VB</span>
                  </button>
                </div>
              </div>

              {/* 6 Core Resources Inventory */}
              <div>
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                  Core Resource Inventories (Starting: 100 units each)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {['compute', 'energy', 'logistics', 'materials', 'data', 'infrastructure'].map((resKey) => {
                    const Icon = RESOURCE_ICONS[resKey] || Box;
                    const qty = companyData?.resources?.[resKey] ?? 0;
                    return (
                      <div
                        key={resKey}
                        className="bg-gray-900/80 border border-gray-800/80 p-3 rounded-lg flex items-center gap-3"
                      >
                        <div className="p-2 bg-gray-800 rounded text-vc-gold">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-400 uppercase tracking-wider">{resKey}</div>
                          <div className="text-sm font-bold text-white font-syne">
                            {qty.toLocaleString()} <span className="text-[10px] font-normal text-gray-400">units</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Team Roster & Payroll Action */}
            <div className="bg-vc-card border border-vc-border rounded-xl p-6 shadow space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-800 pb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-vc-blue" />
                  <h2 className="text-sm font-syne font-bold text-white uppercase tracking-wider">
                    Team Roster ({companyData?.members?.length || 0} Staff)
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRunPayroll}
                    disabled={payrollLoading}
                    className="bg-vc-gold hover:bg-yellow-400 text-black font-syne font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>{payrollLoading ? 'Disbursing...' : 'Disburse Tick Payroll (100 VB/head)'}</span>
                  </button>
                </div>
              </div>

              {payrollMsg && (
                <div
                  className={`p-3 rounded-lg text-xs flex items-center gap-2 ${
                    payrollMsg.success ? 'bg-vc-emerald/10 text-vc-emerald border border-vc-emerald/30' : 'bg-vc-rose/10 text-vc-rose border border-vc-rose/30'
                  }`}
                >
                  {payrollMsg.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  <span>{payrollMsg.text}</span>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="text-[10px] text-gray-400 uppercase bg-gray-900/60 border-b border-gray-800">
                    <tr>
                      <th className="py-2 px-3">Citizen ID</th>
                      <th className="py-2 px-3">Name</th>
                      <th className="py-2 px-3">Company Role</th>
                      <th className="py-2 px-3">Salary / Tick</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {(companyData?.members || []).map((m: any) => (
                      <tr key={m.id} className="hover:bg-gray-900/30">
                        <td className="py-2.5 px-3 font-bold text-vc-gold">{m.citizen_code}</td>
                        <td className="py-2.5 px-3 text-white">{m.name}</td>
                        <td className="py-2.5 px-3 text-gray-300 uppercase text-[10px]">{m.role}</td>
                        <td className="py-2.5 px-3 text-gray-300 font-bold">100 VB</td>
                        <td className="py-2.5 px-3">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-vc-emerald/10 text-vc-emerald border border-vc-emerald/20 font-bold uppercase">
                            Active
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right Column: Cap Table & Active Loans */}
          <div className="space-y-6">
            {/* Cap Table Equity Distribution */}
            <div className="bg-vc-card border border-vc-border rounded-xl p-6 shadow space-y-4">
              <div className="flex flex-wrap items-center justify-between border-b border-gray-800 pb-3 gap-2">
                <div className="flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-vc-gold" />
                  <div>
                    <h2 className="text-sm font-syne font-bold text-white uppercase tracking-wider">
                      Cap Table Equity
                    </h2>
                    <div className="text-[10px] text-gray-500">1,000 Authorized Shares Total</div>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-vc-gold/10 text-vc-gold border border-vc-gold/30">
                  100.00% Allocated
                </span>
              </div>

              {/* Starting State Clarity */}
              <div className="p-2.5 bg-black/40 border border-gray-800/80 rounded-lg text-[10px] text-gray-400 space-y-1">
                <div className="flex items-center justify-between text-white font-bold">
                  <span>Starting State Invariant</span>
                  <span className="text-vc-gold">ACID Verified</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Founding Common: 800 Shares</span>
                  <span className="text-gray-300">80.00%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Employee Option Pool: 200 Shares</span>
                  <span className="text-gray-300">20.00%</span>
                </div>
              </div>

              <div className="space-y-3">
                {capTable.map((item: any) => {
                  const pct = parseFloat(item.shares_or_percent || '0');
                  const shareCount = item.shares || Math.round(pct * 10);
                  const holdingValue = item.value_vb || Math.round((pct / 100) * (companyData?.vault_balance || 30000));

                  return (
                    <div key={item.id} className="bg-gray-900/60 border border-gray-800 p-3 rounded-lg space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white font-bold capitalize">
                          {item.shareholder_name || item.shareholder_type}
                        </span>
                        <div className="text-right">
                          <span className="text-vc-gold font-syne font-bold text-sm">
                            {pct.toFixed(2)}%
                          </span>
                          <span className="text-[10px] text-gray-400 block font-mono">
                            {shareCount} Shares
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-vc-gold h-1.5 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-gray-500 capitalize flex items-center justify-between pt-1">
                        <span className="text-gray-400">{item.share_class || item.shareholder_type}</span>
                        <span className="text-vc-emerald font-bold font-syne">
                          Value: ~{holdingValue.toLocaleString()} VB
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Active Bank Loans */}
            <div className="bg-vc-card border border-vc-border rounded-xl p-6 shadow space-y-4">
              <div className="flex items-center justify-between border-b border-gray-800 pb-3">
                <div className="flex items-center gap-2">
                  <Coins className="w-4 h-4 text-vc-rose" />
                  <h2 className="text-sm font-syne font-bold text-white uppercase tracking-wider">
                    Bank Loans
                  </h2>
                </div>
                <span className="text-[10px] text-gray-400">{loans.length} Active</span>
              </div>

              {loans.length === 0 ? (
                <p className="text-xs text-gray-500 py-3 text-center">No outstanding loans with Apex Bank.</p>
              ) : (
                <div className="space-y-3">
                  {loans.map((loan) => (
                    <div key={loan.id} className="bg-gray-900/60 border border-gray-800 p-3 rounded-lg space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-white font-bold">Principal: {loan.principal_amount} VB</span>
                        <span className="text-vc-rose font-bold text-xs">{loan.status}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 flex items-center justify-between">
                        <span>Remaining: {loan.remaining_balance} VB</span>
                        <span>Rate: {loan.interest_rate_percent}%</span>
                      </div>
                      {loan.status === 'active' && (
                        <button
                          onClick={() => handleRepayLoan(loan.id, Math.min(loan.remaining_balance, 5000))}
                          className="w-full mt-2 bg-gray-800 hover:bg-gray-700 text-white text-[10px] font-bold py-1.5 rounded border border-gray-700 transition-colors"
                        >
                          Repay Installment (5,000 VB)
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Deals Engine Section */}
        <div className="bg-vc-card border border-vc-border rounded-xl p-6 shadow space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Handshake className="w-5 h-5 text-vc-gold" />
                <h2 className="text-base font-syne font-bold text-white">DEALS & CONTRACTS DESK</h2>
              </div>
              <p className="text-xs text-gray-400">
                Execute proposals, review counter-offers, and sign bilateral deals across 10 official templates.
              </p>
            </div>

            <button
              onClick={() => setShowDealModal(true)}
              className="bg-vc-gold hover:bg-yellow-400 text-black font-syne font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-2 shadow"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Propose New Deal</span>
            </button>
          </div>

          {/* Deals Table */}
          {deals.length === 0 ? (
            <div className="text-center py-10 text-gray-500 text-xs">
              No deals recorded for this company yet. Click &apos;Propose New Deal&apos; to initiate a transaction.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="text-[10px] text-gray-400 uppercase bg-gray-900/60 border-b border-gray-800">
                  <tr>
                    <th className="py-2.5 px-3">Template</th>
                    <th className="py-2.5 px-3">Parties</th>
                    <th className="py-2.5 px-3">Key Terms</th>
                    <th className="py-2.5 px-3">Version</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {deals.map((d) => {
                    const isRecipient =
                      (d.recipient_type === 'company' && d.recipient_id === selectedCompanyId) ||
                      d.recipient_id === session?.userId;
                    const isSender =
                      (d.sender_type === 'company' && d.sender_id === selectedCompanyId) ||
                      d.sender_id === session?.userId;
                    const canAct = d.status === 'proposed' && isRecipient && !isSender;

                    return (
                      <tr key={d.id} className="hover:bg-gray-900/30">
                        <td className="py-3 px-3 font-bold text-vc-gold uppercase tracking-wider">
                          {d.template_type}
                        </td>
                        <td className="py-3 px-3 text-white">
                          <div className="font-bold">From: {d.sender_company_name || d.sender_id}</div>
                          <div className="text-[10px] text-gray-400">To: {d.recipient_company_name || d.recipient_id}</div>
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
                                className="bg-vc-emerald hover:bg-emerald-600 text-white px-2.5 py-1 rounded text-[10px] font-bold"
                              >
                                Accept
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
                                className="bg-vc-rose hover:bg-rose-600 text-white px-2.5 py-1 rounded text-[10px] font-bold"
                              >
                                Reject
                              </button>
                            </div>
                          ) : d.status === 'proposed' && isSender ? (
                            <span className="text-[10px] text-vc-gold font-bold bg-vc-gold/10 border border-vc-gold/30 px-2 py-0.5 rounded">
                              Awaiting Counterparty Review
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

      {/* Propose Deal Modal */}
      {showDealModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-vc-card border border-vc-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="font-syne font-bold text-white text-base">Propose Deal (10 Official Templates)</h3>
              <button
                onClick={() => setShowDealModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {dealError && (
              <div className="p-3 bg-vc-rose/10 border border-vc-rose/30 text-vc-rose rounded text-xs">
                {dealError}
              </div>
            )}

            <form onSubmit={handleProposeDeal} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-400 mb-1 font-bold">Deal Template:</label>
                <select
                  value={dealTemplate}
                  onChange={(e) => {
                    const t = e.target.value;
                    setDealTemplate(t);
                    if (t === 'loan') {
                      setDealRecipientType('institution');
                      setDealRecipientId('bank');
                      setDealTerms({ principal: 10000, principal_vb: 10000, interest_rate_percent: 10, duration_ticks: 8 });
                    } else if (t === 'investment') {
                      setDealRecipientType('institution');
                      setDealRecipientId('investor');
                      setDealTerms({ amount: 20000, amount_vb: 20000, equity_percent: 10, pre_money_valuation: 180000 });
                    } else if (t === 'resource_trade') {
                      setDealRecipientType('institution');
                      setDealRecipientId('supplier');
                      setDealTerms({ resource_type: 'compute', resource_id: 'compute', quantity: 50, price_per_unit: 22.5, payment_vb: 1125, price_vb: 1125, price: 1125 });
                    } else {
                      setDealTerms({ price_vb: 2500, price: 2500, description: 'Commercial agreement terms' });
                    }
                  }}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                >
                  <option value="sale">1. Sale (Product/Deliverable)</option>
                  <option value="resource_trade">2. Resource Trade (Compute, Energy, etc.)</option>
                  <option value="loan">3. Bank Loan (Apex Reserve Bank)</option>
                  <option value="investment">4. Venture Investment (Frontier Fund)</option>
                  <option value="employment">5. Employment (Full-Time)</option>
                  <option value="freelance">6. Freelance Specialist</option>
                  <option value="acquisition">7. Acquisition</option>
                  <option value="merger">8. Merger</option>
                  <option value="spin_out">9. Spin-Out</option>
                  <option value="information_trade">10. Information & Market Intel Trade</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1 font-bold">Recipient Category:</label>
                  <select
                    value={dealRecipientType}
                    onChange={(e) => {
                      const t = e.target.value;
                      setDealRecipientType(t);
                      if (t === 'company') {
                        const targetComp = companies.find((c) => c.id !== selectedCompanyId);
                        setDealRecipientId(targetComp?.id || '');
                      } else if (t === 'institution') {
                        setDealRecipientId('bank');
                      } else if (t === 'participant') {
                        setDealRecipientId(participants[0]?.id || '');
                      }
                    }}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  >
                    <option value="company">Venture Company</option>
                    <option value="institution">Institution Desk</option>
                    <option value="participant">Citizen / Free Agent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1 font-bold">Recipient Target:</label>
                  {dealRecipientType === 'company' ? (
                    <select
                      value={dealRecipientId}
                      onChange={(e) => setDealRecipientId(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-xs"
                      required
                    >
                      <option value="">-- Select Target Company --</option>
                      {companies
                        .filter((c) => c.id !== selectedCompanyId)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} (Tier {c.tier})
                          </option>
                        ))}
                    </select>
                  ) : dealRecipientType === 'institution' ? (
                    <select
                      value={dealRecipientId}
                      onChange={(e) => setDealRecipientId(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-xs"
                      required
                    >
                      <option value="">-- Select Institution Desk --</option>
                      {institutions.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.id})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <select
                      value={dealRecipientId}
                      onChange={(e) => setDealRecipientId(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-xs"
                      required
                    >
                      <option value="">-- Select Citizen (VC-ID) --</option>
                      {participants.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.citizen_code} — {p.name} {p.company_name ? `(${p.company_name})` : '(Free Agent)'}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-bold">Terms (JSON spec):</label>
                <textarea
                  rows={4}
                  value={JSON.stringify(dealTerms, null, 2)}
                  onChange={(e) => {
                    try {
                      setDealTerms(JSON.parse(e.target.value));
                    } catch {}
                  }}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono text-[11px]"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowDealModal(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={dealSubmitting}
                  className="px-4 py-2 bg-vc-gold hover:bg-yellow-400 text-black font-syne font-bold rounded"
                >
                  {dealSubmitting ? 'Submitting...' : 'Dispatch Proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Counter Offer Modal */}
      {counterDealId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-vc-card border border-vc-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="font-syne font-bold text-white text-base">Submit Counter-Offer (Creates Version N+1)</h3>
              <button onClick={() => setCounterDealId(null)} className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCounterSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-400 mb-1 font-bold">Adjusted Terms (JSON):</label>
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
                  {counterSubmitting ? 'Submitting...' : 'Submit Counter Offer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Founder Personal Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-vc-card border border-vc-border rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl font-mono">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Send className="w-5 h-5 text-vc-gold" />
                <h3 className="font-syne font-bold text-white text-base">Direct Personal Transfer</h3>
              </div>
              <button
                onClick={() => setShowTransferModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="text-xs text-gray-400">
              Available Personal Wallet:{' '}
              <span className="text-vc-gold font-bold font-syne">
                {(session?.walletBalance ?? 0).toLocaleString()} VB
              </span>
            </div>

            {transferError && (
              <div className="p-3 bg-vc-rose/10 border border-vc-rose/30 text-vc-rose rounded text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{transferError}</span>
              </div>
            )}

            {transferSuccess && (
              <div className="p-3 bg-vc-emerald/10 border border-vc-emerald/30 text-vc-emerald rounded text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{transferSuccess}</span>
              </div>
            )}

            <form onSubmit={handleExecuteTransfer} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-400 mb-1 font-bold">Recipient Citizen Code / ID:</label>
                <input
                  type="text"
                  required
                  value={transferRecipientCode}
                  onChange={(e) => setTransferRecipientCode(e.target.value)}
                  placeholder="e.g. VC-002, VC-015"
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none focus:border-vc-gold"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-bold">Amount (VB):</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  placeholder="Positive integer amount"
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none focus:border-vc-gold font-bold"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-bold">Description / Reason:</label>
                <textarea
                  rows={2}
                  required
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="e.g. Founder discretionary grant, Milestone bonus"
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none focus:border-vc-gold resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={transferSubmitting}
                  className="px-4 py-2 bg-vc-gold hover:bg-yellow-400 text-black font-syne font-bold rounded flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{transferSubmitting ? 'Transferring...' : 'Execute Atomic Transfer'}</span>
                </button>
              </div>
            </form>

            {/* Recent Personal Transfers */}
            <div className="pt-3 border-t border-gray-800 space-y-2">
              <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center justify-between">
                <span>Recent Personal Transfers</span>
                <span className="text-vc-emerald">Live Audit</span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {founderTransfers.length === 0 ? (
                  <p className="text-[11px] text-gray-500 py-1">No personal transfers yet.</p>
                ) : (
                  founderTransfers.slice(0, 5).map((entry) => {
                    const isCredit = entry.to_id === session?.userId;
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center justify-between p-2 bg-black/40 rounded border border-gray-800/80 text-[11px]"
                      >
                        <div className="truncate max-w-[180px]">
                          <span className="text-white font-medium">{entry.reason}</span>
                          <div className="text-[9px] text-gray-400">
                            {isCredit
                              ? `From: ${entry.from_name || entry.from_citizen_code || 'System'}`
                              : `To: ${entry.to_name || entry.to_citizen_code || 'Counterparty'}`}
                          </div>
                        </div>
                        <div className={`font-bold font-syne ${isCredit ? 'text-vc-emerald' : 'text-vc-rose'}`}>
                          {isCredit ? '+' : '-'}{entry.amount.toLocaleString()} VB
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Comprehensive Founder Dossier Modal */}
      {showDossierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0a0f1d] border border-vc-border rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden font-mono">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-gray-800 flex items-center justify-between bg-vc-card">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-vc-gold/10 text-vc-gold rounded-lg border border-vc-gold/30">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base sm:text-lg font-syne font-bold text-white">
                      {companyData?.name} — Founder Dossier
                    </h2>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-vc-gold/20 text-vc-gold font-bold">
                      {companyData?.code}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    Official Executive Dossier & Strategic Operating Secrets
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={companyData?.dossier_url || companyData?.dossier_slug_url || `/dossiers/${companyData?.id}.docx`}
                  download
                  className="bg-vc-gold hover:bg-yellow-400 text-black px-3 py-1.5 rounded text-xs font-bold font-syne flex items-center gap-1.5 shadow transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .docx</span>
                </a>
                <button
                  onClick={() => setShowDossierModal(false)}
                  className="p-1.5 text-gray-400 hover:text-white rounded border border-gray-800 hover:border-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex border-b border-gray-800 bg-gray-950 px-4 overflow-x-auto text-xs">
              {[
                { key: 'letter', label: 'Founder Letter' },
                { key: 'intel', label: 'Secrets & Levers' },
                { key: 'products', label: 'Product Cards' },
                { key: 'obligations', label: 'Obligations & Deadlines' },
                { key: 'dependencies', label: 'Slots & Leads' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setDossierTab(tab.key as any)}
                  className={`py-3 px-4 font-bold border-b-2 whitespace-nowrap transition-colors ${
                    dossierTab === tab.key
                      ? 'border-vc-gold text-vc-gold'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Tab Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed flex-1">
              {dossierTab === 'letter' && (
                <div className="space-y-4">
                  <div className="bg-vc-card border border-vc-border/80 p-4 rounded-lg space-y-2">
                    <div className="text-[10px] text-vc-gold font-bold uppercase tracking-wider">
                      Letter to the Founder
                    </div>
                    <div className="text-gray-200 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed font-sans">
                      {companyData?.founder_letter ||
                        companyData?.documents?.[0]?.body ||
                        'No founder letter recorded.'}
                    </div>
                  </div>
                </div>
              )}

              {dossierTab === 'intel' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-vc-card border border-vc-border p-4 rounded-lg space-y-2">
                      <div className="flex items-center gap-2 text-vc-gold font-bold text-xs uppercase">
                        <Sparkles className="w-4 h-4" />
                        <span>Hidden Strategic Lever</span>
                      </div>
                      <p className="text-gray-300">{companyData?.hidden_lever || 'None recorded'}</p>
                    </div>

                    <div className="bg-vc-card border border-vc-border p-4 rounded-lg space-y-2">
                      <div className="flex items-center gap-2 text-vc-rose font-bold text-xs uppercase">
                        <AlertCircle className="w-4 h-4" />
                        <span>Critical Vulnerability</span>
                      </div>
                      <p className="text-gray-300">{companyData?.vulnerability || 'None recorded'}</p>
                    </div>
                  </div>

                  {(() => {
                    const meta = typeof companyData?.metadata === 'string' ? JSON.parse(companyData?.metadata || '{}') : (companyData?.metadata || {});
                    const facts = meta?.intel_facts || [];
                    if (facts.length === 0) return null;
                    return (
                      <div className="bg-vc-card border border-vc-border p-4 rounded-lg space-y-3">
                        <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                          Intelligence & Private Facts
                        </div>
                        <div className="space-y-2">
                          {facts.slice(1).map((row: string[], idx: number) => (
                            <div key={idx} className="p-2.5 bg-black/40 rounded border border-gray-800 space-y-1">
                              <span className="text-vc-gold font-bold uppercase text-[10px]">{row[0]}</span>
                              <p className="text-gray-300 text-xs">{row[1]}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {dossierTab === 'products' && (
                <div className="space-y-4">
                  {(() => {
                    const meta = typeof companyData?.metadata === 'string' ? JSON.parse(companyData?.metadata || '{}') : (companyData?.metadata || {});
                    const products = meta?.products || [];
                    if (products.length === 0) {
                      return <p className="text-gray-500 py-4 text-center">No product cards specified in catalogue.</p>;
                    }
                    const headers = products[0] || [];
                    const rows = products.slice(1);
                    return (
                      <div className="overflow-x-auto border border-gray-800 rounded-lg">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-gray-900 text-gray-400 uppercase text-[10px] border-b border-gray-800">
                            <tr>
                              {headers.map((h: string, i: number) => (
                                <th key={i} className="py-2.5 px-3">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800 bg-black/30">
                            {rows.map((r: string[], i: number) => (
                              <tr key={i} className="hover:bg-gray-900/40">
                                {r.map((c: string, ci: number) => (
                                  <td key={ci} className={`py-2 px-3 ${ci === 0 ? 'font-bold text-white' : ci === r.length - 1 ? 'text-vc-gold font-bold' : 'text-gray-300'}`}>
                                    {c}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}

              {dossierTab === 'obligations' && (
                <div className="space-y-4">
                  {(() => {
                    const meta = typeof companyData?.metadata === 'string' ? JSON.parse(companyData?.metadata || '{}') : (companyData?.metadata || {});
                    const obligations = meta?.obligations || [];
                    if (obligations.length === 0) {
                      return <p className="text-gray-500 py-4 text-center">No obligations recorded.</p>;
                    }
                    const headers = obligations[0] || [];
                    const rows = obligations.slice(1);
                    return (
                      <div className="overflow-x-auto border border-gray-800 rounded-lg">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-gray-900 text-gray-400 uppercase text-[10px] border-b border-gray-800">
                            <tr>
                              {headers.map((h: string, i: number) => (
                                <th key={i} className="py-2.5 px-3">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-800 bg-black/30">
                            {rows.map((r: string[], i: number) => (
                              <tr key={i} className="hover:bg-gray-900/40">
                                {r.map((c: string, ci: number) => (
                                  <td key={ci} className={`py-2 px-3 ${ci === 0 ? 'font-bold text-white' : 'text-gray-300'}`}>
                                    {c}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}

              {dossierTab === 'dependencies' && (
                <div className="space-y-4">
                  {(() => {
                    const meta = typeof companyData?.metadata === 'string' ? JSON.parse(companyData?.metadata || '{}') : (companyData?.metadata || {});
                    const dependencies = meta?.dependencies || [];
                    const leads = meta?.leads || [];
                    return (
                      <div className="space-y-4">
                        {dependencies.length > 0 && (
                          <div>
                            <div className="text-[10px] text-gray-400 uppercase font-bold mb-2">Slot Dependencies</div>
                            <div className="overflow-x-auto border border-gray-800 rounded-lg">
                              <table className="w-full text-xs text-left">
                                <thead className="bg-gray-900 text-gray-400 uppercase text-[10px] border-b border-gray-800">
                                  <tr>
                                    {dependencies[0]?.map((h: string, i: number) => (
                                      <th key={i} className="py-2.5 px-3">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800 bg-black/30">
                                  {dependencies.slice(1).map((r: string[], i: number) => (
                                    <tr key={i} className="hover:bg-gray-900/40">
                                      {r.map((c: string, ci: number) => (
                                        <td key={ci} className={`py-2 px-3 ${ci === 0 ? 'font-bold text-vc-gold' : 'text-gray-300'}`}>
                                          {c}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {leads.length > 0 && (
                          <div>
                            <div className="text-[10px] text-gray-400 uppercase font-bold mb-2">Commercial Leads</div>
                            <div className="space-y-2">
                              {leads.slice(1).map((r: string[], i: number) => (
                                <div key={i} className="p-3 bg-vc-card border border-vc-border rounded-lg">
                                  <div className="text-vc-gold font-bold uppercase text-[10px]">{r[0]}</div>
                                  <div className="text-gray-300 text-xs mt-1">{r[1]}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-800 bg-vc-card flex items-center justify-between text-xs">
              <span className="text-gray-400">
                Starting Capital Band: <span className="text-vc-gold font-bold">{companyData?.initial_cash} VB</span>
              </span>
              <button
                onClick={() => setShowDossierModal(false)}
                className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded font-bold"
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reusable Styled Modal Dialog */}
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
