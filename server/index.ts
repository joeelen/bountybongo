import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { db, pool } from './db.js';
import { users, profiles, matches, matchParticipants, bombs, catches, friends, messages, wildZoneEvents, collectibles } from './schema.js';
import { eq, and, or, sql } from 'drizzle-orm';

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Normalize /api prefix and restore original path if rewritten by Vercel serverless
app.use((req: any, res: any, next: any) => {
  const vercelPath = req.headers['x-matched-path'] || req.headers['x-now-route-matches'];
  if (vercelPath && typeof vercelPath === 'string' && vercelPath.startsWith('/api')) {
    req.url = vercelPath;
  } else if (req.url && !req.url.startsWith('/api') && req.url !== '/') {
    req.url = '/api' + req.url;
  }
  next();
});

const activeUserSessions = new Map<string, number>();

// --- IN-MEMORY DATABASE SIMULATION FALLBACK ---
let isDbConnected = false;

// Mock database structures
const mockUsers = new Map<string, any>();
const mockProfiles = new Map<string, any>();
const mockMatches = new Map<string, any>();
let mockParticipants: any[] = [];
let mockBombs: any[] = [];
let mockCatches: any[] = [];
let mockFriends: any[] = [];
let mockMessages: any[] = [];
let mockWildZoneEvents: any[] = [];
let mockCollectibles: any[] = [];

// Ephemeral anti-griefing immunity cache for Freeze Tag: Map<"matchId_userId", timestampMs>
const frozenImmunityMap = new Map<string, number>();

// Match tick debounce tracker: Map<matchId, timestampMs>
const matchTickDebounce = new Map<string, number>();

// --- MILESTONE 3: TACTICAL POWER-UPS DATA STRUCTURES ---
export interface ActivePowerUp {
  id: string;
  matchId: string;
  userId: string;
  userName?: string;
  userRole?: 'hider' | 'seeker';
  type: 'sprint' | 'decoy' | 'shield' | 'freeze_trap';
  lat: number;
  lng: number;
  radius?: number; // 10m for freeze_trap
  activatedAt: Date | string;
  expiresAt: Date | string;
  isActive: boolean;
  isTriggered?: boolean;
  triggeredBy?: string | null;
  triggeredAt?: Date | string | null;
}

// In-memory store for active power-ups per match
const mockPowerUps = new Map<string, ActivePowerUp[]>();

// Power-up cooldowns per player: Map<"matchId_userId", Record<powerUpType, cooldownUntilMs>>
const playerPowerUpCooldowns = new Map<string, Record<string, number>>();

// Ephemeral lookup maps for fast tick evaluation
const playerShieldMap = new Map<string, number>(); // matchId_userId -> activeUntilMs
const playerSprintMap = new Map<string, number>(); // matchId_userId -> activeUntilMs
const playerSnaredMap = new Map<string, number>(); // matchId_userId -> snaredUntilMs

// Power-Up Game Balance Constants
const POWERUP_CONFIG = {
  sprint:      { cooldownMs: 45000, durationMs: 15000, bonusRadius: 6 },
  decoy:       { cooldownMs: 60000, durationMs: 30000 },
  shield:      { cooldownMs: 90000, durationMs: 20000, dodgeXp: 50, graceImmunityMs: 3000 },
  freeze_trap: { cooldownMs: 60000, durationMs: 60000, trapRadius: 10, snareDurationMs: 10000, snareXp: 50 }
} as const;


// --- SEEDED DETERMINISTIC RADIAL COLLECTIBLE GENERATOR (Mulberry32 PRNG + Geodetic Cosine Correction) ---
function hashSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function mulberry32(seed: number) {
  return function() {
    let t = (seed += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateMatchCollectibles(
  matchId: string,
  centerLat: number,
  centerLng: number,
  boundaryRadius: number
): Array<{
  id: string;
  matchId: string;
  type: 'energy_cube' | 'bounty_crystal';
  lat: number;
  lng: number;
  points: number;
  isCollected: boolean;
  collectedById: string | null;
  collectedAt: Date | null;
}> {
  const rng = mulberry32(hashSeed(matchId) || 54321);
  const items: any[] = [];
  const latScaling = 111320;
  const lngScaling = 111320 * Math.cos((centerLat * Math.PI) / 180);

  // 1. Spawn 10 Energy Cubes (50 XP each)
  for (let i = 0; i < 10; i++) {
    const theta = (i / 10) * 2 * Math.PI + (rng() * 0.4 - 0.2);
    // Bounded between 18% and 83% of boundary radius
    const dist = boundaryRadius * (0.18 + 0.65 * rng());
    const lat = centerLat + (dist * Math.cos(theta)) / latScaling;
    const lng = centerLng + (dist * Math.sin(theta)) / lngScaling;

    items.push({
      id: `${matchId}_cube_${i + 1}`,
      matchId,
      type: 'energy_cube',
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      points: 50,
      isCollected: false,
      collectedById: null,
      collectedAt: null
    });
  }

  // 2. Spawn 4 Bounty Crystals (150 XP each) in 4 quadrants
  for (let j = 0; j < 4; j++) {
    const theta = (j / 4) * 2 * Math.PI + (Math.PI / 4) + (rng() * 0.3 - 0.15);
    // Bounded between 50% and 88% of boundary radius
    const dist = boundaryRadius * (0.50 + 0.38 * rng());
    const lat = centerLat + (dist * Math.cos(theta)) / latScaling;
    const lng = centerLng + (dist * Math.sin(theta)) / lngScaling;

    items.push({
      id: `${matchId}_crystal_${j + 1}`,
      matchId,
      type: 'bounty_crystal',
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      points: 150,
      isCollected: false,
      collectedById: null,
      collectedAt: null
    });
  }

  return items;
}

// Helper: Haversine distance formula in meters
function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Radius of the earth in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in meters
  return d;
}

function simulateRandomWalk(
  lat: number,
  lng: number,
  centerLat: number | null,
  centerLng: number | null,
  radius: number | null
): { nextLat: number; nextLng: number } {
  const step = 0.00008; // approx 8 meters
  const deltaLat = (Math.random() - 0.5) * step;
  const deltaLng = (Math.random() - 0.5) * step;
  let nextLat = lat + deltaLat;
  let nextLng = lng + deltaLng;

  // Keep within bounds if center & radius are provided
  if (centerLat != null && centerLng != null && radius != null) {
    const dist = getDistance(nextLat, nextLng, centerLat, centerLng);
    if (dist > radius) {
      // Step back towards the center
      const angle = Math.atan2(centerLat - lat, centerLng - lng);
      nextLat = lat + Math.sin(angle) * step * 0.5;
      nextLng = lng + Math.cos(angle) * step * 0.5;
    }
  }

  return { nextLat, nextLng };
}

function seedMockUsers() {
  if (mockUsers.size > 0) return;
  const testIds = ['host', 'hider1', 'hider2', 'seeker1'];
  testIds.forEach(id => {
    mockUsers.set(id, {
      id,
      email: `${id}@bounty.com`,
      name: id.toUpperCase(),
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${id}`,
      password: '123'
    });
    mockProfiles.set(id, {
      id,
      lat: 59.9139 + (Math.random() - 0.5) * 0.01,
      lng: 10.7522 + (Math.random() - 0.5) * 0.01,
      score: Math.floor(Math.random() * 500),
      bountyActive: true,
      isSpecial: id === 'hider1',
      isDark: true, // Auto opt-in mock users to Go Dark
      updatedAt: new Date()
    });
  });
}

// Check database connection at start
async function checkDbConnection() {
  const hasDbEnv = !!(
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRES_PRISMA_URL
  );
  if (!hasDbEnv) {
    isDbConnected = false;
    seedMockUsers();
    return;
  }
  try {
    await pool.query('SELECT 1');
    isDbConnected = true;
    console.log('✅ PostgreSQL Connection: SUCCESS');
  } catch (err) {
    isDbConnected = false;
    console.warn('⚠️  PostgreSQL Connection: FAILED. Falling back to Memory DB Mode.');
    console.warn('   Reason:', (err as any).message);
    seedMockUsers();
  }
}

// --- AUTHENTICATION MIDDLEWARE ---
app.use(async (req: any, res, next) => {
  const replitId = req.headers['x-replit-user-id'] as string;
  const replitName = req.headers['x-replit-user-name'] as string;
  const replitEmail = req.headers['x-replit-user-email'] as string;
  const replitAvatar = req.headers['x-replit-user-profile-image'] as string;

  let userId = replitId;
  let userName = replitName;
  let userEmail = replitEmail;
  let userAvatar = replitAvatar;

  // Client user data sync header (ensures serverless lambdas recover user identity & score)
  const userDataHeader = req.headers['x-user-data'] as string;
  let clientUserData: any = null;
  if (userDataHeader) {
    try {
      clientUserData = JSON.parse(decodeURIComponent(userDataHeader));
    } catch (e) {}
  }

  // Dev mode override (reads header or cookie or query param or sync header)
  let devUserId = req.headers['x-dev-user-id'] || req.cookies?.['dev-user-id'] || req.query.dev_user_id || clientUserData?.id;
  
  // Fallback to default 'host' profile if no user session is present
  if (!userId && !devUserId) {
    devUserId = 'host';
  }

  if (!userId && devUserId) {
    userId = devUserId as string;
    userName = clientUserData?.name || (userId.charAt(0).toUpperCase() + userId.slice(1));
    userEmail = clientUserData?.email || `${userId}@bounty.com`;
    userAvatar = clientUserData?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${userId}`;
  }

  if (userId) {
    activeUserSessions.set(userId, Date.now());
    if (isDbConnected) {
      try {
        let userRow = await db.query.users.findFirst({
          where: eq(users.id, userId)
        });
        if (!userRow) {
          await db.insert(users).values({
            id: userId,
            email: userEmail || `${userId}@bounty.com`,
            name: userName || userId,
            avatar: userAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${userId}`
          });
          await db.insert(profiles).values({
            id: userId,
            lat: 59.9139, // Default Oslo coordinates
            lng: 10.7522,
            score: typeof clientUserData?.score === 'number' ? clientUserData.score : 0,
            bountyActive: false,
            isSpecial: false,
            isDark: false
          });
          userRow = { id: userId, email: userEmail, name: userName, avatar: userAvatar };
        }
        req.user = userRow;
      } catch (err) {
        console.error('Auth DB Error:', err);
      }
    } else {
      // Memory DB fallback find or create
      if (!mockUsers.has(userId)) {
        mockUsers.set(userId, {
          id: userId,
          email: userEmail || `${userId}@bounty.com`,
          name: userName || userId,
          avatar: userAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${userId}`
        });
      }
      if (!mockProfiles.has(userId)) {
        mockProfiles.set(userId, {
          id: userId,
          lat: clientUserData?.lat || 59.9139,
          lng: clientUserData?.lng || 10.7522,
          score: typeof clientUserData?.score === 'number' ? clientUserData.score : 0,
          bountyActive: false,
          isSpecial: false,
          isDark: false,
          updatedAt: new Date()
        });
      }
      req.user = mockUsers.get(userId);
    }
  }
  next();
});

// --- API ENDPOINTS ---

// Helper: get cookie options depending on security/protocol context (e.g. ngrok HTTPS tunnels)
function getCookieOptions(req: any) {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
  return {
    path: '/',
    secure: isSecure,
    sameSite: isSecure ? 'none' as const : 'lax' as const,
  };
}

// GET: Health and debug status
app.get('/api/health', (req: any, res: any) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/debug-url', (req: any, res: any) => {
  res.json({
    url: req.url,
    originalUrl: req.originalUrl,
    xMatchedPath: req.headers['x-matched-path'],
    xNowRouteMatches: req.headers['x-now-route-matches']
  });
});

// GET: Current user details
app.get('/api/me', async (req: any, res) => {
  if (!req.user) {
    return res.json({ authenticated: false });
  }
  
  if (isDbConnected) {
    const profileRow = await db.query.profiles.findFirst({
      where: eq(profiles.id, req.user.id)
    });
    return res.json({ authenticated: true, user: req.user, profile: profileRow });
  } else {
    const profileRow = mockProfiles.get(req.user.id);
    return res.json({ authenticated: true, user: req.user, profile: profileRow });
  }
});

// POST: Dev Login route
app.post('/api/dev-login', (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'Username required' });
  }
  const cleanUsername = username.trim().toLowerCase();
  res.cookie('dev-user-id', cleanUsername, getCookieOptions(req));
  res.json({ success: true, username: cleanUsername });
});

// POST: Register a new account with Username & Password
app.post('/api/auth/register', async (req: any, res: any) => {
  const { username, password, email, name, avatar, transferScore } = req.body;

  if (!username || typeof username !== 'string' || username.trim().length < 2) {
    return res.status(400).json({ error: 'Brukernavn må være minst 2 tegn.' });
  }
  if (!password || typeof password !== 'string' || password.length < 3) {
    return res.status(400).json({ error: 'Passord må være minst 3 tegn.' });
  }

  const cleanUsername = username.trim();
  const cleanId = cleanUsername.toLowerCase().replace(/\s+/g, '_');
  const cleanName = (name || cleanUsername).trim();
  const cleanEmail = (email || `${cleanId}@bounty.com`).trim().toLowerCase();
  const cleanAvatar = avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanId}`;
  const initialScore = (typeof transferScore === 'number' && transferScore > 0) ? Math.floor(transferScore) : 0;

  if (isDbConnected) {
    try {
      const existingUser = await db.query.users.findFirst({
        where: or(
          eq(users.id, cleanId),
          sql`lower(${users.name}) = ${cleanName.toLowerCase()}`
        )
      });
      if (existingUser) {
        return res.status(409).json({ error: `Brukernavnet '${cleanUsername}' er allerede i bruk. Vennligst logg inn eller velg et annet.` });
      }

      await db.insert(users).values({
        id: cleanId,
        email: cleanEmail,
        name: cleanName,
        avatar: cleanAvatar,
        password: password
      });

      await db.insert(profiles).values({
        id: cleanId,
        lat: 59.9139,
        lng: 10.7522,
        score: initialScore,
        bountyActive: false,
        isSpecial: false,
        isDark: false
      });

      const userRow = { id: cleanId, email: cleanEmail, name: cleanName, avatar: cleanAvatar };
      const profileRow = { id: cleanId, score: initialScore, lat: 59.9139, lng: 10.7522, bountyActive: false, isDark: false };
      res.cookie('dev-user-id', cleanId, getCookieOptions(req));
      return res.json({ success: true, user: userRow, profile: profileRow });
    } catch (err: any) {
      console.error('Registration DB Error:', err);
      return res.status(500).json({ error: 'Kunne ikke opprette brukerkonto i databasen.' });
    }
  } else {
    // Memory fallback
    let conflict = false;
    mockUsers.forEach(u => {
      if (u.id.toLowerCase() === cleanId || (u.name && u.name.toLowerCase() === cleanName.toLowerCase())) {
        conflict = true;
      }
    });

    if (conflict) {
      return res.status(409).json({ error: `Brukernavnet '${cleanUsername}' er allerede i bruk. Vennligst logg inn eller velg et annet.` });
    }

    const newUser = {
      id: cleanId,
      email: cleanEmail,
      name: cleanName,
      avatar: cleanAvatar,
      password: password
    };
    mockUsers.set(cleanId, newUser);
    const newProfile = {
      id: cleanId,
      lat: 59.9139,
      lng: 10.7522,
      score: initialScore,
      bountyActive: false,
      isSpecial: false,
      isDark: false,
      updatedAt: new Date()
    };
    mockProfiles.set(cleanId, newProfile);

    res.cookie('dev-user-id', cleanId, getCookieOptions(req));
    return res.json({ success: true, user: { id: cleanId, email: cleanEmail, name: cleanName, avatar: cleanAvatar }, profile: newProfile });
  }
});

// POST: Login with Username/Password, Email or OAuth provider
app.post('/api/auth/login', async (req: any, res) => {
  const { id, email, name, username, password, avatar, transferScore } = req.body;
  
  const rawId = (username || id || name || '').trim();
  const cleanId = rawId.toLowerCase().replace(/\s+/g, '_');
  const cleanName = (name || username || rawId).trim();
  const cleanEmail = (email || (cleanId ? `${cleanId}@bounty.com` : '')).trim().toLowerCase();
  const cleanAvatar = avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanId}`;

  if (!cleanId && !cleanEmail) {
    return res.status(400).json({ error: 'Brukernavn eller e-post er påkrevd.' });
  }

  const bonusScore = (typeof transferScore === 'number' && transferScore > 0) ? Math.floor(transferScore) : 0;

  if (isDbConnected) {
    try {
      let userRow = await db.query.users.findFirst({
        where: or(
          eq(users.id, cleanId),
          sql`lower(${users.name}) = ${cleanName.toLowerCase()}`,
          cleanEmail ? eq(users.email, cleanEmail) : sql`false`
        )
      });

      // If user provided a password and account exists, verify it
      if (userRow && password && userRow.password && userRow.password !== password) {
        return res.status(401).json({ error: 'Feil passord. Vennligst prøv igjen.' });
      }

      // If user is logging in with credentials but account doesn't exist:
      if (!userRow && password) {
        return res.status(401).json({ error: `Fant ingen konto for '${cleanName}'. Vennligst opprett en konto først.` });
      }

      if (!userRow) {
        await db.insert(users).values({
          id: cleanId,
          email: cleanEmail || `${cleanId}@bounty.com`,
          name: cleanName || cleanId,
          avatar: cleanAvatar,
          password: password || null
        });
        await db.insert(profiles).values({
          id: cleanId,
          lat: 59.9139,
          lng: 10.7522,
          score: bonusScore,
          bountyActive: false,
          isSpecial: false,
          isDark: false
        });
        userRow = { id: cleanId, email: cleanEmail, name: cleanName, avatar: cleanAvatar };
      } else if (bonusScore > 0) {
        await db.update(profiles)
          .set({ score: sql`${profiles.score} + ${bonusScore}` })
          .where(eq(profiles.id, userRow.id));
      }

      const profileRow = await db.query.profiles.findFirst({ where: eq(profiles.id, userRow.id) });
      res.cookie('dev-user-id', userRow.id, getCookieOptions(req));
      return res.json({ success: true, user: userRow, profile: profileRow });
    } catch (err: any) {
      console.error('Auth login error:', err);
      return res.status(500).json({ error: 'Database authentication failed' });
    }
  } else {
    // Memory fallback
    let existingUser: any = null;
    mockUsers.forEach(u => {
      if (
        u.id.toLowerCase() === cleanId ||
        (u.name && u.name.toLowerCase() === cleanName.toLowerCase()) ||
        (cleanEmail && u.email && u.email.toLowerCase() === cleanEmail)
      ) {
        existingUser = u;
      }
    });

    if (existingUser && password && existingUser.password && existingUser.password !== password) {
      return res.status(401).json({ error: 'Feil passord. Vennligst prøv igjen.' });
    }

    if (!existingUser && password) {
      return res.status(401).json({ error: `Fant ingen konto for '${cleanName}'. Vennligst opprett en konto først.` });
    }

    if (!existingUser) {
      mockUsers.set(cleanId, {
        id: cleanId,
        email: cleanEmail || `${cleanId}@bounty.com`,
        name: cleanName || cleanId,
        avatar: cleanAvatar,
        password: password || undefined
      });
      mockProfiles.set(cleanId, {
        id: cleanId,
        lat: 59.9139,
        lng: 10.7522,
        score: bonusScore,
        bountyActive: false,
        isSpecial: false,
        isDark: false,
        updatedAt: new Date()
      });
      existingUser = mockUsers.get(cleanId);
    } else if (bonusScore > 0) {
      const prof = mockProfiles.get(existingUser.id);
      if (prof) {
        prof.score = (prof.score || 0) + bonusScore;
      }
    }

    const currentProfile = mockProfiles.get(existingUser.id);
    res.cookie('dev-user-id', existingUser.id, getCookieOptions(req));
    return res.json({ success: true, user: existingUser, profile: currentProfile });
  }
});

