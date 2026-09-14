/**
 * src/hooks/useTacticalPowerUps.ts
 * Client-side Tactical Power-Up State Machine Hook with Auto-Sleeping Tick Loop.
 */

import { useState, useEffect, useCallback } from 'react';
import { GameEffects } from '../lib/GameEffects';
import { POWER_UP_CONFIGS } from '../types/tacticalPowerUps';
import type {
  PowerUpType,
  PowerUpStateMap
} from '../types/tacticalPowerUps';


export interface DecoyEntity {
  id: string;
  lat: number;
  lng: number;
  expiresAt: number;
}

export interface FreezeTrapEntity {
  id: string;
  lat: number;
  lng: number;
  radius: number;
  expiresAt: number;
  isTriggered: boolean;
}

export function useTacticalPowerUps(
  currentLat: number,
  currentLng: number,
  matchId?: string | null,
  isFrozen?: boolean,
  isCaught?: boolean,
  matchStatus?: string
) {
  // Epoch-based state slots
  const [slots, setSlots] = useState<PowerUpStateMap>(() => ({
    sprint:      { activeUntil: 0, cooldownUntil: 0 },
    decoy:       { activeUntil: 0, cooldownUntil: 0 },
    shield:      { activeUntil: 0, cooldownUntil: 0 },
    freeze_trap: { activeUntil: 0, cooldownUntil: 0 },
  }));

  const [activeDecoy, setActiveDecoy] = useState<DecoyEntity | null>(null);
  const [activeTrap, setActiveTrap] = useState<FreezeTrapEntity | null>(null);
  const [radarJammedUntil, setRadarJammedUntil] = useState<number>(0);

  // High-performance tick state for driving UI
  const [now, setNow] = useState<number>(() => Date.now());

  // Auto-sleeping 200ms tick interval
  useEffect(() => {
    const hasRunningTimers =
      Object.values(slots).some(
        s => s.cooldownUntil > Date.now() || s.activeUntil > Date.now()
      ) ||
      (activeDecoy !== null && activeDecoy.expiresAt > Date.now()) ||
      (activeTrap !== null && activeTrap.expiresAt > Date.now()) ||
      radarJammedUntil > Date.now();

    if (!hasRunningTimers) return;

    const timer = setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);

      // Clean up expired decoy
      setActiveDecoy(prev => (prev && prev.expiresAt <= currentTime ? null : prev));

      // Clean up expired trap
      setActiveTrap(prev => (prev && prev.expiresAt <= currentTime ? null : prev));

      // Check if all timers have completed
      const stillRunning =
        Object.values(slots).some(
          s => s.cooldownUntil > currentTime || s.activeUntil > currentTime
        ) ||
        (activeDecoy !== null && activeDecoy.expiresAt > currentTime) ||
        (activeTrap !== null && activeTrap.expiresAt > currentTime) ||
        radarJammedUntil > currentTime;

      if (!stillRunning) {
        clearInterval(timer);
      }
    }, 200);

    return () => clearInterval(timer);
  }, [slots, activeDecoy, activeTrap, radarJammedUntil]);

  // Reset all power-up states
  const resetPowerUps = useCallback(() => {
    setSlots({
      sprint:      { activeUntil: 0, cooldownUntil: 0 },
      decoy:       { activeUntil: 0, cooldownUntil: 0 },
      shield:      { activeUntil: 0, cooldownUntil: 0 },
      freeze_trap: { activeUntil: 0, cooldownUntil: 0 },
    });
    setActiveDecoy(null);
    setActiveTrap(null);
    setRadarJammedUntil(0);
    setNow(Date.now());
  }, []);

  // Activation handler
  const activatePowerUp = useCallback((type: PowerUpType): boolean => {
    const currentTime = Date.now();
    const slot = slots[type];
    const config = POWER_UP_CONFIGS[type];

    // Guards: disabled conditions
    if (isFrozen || isCaught) return false;
    if (matchStatus && matchStatus !== 'hunting' && matchStatus !== 'hiding') return false;
    if (currentTime < slot.cooldownUntil || currentTime < slot.activeUntil) {
      return false;
    }

    // 1. Play Synthesized Web Audio & Haptic Feedback
    GameEffects.playPowerUp(type);

    // 2. Commit new epoch boundaries
    const newActiveUntil = currentTime + config.durationMs;
    const newCooldownUntil = currentTime + config.cooldownMs;

    setSlots(prev => ({
      ...prev,
      [type]: {
        activeUntil: newActiveUntil,
        cooldownUntil: newCooldownUntil
      }
    }));
    setNow(currentTime);

    // 3. Type-Specific Secondary Effects
    let createdDecoy: DecoyEntity | null = null;
    let createdTrap: FreezeTrapEntity | null = null;

    if (type === 'decoy') {
      // Spawn phantom ping 80-120m offset at random angle
      const angle = Math.random() * 2 * Math.PI;
      const distance = 90 / 111320; // ~90 meters in latitude degrees
      const dLat = distance * Math.cos(angle);
      const dLng = distance * Math.sin(angle) / Math.cos((currentLat * Math.PI) / 180);

      createdDecoy = {
        id: `decoy-${currentTime}`,
        lat: currentLat + dLat,
        lng: currentLng + dLng,
        expiresAt: newActiveUntil
      };
      setActiveDecoy(createdDecoy);
    } else if (type === 'freeze_trap') {
      // Place trap at current position (10m radius, armed for 60s)
      createdTrap = {
        id: `trap-${currentTime}`,
        lat: currentLat,
        lng: currentLng,
        radius: 10,
        expiresAt: currentTime + config.durationMs,
        isTriggered: false
      };
      setActiveTrap(createdTrap);
    }

    // 4. Fire backend powerup API if matchId is present
    if (matchId) {
      const payload = {
        type,
        lat: type === 'decoy' && createdDecoy ? createdDecoy.lat : currentLat,
        lng: type === 'decoy' && createdDecoy ? createdDecoy.lng : currentLng
      };
      fetch(`/api/matches/${matchId}/powerup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(err => {
        console.warn('Powerup API call failed (offline fallback active):', err);
      });
    }

    return true;
  }, [slots, isFrozen, isCaught, matchStatus, currentLat, currentLng, matchId]);

  // Absorb capture/hazard via Shield Bubble
  const absorbShield = useCallback((): boolean => {
    const currentTime = Date.now();
    if (currentTime < slots.shield.activeUntil) {
      // Terminate active shield buff immediately while keeping cooldown running
      setSlots(prev => ({
        ...prev,
        shield: { ...prev.shield, activeUntil: currentTime }
      }));
      GameEffects.playPowerUp('shield');
      return true;
    }
    return false;
  }, [slots.shield]);

  // Jam radar when freeze trap is sprung
  const triggerFreezeTrap = useCallback(() => {
    const currentTime = Date.now();
    setRadarJammedUntil(currentTime + 15_000);
    GameEffects.playFreeze();
    if (activeTrap) {
      setActiveTrap(prev => (prev ? { ...prev, isTriggered: true } : null));
    }
  }, [activeTrap]);

  // Helper to compute live status for a slot
  const getSlotDetails = useCallback((type: PowerUpType) => {
    const slot = slots[type];
    const config = POWER_UP_CONFIGS[type];
    const isActive = now < slot.activeUntil;
    const isCoolingDown = !isActive && now < slot.cooldownUntil;
    const isReady = !isActive && !isCoolingDown;

    const activeSecsLeft = isActive ? Math.max(0, Math.ceil((slot.activeUntil - now) / 1000)) : 0;
    const cooldownSecsLeft = isCoolingDown ? Math.max(0, Math.ceil((slot.cooldownUntil - now) / 1000)) : 0;

    // Cooldown percentage (0 to 100) for radial SVG progress sweep
    const cooldownPercent = isCoolingDown
      ? Math.max(0, Math.min(100, ((slot.cooldownUntil - now) / config.cooldownMs) * 100))
      : 0;

    return {
      type,
      config,
      isReady,
      isActive,
      isCoolingDown,
      activeSecsLeft,
      cooldownSecsLeft,
      cooldownPercent
    };
  }, [slots, now]);

  return {
    slots,
    activeDecoy,
    activeTrap,
    radarJammedUntil,
    isRadarJammed: now < radarJammedUntil,
    activatePowerUp,
    absorbShield,
    triggerFreezeTrap,
    resetPowerUps,
    getSlotDetails,
    sprint: getSlotDetails('sprint'),
    decoy: getSlotDetails('decoy'),
    shield: getSlotDetails('shield'),
    freezeTrap: getSlotDetails('freeze_trap'),
  };
}
