import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { db, pool } from './db.js';
import { users, profiles, matches, matchParticipants, bombs, catches, friends, messages, wildZoneEvents } from './schema.js';
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
      avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${id}`
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
  if (!process.env.DATABASE_URL) {
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

  // Dev mode override (reads header or cookie or query param)
  let devUserId = req.headers['x-dev-user-id'] || req.cookies?.['dev-user-id'] || req.query.dev_user_id;
  
  // TEMPORARY AUTO-LOGIN BYPASS:
  // Fallback to default 'host' profile if no user session is present
  if (!userId && !devUserId) {
    devUserId = 'host';
  }

  if (!userId && devUserId) {
    userId = devUserId as string;
    userName = userId.charAt(0).toUpperCase() + userId.slice(1);
    userEmail = `${userId}@bounty.com`;
    userAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${userId}`;
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
            score: 0,
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
        mockProfiles.set(userId, {
          id: userId,
          lat: 59.9139,
          lng: 10.7522,
          score: 0,
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

// POST: Login/Register with Username, Email or External OAuth provider (Google/Apple)
app.post('/api/auth/login', async (req: any, res) => {
  const { id, email, name, username, avatar, transferScore } = req.body;
  
  const rawId = (id || username || name || '').trim();
  const cleanId = rawId.toLowerCase().replace(/\s+/g, '_');
  const cleanName = (name || username || rawId).trim();
  const cleanEmail = (email || `${cleanId}@bounty.com`).trim().toLowerCase();
  const cleanAvatar = avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanId}`;

  if (!cleanId || !cleanName) {
    return res.status(400).json({ error: 'Username or account ID is required' });
  }

  const bonusScore = (typeof transferScore === 'number' && transferScore > 0) ? Math.floor(transferScore) : 0;

  if (isDbConnected) {
    try {
      let userRow = await db.query.users.findFirst({
        where: or(
          eq(users.id, cleanId),
          sql`lower(${users.name}) = ${cleanName.toLowerCase()}`,
          eq(users.email, cleanEmail)
        )
      });

      if (!userRow) {
        await db.insert(users).values({
          id: cleanId,
          email: cleanEmail,
          name: cleanName,
          avatar: cleanAvatar
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

      res.cookie('dev-user-id', userRow.id, getCookieOptions(req));
      return res.json({ success: true, user: userRow });
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
        (u.email && u.email.toLowerCase() === cleanEmail)
      ) {
        existingUser = u;
      }
    });

    if (!existingUser) {
      mockUsers.set(cleanId, {
        id: cleanId,
        email: cleanEmail,
        name: cleanName,
        avatar: cleanAvatar
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

    res.cookie('dev-user-id', existingUser.id, getCookieOptions(req));
    return res.json({ success: true, user: existingUser });
  }
});


// POST: Dev Logout
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
      role: 'seeker'
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

// GET: Match status
app.get('/api/matches/:id', async (req: any, res) => {
  const matchId = req.params.id.toUpperCase();
  const requesterId = req.user?.id || '';

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

    // Compute current shrinking zone radius
    const hidingEndsTime = matchRow.hidingEndsAt ? new Date(matchRow.hidingEndsAt).getTime() : null;
    let currentZoneRadius = matchRow.boundaryRadius ?? 500;
    if (matchRow.status === 'hunting' && hidingEndsTime) {
      const elapsed = Math.max(0, now - hidingEndsTime);
      const intervals = Math.floor(elapsed / ((matchRow.zoneShrinkInterval ?? 120) * 1000));
      currentZoneRadius = Math.max(50, currentZoneRadius - intervals * (matchRow.zoneShrinkAmount ?? 100));
    }

    res.json({ match: { ...matchRow, currentZoneRadius }, participants: participantsList, bombs: activeBombs });
  } else {
    const matchRow = mockMatches.get(matchId);
    if (!matchRow) return res.status(404).json({ error: 'Match not found' });

    const participantsList = mockParticipants.filter(p => p.matchId === matchId).map(p => {
      const u = mockUsers.get(p.userId);
      const prof = mockProfiles.get(p.userId);
      return {
        ...p,
        name: u?.name || p.userId,
        avatar: u?.avatar || '',
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

    // Compute current shrinking zone radius
    const hidingEndsTime = matchRow.hidingEndsAt ? new Date(matchRow.hidingEndsAt).getTime() : null;
    let currentZoneRadius = matchRow.boundaryRadius ?? 500;
    if (matchRow.status === 'hunting' && hidingEndsTime) {
      const elapsed = Math.max(0, now - hidingEndsTime);
      const intervals = Math.floor(elapsed / ((matchRow.zoneShrinkInterval ?? 120) * 1000));
      currentZoneRadius = Math.max(50, currentZoneRadius - intervals * (matchRow.zoneShrinkAmount ?? 100));
    }

    res.json({ match: { ...matchRow, currentZoneRadius }, participants: participantsList, bombs: activeBombs });
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
  const settingsObj = req.body; // durations, center, radius, etc.

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

    res.json({ success: true });
  }
});

// POST: Catch a hider (private match) — manual fallback, auto-capture runs in server loop
app.post('/api/matches/:id/catch', async (req: any, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  const matchId = req.params.id.toUpperCase();
  const { targetId } = req.body;

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

    if (!myProfile || !targetPart || targetPart.role !== 'hider' || targetPart.isCaught) {
      return res.status(400).json({ error: 'Invalid catch target' });
    }
    if (!targetProfile || targetProfile.lat == null) {
      return res.status(400).json({ error: 'Hider position not available' });
    }

    const dist = getDistance(myProfile.lat || 0, myProfile.lng || 0, targetProfile.lat, targetProfile.lng);
    if (dist > captureRadius) {
      return res.status(400).json({ error: `Hider is too far (Distance: ${Math.round(dist)}m, Limit: ${captureRadius}m)` });
    }

    // Capture
    await db.update(matchParticipants).set({ isCaught: true }).where(eq(matchParticipants.id, targetPart.id));
    await db.insert(catches).values({ hunterId: req.user.id, targetId, matchId, timestamp: new Date() });

    // Reward points
    await db.update(profiles).set({ score: sql`${profiles.score} + 100` }).where(eq(profiles.id, req.user.id));

    res.json({ success: true });
  } else {
    const matchRow = mockMatches.get(matchId);
    if (!matchRow || matchRow.status !== 'hunting') {
      return res.status(400).json({ error: 'Match is not in hunting phase' });
    }
    const captureRadius = matchRow.captureRadius ?? matchRow.catchRadius ?? 30;

    const myProfile = mockProfiles.get(req.user.id);
    const targetPart = mockParticipants.find(p => p.matchId === matchId && p.userId === targetId);
    const targetProfile = mockProfiles.get(targetId);

    if (!myProfile || !targetPart || targetPart.role !== 'hider' || targetPart.isCaught) {
      return res.status(400).json({ error: 'Invalid catch target' });
    }
    if (!targetProfile || targetProfile.lat == null) {
      return res.status(400).json({ error: 'Hider position not available' });
    }

    const dist = getDistance(myProfile.lat, myProfile.lng, targetProfile.lat, targetProfile.lng);
    if (dist > captureRadius) {
      return res.status(400).json({ error: `Hider is too far (${Math.round(dist)}m)` });
    }

    targetPart.isCaught = true;
    myProfile.score += 100;

    mockCatches.push({
      id: mockCatches.length + 1,
      matchId,
      hunterId: req.user.id,
      targetId,
      timestamp: new Date()
    });

    res.json({ success: true });
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
if (!process.env.VERCEL) {
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
          let currentStatus = matchRow.status;

          // Transition: Hiding -> Hunting
          if (currentStatus === 'hiding' && matchRow.hidingEndsAt && now >= matchRow.hidingEndsAt) {
            await db.update(matches).set({ status: 'hunting' }).where(eq(matches.id, matchRow.id));
            currentStatus = 'hunting';
          }

          // Transition: Hunting -> Finished (Timeout)
          if (currentStatus === 'hunting' && matchRow.huntingEndsAt && now >= matchRow.huntingEndsAt) {
            await db.update(matches).set({ status: 'finished' }).where(eq(matches.id, matchRow.id));
            continue;
          }

          // Get participants of this match
          const parts = await db.select().from(matchParticipants).where(eq(matchParticipants.matchId, matchRow.id));

          // --- MOCK WALK SIMULATION ---
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

          if (currentStatus === 'hunting') {
            const hidingEndsTime = matchRow.hidingEndsAt ? new Date(matchRow.hidingEndsAt).getTime() : 0;
            const elapsed = now.getTime() - hidingEndsTime;
            const revealIntervalMs = matchRow.revealInterval * 1000;
            const currentCycle = Math.floor(elapsed / revealIntervalMs);
            const hiders = parts.filter(p => p.role === 'hider');
            const seekers = parts.filter(p => p.role === 'seeker');

            // Check if hider positions should snapshot reveal
            for (const hider of hiders) {
              const lastRevealed = hider.revealedAt ? new Date(hider.revealedAt).getTime() : 0;
              const cycleOfLastReveal = Math.floor((lastRevealed - hidingEndsTime) / revealIntervalMs);

              // Snapshot position if this cycle is unrevealed, or if it is the first reveal of hunting phase
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

            // --- AUTO-CAPTURE: Check every seeker vs every uncaught hider (live positions) ---
            const captureRadius = matchRow.captureRadius ?? matchRow.catchRadius ?? 4;
            for (const seeker of seekers) {
              const seekerProfile = await db.query.profiles.findFirst({ where: eq(profiles.id, seeker.userId) });
              if (!seekerProfile || !seekerProfile.lat || !seekerProfile.lng) continue;
              for (const hider of hiders) {
                if (hider.isCaught) continue;
                const hiderProfile = await db.query.profiles.findFirst({ where: eq(profiles.id, hider.userId) });
                if (!hiderProfile || !hiderProfile.lat || !hiderProfile.lng) continue;
                const dist = getDistance(seekerProfile.lat, seekerProfile.lng, hiderProfile.lat, hiderProfile.lng);
                if (dist <= captureRadius) {
                  await db.update(matchParticipants).set({ isCaught: true }).where(eq(matchParticipants.id, hider.id));
                  await db.insert(catches).values({ matchId: matchRow.id, hunterId: seeker.userId, targetId: hider.userId, timestamp: now });
                  await db.update(profiles).set({ score: sql`${profiles.score} + 100` }).where(eq(profiles.id, seeker.userId));
                  hider.isCaught = true; // Prevent double-processing in same tick
                }
              }
            }

            // 2. Process bombs in this match
            const matchBombs = await db.select().from(bombs).where(eq(bombs.matchId, matchRow.id));
            for (const bombRow of matchBombs) {
              let bombIsActive = bombRow.isActive;
              // Activate bomb if arming delay finished
              if (!bombIsActive && now >= bombRow.activatesAt) {
                await db.update(bombs).set({ isActive: true }).where(eq(bombs.id, bombRow.id));
                bombIsActive = true;
              }

              if (bombIsActive) {
                // Check if any uncaught hiders are inside bomb blast radius
                for (const hider of hiders) {
                  if (hider.isCaught) continue;
                  const hiderProfile = await db.query.profiles.findFirst({ where: eq(profiles.id, hider.userId) });
                  if (hiderProfile && hiderProfile.lat && hiderProfile.lng) {
                    const dist = getDistance(bombRow.lat, bombRow.lng, hiderProfile.lat, hiderProfile.lng);
                    if (dist <= bombRow.radius) {
                      // Explode Catch!
                      await db.update(matchParticipants).set({ isCaught: true }).where(eq(matchParticipants.id, hider.id));
                      await db.insert(catches).values({
                        matchId: matchRow.id,
                        hunterId: bombRow.placedById,
                        targetId: hider.userId,
                        timestamp: now
                      });
                      // Reward score
                      await db.update(profiles).set({ score: sql`${profiles.score} + 100` }).where(eq(profiles.id, bombRow.placedById));
                    }
                  }
                }
              }
            }

            // Check Win Condition: Are all hiders caught?
            const updatedParts = await db.select().from(matchParticipants).where(eq(matchParticipants.matchId, matchRow.id));
            const updatedHiders = updatedParts.filter(p => p.role === 'hider');
            if (updatedHiders.length > 0 && updatedHiders.every(h => h.isCaught)) {
              await db.update(matches).set({ status: 'finished' }).where(eq(matches.id, matchRow.id));
            }
          }
        }
      } catch (err) {
        console.error('Server loop DB error:', err);
      }
    } else {
      // --- Mock Loop Operations ---
      mockMatches.forEach(matchRow => {
        let currentStatus = matchRow.status;

        if (currentStatus === 'hiding' && matchRow.hidingEndsAt && now >= matchRow.hidingEndsAt) {
          matchRow.status = 'hunting';
          currentStatus = 'hunting';
        }

        if (currentStatus === 'hunting' && matchRow.huntingEndsAt && now >= matchRow.huntingEndsAt) {
          matchRow.status = 'finished';
          return;
        }

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

        if (currentStatus === 'hunting') {
          const hidingEndsTime = matchRow.hidingEndsAt ? new Date(matchRow.hidingEndsAt).getTime() : 0;
          const elapsed = now.getTime() - hidingEndsTime;
          const revealIntervalMs = matchRow.revealInterval * 1000;
          const currentCycle = Math.floor(elapsed / revealIntervalMs);

          const hiders = mockParticipants.filter(p => p.matchId === matchRow.id && p.role === 'hider');

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

          // --- AUTO-CAPTURE: Check every seeker vs every uncaught hider (live positions) ---
          const captureRadius = matchRow.captureRadius ?? matchRow.catchRadius ?? 4;
          const seekers = mockParticipants.filter(p => p.matchId === matchRow.id && p.role === 'seeker');
          seekers.forEach(seeker => {
            const seekerProfile = mockProfiles.get(seeker.userId);
            if (!seekerProfile) return;
            hiders.forEach(hider => {
              if (hider.isCaught) return;
              const hiderProfile = mockProfiles.get(hider.userId);
              if (!hiderProfile) return;
              const dist = getDistance(seekerProfile.lat, seekerProfile.lng, hiderProfile.lat, hiderProfile.lng);
              if (dist <= captureRadius) {
                hider.isCaught = true;
                const sp = mockProfiles.get(seeker.userId);
                if (sp) sp.score += 100;
                mockCatches.push({ id: mockCatches.length + 1, matchId: matchRow.id, hunterId: seeker.userId, targetId: hider.userId, timestamp: now });
              }
            });
          });

          // Bombs in mock
          mockBombs.filter(b => b.matchId === matchRow.id).forEach(bombRow => {
            if (!bombRow.isActive && now >= bombRow.activatesAt) {
              bombRow.isActive = true;
            }

            if (bombRow.isActive) {
              hiders.forEach(hider => {
                if (hider.isCaught) return;
                const hiderProfile = mockProfiles.get(hider.userId);
                if (hiderProfile) {
                  const dist = getDistance(bombRow.lat, bombRow.lng, hiderProfile.lat, hiderProfile.lng);
                  if (dist <= bombRow.radius) {
                    hider.isCaught = true;
                    const seekerProfile = mockProfiles.get(bombRow.placedById);
                    if (seekerProfile) seekerProfile.score += 100;

                    mockCatches.push({
                      id: mockCatches.length + 1,
                      matchId: matchRow.id,
                      hunterId: bombRow.placedById,
                      targetId: hider.userId,
                      timestamp: now
                    });
                  }
                }
              });
            }
          });

          // Win check
          if (hiders.length > 0 && hiders.every(h => h.isCaught)) {
            matchRow.status = 'finished';
          }
        }
      });
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
export { app, checkDbConnection, seedMockUsers };
