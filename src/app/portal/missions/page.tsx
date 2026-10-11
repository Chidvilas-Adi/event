'use client';

import React, { useEffect, useState } from 'react';
import { PortalNav } from '@/components/portal-nav';
import { ClockBanner } from '@/components/ui/clock-banner';
import { StatusChip } from '@/components/ui/status-chip';
import {
  Lock,
  EyeOff,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Coins,
  Cpu,
  Layers,
  Shield,
  Key,
  QrCode,
  MapPin,
  Clock,
  ArrowRight,
  Flame,
  Radio,
  Handshake,
} from 'lucide-react';
import { ModalDialog, ModalDialogProps } from '@/components/ui/modal-dialog';

export default function MissionsPortalPage() {
  const [session, setSession] = useState<any>(null);
  const [missions, setMissions] = useState<any[]>([]);
  const [activeWave, setActiveWave] = useState(1);
  const [currentTick, setCurrentTick] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'claimed' | 'secret' | 'completed'>('all');

  // Modal Dialog State
  const [modalConfig, setModalConfig] = useState<ModalDialogProps>({
    isOpen: false,
    title: '',
    onConfirm: () => {},
  });

  // Verify Modal State
  const [verifyMissionItem, setVerifyMissionItem] = useState<any | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyToken, setVerifyToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifySuccess, setVerifySuccess] = useState<string | null>(null);

  // Peer Handshake Modal State
  const [handshakeTarget, setHandshakeTarget] = useState('');
  const [handshakeSubmitting, setHandshakeSubmitting] = useState(false);
  const [handshakeFeedback, setHandshakeFeedback] = useState<{ success: boolean; msg: string } | null>(null);
  const [participantsList, setParticipantsList] = useState<any[]>([]);

  // Claim Loading
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const loadMissions = async () => {
    try {
      const sessRes = await fetch('/api/auth/session');
      if (sessRes.ok) {
        const s = await sessRes.json();
        setSession(s.user);
      }

      const [res, partRes] = await Promise.all([
        fetch('/api/missions'),
        fetch('/api/participants'),
      ]);
      if (res.ok) {
        const data = await res.json();
        setMissions(data.missions || []);
        setActiveWave(data.activeWave || 1);
        setCurrentTick(data.currentTick || 1);
      }
      if (partRes.ok) {
        const pd = await partRes.json();
        setParticipantsList(pd.participants || []);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateHandshake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyMissionItem?.instance?.id || !handshakeTarget.trim()) return;
    setHandshakeSubmitting(true);
    setHandshakeFeedback(null);
    try {
      const res = await fetch(`/api/missions/${verifyMissionItem.instance.id}/handshake`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetIdentifier: handshakeTarget.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch handshake');

      setHandshakeFeedback({
        success: true,
        msg: data.message || `Handshake dispatched! Key: ${data.code}`,
      });
      if (data.code) {
        setVerifyCode(data.code);
      }
    } catch (err: any) {
      setHandshakeFeedback({ success: false, msg: err.message });
    } finally {
      setHandshakeSubmitting(false);
    }
  };

  useEffect(() => {
    loadMissions();
    const interval = setInterval(loadMissions, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleClaim = async (missionId: string) => {
    setClaimingId(missionId);
    setVerifyError(null);
    setVerifySuccess(null);
    try {
      const res = await fetch(`/api/missions/${missionId}/claim`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to claim mission');
      loadMissions();
    } catch (err: any) {
      setModalConfig({
        isOpen: true,
        title: 'Mission Claim Error',
        message: err.message,
        type: 'alert',
        variant: 'danger',
        confirmLabel: 'Close',
        onConfirm: () => setModalConfig((prev) => ({ ...prev, isOpen: false })),
      });
    } finally {
      setClaimingId(null);
    }
  };

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyMissionItem?.instance?.id) return;
    setVerifying(true);
    setVerifyError(null);
    setVerifySuccess(null);
    try {
      const res = await fetch(`/api/missions/${verifyMissionItem.instance.id}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: verifyCode,
          token: verifyToken,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      setVerifySuccess(data.message || `Mission verified! +${data.rewardVb} VB credited to your ledger.`);
      loadMissions();
      setTimeout(() => {
        setVerifyMissionItem(null);
        setVerifyCode('');
        setVerifyToken('');
      }, 2000);
    } catch (err: any) {
      setVerifyError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  const secretMissionsCount = missions.filter((m) => m.is_secret).length;
  const claimedMissions = missions.filter((m) => m.instance?.status === 'in_progress');
  const completedMissions = missions.filter((m) => m.instance?.status === 'completed');

  const filteredMissions = missions.filter((m) => {
    if (activeTab === 'claimed') return m.instance?.status === 'in_progress';
    if (activeTab === 'completed') return m.instance?.status === 'completed';
    if (activeTab === 'secret') return m.is_secret;
    return true;
  });

  return (
    <div className="min-h-screen bg-vc-bg text-gray-100 flex flex-col pb-24 font-mono">
      <ClockBanner />
      <PortalNav citizenCode={session?.citizenCode} pendingCount={session?.pendingCount} />

      <main className="w-full max-w-lg mx-auto p-4 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-vc-gold" />
            <h1 className="text-xl font-syne font-bold text-white">Mission Registry</h1>
          </div>
          <span className="bg-vc-gold/10 text-vc-gold border border-vc-gold/30 text-[10px] font-bold px-2 py-0.5 rounded tracking-widest uppercase">
            Wave 0{activeWave} Active
          </span>
        </div>

        {/* Rolling Wave Progress Header */}
        <div className="bg-vc-card border border-vc-border rounded-xl p-4 shadow space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 uppercase tracking-wider">10-Tier Simulation Ladder</span>
            <span className="text-vc-gold font-bold">Tick {currentTick} (Round 1)</span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
            <div className={`p-2 rounded border ${activeWave >= 1 ? 'bg-vc-gold/10 border-vc-gold/40 text-vc-gold font-bold' : 'bg-black/30 border-gray-800 text-gray-500'}`}>
              <div>Wave 01</div>
              <div className="text-[9px] font-normal">Tiers 1 - 3</div>
            </div>
            <div className={`p-2 rounded border ${activeWave >= 2 ? 'bg-vc-gold/10 border-vc-gold/40 text-vc-gold font-bold' : 'bg-black/30 border-gray-800 text-gray-500'}`}>
              <div>Wave 02</div>
              <div className="text-[9px] font-normal">Tiers 4 - 6</div>
            </div>
            <div className={`p-2 rounded border ${activeWave >= 3 ? 'bg-vc-gold/10 border-vc-gold/40 text-vc-gold font-bold' : 'bg-black/30 border-gray-800 text-gray-500'}`}>
              <div>Wave 03</div>
              <div className="text-[9px] font-normal">Tiers 7 - 10</div>
            </div>
          </div>
        </div>

        {/* Filter Navigation Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs border-b border-gray-800 pb-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeTab === 'all'
                ? 'bg-vc-gold text-black font-bold'
                : 'text-gray-400 hover:text-white bg-gray-900'
            }`}
          >
            All Missions ({missions.length})
          </button>

          <button
            onClick={() => setActiveTab('claimed')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeTab === 'claimed'
                ? 'bg-vc-gold text-black font-bold'
                : 'text-gray-400 hover:text-white bg-gray-900'
            }`}
          >
            In-Progress ({claimedMissions.length})
          </button>

          {secretMissionsCount > 0 && (
            <button
              onClick={() => setActiveTab('secret')}
              className={`px-3 py-1.5 rounded flex items-center gap-1.5 transition-colors ${
                activeTab === 'secret'
                  ? 'bg-vc-rose text-white font-bold'
                  : 'text-vc-rose border border-vc-rose/30 bg-vc-rose/10 hover:bg-vc-rose/20'
              }`}
            >
              <EyeOff className="w-3.5 h-3.5" />
              <span>Classified ({secretMissionsCount})</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('completed')}
            className={`px-3 py-1.5 rounded transition-colors ${
              activeTab === 'completed'
                ? 'bg-vc-emerald text-black font-bold'
                : 'text-gray-400 hover:text-white bg-gray-900'
            }`}
          >
            Completed ({completedMissions.length})
          </button>
        </div>

        {/* Missions List */}
        {loading ? (
          <div className="space-y-3">
            <div className="h-32 bg-vc-card rounded-xl animate-pulse" />
            <div className="h-32 bg-vc-card rounded-xl animate-pulse" />
          </div>
        ) : filteredMissions.length === 0 ? (
          <div className="bg-vc-card border-2 border-dashed border-gray-800 rounded-xl p-8 text-center text-gray-500">
            No missions found in this category.
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMissions.map((m) => {
              const isClaimed = m.instance?.status === 'in_progress';
              const isCompleted = m.instance?.status === 'completed';

              return (
                <div
                  key={m.id}
                  className={`bg-vc-card border rounded-xl p-4 shadow space-y-3 transition-colors ${
                    m.is_secret
                      ? 'border-vc-rose/40 bg-gradient-to-br from-vc-card to-vc-rose/5'
                      : isCompleted
                      ? 'border-vc-emerald/40'
                      : 'border-vc-border hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border ${
                          m.is_secret
                            ? 'bg-vc-rose/20 text-vc-rose border-vc-rose/40'
                            : 'bg-vc-gold/10 text-vc-gold border-vc-gold/30'
                        }`}>
                          {m.is_secret ? 'CLASSIFIED ROLE INTEL' : `TIER ${m.tier}`}
                        </span>

                        <span className="text-[9px] uppercase text-gray-500 font-mono">
                          {m.verification_method.replace('_', ' ')}
                        </span>
                      </div>

                      <h3 className="text-sm font-syne font-bold text-white">{m.title}</h3>
                    </div>

                    <div className="text-right whitespace-nowrap">
                      <div className="text-sm font-syne font-black text-vc-gold">
                        +{m.reward_vb.toLocaleString()} <span className="text-[10px]">VB</span>
                      </div>
                      {Object.keys(m.reward_resources || {}).length > 0 && (
                        <div className="text-[9px] text-vc-emerald font-bold">
                          +{Object.entries(m.reward_resources).map(([k, v]) => `${v} ${k}`).join(', ')}
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 leading-relaxed">{m.objective}</p>

                  <div className="pt-2 border-t border-gray-800/80 flex items-center justify-between text-xs">
                    <div className="text-[10px] text-gray-500 truncate max-w-[200px]">
                      {m.station_id ? `Station: ${m.station_id}` : m.completion_rule}
                    </div>

                    <div>
                      {isCompleted ? (
                        <span className="flex items-center gap-1 text-vc-emerald font-bold text-[10px] uppercase bg-vc-emerald/10 border border-vc-emerald/30 px-2 py-1 rounded">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Completed</span>
                        </span>
                      ) : isClaimed ? (
                        <button
                          onClick={() => {
                            setVerifyMissionItem(m);
                            setVerifyError(null);
                            setVerifySuccess(null);
                          }}
                          className="bg-vc-emerald hover:bg-emerald-400 text-black font-syne font-bold text-xs px-3 py-1.5 rounded flex items-center gap-1 shadow active:scale-95 transition-transform"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Verify & Payout</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleClaim(m.id)}
                          disabled={claimingId === m.id}
                          className="bg-vc-gold hover:bg-vc-gold-hover text-black font-syne font-bold text-xs px-3.5 py-1.5 rounded flex items-center gap-1 shadow active:scale-95 transition-transform disabled:opacity-50"
                        >
                          <span>{claimingId === m.id ? 'Claiming...' : 'Claim Mission'}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Verification Modal */}
        {verifyMissionItem && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-vc-card border-2 border-vc-gold rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
              <div className="flex items-start justify-between border-b border-gray-800 pb-3">
                <div>
                  <span className="text-[10px] text-vc-gold uppercase tracking-wider font-bold">
                    VERIFICATION PROTOCOL
                  </span>
                  <h3 className="text-base font-syne font-bold text-white mt-0.5">
                    {verifyMissionItem.title}
                  </h3>
                </div>
                <button
                  onClick={() => setVerifyMissionItem(null)}
                  className="text-gray-400 hover:text-white p-1 text-xs"
                >
                  ✕
                </button>
              </div>

              {verifySuccess ? (
                <div className="p-4 bg-vc-emerald/10 border border-vc-emerald/30 text-vc-emerald rounded-lg text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 mx-auto" />
                  <div className="font-bold text-sm">{verifySuccess}</div>
                </div>
              ) : (
                <form onSubmit={handleVerifySubmit} className="space-y-4">
                  {verifyError && (
                    <div className="p-3 bg-vc-rose/10 border border-vc-rose/30 text-vc-rose rounded text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{verifyError}</span>
                    </div>
                  )}

                  {/* Instructions per method */}
                  {verifyMissionItem.verification_method === 'system_checked' && (
                    <div className="p-3 bg-black/40 border border-gray-800 rounded space-y-2 text-xs">
                      <div className="text-gray-300 font-bold">Automated Database Check:</div>
                      <p className="text-gray-400">{verifyMissionItem.completion_rule}</p>
                      <p className="text-[11px] text-vc-gold">
                        Click 'Submit Verification' below. The engine will instantly query the ledger and credit rewards if met.
                      </p>
                    </div>
                  )}

                  {verifyMissionItem.verification_method === 'counterparty_code' && (
                    <div className="space-y-3">
                      {/* Sub-section: Initiate Peer Handshake with another Citizen */}
                      <div className="bg-gray-900/80 border border-gray-800 p-3 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-vc-gold flex items-center gap-1.5">
                            <Handshake className="w-3.5 h-3.5" />
                            <span>Request Peer Handshake Attestation</span>
                          </span>
                          <span className="text-[10px] text-gray-500">CO-ATTESTATION</span>
                        </div>
                        <p className="text-[11px] text-gray-400">
                          Notify the peer citizen (or founder) you coordinated with. A unique verification key will be sent to their Citizen Inbox so they can attest directly or give you the key.
                        </p>

                        <div className="flex gap-2 pt-1">
                          <select
                            value={handshakeTarget}
                            onChange={(e) => setHandshakeTarget(e.target.value)}
                            className="flex-1 bg-black/60 border border-gray-700 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                          >
                            <option value="">Select Citizen / Counterparty...</option>
                            {participantsList
                              .filter((p) => p.id !== session?.userId)
                              .map((p) => (
                                <option key={p.id} value={p.citizen_code || p.id}>
                                  {p.name} [{p.citizen_code}]
                                </option>
                              ))}
                          </select>
                          <button
                            type="button"
                            onClick={handleInitiateHandshake}
                            disabled={handshakeSubmitting || !handshakeTarget}
                            className="bg-vc-blue hover:bg-blue-600 disabled:opacity-50 text-white font-syne font-bold text-xs px-3 py-1.5 rounded transition-all whitespace-nowrap"
                          >
                            {handshakeSubmitting ? 'Sending...' : 'Send Key Request'}
                          </button>
                        </div>

                        {handshakeFeedback && (
                          <div
                            className={`p-2 rounded text-[11px] font-mono mt-1 ${
                              handshakeFeedback.success
                                ? 'bg-vc-emerald/10 border border-vc-emerald/30 text-vc-emerald'
                                : 'bg-vc-rose/10 border border-vc-rose/30 text-vc-rose'
                            }`}
                          >
                            {handshakeFeedback.msg}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-gray-400 mb-1 font-bold">
                          Enter Counterparty Verification Code:
                        </label>
                        <input
                          type="text"
                          value={verifyCode}
                          onChange={(e) => setVerifyCode(e.target.value)}
                          placeholder="e.g. CP-677BBF or CUST-ANCHOR-2026"
                          className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white uppercase tracking-wider font-mono"
                          required
                        />
                        <p className="text-[10px] text-gray-500 mt-1">
                          Obtain this code from your counterparty or the station liaison to complete verification.
                        </p>
                      </div>
                    </div>
                  )}

                  {verifyMissionItem.verification_method === 'scan_token' && (
                    <div>
                      <label className="block text-gray-400 mb-1 font-bold">
                        Enter Station Corridor Token:
                      </label>
                      <input
                        type="text"
                        value={verifyToken}
                        onChange={(e) => setVerifyToken(e.target.value)}
                        placeholder="e.g. LOG-CORRIDOR-90"
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white uppercase tracking-wider"
                        required
                      />
                      <p className="text-[10px] text-gray-500 mt-1">
                        Enter the physical token card number provided at the station desk.
                      </p>
                    </div>
                  )}

                  {verifyMissionItem.verification_method === 'station_checkin' && (
                    <div className="p-3 bg-black/40 border border-gray-800 rounded space-y-2 text-xs">
                      <div className="text-vc-gold font-bold flex items-center gap-1.5">
                        <MapPin className="w-4 h-4" />
                        <span>Physical Station Check-in Required</span>
                      </div>
                      <p className="text-gray-300 leading-relaxed">
                        Please present your Citizen Pass (<strong>{session?.citizenCode}</strong>) at the{' '}
                        <strong className="text-white uppercase">{verifyMissionItem.station_id || 'station'}</strong>{' '}
                        desk in the hall. The desk volunteer will confirm your check-in directly on their console.
                      </p>
                    </div>
                  )}

                  {verifyMissionItem.verification_method === 'multi_party' && (
                    <div className="p-3 bg-black/40 border border-gray-800 rounded space-y-2 text-xs">
                      <div className="text-vc-blue font-bold">Consortium Syndicate Multi-Party Attestation:</div>
                      <p className="text-gray-400">
                        Requires joint verification between venture lead and the institution desk operator.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                    <button
                      type="button"
                      onClick={() => setVerifyMissionItem(null)}
                      className="px-3 py-1.5 text-gray-400 hover:text-white"
                    >
                      Close
                    </button>

                    <button
                      type="submit"
                      disabled={verifying}
                      className="bg-vc-gold hover:bg-vc-gold-hover text-black font-syne font-bold text-xs px-4 py-2 rounded uppercase"
                    >
                      {verifying ? 'Verifying...' : 'Submit Verification'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Modal Dialog */}
        <ModalDialog {...modalConfig} />
      </main>
    </div>
  );
}
