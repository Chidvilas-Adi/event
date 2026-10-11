'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Wordmark } from '@/components/ui/wordmark';
import { StatusChip } from '@/components/ui/status-chip';
import { BootLoader } from '@/components/ui/boot-loader';
import {
  Shield,
  User,
  ArrowRight,
  AlertCircle,
  Key,
  Eye,
  EyeOff,
} from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'participant' | 'operator'>('participant');
  const [loading, setLoading] = useState(false);
  const [showBootLoader, setShowBootLoader] = useState(false);
  const [targetRoute, setTargetRoute] = useState('/portal');
  const [error, setError] = useState<string | null>(null);

  // Password visibility states
  const [showEventCode, setShowEventCode] = useState(false);
  const [showOperatorPassword, setShowOperatorPassword] = useState(false);

  // Participant Form
  const [citizenCode, setCitizenCode] = useState('');
  const [eventCode, setEventCode] = useState('');

  // Operator Form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');

  const handleParticipantLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginType: 'participant',
          citizenCode: citizenCode.trim(),
          eventCode: eventCode.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Smart landing page routing
      if (data.user?.institutionId) {
        setTargetRoute(`/desk/${data.user.institutionId}`);
      } else if (data.user?.role === 'gm' || data.user?.role === 'event_lead') {
        setTargetRoute('/gm');
      } else if (data.user?.role === 'admin') {
        setTargetRoute('/admin');
      } else if (data.user?.role === 'company_lead') {
        setTargetRoute('/founder');
      } else if (data.user?.role === 'observer') {
        setTargetRoute('/gm/monitor');
      } else if (data.user?.role === 'volunteer') {
        setTargetRoute('/desk');
      } else {
        setTargetRoute('/portal');
      }
      setShowBootLoader(true);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleOperatorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loginType: 'operator',
          username: username.trim(),
          password,
          totpCode: totpCode.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      const role = data.user?.role;
      const instId = data.user?.institutionId;
      const uname = (username || '').trim().toLowerCase();

      // Smart landing page routing based on privileges
      if (role === 'gm' || role === 'event_lead') {
        setTargetRoute('/gm');
      } else if (role === 'admin') {
        setTargetRoute('/admin');
      } else if (instId) {
        setTargetRoute(`/desk/${instId}`);
      } else if (uname.startsWith('volunteer_')) {
        const inferred = uname.replace('volunteer_', '');
        setTargetRoute(inferred === 'investor' ? '/desk/investor' : `/desk/${inferred}`);
      } else if (uname === 'investor') {
        setTargetRoute('/desk/investor');
      } else if (role === 'volunteer') {
        setTargetRoute('/desk');
      } else if (role === 'observer') {
        setTargetRoute('/gm/monitor');
      } else {
        setTargetRoute('/portal');
      }

      setShowBootLoader(true);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (showBootLoader) {
    return <BootLoader onComplete={() => router.push(targetRoute)} />;
  }

  return (
    <main className="min-h-screen bg-vc-bg flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background radial gradient */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-vc-gold/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Brand header */}
        <div className="text-center space-y-3">
          <Wordmark size="lg" className="items-center" />
          <div className="flex items-center justify-center gap-2 pt-1">
            <StatusChip label="Gates ■ Open" variant="emerald" />
            <StatusChip label="Rules ■ Locked" variant="slate" />
            <StatusChip label="Sat 10 Oct 2026" variant="gold" />
          </div>
        </div>

        {/* Login Box */}
        <div className="bg-vc-card border border-vc-border rounded-xl p-6 shadow-2xl backdrop-blur-sm">
          {/* Tabs */}
          <div className="grid grid-cols-2 p-1 bg-black/40 rounded-lg border border-gray-800 mb-6 font-mono text-xs">
            <button
              type="button"
              onClick={() => {
                setTab('participant');
                setError(null);
              }}
              className={`py-2 px-3 rounded font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${
                tab === 'participant'
                  ? 'bg-vc-gold text-black shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Citizen Entry</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('operator');
                setError(null);
              }}
              className={`py-2 px-3 rounded font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${
                tab === 'operator'
                  ? 'bg-vc-gold text-black shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>City Operator</span>
            </button>
          </div>

          {error && (
            <div className="mb-5 bg-vc-rose/10 border border-vc-rose/30 text-vc-rose px-3.5 py-2.5 rounded text-xs font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {tab === 'participant' ? (
            <form onSubmit={handleParticipantLogin} className="space-y-4 font-mono">
              <div>
                <label className="block text-[11px] text-gray-400 uppercase tracking-wider mb-1.5">
                  Citizen Pass Code (or Participant ID)
                </label>
                <input
                  type="text"
                  required
                  value={citizenCode}
                  onChange={(e) => setCitizenCode(e.target.value)}
                  placeholder="Citizen Pass Code"
                  className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold text-white px-3.5 py-2.5 rounded text-sm outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-400 uppercase tracking-wider mb-1.5">
                  Event Access Code
                </label>
                <div className="relative">
                  <input
                    type={showEventCode ? 'text' : 'password'}
                    required
                    value={eventCode}
                    onChange={(e) => setEventCode(e.target.value)}
                    placeholder="Event Access Code"
                    className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold text-white px-3.5 py-2.5 pr-10 rounded text-sm outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEventCode(!showEventCode)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-vc-gold p-1"
                    title={showEventCode ? 'Hide password' : 'Show password'}
                  >
                    {showEventCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-vc-gold hover:bg-vc-gold-hover text-black font-syne font-black text-sm uppercase py-3 rounded tracking-wider flex items-center justify-center gap-2 shadow-lg hover:shadow-vc-gold/20 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <span>{loading ? 'Verifying Permit...' : 'Enter Venture City'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleOperatorLogin} className="space-y-4 font-mono">
              <div>
                <label className="block text-[11px] text-gray-400 uppercase tracking-wider mb-1.5">
                  Operator Username
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Operator Username"
                  className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold text-white px-3.5 py-2.5 rounded text-sm outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-[11px] text-gray-400 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showOperatorPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Operator Password"
                    className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold text-white px-3.5 py-2.5 pr-10 rounded text-sm outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowOperatorPassword(!showOperatorPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-vc-gold p-1"
                    title={showOperatorPassword ? 'Hide password' : 'Show password'}
                  >
                    {showOperatorPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-gray-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Elevated One-Time Code</span>
                  <span className="text-[9px] text-vc-gold font-normal">MFA ENFORCED FOR GM / ADMIN</span>
                </label>
                <input
                  type="text"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="One-Time Code (if required)"
                  className="w-full bg-[#030712] border border-gray-800 focus:border-vc-gold text-white px-3.5 py-2.5 rounded text-sm outline-none transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 bg-vc-gold hover:bg-vc-gold-hover text-black font-syne font-black text-sm uppercase py-3 rounded tracking-wider flex items-center justify-center gap-2 shadow-lg hover:shadow-vc-gold/20 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                <span>{loading ? 'Authenticating...' : 'Open Dedicated Console'}</span>
                <Key className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="text-center font-mono text-[11px] text-gray-500 space-y-1">
          <div>PES University · BE Block Seminar Halls 9th & 11th Floor</div>
          <div>₹10,000 Prize Pool · Free Entry · 100 Seats Max</div>
        </div>
      </div>

    </main>
  );
}