// POST: Dev Logout & Standard Logout
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('dev-user-id', getCookieOptions(req));
  res.json({ success: true });
});

app.post('/api/dev-logout', (req, res) => {
  res.clearCookie('dev-user-id', getCookieOptions(req));
  res.json({ success: true });
});

// POST: Update player coordinates
app.post('/api/profile/gps', async (req: any, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { lat, lng } = req.body;
  if (lat == null || lng == null) return res.status(400).json({ error: 'Invalid coordinates' });

  if (isDbConnected) {
    await db.update(profiles).set({
      lat,
      lng,
      updatedAt: new Date()
    }).where(eq(profiles.id, req.user.id));
  } else {
    const prof = mockProfiles.get(req.user.id);
    if (prof) {
      prof.lat = lat;
      prof.lng = lng;
      prof.updatedAt = new Date();
    }
  }
  res.json({ success: true });
});

// POST: Toggle global bounty
app.post('/api/profile/bounty', async (req: any, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { bountyActive } = req.body;

  if (isDbConnected) {
    await db.update(profiles).set({ bountyActive, isSpecial: false }).where(eq(profiles.id, req.user.id));
  } else {
    const prof = mockProfiles.get(req.user.id);
    if (prof) {
      prof.bountyActive = bountyActive;
      prof.isSpecial = false;
    }
  }
  res.json({ success: true });
});

// POST: Toggle Go Dark status
app.post('/api/profile/dark', async (req: any, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { isDark } = req.body;

  if (isDbConnected) {
    await db.update(profiles).set({ isDark }).where(eq(profiles.id, req.user.id));
  } else {
    const prof = mockProfiles.get(req.user.id);
    if (prof) {
      prof.isDark = isDark;
    }
  }
  res.json({ success: true, isDark });
});


// GET: Leaderboard
app.get('/api/leaderboard', async (req, res) => {
  if (isDbConnected) {
    const leaders = await db.select({
      id: users.id,
      name: users.name,
      avatar: users.avatar,
      score: profiles.score
    }).from(profiles)
      .innerJoin(users, eq(profiles.id, users.id))
      .orderBy(sql`${profiles.score} DESC`)
      .limit(20);
    res.json(leaders);
  } else {
    const leaders = Array.from(mockProfiles.values()).map(p => {
      const u = mockUsers.get(p.id);
      return {
        id: p.id,
        name: u?.name || p.id,
        avatar: u?.avatar || '',
        score: p.score
      };
    }).sort((a, b) => b.score - a.score);
    res.json(leaders);
  }
});

// GET: Personal profile stats (catches made, caught count, matches played, recent catches)
app.get('/api/profile/stats', async (req: any, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  if (isDbConnected) {
    try {
      // Catches made by this user
      const madeRows = await db.select({
        id: catches.id,
        targetId: catches.targetId,
        matchId: catches.matchId,
        timestamp: catches.timestamp,
        targetName: users.name,
        targetAvatar: users.avatar
      }).from(catches)
        .innerJoin(users, eq(catches.targetId, users.id))
        .where(eq(catches.hunterId, req.user.id))
        .orderBy(sql`${catches.timestamp} DESC`)
        .limit(10);

      // Times the user was caught
      const caughtCount = await db.select({ count: sql`count(*)` }).from(catches)
        .where(eq(catches.targetId, req.user.id));

      // Matches participated in
      const matchCount = await db.select({ count: sql`count(*)` }).from(matchParticipants)
        .where(eq(matchParticipants.userId, req.user.id));

      res.json({
        catchesMade: Number(madeRows.length),
        timesCaught: Number(caughtCount[0]?.count ?? 0),
        matchesPlayed: Number(matchCount[0]?.count ?? 0),
        recentCatches: madeRows
      });
    } catch (err) {
      console.error('Stats error:', err);
      res.status(500).json({ error: 'Failed to load stats' });
    }
  } else {
    // Memory DB fallback
    const madeList = mockCatches
      .filter(c => c.hunterId === req.user.id)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10)
      .map(c => {
        const tUser = mockUsers.get(c.targetId);
        return {
          id: c.id,
          targetId: c.targetId,
          matchId: c.matchId,
          timestamp: c.timestamp,
          targetName: tUser?.name || c.targetId,
          targetAvatar: tUser?.avatar || ''
        };
      });

    const caughtCount = mockCatches.filter(c => c.targetId === req.user.id).length;
    const matchCount = mockParticipants.filter(p => p.userId === req.user.id).length;

    res.json({
      catchesMade: madeList.length,
      timesCaught: caughtCount,
      matchesPlayed: matchCount,
      recentCatches: madeList
    });
  }
});

// POST: Award bonus XP to player (e.g. from Daily Quests or special achievements)
app.post('/api/profile/xp', async (req: any, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { xpToAdd } = req.body;
  const xp = Math.min(1000, Math.max(0, Number(xpToAdd) || 0));

  if (isDbConnected) {
    await db.update(profiles).set({ score: sql`${profiles.score} + ${xp}` }).where(eq(profiles.id, req.user.id));
  } else {
    const prof = mockProfiles.get(req.user.id);
    if (prof) {
      prof.score = (prof.score || 0) + xp;
    }
  }

  res.json({ success: true, addedXp: xp });
});


// --- MATCHES API ---

// GET: Query active match for current user
app.get('/api/matches/current', async (req: any, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  if (isDbConnected) {
    try {
      const activePart = await db.select({
        matchId: matchParticipants.matchId,
        role: matchParticipants.role,
        status: matches.status
      }).from(matchParticipants)
        .innerJoin(matches, eq(matchParticipants.matchId, matches.id))
        .where(
          and(
            eq(matchParticipants.userId, req.user.id),
            or(eq(matches.status, 'hiding'), eq(matches.status, 'hunting'))
          )
        )
        .limit(1);

      if (activePart.length > 0) {
        return res.json({
          hasActiveMatch: true,
          matchId: activePart[0].matchId,
          role: activePart[0].role
        });
      }
    } catch (err) {
      console.error('Error in /api/matches/current:', err);
    }
    return res.json({ hasActiveMatch: false });
  } else {
    const activePart = mockParticipants.find(p => {
      if (p.userId !== req.user.id) return false;
      const m = mockMatches.get(p.matchId);
      return m && (m.status === 'hiding' || m.status === 'hunting');
    });

    if (activePart) {
      return res.json({
        hasActiveMatch: true,
        matchId: activePart.matchId,
        role: activePart.role
      });
    }
    return res.json({ hasActiveMatch: false });
  }
});

