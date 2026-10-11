'use client';

import React, { useEffect, useState } from 'react';
import {
  Search,
  Users,
  Copy,
  Check,
  Edit2,
  Trash2,
  Sparkles,
  AlertCircle,
  RefreshCw,
  PlusCircle,
  Key,
  Shield,
  Landmark,
  Lock,
  UserCheck,
} from 'lucide-react';
import { ModalDialog, ModalDialogProps } from '@/components/ui/modal-dialog';

const COMPANY_OPTIONS = [
  { id: '', name: 'Independent Free Agent' },
  { id: 'comp_swiftcart', name: 'SwiftCart (SWC)' },
  { id: 'comp_ledgerly', name: 'Ledgerly (LED)' },
  { id: 'comp_mango', name: 'Mango & Co. (MAN)' },
  { id: 'comp_skillforge', name: 'SkillForge (SKF)' },
  { id: 'comp_pulseai', name: 'PulseAI (PAI)' },
  { id: 'comp_greengrid', name: 'GreenGrid (GRG)' },
  { id: 'comp_medilink', name: 'MediLink (MED)' },
  { id: 'comp_harvestloop', name: 'HarvestLoop (HVL)' },
  { id: 'comp_stackhouse', name: 'StackHouse (STH)' },
  { id: 'comp_voltway', name: 'Voltway (VLT)' },
  { id: 'comp_forgeline', name: 'Forgeline (FRG)' },
  { id: 'comp_trustlayer', name: 'TrustLayer (TRL)' },
];

const INSTITUTION_OPTIONS = [
  { id: '', name: 'None (Global/Supervisory)' },
  { id: 'bank', name: 'Apex Reserve Bank', roleLabel: 'Bank Manager' },
  { id: 'investor', name: 'Frontier Venture Syndicate', roleLabel: 'Investor Partner' },
  { id: 'enterprise_customer', name: 'Customer Procurement Desk', roleLabel: 'Procurement Officer' },
  { id: 'talent_exchange', name: 'Metro Talent Exchange', roleLabel: 'Talent Broker' },
  { id: 'supplier', name: 'Prime Supplier Market', roleLabel: 'Supplier Dispatcher' },
  { id: 'logistics', name: 'Swift Logistics Provider', roleLabel: 'Logistics Controller' },
  { id: 'government', name: 'City Department of Commerce', roleLabel: 'Commerce Officer' },
  { id: 'media', name: 'The Daily Chronicle & Media', roleLabel: 'Chronicle Editor' },
];

const ROLE_OPTIONS = [
  'Founder & CEO',
  'Head of Product',
  'Lead Systems Engineer',
  'Supply Operations Lead',
  'Growth & Partnerships',
  'CFO & General Counsel',
  'Lead Data Scientist',
  'Independent Free Agent',
];

