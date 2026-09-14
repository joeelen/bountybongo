/**
 * src/components/TacticalActionBar.tsx
 * Floating Tactical Action Bar anchored at bottom-[115px] z-25 with 48x48px touch buttons.
 * Strict invariants: >= 48x48px targets, zero micro-fonts (<10px), zero amber tokens.
 */

import React from 'react';
import { Zap, Radio, Shield, Snowflake } from 'lucide-react';
import type { PowerUpType } from '../types/tacticalPowerUps';

interface TacticalActionBarProps {
  getSlotDetails: (type: PowerUpType) => any;
  onActivate: (type: PowerUpType) => void;
  disabled?: boolean;
}

const ICONS: Record<PowerUpType, React.ElementType> = {
  sprint: Zap,
  decoy: Radio,
  shield: Shield,
  freeze_trap: Snowflake,
};

export const TacticalActionBar: React.FC<TacticalActionBarProps> = ({
  getSlotDetails,
  onActivate,
  disabled = false
}) => {
  const types: PowerUpType[] = ['sprint', 'decoy', 'shield', 'freeze_trap'];

  return (
    <div 
      className="absolute bottom-[115px] md:bottom-[130px] left-1/2 -translate-x-1/2 z-25 pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-950/90 border border-cyber-cyan/30 backdrop-blur-md shadow-2xl"
      role="toolbar"
      aria-label="Tactical Power-Ups Bar"
    >
      {types.map((type) => {
        const slot = getSlotDetails(type);
        const Icon = ICONS[type];
        const isClickable = slot.isReady && !disabled;

        return (
          <button
            key={type}
            type="button"
            onClick={() => isClickable && onActivate(type)}
            disabled={!isClickable}
            title={`${slot.config.name}: ${slot.config.description} (${Math.round(slot.config.cooldownMs / 1000)}s CD)`}
            aria-label={`Activate ${slot.config.name}`}
            className={`relative w-12 h-12 min-w-[48px] min-h-[48px] rounded-xl flex flex-col items-center justify-center transition-all select-none ${
              slot.isActive
                ? `${slot.config.color.bg} ${slot.config.color.border} border-2 ${slot.config.color.glow} ring-2 ${slot.config.color.ring} animate-pulse scale-105`
                : slot.isCoolingDown
                ? 'bg-zinc-950/80 border border-zinc-800 opacity-60 cursor-not-allowed'
                : `bg-zinc-900/90 ${slot.config.color.border} border hover:bg-zinc-800 active:scale-95 shadow-lg ${slot.config.color.glow}/20`
            }`}
          >
            {/* Radial SVG Cooldown Sweep */}
            {slot.isCoolingDown && (
              <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 48 48">
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className="text-zinc-800"
                />
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke={slot.config.color.accent}
                  strokeWidth="2.5"
                  strokeDasharray="125.66"
                  strokeDashoffset={125.66 * (1 - slot.cooldownPercent / 100)}
                  strokeLinecap="round"
                  className="transition-all duration-200"
                />
              </svg>
            )}

            {/* Icon */}
            <Icon 
              className={`w-5 h-5 shrink-0 transition-transform ${
                slot.isActive
                  ? `${slot.config.color.text} scale-110`
                  : slot.isCoolingDown
                  ? 'text-zinc-500'
                  : `${slot.config.color.text}`
              }`} 
            />

            {/* Sub-label: Active duration left or cooldown countdown (min 10px font) */}
            {slot.isActive ? (
              <span className={`text-[10px] font-black font-mono leading-none mt-0.5 ${slot.config.color.text}`}>
                {slot.activeSecsLeft}s
              </span>
            ) : slot.isCoolingDown ? (
              <span className="text-[10px] font-black font-mono text-zinc-300 leading-none mt-0.5">
                {slot.cooldownSecsLeft}s
              </span>
            ) : (
              <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold leading-none mt-0.5">
                RDY
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