// Helper: Cluster dark players geographically and launch Wild Zone matches
async function triggerWildZoneClusters(force = false): Promise<{ triggeredCount: number, matches: string[] }> {
  // Get all opted-in players who are active (updated in last 15 minutes)
  const activeThreshold = new Date(Date.now() - 15 * 60 * 1000);
  let candidates: { id: string; lat: number; lng: number }[] = [];
  
  if (isDbConnected) {
    const list = await db.select({
      id: profiles.id,
      lat: profiles.lat,
      lng: profiles.lng,
      updatedAt: profiles.updatedAt
    }).from(profiles)
      .where(
        and(
          eq(profiles.isDark, true),
          sql`${profiles.updatedAt} >= ${activeThreshold}`
        )
      );
    candidates = list.map(p => ({
      id: p.id,
      lat: p.lat || 0,
      lng: p.lng || 0
    }));
  } else {
    mockProfiles.forEach(p => {
      if (p.isDark && p.updatedAt >= activeThreshold) {
        candidates.push({
          id: p.id,
          lat: p.lat,
          lng: p.lng
        });
      }
    });
  }

  if (candidates.length < 3) {
    return { triggeredCount: 0, matches: [] };
  }

  // Greedy clustering (within 800m)
  const clusters: { centerLat: number; centerLng: number; members: typeof candidates }[] = [];
  const list = [...candidates];
  
  while (list.length > 0) {
    const p1 = list.shift()!;
    const clusterMembers = [p1];
    
    for (let i = 0; i < list.length; i++) {
      const p2 = list[i];
      const dist = getDistance(p1.lat, p1.lng, p2.lat, p2.lng);
      if (dist <= 800) {
        clusterMembers.push(p2);
        list.splice(i, 1);
        i--;
      }
    }
    
    if (clusterMembers.length >= 3) {
      let sumLat = 0;
      let sumLng = 0;
      clusterMembers.forEach(m => {
        sumLat += m.lat;
        sumLng += m.lng;
      });
      clusters.push({
        centerLat: sumLat / clusterMembers.length,
        centerLng: sumLng / clusterMembers.length,
        members: clusterMembers
      });
    }
  }

  const triggeredMatches: string[] = [];
  const now = new Date();

  for (const cluster of clusters) {
    if (!force) {
      const hour = now.getHours();
      if (hour < 10 || hour >= 22) {
        continue;
      }

      // 1.6km radius check around cluster center for zone limits
      if (isDbConnected) {
        const past24hEvents = await db.select().from(wildZoneEvents)
          .where(sql`${wildZoneEvents.timestamp} >= ${new Date(Date.now() - 24 * 60 * 60 * 1000)}`);
        
        const localEvents = past24hEvents.filter(e => getDistance(cluster.centerLat, cluster.centerLng, e.lat, e.lng) <= 1600);
        if (localEvents.length >= 3) continue;

        const recentEvents = localEvents.filter(e => now.getTime() - new Date(e.timestamp).getTime() < 90 * 60 * 1000);
        if (recentEvents.length > 0) continue;
      } else {
        const localEvents = mockWildZoneEvents.filter(e => 
          now.getTime() - new Date(e.timestamp).getTime() < 24 * 60 * 60 * 1000 &&
          getDistance(cluster.centerLat, cluster.centerLng, e.lat, e.lng) <= 1600
        );
        if (localEvents.length >= 3) continue;

        const recentEvents = localEvents.filter(e => now.getTime() - new Date(e.timestamp).getTime() < 90 * 60 * 1000);
        if (recentEvents.length > 0) continue;
      }
    }

    if (isDbConnected) {
      await db.insert(wildZoneEvents).values({
        lat: cluster.centerLat,
        lng: cluster.centerLng,
        timestamp: now
      });
    } else {
      mockWildZoneEvents.push({
        id: mockWildZoneEvents.length + 1,
        lat: cluster.centerLat,
        lng: cluster.centerLng,
        timestamp: now
      });
    }

    // Select random hider
    const randIndex = Math.floor(Math.random() * cluster.members.length);
    const hider = cluster.members[randIndex];
    const seekers = cluster.members.filter((_, idx) => idx !== randIndex);

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const hidingDuration = 180;
    const matchDuration = 900;
    const startedAt = now;
    const hidingEndsAt = new Date(startedAt.getTime() + hidingDuration * 1000);
    const huntingEndsAt = new Date(hidingEndsAt.getTime() + matchDuration * 1000);

    if (isDbConnected) {
      await db.insert(matches).values({
        id: code,
        hostId: hider.id,
        status: 'hiding',
        hidingDuration,
        revealInterval: 120,
        matchDuration,
        catchRadius: 30,
        bombArmingTime: 60,
        bombBlastRadius: 25,
        boundaryCenterLat: cluster.centerLat,
        boundaryCenterLng: cluster.centerLng,
        boundaryRadius: 800,
        startedAt,
        hidingEndsAt,
        huntingEndsAt
      });

      await db.insert(matchParticipants).values({
        matchId: code,
        userId: hider.id,
        role: 'hider',
        isCaught: false
      });

      for (const seeker of seekers) {
        await db.insert(matchParticipants).values({
          matchId: code,
          userId: seeker.id,
          role: 'seeker',
          isCaught: false
        });
      }
    } else {
      const matchObj = {
        id: code,
        hostId: hider.id,
        status: 'hiding',
        hidingDuration,
        revealInterval: 120,
        matchDuration,
        catchRadius: 30,
        bombArmingTime: 60,
        bombBlastRadius: 25,
        boundaryCenterLat: cluster.centerLat,
        boundaryCenterLng: cluster.centerLng,
        boundaryRadius: 800,
        startedAt,
        hidingEndsAt,
        huntingEndsAt
      };
      mockMatches.set(code, matchObj);

      mockParticipants.push({
        id: mockParticipants.length + 1,
        matchId: code,
        userId: hider.id,
        role: 'hider',
        isCaught: false,
        revealedLat: null,
        revealedLng: null,
        revealedAt: null,
        joinedAt: now
      });

      for (const seeker of seekers) {
        mockParticipants.push({
          id: mockParticipants.length + 1,
          matchId: code,
          userId: seeker.id,
          role: 'seeker',
          isCaught: false,
          revealedLat: null,
          revealedLng: null,
          revealedAt: null,
          joinedAt: now
        });
      }
    }

    triggeredMatches.push(code);
  }

  return { triggeredCount: triggeredMatches.length, matches: triggeredMatches };
}