export default function GmParticipantsPage() {
  const [activeTab, setActiveTab] = useState<'citizens' | 'operators'>('citizens');
  const [participants, setParticipants] = useState<any[]>([]);
  const [operators, setOperators] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal Dialog State
  const [modalConfig, setModalConfig] = useState<ModalDialogProps>({
    isOpen: false,
    title: '',
    onConfirm: () => {},
  });

  // Create Account State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [accountType, setAccountType] = useState<'participant' | 'operator'>('participant');
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRole, setFormRole] = useState('participant');
  const [formCompanyId, setFormCompanyId] = useState('');
  const [formCompanyRole, setFormCompanyRole] = useState('Founder & CEO');
  const [formCustomRole, setFormCustomRole] = useState('');
  const [formInitialBalance, setFormInitialBalance] = useState('500');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formOperatorRole, setFormOperatorRole] = useState('volunteer');
  const [formInstitutionId, setFormInstitutionId] = useState('');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createResult, setCreateResult] = useState<any>(null);

  // Edit Participant State
  const [editingParticipant, setEditingParticipant] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [editCitizenCode, setEditCitizenCode] = useState('');
  const [editRole, setEditRole] = useState('participant');
  const [editCompanyId, setEditCompanyId] = useState('');
  const [editCompanyRole, setEditCompanyRole] = useState('');
  const [editCustomRole, setEditCustomRole] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [editPassword, setEditPassword] = useState('');
  const [editAdjVb, setEditAdjVb] = useState('0');
  const [editAdjReason, setEditAdjReason] = useState('GM Discretionary Grant');
  const [editSubmitting, setEditSubmitting] = useState(false);

  // Edit Operator State
  const [editingOperator, setEditingOperator] = useState<any | null>(null);
  const [editOpName, setEditOpName] = useState('');
  const [editOpRole, setEditOpRole] = useState('volunteer');
  const [editOpInstitutionId, setEditOpInstitutionId] = useState('');
  const [editOpPassword, setEditOpPassword] = useState('');
  const [editOpIsActive, setEditOpIsActive] = useState(true);
  const [editOpSubmitting, setEditOpSubmitting] = useState(false);

  // Mission Auto-Assign State
  const [assigningMissions, setAssigningMissions] = useState(false);
  const [assignResult, setAssignResult] = useState<string | null>(null);

  const loadData = async (searchStr = '') => {
    try {
      setLoading(true);
      const [partsRes, opsRes] = await Promise.all([
        fetch(`/api/participants?q=${encodeURIComponent(searchStr)}`),
        fetch('/api/gm/accounts'),
      ]);

      if (partsRes.ok) {
        const d = await partsRes.json();
        setParticipants(d.participants || []);
      }
      if (opsRes.ok) {
        const od = await opsRes.json();
        setOperators(od.operators || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(query);
  }, []);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(code);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateSubmitting(true);
    setCreateResult(null);
    try {
      const payload: any = { accountType };
      if (accountType === 'participant') {
        payload.name = formName;
        payload.email = formEmail || `${formName.toLowerCase().replace(/\s+/g, '.')}@pesu.internal`;
        payload.role = formRole;
        if (formCompanyId) {
          payload.companyId = formCompanyId;
          payload.companyRole = formCompanyRole === 'Other' ? (formCustomRole.trim() || 'Special Operator') : formCompanyRole;
        }
        payload.initialBalance = parseInt(formInitialBalance, 10) || 500;
      } else {
        payload.username = formUsername.trim().toLowerCase();
        payload.password = formPassword || 'city-operator-2026';
        payload.name = formName.trim();
        payload.role = formOperatorRole;
        payload.institutionId = formInstitutionId || null;
      }

      const res = await fetch('/api/gm/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create account');

      setCreateResult(data);
      loadData(query);
    } catch (err: any) {
      setModalConfig({
        isOpen: true,
        title: 'Account Creation Failed',
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

  const openEditModal = (p: any) => {
    setEditingParticipant(p);
    setEditName(p.name);
    setEditCitizenCode(p.citizen_code);
    setEditRole(p.role || 'participant');
    setEditCompanyId(p.company_id || '');
    setEditPassword('');
    const currentRole = p.company_role || 'Independent Free Agent';
    if (ROLE_OPTIONS.includes(currentRole)) {
      setEditCompanyRole(currentRole);
      setEditCustomRole('');
    } else {
      setEditCompanyRole('Other');
      setEditCustomRole(currentRole);
    }
    setEditStatus(p.status || 'active');
    setEditAdjVb('0');
    setEditAdjReason('GM Discretionary Grant');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParticipant) return;
    setEditSubmitting(true);
    try {
      const finalRole = editCompanyRole === 'Other' ? (editCustomRole.trim() || 'Core Operator') : editCompanyRole;
      const res = await fetch('/api/gm/accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountType: 'participant',
          id: editingParticipant.id,
          name: editName,
          citizenCode: editCitizenCode,
          role: editRole,
          companyId: editCompanyId,
          companyRole: finalRole,
          status: editStatus,
          newPassword: editPassword.trim() || undefined,
          adjustmentVb: parseInt(editAdjVb, 10) || 0,
          adjustmentReason: editAdjReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update participant');

      setEditingParticipant(null);
      loadData(query);
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

  const openEditOperatorModal = (op: any) => {
    setEditingOperator(op);
    setEditOpName(op.name);
    setEditOpRole(op.role_id || 'volunteer');
    setEditOpInstitutionId(op.institution_id || '');
    setEditOpIsActive(op.is_active ?? true);
    setEditOpPassword('');
  };

  const handleSaveOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOperator) return;
    setEditOpSubmitting(true);
    try {
      const res = await fetch('/api/gm/accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountType: 'operator',
          id: editingOperator.id,
          name: editOpName,
          role: editOpRole,
          institutionId: editOpInstitutionId || null,
          isActive: editOpIsActive,
          newPassword: editOpPassword.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update operator account');

      setEditingOperator(null);
      loadData(query);
    } catch (err: any) {
      setModalConfig({
        isOpen: true,
        title: 'Operator Update Failed',
        message: err.message,
        type: 'alert',
        variant: 'danger',
        confirmLabel: 'Close',
        onConfirm: () => setModalConfig((prev) => ({ ...prev, isOpen: false })),
      });
    } finally {
      setEditOpSubmitting(false);
    }
  };

  const handleDeleteParticipant = (p: any) => {
    setModalConfig({
      isOpen: true,
      title: 'Delete Participant',
      message: `Permanently delete participant ${p.name} (${p.citizen_code})? This will delete their credential, clear memberships, and wipe active mission instances.`,
      type: 'confirm',
      variant: 'danger',
      confirmLabel: 'Delete Citizen',
      cancelLabel: 'Cancel',
      onCancel: () => setModalConfig((prev) => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch(`/api/gm/accounts?participantId=${encodeURIComponent(p.id)}`, {
            method: 'DELETE',
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to delete participant');

          loadData(query);
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

  const handleDeleteOperator = (op: any) => {
    setModalConfig({
      isOpen: true,
      title: 'Delete Operator Account',
      message: `Permanently delete operator ${op.name} (${op.username})? They will lose access to desk terminals immediately.`,
      type: 'confirm',
      variant: 'danger',
      confirmLabel: 'Delete Operator',
      cancelLabel: 'Cancel',
      onCancel: () => setModalConfig((prev) => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
        try {
          const res = await fetch(`/api/gm/accounts?operatorId=${encodeURIComponent(op.id)}`, {
            method: 'DELETE',
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to delete operator');

          loadData(query);
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

  const handleAutoAssignMissions = () => {
    setModalConfig({
      isOpen: true,
      title: 'Automated Mission Docket Distribution',
      message: 'Run automated mission distribution? This will assign 10 tailored missions (easy wave 1 starter missions to late-game espionage and tier milestones) to every participant and founder based on their specific company and role.',
      type: 'confirm',
      variant: 'gold',
      confirmLabel: 'Distribute 10 Missions',
      cancelLabel: 'Cancel',
      onCancel: () => setModalConfig((prev) => ({ ...prev, isOpen: false })),
      onConfirm: async () => {
        setModalConfig((prev) => ({ ...prev, isOpen: false }));
        setAssigningMissions(true);
        setAssignResult(null);
        try {
          const res = await fetch('/api/gm/missions/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cleanExisting: true, missionsPerParticipant: 10 }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Auto-assignment failed');

          setAssignResult(`Assigned 10 missions each across ${data.participantsAssigned} citizens (${data.instancesAssigned} total instances)!`);
        } catch (err: any) {
          setModalConfig({
            isOpen: true,
            title: 'Assignment Failed',
            message: err.message,
            type: 'alert',
            variant: 'danger',
            confirmLabel: 'Close',
            onConfirm: () => setModalConfig((prev) => ({ ...prev, isOpen: false })),
          });
        } finally {
          setAssigningMissions(false);
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header and Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-syne font-black text-white flex items-center gap-2">
            ACCOUNTS & ROLE GOVERNANCE
          </h1>
          <p className="text-xs text-gray-400">
            CRUD credentials, reset passwords, allocate company roles, and manage station operators.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleAutoAssignMissions}
            disabled={assigningMissions}
            className="bg-vc-emerald hover:bg-emerald-400 text-black font-syne font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow transition-all disabled:opacity-50"
            title="Distribute 10 role-based missions to every citizen"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{assigningMissions ? 'Distributing...' : 'Assign 10 Missions / Head'}</span>
          </button>

          <button
            onClick={() => {
              setCreateResult(null);
              setShowCreateModal(true);
            }}
            className="bg-vc-gold hover:bg-yellow-400 text-black font-syne font-bold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Create Account</span>
          </button>
        </div>
      </div>

      {assignResult && (
        <div className="p-3 bg-vc-emerald/10 border border-vc-emerald/30 text-vc-emerald rounded font-mono text-xs flex items-center justify-between">
          <span>✦ {assignResult}</span>
          <button onClick={() => setAssignResult(null)} className="text-gray-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Tabs & Search Strip */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-gray-800 pb-3">
        <div className="flex items-center gap-2 bg-gray-900/80 p-1 rounded-lg border border-gray-800 text-xs font-mono">
          <button
            onClick={() => setActiveTab('citizens')}
            className={`px-3.5 py-1.5 rounded-md font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'citizens' ? 'bg-vc-gold text-black shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Citizens & Founders ({participants.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('operators')}
            className={`px-3.5 py-1.5 rounded-md font-bold transition-colors flex items-center gap-1.5 ${
              activeTab === 'operators' ? 'bg-vc-gold text-black shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Landmark className="w-3.5 h-3.5" />
            <span>Station Operators ({operators.length})</span>
          </button>
        </div>

        {activeTab === 'citizens' && (
          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                loadData(e.target.value);
              }}
              placeholder="Filter by code, name, venture..."
              className="w-full bg-vc-card border border-gray-800 focus:border-vc-gold text-white pl-9 pr-3 py-2 rounded-lg text-xs outline-none font-mono"
            />
          </div>
        )}
      </div>

      {/* Citizens View */}
      {activeTab === 'citizens' && (
        <div className="bg-vc-card border border-vc-border rounded-xl shadow-xl overflow-hidden font-mono text-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[650px]">
              <thead className="bg-[#030712] border-b border-gray-800 text-gray-400 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Citizen Code</th>
                  <th className="py-3 px-4">Citizen Name</th>
                  <th className="py-3 px-4">Affiliated Venture</th>
                  <th className="py-3 px-4">Designation / Role</th>
                  <th className="py-3 px-4 text-right">Personal Wallet</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">GM Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/80">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      Scanning citizen registry...
                    </td>
                  </tr>
                ) : participants.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-500">
                      No citizens matching query &ldquo;{query}&rdquo;
                    </td>
                  </tr>
                ) : (
                  participants.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-900/60 transition-colors">
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleCopy(p.citizen_code)}
                          className="font-bold text-vc-gold hover:underline inline-flex items-center gap-1.5"
                          title="Click to copy code"
                        >
                          <span>{p.citizen_code}</span>
                          {copiedId === p.citizen_code ? (
                            <Check className="w-3 h-3 text-vc-emerald" />
                          ) : (
                            <Copy className="w-3 h-3 text-gray-600 hover:text-vc-gold" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 font-medium text-white">{p.name}</td>
                      <td className="py-3 px-4 text-gray-300">
                        {p.company_name || <span className="text-gray-500 italic">Independent Free Agent</span>}
                      </td>
                      <td className="py-3 px-4 text-gray-400">
                        {p.company_role || 'Free Agent'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-vc-emerald">
                        {p.wallet_balance !== undefined ? `${p.wallet_balance.toLocaleString()} VB` : '500 VB'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold border ${
                          p.status === 'active'
                            ? 'bg-vc-emerald/10 text-vc-emerald border-vc-emerald/30'
                            : 'bg-vc-rose/10 text-vc-rose border-vc-rose/30'
                        }`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1 text-gray-400 hover:text-vc-gold rounded hover:bg-gray-800 transition-colors"
                            title="Edit Profile & Reset Password"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteParticipant(p)}
                            className="p-1 text-gray-400 hover:text-vc-rose rounded hover:bg-gray-800 transition-colors"
                            title="Delete / Revoke Participant"
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
        </div>
      )}

      {/* Operators View */}
      {activeTab === 'operators' && (
        <div className="bg-vc-card border border-vc-border rounded-xl shadow-xl overflow-hidden font-mono text-xs">
          <div className="p-4 border-b border-gray-800 bg-[#030712] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-syne font-bold text-white">System & Desk Operators</h2>
              <p className="text-[11px] text-gray-400">
                Institutional station managers (Bank, Investor, Customer Desk, Talent, Logistics, Media, Gov) and City Admins.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[650px]">
              <thead className="bg-[#030712] border-b border-gray-800 text-gray-400 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">Operator Name</th>
                  <th className="py-3 px-4">System Role</th>
                  <th className="py-3 px-4">Assigned Station</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">GM Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/80">
                {operators.map((op) => {
                  const inst = INSTITUTION_OPTIONS.find((i) => i.id === op.institution_id);
                  return (
                    <tr key={op.id} className="hover:bg-gray-900/60 transition-colors">
                      <td className="py-3 px-4 font-bold text-vc-gold">{op.username}</td>
                      <td className="py-3 px-4 font-medium text-white">{op.name}</td>
                      <td className="py-3 px-4">
                        <span className="text-[10px] uppercase px-2 py-0.5 rounded font-bold bg-vc-blue/10 text-vc-blue border border-vc-blue/30">
                          {op.role_id}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-300">
                        {inst ? (
                          <span className="text-white font-medium">{inst.name}</span>
                        ) : (
                          <span className="text-gray-500 italic">None / Global Supervisory</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold border ${
                          op.is_active
                            ? 'bg-vc-emerald/10 text-vc-emerald border-vc-emerald/30'
                            : 'bg-vc-rose/10 text-vc-rose border-vc-rose/30'
                        }`}>
                          {op.is_active ? 'ACTIVE' : 'SUSPENDED'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEditOperatorModal(op)}
                            className="p-1 text-gray-400 hover:text-vc-gold rounded hover:bg-gray-800 transition-colors"
                            title="Edit Role & Reset Password"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>
                          {op.username !== 'gm' && (
                            <button
                              onClick={() => handleDeleteOperator(op)}
                              className="p-1 text-gray-400 hover:text-vc-rose rounded hover:bg-gray-800 transition-colors"
                              title="Delete Operator"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Participant Modal (With Password Reset) */}
      {editingParticipant && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-vc-card border border-vc-gold/40 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="font-syne font-bold text-white text-base flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-vc-gold" />
                <span>Edit Citizen Profile & Credentials</span>
              </h3>
              <button onClick={() => setEditingParticipant(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-gray-400 mb-1 font-bold">Full Name:</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-400 mb-1 font-bold">Citizen Code:</label>
                  <input
                    type="text"
                    value={editCitizenCode}
                    onChange={(e) => setEditCitizenCode(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white uppercase outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1 font-bold">Status:</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="revoked">Revoked</option>
                  </select>
                </div>
              </div>

              {/* Password / Event Code Reset */}
              <div className="p-3 bg-black/40 border border-vc-gold/40 rounded-lg space-y-1.5">
                <label className="block text-vc-gold font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" />
                    <span>Reset Event Pass / Password:</span>
                  </span>
                  <span className="text-[10px] text-gray-500 font-normal">Blank = keep unchanged</span>
                </label>
                <input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="e.g. VC2026 or new custom pass"
                  className="w-full bg-gray-900 border border-gray-700 focus:border-vc-gold rounded px-3 py-1.5 text-white font-mono outline-none"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-bold">Assigned Venture (12 Official):</label>
                <select
                  value={editCompanyId}
                  onChange={(e) => setEditCompanyId(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none"
                >
                  {COMPANY_OPTIONS.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-bold">Role / Designation:</label>
                <select
                  value={editCompanyRole}
                  onChange={(e) => setEditCompanyRole(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none"
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                  <option value="Other">✦ Other / Custom Role...</option>
                </select>
              </div>

              {editCompanyRole === 'Other' && (
                <div>
                  <label className="block text-vc-gold mb-1 font-bold">Custom Designation:</label>
                  <input
                    type="text"
                    value={editCustomRole}
                    onChange={(e) => setEditCustomRole(e.target.value)}
                    placeholder="e.g. Lead Systems Engineer, Dispatch Controller"
                    className="w-full bg-gray-900 border border-vc-gold/60 focus:border-vc-gold rounded px-3 py-2 text-white font-mono outline-none"
                    required
                  />
                </div>
              )}

              <div className="p-3 bg-black/40 border border-gray-800 rounded space-y-2">
                <div className="text-[11px] font-bold text-vc-gold">Discretionary Wallet Adjustment:</div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={editAdjVb}
                    onChange={(e) => setEditAdjVb(e.target.value)}
                    placeholder="+/- VB"
                    className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-white outline-none"
                  />
                  <input
                    type="text"
                    value={editAdjReason}
                    onChange={(e) => setEditAdjReason(e.target.value)}
                    placeholder="Reason"
                    className="bg-gray-900 border border-gray-700 rounded px-3 py-1.5 text-white outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setEditingParticipant(null)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="px-4 py-2 bg-vc-gold hover:bg-yellow-400 text-black font-syne font-bold rounded"
                >
                  {editSubmitting ? 'Saving...' : 'Save Profile & Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Operator Modal (With Password Reset) */}
      {editingOperator && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-vc-card border border-vc-gold/40 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="font-syne font-bold text-white text-base flex items-center gap-2">
                <Key className="w-4 h-4 text-vc-gold" />
                <span>Edit Operator & Reset Password</span>
              </h3>
              <button onClick={() => setEditingOperator(null)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveOperator} className="space-y-4">
              <div>
                <label className="block text-gray-400 mb-1 font-bold">Username:</label>
                <input
                  type="text"
                  disabled
                  value={editingOperator.username}
                  className="w-full bg-black/60 border border-gray-800 rounded px-3 py-2 text-gray-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-bold">Operator Name / Title:</label>
                <input
                  type="text"
                  value={editOpName}
                  onChange={(e) => setEditOpName(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-400 mb-1 font-bold">Role Category:</label>
                  <select
                    value={editOpRole}
                    onChange={(e) => setEditOpRole(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none"
                  >
                    <option value="volunteer">volunteer (Station)</option>
                    <option value="admin">admin (Tech Lead)</option>
                    <option value="event_lead">event_lead (Operations)</option>
                    <option value="observer">observer (Evidence)</option>
                    <option value="gm">gm (Game Master)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-gray-400 mb-1 font-bold">Status:</label>
                  <select
                    value={editOpIsActive ? 'active' : 'suspended'}
                    onChange={(e) => setEditOpIsActive(e.target.value === 'active')}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 mb-1 font-bold">Assigned Institution Station:</label>
                <select
                  value={editOpInstitutionId}
                  onChange={(e) => setEditOpInstitutionId(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none"
                >
                  {INSTITUTION_OPTIONS.map((inst) => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
              </div>

              {/* Password Reset */}
              <div className="p-3 bg-black/40 border border-vc-gold/40 rounded-lg space-y-1.5">
                <label className="block text-vc-gold font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Change Operator Password:</span>
                  </span>
                  <span className="text-[10px] text-gray-500 font-normal">Blank = keep unchanged</span>
                </label>
                <input
                  type="text"
                  value={editOpPassword}
                  onChange={(e) => setEditOpPassword(e.target.value)}
                  placeholder="Enter new secret password..."
                  className="w-full bg-gray-900 border border-gray-700 focus:border-vc-gold rounded px-3 py-1.5 text-white font-mono outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                <button
                  type="button"
                  onClick={() => setEditingOperator(null)}
                  className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editOpSubmitting}
                  className="px-4 py-2 bg-vc-gold hover:bg-yellow-400 text-black font-syne font-bold rounded"
                >
                  {editOpSubmitting ? 'Saving...' : 'Save Operator Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-vc-card border border-vc-border rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-2xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h3 className="font-syne font-bold text-white text-base">Issue Credentials & Account (GM)</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            {createResult ? (
              <div className="space-y-4">
                <div className="p-3 bg-vc-emerald/10 border border-vc-emerald/30 text-vc-emerald rounded">
                  <div className="font-bold">Account Created Successfully!</div>
                  <div className="mt-2 space-y-1 text-white">
                    {createResult.citizenCode && (
                      <div>Citizen Code: <strong className="text-vc-gold">{createResult.citizenCode}</strong></div>
                    )}
                    {createResult.username && (
                      <div>Username: <strong className="text-vc-gold">{createResult.username}</strong></div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="w-full py-2 bg-vc-gold text-black font-syne font-bold rounded"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div>
                  <label className="block text-gray-400 mb-1 font-bold">Account Category:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAccountType('participant')}
                      className={`py-2 rounded font-bold text-center border ${
                        accountType === 'participant'
                          ? 'bg-vc-gold text-black border-vc-gold'
                          : 'bg-gray-900 text-gray-400 border-gray-700'
                      }`}
                    >
                      Citizen / Founder
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountType('operator')}
                      className={`py-2 rounded font-bold text-center border ${
                        accountType === 'operator'
                          ? 'bg-vc-gold text-black border-vc-gold'
                          : 'bg-gray-900 text-gray-400 border-gray-700'
                      }`}
                    >
                      Station Operator
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 mb-1 font-bold">Full Name / Title:</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Maya Lin"
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none"
                    required
                  />
                </div>

                {accountType === 'participant' ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-gray-400 mb-1 font-bold">Role:</label>
                        <select
                          value={formRole}
                          onChange={(e) => setFormRole(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none"
                        >
                          <option value="participant">Participant</option>
                          <option value="company_lead">Company Lead / Founder</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-gray-400 mb-1 font-bold">Initial VB Staking:</label>
                        <input
                          type="number"
                          value={formInitialBalance}
                          onChange={(e) => setFormInitialBalance(e.target.value)}
                          className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-gray-400 mb-1 font-bold">Assigned Venture:</label>
                      <select
                        value={formCompanyId}
                        onChange={(e) => setFormCompanyId(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none"
                      >
                        {COMPANY_OPTIONS.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-gray-400 mb-1 font-bold">Company Role:</label>
                      <select
                        value={formCompanyRole}
                        onChange={(e) => setFormCompanyRole(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none"
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                        <option value="Other">✦ Other / Custom Role...</option>
                      </select>
                    </div>

                    {formCompanyRole === 'Other' && (
                      <div>
                        <label className="block text-vc-gold mb-1 font-bold">Custom Designation:</label>
                        <input
                          type="text"
                          value={formCustomRole}
                          onChange={(e) => setFormCustomRole(e.target.value)}
                          placeholder="e.g. Lead Robotics Technician"
                          className="w-full bg-gray-900 border border-vc-gold/60 focus:border-vc-gold rounded px-3 py-2 text-white font-mono outline-none"
                          required
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-gray-400 mb-1 font-bold">Username:</label>
                        <input
                          type="text"
                          value={formUsername}
                          onChange={(e) => setFormUsername(e.target.value)}
                          placeholder="e.g. volunteer_bank"
                          className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-gray-400 mb-1 font-bold">Password:</label>
                        <input
                          type="text"
                          value={formPassword}
                          onChange={(e) => setFormPassword(e.target.value)}
                          placeholder="e.g. bank-volunteer-2026"
                          className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white font-mono outline-none"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-gray-400 mb-1 font-bold">Operator Role:</label>
                      <select
                        value={formOperatorRole}
                        onChange={(e) => setFormOperatorRole(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none"
                      >
                        <option value="volunteer">volunteer (Station Desk)</option>
                        <option value="admin">admin (Tech Admin)</option>
                        <option value="event_lead">event_lead (Operations Lead)</option>
                        <option value="observer">observer (Observer / Evaluator)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-gray-400 mb-1 font-bold">Institution Desk Assigned:</label>
                      <select
                        value={formInstitutionId}
                        onChange={(e) => setFormInstitutionId(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white outline-none"
                      >
                        {INSTITUTION_OPTIONS.map((inst) => (
                          <option key={inst.id} value={inst.id}>{inst.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createSubmitting}
                    className="px-4 py-2 bg-vc-gold hover:bg-yellow-400 text-black font-syne font-bold rounded"
                  >
                    {createSubmitting ? 'Creating...' : 'Issue Credentials'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Confirmation & Alert Dialog */}
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
