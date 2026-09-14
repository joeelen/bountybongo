/**
 * src/components/ActiveBuffHudIndicator.tsx
 * Status indicator pills pinned directly below top telemetry at top-[70px] z-20.
 * Strict invariants: zero micro-fonts (<10px), zero amber tokens.
 */

import React from 'react';
import { Zap, Radio, Shield, Snowflake } from 'lucide-react';
import type { PowerUpType } from '../types/tacticalPowerUps';

interface ActiveBuffHudIndicatorProps {
  getSlotDetails: (type: PowerUpType) => any;
  isRadarJammed?: boolean;
}

export const ActiveBuffHudIndicator: React.FC<ActiveBuffHudIndicatorProps> = ({
  getSlotDetails,
  isRadarJammed = false
}) => {
  const types: PowerUpType[] = ['sprint', 'decoy', 'shield', 'freeze_trap'];
  const activeBuffs = types.filter(t => getSlotDetails(t).isActive);

  if (activeBuffs.length === 0 && !isRadarJammed) {
    return null;
  }

  return (
    <div 
      className="absolute top-[70px] left-2 md:left-4 right-16 z-20 pointer-events-none flex flex-wrap items-center gap-1.5"
      aria-live="polite"
      aria-label="Active Tactical Buffs"
    >
      {activeBuffs.map(type => {
        const slot = getSlotDetails(type);
        return (
          <div
            key={type}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-950/90 border ${slot.config.color.border} ${slot.config.color.text} text-[10px] md:text-xs font-mono font-black ${slot.config.color.glow} backdrop-blur-md animate-pulse pointer-events-auto`}
          >
            {type === 'sprint' && <Zap className="w-3 h-3 fill-cyber-yellow text-cyber-yellow" />}
            {type === 'decoy' && <Radio className="w-3 h-3 text-cyber-cyan" />}
            {type === 'shield' && <Shield className="w-3 h-3 fill-cyber-green/40 text-cyber-green" />}
            {type === 'freeze_trap' && <Snowflake className="w-3 h-3 text-cyan-300" />}
            <span>{slot.config.badgeLabel}</span>
            <span className={`${slot.config.color.bg} px-1.5 py-0.5 rounded text-[10px]`}>
              {slot.activeSecsLeft}s
            </span>
          </div>
        );
      })}

      {isRadarJammed && (
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/90 border border-cyan-400 text-cyan-300 text-[10px] md:text-xs font-mono font-black shadow-[0_0_10px_rgba(6,182,212,0.6)] backdrop-blur-md animate-bounce pointer-events-auto">
          <Snowflake className="w-3 h-3 text-cyan-300" />
          <span>RADAR JAMMED</span>
        </div>
      )}
    </div>
  );
};