// POST: Dev force trigger wild zone event
app.post('/api/dev/trigger-wild-zone', async (req: any, res) => {
  const force = req.query.force === 'true';
  try {
    const result = await triggerWildZoneClusters(force);
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Wild Zone Trigger Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST: Create a new private match
app.post('/api/matches', async (req: any, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  const { gameMode = 'classic', rescueRadius = 10 } = req.body || {};
  const validModes = ['classic', 'freeze_tag', 'infection', 'treasure_hunt'];
  const mode = validModes.includes(gameMode) ? gameMode : 'classic';

  // Generate 6-char random code
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const defaultBoundaryLat = 59.9139; // Fallback center
  const defaultBoundaryLng = 10.7522;

  let hostLat = defaultBoundaryLat;
  let hostLng = defaultBoundaryLng;

  if (isDbConnected) {
    const hostProfile = await db.query.profiles.findFirst({ where: eq(profiles.id, req.user.id) });
    if (hostProfile) {
      hostLat = hostProfile.lat || defaultBoundaryLat;
      hostLng = hostProfile.lng || defaultBoundaryLng;
    }

    const newMatch = await db.insert(matches).values({
      id: code,
      hostId: req.user.id,
      gameMode: mode,
      rescueRadius: Number(rescueRadius) || 10,
      status: 'waiting',
      boundaryCenterLat: hostLat,
      boundaryCenterLng: hostLng,
      boundaryRadius: 500,
      captureRadius: 4,
      bombHiddenDuration: 45,
      zoneShrinkInterval: 120,
      zoneShrinkAmount: 100
    }).returning();

    // Auto-join host as Seeker
    await db.insert(matchParticipants).values({
      matchId: code,
      userId: req.user.id,
      role: 'seeker',
      isCaught: false,
      isFrozen: false,
      frozenAt: null,
      rescuesCount: 0
    });

    res.json(newMatch[0]);
  } else {
    const hostProfile = mockProfiles.get(req.user.id);
    if (hostProfile) {
      hostLat = hostProfile.lat;
      hostLng = hostProfile.lng;
    }

    const matchObj = {
      id: code,
      hostId: req.user.id,
      gameMode: mode,
      rescueRadius: Number(rescueRadius) || 10,
      status: 'waiting',
      hidingDuration: 120,
      revealInterval: 120,
      matchDuration: 900,
      catchRadius: 30,
      captureRadius: 4,
      bombArmingTime: 60,
      bombBlastRadius: 25,
      bombHiddenDuration: 45,
      boundaryCenterLat: hostLat,
      boundaryCenterLng: hostLng,
      boundaryRadius: 500,
      zoneShrinkInterval: 120,
      zoneShrinkAmount: 100,
      startedAt: null,
      hidingEndsAt: null,
      huntingEndsAt: null
    };

    mockMatches.set(code, matchObj);
    mockParticipants.push({
      id: mockParticipants.length + 1,
      matchId: code,
      userId: req.user.id,
      role: 'seeker',
      isCaught: false,
      isFrozen: false,
      frozenAt: null,
      rescuesCount: 0,
      revealedLat: null,
      revealedLng: null,
      revealedAt: null,
      joinedAt: new Date()
    });

    res.json(matchObj);
  }
});

// GET: List active/joinable matches for the rejoin list
app.get('/api/matches', async (req: any, res) => {
  if (isDbConnected) {
    const list = await db.select().from(matches).where(
      or(eq(matches.status, 'hiding'), eq(matches.status, 'hunting'))
    );
    res.json(list);
  } else {
    const list: any[] = [];
    mockMatches.forEach(m => {
      if (m.status === 'hiding' || m.status === 'hunting') {
        list.push(m);
      }
    });
    res.json(list);
  }
});

// --- ON-DEMAND MATCH TICK ENGINE (Evaluates ticks on client polls and actions for serverless resilience) ---
async function evaluateMatchTick(matchId: string, now: Date = new Date()): Promise<void> {
  const lastTick = matchTickDebounce.get(matchId) || 0;
  if (now.getTime() - lastTick < 400) return;
  matchTickDebounce.set(matchId, now.getTime());

  if (isDbConnected) {
    try {
      const matchRow = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
      if (!matchRow) return;
      if (matchRow.status !== 'hiding' && matchRow.status !== 'hunting') return;

      let currentStatus = matchRow.status;

      const hidingEndsTime = matchRow.hidingEndsAt ? new Date(matchRow.hidingEndsAt).getTime() : 0;
      const huntingEndsTime = matchRow.huntingEndsAt ? new Date(matchRow.huntingEndsAt).getTime() : 0;
      const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();

      // Transition: Hiding -> Hunting
      if (currentStatus === 'hiding' && hidingEndsTime > 0 && nowMs >= hidingEndsTime) {
        await db.update(matches).set({ status: 'hunting' }).where(eq(matches.id, matchId));
        currentStatus = 'hunting';
      }

      // Transition: Hunting -> Finished (Timeout)
      if (currentStatus === 'hunting' && huntingEndsTime > 0 && nowMs >= huntingEndsTime) {
        await db.update(matches).set({ status: 'finished' }).where(eq(matches.id, matchId));
        matchTickDebounce.delete(matchId);
        return;
      }

      if (currentStatus === 'hunting') {
        const elapsed = nowMs - hidingEndsTime;
        const revealIntervalMs = (matchRow.revealInterval || 120) * 1000;
        const currentCycle = Math.floor(elapsed / revealIntervalMs);

        const parts = await db.select().from(matchParticipants).where(eq(matchParticipants.matchId, matchId));
        const hiders = parts.filter(p => p.role === 'hider');
        const seekers = parts.filter(p => p.role === 'seeker');

        // Snapshot reveals for hiders
        for (const hider of hiders) {
          const lastRevealed = hider.revealedAt ? new Date(hider.revealedAt).getTime() : 0;
          const cycleOfLastReveal = Math.floor((lastRevealed - hidingEndsTime) / revealIntervalMs);
          if (hider.revealedLat == null || currentCycle > cycleOfLastReveal) {
            const hiderProfile = await db.query.profiles.findFirst({ where: eq(profiles.id, hider.userId) });
            if (hiderProfile) {
              await db.update(matchParticipants).set({
                revealedLat: hiderProfile.lat,
                revealedLng: hiderProfile.lng,
                revealedAt: now
              }).where(eq(matchParticipants.id, hider.id));
            }
          }
        }

        // A. FREEZE TRAP HAZARD PROXIMITY CHECK (DB)
        const matchPowerUps = mockPowerUps.get(matchId) || [];
        const activeTraps = matchPowerUps.filter(
          p => p.type === 'freeze_trap' && p.isActive && !p.isTriggered && new Date(p.expiresAt).getTime() > now.getTime()
        );

        for (const trap of activeTraps) {
          const opponents = participantsList.filter((p: any) => p.role !== trap.userRole && !p.isCaught && p.userId !== trap.userId);
          for (const opp of opponents) {
            const oppProfile = await db.query.profiles.findFirst({ where: eq(profiles.id, opp.userId) });
            if (!oppProfile || oppProfile.lat == null || oppProfile.lng == null) continue;

            const dist = getDistance(trap.lat, trap.lng, oppProfile.lat, oppProfile.lng);
            if (dist <= (trap.radius || 10)) {
              trap.isTriggered = true;
              trap.isActive = false;
              trap.triggeredBy = opp.userId;
              trap.triggeredAt = now;

              const snareExpiry = now.getTime() + POWERUP_CONFIG.freeze_trap.snareDurationMs;
              playerSnaredMap.set(`${matchId}_${opp.userId}`, snareExpiry);
              opp.isSnared = true;
              opp.snaredUntil = new Date(snareExpiry);

              await db.update(profiles).set({ score: sql`${profiles.score} + ${POWERUP_CONFIG.freeze_trap.snareXp}` }).where(eq(profiles.id, trap.userId));
              break;
            }
          }
        }

        // AUTO-CAPTURE PROXIMITY CHECK
        const captureRadius = matchRow.captureRadius ?? matchRow.catchRadius ?? 4;
        for (const seeker of seekers) {
          // Snared seekers cannot capture
          const seekerSnaredUntil = playerSnaredMap.get(`${matchId}_${seeker.userId}`) || 0;
          if (seekerSnaredUntil > now.getTime()) continue;

          const seekerSprintUntil = playerSprintMap.get(`${matchId}_${seeker.userId}`) || 0;

          const seekerProfile = await db.query.profiles.findFirst({ where: eq(profiles.id, seeker.userId) });
          if (!seekerProfile || seekerProfile.lat == null || seekerProfile.lng == null) continue;

          for (const hider of hiders) {
            if (hider.isCaught) continue;

            // Freeze tag immunity check
            if (matchRow.gameMode === 'freeze_tag') {
              if (hider.isFrozen) continue;
              const immunityUntil = frozenImmunityMap.get(`${matchId}_${hider.userId}`);
              if (immunityUntil && now.getTime() < immunityUntil) continue;
            }

            const hiderProfile = await db.query.profiles.findFirst({ where: eq(profiles.id, hider.userId) });
            if (!hiderProfile || hiderProfile.lat == null || hiderProfile.lng == null) continue;

            // Sprint buffer adjustments
            const hiderSprintUntil = playerSprintMap.get(`${matchId}_${hider.userId}`) || 0;
            let effectiveRadius = captureRadius;
            if (seekerSprintUntil > now.getTime()) effectiveRadius += POWERUP_CONFIG.sprint.bonusRadius;
            if (hiderSprintUntil > now.getTime()) effectiveRadius = Math.max(2, effectiveRadius - POWERUP_CONFIG.sprint.bonusRadius);

            const dist = getDistance(seekerProfile.lat, seekerProfile.lng, hiderProfile.lat, hiderProfile.lng);
            if (dist <= effectiveRadius) {
              // SHIELD ABSORPTION CHECK
              const hiderShieldUntil = hider.activeShieldUntil
                ? new Date(hider.activeShieldUntil).getTime()
                : (playerShieldMap.get(`${matchId}_${hider.userId}`) || 0);

              if (hiderShieldUntil > now.getTime()) {
                hider.activeShieldUntil = null;
                playerShieldMap.delete(`${matchId}_${hider.userId}`);
                const activeShield = matchPowerUps.find(p => p.type === 'shield' && p.userId === hider.userId && p.isActive);
                if (activeShield) activeShield.isActive = false;

                await db.update(profiles).set({ score: sql`${profiles.score} + ${POWERUP_CONFIG.shield.dodgeXp}` }).where(eq(profiles.id, hider.userId));
                frozenImmunityMap.set(`${matchId}_${hider.userId}`, now.getTime() + POWERUP_CONFIG.shield.graceImmunityMs);
                continue;
              }

              if (matchRow.gameMode === 'freeze_tag') {
                await db.update(matchParticipants).set({ isFrozen: true, frozenAt: now }).where(eq(matchParticipants.id, hider.id));
                await db.insert(catches).values({ matchId, hunterId: seeker.userId, targetId: hider.userId, timestamp: now });
                await db.update(profiles).set({ score: sql`${profiles.score} + 100` }).where(eq(profiles.id, seeker.userId));
                hider.isFrozen = true;
              } else if (matchRow.gameMode === 'infection') {
                await db.update(matchParticipants).set({ role: 'seeker', isCaught: false }).where(eq(matchParticipants.id, hider.id));
                await db.insert(catches).values({ matchId, hunterId: seeker.userId, targetId: hider.userId, timestamp: now });
                await db.update(profiles).set({ score: sql`${profiles.score} + 100` }).where(eq(profiles.id, seeker.userId));
                hider.role = 'seeker';
              } else {
                await db.update(matchParticipants).set({ isCaught: true }).where(eq(matchParticipants.id, hider.id));
                await db.insert(catches).values({ matchId, hunterId: seeker.userId, targetId: hider.userId, timestamp: now });
                await db.update(profiles).set({ score: sql`${profiles.score} + 100` }).where(eq(profiles.id, seeker.userId));
                hider.isCaught = true;
              }
            }
          }
        }

        // Bombs processing
        const matchBombs = await db.select().from(bombs).where(eq(bombs.matchId, matchId));
        for (const bombRow of matchBombs) {
          let bombIsActive = bombRow.isActive;
          if (!bombIsActive && now >= bombRow.activatesAt) {
            await db.update(bombs).set({ isActive: true }).where(eq(bombs.id, bombRow.id));
            bombIsActive = true;
          }

          if (bombIsActive) {
            for (const hider of hiders) {
              if (hider.isCaught) continue;
              if (matchRow.gameMode === 'freeze_tag' && hider.isFrozen) continue;

              const hiderProfile = await db.query.profiles.findFirst({ where: eq(profiles.id, hider.userId) });
              if (hiderProfile && hiderProfile.lat && hiderProfile.lng) {
                const dist = getDistance(bombRow.lat, bombRow.lng, hiderProfile.lat, hiderProfile.lng);
                if (dist <= bombRow.radius) {
                  if (matchRow.gameMode === 'freeze_tag') {
                    await db.update(matchParticipants).set({ isFrozen: true, frozenAt: now }).where(eq(matchParticipants.id, hider.id));
                    await db.insert(catches).values({ matchId, hunterId: bombRow.placedById, targetId: hider.userId, timestamp: now });
                    await db.update(profiles).set({ score: sql`${profiles.score} + 100` }).where(eq(profiles.id, bombRow.placedById));
                    hider.isFrozen = true;
                  } else if (matchRow.gameMode === 'infection') {
                    await db.update(matchParticipants).set({ role: 'seeker', isCaught: false }).where(eq(matchParticipants.id, hider.id));
                    await db.insert(catches).values({ matchId, hunterId: bombRow.placedById, targetId: hider.userId, timestamp: now });
                    await db.update(profiles).set({ score: sql`${profiles.score} + 100` }).where(eq(profiles.id, bombRow.placedById));
                    hider.role = 'seeker';
                  } else {
                    await db.update(matchParticipants).set({ isCaught: true }).where(eq(matchParticipants.id, hider.id));
                    await db.insert(catches).values({ matchId, hunterId: bombRow.placedById, targetId: hider.userId, timestamp: now });
                    await db.update(profiles).set({ score: sql`${profiles.score} + 100` }).where(eq(profiles.id, bombRow.placedById));
                    hider.isCaught = true;
                  }
                }
              }
            }
          }
        }

        // Win condition evaluation
        const updatedParts = await db.select().from(matchParticipants).where(eq(matchParticipants.matchId, matchId));
        if (matchRow.gameMode === 'freeze_tag') {
          const activeHiders = updatedParts.filter(p => p.role === 'hider');
          if (activeHiders.length > 0 && activeHiders.every(h => h.isFrozen || h.isCaught)) {
            await db.update(matches).set({ status: 'finished' }).where(eq(matches.id, matchId));
          }
        } else if (matchRow.gameMode === 'infection') {
          const survivors = updatedParts.filter(p => p.role === 'hider' && !p.isCaught);
          if (survivors.length === 0) {
            await db.update(matches).set({ status: 'finished' }).where(eq(matches.id, matchId));
          }
        } else if (matchRow.gameMode === 'treasure_hunt') {
          const uncollectedCrystals = await db.select({ count: sql`count(*)` })
            .from(collectibles)
            .where(and(
              eq(collectibles.matchId, matchId),
              eq(collectibles.type, 'bounty_crystal'),
              eq(collectibles.isCollected, false)
            ));
          if (Number(uncollectedCrystals[0]?.count ?? 1) === 0) {
            await db.update(matches).set({ status: 'finished' }).where(eq(matches.id, matchId));
          }
        } else {
          const activeHiders = updatedParts.filter(p => p.role === 'hider');
          if (activeHiders.length > 0 && activeHiders.every(h => h.isCaught)) {
            await db.update(matches).set({ status: 'finished' }).where(eq(matches.id, matchId));
          }
        }
      }
    } catch (err) {
      console.error(`evaluateMatchTick DB error for match ${matchId}:`, err);
    }
  } else {
    const matchRow = mockMatches.get(matchId);
    if (!matchRow) return;
    if (matchRow.status !== 'hiding' && matchRow.status !== 'hunting') return;

    let currentStatus = matchRow.status;

    const hidingEndsTime = matchRow.hidingEndsAt ? new Date(matchRow.hidingEndsAt).getTime() : 0;
    const huntingEndsTime = matchRow.huntingEndsAt ? new Date(matchRow.huntingEndsAt).getTime() : 0;
    const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();

    // Transition: Hiding -> Hunting
    if (currentStatus === 'hiding' && hidingEndsTime > 0 && nowMs >= hidingEndsTime) {
      matchRow.status = 'hunting';
      currentStatus = 'hunting';
    }

    // Transition: Hunting -> Finished (Timeout)
    if (currentStatus === 'hunting' && huntingEndsTime > 0 && nowMs >= huntingEndsTime) {
      matchRow.status = 'finished';
      matchTickDebounce.delete(matchId);
      return;
    }

    if (currentStatus === 'hunting') {
      const elapsed = nowMs - hidingEndsTime;
      const revealIntervalMs = (matchRow.revealInterval || 120) * 1000;
      const currentCycle = Math.floor(elapsed / revealIntervalMs);

      const hiders = mockParticipants.filter(p => p.matchId === matchId && p.role === 'hider');
      const seekers = mockParticipants.filter(p => p.matchId === matchId && p.role === 'seeker');

      // Snapshot reveals
      hiders.forEach(hider => {
        const lastRevealed = hider.revealedAt ? new Date(hider.revealedAt).getTime() : 0;
        const cycleOfLastReveal = Math.floor((lastRevealed - hidingEndsTime) / revealIntervalMs);
        if (hider.revealedLat == null || currentCycle > cycleOfLastReveal) {
          const hiderProfile = mockProfiles.get(hider.userId);
          if (hiderProfile) {
            hider.revealedLat = hiderProfile.lat;
            hider.revealedLng = hiderProfile.lng;
            hider.revealedAt = now;
          }
        }
      });

      // A. FREEZE TRAP HAZARD PROXIMITY CHECK (MOCK)
      const matchPowerUps = mockPowerUps.get(matchId) || [];
      const activeTraps = matchPowerUps.filter(
        p => p.type === 'freeze_trap' && p.isActive && !p.isTriggered && new Date(p.expiresAt).getTime() > now.getTime()
      );

      for (const trap of activeTraps) {
        const opponents = mockParticipants.filter(p => p.matchId === matchId && p.role !== trap.userRole && !p.isCaught && p.userId !== trap.userId);
        for (const opp of opponents) {
          const oppProfile = mockProfiles.get(opp.userId);
          if (!oppProfile || oppProfile.lat == null || oppProfile.lng == null) continue;

          const dist = getDistance(trap.lat, trap.lng, oppProfile.lat, oppProfile.lng);
          if (dist <= (trap.radius || 10)) {
            trap.isTriggered = true;
            trap.isActive = false;
            trap.triggeredBy = opp.userId;
            trap.triggeredAt = now;

            const snareExpiry = now.getTime() + POWERUP_CONFIG.freeze_trap.snareDurationMs;
            playerSnaredMap.set(`${matchId}_${opp.userId}`, snareExpiry);
            opp.isSnared = true;
            opp.snaredUntil = new Date(snareExpiry);

            const deployerProf = mockProfiles.get(trap.userId);
            if (deployerProf) deployerProf.score = (deployerProf.score || 0) + POWERUP_CONFIG.freeze_trap.snareXp;
            break;
          }
        }
      }

      // AUTO-CAPTURE PROXIMITY CHECK
      const captureRadius = matchRow.captureRadius ?? matchRow.catchRadius ?? 4;
      seekers.forEach(seeker => {
        // Snared seekers cannot capture
        const seekerSnaredUntil = playerSnaredMap.get(`${matchId}_${seeker.userId}`) || 0;
        if (seekerSnaredUntil > now.getTime()) return;

        const seekerSprintUntil = playerSprintMap.get(`${matchId}_${seeker.userId}`) || 0;
        const seekerProfile = mockProfiles.get(seeker.userId);
        if (!seekerProfile || seekerProfile.lat == null || seekerProfile.lng == null) return;

        hiders.forEach(hider => {
          if (hider.isCaught) return;

          // Freeze tag immunity check
          if (matchRow.gameMode === 'freeze_tag') {
            if (hider.isFrozen) return;
            const immunityUntil = frozenImmunityMap.get(`${matchId}_${hider.userId}`) || hider.frozenImmunityUntil;
            if (immunityUntil && now.getTime() < immunityUntil) return;
          }

          const hiderProfile = mockProfiles.get(hider.userId);
          if (!hiderProfile || hiderProfile.lat == null || hiderProfile.lng == null) return;

          // Sprint buffer adjustments
          const hiderSprintUntil = playerSprintMap.get(`${matchId}_${hider.userId}`) || 0;
          let effectiveRadius = captureRadius;
          if (seekerSprintUntil > now.getTime()) effectiveRadius += POWERUP_CONFIG.sprint.bonusRadius;
          if (hiderSprintUntil > now.getTime()) effectiveRadius = Math.max(2, effectiveRadius - POWERUP_CONFIG.sprint.bonusRadius);

          const dist = getDistance(seekerProfile.lat, seekerProfile.lng, hiderProfile.lat, hiderProfile.lng);
          if (dist <= effectiveRadius) {
            // SHIELD ABSORPTION CHECK
            const hiderShieldUntil = hider.activeShieldUntil
              ? new Date(hider.activeShieldUntil).getTime()
              : (playerShieldMap.get(`${matchId}_${hider.userId}`) || 0);

            if (hiderShieldUntil > now.getTime()) {
              hider.activeShieldUntil = null;
              playerShieldMap.delete(`${matchId}_${hider.userId}`);
              const activeShield = matchPowerUps.find(p => p.type === 'shield' && p.userId === hider.userId && p.isActive);
              if (activeShield) activeShield.isActive = false;

              const targetProf = mockProfiles.get(hider.userId);
              if (targetProf) targetProf.score = (targetProf.score || 0) + POWERUP_CONFIG.shield.dodgeXp;

              frozenImmunityMap.set(`${matchId}_${hider.userId}`, now.getTime() + POWERUP_CONFIG.shield.graceImmunityMs);
              return;
            }

            if (matchRow.gameMode === 'freeze_tag') {
              hider.isFrozen = true;
              hider.frozenAt = now;
              seekerProfile.score = (seekerProfile.score || 0) + 100;
              mockCatches.push({ id: mockCatches.length + 1, matchId, hunterId: seeker.userId, targetId: hider.userId, timestamp: now });
            } else if (matchRow.gameMode === 'infection') {
              hider.role = 'seeker';
              hider.isCaught = false;
              seekerProfile.score = (seekerProfile.score || 0) + 100;
              mockCatches.push({ id: mockCatches.length + 1, matchId, hunterId: seeker.userId, targetId: hider.userId, timestamp: now });
            } else {
              hider.isCaught = true;
              seekerProfile.score = (seekerProfile.score || 0) + 100;
              mockCatches.push({ id: mockCatches.length + 1, matchId, hunterId: seeker.userId, targetId: hider.userId, timestamp: now });
            }
          }
        });
      });

      // Bombs in mock
      mockBombs.filter(b => b.matchId === matchId).forEach(bombRow => {
        if (!bombRow.isActive && now >= bombRow.activatesAt) {
          bombRow.isActive = true;
        }

        if (bombRow.isActive) {
          hiders.forEach(hider => {
            if (hider.isCaught) return;
            if (matchRow.gameMode === 'freeze_tag' && hider.isFrozen) return;

            const hiderProfile = mockProfiles.get(hider.userId);
            if (hiderProfile) {
              const dist = getDistance(bombRow.lat, bombRow.lng, hiderProfile.lat, hiderProfile.lng);
              if (dist <= bombRow.radius) {
                // Shield check on bomb hit
                const hiderShieldUntil = hider.activeShieldUntil
                  ? new Date(hider.activeShieldUntil).getTime()
                  : (playerShieldMap.get(`${matchId}_${hider.userId}`) || 0);

                if (hiderShieldUntil > now.getTime()) {
                  hider.activeShieldUntil = null;
                  playerShieldMap.delete(`${matchId}_${hider.userId}`);
                  const activeShield = matchPowerUps.find(p => p.type === 'shield' && p.userId === hider.userId && p.isActive);
                  if (activeShield) activeShield.isActive = false;

                  const targetProf = mockProfiles.get(hider.userId);
                  if (targetProf) targetProf.score = (targetProf.score || 0) + POWERUP_CONFIG.shield.dodgeXp;

                  frozenImmunityMap.set(`${matchId}_${hider.userId}`, now.getTime() + POWERUP_CONFIG.shield.graceImmunityMs);
                  return;
                }

                if (matchRow.gameMode === 'freeze_tag') {
                  hider.isFrozen = true;
                  hider.frozenAt = now;
                  const sp = mockProfiles.get(bombRow.placedById);
                  if (sp) sp.score = (sp.score || 0) + 100;
                  mockCatches.push({ id: mockCatches.length + 1, matchId, hunterId: bombRow.placedById, targetId: hider.userId, timestamp: now });
                } else if (matchRow.gameMode === 'infection') {
                  hider.role = 'seeker';
                  hider.isCaught = false;
                  const sp = mockProfiles.get(bombRow.placedById);
                  if (sp) sp.score = (sp.score || 0) + 100;
                  mockCatches.push({ id: mockCatches.length + 1, matchId, hunterId: bombRow.placedById, targetId: hider.userId, timestamp: now });
                } else {
                  hider.isCaught = true;
                  const sp = mockProfiles.get(bombRow.placedById);
                  if (sp) sp.score = (sp.score || 0) + 100;
                  mockCatches.push({ id: mockCatches.length + 1, matchId, hunterId: bombRow.placedById, targetId: hider.userId, timestamp: now });
                }
              }
            }
          });
        }
      });

      // Win check
      if (matchRow.gameMode === 'freeze_tag') {
        const currentHiders = mockParticipants.filter(p => p.matchId === matchId && p.role === 'hider');
        if (currentHiders.length > 0 && currentHiders.every(h => h.isFrozen || h.isCaught)) {
          matchRow.status = 'finished';
        }
      } else if (matchRow.gameMode === 'infection') {
        const survivors = mockParticipants.filter(p => p.matchId === matchId && p.role === 'hider' && !p.isCaught);
        if (survivors.length === 0) {
          matchRow.status = 'finished';
        }
      } else if (matchRow.gameMode === 'treasure_hunt') {
        const remainingCrystals = mockCollectibles.filter(c => c.matchId === matchId && c.type === 'bounty_crystal' && !c.isCollected);
        if (remainingCrystals.length === 0) {
          matchRow.status = 'finished';
        }
      } else {
        const currentHiders = mockParticipants.filter(p => p.matchId === matchId && p.role === 'hider');
        if (currentHiders.length > 0 && currentHiders.every(h => h.isCaught)) {
          matchRow.status = 'finished';
        }
      }
    }
  }
}

// GET: Match status
app.get('/api/matches/:id', async (req: any, res) => {
  const matchId = req.params.id.toUpperCase();
  const requesterId = req.user?.id || '';

  // Recover match state from client sync header if serverless instance lost it
  const matchSyncHeader = req.headers['x-match-sync'] as string;
  let clientMatchSync: any = null;
  if (matchSyncHeader) {
    try {
      clientMatchSync = JSON.parse(decodeURIComponent(matchSyncHeader));
    } catch (e) {}
  }

  // Rehydrate power-ups from client sync header if provided
  if (clientMatchSync && Array.isArray(clientMatchSync.powerUps)) {
    const existingPowerUps = mockPowerUps.get(matchId) || [];
    const nowMs = Date.now();
    clientMatchSync.powerUps.forEach((pu: any) => {
      const expiresMs = pu.expiresAt ? new Date(pu.expiresAt).getTime() : nowMs + 60000;
      if (expiresMs > nowMs && !existingPowerUps.some(p => p.id === pu.id)) {
        existingPowerUps.push({
          ...pu,
          matchId,
          isActive: pu.isActive ?? true
        });
        if (pu.type === 'shield' && (pu.isActive ?? true) && expiresMs > nowMs) {
          playerShieldMap.set(`${matchId}_${pu.userId}`, expiresMs);
        }
      }
    });
    mockPowerUps.set(matchId, existingPowerUps);
  }

  // Evaluate on-demand serverless tick before serving response
  await evaluateMatchTick(matchId, new Date());

  if (isDbConnected) {
    const matchRow = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
    if (!matchRow) return res.status(404).json({ error: 'Match not found' });

    const participantsList = await db.select({
      id: matchParticipants.id,
      userId: users.id,
      name: users.name,
      avatar: users.avatar,
      role: matchParticipants.role,
      isCaught: matchParticipants.isCaught,
      isFrozen: matchParticipants.isFrozen,
      frozenAt: matchParticipants.frozenAt,
      rescuesCount: matchParticipants.rescuesCount,
      revealedLat: matchParticipants.revealedLat,
      revealedLng: matchParticipants.revealedLng,
      revealedAt: matchParticipants.revealedAt,
      lat: profiles.lat,
      lng: profiles.lng
    }).from(matchParticipants)
      .innerJoin(users, eq(matchParticipants.userId, users.id))
      .innerJoin(profiles, eq(matchParticipants.userId, profiles.id))
      .where(eq(matchParticipants.matchId, matchId));

    const now = Date.now();
    const rawBombs = await db.select().from(bombs).where(eq(bombs.matchId, matchId));
    const activeBombs = rawBombs.map(b => {
      const placedAt = b.activatesAt ? new Date(b.activatesAt).getTime() - ((matchRow.bombArmingTime || 60) * 1000) : 0;
      const hiddenUntil = placedAt + ((matchRow.bombHiddenDuration ?? 45) * 1000);
      const hidden = now < hiddenUntil && b.placedById !== requesterId;
      return { ...b, hidden };
    });

    const matchCollectibles = await db.select().from(collectibles).where(eq(collectibles.matchId, matchId));

    // Compute current shrinking zone radius
    const hidingEndsTime = matchRow.hidingEndsAt ? new Date(matchRow.hidingEndsAt).getTime() : null;
    let currentZoneRadius = matchRow.boundaryRadius ?? 500;
    if (matchRow.status === 'hunting' && hidingEndsTime) {
      const elapsed = Math.max(0, now - hidingEndsTime);
      const intervals = Math.floor(elapsed / ((matchRow.zoneShrinkInterval ?? 120) * 1000));
      currentZoneRadius = Math.max(50, currentZoneRadius - intervals * (matchRow.zoneShrinkAmount ?? 100));
    }

    const activePowerUps = (mockPowerUps.get(matchId) || []).filter(
      p => p.isActive && new Date(p.expiresAt).getTime() > Date.now()
    );

    res.json({ match: { ...matchRow, currentZoneRadius }, participants: participantsList, bombs: activeBombs, collectibles: matchCollectibles, powerUps: activePowerUps });
  } else {
    let matchRow = mockMatches.get(matchId);

    // Auto-restore match if cold serverless instance lost it from memory
    if (!matchRow && clientMatchSync) {
      const restored = clientMatchSync.match || clientMatchSync;
      if (restored.id === matchId) {
        mockMatches.set(matchId, {
          id: matchId,
          hostId: restored.hostId || requesterId || 'host',
          gameMode: restored.gameMode || 'classic',
          rescueRadius: restored.rescueRadius ?? 10,
          status: restored.status || 'waiting',
          hidingDuration: restored.hidingDuration ?? 120,
          revealInterval: restored.revealInterval ?? 120,
          matchDuration: restored.matchDuration ?? 900,
          catchRadius: restored.catchRadius ?? 30,
          captureRadius: restored.captureRadius ?? 4,
          bombArmingTime: restored.bombArmingTime ?? 60,
          bombBlastRadius: restored.bombBlastRadius ?? 25,
          bombHiddenDuration: restored.bombHiddenDuration ?? 45,
          boundaryCenterLat: restored.boundaryCenterLat ?? 59.9139,
          boundaryCenterLng: restored.boundaryCenterLng ?? 10.7522,
          boundaryRadius: restored.boundaryRadius ?? 500,
          zoneShrinkInterval: restored.zoneShrinkInterval ?? 120,
          zoneShrinkAmount: restored.zoneShrinkAmount ?? 100,
          startedAt: restored.startedAt ?? null,
          hidingEndsAt: restored.hidingEndsAt ?? null,
          huntingEndsAt: restored.huntingEndsAt ?? null
        });
        matchRow = mockMatches.get(matchId);

        // Ensure host is participant
        const hostId = matchRow.hostId;
        if (!mockParticipants.some(p => p.matchId === matchId && p.userId === hostId)) {
          mockParticipants.push({
            id: mockParticipants.length + 1,
            matchId: matchId,
            userId: hostId,
            role: 'seeker',
            isCaught: false,
            isFrozen: false,
            frozenAt: null,
            rescuesCount: 0,
            revealedLat: null,
            revealedLng: null,
            revealedAt: null,
            joinedAt: new Date()
          });
        }

        // Rehydrate participants list if provided
        if (Array.isArray(clientMatchSync.participants)) {
          clientMatchSync.participants.forEach((cp: any) => {
            if (!mockParticipants.some(p => p.matchId === matchId && p.userId === cp.userId)) {
              mockParticipants.push({
                id: mockParticipants.length + 1,
                matchId: matchId,
                userId: cp.userId,
                role: cp.role || 'hider',
                isCaught: cp.isCaught ?? false,
                isFrozen: cp.isFrozen ?? false,
                frozenAt: cp.frozenAt ?? null,
                rescuesCount: cp.rescuesCount ?? 0,
                revealedLat: cp.revealedLat ?? null,
                revealedLng: cp.revealedLng ?? null,
                revealedAt: cp.revealedAt ?? null,
                joinedAt: cp.joinedAt ? new Date(cp.joinedAt) : new Date()
              });
            }
          });
        }

        // Rehydrate collectibles if provided
        if (Array.isArray(clientMatchSync.collectibles)) {
          clientMatchSync.collectibles.forEach((cc: any) => {
            if (!mockCollectibles.some(c => c.id === cc.id && c.matchId === matchId)) {
              mockCollectibles.push({ ...cc, matchId });
            }
          });
        }
      }
    }

    if (!matchRow) return res.status(404).json({ error: 'Match not found' });

    const participantsList = mockParticipants.filter(p => p.matchId === matchId).map(p => {
      const u = mockUsers.get(p.userId);
      const prof = mockProfiles.get(p.userId);
      return {
        ...p,
        name: u?.name || p.userId,
        avatar: u?.avatar || '',
        isCaught: p.isCaught ?? false,
        isFrozen: p.isFrozen ?? false,
        frozenAt: p.frozenAt ?? null,
        rescuesCount: p.rescuesCount ?? 0,
        lat: prof?.lat || 0,
        lng: prof?.lng || 0
      };
    });

    const now = Date.now();
    const rawBombs = mockBombs.filter(b => b.matchId === matchId);
    const activeBombs = rawBombs.map(b => {
      const placedAt = b.activatesAt ? new Date(b.activatesAt).getTime() - ((matchRow.bombArmingTime || 60) * 1000) : 0;
      const hiddenUntil = placedAt + ((matchRow.bombHiddenDuration ?? 45) * 1000);
      const hidden = now < hiddenUntil && b.placedById !== requesterId;
      return { ...b, hidden };
    });

    const matchCollectibles = mockCollectibles.filter(c => c.matchId === matchId);

    // Compute current shrinking zone radius
    const hidingEndsTime = matchRow.hidingEndsAt ? new Date(matchRow.hidingEndsAt).getTime() : null;
    let currentZoneRadius = matchRow.boundaryRadius ?? 500;
    if (matchRow.status === 'hunting' && hidingEndsTime) {
      const elapsed = Math.max(0, now - hidingEndsTime);
      const intervals = Math.floor(elapsed / ((matchRow.zoneShrinkInterval ?? 120) * 1000));
      currentZoneRadius = Math.max(50, currentZoneRadius - intervals * (matchRow.zoneShrinkAmount ?? 100));
    }

    const activePowerUps = (mockPowerUps.get(matchId) || []).filter(
      p => p.isActive && new Date(p.expiresAt).getTime() > Date.now()
    );

    res.json({ match: { ...matchRow, currentZoneRadius }, participants: participantsList, bombs: activeBombs, collectibles: matchCollectibles, powerUps: activePowerUps });
  }
});

// POST: Join a match
app.post('/api/matches/:id/join', async (req: any, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const matchId = req.params.id.toUpperCase();
  const { role } = req.body; // 'hider' | 'seeker'

  if (isDbConnected) {
    const matchRow = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
    if (!matchRow) return res.status(404).json({ error: 'Match not found' });
    if (matchRow.status !== 'waiting') return res.status(400).json({ error: 'Match already started' });

    // Check if participant count exceeds 10
    const count = await db.select({ count: sql`count(*)` }).from(matchParticipants).where(eq(matchParticipants.matchId, matchId));
    if (Number(count[0].count) >= 10) {
      return res.status(400).json({ error: 'Match is full (Max 10 players)' });
    }

    // Check if user already in match
    const existing = await db.query.matchParticipants.findFirst({
      where: and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.userId, req.user.id))
    });

    if (existing) {
      await db.update(matchParticipants).set({ role }).where(eq(matchParticipants.id, existing.id));
    } else {
      await db.insert(matchParticipants).values({ matchId, userId: req.user.id, role });
    }
    res.json({ success: true });
  } else {
    const matchRow = mockMatches.get(matchId);
    if (!matchRow) return res.status(404).json({ error: 'Match not found' });
    if (matchRow.status !== 'waiting') return res.status(400).json({ error: 'Match already started' });

    const parts = mockParticipants.filter(p => p.matchId === matchId);
    if (parts.length >= 10) {
      return res.status(400).json({ error: 'Match is full (Max 10 players)' });
    }

    const existingIndex = mockParticipants.findIndex(p => p.matchId === matchId && p.userId === req.user.id);
    if (existingIndex > -1) {
      mockParticipants[existingIndex].role = role;
    } else {
      mockParticipants.push({
        id: mockParticipants.length + 1,
        matchId,
        userId: req.user.id,
        role,
        isCaught: false,
        revealedLat: null,
        revealedLng: null,
        revealedAt: null,
        joinedAt: new Date()
      });
    }
    res.json({ success: true });
  }
});

// POST: Update match settings
app.post('/api/matches/:id/settings', async (req: any, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const matchId = req.params.id.toUpperCase();
  const settingsObj = { ...req.body }; // durations, center, radius, gameMode, rescueRadius, etc.

  // Validate gameMode if supplied
  if (settingsObj.gameMode && !['classic', 'freeze_tag', 'infection', 'treasure_hunt'].includes(settingsObj.gameMode)) {
    return res.status(400).json({ error: `Invalid gameMode: ${settingsObj.gameMode}` });
  }

  if (isDbConnected) {
    const matchRow = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
    if (!matchRow) return res.status(404).json({ error: 'Match not found' });
    if (matchRow.hostId !== req.user.id) return res.status(403).json({ error: 'Only the host can modify settings' });

    await db.update(matches).set(settingsObj).where(eq(matches.id, matchId));
    res.json({ success: true });
  } else {
    const matchRow = mockMatches.get(matchId);
    if (!matchRow) return res.status(404).json({ error: 'Match not found' });
    if (matchRow.hostId !== req.user.id) return res.status(403).json({ error: 'Only the host can modify settings' });

    Object.assign(matchRow, settingsObj);
    res.json({ success: true });
  }
});

// POST: Start a match
app.post('/api/matches/:id/start', async (req: any, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const matchId = req.params.id.toUpperCase();

  if (isDbConnected) {
    const matchRow = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
    if (!matchRow) return res.status(404).json({ error: 'Match not found' });
    if (matchRow.hostId !== req.user.id) return res.status(403).json({ error: 'Only the host can start the match' });

    const startedAt = new Date();
    const hidingEndsAt = new Date(startedAt.getTime() + matchRow.hidingDuration * 1000);
    const huntingEndsAt = new Date(hidingEndsAt.getTime() + matchRow.matchDuration * 1000);

    await db.update(matches).set({
      status: 'hiding',
      startedAt,
      hidingEndsAt,
      huntingEndsAt
    }).where(eq(matches.id, matchId));

    // Spawn collectibles for the match
    const spawnedCollectibles = generateMatchCollectibles(
      matchId,
      matchRow.boundaryCenterLat || 59.9139,
      matchRow.boundaryCenterLng || 10.7522,
      matchRow.boundaryRadius || 500
    );

    await db.delete(collectibles).where(eq(collectibles.matchId, matchId));
    await db.insert(collectibles).values(spawnedCollectibles);

    res.json({ success: true });
  } else {
    const matchRow = mockMatches.get(matchId);
    if (!matchRow) return res.status(404).json({ error: 'Match not found' });
    if (matchRow.hostId !== req.user.id) return res.status(403).json({ error: 'Only the host can start the match' });

    const startedAt = new Date();
    const hidingEndsAt = new Date(startedAt.getTime() + matchRow.hidingDuration * 1000);
    const huntingEndsAt = new Date(hidingEndsAt.getTime() + matchRow.matchDuration * 1000);

    matchRow.status = 'hiding';
    matchRow.startedAt = startedAt;
    matchRow.hidingEndsAt = hidingEndsAt;
    matchRow.huntingEndsAt = huntingEndsAt;

    // Spawn collectibles for mock match
    const spawnedCollectibles = generateMatchCollectibles(
      matchId,
      matchRow.boundaryCenterLat || 59.9139,
      matchRow.boundaryCenterLng || 10.7522,
      matchRow.boundaryRadius || 500
    );

    mockCollectibles = mockCollectibles.filter(c => c.matchId !== matchId);
    mockCollectibles.push(...spawnedCollectibles);

    res.json({ success: true });
  }
});

// POST: Catch a hider (private match) — manual fallback, auto-capture runs in server loop
app.post('/api/matches/:id/catch', async (req: any, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const matchId = req.params.id.toUpperCase();
  const { targetId } = req.body;

  await evaluateMatchTick(matchId, new Date());

  if (isDbConnected) {
    const matchRow = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
    if (!matchRow || matchRow.status !== 'hunting') {
      return res.status(400).json({ error: 'Match is not in hunting phase' });
    }
    const captureRadius = matchRow.captureRadius ?? matchRow.catchRadius ?? 30;

    const myProfile = await db.query.profiles.findFirst({ where: eq(profiles.id, req.user.id) });
    const targetPart = await db.query.matchParticipants.findFirst({
      where: and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.userId, targetId))
    });
    // Use live hider profile position, not the revealed snapshot
    const targetProfile = await db.query.profiles.findFirst({ where: eq(profiles.id, targetId) });

    // Check if seeker is snared by Freeze Trap
    const seekerSnaredUntil = playerSnaredMap.get(`${matchId}_${req.user.id}`) || 0;
    if (seekerSnaredUntil > Date.now()) {
      const remSec = Math.ceil((seekerSnaredUntil - Date.now()) / 1000);
      return res.status(400).json({ error: `You are snared by a Freeze Trap (${remSec}s remaining)` });
    }

    if (!myProfile || !targetPart || targetPart.role !== 'hider' || targetPart.isCaught) {
      return res.status(400).json({ error: 'Invalid catch target' });
    }
    if (matchRow.gameMode === 'freeze_tag' && targetPart.isFrozen) {
      return res.status(400).json({ error: 'Player is already frozen' });
    }
    if (!targetProfile || targetProfile.lat == null) {
      return res.status(400).json({ error: 'Hider position not available' });
    }

    // Freeze Tag immunity check
    if (matchRow.gameMode === 'freeze_tag') {
      const immunityUntil = frozenImmunityMap.get(`${matchId}_${targetId}`);
      if (immunityUntil && Date.now() < immunityUntil) {
        return res.status(400).json({ error: 'Target has post-rescue immunity' });
      }
    }

    // Shield Bubble absorption check
    const targetShieldUntil = targetPart.activeShieldUntil
      ? new Date(targetPart.activeShieldUntil).getTime()
      : (playerShieldMap.get(`${matchId}_${targetId}`) || 0);

    if (targetShieldUntil > Date.now()) {
      targetPart.activeShieldUntil = null;
      playerShieldMap.delete(`${matchId}_${targetId}`);
      const matchPowerUps = mockPowerUps.get(matchId) || [];
      const activeShield = matchPowerUps.find(p => p.type === 'shield' && p.userId === targetId && p.isActive);
      if (activeShield) activeShield.isActive = false;

      await db.update(profiles).set({ score: sql`${profiles.score} + ${POWERUP_CONFIG.shield.dodgeXp}` }).where(eq(profiles.id, targetId));
      frozenImmunityMap.set(`${matchId}_${targetId}`, Date.now() + POWERUP_CONFIG.shield.graceImmunityMs);

      return res.status(400).json({ error: 'Target protected by Shield Bubble' });
    }

    const dist = getDistance(myProfile.lat || 0, myProfile.lng || 0, targetProfile.lat, targetProfile.lng);
    if (dist > captureRadius) {
      return res.status(400).json({ error: `Hider is too far (Distance: ${Math.round(dist)}m, Limit: ${captureRadius}m)` });
    }

    const now = new Date();
    if (matchRow.gameMode === 'freeze_tag') {
      await db.update(matchParticipants).set({ isFrozen: true, frozenAt: now }).where(eq(matchParticipants.id, targetPart.id));
      await db.insert(catches).values({ hunterId: req.user.id, targetId, matchId, timestamp: now });
      await db.update(profiles).set({ score: sql`${profiles.score} + 100` }).where(eq(profiles.id, req.user.id));
    } else if (matchRow.gameMode === 'infection') {
      await db.update(matchParticipants).set({ role: 'seeker', isCaught: false }).where(eq(matchParticipants.id, targetPart.id));
      await db.insert(catches).values({ hunterId: req.user.id, targetId, matchId, timestamp: now });
      await db.update(profiles).set({ score: sql`${profiles.score} + 100` }).where(eq(profiles.id, req.user.id));
    } else {
      await db.update(matchParticipants).set({ isCaught: true }).where(eq(matchParticipants.id, targetPart.id));
      await db.insert(catches).values({ hunterId: req.user.id, targetId, matchId, timestamp: now });
      await db.update(profiles).set({ score: sql`${profiles.score} + 100` }).where(eq(profiles.id, req.user.id));
    }

    res.json({ success: true });
  } else {
    const matchRow = mockMatches.get(matchId);
    if (!matchRow || matchRow.status !== 'hunting') {
      return res.status(400).json({ error: 'Match is not in hunting phase' });
    }
    const captureRadius = matchRow.captureRadius ?? matchRow.catchRadius ?? 30;

    // Check if seeker is snared by Freeze Trap
    const seekerSnaredUntil = playerSnaredMap.get(`${matchId}_${req.user.id}`) || 0;
    if (seekerSnaredUntil > Date.now()) {
      const remSec = Math.ceil((seekerSnaredUntil - Date.now()) / 1000);
      return res.status(400).json({ error: `You are snared by a Freeze Trap (${remSec}s remaining)` });
    }

    const myProfile = mockProfiles.get(req.user.id);
    const targetPart = mockParticipants.find(p => p.matchId === matchId && p.userId === targetId);
    const targetProfile = mockProfiles.get(targetId);

    if (!myProfile || !targetPart || targetPart.role !== 'hider' || targetPart.isCaught) {
      return res.status(400).json({ error: 'Invalid catch target' });
    }
    if (matchRow.gameMode === 'freeze_tag' && targetPart.isFrozen) {
      return res.status(400).json({ error: 'Player is already frozen' });
    }
    if (!targetProfile || targetProfile.lat == null) {
      return res.status(400).json({ error: 'Hider position not available' });
    }

    // Freeze Tag immunity check
    if (matchRow.gameMode === 'freeze_tag') {
      const immunityUntil = frozenImmunityMap.get(`${matchId}_${targetId}`) || targetPart.frozenImmunityUntil;
      if (immunityUntil && Date.now() < immunityUntil) {
        return res.status(400).json({ error: 'Target has post-rescue immunity' });
      }
    }

    // Shield Bubble absorption check
    const targetShieldUntil = targetPart.activeShieldUntil
      ? new Date(targetPart.activeShieldUntil).getTime()
      : (playerShieldMap.get(`${matchId}_${targetId}`) || 0);

    if (targetShieldUntil > Date.now()) {
      targetPart.activeShieldUntil = null;
      playerShieldMap.delete(`${matchId}_${targetId}`);
      const matchPowerUps = mockPowerUps.get(matchId) || [];
      const activeShield = matchPowerUps.find(p => p.type === 'shield' && p.userId === targetId && p.isActive);
      if (activeShield) activeShield.isActive = false;

      targetProfile.score = (targetProfile.score || 0) + POWERUP_CONFIG.shield.dodgeXp;
      frozenImmunityMap.set(`${matchId}_${targetId}`, Date.now() + POWERUP_CONFIG.shield.graceImmunityMs);

      return res.status(400).json({ error: 'Target protected by Shield Bubble' });
    }

    const dist = getDistance(myProfile.lat, myProfile.lng, targetProfile.lat, targetProfile.lng);
    if (dist > captureRadius) {
      return res.status(400).json({ error: `Hider is too far (${Math.round(dist)}m)` });
    }

    const now = new Date();
    if (matchRow.gameMode === 'freeze_tag') {
      targetPart.isFrozen = true;
      targetPart.frozenAt = now;
      myProfile.score = (myProfile.score || 0) + 100;
      mockCatches.push({ id: mockCatches.length + 1, matchId, hunterId: req.user.id, targetId, timestamp: now });
    } else if (matchRow.gameMode === 'infection') {
      targetPart.role = 'seeker';
      targetPart.isCaught = false;
      myProfile.score = (myProfile.score || 0) + 100;
      mockCatches.push({ id: mockCatches.length + 1, matchId, hunterId: req.user.id, targetId, timestamp: now });
    } else {
      targetPart.isCaught = true;
      myProfile.score = (myProfile.score || 0) + 100;
      mockCatches.push({ id: mockCatches.length + 1, matchId, hunterId: req.user.id, targetId, timestamp: now });
    }

    res.json({ success: true });
  }
});

