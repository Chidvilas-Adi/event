'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Wordmark } from './ui/wordmark';
import { Home, Send, Inbox, Building2, Target, LogOut } from 'lucide-react';

interface PortalNavProps {
  citizenCode?: string;
  pendingCount?: number;
  role?: string;
  isFounder?: boolean;
}

export function PortalNav({ citizenCode, pendingCount = 0, role, isFounder }: PortalNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [userRole, setUserRole] = React.useState<string | undefined>(role);

  React.useEffect(() => {
    if (!userRole) {
      fetch('/api/auth/session')
        .then((r) => r.json())
        .then((d) => {
          if (d.user) setUserRole(d.user.role);
        })
        .catch(() => {});
    }
  }, [userRole]);

  const canSeeFounder = isFounder || userRole === 'company_lead' || userRole === 'gm' || userRole === 'admin';
  const canSeeOperatorDesk = userRole === 'volunteer' || userRole === 'gm' || userRole === 'admin' || userRole === 'event_lead';

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const navItems = [
    { label: 'Pass', href: '/portal', icon: Home },
    { label: 'Send VB', href: '/portal/transfer', icon: Send },
    { label: 'Inbox', href: '/portal/inbox', icon: Inbox, badge: pendingCount },
    { label: 'Venture', href: '/portal/company', icon: Building2 },
    { label: 'Missions', href: '/portal/missions', icon: Target },
  ];

  return (
    <>
      {/* Top Header */}
      <header className="bg-vc-card border-b border-vc-border px-4 py-3 flex items-center justify-between sticky top-0 z-40">
        <Link href="/portal" className="flex items-center gap-2">
          <Wordmark size="sm" showTagline={false} />
        </Link>

        <div className="flex items-center gap-2">
          {canSeeFounder && (
            <Link
              href="/founder"
              className="text-[10px] font-mono text-vc-gold hover:text-yellow-300 border border-vc-gold/40 hover:border-vc-gold px-2 py-0.5 rounded transition-colors font-bold"
            >
              Founder Desk
            </Link>
          )}
          <Link
            href="/portal/disputes"
            className="text-[10px] font-mono text-gray-400 hover:text-vc-gold border border-gray-800 hover:border-vc-gold/40 px-2 py-0.5 rounded transition-colors"
          >
            Disputes
          </Link>
          {canSeeOperatorDesk ? (
            <Link
              href="/desk"
              className="text-[10px] font-mono text-vc-blue hover:text-blue-300 border border-vc-blue/40 hover:border-vc-blue px-2 py-0.5 rounded transition-colors font-bold"
            >
              Station Desks
            </Link>
          ) : (
            <Link
              href="/desk"
              className="text-[10px] font-mono text-gray-400 hover:text-vc-gold border border-gray-800 hover:border-vc-gold/40 px-2 py-0.5 rounded transition-colors"
            >
              City Guide
            </Link>
          )}
          {citizenCode && (
            <span className="font-mono text-xs bg-vc-gold/10 text-vc-gold border border-vc-gold/30 px-2 py-0.5 rounded font-bold">
              {citizenCode}
            </span>
          )}
          <button
            onClick={handleLogout}
            title="Exit City"
            className="text-gray-400 hover:text-vc-rose transition-colors p-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Bottom Thumb-Reachable Nav (Mobile First) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-vc-card/95 backdrop-blur-md border-t border-vc-border py-2 px-2 max-w-lg mx-auto sm:max-w-none">
        <div className="flex items-center justify-around font-mono text-[10px]">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-col items-center gap-1 py-1 px-3 rounded-lg transition-all ${
                  isActive
                    ? 'text-vc-gold font-bold scale-105'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {Boolean(item.badge && item.badge > 0) && (
                    <span className="absolute -top-1 -right-2 bg-vc-rose text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
