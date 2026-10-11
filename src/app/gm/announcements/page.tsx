'use client';

import React, { useEffect, useState } from 'react';
import { Radio, Send, Bell, CheckCircle2, AlertCircle, Edit2, Trash2, X } from 'lucide-react';
import { ModalDialog, ModalDialogProps } from '@/components/ui/modal-dialog';

export default function GmAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Composer
  const [audience, setAudience] = useState<'all' | 'company' | 'role'>('all');
  const [targetId, setTargetId] = useState('');
  const [priority, setPriority] = useState<'normal' | 'urgent' | 'critical'>('normal');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Edit Announcement
  const [editingAnn, setEditingAnn] = useState<any | null>(null);
  const [editMessage, setEditMessage] = useState('');
  const [editPriority, setEditPriority] = useState<'normal' | 'urgent' | 'critical'>('normal');
  const [editAudience, setEditAudience] = useState<'all' | 'company' | 'role'>('all');
  const [editTargetId, setEditTargetId] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Modal Dialog State
  const [modalConfig, setModalConfig] = useState<ModalDialogProps>({
    isOpen: false,
    title: '',
    onConfirm: () => {},
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/announcements');
      if (res.ok) {
        const d = await res.json();
        setAnnouncements(d);
      }

      const compRes = await fetch('/api/companies');
      if (compRes.ok) {
        const c = await compRes.json();
        setCompanies(c.companies || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setSending(true);
    setFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audience,
          targetId: audience === 'all' ? null : targetId,
          priority,
          message: message.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to publish announcement');

      setFeedback('Broadcast successfully transmitted to venue network.');
      setMessage('');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setSending(false);
    }
  };

  const openEditModal = (ann: any) => {
    setEditingAnn(ann);
    setEditMessage(ann.message || '');
    setEditPriority(ann.priority || 'normal');
    setEditAudience(ann.audience || 'all');
    setEditTargetId(ann.target_id || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnn) return;

    setEditSubmitting(true);
    try {
      const res = await fetch('/api/announcements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingAnn.id,
          message: editMessage.trim(),
          priority: editPriority,
          audience: editAudience,
          targetId: editAudience === 'all' ? null : editTargetId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update announcement');

      setEditingAnn(null);
      setFeedback('Broadcast transmission updated.');
      await loadData();
    } catch (err: any) {
      setModalConfig({
        isOpen: true,
        title: 'Edit Failed',
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

  const handleDeleteAnn = (ann: any) => {
    setModalConfig({
      isOpen: true,
      title: 'Delete City Transmission',
      message: `Are you sure you want to delete this broadcast? ("${ann.message.slice(0, 60)}...")`,
      type: 'confirm',
      variant: 'danger',
      confirmLabel: 'Delete Broadcast',
      cancelLabel: 'Cancel',
      onCancel: () => setModalConfig((prev) => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch(`/api/announcements?id=${encodeURIComponent(ann.id)}`, {
            method: 'DELETE',
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to delete announcement');

          setFeedback('Broadcast removed from transmission ledger.');
          await loadData();
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
      <div>
        <h1 className="text-2xl font-syne font-black text-white flex items-center gap-2">
          <Radio className="w-6 h-6 text-vc-gold" />
          <span>CITY BROADCAST CONTROL</span>
        </h1>
        <p className="text-gray-400">
          Transmit, modify, and manage real-time citywide announcements, venture directives, or designated operational broadcasts.
        </p>
      </div>

      {feedback && (
        <div className="bg-vc-emerald/10 border border-vc-emerald/30 text-vc-emerald p-3 rounded flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{feedback}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-vc-rose/10 border border-vc-rose/30 text-vc-rose p-3 rounded flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Composer Card */}
      <div className="bg-vc-card border border-vc-border rounded-xl p-5 shadow-xl space-y-4">
        <h2 className="text-base font-syne font-bold text-white uppercase flex items-center gap-2">
          <Send className="w-4 h-4 text-vc-gold" />
          <span>Compose City Transmission</span>
        </h2>

        <form onSubmit={handlePublish} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] text-gray-400 uppercase mb-1">Audience Scope</label>
              <select
                value={audience}
                onChange={(e: any) => setAudience(e.target.value)}
                className="w-full bg-[#030712] border border-gray-800 text-white p-2 rounded outline-none"
              >
                <option value="all">Entire City (All Citizens)</option>
                <option value="company">Specific Venture Company</option>
                <option value="role">Specific Role</option>
              </select>
            </div>

            {audience === 'company' && (
              <div>
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Target Company</label>
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  required
                  className="w-full bg-[#030712] border border-gray-800 text-white p-2 rounded outline-none"
                >
                  <option value="">Select Company...</option>
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {audience === 'role' && (
              <div>
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Target Role</label>
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  required
                  className="w-full bg-[#030712] border border-gray-800 text-white p-2 rounded outline-none"
                >
                  <option value="">Select Role...</option>
                  <option value="company_lead">Company Founders & Leads</option>
                  <option value="volunteer">Institution Volunteers</option>
                  <option value="observer">Ecosystem Observers</option>
                  <option value="participant">General Citizens</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-[10px] text-gray-400 uppercase mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e: any) => setPriority(e.target.value)}
                className="w-full bg-[#030712] border border-gray-800 text-white p-2 rounded outline-none"
              >
                <option value="normal">Normal Bulletin</option>
                <option value="urgent">Urgent Warning</option>
                <option value="critical">Critical City Alert</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] text-gray-400 uppercase mb-1">Transmission Copy</label>
            <textarea
              rows={3}
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="e.g. ✦ ENERGY CRISIS: Supplier reserves falling. Apex Reserve Bank opening emergency credit window..."
              className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold text-white p-3 rounded text-xs outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={sending}
            className="bg-vc-gold hover:bg-vc-gold-hover text-black px-5 py-2.5 rounded font-syne font-bold uppercase flex items-center gap-2 shadow active:scale-95 transition-all disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{sending ? 'Transmitting...' : 'Transmit Broadcast'}</span>
          </button>
        </form>
      </div>

      {/* Broadcast History */}
      <div className="space-y-3">
        <h3 className="text-xs text-gray-400 uppercase tracking-wider">Broadcast Archive ({announcements.length})</h3>
        <div className="space-y-2">
          {announcements.map((ann) => (
            <div
              key={ann.id}
              className={`p-3.5 rounded-xl border bg-vc-card space-y-2 ${
                ann.priority === 'urgent'
                  ? 'border-vc-rose/40'
                  : ann.priority === 'critical'
                  ? 'border-vc-rose bg-vc-rose/10'
                  : 'border-gray-800'
              }`}
            >
              <div className="flex items-center justify-between text-[10px] text-gray-400">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-vc-gold uppercase">{ann.priority}</span>
                  <span>· Target: {ann.audience} {ann.target_id ? `(${ann.target_id})` : ''}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span>{new Date(ann.created_at).toLocaleTimeString()}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(ann)}
                      className="p-1 hover:text-white text-gray-400 rounded hover:bg-gray-800 transition-colors"
                      title="Edit Announcement"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteAnn(ann)}
                      className="p-1 hover:text-vc-rose text-gray-400 rounded hover:bg-gray-800 transition-colors"
                      title="Delete Announcement"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
              <p className="text-white text-xs leading-relaxed">{ann.message}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Announcement Modal */}
      {editingAnn && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-vc-card border-2 border-vc-gold/40 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="text-base font-syne font-bold text-white uppercase flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-vc-gold" />
                <span>Edit Broadcast Transmission</span>
              </h3>
              <button onClick={() => setEditingAnn(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-400 uppercase mb-1">Audience Scope</label>
                  <select
                    value={editAudience}
                    onChange={(e: any) => setEditAudience(e.target.value)}
                    className="w-full bg-[#030712] border border-gray-800 text-white p-2 rounded outline-none"
                  >
                    <option value="all">Entire City</option>
                    <option value="company">Specific Company</option>
                    <option value="role">Specific Role</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 uppercase mb-1">Priority</label>
                  <select
                    value={editPriority}
                    onChange={(e: any) => setEditPriority(e.target.value)}
                    className="w-full bg-[#030712] border border-gray-800 text-white p-2 rounded outline-none"
                  >
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              {editAudience === 'company' && (
                <div>
                  <label className="block text-[10px] text-gray-400 uppercase mb-1">Target Company</label>
                  <select
                    value={editTargetId}
                    onChange={(e) => setEditTargetId(e.target.value)}
                    className="w-full bg-[#030712] border border-gray-800 text-white p-2 rounded outline-none"
                  >
                    <option value="">Select Company...</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] text-gray-400 uppercase mb-1">Message Content</label>
                <textarea
                  rows={4}
                  required
                  value={editMessage}
                  onChange={(e) => setEditMessage(e.target.value)}
                  className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold text-white p-3 rounded text-xs outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setEditingAnn(null)}
                  className="px-3 py-1.5 text-gray-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="bg-vc-gold hover:bg-vc-gold-hover text-black px-4 py-1.5 rounded font-syne font-bold uppercase text-xs disabled:opacity-50"
                >
                  {editSubmitting ? 'Saving...' : 'Update Transmission'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Dialog Modal */}
      <ModalDialog {...modalConfig} />
    </div>
  );
}