// POST: Deploy tactical power-up (sprint, decoy, shield, freeze_trap)
app.post('/api/matches/:id/powerup', async (req: any, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const matchId = req.params.id.toUpperCase();
  const { type, lat, lng } = req.body;

  // 1. Validate payload parameters
  const VALID_TYPES = ['sprint', 'decoy', 'shield', 'freeze_trap'];
  if (!type || !VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Invalid power-up type' });
  }
  let pLat = typeof lat === 'number' && !isNaN(lat) ? lat : null;
  let pLng = typeof lng === 'number' && !isNaN(lng) ? lng : null;

  if (pLat == null || pLng == null) {
    if (isDbConnected) {
      const prof = await db.query.profiles.findFirst({ where: eq(profiles.id, req.user.id) });
      if (prof?.lat != null && prof?.lng != null) {
        pLat = prof.lat;
        pLng = prof.lng;
      }
    } else {
      const prof = mockProfiles.get(req.user.id);
      if (prof?.lat != null && prof?.lng != null) {
        pLat = prof.lat;
        pLng = prof.lng;
      }
    }
  }

  if (pLat == null || pLng == null) {
    return res.status(400).json({ error: 'Valid lat and lng coordinates are required' });
  }

  // 2. Evaluate tick and verify match status
  await evaluateMatchTick(matchId, new Date());

  const matchRow = isDbConnected
    ? await db.query.matches.findFirst({ where: eq(matches.id, matchId) })
    : mockMatches.get(matchId);

  if (!matchRow) return res.status(404).json({ error: 'Match not found' });
  if (matchRow.status !== 'hunting') {
    return res.status(400).json({ error: 'Power-ups can only be deployed during hunting phase' });
  }

  // 3. Verify player participation and active status
  const participant = isDbConnected
    ? await db.query.matchParticipants.findFirst({
        where: and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.userId, req.user.id))
      })
    : mockParticipants.find(p => p.matchId === matchId && p.userId === req.user.id);

  if (!participant) {
    return res.status(403).json({ error: 'You are not a participant in this match' });
  }
  if (participant.isCaught) {
    return res.status(400).json({ error: 'Captured players cannot deploy power-ups' });
  }
  if (matchRow.gameMode === 'freeze_tag' && participant.isFrozen) {
    return res.status(400).json({ error: 'Frozen players cannot deploy power-ups' });
  }

  // 4. Verify cooldown
  const nowMs = Date.now();
  const userCooldownKey = `${matchId}_${req.user.id}`;
  const userCooldowns = playerPowerUpCooldowns.get(userCooldownKey) || {};

  if (userCooldowns[type] && userCooldowns[type] > nowMs) {
    const remainingSec = Math.ceil((userCooldowns[type] - nowMs) / 1000);
    return res.status(400).json({
      error: `Power-up on cooldown (${remainingSec}s remaining)`,
      cooldownUntil: userCooldowns[type]
    });
  }

  // 5. Update cooldown timestamp
  const config = POWERUP_CONFIG[type as keyof typeof POWERUP_CONFIG];
  userCooldowns[type] = nowMs + config.cooldownMs;
  playerPowerUpCooldowns.set(userCooldownKey, userCooldowns);

  // 6. Create ActivePowerUp entity
  const activeDuration = config.durationMs;
  const powerUpId = `${matchId}_${type}_${nowMs}_${Math.random().toString(36).substring(2, 6)}`;
  const newPowerUp: ActivePowerUp = {
    id: powerUpId,
    matchId,
    userId: req.user.id,
    userName: req.user.name || 'Operative',
    userRole: participant.role,
    type: type as 'sprint' | 'decoy' | 'shield' | 'freeze_trap',
    lat: pLat,
    lng: pLng,
    radius: type === 'freeze_trap' ? POWERUP_CONFIG.freeze_trap.trapRadius : undefined,
    activatedAt: new Date(nowMs),
    expiresAt: new Date(nowMs + activeDuration),
    isActive: true,
    isTriggered: false,
    triggeredBy: null
  };

  // 7. Store in active match power-ups
  const matchPowerUps = mockPowerUps.get(matchId) || [];
  matchPowerUps.push(newPowerUp);
  mockPowerUps.set(matchId, matchPowerUps);

  // 8. Register type-specific active buffs in ephemeral maps
  if (type === 'shield') {
    playerShieldMap.set(userCooldownKey, nowMs + activeDuration);
    participant.activeShieldUntil = new Date(nowMs + activeDuration);
  } else if (type === 'sprint') {
    playerSprintMap.set(userCooldownKey, nowMs + activeDuration);
    participant.activeSprintUntil = new Date(nowMs + activeDuration);
  }

  res.json({
    success: true,
    powerUp: newPowerUp,
    cooldownUntil: userCooldowns[type],
    activeUntil: nowMs + activeDuration
  });
});

