/**
 * tests/helpers/gameplay_engine.js
 * Authoritative reference model for Bountyrunner gameplay mechanics & state hooks.
 * Implements Haversine distance, countdown timers, zone shrink mathematics,
 * auto-capture triggers, bomb arming/blast detection, and match lifecycle states.
 */

const EARTH_RADIUS_METERS = 6371000;

/**
 * Computes exact great-circle distance between two GPS coordinates using Haversine formula.
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLng = (lng2 - lng1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Formats time in seconds to mm:ss format.
 */
export function formatTimer(totalSeconds) {
  const safeSec = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safeSec / 60);
  const secs = safeSec % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Computes dynamic zone shrink radius based on elapsed hunting time, interval, and shrink amount.
 * Clamps to minRadius (default: 50m).
 */
export function calculateShrinkRadius(initialRadius, elapsedSeconds, interval = 120, shrinkAmount = 100, minRadius = 50) {
  if (elapsedSeconds <= 0 || interval <= 0) return initialRadius;
  const intervals = Math.floor(elapsedSeconds / interval);
  return Math.max(minRadius, initialRadius - intervals * shrinkAmount);
}

/**
 * Evaluates whether a seeker is within auto-capture range of a hider.
 */
export function evaluateAutoCapture(seekerLat, seekerLng, hiderLat, hiderLng, captureRadius = 4) {
  const distance = haversineDistance(seekerLat, seekerLng, hiderLat, hiderLng);
  return {
    distance,
    captureRadius,
    inRange: distance <= captureRadius,
    willCapture: distance <= captureRadius
  };
}

/**
 * Evaluates bomb arming state and blast radius detonation.
 */
export function evaluateBombDetonation(bomb, hiderPos, nowMs) {
  const isArmed = nowMs >= bomb.activatesAtMs;
  const distance = haversineDistance(bomb.lat, bomb.lng, hiderPos.lat, hiderPos.lng);
  const inBlast = distance <= bomb.radius;
  return {
    isArmed,
    distance,
    inBlast,
    triggersDetonation: isArmed && inBlast
  };
}

/**
 * Evaluates radar snapshot reveal cycle.
 */
export function evaluateRadarSnapshot(hidingEndsMs, nowMs, revealIntervalMs, lastRevealedMs) {
  const elapsed = Math.max(0, nowMs - hidingEndsMs);
  const currentCycle = Math.floor(elapsed / revealIntervalMs);
  const cycleOfLastReveal = lastRevealedMs > 0 ? Math.floor((lastRevealedMs - hidingEndsMs) / revealIntervalMs) : -1;
  const needsSnapshot = lastRevealedMs === 0 || currentCycle > cycleOfLastReveal;
  const msUntilNextReveal = revealIntervalMs - (elapsed % revealIntervalMs);
  const secondsUntilNext = Math.ceil(msUntilNextReveal / 1000);

  return {
    currentCycle,
    cycleOfLastReveal,
    needsSnapshot,
    secondsUntilNext,
    countdownStr: formatTimer(secondsUntilNext)
  };
}

/**
 * Simulated Match Session state machine for End-to-End game loop testing.
 */
export class MatchSession {
  constructor(config = {}) {
    this.id = config.id || 'MATCH_' + Math.random().toString(36).substring(2, 6).toUpperCase();
    this.status = 'lobby'; // lobby | hiding | hunting | finished
    this.hidingDuration = config.hidingDuration || 120;
    this.revealInterval = config.revealInterval || 120;
    this.matchDuration = config.matchDuration || 600;
    this.captureRadius = config.captureRadius || 4;
    this.bombArmingTime = config.bombArmingTime || 60;
    this.bombBlastRadius = config.bombBlastRadius || 25;
    this.boundaryRadius = config.boundaryRadius || 500;
    this.zoneShrinkInterval = config.zoneShrinkInterval || 120;
    this.zoneShrinkAmount = config.zoneShrinkAmount || 100;
    this.centerLat = config.centerLat || 59.9139;
    this.centerLng = config.centerLng || 10.7522;

    this.participants = [];
    this.bombs = [];
    this.messages = [];
    this.catches = [];
    this.startTime = null;
    this.hidingEndsTime = null;
    this.huntingEndsTime = null;
    this.currentTime = 0;
  }

  addParticipant(id, name, role) {
    // Default hiders with spatial offset so they do not spawn directly on top of seeker (0m)
    const latOffset = role === 'hider' ? 0.0015 : 0; // ~165m offset
    const p = {
      id,
      name,
      role, // 'seeker' | 'hider'
      lat: this.centerLat + latOffset,
      lng: this.centerLng,
      revealedLat: this.centerLat + latOffset,
      revealedLng: this.centerLng,
      revealedAt: 0,
      isCaught: false,
      score: 0
    };
    this.participants.push(p);
    return p;
  }

