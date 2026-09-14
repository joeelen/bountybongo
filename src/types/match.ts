/**
 * src/types/match.ts
 * Authoritative TypeScript definitions for Bountyrunner Match & Game Mode Engine.
 */

export type GameMode = 'classic' | 'freeze_tag' | 'infection' | 'treasure_hunt';

export type MatchStatus = 'waiting' | 'hiding' | 'hunting' | 'finished';

export type ParticipantRole = 'hider' | 'seeker';

export type CollectibleType = 'energy_cube' | 'bounty_crystal';

export interface Participant {
  id: number;
  userId: string;
  name: string;
  avatar: string;
  role: ParticipantRole;
  isCaught: boolean;
  isFrozen: boolean;
  frozenAt: string | null;
  rescuesCount: number;
  revealedLat: number | null;
  revealedLng: number | null;
  revealedAt: string | null;
  lat: number;
  lng: number;
  score?: number;
}

export interface CollectibleItem {
  id: string;
  matchId: string;
  type: CollectibleType;
  lat: number;
  lng: number;
  points: number;
  isCollected: boolean;
  collectedById: string | null;
  collectedAt: string | null;
}

export interface BombState {
  id: number;
  matchId: string;
  placedById: string;
  lat: number;
  lng: number;
  radius: number;
  activatesAt: string;
  isActive: boolean;
  hidden?: boolean;
}

export interface MatchState {
  id: string;
  hostId: string;
  status: MatchStatus;
  gameMode: GameMode;
  rescueRadius: number; // default 10m
  hidingDuration: number;
  revealInterval: number;
  matchDuration: number;
  catchRadius: number;
  captureRadius: number;
  bombArmingTime: number;
  bombBlastRadius: number;
  bombHiddenDuration: number;
  boundaryCenterLat: number;
  boundaryCenterLng: number;
  boundaryRadius: number;
  currentZoneRadius?: number;
  zoneShrinkInterval: number;
  zoneShrinkAmount: number;
  startedAt: string | null;
  hidingEndsAt: string | null;
  huntingEndsAt: string | null;
}

export interface MatchApiResponse {
  match: MatchState;
  participants: Participant[];
  bombs: BombState[];
  collectibles?: CollectibleItem[];
}

export interface UpdateMatchSettingsPayload {
  gameMode?: GameMode;
  rescueRadius?: number;
  hidingDuration?: number;
  revealInterval?: number;
  matchDuration?: number;
  catchRadius?: number;
  captureRadius?: number;
  bombArmingTime?: number;
  bombBlastRadius?: number;
  bombHiddenDuration?: number;
  boundaryRadius?: number;
  zoneShrinkInterval?: number;
  zoneShrinkAmount?: number;
}

export interface CollectResponse {
  success: boolean;
  item: CollectibleItem;
  pointsAwarded: number;
  matchFinished: boolean;
}

export interface RescueResponse {
  success: boolean;
  message: string;
  rescuesCount: number;
  immunityMs: number;
}