// POST: Rescue a frozen teammate in Freeze Tag mode
app.post('/api/matches/:id/rescue', async (req: any, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const matchId = req.params.id.toUpperCase();
  const { targetId } = req.body;

  if (!targetId) return res.status(400).json({ error: 'Missing targetId' });
  if (targetId === req.user.id) return res.status(400).json({ error: 'Cannot rescue yourself' });

  if (isDbConnected) {
    const matchRow = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
    if (!matchRow || matchRow.status !== 'hunting') {
      return res.status(400).json({ error: 'Match is not in hunting phase' });
    }
    if (matchRow.gameMode !== 'freeze_tag') {
      return res.status(400).json({ error: 'Rescue is only available in Freeze Tag mode' });
    }

    const rescueRadius = matchRow.rescueRadius ?? 10;

    const rescuerPart = await db.query.matchParticipants.findFirst({
      where: and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.userId, req.user.id))
    });
    const targetPart = await db.query.matchParticipants.findFirst({
      where: and(eq(matchParticipants.matchId, matchId), eq(matchParticipants.userId, targetId))
    });

    if (!rescuerPart || rescuerPart.role !== 'hider' || rescuerPart.isCaught || rescuerPart.isFrozen) {
      return res.status(400).json({ error: 'Rescuer must be an active, unfrozen runner' });
    }
    if (!targetPart || targetPart.role !== 'hider' || !targetPart.isFrozen || targetPart.isCaught) {
      return res.status(400).json({ error: 'Target is not a frozen teammate' });
    }

    const rescuerProf = await db.query.profiles.findFirst({ where: eq(profiles.id, req.user.id) });
    const targetProf = await db.query.profiles.findFirst({ where: eq(profiles.id, targetId) });

    if (!rescuerProf?.lat || !targetProf?.lat) {
      return res.status(400).json({ error: 'GPS positions unavailable' });
    }

    const dist = getDistance(rescuerProf.lat, rescuerProf.lng, targetProf.lat, targetProf.lng);
    if (dist > rescueRadius) {
      return res.status(400).json({ error: `Teammate is too far to rescue (${Math.round(dist)}m > ${rescueRadius}m)` });
    }

    await db.update(matchParticipants).set({ isFrozen: false, frozenAt: null }).where(eq(matchParticipants.id, targetPart.id));
    await db.update(matchParticipants).set({ rescuesCount: sql`${matchParticipants.rescuesCount} + 1` }).where(eq(matchParticipants.id, rescuerPart.id));
    await db.update(profiles).set({ score: sql`${profiles.score} + 50` }).where(eq(profiles.id, req.user.id));

    frozenImmunityMap.set(`${matchId}_${targetId}`, Date.now() + 3000);

    return res.json({ success: true, message: 'Teammate rescued!', rescuesCount: (rescuerPart.rescuesCount || 0) + 1, immunityMs: 3000 });
  } else {
    const matchRow = mockMatches.get(matchId);
    if (!matchRow || matchRow.status !== 'hunting') {
      return res.status(400).json({ error: 'Match is not in hunting phase' });
    }
    if (matchRow.gameMode !== 'freeze_tag') {
      return res.status(400).json({ error: 'Rescue is only available in Freeze Tag mode' });
    }

    const rescueRadius = matchRow.rescueRadius ?? 10;
    const rescuerPart = mockParticipants.find(p => p.matchId === matchId && p.userId === req.user.id);
    const targetPart = mockParticipants.find(p => p.matchId === matchId && p.userId === targetId);

    if (!rescuerPart || rescuerPart.role !== 'hider' || rescuerPart.isCaught || rescuerPart.isFrozen) {
      return res.status(400).json({ error: 'Rescuer must be an active, unfrozen runner' });
    }
    if (!targetPart || targetPart.role !== 'hider' || !targetPart.isFrozen || targetPart.isCaught) {
      return res.status(400).json({ error: 'Target is not a frozen teammate' });
    }

    const rescuerProf = mockProfiles.get(req.user.id);
    const targetProf = mockProfiles.get(targetId);

    if (!rescuerProf?.lat || !targetProf?.lat) {
      return res.status(400).json({ error: 'GPS positions unavailable' });
    }

    const dist = getDistance(rescuerProf.lat, rescuerProf.lng, targetProf.lat, targetProf.lng);
    if (dist > rescueRadius) {
      return res.status(400).json({ error: `Teammate is too far to rescue (${Math.round(dist)}m > ${rescueRadius}m)` });
    }

    targetPart.isFrozen = false;
    targetPart.frozenAt = null;
    targetPart.frozenImmunityUntil = Date.now() + 3000;
    frozenImmunityMap.set(`${matchId}_${targetId}`, Date.now() + 3000);
    rescuerPart.rescuesCount = (rescuerPart.rescuesCount || 0) + 1;
    if (rescuerProf) rescuerProf.score = (rescuerProf.score || 0) + 50;

    return res.json({ success: true, message: 'Teammate rescued!', rescuesCount: rescuerPart.rescuesCount, immunityMs: 3000 });
  }
});

