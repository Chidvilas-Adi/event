'use client';

import React, { useEffect, useState } from 'react';
import { StatusChip } from './status-chip';
import { AlertTriangle, Pause, Play, Snowflake } from 'lucide-react';

interface WorldStateData {
  clockSeconds: number;
  currentTick: number;
  isPaused: boolean;
  isFrozen: boolean;
  freezeReason?: string | null;
  versionLabel?: string;
  stateHash?: string;
}

export function ClockBanner({
  initialState,
  onStateUpdate,
}: {
  initialState?: WorldStateData;
  onStateUpdate?: (state: WorldStateData) => void;
}) {
  const [world, setWorld] = useState<WorldStateData>(
    initialState || {
      clockSeconds: 0,
      currentTick: 1,
      isPaused: false,
      isFrozen: false,
      versionLabel: '0x7F3A',
      stateHash: 'LIVE',
    }
  );

  useEffect(() => {
    // 1. Fetch initial state
    fetch('/api/world/clock')
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          setWorld(data);
          if (onStateUpdate) onStateUpdate(data);
        }
      })
      .catch(() => {});

    // 2. Connect to SSE stream
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/world/stream');

      eventSource.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          if (packet.type === 'INIT_STATE' || packet.type === 'world_state_updated') {
            const updated = packet.data;
            setWorld((prev) => {
              let newSecs = updated.clockSeconds ?? prev.clockSeconds;
              if (!updated.isPaused && !updated.isFrozen && !prev.isPaused && !prev.isFrozen && prev.currentTick === updated.currentTick) {
                newSecs = Math.max(prev.clockSeconds, newSecs);
              }
              return { ...prev, ...updated, clockSeconds: newSecs };
            });
            if (onStateUpdate) onStateUpdate(updated);
          }
        } catch {}
      };
    } catch {}

    // 3. Fallback poll every 8 seconds
    const interval = setInterval(() => {
      fetch('/api/world/clock')
        .then((res) => res.json())
        .then((data) => {
          if (!data.error) {
            setWorld((prev) => {
              let newSecs = data.clockSeconds ?? prev.clockSeconds;
              if (!data.isPaused && !data.isFrozen && !prev.isPaused && !prev.isFrozen && prev.currentTick === data.currentTick) {
                newSecs = Math.max(prev.clockSeconds, newSecs);
              }
              return { ...prev, ...data, clockSeconds: newSecs };
            });
            if (onStateUpdate) onStateUpdate(data);
          }
        })
        .catch(() => {});
    }, 8000);

    // 4. Local continuous 1-second ticker when running
    const secondTimer = setInterval(() => {
      setWorld((prev) => {
        if (!prev.isPaused && !prev.isFrozen) {
          return { ...prev, clockSeconds: prev.clockSeconds + 1 };
        }
        return prev;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(secondTimer);
      if (eventSource) eventSource.close();
    };
  }, [onStateUpdate]);

  // Format elapsed seconds into HH:MM:SS
  const formatTime = (secs: number) => {
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    const seconds = secs % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  return (
    <div className="w-full">
      {/* Freeze Emergency Banner */}
      {world.isFrozen && (
        <div className="bg-vc-rose text-white px-4 py-2 font-mono text-xs flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2 font-bold tracking-wider uppercase">
            <Snowflake className="w-4 h-4" />
            <span>CITY FROZEN: ALL STANDARD TRANSACTIONS AND MOVEMENT LOCKED</span>
          </div>
          {world.freezeReason && (
            <div className="text-[11px] opacity-90 truncate max-w-md hidden sm:block">
              REASON: {world.freezeReason}
            </div>
          )}
        </div>
      )}

      {/* World Status Strip */}
      <div className="bg-[#070b17] border-b border-vc-border px-4 py-2 flex flex-wrap items-center justify-between gap-3 font-mono text-xs text-gray-300">
        <div className="flex items-center gap-2">
          <StatusChip
            label={world.isFrozen ? 'City ■ Frozen' : world.isPaused ? 'Clock ❚❚ Paused' : 'Clock ● Running'}
            variant={world.isFrozen ? 'rose' : world.isPaused ? 'gold' : 'emerald'}
          />
          <StatusChip label={`Tick ${String(world.currentTick).padStart(2, '0')}`} variant="slate" />
          <StatusChip label="24 Oct 2026" variant="gold" />
          <StatusChip label="Rules ■ Locked" variant="slate" className="hidden sm:inline-flex" />
          <StatusChip label={`State ${world.versionLabel || '0x7F3A'}`} variant="slate" className="hidden md:inline-flex" />
        </div>

        <div className="flex items-center gap-4 text-xs font-mono ml-auto">
          <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1 rounded border border-gray-800">
            <span className="text-gray-500 uppercase text-[10px]">TIME ELAPSED</span>
            <span className="text-white font-bold tracking-wider">{formatTime(world.clockSeconds)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
