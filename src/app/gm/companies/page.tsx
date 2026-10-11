'use client';

import React, { useEffect, useState } from 'react';
import { Building2, X, ChevronRight, Coins, Users, Layers, Shield, Plus, Edit2, Trash2 } from 'lucide-react';
import { ModalDialog, ModalDialogProps } from '@/components/ui/modal-dialog';

export default function GmCompaniesPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [companyDetail, setCompanyDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modal Dialog State
  const [modalConfig, setModalConfig] = useState<ModalDialogProps>({
    isOpen: false,
    title: '',
    onConfirm: () => {},
  });

  // Create Venture State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formTagline, setFormTagline] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formTier, setFormTier] = useState('1');
  const [formStatus, setFormStatus] = useState('operating');
  const [formInitialTreasury, setFormInitialTreasury] = useState('5000');
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Edit Venture State
  const [editingCompany, setEditingCompany] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editTagline, setEditTagline] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTier, setEditTier] = useState('1');
  const [editStatus, setEditStatus] = useState('operating');
  const [editAdjVb, setEditAdjVb] = useState('0');
  const [editAdjReason, setEditAdjReason] = useState('GM Treasury Grant');
  const [editSubmitting, setEditSubmitting] = useState(false);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/companies');
      if (res.ok) {
        const d = await res.json();
        setCompanies(d.companies || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, []);

  const openCompany = async (id: string) => {
    setSelectedCompanyId(id);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/companies?id=${id}`);
      if (res.ok) {
        const d = await res.json();
        setCompanyDetail(d.company);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSubmitting(true);
    try {
      const res = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          tagline: formTagline.trim(),
          description: formDescription.trim(),
          tier: parseInt(formTier, 10) || 1,
          status: formStatus,
          initialTreasury: parseInt(formInitialTreasury, 10) || 0,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create company');

      setShowCreateModal(false);
      setFormName('');
      setFormTagline('');
      setFormDescription('');
      setFormTier('1');
      setFormInitialTreasury('5000');
      loadCompanies();
    } catch (err: any) {
      setModalConfig({
        isOpen: true,
        title: 'Venture Creation Failed',
        message: err.message,
        type: 'alert',
        variant: 'danger',
        confirmLabel: 'Close',
        onConfirm: () => setModalConfig((prev) => ({ ...prev, isOpen: false })),
      });
    } finally {
      setCreateSubmitting(false);
    }
  };

  const openEditModal = (c: any) => {
    setEditingCompany(c);
    setEditName(c.name || '');
    setEditTagline(c.tagline || '');
    setEditDescription(c.description || '');
    setEditTier(String(c.tier || 1));
    setEditStatus(c.status || 'operating');
    setEditAdjVb('0');
    setEditAdjReason('GM Discretionary Grant');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;
    setEditSubmitting(true);
    try {
      const res = await fetch('/api/companies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingCompany.id,
          name: editName.trim(),
          tagline: editTagline.trim(),
          description: editDescription.trim(),
          tier: parseInt(editTier, 10) || 1,
          status: editStatus,
          adjustmentVb: parseInt(editAdjVb, 10) || 0,
          adjustmentReason: editAdjReason.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update company');

      setEditingCompany(null);
      loadCompanies();
    } catch (err: any) {
      setModalConfig({
        isOpen: true,
        title: 'Update Failed',
        message: err.message,
        type: 'alert',
        variant: 'danger',
        confirmLabel: 'Close',
        onConfirm: () => setModalConfig((prev) => ({ ...prev, isOpen: false })),
      });
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteCompany = (c: any) => {
    setModalConfig({
      isOpen: true,
      title: 'Delete Venture Company',
      message: `Are you sure you want to permanently delete "${c.name}" (${c.id})? This will dissolve memberships, cap table shares, and company links.`,
      type: 'confirm',
      variant: 'danger',
      confirmLabel: 'Delete Venture',
      cancelLabel: 'Cancel',
      onCancel: () => setModalConfig((prev) => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch(`/api/companies?id=${encodeURIComponent(c.id)}`, {
            method: 'DELETE',
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to delete company');

          if (selectedCompanyId === c.id) {
            setSelectedCompanyId(null);
            setCompanyDetail(null);
          }
          loadCompanies();
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
          <h1 className="text-2xl font-syne font-black text-white">VENTURE PORTFOLIO</h1>
          <p className="text-xs text-gray-400">
            Real-time status, capital positions, and team rosters across all operational ventures.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-vc-gold hover:bg-vc-gold-hover text-black font-syne font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-1.5 shadow active:scale-95 transition-all w-fit"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create Venture</span>
        </button>
      </div>

      {/* Companies Table */}
      <div className="bg-vc-card border border-vc-border rounded-xl shadow-xl overflow-hidden">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-[#030712] border-b border-gray-800 text-gray-400 uppercase tracking-wider">
            <tr>
              <th className="py-3 px-4">Company Name</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Tier</th>
              <th className="py-3 px-4">Headcount</th>
              <th className="py-3 px-4 text-right">Treasury (VB)</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/80">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  Loading portfolio telemetry...
                </td>
              </tr>
            ) : (
              companies.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-gray-900/60 transition-colors"
                >
                  <td className="py-3 px-4 cursor-pointer" onClick={() => openCompany(c.id)}>
                    <div className="font-bold font-syne text-sm text-white hover:text-vc-gold transition-colors">{c.name}</div>
                    <div className="text-[11px] text-gray-400 italic truncate max-w-xs">{c.tagline}</div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold border ${
                      c.status === 'operating'
                        ? 'bg-vc-emerald/10 text-vc-emerald border-vc-emerald/30'
                        : c.status === 'distressed'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : 'bg-vc-rose/10 text-vc-rose border-vc-rose/30'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-300">Tier {c.tier}</td>
                  <td className="py-3 px-4 text-gray-300">{c.member_count} citizens</td>
                  <td className="py-3 px-4 text-right font-bold text-vc-gold font-syne text-sm">
                    {c.vault_balance !== undefined ? c.vault_balance.toLocaleString() : '...'} VB
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openCompany(c.id)}
                        className="text-gray-400 hover:text-vc-gold inline-flex items-center gap-1 text-[11px] px-2 py-1 bg-gray-900 rounded border border-gray-800"
                        title="View Details"
                      >
                        <span>Detail</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => openEditModal(c)}
                        className="text-gray-400 hover:text-white inline-flex items-center p-1 bg-gray-900 rounded border border-gray-800"
                        title="Edit Venture"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCompany(c)}
                        className="text-gray-400 hover:text-vc-rose inline-flex items-center p-1 bg-gray-900 rounded border border-gray-800"
                        title="Delete Venture"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Venture Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-vc-card border-2 border-vc-gold/40 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h2 className="text-base font-syne font-bold text-white uppercase flex items-center gap-2">
                <Building2 className="w-4 h-4 text-vc-gold" />
                <span>Incorporate New Venture</span>
              </h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCompany} className="space-y-4">
              <div>
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Company Name *</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Nexus Orbitals"
                  className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold text-white p-2.5 rounded text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Tagline</label>
                <input
                  type="text"
                  value={formTagline}
                  onChange={(e) => setFormTagline(e.target.value)}
                  placeholder="e.g. Next-generation satellite telecom network"
                  className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold text-white p-2.5 rounded text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Description</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Detailed venture thesis, capability profile, and core assets..."
                  className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold text-white p-2.5 rounded text-xs outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-400 uppercase mb-1">Tier</label>
                  <select
                    value={formTier}
                    onChange={(e) => setFormTier(e.target.value)}
                    className="w-full bg-[#030712] border border-gray-800 text-white p-2.5 rounded text-xs outline-none"
                  >
                    <option value="1">Tier 1 (Seed / Early Stage)</option>
                    <option value="2">Tier 2 (Growth / Expansion)</option>
                    <option value="3">Tier 3 (Enterprise / Late Stage)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 uppercase mb-1">Initial Treasury (VB)</label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={formInitialTreasury}
                    onChange={(e) => setFormInitialTreasury(e.target.value)}
                    className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold text-white p-2.5 rounded text-xs outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-gray-300 rounded text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="px-4 py-2 bg-vc-gold hover:bg-vc-gold-hover text-black font-syne font-bold uppercase rounded text-xs shadow disabled:opacity-50"
                >
                  {createSubmitting ? 'Incorporate...' : 'Incorporate Venture'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Venture Modal */}
      {editingCompany && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-vc-card border-2 border-vc-gold/40 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h2 className="text-base font-syne font-bold text-white uppercase flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-vc-gold" />
                <span>Edit Venture: {editingCompany.name}</span>
              </h2>
              <button onClick={() => setEditingCompany(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold text-white p-2.5 rounded text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Tagline</label>
                <input
                  type="text"
                  value={editTagline}
                  onChange={(e) => setEditTagline(e.target.value)}
                  className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold text-white p-2.5 rounded text-xs outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold text-white p-2.5 rounded text-xs outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-400 uppercase mb-1">Tier</label>
                  <select
                    value={editTier}
                    onChange={(e) => setEditTier(e.target.value)}
                    className="w-full bg-[#030712] border border-gray-800 text-white p-2.5 rounded text-xs outline-none"
                  >
                    <option value="1">Tier 1</option>
                    <option value="2">Tier 2</option>
                    <option value="3">Tier 3</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 uppercase mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full bg-[#030712] border border-gray-800 text-white p-2.5 rounded text-xs outline-none"
                  >
                    <option value="operating">Operating</option>
                    <option value="distressed">Distressed</option>
                    <option value="acquired">Acquired</option>
                    <option value="liquidated">Liquidated</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-black/40 rounded border border-gray-800 space-y-2">
                <div className="text-[10px] text-vc-gold uppercase font-bold">Treasury Capital Adjustment (VB)</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] text-gray-500 uppercase">Amount (+ Grant / - Deduct)</label>
                    <input
                      type="number"
                      step="50"
                      value={editAdjVb}
                      onChange={(e) => setEditAdjVb(e.target.value)}
                      placeholder="0"
                      className="w-full bg-[#030712] border border-gray-800 text-white p-2 rounded text-xs outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-gray-500 uppercase">Reason / Regulatory Memo</label>
                    <input
                      type="text"
                      value={editAdjReason}
                      onChange={(e) => setEditAdjReason(e.target.value)}
                      placeholder="Reason for adjustment"
                      className="w-full bg-[#030712] border border-gray-800 text-white p-2 rounded text-xs outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setEditingCompany(null)}
                  className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-gray-300 rounded text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-4 py-2 bg-vc-gold hover:bg-vc-gold-hover text-black font-syne font-bold uppercase rounded text-xs shadow disabled:opacity-50"
                >
                  {editSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal / Drawer */}
      {selectedCompanyId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-vc-card border-2 border-vc-gold/40 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between border-b border-gray-800 pb-3">
              <div>
                <span className="text-[10px] text-gray-500 uppercase tracking-widest">
                  VENTURE DOSSIER · ID: {selectedCompanyId}
                </span>
                <h2 className="text-2xl font-syne font-black text-white">
                  {companyDetail?.name || 'Loading...'}
                </h2>
                <p className="text-xs text-gray-400 italic">{companyDetail?.tagline}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedCompanyId(null);
                  setCompanyDetail(null);
                }}
                className="text-gray-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailLoading ? (
              <div className="py-12 text-center text-gray-500 font-mono text-xs">
                Fetching venture ledger and team trail...
              </div>
            ) : companyDetail ? (
              <div className="space-y-4 font-mono text-xs">
                {/* Metrics */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-black/40 p-3.5 rounded-lg border border-gray-800">
                    <div className="text-[10px] text-gray-500 uppercase">Verified Treasury</div>
                    <div className="text-xl font-syne font-bold text-vc-gold">
                      {companyDetail.vault_balance?.toLocaleString()} VB
                    </div>
                  </div>
                  <div className="bg-black/40 p-3.5 rounded-lg border border-gray-800">
                    <div className="text-[10px] text-gray-500 uppercase">Team Size</div>
                    <div className="text-xl font-syne font-bold text-white">
                      {companyDetail.members?.length} Citizens
                    </div>
                  </div>
                </div>

                {/* Resources */}
                {companyDetail.resources && (
                  <div className="bg-black/40 p-3.5 rounded-lg border border-gray-800 space-y-2">
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider">
                      Resource Stock
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(companyDetail.resources).map(([k, v]: any) => (
                        <div key={k} className="bg-gray-900/80 p-2 rounded border border-gray-800">
                          <div className="text-[10px] text-gray-400 capitalize">{k}</div>
                          <div className="font-bold text-white">{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Team Roster */}
                <div className="space-y-2">
                  <div className="text-[11px] text-gray-400 uppercase tracking-wider">
                    Registered Team Members
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 border border-gray-800 p-2 rounded bg-black/30">
                    {companyDetail.members?.map((m: any) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between p-2 rounded bg-gray-900/50 text-[11px]"
                      >
                        <span className="text-white font-medium">{m.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400">{m.role}</span>
                          <span className="text-vc-gold font-bold">{m.citizen_code}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recent Ledger Trail */}
                {companyDetail.recentLedger && (
                  <div className="space-y-2">
                    <div className="text-[11px] text-gray-400 uppercase tracking-wider">
                      Recent Ledger Activity
                    </div>
                    <div className="max-h-48 overflow-y-auto space-y-1 border border-gray-800 p-2 rounded bg-black/30">
                      {companyDetail.recentLedger.map((l: any) => (
                        <div
                          key={l.id}
                          className="flex items-center justify-between p-1.5 text-[10px] border-b border-gray-800/60"
                        >
                          <div>
                            <span className="text-gray-300">{l.reason}</span>
                            <span className="text-gray-500 block">
                              {new Date(l.timestamp).toLocaleTimeString()} · Type: {l.type}
                            </span>
                          </div>
                          <span className="font-bold text-vc-gold">{l.amount} VB</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
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