// POST: Collect an item in Geo-Bounty Skattejakt / Treasure Hunt mode
app.post('/api/matches/:id/collect', async (req: any, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const matchId = req.params.id.toUpperCase();
  const { itemId } = req.body;

  if (!itemId) return res.status(400).json({ error: 'itemId is required' });

  const collectRadius = 10; // 10 meters pickup radius

  if (isDbConnected) {
    const item = await db.query.collectibles.findFirst({
      where: and(eq(collectibles.id, itemId), eq(collectibles.matchId, matchId))
    });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.isCollected) return res.status(400).json({ error: 'Item already collected' });

    const matchRow = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
    if (!matchRow || (matchRow.status !== 'hiding' && matchRow.status !== 'hunting')) {
      return res.status(400).json({ error: 'Match is not active' });
    }

    const myProfile = await db.query.profiles.findFirst({ where: eq(profiles.id, req.user.id) });
    if (!myProfile || myProfile.lat == null || myProfile.lng == null) {
      return res.status(400).json({ error: 'Player GPS coordinates unavailable' });
    }

    const dist = getDistance(myProfile.lat, myProfile.lng, item.lat, item.lng);
    if (dist > collectRadius) {
      return res.status(400).json({ error: `Too far (${Math.round(dist)}m > ${collectRadius}m)` });
    }

    const now = new Date();
    const updated = await db.update(collectibles)
      .set({ isCollected: true, collectedById: req.user.id, collectedAt: now })
      .where(and(eq(collectibles.id, itemId), eq(collectibles.matchId, matchId), eq(collectibles.isCollected, false)))
      .returning();

    if (updated.length === 0) {
      return res.status(400).json({ error: 'Item already collected by another player' });
    }

    await db.update(profiles).set({ score: sql`${profiles.score} + ${item.points}` }).where(eq(profiles.id, req.user.id));

    // Win check: Did player take the last Bounty Crystal?
    const uncollectedCrystals = await db.select({ count: sql`count(*)` })
      .from(collectibles)
      .where(and(
        eq(collectibles.matchId, matchId),
        eq(collectibles.type, 'bounty_crystal'),
        eq(collectibles.isCollected, false)
      ));

    let matchFinished = false;
    if (Number(uncollectedCrystals[0]?.count ?? 1) === 0) {
      await db.update(matches).set({ status: 'finished' }).where(eq(matches.id, matchId));
      matchFinished = true;
    }

    res.json({ success: true, item: updated[0], points: item.points, pointsAwarded: item.points, matchFinished });
  } else {
    const item = mockCollectibles.find(c => c.id === itemId && c.matchId === matchId);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    if (item.isCollected) return res.status(400).json({ error: 'Item already collected' });

    const matchRow = mockMatches.get(matchId);
    if (!matchRow || (matchRow.status !== 'hiding' && matchRow.status !== 'hunting')) {
      return res.status(400).json({ error: 'Match is not active' });
    }

    const myProfile = mockProfiles.get(req.user.id);
    if (!myProfile || myProfile.lat == null || myProfile.lng == null) {
      return res.status(400).json({ error: 'Player GPS coordinates unavailable' });
    }

    const dist = getDistance(myProfile.lat, myProfile.lng, item.lat, item.lng);
    if (dist > collectRadius) {
      return res.status(400).json({ error: `Too far (${Math.round(dist)}m > ${collectRadius}m)` });
    }

    item.isCollected = true;
    item.collectedById = req.user.id;
    item.collectedAt = new Date();
    myProfile.score = (myProfile.score || 0) + item.points;

    const remainingCrystals = mockCollectibles.filter(
      c => c.matchId === matchId && c.type === 'bounty_crystal' && !c.isCollected
    );

    let matchFinished = false;
    if (remainingCrystals.length === 0) {
      matchRow.status = 'finished';
      matchFinished = true;
    }

    res.json({ success: true, item, points: item.points, pointsAwarded: item.points, matchFinished });
  }
});

