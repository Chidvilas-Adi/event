'use client';

import React, { useEffect, useState } from 'react';
import { PortalNav } from '@/components/portal-nav';
import { ClockBanner } from '@/components/ui/clock-banner';
import {
  Inbox,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Handshake,
  PlusCircle,
  ArrowRight,
  Send,
  FileText,
} from 'lucide-react';
import { ModalDialog } from '@/components/ui/modal-dialog';

export default function InboxPage() {
  const [session, setSession] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; success: boolean; msg: string } | null>(null);

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

  // New Deal Modal
  const [showDealModal, setShowDealModal] = useState(false);
  const [dealTemplate, setDealTemplate] = useState('freelance');
  const [dealRecipientType, setDealRecipientType] = useState('company');
  const [dealRecipientId, setDealRecipientId] = useState('');
  const [dealTerms, setDealTerms] = useState<any>({ rate: 300, scope: 'Contract specialist services' });
  const [dealSubmitting, setDealSubmitting] = useState(false);

  // Entities for Dropdown
  const [companies, setCompanies] = useState<any[]>([]);
  const [participants, setParticipants] = useState<any[]>([]);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [attestingId, setAttestingId] = useState<string | null>(null);

  // Counter Modal
  const [counterDealId, setCounterDealId] = useState<string | null>(null);
  const [counterTerms, setCounterTerms] = useState<any>({});
  const [counterSubmitting, setCounterSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const sessRes = await fetch('/api/auth/session');
      if (sessRes.ok) {
        const s = await sessRes.json();
        setSession(s.user);
      }

      const txRes = await fetch('/api/ledger/transfer');
      if (txRes.ok) {
        const d = await txRes.json();
        setTransactions(d.transactions || []);
      }

      const dealsRes = await fetch('/api/deals');
      if (dealsRes.ok) {
        const dd = await dealsRes.json();
        setDeals(dd.deals || []);
      }

      const notifRes = await fetch('/api/notifications');
      if (notifRes.ok) {
        const nd = await notifRes.json();
        setNotifications(nd.notifications || []);
      }

      const [compRes, partRes, instRes] = await Promise.all([
        fetch('/api/companies'),
        fetch('/api/participants'),
        fetch('/api/institutions'),
      ]);
      if (compRes.ok) {
        const cd = await compRes.json();
        setCompanies(cd.companies || []);
      }
      if (partRes.ok) {
        const pd = await partRes.json();
        setParticipants(pd.participants || []);
      }
      if (instRes.ok) {
        const id = await instRes.json();
        setInstitutions(id || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleTxAction = async (txId: string, action: 'accept' | 'reject') => {
    setActionLoading(txId);
    setFeedback(null);
    try {
      const res = await fetch(`/api/ledger/transfer/${txId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action failed');

      setFeedback({
        id: txId,
        success: true,
        msg: action === 'accept' ? 'Transfer accepted and funds committed to your wallet!' : 'Transfer declined.',
      });

      await loadData();
    } catch (err: any) {
      setFeedback({ id: txId, success: false, msg: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDealAction = (dealId: string, action: 'accept' | 'reject') => {
    setDialogConfig({
      isOpen: true,
      title: `Confirm Deal ${action.toUpperCase()}`,
      message: `Are you sure you want to ${action.toUpperCase()} this deal proposal?`,
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
          if (!res.ok) throw new Error(data.error || 'Deal action failed');

          setDialogConfig({
            isOpen: true,
            title: `Deal ${action === 'accept' ? 'Ratified' : 'Rejected'}`,
            message: `Deal proposal successfully ${action}ed!`,
            type: 'alert',
            variant: action === 'accept' ? 'emerald' : 'gold',
            onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
          });
          await loadData();
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
          reason: 'Citizen counter-proposal terms adjustment',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Counter failed');

      setCounterDealId(null);
      setDialogConfig({
        isOpen: true,
        title: 'Counter-Offer Dispatched',
        message: `Counter-offer submitted as Version ${data.version}!`,
        type: 'alert',
        variant: 'emerald',
        onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
      });
      await loadData();
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
    setDealSubmitting(true);
    try {
      const res = await fetch('/api/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateType: dealTemplate,
          recipientType: dealRecipientType,
          recipientId: dealRecipientId,
          terms: dealTerms,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Deal proposal failed');

      setShowDealModal(false);
      setDialogConfig({
        isOpen: true,
        title: 'Deal Proposal Dispatched',
        message: 'Deal proposal dispatched to counterparty for review!',
        type: 'alert',
        variant: 'emerald',
        onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
      });
      await loadData();
    } catch (err: any) {
      setDialogConfig({
        isOpen: true,
        title: 'Proposal Error',
        message: err.message,
        type: 'alert',
        variant: 'danger',
        onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
      });
    } finally {
      setDealSubmitting(false);
    }
  };

  const handleAttestHandshake = async (instanceId: string) => {
    setAttestingId(instanceId);
    try {
      const res = await fetch(`/api/missions/${instanceId}/attest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to attest handshake');

      setFeedback({
        id: instanceId,
        success: true,
        msg: data.message || 'Peer mission handshake successfully confirmed & attested!',
      });
      await loadData();
    } catch (err: any) {
      setFeedback({ id: instanceId, success: false, msg: err.message });
    } finally {
      setAttestingId(null);
    }
  };

  const isUserSender = (d: any) =>
    d.sender_id === session?.userId ||
    (session?.companyId && d.sender_type === 'company' && d.sender_id === session.companyId);

  const pendingIncomingTx = transactions.filter(
    (t) => t.recipient_id === session?.userId && t.status === 'pending_confirmation'
  );

  const pendingIncomingDeals = deals.filter(
    (d) =>
      (d.recipient_id === session?.userId ||
        (session?.companyId && d.recipient_type === 'company' && d.recipient_id === session.companyId)) &&
      d.status === 'proposed' &&
      !isUserSender(d)
  );

  const pendingOutgoingDeals = deals.filter(
    (d) => isUserSender(d) && d.status === 'proposed'
  );

  const pendingHandshakes = notifications.filter(
    (n) => n.type === 'peer_mission_handshake' && !n.is_read
  );

  const otherNotifs = notifications.filter(
    (n) => n.type !== 'peer_mission_handshake' && !n.is_read
  );

  const totalPending = pendingIncomingTx.length + pendingIncomingDeals.length + pendingHandshakes.length;

  return (
    <div className="min-h-screen bg-vc-bg text-gray-100 flex flex-col pb-24">
      <ClockBanner />
      <PortalNav citizenCode={session?.citizenCode} pendingCount={totalPending} />

      <main className="w-full max-w-lg mx-auto p-4 space-y-5">
        <div className="flex items-center justify-between font-mono">
          <div className="flex items-center gap-2">
            <Inbox className="w-5 h-5 text-vc-gold" />
            <h1 className="text-xl font-syne font-bold text-white">Citizen Inbox & Deals</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDealModal(true)}
              className="bg-vc-gold text-black px-2.5 py-1 rounded text-xs font-syne font-bold flex items-center gap-1 shadow"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Propose Deal</span>
            </button>
            <button
              onClick={loadData}
              className="text-gray-400 hover:text-white transition-colors p-1"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Feedback Banner */}
        {feedback && (
          <div
            className={`p-3 rounded text-xs font-mono flex items-center gap-2 ${
              feedback.success
                ? 'bg-vc-emerald/10 border border-vc-emerald/30 text-vc-emerald'
                : 'bg-vc-rose/10 border border-vc-rose/30 text-vc-rose'
            }`}
          >
            {feedback.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{feedback.msg}</span>
          </div>
        )}

        {/* 0. Peer Mission Handshake Attestations */}
        {pendingHandshakes.length > 0 && (
          <div className="space-y-3 font-mono">
            <div className="flex items-center justify-between text-xs text-gray-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5 text-vc-blue font-bold">
                <Handshake className="w-4 h-4" />
                <span>Peer Mission Attestations ({pendingHandshakes.length})</span>
              </span>
              <span className="text-[10px] text-vc-blue font-bold">CO-VALIDATION</span>
            </div>

            {pendingHandshakes.map((n) => {
              const payload = n.payload || {};
              return (
                <div
                  key={n.id}
                  className="bg-vc-card border-2 border-vc-blue/60 rounded-xl p-4 shadow-lg space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[10px] uppercase text-gray-400">Collaboration Request</div>
                      <div className="text-sm font-syne font-bold text-white">
                        {payload.missionTitle || 'Peer Verification Mission'}
                      </div>
                      <div className="text-xs text-vc-gold mt-0.5">
                        Initiator: {payload.senderName || 'Peer Citizen'}{' '}
                        <span className="text-gray-400">[{payload.senderCitizenCode || 'VC'}]</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-black/50 p-2.5 rounded border border-gray-800 space-y-1">
                    <div className="text-[10px] text-gray-400 uppercase">Verification Handshake Key:</div>
                    <div className="font-mono text-sm font-bold text-vc-gold tracking-widest">
                      {payload.code || 'CP-VALID'}
                    </div>
                  </div>

                  <button
                    onClick={() => handleAttestHandshake(payload.instanceId)}
                    disabled={attestingId === payload.instanceId}
                    className="w-full py-2 rounded bg-vc-blue hover:bg-blue-600 text-white font-syne font-bold text-xs uppercase shadow flex items-center justify-center gap-1.5 transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{attestingId === payload.instanceId ? 'Attesting...' : 'Confirm Handshake & Attest'}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* 1. Deals Requiring Signature / Action */}
        <div className="space-y-3 font-mono">
          <div className="flex items-center justify-between text-xs text-gray-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Handshake className="w-4 h-4 text-vc-gold" />
              <span>Incoming Deals Requiring Signature ({pendingIncomingDeals.length})</span>
            </span>
            <span className="text-[10px] text-vc-gold">ACTION REQUIRED</span>
          </div>

          {pendingIncomingDeals.length === 0 ? (
            <div className="bg-vc-card border border-vc-border rounded-xl p-4 text-center text-xs text-gray-500">
              No pending deal proposals awaiting your signature.
            </div>
          ) : (
            pendingIncomingDeals.map((d) => (
              <div
                key={d.id}
                className="bg-vc-card border-2 border-vc-gold/50 rounded-xl p-4 shadow-lg space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[10px] uppercase text-gray-400">Proposal Template</div>
                    <div className="text-base font-syne font-bold text-white uppercase text-vc-gold">
                      {d.template_type} <span className="text-xs text-vc-blue font-normal">(v{d.version})</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      From: {d.sender_company_name || d.sender_participant_name || d.sender_id}
                    </div>
                  </div>
                </div>

                <div className="bg-black/40 p-2.5 rounded border border-gray-800 text-xs text-gray-300 font-mono text-[11px]">
                  {JSON.stringify(d.terms, null, 2)}
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    onClick={() => handleDealAction(d.id, 'reject')}
                    disabled={actionLoading === d.id}
                    className="flex items-center justify-center gap-1 py-1.5 rounded bg-vc-rose/10 hover:bg-vc-rose/20 text-vc-rose border border-vc-rose/30 text-xs font-bold uppercase"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Decline</span>
                  </button>
                  <button
                    onClick={() => {
                      setCounterDealId(d.id);
                      setCounterTerms(d.terms || {});
                    }}
                    className="flex items-center justify-center gap-1 py-1.5 rounded bg-vc-blue/10 hover:bg-vc-blue/20 text-vc-blue border border-vc-blue/30 text-xs font-bold uppercase"
                  >
                    <span>Counter</span>
                  </button>
                  <button
                    onClick={() => handleDealAction(d.id, 'accept')}
                    disabled={actionLoading === d.id}
                    className="flex items-center justify-center gap-1 py-1.5 rounded bg-vc-gold hover:bg-yellow-400 text-black text-xs font-syne font-bold uppercase shadow"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Accept</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 1b. Outgoing Proposals Dispatched */}
        {pendingOutgoingDeals.length > 0 && (
          <div className="space-y-3 font-mono">
            <div className="flex items-center justify-between text-xs text-gray-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5 text-gray-300">
                <Send className="w-4 h-4 text-vc-blue" />
                <span>Outgoing Proposals Sent ({pendingOutgoingDeals.length})</span>
              </span>
              <span className="text-[10px] text-gray-500">PENDING COUNTERPARTY</span>
            </div>

            {pendingOutgoingDeals.map((d) => (
              <div
                key={d.id}
                className="bg-vc-card border border-vc-border rounded-xl p-4 shadow space-y-2.5 opacity-90"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[10px] uppercase text-gray-400">Template: {d.template_type} (v{d.version})</div>
                    <div className="text-sm font-syne font-bold text-white">
                      Recipient: <span className="text-vc-gold">{d.recipient_company_name || d.recipient_participant_name || d.recipient_id}</span>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-vc-gold/10 text-vc-gold border border-vc-gold/30">
                    Awaiting Review
                  </span>
                </div>

                <div className="bg-black/30 p-2 rounded border border-gray-800 text-[11px] text-gray-400 font-mono">
                  {JSON.stringify(d.terms)}
                </div>

                <div className="text-[10px] text-gray-500 italic">
                  Waiting for recipient counterparty to accept, counter, or decline.
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 2. Direct Transfers Requiring Confirmation */}
        <div className="space-y-3 font-mono">
          <div className="flex items-center justify-between text-xs text-gray-400 uppercase tracking-wider">
            <span>Direct Transfers ({pendingIncomingTx.length})</span>
            <span className="text-[10px] text-gray-500">WALLET TRANSFER</span>
          </div>

          {pendingIncomingTx.length === 0 ? (
            <div className="bg-vc-card border border-vc-border rounded-xl p-4 text-center text-xs text-gray-500">
              No pending direct incoming wallet transfers.
            </div>
          ) : (
            pendingIncomingTx.map((tx) => (
              <div
                key={tx.id}
                className="bg-vc-card border-2 border-vc-gold/40 rounded-xl p-4 shadow space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-[10px] uppercase text-gray-400">Incoming From</div>
                    <div className="text-base font-syne font-bold text-white">
                      {tx.sender_name || tx.sender_id}{' '}
                      <span className="text-xs font-mono text-vc-gold font-normal">
                        [{tx.sender_citizen_code || 'VC'}]
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-syne font-black text-vc-emerald">
                      +{tx.value.toLocaleString()} VB
                    </div>
                  </div>
                </div>

                <div className="bg-black/40 p-2.5 rounded border border-gray-800 text-xs text-gray-300">
                  <span className="text-gray-500 text-[10px] uppercase block mb-0.5">Stated Reason:</span>
                  &ldquo;{tx.metadata?.reason || 'No description provided'}&rdquo;
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => handleTxAction(tx.id, 'reject')}
                    disabled={actionLoading === tx.id}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded bg-vc-rose/10 hover:bg-vc-rose/20 text-vc-rose border border-vc-rose/30 text-xs font-bold uppercase transition-all"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Decline</span>
                  </button>
                  <button
                    onClick={() => handleTxAction(tx.id, 'accept')}
                    disabled={actionLoading === tx.id}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded bg-vc-gold hover:bg-yellow-400 text-black text-xs font-syne font-bold uppercase shadow transition-all active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{actionLoading === tx.id ? 'Processing...' : 'Accept Transfer'}</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Propose Deal Modal */}
      {showDealModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-vc-card border border-vc-border rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="font-syne font-bold text-white text-base">Propose Deal (Citizen)</h3>
              <button onClick={() => setShowDealModal(false)} className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleProposeDeal} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-gray-400 mb-1 font-bold">Deal Template:</label>
                <select
                  value={dealTemplate}
                  onChange={(e) => {
                    const t = e.target.value;
                    setDealTemplate(t);
                    if (t === 'freelance') {
                      setDealTerms({ rate: 300, scope: 'Technical advisory services' });
                    } else if (t === 'employment') {
                      setDealTerms({ salary: 100, role_title: 'Lead Engineer' });
                    } else if (t === 'information_trade') {
                      setDealTerms({ price: 500, intel_scope: 'Market analysis briefing' });
                    } else {
                      setDealTerms({ price: 1000, description: 'Commercial agreement' });
                    }
                  }}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                >
                  <option value="freelance">Freelance Specialist</option>
                  <option value="employment">Employment Contract</option>
                  <option value="information_trade">Information Trade</option>
                  <option value="sale">General Sale / Service</option>
                  <option value="resource_trade">Resource Trade</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1 font-bold">Target Category:</label>
                  <select
                    value={dealRecipientType}
                    onChange={(e) => {
                      const t = e.target.value;
                      setDealRecipientType(t);
                      if (t === 'company') {
                        setDealRecipientId(companies[0]?.id || '');
                      } else if (t === 'participant') {
                        const other = participants.find((p) => p.id !== session?.id && p.id !== session?.userId);
                        setDealRecipientId(other?.id || '');
                      } else if (t === 'institution') {
                        setDealRecipientId('bank');
                      }
                    }}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  >
                    <option value="company">Venture Company</option>
                    <option value="participant">Citizen / Participant</option>
                    <option value="institution">Institution Desk</option>
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
                      <option value="">-- Select Venture Company --</option>
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
                      className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-xs"
                      required
                    >
                      <option value="">-- Select Citizen (VC-ID) --</option>
                      {participants
                        .filter((p) => p.id !== session?.id && p.id !== session?.userId)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.citizen_code} — {p.name} {p.company_name ? `(${p.company_name})` : '(Free Agent)'}
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
                      <option value="">-- Select Institution Desk --</option>
                      {institutions.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name} ({i.id})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-bold">Terms (JSON):</label>
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
                  {dealSubmitting ? 'Dispatching...' : 'Dispatch Proposal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Counter Modal */}
      {counterDealId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-vc-card border border-vc-border rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="font-syne font-bold text-white text-base">Submit Counter-Offer (Version N+1)</h3>
              <button onClick={() => setCounterDealId(null)} className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCounterSubmit} className="space-y-4 text-xs font-mono">
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
                  {counterSubmitting ? 'Dispatching...' : 'Submit Counter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Styled In-App Modal Dialog */}
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
