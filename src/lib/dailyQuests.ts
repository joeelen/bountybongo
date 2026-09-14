/**
 * src/lib/dailyQuests.ts
 * Deterministic Daily Operations, Streak Engine & Player Title Catalog.
 * 
 * Features:
 * - Deterministic UTC-seeded daily operations with rotating objectives
 * - LocalStorage state preservation with cloud XP claiming
 * - Daily streak counter with automatic consecutive day calculation
 * - Player titles / identity designation catalog with equip/unequip support
 */

export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  rewardXp: number;
  icon: string;
  target: number;
  current: number;
  isCompleted: boolean;
  isClaimed: boolean;
}

export interface PlayerTitle {
  id: string;
  title: string;
  icon: string;
  description: string;
  requiredXp?: number;
  requiredCatches?: number;
  requiredMatches?: number;
  category: 'starter' | 'speed' | 'tactical' | 'master';
}

export const TITLE_CATALOG: PlayerTitle[] = [
  {
    id: 'street_runner',
    title: 'Sprek Gateløper',
    icon: '🏃',
    description: 'Alltid klar for en rask spurt i nabolaget.',
    requiredXp: 0,
    category: 'starter'
  },
  {
    id: 'shadow_master',
    title: 'Skyggemester',
    icon: '🥷',
    description: 'Mester i å gjemme seg i blindsoner og unngå radar.',
    requiredXp: 150,
    category: 'speed'
  },
  {
    id: 'radar_ace',
    title: 'Radar-ekspert',
    icon: '📡',
    description: 'Leser terreng og avstandsmålere med kirurgisk presisjon.',
    requiredXp: 300,
    category: 'tactical'
  },
  {
    id: 'freeze_rescuer',
    title: 'Redningshelt',
    icon: '🤝',
    description: 'Løper gjennom kryssild for å redde frosne lagkamerater.',
    requiredXp: 200,
    category: 'tactical'
  },
  {
    id: 'bounty_baron',
    title: 'Gulljeger',
    icon: '💎',
    description: 'Støvsuger spillområdet for energikuber og skattekrystaller.',
    requiredXp: 400,
    category: 'speed'
  },
  {
    id: 'zombie_apex',
    title: 'Zombiejeger',
    icon: '☣️',
    description: 'Ustoppelig smittespreder og jeger i infeksjonsmodus.',
    requiredXp: 500,
    category: 'master'
  },
  {
    id: 'cyber_phantom',
    title: 'Kvartalshelt',
    icon: '⚡',
    description: 'Lokal legende som kjenner hver eneste bakgate.',
    requiredXp: 1000,
    category: 'master'
  }
];