// POST: Place a bomb (private match)
app.post('/api/matches/:id/bomb', async (req: any, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const matchId = req.params.id.toUpperCase();
  const { lat, lng } = req.body;

  if (isDbConnected) {
    const matchRow = await db.query.matches.findFirst({ where: eq(matches.id, matchId) });
    if (!matchRow || matchRow.status !== 'hunting') {
      return res.status(400).json({ error: 'Match is not in hunting phase' });
    }

    const activatesAt = new Date(Date.now() + matchRow.bombArmingTime * 1000);
    const newBomb = await db.insert(bombs).values({
      matchId,
      placedById: req.user.id,
      lat,
      lng,
      radius: matchRow.bombBlastRadius,
      activatesAt,
      isActive: false
    }).returning();

    res.json(newBomb[0]);
  } else {
    const matchRow = mockMatches.get(matchId);
    if (!matchRow || matchRow.status !== 'hunting') {
      return res.status(400).json({ error: 'Match is not in hunting phase' });
    }

    const activatesAt = new Date(Date.now() + matchRow.bombArmingTime * 1000);
    const bombObj = {
      id: mockBombs.length + 1,
      matchId,
      placedById: req.user.id,
      lat,
      lng,
      radius: matchRow.bombBlastRadius,
      activatesAt,
      isActive: false
    };

    mockBombs.push(bombObj);
    res.json(bombObj);
  }
});

// --- SOCIAL / FRIENDS API ---

// GET: Friends list
app.get('/api/social/friends', async (req: any, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  if (isDbConnected) {
    const list = await db.select({
      id: friends.id,
      userOneId: friends.userOneId,
      userTwoId: friends.userTwoId,
      status: friends.status,
      // Joined user info helper
    }).from(friends).where(
      or(eq(friends.userOneId, req.user.id), eq(friends.userTwoId, req.user.id))
    );

    const populated = await Promise.all(list.map(async f => {
      const otherId = f.userOneId === req.user.id ? f.userTwoId : f.userOneId;
      const otherUser = await db.query.users.findFirst({ where: eq(users.id, otherId) });
      const otherProfile = await db.query.profiles.findFirst({ where: eq(profiles.id, otherId) });
      return {
        id: f.id,
        status: f.status,
        senderId: f.userOneId, // The sender is always userOne
        friend: {
          id: otherId,
          name: otherUser?.name || otherId,
          avatar: otherUser?.avatar || '',
          score: otherProfile?.score || 0
        }
      };
    }));

    res.json(populated);
  } else {
    const list = mockFriends.filter(f => f.userOneId === req.user.id || f.userTwoId === req.user.id);
    const populated = list.map(f => {
      const otherId = f.userOneId === req.user.id ? f.userTwoId : f.userOneId;
      const otherUser = mockUsers.get(otherId);
      const otherProfile = mockProfiles.get(otherId);
      return {
        id: f.id,
        status: f.status,
        senderId: f.userOneId,
        friend: {
          id: otherId,
          name: otherUser?.name || otherId,
          avatar: otherUser?.avatar || '',
          score: otherProfile?.score || 0
        }
      };
    });
    res.json(populated);
  }
});

// POST: Send friend request by username, usertag (@...), player ID, or email
app.post('/api/social/friends/request', async (req: any, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { email, username, tag, identifier, query } = req.body;
  const rawSearch = (query || tag || username || identifier || email || '').trim();

  if (!rawSearch) {
    return res.status(400).json({ error: 'Please enter a username, player tag, or email' });
  }

  const cleanSearch = rawSearch.replace(/^[@#]/, '').trim().toLowerCase();
  const searchEmail = rawSearch.toLowerCase();

  if (isDbConnected) {
    const targetUser = await db.query.users.findFirst({
      where: or(
        sql`lower(${users.name}) = ${cleanSearch}`,
        sql`lower(${users.id}) = ${cleanSearch}`,
        sql`lower(${users.email}) = ${searchEmail}`
      )
    });

    if (!targetUser) {
      return res.status(404).json({ error: `Player "${rawSearch}" not found. Check the username or tag.` });
    }
    if (targetUser.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot add yourself as a friend' });
    }

    // Check if request exists
    const existing = await db.query.friends.findFirst({
      where: or(
        and(eq(friends.userOneId, req.user.id), eq(friends.userTwoId, targetUser.id)),
        and(eq(friends.userOneId, targetUser.id), eq(friends.userTwoId, req.user.id))
      )
    });

    if (existing) {
      return res.status(400).json({ 
        error: existing.status === 'accepted' 
          ? `You are already friends with ${targetUser.name}` 
          : 'Friend request already sent or pending approval' 
      });
    }

    await db.insert(friends).values({
      userOneId: req.user.id,
      userTwoId: targetUser.id,
      status: 'pending'
    });

    res.json({ success: true, targetUser: { id: targetUser.id, name: targetUser.name } });
  } else {
    let targetUser: any = null;
    mockUsers.forEach(u => {
      if (
        (u.name && u.name.toLowerCase() === cleanSearch) ||
        (u.id && u.id.toLowerCase() === cleanSearch) ||
        (u.email && u.email.toLowerCase() === searchEmail)
      ) {
        targetUser = u;
      }
    });

    if (!targetUser) {
      return res.status(404).json({ error: `Player "${rawSearch}" not found. Check the username or tag.` });
    }
    if (targetUser.id === req.user.id) {
      return res.status(400).json({ error: 'You cannot add yourself as a friend' });
    }

    const existing = mockFriends.find(f => 
      (f.userOneId === req.user.id && f.userTwoId === targetUser.id) ||
      (f.userOneId === targetUser.id && f.userTwoId === req.user.id)
    );
    if (existing) {
      return res.status(400).json({ 
        error: existing.status === 'accepted' 
          ? `You are already friends with ${targetUser.name}` 
          : 'Friend request already sent or pending approval' 
      });
    }

    mockFriends.push({
      id: mockFriends.length + 1,
      userOneId: req.user.id,
      userTwoId: targetUser.id,
      status: 'pending'
    });

    res.json({ success: true, targetUser: { id: targetUser.id, name: targetUser.name } });
  }
});

// POST: Accept friend request
app.post('/api/social/friends/accept', async (req: any, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { requestId } = req.body;

  if (isDbConnected) {
    await db.update(friends).set({ status: 'accepted' }).where(
      and(eq(friends.id, requestId), eq(friends.userTwoId, req.user.id))
    );
    res.json({ success: true });
  } else {
    const reqObj = mockFriends.find(f => f.id === requestId && f.userTwoId === req.user.id);
    if (!reqObj) return res.status(404).json({ error: 'Friend request not found' });
    reqObj.status = 'accepted';
    res.json({ success: true });
  }
});

// GET: Get messages (DMs or match chats)
app.get('/api/social/messages', async (req: any, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { receiverId, matchId } = req.query;

  if (isDbConnected) {
    let list: any[] = [];
    if (matchId) {
      list = await db.select({
        id: messages.id,
        senderId: messages.senderId,
        senderName: users.name,
        content: messages.content,
        timestamp: messages.timestamp
      }).from(messages)
        .innerJoin(users, eq(messages.senderId, users.id))
        .where(eq(messages.matchId, matchId))
        .orderBy(messages.timestamp);
    } else if (receiverId) {
      list = await db.select({
        id: messages.id,
        senderId: messages.senderId,
        senderName: users.name,
        content: messages.content,
        timestamp: messages.timestamp
      }).from(messages)
        .innerJoin(users, eq(messages.senderId, users.id))
        .where(
          or(
            and(eq(messages.senderId, req.user.id), eq(messages.receiverId, receiverId)),
            and(eq(messages.senderId, receiverId), eq(messages.receiverId, req.user.id))
          )
        )
        .orderBy(messages.timestamp);
    }
    res.json(list);
  } else {
    let list: any[] = [];
    if (matchId) {
      list = mockMessages.filter(m => m.matchId === matchId).map(m => {
        const u = mockUsers.get(m.senderId);
        return {
          id: m.id,
          senderId: m.senderId,
          senderName: u?.name || m.senderId,
          content: m.content,
          timestamp: m.timestamp
        };
      });
    } else if (receiverId) {
      list = mockMessages.filter(m => 
        (m.senderId === req.user.id && m.receiverId === receiverId) ||
        (m.senderId === receiverId && m.receiverId === req.user.id)
      ).map(m => {
        const u = mockUsers.get(m.senderId);
        return {
          id: m.id,
          senderId: m.senderId,
          senderName: u?.name || m.senderId,
          content: m.content,
          timestamp: m.timestamp
        };
      });
    }
    res.json(list.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()));
  }
});

// POST: Send message
app.post('/api/social/messages', async (req: any, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const { receiverId, matchId, content } = req.body;

  if (isDbConnected) {
    await db.insert(messages).values({
      senderId: req.user.id,
      receiverId: receiverId || null,
      matchId: matchId || null,
      content,
      timestamp: new Date()
    });
    res.json({ success: true });
  } else {
    mockMessages.push({
      id: mockMessages.length + 1,
      senderId: req.user.id,
      receiverId: receiverId || null,
      matchId: matchId || null,
      content,
      timestamp: new Date()
    });
    res.json({ success: true });
  }
});

// --- SERVER BACKGROUND LOOPS & LOCAL LISTENER ---
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  // Core game tick loop (runs every 1 second)
  setInterval(async () => {
    const now = new Date();

    if (isDbConnected) {
      try {
        // 1. Process active matches
        const activeMatches = await db.select().from(matches).where(
          or(eq(matches.status, 'hiding'), eq(matches.status, 'hunting'))
        );

        for (const matchRow of activeMatches) {
          // --- MOCK WALK SIMULATION ---
          const parts = await db.select().from(matchParticipants).where(eq(matchParticipants.matchId, matchRow.id));
          const mockIds = ['host', 'hider1', 'hider2', 'seeker1'];
          for (const p of parts) {
            const isMock = mockIds.includes(p.userId);
            const isActiveSession = activeUserSessions.has(p.userId) && (Date.now() - activeUserSessions.get(p.userId)! < 5000);
            if (isMock && !isActiveSession) {
              const profileRow = await db.query.profiles.findFirst({ where: eq(profiles.id, p.userId) });
              if (profileRow && profileRow.lat && profileRow.lng) {
                const { nextLat, nextLng } = simulateRandomWalk(
                  profileRow.lat,
                  profileRow.lng,
                  matchRow.boundaryCenterLat,
                  matchRow.boundaryCenterLng,
                  matchRow.boundaryRadius
                );
                await db.update(profiles).set({
                  lat: nextLat,
                  lng: nextLng,
                  updatedAt: now
                }).where(eq(profiles.id, p.userId));
              }
            }
          }

          await evaluateMatchTick(matchRow.id, now);
        }
      } catch (err) {
        console.error('Server loop DB error:', err);
      }
    } else {
      // --- Mock Loop Operations ---
      for (const matchRow of Array.from(mockMatches.values())) {
        if (matchRow.status !== 'hiding' && matchRow.status !== 'hunting') continue;

        // --- MOCK WALK SIMULATION (Mock Database) ---
        const parts = mockParticipants.filter(p => p.matchId === matchRow.id);
        const mockIds = ['host', 'hider1', 'hider2', 'seeker1'];
        parts.forEach(p => {
          const isMock = mockIds.includes(p.userId);
          const isActiveSession = activeUserSessions.has(p.userId) && (Date.now() - activeUserSessions.get(p.userId)! < 5000);
          if (isMock && !isActiveSession) {
            const profileRow = mockProfiles.get(p.userId);
            if (profileRow && profileRow.lat && profileRow.lng) {
              const { nextLat, nextLng } = simulateRandomWalk(
                profileRow.lat,
                profileRow.lng,
                matchRow.boundaryCenterLat,
                matchRow.boundaryCenterLng,
                matchRow.boundaryRadius
              );
              profileRow.lat = nextLat;
              profileRow.lng = nextLng;
              profileRow.updatedAt = now;
            }
          }
        });

        await evaluateMatchTick(matchRow.id, now);
      }
    }
  }, 1000);

  // Global Special Bounty Selector & Wild Zone Ambient Trigger: Run every 60 seconds
  let lastBountyTick = 0;
  setInterval(async () => {
    const now = Date.now();
    if (now - lastBountyTick < 60000) return;
    lastBountyTick = now;

    console.log('🎲 Heartbeat: Checking Wild Zone ambient trigger...');

    // --- Wild Zone Ambient Hunt Mode Trigger Check ---
    const currentHour = new Date().getHours();
    const rand = Math.random();
    let shouldTrigger = false;

    if (currentHour >= 17 && currentHour < 21) {
      if (rand < 0.01) shouldTrigger = true; // 1% chance per minute during peak hours (17:00-21:00)
    } else if (currentHour >= 10 && currentHour < 22) {
      if (rand < 0.002) shouldTrigger = true; // 0.2% chance per minute during other active hours
    }

    if (shouldTrigger) {
      console.log('🎲 Ambient Wild Zone trigger probability hit. Executing cluster scan...');
      triggerWildZoneClusters(false).then(res => {
        if (res.triggeredCount > 0) {
          console.log(`📡 Wild Zone triggered: Launched ${res.triggeredCount} matches:`, res.matches);
        } else {
          console.log('📡 Wild Zone scan completed: No clusters eligible.');
        }
      }).catch(err => {
        console.error('Ambient Wild Zone matching error:', err);
      });
    }
  }, 1000);

  // Start server
  checkDbConnection().then(() => {
    app.listen(port, () => {
      console.log(`🚀 Express server running on http://localhost:${port}`);
    });
  });
}

export default app;
export {
  app,
  checkDbConnection,
  seedMockUsers,
  evaluateMatchTick,
  generateMatchCollectibles,
  getDistance,
  hashSeed,
  mulberry32,
  mockUsers,
  mockProfiles,
  mockMatches,
  mockParticipants,
  mockCollectibles,
  mockCatches,
  mockBombs,
  mockPowerUps,
  playerPowerUpCooldowns,
  playerShieldMap,
  playerSprintMap,
  playerSnaredMap,
  POWERUP_CONFIG,
  frozenImmunityMap,
  matchTickDebounce
};
