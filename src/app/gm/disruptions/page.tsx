'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  Zap,
  Cpu,
  Truck,
  Landmark,
  Radio,
  Flame,
  AlertTriangle,
  Play,
  CheckCircle2,
  ShieldAlert,
  Zap,
  Cpu,
  Truck,
  Landmark,
  Radio,
  Flame,
  AlertTriangle,
  Play,
  CheckCircle2,
  Sparkles,
  Activity,
  Factory,
  Users,
  Coins,
  AlertOctagon,
  Lock,
  Scale,
  FileText,
  Briefcase,
  TrendingUp,
  DollarSign,
  Globe,
} from 'lucide-react';
import { ModalDialog } from '@/components/ui/modal-dialog';

const SHOCK_PRESETS = [
  {
    id: 'compute_crunch',
    title: 'Global Photonic Chip Shortage',
    icon: Cpu,
    category: 'HARDWARE CRUNCH',
    color: 'text-vc-gold border-vc-gold/30',
    description: 'Surge in high-performance cloud compute demand spikes compute base price by +50%.',
    type: 'price_shock',
    params: { targetResource: 'compute', factor: 1.5, priceChangePercent: 50 },
  },
  {
    id: 'grid_outage',
    title: 'Substation Clean Energy Brownout',
    icon: Zap,
    category: 'INFRASTRUCTURE SHOCK',
    color: 'text-amber-400 border-amber-500/30',
    description: 'Rolling clean energy grid outages reduce industrial capacity and surge energy prices by +40%.',
    type: 'grid_outage',
    params: { targetResource: 'energy', factor: 1.4, priceChangePercent: 40 },
  },
  {
    id: 'logistics_strike',
    title: 'Intermodal Freight & Fleet Strike',
    icon: Truck,
    category: 'CAPACITY DROPOFF',
    color: 'text-cyan-400 border-cyan-500/30',
    description: 'Intermodal freight routes blocked. Swift Logistics provider capacity cut by -50%, logistics rates +35%.',
    type: 'capacity_drop',
    params: { institutionId: 'logistics', capacityFactor: 0.5, targetResource: 'logistics', priceChangePercent: 35 },
  },
  {
    id: 'bank_run',
    title: 'Macro Liquidity Shock / Credit Freeze',
    icon: Landmark,
    category: 'CAPITAL CRISIS',
    color: 'text-rose-400 border-rose-500/30',
    description: 'Apex Reserve Bank suffers deposit withdrawal pressure. Lending pool cut by 30,000 VB.',
    type: 'bank_run',
    params: { poolReduction: 30000 },
  },
  {
    id: 'data_breach',
    title: 'High-Frequency Cyber Attack & Telemetry Leak',
    icon: ShieldAlert,
    category: 'DIGITAL THREAT',
    color: 'text-red-400 border-red-500/30',
    description: 'Ransomware hits major city databases. Data base price spikes +60%, mandatory TrustLayer audits required.',
    type: 'price_shock',
    params: { targetResource: 'data', priceChangePercent: 60 },
  },
  {
    id: 'material_embargo',
    title: 'Sovereign Raw Material Trade Embargo',
    icon: Factory,
    category: 'SUPPLY CHAIN',
    color: 'text-emerald-400 border-emerald-500/30',
    description: 'Geopolitical export restrictions choke fabrication plants. Raw material input costs soar by +50%.',
    type: 'price_shock',
    params: { targetResource: 'materials', priceChangePercent: 50 },
  },
  {
    id: 'hyperscaler_fire',
    title: 'StackHouse Server Colocation Outage',
    icon: Flame,
    category: 'DATA CENTRE CRISIS',
    color: 'text-orange-400 border-orange-500/30',
    description: 'Core server facility thermal failure cuts cloud hosting rack availability. Infrastructure prices jump +50%.',
    type: 'price_shock',
    params: { targetResource: 'infrastructure', priceChangePercent: 50 },
  },
  {
    id: 'talent_wage_inflation',
    title: 'Senior Engineering Salary Escalation Spiral',
    icon: Users,
    category: 'LABOR MARKET',
    color: 'text-blue-400 border-blue-500/30',
    description: 'Aggressive recruitment wars push Metro Talent Exchange base salaries up by +30 VB per tick across all tiers.',
    type: 'wage_inflation',
    params: { wageIncrease: 30 },
  },
  {
    id: 'counterfeit_goods',
    title: 'Fraudulent Raw Inventory Influx',
    icon: AlertTriangle,
    category: 'QUALITY CONTROL',
    color: 'text-yellow-400 border-yellow-500/30',
    description: 'Substandard parts flood secondary exchanges. Materials price crashes by -25%, requiring verified supplier re-inspection.',
    type: 'price_shock',
    params: { targetResource: 'materials', priceChangePercent: -25 },
  },
  {
    id: 'vc_fund_lockup',
    title: 'Frontier Fund Sovereign Capital Call',
    icon: Coins,
    category: 'CAPITAL FREEZE',
    color: 'text-purple-400 border-purple-500/30',
    description: 'Limited partners institute strict liquidity gates. Frontier Fund deployment capacity slashed by 40,000 VB.',
    type: 'fund_freeze',
    params: { fundReduction: 40000 },
  },
  {
    id: 'cold_chain_failure',
    title: 'SwiftCart Cold-Chain Logistics Breakdown',
    icon: AlertOctagon,
    category: 'HEALTH & SAFETY',
    color: 'text-teal-400 border-teal-500/30',
    description: 'Refrigerated van temperature telemetry alarms trigger citywide perishables inspection. Fleet rates spike +45%.',
    type: 'price_shock',
    params: { targetResource: 'logistics', priceChangePercent: 45 },
  },
  {
    id: 'payment_gateway_down',
    title: 'Ledgerly Merchant Rails Insolvency Threat',
    icon: Lock,
    category: 'FINTECH OUTAGE',
    color: 'text-indigo-400 border-indigo-500/30',
    description: 'Inter-bank settlement rails experience delayed batch clearance. Transaction data verification fees jump +40%.',
    type: 'price_shock',
    params: { targetResource: 'data', priceChangePercent: 40 },
  },
  {
    id: 'carbon_border_tax',
    title: 'Municipal Carbon Emissions Surcharge',
    icon: Scale,
    category: 'REGULATORY SHOCK',
    color: 'text-green-400 border-green-500/30',
    description: 'City Council imposes emergency carbon taxes on heavy industrial energy users. Clean energy tariff increases +50%.',
    type: 'price_shock',
    params: { targetResource: 'energy', priceChangePercent: 50 },
  },
  {
    id: 'ai_hallucination_order',
    title: 'PulseAI Predictive Model Malpractice Injunction',
    icon: Activity,
    category: 'ALGORITHMIC RISK',
    color: 'text-pink-400 border-pink-500/30',
    description: 'Regulatory audit launched into forecasting models. Compute validation demand increases compute rates by +35%.',
    type: 'price_shock',
    params: { targetResource: 'compute', priceChangePercent: 35 },
  },
  {
    id: 'pharma_data_subpoena',
    title: 'MediLink Health Telemetry Privacy Subpoena',
    icon: FileText,
    category: 'DATA COMPLIANCE',
    color: 'text-rose-300 border-rose-400/30',
    description: 'Healthcare data governance probe opens. Anonymous clinical records undergo mandatory sovereign quarantine.',
    type: 'price_shock',
    params: { targetResource: 'data', priceChangePercent: 30 },
  },
  {
    id: 'procurement_slump',
    title: 'Enterprise Customer Procurement Austerity Cut',
    icon: Briefcase,
    category: 'DEMAND SHOCK',
    color: 'text-amber-300 border-amber-400/30',
    description: 'Enterprise conglomerate freezes non-critical procurement budgets. Anchor contracts require higher performance bonds.',
    type: 'capacity_drop',
    params: { institutionId: 'enterprise_customer', capacityFactor: 0.6 },
  },
  {
    id: 'supplier_cartel',
    title: 'Prime Supplier Monopolistic Offtake Accord',
    icon: TrendingUp,
    category: 'SUPPLY MONOPOLY',
    color: 'text-violet-400 border-violet-500/30',
    description: 'Supplier consortium eliminates bulk order discounts and raises standard raw material delivery base price by +40%.',
    type: 'price_shock',
    params: { targetResource: 'materials', priceChangePercent: 40 },
  },
  {
    id: 'currency_inflation',
    title: 'Citywide Currency Devaluation Wave',
    icon: DollarSign,
    category: 'MACRO INFLATION',
    color: 'text-yellow-500 border-yellow-500/30',
    description: 'Rapid velocity of venture capital stakings triggers +25% general inflation across all 6 base resources.',
    type: 'inflation_spike',
    params: { allResources: true, priceChangePercent: 25 },
  },
  {
    id: 'emergency_stimulus',
    title: 'Sovereign Emergency Green Innovation Stimulus',
    icon: Sparkles,
    category: 'EXPANSIONARY STIMULUS',
    color: 'text-emerald-300 border-emerald-400/30',
    description: 'Department of Commerce injects +30,000 VB into the Sovereign Grant pool to accelerate sustainable ventures.',
    type: 'grant_stimulus',
    params: { grantAddition: 30000 },
  },
  {
    id: 'talent_brain_drain',
    title: 'Offshore Syndicate Poaching & Talent Deficit',
    icon: Globe,
    category: 'HUMAN CAPITAL DEFICIT',
    color: 'text-sky-400 border-sky-500/30',
    description: 'Foreign technology syndicates offer lucrative overseas buyouts. Local specialist contractor availability drops by -40%.',
    type: 'capacity_drop',
    params: { institutionId: 'talent_exchange', capacityFactor: 0.6 },
  },
];

