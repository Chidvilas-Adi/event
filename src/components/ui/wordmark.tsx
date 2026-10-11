import React from 'react';

interface WordmarkProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showTagline?: boolean;
  className?: string;
}

export function Wordmark({ size = 'md', showTagline = true, className = '' }: WordmarkProps) {
  const sizeClasses = {
    sm: 'text-xl tracking-wider',
    md: 'text-2xl sm:text-3xl tracking-widest',
    lg: 'text-4xl sm:text-5xl tracking-widest font-extrabold',
    xl: 'text-5xl sm:text-6xl tracking-widest font-black',
  };

  const taglineClasses = {
    sm: 'text-[9px] tracking-widest',
    md: 'text-[11px] tracking-widest',
    lg: 'text-xs tracking-widest',
    xl: 'text-sm tracking-widest',
  };

  return (
    <div className={`flex flex-col select-none ${className}`}>
      <div className="flex items-center gap-2">
        <span className={`font-syne font-black text-white ${sizeClasses[size]}`}>
          VENTURE<span className="text-vc-gold">CITY</span>
        </span>
      </div>
      {showTagline && (
        <span className={`font-mono font-bold uppercase text-gray-400 mt-0.5 ${taglineClasses[size]}`}>
          Build. Trade. Survive. Scale.
        </span>
      )}
    </div>
  );
}
