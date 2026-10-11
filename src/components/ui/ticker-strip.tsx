import React from 'react';

interface TickerStripProps {
  items?: string[];
  className?: string;
  speed?: 'normal' | 'fast';
}

export function TickerStrip({
  items = [
    'AETHER DYNAMICS [COMPUTE: 25 VB]',
    'KAVACH DEFENSE [DATA: 20 VB]',
    'PRANA BIOTECH [MATERIALS: 20 VB]',
    'NXTGRID ENERGY [ENERGY: 15 VB]',
    'SAMUDRA LOGISTICS [SLOTS: 20 VB]',
    'VAYU AEROSPACE [INFRA: 25 VB]',
    'DHARANI AGRITECH',
    'QUANTUMMESH COMPUTING',
    'NEURALLINK BIOCHIPS',
    'SURYA SOLAR DYNAMICS',
    'APEX RESERVE BANK [LENDING POOL: 80,000 VB]',
    'FRONTIER SYNDICATE [VENTURE FUND: 140,000 VB]',
    'BUILD. TRADE. SURVIVE. SCALE.',
  ],
  className = '',
}: TickerStripProps) {
  const repeated = [...items, ...items, ...items];

  return (
    <div
      className={`w-full overflow-hidden whitespace-nowrap bg-vc-card border-y border-vc-border py-1.5 select-none font-mono text-[11px] uppercase text-gray-400 ${className}`}
    >
      <div className="inline-flex animate-marquee gap-6 items-center">
        {repeated.map((text, idx) => (
          <span key={idx} className="inline-flex items-center gap-3">
            <span className="text-white font-medium">{text}</span>
            <span className="text-vc-gold font-bold">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}
