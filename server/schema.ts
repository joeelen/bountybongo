import { pgTable, text, integer, doublePrecision, boolean, timestamp, serial } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Users Table
export const users = pgTable('users', {
  id: text('id').primaryKey(), // User ID or username
  email: text('email').notNull(),
  name: text('name').notNull(),
  avatar: text('avatar').notNull(),
  password: text('password'),
});

// 2. Profiles Table
export const profiles = pgTable('profiles', {
  id: text('id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  lat: doublePrecision('lat').default(0.0),
  lng: doublePrecision('lng').default(0.0),
  score: integer('score').default(0).notNull(),
  bountyActive: boolean('bounty_active').default(false).notNull(),
  isSpecial: boolean('is_special').default(false).notNull(),
  isDark: boolean('is_dark').default(false).notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

// 3. Matches Table
export const matches = pgTable('matches', {
  id: text('id').primaryKey(), // 6-character invite code
  hostId: text('host_id').notNull().references(() => users.id),
  status: text('status').default('waiting').notNull(), // 'waiting' | 'hiding' | 'hunting' | 'finished'
  gameMode: text('game_mode').default('classic').notNull(), // 'classic' | 'freeze_tag' | 'infection' | 'treasure_hunt'
  rescueRadius: integer('rescue_radius').default(10).notNull(),
  hidingDuration: integer('hiding_duration').default(120).notNull(),
  revealInterval: integer('reveal_interval').default(120).notNull(),
  matchDuration: integer('match_duration').default(900).notNull(),
  catchRadius: integer('catch_radius').default(30).notNull(),
  bombArmingTime: integer('bomb_arming_time').default(60).notNull(),
  bombBlastRadius: integer('bomb_blast_radius').default(25).notNull(),
  boundaryCenterLat: doublePrecision('boundary_center_lat'),
  boundaryCenterLng: doublePrecision('boundary_center_lng'),
  boundaryRadius: integer('boundary_radius').default(500),
  captureRadius: integer('capture_radius').default(4),
  bombHiddenDuration: integer('bomb_hidden_duration').default(45),
  zoneShrinkInterval: integer('zone_shrink_interval').default(120),
  zoneShrinkAmount: integer('zone_shrink_amount').default(100),
  startedAt: timestamp('started_at'),
  hidingEndsAt: timestamp('hiding_ends_at'),
  huntingEndsAt: timestamp('hunting_ends_at'),
});

// 4. Match Participants Table
export const matchParticipants = pgTable('match_participants', {
  id: serial('id').primaryKey(),
  matchId: text('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull(), // 'hider' | 'seeker'
  isCaught: boolean('is_caught').default(false).notNull(),
  isFrozen: boolean('is_frozen').default(false).notNull(),
  frozenAt: timestamp('frozen_at'),
  rescuesCount: integer('rescues_count').default(0).notNull(),
  revealedLat: doublePrecision('revealed_lat'),
  revealedLng: doublePrecision('revealed_lng'),
  revealedAt: timestamp('revealed_at'),
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
});

// 5. Bombs Table
export const bombs = pgTable('bombs', {
  id: serial('id').primaryKey(),
  matchId: text('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  placedById: text('placed_by_id').notNull().references(() => users.id),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  radius: integer('radius').notNull(),
  activatesAt: timestamp('activatesAt').notNull(),
  isActive: boolean('is_active').default(false).notNull(),
});

// 6. Catches Table (Record of captures)
export const catches = pgTable('catches', {
  id: serial('id').primaryKey(),
  matchId: text('match_id').references(() => matches.id, { onDelete: 'set null' }),
  hunterId: text('hunter_id').notNull().references(() => users.id),
  targetId: text('target_id').notNull().references(() => users.id),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// 7. Friends Table
export const friends = pgTable('friends', {
  id: serial('id').primaryKey(),
  userOneId: text('user_one_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  userTwoId: text('user_two_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').default('pending').notNull(), // 'pending' | 'accepted'
});

// 8. Messages Table (Supports DMs & Match chats)
export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  senderId: text('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  receiverId: text('receiver_id').references(() => users.id, { onDelete: 'cascade' }), // null for match chats
  matchId: text('match_id').references(() => matches.id, { onDelete: 'cascade' }),   // null for DMs
  content: text('content').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

// 9. Collectibles Table (Geo-Bounty Skattejakt / Treasure Hunt)
export const collectibles = pgTable('collectibles', {
  id: text('id').primaryKey(),
  matchId: text('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'energy_cube' | 'bounty_crystal'
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  points: integer('points').notNull(), // 50 for cube, 150 for crystal
  isCollected: boolean('is_collected').default(false).notNull(),
  collectedById: text('collected_by_id').references(() => users.id, { onDelete: 'set null' }),
  collectedAt: timestamp('collected_at'),
});

// Drizzle Relations definitions
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, { fields: [users.id], references: [profiles.id] }),
  participants: many(matchParticipants),
  catchesMade: many(catches, { relationName: 'hunterCatches' }),
  catchesSuffered: many(catches, { relationName: 'targetCatches' }),
  collectedItems: many(collectibles),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, { fields: [profiles.id], references: [users.id] }),
}));

export const matchesRelations = relations(matches, ({ one, many }) => ({
  host: one(users, { fields: [matches.hostId], references: [users.id] }),
  participants: many(matchParticipants),
  bombs: many(bombs),
  catches: many(catches),
  messages: many(messages),
  collectibles: many(collectibles),
}));

export const collectiblesRelations = relations(collectibles, ({ one }) => ({
  match: one(matches, { fields: [collectibles.matchId], references: [matches.id] }),
  collectedBy: one(users, { fields: [collectibles.collectedById], references: [users.id] }),
}));

export const matchParticipantsRelations = relations(matchParticipants, ({ one }) => ({
  match: one(matches, { fields: [matchParticipants.matchId], references: [matches.id] }),
  user: one(users, { fields: [matchParticipants.userId], references: [users.id] }),
}));

export const bombsRelations = relations(bombs, ({ one }) => ({
  match: one(matches, { fields: [bombs.matchId], references: [matches.id] }),
  placedBy: one(users, { fields: [bombs.placedById], references: [users.id] }),
}));

export const catchesRelations = relations(catches, ({ one }) => ({
  match: one(matches, { fields: [catches.matchId], references: [matches.id] }),
  hunter: one(users, { fields: [catches.hunterId], references: [users.id], relationName: 'hunterCatches' }),
  target: one(users, { fields: [catches.targetId], references: [users.id], relationName: 'targetCatches' }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
  receiver: one(users, { fields: [messages.receiverId], references: [users.id] }),
  match: one(matches, { fields: [messages.matchId], references: [matches.id] }),
}));

export const wildZoneEvents = pgTable('wild_zone_events', {
  id: serial('id').primaryKey(),
  lat: doublePrecision('lat').notNull(),
  lng: doublePrecision('lng').notNull(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});