// Simple deterministic hash for string
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export class DailyQuestManager {
  private static readonly STORAGE_PREFIX = 'bountyrunner_daily_ops_';
  private static readonly STREAK_KEY = 'bountyrunner_daily_streak';
  private static readonly LAST_ACTIVE_KEY = 'bountyrunner_last_active_date';
  private static readonly TITLE_KEY = 'bountyrunner_equipped_title';

  private static getStorage(): Storage | null {
    if (typeof localStorage !== 'undefined') return localStorage;
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
    return null;
  }

  /**
   * Returns current UTC date formatted as YYYY-MM-DD
   */
  public static getUtcDateKey(): string {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Deterministically generate the 3 daily operations for the given day
   */
  public static getDailyQuests(): DailyQuest[] {
    const dateKey = this.getUtcDateKey();
    const storageKey = `${this.STORAGE_PREFIX}${dateKey}`;
    const storage = this.getStorage();
    
    // Load from storage if present
    const saved = storage ? storage.getItem(storageKey) : null;
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // Fallthrough if corrupted
      }
    }

    // Generate deterministic template based on date seed
    const seed = hashString(dateKey);
    
    const questPool = [
      {
        id: 'play_match',
        title: 'Feltoperativ',
        description: 'Delta i og fullfør minst 1 fullverdig match.',
        rewardXp: 100,
        icon: '🎯',
        target: 1
      },
      {
        id: 'use_powerups',
        title: 'Taktisk Overtak',
        description: 'Aktiver 2 taktiske power-ups (Sprint, Shield eller Trap).',
        rewardXp: 150,
        icon: '⚡',
        target: 2
      },
      {
        id: 'collect_items',
        title: 'Kryptosamler',
        description: 'Samle 2 energikuber eller skattekrystaller på kartet.',
        rewardXp: 150,
        icon: '💎',
        target: 2
      },
      {
        id: 'rescue_teammate',
        title: 'Boksen Går Redning',
        description: 'Redd eller hjelp en lagkamerat i en match.',
        rewardXp: 175,
        icon: '❄️',
        target: 1
      },
      {
        id: 'radar_sprint',
        title: 'Lynrask Spurt',
        description: 'Bruk Sprint Boost til å unnslippe eller ta igjen noen.',
        rewardXp: 125,
        icon: '🏃',
        target: 1
      }
    ];

    // Pick 3 pseudo-random distinct quests using seed
    const selected: DailyQuest[] = [];
    const pool = [...questPool];
    for (let i = 0; i < 3; i++) {
      const idx = (seed + i * 17) % pool.length;
      const picked = pool.splice(idx, 1)[0];
      selected.push({
        ...picked,
        current: 0,
        isCompleted: false,
        isClaimed: false
      });
    }

    if (storage) {
      storage.setItem(storageKey, JSON.stringify(selected));
    }

    return selected;
  }

  /**
   * Update quest progress
   */
  public static incrementProgress(questIdPrefix: string, amount: number = 1): DailyQuest[] {
    const quests = this.getDailyQuests();
    let changed = false;

    const updated = quests.map(q => {
      if (q.id.includes(questIdPrefix) || questIdPrefix.includes(q.id)) {
        const nextCurrent = Math.min(q.target, q.current + amount);
        if (nextCurrent !== q.current) {
          changed = true;
          return {
            ...q,
            current: nextCurrent,
            isCompleted: nextCurrent >= q.target
          };
        }
      }
      return q;
    });

    const storage = this.getStorage();
    if (changed && storage) {
      const dateKey = this.getUtcDateKey();
      storage.setItem(`${this.STORAGE_PREFIX}${dateKey}`, JSON.stringify(updated));
    }

    return updated;
  }

  /**
   * Claim XP reward for a completed quest
   */
  public static async claimQuest(questId: string, currentScore: number): Promise<{ success: boolean; rewardXp: number; newScore: number }> {
    const quests = this.getDailyQuests();
    const targetQuest = quests.find(q => q.id === questId);

    if (!targetQuest || !targetQuest.isCompleted || targetQuest.isClaimed) {
      return { success: false, rewardXp: 0, newScore: currentScore };
    }

    targetQuest.isClaimed = true;
    const dateKey = this.getUtcDateKey();
    const storage = this.getStorage();
    if (storage) {
      storage.setItem(`${this.STORAGE_PREFIX}${dateKey}`, JSON.stringify(quests));
    }

    // Try to sync with server profile
    const newScore = currentScore + targetQuest.rewardXp;
    try {
      await fetch('/api/profile/xp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ xpToAdd: targetQuest.rewardXp, reason: `Daily Quest: ${targetQuest.title}` })
      });
    } catch (e) {
      // Local fallback
    }

    this.checkAndUpdateStreak();

    return { success: true, rewardXp: targetQuest.rewardXp, newScore };
  }

  /**
   * Check and calculate current daily streak 🔥
   */
  public static getStreak(): number {
    const storage = this.getStorage();
    if (!storage) return 1;
    const streakStr = storage.getItem(this.STREAK_KEY);
    return streakStr ? parseInt(streakStr, 10) : 1;
  }

  /**
   * Update streak based on consecutive active days
   */
  public static checkAndUpdateStreak(): number {
    const storage = this.getStorage();
    if (!storage) return 1;
    const today = this.getUtcDateKey();
    const lastActive = storage.getItem(this.LAST_ACTIVE_KEY);

    let streak = this.getStreak();

    if (!lastActive) {
      streak = 1;
    } else if (lastActive === today) {
      // Already recorded today
      return streak;
    } else {
      const lastDate = new Date(lastActive);
      const currentDate = new Date(today);
      const diffDays = Math.round((currentDate.getTime() - lastDate.getTime()) / (1000 * 3600 * 24));

      if (diffDays === 1) {
        // Consecutive day streak!
        streak += 1;
      } else if (diffDays > 1) {
        // Streak broken
        streak = 1;
      }
    }

    storage.setItem(this.LAST_ACTIVE_KEY, today);
    storage.setItem(this.STREAK_KEY, streak.toString());
    return streak;
  }

  /**
   * Get equipped title
   */
  public static getEquippedTitle(): PlayerTitle {
    const storage = this.getStorage();
    if (!storage) return TITLE_CATALOG[0];
    const savedId = storage.getItem(this.TITLE_KEY) || 'street_runner';
    return TITLE_CATALOG.find(t => t.id === savedId) || TITLE_CATALOG[0];
  }

  /**
   * Equip title
   */
  public static equipTitle(titleId: string): PlayerTitle {
    const title = TITLE_CATALOG.find(t => t.id === titleId) || TITLE_CATALOG[0];
    const storage = this.getStorage();
    if (storage) {
      storage.setItem(this.TITLE_KEY, title.id);
    }
    return title;
  }
}
