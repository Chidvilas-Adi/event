'use client';

import React, { useEffect, useState } from 'react';
import { Landmark, Power, Settings2, AlertCircle, CheckCircle2, Plus, Edit2, Trash2, X } from 'lucide-react';
import { ModalDialog, ModalDialogProps } from '@/components/ui/modal-dialog';

export default function GmInstitutionsPage() {
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Modal Dialog State
  const [modalConfig, setModalConfig] = useState<ModalDialogProps>({
    isOpen: false,
    title: '',
    onConfirm: () => {},
  });
  const [modalPromptText, setModalPromptText] = useState('');

  // Create Institution Desk State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createId, setCreateId] = useState('');
  const [createName, setCreateName] = useState('');
  const [createType, setCreateType] = useState('regulatory');
  const [createCapacity, setCreateCapacity] = useState('100');
  const [createConfig, setCreateConfig] = useState('{}');
  const [creating, setCreating] = useState(false);

  // Edit Institution Desk State
  const [editingInst, setEditingInst] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [editCapacity, setEditCapacity] = useState('100');
  const [configText, setConfigText] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const loadInstitutions = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/institutions');
      if (res.ok) {
        const d = await res.json();
        setInstitutions(d);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstitutions();
  }, []);

  const handleToggleOpen = (inst: any) => {
    const nextState = !inst.is_open;
    setModalPromptText('');
    setModalConfig({
      isOpen: true,
      title: `${nextState ? 'Open' : 'Close'} ${inst.name}`,
      message: `Enter the regulatory justification for ${nextState ? 'opening' : 'suspending/closing'} this civic station desk:`,
      type: 'prompt',
      variant: nextState ? 'emerald' : 'danger',
      confirmLabel: nextState ? 'Confirm Desk Opening' : 'Confirm Desk Suspension',
      cancelLabel: 'Cancel',
      promptPlaceholder: 'Mandatory written reason...',
      promptValue: '',
      onPromptChange: (val) => setModalPromptText(val),
      onCancel: () => setModalConfig((prev) => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        if (!modalPromptText || modalPromptText.trim().length === 0) {
          setModalConfig({
            isOpen: true,
            title: 'Reason Required',
            message: 'A written reason is required to modify institution operating status.',
            type: 'alert',
            variant: 'danger',
            confirmLabel: 'Close',
            onConfirm: () => setModalConfig((prev) => ({ ...prev, isOpen: false })),
          });
          return;
        }

        setModalConfig((prev) => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch('/api/institutions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: inst.id,
              isOpen: nextState,
              reason: modalPromptText.trim(),
            }),
          });

          if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || 'Failed to update status');
          }

          await loadInstitutions();
        } catch (err: any) {
          setModalConfig({
            isOpen: true,
            title: 'Operation Failed',
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

  const handleCreateDesk = async (e: React.FormEvent) => {
    e.preventDefault();
    let parsedConfig;
    try {
      parsedConfig = JSON.parse(createConfig);
    } catch {
      setModalConfig({
        isOpen: true,
        title: 'Invalid JSON Format',
        message: 'Config parameters must be valid JSON syntax.',
        type: 'alert',
        variant: 'danger',
        confirmLabel: 'Close',
        onConfirm: () => setModalConfig((prev) => ({ ...prev, isOpen: false })),
      });
      return;
    }

    setCreating(true);
    try {
      const res = await fetch('/api/institutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          id: createId.trim() || undefined,
          name: createName.trim(),
          type: createType.trim(),
          capacity: parseInt(createCapacity, 10) || 100,
          config: parsedConfig,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create institution');

      setShowCreateModal(false);
      setCreateId('');
      setCreateName('');
      setCreateType('regulatory');
      setCreateCapacity('100');
      setCreateConfig('{}');
      setFeedback(`Institution desk "${createName}" successfully chartered!`);
      await loadInstitutions();
    } catch (err: any) {
      setModalConfig({
        isOpen: true,
        title: 'Desk Creation Failed',
        message: err.message,
        type: 'alert',
        variant: 'danger',
        confirmLabel: 'Close',
        onConfirm: () => setModalConfig((prev) => ({ ...prev, isOpen: false })),
      });
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (inst: any) => {
    setEditingInst(inst);
    setEditName(inst.name || '');
    setEditType(inst.type || '');
    setEditCapacity(String(inst.capacity || 100));
    setConfigText(JSON.stringify(inst.config, null, 2));
    setReason('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInst) return;

    let parsedConfig;
    try {
      parsedConfig = JSON.parse(configText);
    } catch {
      setModalConfig({
        isOpen: true,
        title: 'Invalid JSON Format',
        message: 'Config parameters must be valid JSON syntax.',
        type: 'alert',
        variant: 'danger',
        confirmLabel: 'Close',
        onConfirm: () => setModalConfig((prev) => ({ ...prev, isOpen: false })),
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/institutions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingInst.id,
          name: editName.trim(),
          type: editType.trim(),
          capacity: parseInt(editCapacity, 10) || 100,
          config: parsedConfig,
          reason: reason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update institution');

      setFeedback(`Updated parameters for desk: ${editName}`);
      setEditingInst(null);
      await loadInstitutions();
    } catch (err: any) {
      setModalConfig({
        isOpen: true,
        title: 'Save Failed',
        message: err.message,
        type: 'alert',
        variant: 'danger',
        confirmLabel: 'Close',
        onConfirm: () => setModalConfig((prev) => ({ ...prev, isOpen: false })),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDesk = (inst: any) => {
    setModalConfig({
      isOpen: true,
      title: 'Decommission Institution Desk',
      message: `Are you sure you want to permanently decommission and delete "${inst.name}" (${inst.id})? Operating accounts linked to this desk will be unlinked.`,
      type: 'confirm',
      variant: 'danger',
      confirmLabel: 'Delete Desk',
      cancelLabel: 'Cancel',
      onCancel: () => setModalConfig((prev) => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch(`/api/institutions?id=${encodeURIComponent(inst.id)}`, {
            method: 'DELETE',
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to delete institution');

          setFeedback(`Decommissioned desk: ${inst.name}`);
          await loadInstitutions();
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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-syne font-black text-white">CITY INSTITUTIONS & DESKS</h1>
          <p className="text-xs text-gray-400">
            Control station operating gates, adjust limits, and provision administrative desks.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-vc-gold hover:bg-vc-gold-hover text-black font-syne font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 shadow active:scale-95 transition-all w-fit"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create Desk</span>
        </button>
      </div>

      {feedback && (
        <div className="bg-vc-emerald/10 border border-vc-emerald/30 text-vc-emerald p-3 rounded text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Grid of institutions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {institutions.map((inst) => (
          <div
            key={inst.id}
            className={`bg-vc-card border rounded-xl p-5 shadow space-y-4 font-mono text-xs transition-all ${
              inst.is_open ? 'border-vc-border' : 'border-vc-rose/40 bg-vc-rose/5'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-widest">
                  STATION ID: {inst.id}
                </span>
                <h3 className="text-base font-syne font-bold text-white mt-0.5">{inst.name}</h3>
                <span className="text-[10px] uppercase text-vc-gold">{inst.type}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleOpen(inst)}
                  className={`px-3 py-1 rounded text-[11px] font-bold uppercase flex items-center gap-1.5 transition-all ${
                    inst.is_open
                      ? 'bg-vc-emerald/10 text-vc-emerald hover:bg-vc-rose/20 hover:text-vc-rose border border-vc-emerald/30'
                      : 'bg-vc-rose/20 text-vc-rose hover:bg-vc-emerald/20 hover:text-vc-emerald border border-vc-rose/40'
                  }`}
                >
                  <Power className="w-3 h-3" />
                  <span>{inst.is_open ? 'Open' : 'Closed'}</span>
                </button>
              </div>
            </div>

            {/* Config Limits Summary */}
            <div className="bg-black/40 p-3 rounded border border-gray-800 space-y-1 text-[11px]">
              <div className="text-[10px] text-gray-500 uppercase mb-1 font-bold">Enforced Limits & Config:</div>
              <pre className="text-gray-300 overflow-x-auto text-[10px] max-h-36">
                {JSON.stringify(inst.config, null, 2)}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-gray-500">
                Capacity: {inst.capacity} interactions/round
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEditModal(inst)}
                  className="text-gray-400 hover:text-vc-gold flex items-center gap-1 text-[11px] px-2.5 py-1 bg-gray-900 rounded border border-gray-800"
                >
                  <Edit2 className="w-3 h-3" />
                  <span>Edit Desk</span>
                </button>
                <button
                  onClick={() => handleDeleteDesk(inst)}
                  className="text-gray-400 hover:text-vc-rose flex items-center gap-1 text-[11px] p-1.5 bg-gray-900 rounded border border-gray-800"
                  title="Delete Desk"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create Desk Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-vc-card border-2 border-vc-gold rounded-xl p-6 max-w-lg w-full space-y-4 font-mono text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-base font-syne font-bold text-white uppercase flex items-center gap-2">
                <Landmark className="w-4 h-4 text-vc-gold" />
                <span>Charter New Institution Desk</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDesk} className="space-y-4">
              <div>
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Desk Name *</label>
                <input
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Apex Central Bank, Swift Logistics"
                  className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold text-white p-2.5 rounded text-xs outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-400 uppercase mb-1">Station ID (Optional)</label>
                  <input
                    type="text"
                    value={createId}
                    onChange={(e) => setCreateId(e.target.value)}
                    placeholder="e.g. bank, logistics, registry"
                    className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold text-white p-2.5 rounded text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 uppercase mb-1">Desk Type</label>
                  <select
                    value={createType}
                    onChange={(e) => setCreateType(e.target.value)}
                    className="w-full bg-[#030712] border border-gray-800 text-white p-2.5 rounded text-xs outline-none"
                  >
                    <option value="regulatory">Regulatory / Registry</option>
                    <option value="financial">Financial / Bank</option>
                    <option value="infrastructure">Infrastructure / Logistics</option>
                    <option value="legal">Legal / Arbitration</option>
                    <option value="commercial">Commercial / Exchange</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Round Capacity</label>
                <input
                  type="number"
                  min="1"
                  value={createCapacity}
                  onChange={(e) => setCreateCapacity(e.target.value)}
                  className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold text-white p-2.5 rounded text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Initial Config (JSON)</label>
                <textarea
                  rows={4}
                  value={createConfig}
                  onChange={(e) => setCreateConfig(e.target.value)}
                  className="w-full bg-[#030712] border border-gray-800 text-vc-gold p-2.5 rounded font-mono text-xs outline-none"
                />
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
                  className="bg-vc-gold hover:bg-vc-gold-hover text-black px-4 py-1.5 rounded font-bold uppercase text-xs disabled:opacity-50"
                >
                  {creating ? 'Chartering...' : 'Charter Desk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Desk Modal */}
      {editingInst && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-vc-card border-2 border-vc-gold/40 rounded-xl p-6 max-w-lg w-full space-y-4 font-mono text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-base font-syne font-bold text-white uppercase flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-vc-gold" />
                <span>Edit Desk: {editingInst.name}</span>
              </h3>
              <button onClick={() => setEditingInst(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Desk Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold text-white p-2.5 rounded text-xs outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-400 uppercase mb-1">Desk Type</label>
                  <input
                    type="text"
                    value={editType}
                    onChange={(e) => setEditType(e.target.value)}
                    className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold text-white p-2.5 rounded text-xs outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 uppercase mb-1">Capacity</label>
                  <input
                    type="number"
                    min="1"
                    value={editCapacity}
                    onChange={(e) => setEditCapacity(e.target.value)}
                    className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold text-white p-2.5 rounded text-xs outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 uppercase mb-1">
                  Parameters JSON Config
                </label>
                <textarea
                  rows={6}
                  required
                  value={configText}
                  onChange={(e) => setConfigText(e.target.value)}
                  className="w-full bg-[#030712] border border-gray-800 text-vc-gold p-3 rounded font-mono text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 uppercase mb-1">
                  Audit Reason (Optional)
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Monetary easing cycle, tight liquidity adjustment..."
                  className="w-full bg-[#030712] border border-gray-800 text-white p-2.5 rounded text-xs outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setEditingInst(null)}
                  className="px-3 py-1.5 text-gray-400 hover:text-white text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-vc-gold hover:bg-vc-gold-hover text-black px-4 py-1.5 rounded font-bold uppercase text-xs disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Commit Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reusable Modal Dialog */}
      <ModalDialog {...modalConfig} />
    </div>
  );
}
