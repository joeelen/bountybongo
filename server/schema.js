"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.wildZoneEvents = exports.messagesRelations = exports.catchesRelations = exports.bombsRelations = exports.matchParticipantsRelations = exports.matchesRelations = exports.profilesRelations = exports.usersRelations = exports.messages = exports.friends = exports.catches = exports.bombs = exports.matchParticipants = exports.matches = exports.profiles = exports.users = void 0;
var pg_core_1 = require("drizzle-orm/pg-core");
var drizzle_orm_1 = require("drizzle-orm");
// 1. Users Table
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.text)('id').primaryKey(), // Replit Auth user ID or dev username
    email: (0, pg_core_1.text)('email').notNull(),
    name: (0, pg_core_1.text)('name').notNull(),
    avatar: (0, pg_core_1.text)('avatar').notNull(),
});
// 2. Profiles Table
exports.profiles = (0, pg_core_1.pgTable)('profiles', {
    id: (0, pg_core_1.text)('id').primaryKey().references(function () { return exports.users.id; }, { onDelete: 'cascade' }),
    lat: (0, pg_core_1.doublePrecision)('lat').default(0.0),
    lng: (0, pg_core_1.doublePrecision)('lng').default(0.0),
    score: (0, pg_core_1.integer)('score').default(0).notNull(),
    bountyActive: (0, pg_core_1.boolean)('bounty_active').default(false).notNull(),
    isSpecial: (0, pg_core_1.boolean)('is_special').default(false).notNull(),
    isDark: (0, pg_core_1.boolean)('is_dark').default(false).notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updatedAt').defaultNow().notNull(),
});
// 3. Matches Table
exports.matches = (0, pg_core_1.pgTable)('matches', {
    id: (0, pg_core_1.text)('id').primaryKey(), // 6-character invite code
    hostId: (0, pg_core_1.text)('host_id').notNull().references(function () { return exports.users.id; }),
    status: (0, pg_core_1.text)('status').default('waiting').notNull(), // 'waiting' | 'hiding' | 'hunting' | 'finished'
    hidingDuration: (0, pg_core_1.integer)('hiding_duration').default(120).notNull(),
    revealInterval: (0, pg_core_1.integer)('reveal_interval').default(120).notNull(),
    matchDuration: (0, pg_core_1.integer)('match_duration').default(900).notNull(),
    catchRadius: (0, pg_core_1.integer)('catch_radius').default(30).notNull(),
    bombArmingTime: (0, pg_core_1.integer)('bomb_arming_time').default(60).notNull(),
    bombBlastRadius: (0, pg_core_1.integer)('bomb_blast_radius').default(25).notNull(),
    boundaryCenterLat: (0, pg_core_1.doublePrecision)('boundary_center_lat'),
    boundaryCenterLng: (0, pg_core_1.doublePrecision)('boundary_center_lng'),
    boundaryRadius: (0, pg_core_1.integer)('boundary_radius').default(500),
    captureRadius: (0, pg_core_1.integer)('capture_radius').default(4),
    bombHiddenDuration: (0, pg_core_1.integer)('bomb_hidden_duration').default(45),
    zoneShrinkInterval: (0, pg_core_1.integer)('zone_shrink_interval').default(120),
    zoneShrinkAmount: (0, pg_core_1.integer)('zone_shrink_amount').default(100),
    startedAt: (0, pg_core_1.timestamp)('started_at'),
    hidingEndsAt: (0, pg_core_1.timestamp)('hiding_ends_at'),
    huntingEndsAt: (0, pg_core_1.timestamp)('hunting_ends_at'),
});
// 4. Match Participants Table
exports.matchParticipants = (0, pg_core_1.pgTable)('match_participants', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    matchId: (0, pg_core_1.text)('match_id').notNull().references(function () { return exports.matches.id; }, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.text)('user_id').notNull().references(function () { return exports.users.id; }, { onDelete: 'cascade' }),
    role: (0, pg_core_1.text)('role').notNull(), // 'hider' | 'seeker'
    isCaught: (0, pg_core_1.boolean)('is_caught').default(false).notNull(),
    revealedLat: (0, pg_core_1.doublePrecision)('revealed_lat'),
    revealedLng: (0, pg_core_1.doublePrecision)('revealed_lng'),
    revealedAt: (0, pg_core_1.timestamp)('revealed_at'),
    joinedAt: (0, pg_core_1.timestamp)('joined_at').defaultNow().notNull(),
});
// 5. Bombs Table
exports.bombs = (0, pg_core_1.pgTable)('bombs', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    matchId: (0, pg_core_1.text)('match_id').notNull().references(function () { return exports.matches.id; }, { onDelete: 'cascade' }),
    placedById: (0, pg_core_1.text)('placed_by_id').notNull().references(function () { return exports.users.id; }),
    lat: (0, pg_core_1.doublePrecision)('lat').notNull(),
    lng: (0, pg_core_1.doublePrecision)('lng').notNull(),
    radius: (0, pg_core_1.integer)('radius').notNull(),
    activatesAt: (0, pg_core_1.timestamp)('activatesAt').notNull(),
    isActive: (0, pg_core_1.boolean)('is_active').default(false).notNull(),
});
// 6. Catches Table (Record of captures)
exports.catches = (0, pg_core_1.pgTable)('catches', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    matchId: (0, pg_core_1.text)('match_id').references(function () { return exports.matches.id; }, { onDelete: 'set null' }),
    hunterId: (0, pg_core_1.text)('hunter_id').notNull().references(function () { return exports.users.id; }),
    targetId: (0, pg_core_1.text)('target_id').notNull().references(function () { return exports.users.id; }),
    timestamp: (0, pg_core_1.timestamp)('timestamp').defaultNow().notNull(),
});
// 7. Friends Table
exports.friends = (0, pg_core_1.pgTable)('friends', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userOneId: (0, pg_core_1.text)('user_one_id').notNull().references(function () { return exports.users.id; }, { onDelete: 'cascade' }),
    userTwoId: (0, pg_core_1.text)('user_two_id').notNull().references(function () { return exports.users.id; }, { onDelete: 'cascade' }),
    status: (0, pg_core_1.text)('status').default('pending').notNull(), // 'pending' | 'accepted'
});
// 8. Messages Table (Supports DMs & Match chats)
exports.messages = (0, pg_core_1.pgTable)('messages', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    senderId: (0, pg_core_1.text)('sender_id').notNull().references(function () { return exports.users.id; }, { onDelete: 'cascade' }),
    receiverId: (0, pg_core_1.text)('receiver_id').references(function () { return exports.users.id; }, { onDelete: 'cascade' }), // null for match chats
    matchId: (0, pg_core_1.text)('match_id').references(function () { return exports.matches.id; }, { onDelete: 'cascade' }), // null for DMs
    content: (0, pg_core_1.text)('content').notNull(),
    timestamp: (0, pg_core_1.timestamp)('timestamp').defaultNow().notNull(),
});
// Drizzle Relations definitions
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.users, function (_a) {
    var one = _a.one, many = _a.many;
    return ({
        profile: one(exports.profiles, { fields: [exports.users.id], references: [exports.profiles.id] }),
        participants: many(exports.matchParticipants),
        catchesMade: many(exports.catches, { relationName: 'hunterCatches' }),
        catchesSuffered: many(exports.catches, { relationName: 'targetCatches' }),
    });
});
exports.profilesRelations = (0, drizzle_orm_1.relations)(exports.profiles, function (_a) {
    var one = _a.one;
    return ({
        user: one(exports.users, { fields: [exports.profiles.id], references: [exports.users.id] }),
    });
});
exports.matchesRelations = (0, drizzle_orm_1.relations)(exports.matches, function (_a) {
    var one = _a.one, many = _a.many;
    return ({
        host: one(exports.users, { fields: [exports.matches.hostId], references: [exports.users.id] }),
        participants: many(exports.matchParticipants),
        bombs: many(exports.bombs),
        catches: many(exports.catches),
        messages: many(exports.messages),
    });
});
exports.matchParticipantsRelations = (0, drizzle_orm_1.relations)(exports.matchParticipants, function (_a) {
    var one = _a.one;
    return ({
        match: one(exports.matches, { fields: [exports.matchParticipants.matchId], references: [exports.matches.id] }),
        user: one(exports.users, { fields: [exports.matchParticipants.userId], references: [exports.users.id] }),
    });
});
exports.bombsRelations = (0, drizzle_orm_1.relations)(exports.bombs, function (_a) {
    var one = _a.one;
    return ({
        match: one(exports.matches, { fields: [exports.bombs.matchId], references: [exports.matches.id] }),
        placedBy: one(exports.users, { fields: [exports.bombs.placedById], references: [exports.users.id] }),
    });
});
exports.catchesRelations = (0, drizzle_orm_1.relations)(exports.catches, function (_a) {
    var one = _a.one;
    return ({
        match: one(exports.matches, { fields: [exports.catches.matchId], references: [exports.matches.id] }),
        hunter: one(exports.users, { fields: [exports.catches.hunterId], references: [exports.users.id], relationName: 'hunterCatches' }),
        target: one(exports.users, { fields: [exports.catches.targetId], references: [exports.users.id], relationName: 'targetCatches' }),
    });
});
exports.messagesRelations = (0, drizzle_orm_1.relations)(exports.messages, function (_a) {
    var one = _a.one;
    return ({
        sender: one(exports.users, { fields: [exports.messages.senderId], references: [exports.users.id] }),
        receiver: one(exports.users, { fields: [exports.messages.receiverId], references: [exports.users.id] }),
        match: one(exports.matches, { fields: [exports.messages.matchId], references: [exports.matches.id] }),
    });
});
exports.wildZoneEvents = (0, pg_core_1.pgTable)('wild_zone_events', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    lat: (0, pg_core_1.doublePrecision)('lat').notNull(),
    lng: (0, pg_core_1.doublePrecision)('lng').notNull(),
    timestamp: (0, pg_core_1.timestamp)('timestamp').defaultNow().notNull(),
});
