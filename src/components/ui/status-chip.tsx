import React from 'react';

interface StatusChipProps {
  label: string;
  variant?: 'gold' | 'emerald' | 'rose' | 'slate' | 'blue';
  icon?: string;
  className?: string;
}

export function StatusChip({
  label,
  variant = 'slate',
  icon,
  className = '',
}: StatusChipProps) {
  const variantStyles = {
    gold: 'bg-vc-gold/10 text-vc-gold border-vc-gold/30',
    emerald: 'bg-vc-emerald/10 text-vc-emerald border-vc-emerald/30',
    rose: 'bg-vc-rose/10 text-vc-rose border-vc-rose/30',
    slate: 'bg-gray-900/60 text-gray-300 border-gray-800',
    blue: 'bg-vc-blue/10 text-vc-blue border-vc-blue/30',
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono tracking-wider uppercase rounded border ${variantStyles[variant]} select-none ${className}`}
    >
      {icon && <span className="opacity-90">{icon}</span>}
      <span>{label}</span>
    </div>
  );
}
