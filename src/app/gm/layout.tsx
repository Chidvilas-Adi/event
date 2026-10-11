'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Wordmark } from '@/components/ui/wordmark';
import { StatusChip } from '@/components/ui/status-chip';
import {
  ShieldAlert,
  Play,
  Pause,
  FastForward,
  Snowflake,
  LogOut,
  Building2,
  Users,
  Landmark,
  BookOpen,
  FileText,
  Radio,
  Download,
  LayoutDashboard,
  AlertTriangle,
  Activity,
  Flame,
  Terminal,
  Sparkles,
  Award,
  RotateCcw,
} from 'lucide-react';

export default function GmLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [world, setWorld] = useState<{
    clockSeconds: number;
    currentTick: number;
    wave?: number;
    isPaused: boolean;
    isFrozen: boolean;
    freezeReason?: string | null;
  }>({
    clockSeconds: 0,
    currentTick: 1,
    wave: 1,
    isPaused: false,
    isFrozen: false,
  });

  const [user, setUser] = useState<any>(null);
  const [modalAction, setModalAction] = useState<string | null>(null);
  const [modalReason, setModalReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Wave & Reset States
  const [waveLoading, setWaveLoading] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);

  const handleSetWave = async (w: number) => {
    setWaveLoading(true);
    try {
      const res = await fetch('/api/gm/wave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wave: w }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to change wave');
      setWorld((prev) => ({ ...prev, wave: w }));
    } catch (err: any) {
      alert(err.message || 'Error updating wave');
    } finally {
      setWaveLoading(false);
    }
  };

  const handleExecuteReset = async () => {
    if (resetConfirmation.trim().toUpperCase() !== 'RESET') {
      alert('Please type RESET to confirm complete world restoration.');
      return;
    }
    setResetLoading(true);
    setResetFeedback(null);
    try {
      const res = await fetch('/api/gm/reset', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Reset failed');
      setResetFeedback('World reset completed successfully! Restored to canonical Master Catalogue state. Reloading...');
      setTimeout(() => {
        setResetModalOpen(false);
        setResetConfirmation('');
        setResetFeedback(null);
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      setResetFeedback(`Error: ${err.message}`);
    } finally {
      setResetLoading(false);
    }
  };

  // Load user & world state
  const loadWorldState = async () => {
    try {
      const sessRes = await fetch('/api/auth/session');
      if (sessRes.ok) {
        const s = await sessRes.json();
        setUser(s.user);
        if (s.user.role !== 'gm' && s.user.role !== 'admin' && s.user.role !== 'event_lead' && s.user.role !== 'observer') {
          router.push('/portal');
        }
      } else {
        router.push('/login');
      }

      const clkRes = await fetch('/api/world/clock');
      if (clkRes.ok) {
        const c = await clkRes.json();
        setWorld(c);
      }
    } catch {}
  };

  useEffect(() => {
    loadWorldState();
    const interval = setInterval(loadWorldState, 6000);
    // Continuous 1-second live ticker
    const secondTicker = setInterval(() => {
      setWorld((prev: any) => {
        if (!prev?.isPaused && !prev?.isFrozen) {
          return { ...prev, clockSeconds: (prev?.clockSeconds || 0) + 1 };
        }
        return prev;
      });
    }, 1000);
    return () => {
      clearInterval(interval);
      clearInterval(secondTicker);
    };
  }, []);

  const handleWorldAction = async () => {
    if (!modalAction) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch('/api/world/clock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: modalAction,
          reason: modalReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update clock');

      setWorld((prev: any) => ({ ...prev, ...data.state }));
      setModalAction(null);
      setModalReason('');
    } catch (err: any) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const navLinks = [
    { label: 'Control Room', href: '/gm', icon: LayoutDashboard },
    { label: 'Companies', href: '/gm/companies', icon: Building2 },
    { label: 'Citizens', href: '/gm/participants', icon: Users },
    { label: 'Character Monitor', href: '/gm/monitor', icon: Activity },
    { label: 'Disruptions & Shocks', href: '/gm/disruptions', icon: Flame },
    { label: 'Investor Day', href: '/gm/investor-day', icon: Award },
    { label: 'Missions & Intel', href: '/gm/missions', icon: Sparkles },
    { label: 'Tech Engine Console', href: '/gm/tech', icon: Terminal },
    { label: 'Institutions', href: '/gm/institutions', icon: Landmark },
    { label: 'Ledger & Grants', href: '/gm/ledger', icon: BookOpen },
    { label: 'Audit Trail', href: '/gm/audit', icon: FileText },
    { label: 'Broadcasts', href: '/gm/announcements', icon: Radio },
    { label: 'Paper Exports', href: '/gm/export', icon: Download },
  ];

  const formatTime = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#030712] text-gray-100 flex flex-col font-mono selection:bg-vc-gold selection:text-black">
      {/* Top Universal GM Clock & Emergency Control Bar */}
      <header className="bg-vc-card border-b border-vc-border px-5 py-3 sticky top-0 z-50 shadow-xl">
        {world.isFrozen && (
          <div className="bg-vc-rose text-white px-3 py-1.5 -mx-5 -mt-3 mb-2 font-bold text-xs flex items-center justify-between animate-pulse">
            <span className="flex items-center gap-2">
              <Snowflake className="w-4 h-4" /> CITY FROZEN · WRITES LOCKED
            </span>
            <span>Reason: {world.freezeReason}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Wordmark size="sm" showTagline={false} />
            <span className="bg-vc-gold text-black text-[10px] font-bold px-2 py-0.5 rounded tracking-widest uppercase">
              GM CONSOLE
            </span>
          </div>

          {/* Clock controls visible on EVERY GM screen */}
          <div className="flex items-center gap-3 bg-black/60 px-3 py-1.5 rounded-lg border border-gray-800">
            <div className="flex items-center gap-2 text-xs">
              <StatusChip
                label={world.isFrozen ? 'Frozen' : world.isPaused ? 'Paused' : 'Running'}
                variant={world.isFrozen ? 'rose' : world.isPaused ? 'gold' : 'emerald'}
              />
              <span className="text-gray-400">
                TICK <strong className="text-white">{world.currentTick}</strong>
              </span>
              <span className="text-vc-gold font-bold">{formatTime(world.clockSeconds)}</span>
            </div>

            {/* Quick clock action buttons */}
            <div className="flex items-center gap-1.5 border-l border-gray-800 pl-3">
              {world.isPaused ? (
                <button
                  onClick={() => {
                    setModalAction('resume');
                    setModalReason('Routine clock resume');
                    handleWorldAction();
                  }}
                  className="p-1 hover:bg-gray-800 rounded text-vc-emerald"
                  title="Resume Clock"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={() => setModalAction('pause')}
                  className="p-1 hover:bg-gray-800 rounded text-vc-gold"
                  title="Pause Clock"
                >
                  <Pause className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                onClick={() => setModalAction('advance_tick')}
                className="p-1 hover:bg-gray-800 rounded text-vc-blue"
                title="Advance Tick (+30m)"
              >
                <FastForward className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setModalAction(world.isFrozen ? 'unfreeze' : 'freeze')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-all ${
                  world.isFrozen
                    ? 'bg-vc-emerald/20 text-vc-emerald border border-vc-emerald/30'
                    : 'bg-vc-rose/20 hover:bg-vc-rose/30 text-vc-rose border border-vc-rose/40'
                }`}
                title={world.isFrozen ? 'Unfreeze City' : 'Emergency Freeze City'}
              >
                {world.isFrozen ? 'Unfreeze' : 'Freeze'}
              </button>
            </div>
          </div>

          {/* Simulation Wave Switcher */}
          <div className="flex items-center gap-1.5 bg-black/60 px-3 py-1.5 rounded-lg border border-gray-800">
            <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">WAVE</span>
            {[1, 2, 3].map((w) => {
              const isCurrentWave = (world.wave || 1) === w;
              return (
                <button
                  key={w}
                  disabled={waveLoading}
                  onClick={() => handleSetWave(w)}
                  className={`px-2 py-0.5 rounded text-xs font-bold transition-all ${
                    isCurrentWave
                      ? 'bg-vc-gold text-black shadow font-black scale-105'
                      : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                  title={`Start Wave ${w} (${w === 1 ? 'Wave 1: Foundation (Easy)' : w === 2 ? 'Wave 2: Alliances (Medium)' : 'Wave 3: Endgame (Hard)'})`}
                >
                  W{w}
                </button>
              );
            })}
          </div>

          {/* Master World Reset Button */}
          <button
            onClick={() => {
              setResetModalOpen(true);
              setResetConfirmation('');
              setResetFeedback(null);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-500/50 shadow transition-all uppercase"
            title="Restore Entire Simulation to Original Starting State"
          >
            <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
            <span className="font-bold tracking-wider">Reset App</span>
          </button>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 hidden lg:inline">
              Officer: <strong className="text-white">{user?.name || 'Game Master'}</strong>
            </span>
            <button
              onClick={async () => {
                await fetch('/api/auth/logout', { method: 'POST' });
                router.push('/login');
              }}
              className="text-gray-400 hover:text-vc-rose text-xs flex items-center gap-1 border border-gray-800 px-2.5 py-1 rounded"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </div>

        {/* Navigation tabs */}
        <nav className="flex items-center gap-1 overflow-x-auto pt-3 mt-2 border-t border-gray-800/80 text-xs">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 py-1.5 px-3 rounded-md whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-vc-gold text-black font-bold shadow'
                    : 'text-gray-400 hover:text-white hover:bg-gray-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      {/* Main GM Screen Content */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto">{children}</main>

      {/* World Action Modal (Mandatory Written Reason) */}
      {modalAction && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-vc-card border-2 border-vc-gold rounded-xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
              <AlertTriangle className="w-5 h-5 text-vc-gold" />
              <h3 className="text-lg font-syne font-bold text-white uppercase">
                Confirm World Control Action
              </h3>
            </div>

            <p className="text-xs text-gray-300">
              You are about to execute: <strong className="text-vc-gold uppercase">{modalAction}</strong>.
              All actions are permanently audited in the tamper-proof log.
            </p>

            {actionError && (
              <div className="p-3 bg-vc-rose/10 border border-vc-rose/30 text-vc-rose rounded text-xs">
                {actionError}
              </div>
            )}

            <div>
              <label className="block text-[11px] text-gray-400 uppercase tracking-wider mb-1">
                Written Reason (Required)
              </label>
              <textarea
                rows={3}
                required
                value={modalReason}
                onChange={(e) => setModalReason(e.target.value)}
                placeholder="State the regulatory or operational rationale..."
                className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold text-white p-2.5 rounded text-xs outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setModalAction(null);
                  setModalReason('');
                }}
                className="px-3 py-1.5 text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleWorldAction}
                disabled={actionLoading || modalReason.trim().length === 0}
                className="px-4 py-1.5 bg-vc-gold hover:bg-vc-gold-hover text-black text-xs font-syne font-bold rounded uppercase disabled:opacity-50"
              >
                {actionLoading ? 'Executing...' : 'Confirm & Commit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete World Reset Modal */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-vc-card border-2 border-rose-500 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
              <RotateCcw className="w-5 h-5 text-rose-400 animate-spin" style={{ animationDuration: '4s' }} />
              <h3 className="text-lg font-syne font-bold text-white uppercase tracking-wider">
                Restore Entire Simulation to Original State
              </h3>
            </div>

            <div className="space-y-2 text-xs text-gray-300">
              <p className="font-semibold text-rose-300">
                ⚠️ WARNING: This will immediately erase all runtime changes and restore Venture City to the canonical Master Catalogue baseline:
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-400 pl-1">
                <li><strong className="text-white">12 Canonical Companies</strong> restored with 30,000 VB vault balance each</li>
                <li><strong className="text-white">100 Units of Each Resource</strong> restored to all 12 corporate inventories</li>
                <li><strong className="text-white">Clean Cap Tables</strong> (80% Founding Common, 20% Employee Option Pool)</li>
                <li><strong className="text-white">8 Sovereign Institutions</strong> pools refreshed (Bank 80k VB, Fund 140k VB, Customer 200k VB, Govt 30k VB)</li>
                <li><strong className="text-white">100 Citizens</strong> restored with 500 VB starter stakings & default credentials</li>
                <li><strong className="text-white">Simulation Clock</strong> reset to Tick 1, Wave 1, status Active</li>
                <li><strong className="text-white">All Role & Wave Missions</strong> automatically reassigned</li>
              </ul>
            </div>

            {resetFeedback && (
              <div className={`p-3 rounded text-xs border ${resetFeedback.startsWith('Error') ? 'bg-rose-950/40 border-rose-500 text-rose-300' : 'bg-emerald-950/40 border-emerald-500 text-emerald-300 font-bold'}`}>
                {resetFeedback}
              </div>
            )}

            <div>
              <label className="block text-[11px] text-gray-400 uppercase tracking-wider mb-1.5 font-bold">
                Type <span className="text-rose-400 font-mono">RESET</span> below to confirm:
              </label>
              <input
                type="text"
                value={resetConfirmation}
                onChange={(e) => setResetConfirmation(e.target.value)}
                placeholder="RESET"
                disabled={resetLoading}
                className="w-full bg-[#030712] border border-gray-800 focus:border-rose-500 text-white font-mono uppercase px-3 py-2 rounded text-sm tracking-widest outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setResetModalOpen(false);
                  setResetConfirmation('');
                  setResetFeedback(null);
                }}
                disabled={resetLoading}
                className="px-3.5 py-1.5 text-xs text-gray-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={resetLoading || resetConfirmation.trim().toUpperCase() !== 'RESET'}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-syne font-bold rounded uppercase tracking-wider disabled:opacity-40 transition-all flex items-center gap-2"
              >
                <RotateCcw className={`w-3.5 h-3.5 ${resetLoading ? 'animate-spin' : ''}`} />
                <span>{resetLoading ? 'Restoring World...' : 'Confirm Complete Reset'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
