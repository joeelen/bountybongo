/**
 * src/types/tacticalPowerUps.ts
 * Type definitions and balance configuration for R3 Tactical Power-Ups & Action Bar.
 */

export type PowerUpType = 'sprint' | 'decoy' | 'shield' | 'freeze_trap';

export interface PowerUpSlotState {
  activeUntil: number;     // Unix timestamp ms (0 = inactive)
  cooldownUntil: number;   // Unix timestamp ms (0 = ready)
}

export type PowerUpStateMap = Record<PowerUpType, PowerUpSlotState>;

export interface PowerUpConfig {
  type: PowerUpType;
  name: string;
  shortName: string;
  durationMs: number;
  cooldownMs: number;
  description: string;
  badgeLabel: string;
  color: {
    accent: string;
    border: string;
    bg: string;
    text: string;
    glow: string;
    ring: string;
  };
}

export const POWER_UP_CONFIGS: Record<PowerUpType, PowerUpConfig> = {
  sprint: {
    type: 'sprint',
    name: 'Sprint Boost',
    shortName: 'SPRINT',
    durationMs: 15_000,    // 15 seconds active
    cooldownMs: 45_000,    // 45 seconds cooldown
    description: '+6m Catch/Dodge mobility buffer',
    badgeLabel: '⚡ SPRINT',
    color: {
      accent: '#ffaa00',
      border: 'border-cyber-yellow',
      bg: 'bg-cyber-yellow/20',
      text: 'text-cyber-yellow',
      glow: 'shadow-yellow-glow',
      ring: 'ring-cyber-yellow'
    }
  },
  decoy: {
    type: 'decoy',
    name: 'Decoy Drone',
    shortName: 'DECOY',
    durationMs: 30_000,    // 30 seconds active
    cooldownMs: 60_000,    // 60 seconds cooldown
    description: 'Emits phantom GPS radar signature',
    badgeLabel: '📡 DECOY',
    color: {
      accent: '#00f0ff',
      border: 'border-cyber-cyan',
      bg: 'bg-cyber-cyan/20',
      text: 'text-cyber-cyan',
      glow: 'shadow-cyan-glow',
      ring: 'ring-cyber-cyan'
    }
  },
  shield: {
    type: 'shield',
    name: 'Shield Bubble',
    shortName: 'SHIELD',
    durationMs: 20_000,    // 20 seconds active (or until absorbed)
    cooldownMs: 90_000,    // 90 seconds cooldown
    description: 'Absorbs 1 capture attempt or bomb blast',
    badgeLabel: '🛡️ SHIELDED',
    color: {
      accent: '#39ff14',
      border: 'border-cyber-green',
      bg: 'bg-cyber-green/20',
      text: 'text-cyber-green',
      glow: 'shadow-green-glow',
      ring: 'ring-cyber-green'
    }
  },
  freeze_trap: {
    type: 'freeze_trap',
    name: 'Freeze Trap',
    shortName: 'FREEZE',
    durationMs: 60_000,    // 60 seconds trap active
    cooldownMs: 60_000,    // 60 seconds cooldown
    description: 'Places geofenced radar-scrambling snare',
    badgeLabel: '❄️ TRAP ARMED',
    color: {
      accent: '#22d3ee',
      border: 'border-cyan-400',
      bg: 'bg-cyan-900/40',
      text: 'text-cyan-300',
      glow: 'shadow-[0_0_15px_rgba(6,182,212,0.6)]',
      ring: 'ring-cyan-400'
    }
  }
};

export interface PowerUpOverlay {
  id: string;
  type: PowerUpType;
  lat: number;
  lng: number;
  radius?: number;
  isActive?: boolean;
  userId?: string;
  expiresAt?: string | number | Date;
}
