'use client';

import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Lock,
  Unlock,
  EyeOff,
  Coins,
  CheckCircle2,
  AlertTriangle,
  Play,
  Plus,
  RefreshCw,
  Users,
  Search,
  Edit2,
  Trash2,
  X,
} from 'lucide-react';
import { ModalDialog, ModalDialogProps } from '@/components/ui/modal-dialog';

export default function GmMissionsPage() {
  const [missions, setMissions] = useState<any[]>([]);
  const [activeWave, setActiveWave] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal Dialog State
  const [modalConfig, setModalConfig] = useState<ModalDialogProps>({
    isOpen: false,
    title: '',
    onConfirm: () => {},
  });

  // New Mission Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [tier, setTier] = useState('1');
  const [wave, setWave] = useState('1');
  const [objective, setObjective] = useState('');
  const [method, setMethod] = useState('system_checked');
  const [completionRule, setCompletionRule] = useState('');
  const [rewardVb, setRewardVb] = useState('500');
  const [stationId, setStationId] = useState('');
  const [isSecret, setIsSecret] = useState(false);
  const [secretRole, setSecretRole] = useState('');
  const [verificationSecret, setVerificationSecret] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Mission Modal
  const [editingMission, setEditingMission] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTier, setEditTier] = useState('1');
  const [editWave, setEditWave] = useState('1');
  const [editObjective, setEditObjective] = useState('');
  const [editMethod, setEditMethod] = useState('system_checked');
  const [editCompletionRule, setEditCompletionRule] = useState('');
  const [editRewardVb, setEditRewardVb] = useState('500');
  const [editStationId, setEditStationId] = useState('');
  const [editIsSecret, setEditIsSecret] = useState(false);
  const [editSecretRole, setEditSecretRole] = useState('');
  const [editVerificationSecret, setEditVerificationSecret] = useState('');
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setRefreshing(true);
      const res = await fetch('/api/missions');
      if (res.ok) {
        const d = await res.json();
        setMissions(d.missions || []);
        setActiveWave(d.activeWave || 1);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateMission = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          tier: parseInt(tier, 10) || 1,
          wave: parseInt(wave, 10) || 1,
          objective: objective.trim(),
          verificationMethod: method,
          completionRule: completionRule.trim() || 'Auto verification upon condition fulfillment',
          rewardVb: parseInt(rewardVb, 10) || 0,
          stationId: stationId.trim() || undefined,
          isSecret,
          secretRole: secretRole.trim() || undefined,
          verificationSecret: verificationSecret.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch mission');

      setShowCreateModal(false);
      setTitle('');
      setTier('1');
      setWave('1');
      setObjective('');
      setRewardVb('500');
      setStationId('');
      setIsSecret(false);
      setSecretRole('');
      setVerificationSecret('');
      loadData();
    } catch (err: any) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (m: any) => {
    setEditingMission(m);
    setEditTitle(m.title || '');
    setEditTier(String(m.tier || 1));
    setEditWave(String(m.wave || 1));
    setEditObjective(m.objective || '');
    setEditMethod(m.verification_method || 'system_checked');
    setEditCompletionRule(m.completion_rule || '');
    setEditRewardVb(String(m.reward_vb || 0));
    setEditStationId(m.station_id || '');
    setEditIsSecret(Boolean(m.is_secret));
    setEditSecretRole(m.secret_role || '');
    setEditVerificationSecret(m.verification_secret || '');
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMission) return;
    setEditing(true);
    setEditError(null);
    try {
      const res = await fetch('/api/missions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingMission.id,
          title: editTitle.trim(),
          tier: parseInt(editTier, 10) || 1,
          wave: parseInt(editWave, 10) || 1,
          objective: editObjective.trim(),
          verificationMethod: editMethod,
          completionRule: editCompletionRule.trim() || 'Auto verification upon condition fulfillment',
          rewardVb: parseInt(editRewardVb, 10) || 0,
          stationId: editStationId.trim() || null,
          isSecret: editIsSecret,
          secretRole: editSecretRole.trim() || null,
          verificationSecret: editVerificationSecret.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update mission');

      setEditingMission(null);
      loadData();
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setEditing(false);
    }
  };

  const handleDeleteMission = (m: any) => {
    setModalConfig({
      isOpen: true,
      title: 'Delete Mission Directive',
      message: `Are you sure you want to permanently delete mission "${m.title}" (${m.id})? This will delete all active and completed instances.`,
      type: 'confirm',
      variant: 'danger',
      confirmLabel: 'Delete Mission',
      cancelLabel: 'Cancel',
      onCancel: () => setModalConfig((prev) => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch(`/api/missions?id=${encodeURIComponent(m.id)}`, {
            method: 'DELETE',
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to delete mission');

          loadData();
        } catch (err: any) {
          setModalConfig({
            isOpen: true,
            title: 'Delete Failed',
            message: err.message,
            type: 'alert',
            variant: 'danger',
            confirmLabel: 'Close',
            onConfirm: () => setModalConfig((prev) => ({ ...prev, isOpen: false })),
          });
        }
      },
    });
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-vc-gold" />
            <h1 className="text-2xl font-syne font-black text-white">MISSION & OPPORTUNITY CONTROL</h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Oversee the 10-tier mission ladder, manage rolling wave releases, and monitor classified role directives.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-vc-gold hover:bg-vc-gold-hover text-black font-syne font-bold text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Mission</span>
          </button>

          <button
            onClick={loadData}
            disabled={refreshing}
            className="p-2 bg-gray-900 hover:bg-gray-800 text-gray-300 rounded border border-gray-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Wave Release Status Banner */}
      <div className="bg-vc-card border border-vc-border rounded-xl p-5 shadow space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Unlock className="w-4 h-4 text-vc-gold" />
            <h2 className="text-sm font-syne font-bold text-white uppercase">
              Rolling Wave Deployment Status
            </h2>
          </div>
          <span className="text-xs text-vc-gold font-bold">Currently Active: Wave {activeWave}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className={`p-3 rounded-lg border ${activeWave >= 1 ? 'bg-vc-gold/10 border-vc-gold/30 text-white' : 'bg-gray-900 border-gray-800 text-gray-500'}`}>
            <div className="font-bold flex items-center justify-between">
              <span>Wave 01: Onboarding</span>
              <span className="text-[10px] text-vc-gold uppercase">{activeWave >= 1 ? 'DEPLOYED' : 'PENDING'}</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Tiers 1 to 3 (Pass staking, material intake, anchor handshakes)</p>
          </div>

          <div className={`p-3 rounded-lg border ${activeWave >= 2 ? 'bg-vc-gold/10 border-vc-gold/30 text-white' : 'bg-gray-900 border-gray-800 text-gray-500'}`}>
            <div className="font-bold flex items-center justify-between">
              <span>Wave 02: Expansion</span>
              <span className="text-[10px] text-vc-gold uppercase">{activeWave >= 2 ? 'DEPLOYED' : 'PENDING'}</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Tiers 4 to 6 (Logistics corridors, consortium syndicates, grid resiliency)</p>
          </div>

          <div className={`p-3 rounded-lg border ${activeWave >= 3 ? 'bg-vc-gold/10 border-vc-gold/30 text-white' : 'bg-gray-900 border-gray-800 text-gray-500'}`}>
            <div className="font-bold flex items-center justify-between">
              <span>Wave 03: Scale-up</span>
              <span className="text-[10px] text-vc-gold uppercase">{activeWave >= 3 ? 'DEPLOYED' : 'PENDING'}</span>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">Tiers 7 to 10 (Talent retainers, civic tenders, syndicate rounds, grand exit)</p>
          </div>
        </div>
      </div>

      {/* Mission Roster Table */}
      <div className="bg-vc-card border border-vc-border rounded-xl p-6 shadow space-y-4">
        <div className="flex items-center justify-between border-b border-gray-800 pb-3">
          <h2 className="text-base font-syne font-bold text-white uppercase">
            Simulation Missions Docket ({missions.length})
          </h2>
          <span className="text-xs text-gray-400">10-Tier Ladder & Role Intels</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading missions...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="text-[10px] text-gray-400 uppercase bg-gray-900/60 border-b border-gray-800">
                <tr>
                  <th className="py-2.5 px-3">Tier / Wave</th>
                  <th className="py-2.5 px-3">Mission Title</th>
                  <th className="py-2.5 px-3">Verification Method</th>
                  <th className="py-2.5 px-3">Station / Target</th>
                  <th className="py-2.5 px-3">Secret Role</th>
                  <th className="py-2.5 px-3 text-right">Reward VB</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {missions.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-900/30">
                    <td className="py-3 px-3 font-bold">
                      <span className={`px-2 py-0.5 rounded text-[10px] uppercase ${
                        m.is_secret
                          ? 'bg-vc-rose/20 text-vc-rose border border-vc-rose/40'
                          : 'bg-vc-gold/10 text-vc-gold border border-vc-gold/30'
                      }`}>
                        {m.is_secret ? 'Secret' : `Tier ${m.tier} · W${m.wave}`}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-medium text-white max-w-xs">
                      <div className="font-bold">{m.title}</div>
                      <div className="text-[10px] text-gray-400 truncate mt-0.5">{m.objective}</div>
                    </td>
                    <td className="py-3 px-3 uppercase text-[10px] font-mono text-cyan-400">
                      {(m.verification_method || 'system_checked').replace('_', ' ')}
                    </td>
                    <td className="py-3 px-3 text-gray-300">
                      {m.station_id || 'Global'}
                    </td>
                    <td className="py-3 px-3 text-purple-400 font-bold">
                      {m.secret_role || 'Public'}
                    </td>
                    <td className="py-3 px-3 text-right text-vc-gold font-bold font-syne">
                      +{(m.reward_vb || 0).toLocaleString()} VB
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(m)}
                          className="p-1.5 bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-white rounded border border-gray-800"
                          title="Edit Mission"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteMission(m)}
                          className="p-1.5 bg-gray-900 hover:bg-gray-800 text-gray-400 hover:text-vc-rose rounded border border-gray-800"
                          title="Delete Mission"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Mission Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-vc-card border-2 border-vc-gold rounded-xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-base font-syne font-bold text-white uppercase">
                Dispatch New Simulation Mission
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                ✕
              </button>
            </div>

            {createError && (
              <div className="p-3 bg-vc-rose/10 border border-vc-rose/30 text-vc-rose rounded text-xs">
                <span>{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreateMission} className="space-y-4">
              <div>
                <label className="block text-gray-400 mb-1 font-bold">Mission Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Rare Element Extraction Sprint"
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-gray-400 mb-1 font-bold">Tier (1-10):</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={tier}
                    onChange={(e) => setTier(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1 font-bold">Wave (1-3):</label>
                  <input
                    type="number"
                    min="1"
                    max="3"
                    value={wave}
                    onChange={(e) => setWave(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1 font-bold">Reward (VB):</label>
                  <input
                    type="number"
                    value={rewardVb}
                    onChange={(e) => setRewardVb(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-bold">Objective & Narrative *</label>
                <textarea
                  rows={2}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  placeholder="State the instructions and verifiable goal..."
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-400 mb-1 font-bold">Verification Method:</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  >
                    <option value="system_checked">System Checked</option>
                    <option value="station_checkin">Station Desk Check-in</option>
                    <option value="counterparty_code">Counterparty Exchange</option>
                    <option value="secret_role">Secret Role Action</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1 font-bold">Station Desk (Optional):</label>
                  <input
                    type="text"
                    value={stationId}
                    onChange={(e) => setStationId(e.target.value)}
                    placeholder="e.g. logistics, bank, registry"
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 pt-4">
                  <input
                    type="checkbox"
                    id="isSecretCheckbox"
                    checked={isSecret}
                    onChange={(e) => setIsSecret(e.target.checked)}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <label htmlFor="isSecretCheckbox" className="text-gray-300 font-bold text-xs">
                    Classified / Secret Mission
                  </label>
                </div>
                {isSecret && (
                  <div>
                    <label className="block text-gray-400 mb-1 font-bold">Secret Role:</label>
                    <input
                      type="text"
                      value={secretRole}
                      onChange={(e) => setSecretRole(e.target.value)}
                      placeholder="e.g. Infiltrator, Whistleblower"
                      className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="bg-vc-gold hover:bg-vc-gold-hover text-black font-syne font-bold text-xs px-4 py-2 rounded uppercase"
                >
                  {creating ? 'Dispatching...' : 'Dispatch Mission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Mission Modal */}
      {editingMission && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-vc-card border-2 border-vc-gold/40 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-base font-syne font-bold text-white uppercase flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-vc-gold" />
                <span>Edit Mission Directive</span>
              </h3>
              <button onClick={() => setEditingMission(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-vc-rose/10 border border-vc-rose/30 text-vc-rose rounded text-xs">
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-gray-400 mb-1 font-bold">Mission Title *</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-gray-400 mb-1 font-bold">Tier:</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={editTier}
                    onChange={(e) => setEditTier(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1 font-bold">Wave:</label>
                  <input
                    type="number"
                    min="1"
                    max="3"
                    value={editWave}
                    onChange={(e) => setEditWave(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1 font-bold">Reward (VB):</label>
                  <input
                    type="number"
                    value={editRewardVb}
                    onChange={(e) => setEditRewardVb(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-bold">Objective & Narrative *</label>
                <textarea
                  rows={2}
                  value={editObjective}
                  onChange={(e) => setEditObjective(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-400 mb-1 font-bold">Verification Method:</label>
                  <select
                    value={editMethod}
                    onChange={(e) => setEditMethod(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  >
                    <option value="system_checked">System Checked</option>
                    <option value="station_checkin">Station Desk Check-in</option>
                    <option value="counterparty_code">Counterparty Exchange</option>
                    <option value="secret_role">Secret Role Action</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1 font-bold">Station Desk:</label>
                  <input
                    type="text"
                    value={editStationId}
                    onChange={(e) => setEditStationId(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 pt-4">
                  <input
                    type="checkbox"
                    id="editIsSecretCheckbox"
                    checked={editIsSecret}
                    onChange={(e) => setEditIsSecret(e.target.checked)}
                    className="w-4 h-4 accent-amber-500"
                  />
                  <label htmlFor="editIsSecretCheckbox" className="text-gray-300 font-bold text-xs">
                    Classified / Secret Mission
                  </label>
                </div>
                {editIsSecret && (
                  <div>
                    <label className="block text-gray-400 mb-1 font-bold">Secret Role:</label>
                    <input
                      type="text"
                      value={editSecretRole}
                      onChange={(e) => setEditSecretRole(e.target.value)}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setEditingMission(null)}
                  className="px-3 py-1.5 text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editing}
                  className="bg-vc-gold hover:bg-vc-gold-hover text-black font-syne font-bold text-xs px-4 py-2 rounded uppercase"
                >
                  {editing ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Dialog Modal */}
      <ModalDialog
        isOpen={modalConfig.isOpen}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        variant={modalConfig.variant}
        confirmLabel={modalConfig.confirmLabel}
        cancelLabel={modalConfig.cancelLabel}
        onConfirm={modalConfig.onConfirm}
        onCancel={modalConfig.onCancel}
      />
    </div>
  );
}