export default function GmDisruptionsPage() {
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Custom Disturbance State
  const [customTitle, setCustomTitle] = useState('');
  const [customCategory, setCustomCategory] = useState('regulatory');
  const [customDesc, setCustomDesc] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [broadcastAnnouncement, setBroadcastAnnouncement] = useState(true);
  const [customSubmitting, setCustomSubmitting] = useState(false);

  // Modal Dialog State
  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    message?: string;
    type?: 'confirm' | 'alert' | 'prompt';
    variant?: 'danger' | 'gold' | 'emerald';
    promptPlaceholder?: string;
    promptValue?: string;
    onPromptChange?: (val: string) => void;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'confirm',
    variant: 'gold',
    onConfirm: () => {},
  });

  const triggerPreset = (preset: typeof SHOCK_PRESETS[0]) => {
    let currentReason = `GM Disruption: ${preset.title}`;
    setDialogConfig({
      isOpen: true,
      title: `Trigger ${preset.title}`,
      message: `Inject economic shock "${preset.title}" into the live simulation? Written regulatory reason is permanently audited.`,
      type: 'prompt',
      variant: 'danger',
      promptPlaceholder: 'State GM regulatory or simulation rationale...',
      promptValue: currentReason,
      onPromptChange: (val) => {
        currentReason = val;
        setDialogConfig((prev) => ({ ...prev, promptValue: val }));
      },
      onConfirm: async () => {
        setDialogConfig((prev) => ({ ...prev, isOpen: false }));
        setTriggeringId(preset.id);
        setSuccessMsg(null);
        try {
          // 1. Dispatch disruption
          const res = await fetch('/api/gm/disruption', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              disruptionType: preset.type,
              params: preset.params,
              reason: currentReason || `GM Disruption: ${preset.title}`,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to trigger disruption');

          // 2. Broadcast announcement so players see it
          await fetch('/api/announcements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: `BREAKING ECONOMY SHOCK: ${preset.title}`,
              message: `BREAKING ECONOMY SHOCK [${preset.title.toUpperCase()}]: ${preset.description}`,
              priority: 'urgent',
              reason: `Disruption trigger: ${preset.id}`,
            }),
          });

          setSuccessMsg(`Disruption '${preset.title}' successfully injected into simulation!`);
        } catch (err: any) {
          setDialogConfig({
            isOpen: true,
            title: 'Disruption Error',
            message: err.message,
            type: 'alert',
            variant: 'danger',
            onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
          });
        } finally {
          setTriggeringId(null);
        }
      },
    });
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCustomSubmitting(true);
    setSuccessMsg(null);
    try {
      // 1. Trigger custom disruption
      const res = await fetch('/api/gm/disruption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disruptionType: 'custom',
          params: { title: customTitle, category: customCategory, description: customDesc },
          reason: customReason || `Custom GM Disturbance: ${customTitle}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to trigger custom event');

      // 2. Broadcast if checked
      if (broadcastAnnouncement) {
        await fetch('/api/announcements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: `CITY DIRECTIVE: ${customTitle}`,
            message: `CITY DIRECTIVE [${customTitle.toUpperCase()}]: ${customDesc}`,
            priority: 'urgent',
            reason: customReason || 'GM Custom Directive',
          }),
        });
      }

      setSuccessMsg(`Custom disturbance '${customTitle}' injected successfully!`);
      setCustomTitle('');
      setCustomDesc('');
      setCustomReason('');
    } catch (err: any) {
      setDialogConfig({
        isOpen: true,
        title: 'Directive Error',
        message: err.message,
        type: 'alert',
        variant: 'danger',
        onConfirm: () => setDialogConfig((prev) => ({ ...prev, isOpen: false })),
      });
    } finally {
      setCustomSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 font-mono text-xs">
      <div>
        <h1 className="text-2xl font-syne font-black text-white">SIMULATION DISRUPTION & EVENTS ENGINE</h1>
        <p className="text-xs text-gray-400">
          Inject macro shocks, resource shortages, liquidity crunches, and custom narrative missions into the city.
        </p>
      </div>

      {successMsg && (
        <div className="p-3 bg-vc-emerald/10 border border-vc-emerald/30 text-vc-emerald rounded-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Preset Macro Shocks */}
      <div className="space-y-3">
        <h2 className="text-sm font-syne font-bold text-white uppercase tracking-wider flex items-center gap-2">
          <Flame className="w-4 h-4 text-vc-rose" />
          <span>Standard Macro Disturbance Presets</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SHOCK_PRESETS.map((p) => {
            const Icon = p.icon;
            const isRunning = triggeringId === p.id;

            return (
              <div
                key={p.id}
                className="bg-vc-card border border-vc-border rounded-xl p-5 shadow flex flex-col justify-between space-y-4 hover:border-vc-rose/40 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-vc-rose uppercase tracking-wider bg-vc-rose/10 px-2 py-0.5 rounded border border-vc-rose/20">
                      {p.category}
                    </span>
                    <Icon className="w-5 h-5 text-gray-400" />
                  </div>

                  <h3 className="text-base font-syne font-bold text-white">{p.title}</h3>
                  <p className="text-xs text-gray-400 leading-relaxed">{p.description}</p>
                </div>

                <div className="pt-3 border-t border-gray-800">
                  <button
                    onClick={() => triggerPreset(p)}
                    disabled={isRunning}
                    className="w-full bg-vc-rose/10 hover:bg-vc-rose/20 text-vc-rose font-syne font-bold text-xs py-2 px-3 rounded-lg border border-vc-rose/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{isRunning ? 'Injecting Disturbance...' : 'Trigger Shock'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Disturbance & Mission Creator */}
      <div className="bg-vc-card border border-vc-border rounded-xl p-6 shadow space-y-4">
        <div className="border-b border-gray-800 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-vc-gold" />
            <h2 className="text-base font-syne font-bold text-white uppercase">
              Author Custom Event or Disruption Directive
            </h2>
          </div>
          <p className="text-xs text-gray-400">
            Define dynamic events, market disturbances, unexpected opportunities, or regulatory mandates on the fly.
          </p>
        </div>

        <form onSubmit={handleCustomSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 mb-1 font-bold">Event / Disturbance Title:</label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="e.g. Rare Materials Export Ban"
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                required
              />
            </div>

            <div>
              <label className="block text-gray-400 mb-1 font-bold">Category:</label>
              <select
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
              >
                <option value="regulatory">Regulatory Intervention</option>
                <option value="market_shock">Market Price Shock</option>
                <option value="opportunity">Surprise Opportunity / Mission</option>
                <option value="infrastructure">Infrastructure Breakdown</option>
                <option value="geopolitical">Geopolitical Event</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-gray-400 mb-1 font-bold">Directive Content & Rules:</label>
            <textarea
              rows={3}
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
              placeholder="Describe the real-world condition, rules adjustment, or mission instructions for participants..."
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
              required
            />
          </div>

          <div>
            <label className="block text-gray-400 mb-1 font-bold">Written GM Authorisation Reason:</label>
            <input
              type="text"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="e.g. Introducing Mid-Day Volatility to test company runway adaptability"
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
              required
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="broadcast"
              checked={broadcastAnnouncement}
              onChange={(e) => setBroadcastAnnouncement(e.target.checked)}
              className="rounded bg-gray-900 border-gray-700 text-vc-gold"
            />
            <label htmlFor="broadcast" className="text-gray-300">
              Immediately broadcast urgent announcement banner across all participant screens
            </label>
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-800">
            <button
              type="submit"
              disabled={customSubmitting}
              className="bg-vc-gold hover:bg-yellow-400 text-black font-syne font-bold text-xs px-5 py-2.5 rounded-lg flex items-center gap-2 shadow"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>{customSubmitting ? 'Dispatching...' : 'Dispatch Event into City'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Styled Dialog Modal */}
      <ModalDialog
        isOpen={dialogConfig.isOpen}
        title={dialogConfig.title}
        message={dialogConfig.message}
        type={dialogConfig.type}
        variant={dialogConfig.variant}
        promptPlaceholder={dialogConfig.promptPlaceholder}
        promptValue={dialogConfig.promptValue}
        onPromptChange={dialogConfig.onPromptChange}
        onConfirm={dialogConfig.onConfirm}
        onCancel={() => setDialogConfig((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