  start(startTimeMs = 1000000) {
    this.status = 'hiding';
    this.startTime = startTimeMs;
    this.hidingEndsTime = startTimeMs + this.hidingDuration * 1000;
    this.huntingEndsTime = this.hidingEndsTime + this.matchDuration * 1000;
    this.currentTime = startTimeMs;
  }

  updatePlayerPosition(playerId, lat, lng) {
    const p = this.participants.find(x => x.id === playerId);
    if (p) {
      p.lat = lat;
      p.lng = lng;
    }
  }

  dropBomb(seekerId, lat, lng) {
    const bomb = {
      id: this.bombs.length + 1,
      placedById: seekerId,
      lat,
      lng,
      radius: this.bombBlastRadius,
      placedAtMs: this.currentTime,
      activatesAtMs: this.currentTime + this.bombArmingTime * 1000,
      isActive: false,
      isDetonated: false
    };
    this.bombs.push(bomb);
    return bomb;
  }

  sendChat(senderId, senderName, content) {
    if (!content || !content.trim()) return null;
    const msg = {
      id: this.messages.length + 1,
      senderId,
      senderName,
      content,
      timestamp: this.currentTime
    };
    this.messages.push(msg);
    return msg;
  }

  tick(timeMs) {
    this.currentTime = timeMs;

    // Check phase transitions
    if (this.status === 'hiding' && this.currentTime >= this.hidingEndsTime) {
      this.status = 'hunting';
    }

    if (this.status === 'hunting' && this.currentTime >= this.huntingEndsTime) {
      this.status = 'finished';
      return;
    }

    if (this.status !== 'hunting') return;

    // 1. Radar Snapshots for hiders
    const hidingEndsMs = this.hidingEndsTime;
    const revealIntervalMs = this.revealInterval * 1000;
    const hiders = this.participants.filter(p => p.role === 'hider');
    const seekers = this.participants.filter(p => p.role === 'seeker');

    for (const hider of hiders) {
      const radar = evaluateRadarSnapshot(hidingEndsMs, this.currentTime, revealIntervalMs, hider.revealedAt);
      if (radar.needsSnapshot) {
        hider.revealedLat = hider.lat;
        hider.revealedLng = hider.lng;
        hider.revealedAt = this.currentTime;
      }
    }

    // 2. Auto-Capture Proximity Check
    for (const seeker of seekers) {
      for (const hider of hiders) {
        if (hider.isCaught) continue;
        const autoCap = evaluateAutoCapture(seeker.lat, seeker.lng, hider.lat, hider.lng, this.captureRadius);
        if (autoCap.willCapture) {
          hider.isCaught = true;
          seeker.score += 100;
          this.catches.push({
            matchId: this.id,
            seekerId: seeker.id,
            hiderId: hider.id,
            method: 'auto_capture',
            time: this.currentTime
          });
        }
      }
    }

    // 3. Bombs evaluation
    for (const bomb of this.bombs) {
      if (bomb.isDetonated) continue;
      if (!bomb.isActive && this.currentTime >= bomb.activatesAtMs) {
        bomb.isActive = true;
      }
      if (bomb.isActive) {
        for (const hider of hiders) {
          if (hider.isCaught) continue;
          const det = evaluateBombDetonation(bomb, { lat: hider.lat, lng: hider.lng }, this.currentTime);
          if (det.triggersDetonation) {
            hider.isCaught = true;
            bomb.isDetonated = true;
            const placer = this.participants.find(p => p.id === bomb.placedById);
            if (placer) placer.score += 100;
            this.catches.push({
              matchId: this.id,
              seekerId: bomb.placedById,
              hiderId: hider.id,
              method: 'bomb_blast',
              time: this.currentTime
            });
          }
        }
      }
    }

    // Win condition check: all hiders caught
    if (hiders.length > 0 && hiders.every(h => h.isCaught)) {
      this.status = 'finished';
    }
  }

  getCurrentBoundaryRadius() {
    if (this.status !== 'hunting' && this.status !== 'finished') {
      return this.boundaryRadius;
    }
    const elapsedSeconds = Math.max(0, (this.currentTime - this.hidingEndsTime) / 1000);
    return calculateShrinkRadius(
      this.boundaryRadius,
      elapsedSeconds,
      this.zoneShrinkInterval,
      this.zoneShrinkAmount
    );
  }
}
