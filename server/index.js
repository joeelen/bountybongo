"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var cors_1 = require("cors");
var cookie_parser_1 = require("cookie-parser");
var db_js_1 = require("./db.js");
var schema_js_1 = require("./schema.js");
var drizzle_orm_1 = require("drizzle-orm");
var app = (0, express_1.default)();
var port = 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use((0, cookie_parser_1.default)());
var activeUserSessions = new Map();
// --- IN-MEMORY DATABASE SIMULATION FALLBACK ---
var isDbConnected = false;
// Mock database structures
var mockUsers = new Map();
var mockProfiles = new Map();
var mockMatches = new Map();
var mockParticipants = [];
var mockBombs = [];
var mockCatches = [];
var mockFriends = [];
var mockMessages = [];
var mockWildZoneEvents = [];
// Helper: Haversine distance formula in meters
function getDistance(lat1, lng1, lat2, lng2) {
    var R = 6371000; // Radius of the earth in meters
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLng = (lng2 - lng1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in meters
    return d;
}
function simulateRandomWalk(lat, lng, centerLat, centerLng, radius) {
    var step = 0.00008; // approx 8 meters
    var deltaLat = (Math.random() - 0.5) * step;
    var deltaLng = (Math.random() - 0.5) * step;
    var nextLat = lat + deltaLat;
    var nextLng = lng + deltaLng;
    // Keep within bounds if center & radius are provided
    if (centerLat != null && centerLng != null && radius != null) {
        var dist = getDistance(nextLat, nextLng, centerLat, centerLng);
        if (dist > radius) {
            // Step back towards the center
            var angle = Math.atan2(centerLat - lat, centerLng - lng);
            nextLat = lat + Math.sin(angle) * step * 0.5;
            nextLng = lng + Math.cos(angle) * step * 0.5;
        }
    }
    return { nextLat: nextLat, nextLng: nextLng };
}
// Check database connection at start
function checkDbConnection() {
    return __awaiter(this, void 0, void 0, function () {
        var err_1, testIds;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, db_js_1.pool.query('SELECT 1')];
                case 1:
                    _a.sent();
                    isDbConnected = true;
                    console.log('✅ PostgreSQL Connection: SUCCESS');
                    return [3 /*break*/, 3];
                case 2:
                    err_1 = _a.sent();
                    isDbConnected = false;
                    console.warn('⚠️  PostgreSQL Connection: FAILED. Falling back to Memory DB Mode.');
                    console.warn('   Reason:', err_1.message);
                    testIds = ['host', 'hider1', 'hider2', 'seeker1'];
                    testIds.forEach(function (id) {
                        mockUsers.set(id, {
                            id: id,
                            email: "".concat(id, "@bounty.com"),
                            name: id.toUpperCase(),
                            avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=".concat(id)
                        });
                        mockProfiles.set(id, {
                            id: id,
                            lat: 59.9139 + (Math.random() - 0.5) * 0.01,
                            lng: 10.7522 + (Math.random() - 0.5) * 0.01,
                            score: Math.floor(Math.random() * 500),
                            bountyActive: true,
                            isSpecial: id === 'hider1',
                            isDark: true, // Auto opt-in mock users to Go Dark
                            updatedAt: new Date()
                        });
                    });
                    return [3 /*break*/, 3];
                case 3: return [2 /*return*/];
            }
        });
    });
}
// --- AUTHENTICATION MIDDLEWARE ---
app.use(function (req, res, next) { return __awaiter(void 0, void 0, void 0, function () {
    var replitId, replitName, replitEmail, replitAvatar, userId, userName, userEmail, userAvatar, devUserId, userRow, err_2;
    var _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                replitId = req.headers['x-replit-user-id'];
                replitName = req.headers['x-replit-user-name'];
                replitEmail = req.headers['x-replit-user-email'];
                replitAvatar = req.headers['x-replit-user-profile-image'];
                userId = replitId;
                userName = replitName;
                userEmail = replitEmail;
                userAvatar = replitAvatar;
                devUserId = req.headers['x-dev-user-id'] || ((_a = req.cookies) === null || _a === void 0 ? void 0 : _a['dev-user-id']) || req.query.dev_user_id;
                // TEMPORARY AUTO-LOGIN BYPASS:
                // Fallback to default 'host' profile if no user session is present
                if (!userId && !devUserId) {
                    devUserId = 'host';
                }
                if (!userId && devUserId) {
                    userId = devUserId;
                    userName = userId.charAt(0).toUpperCase() + userId.slice(1);
                    userEmail = "".concat(userId, "@bounty.com");
                    userAvatar = "https://api.dicebear.com/7.x/bottts/svg?seed=".concat(userId);
                }
                if (!userId) return [3 /*break*/, 9];
                activeUserSessions.set(userId, Date.now());
                if (!isDbConnected) return [3 /*break*/, 8];
                _b.label = 1;
            case 1:
                _b.trys.push([1, 6, , 7]);
                return [4 /*yield*/, db_js_1.db.query.users.findFirst({
                        where: (0, drizzle_orm_1.eq)(schema_js_1.users.id, userId)
                    })];
            case 2:
                userRow = _b.sent();
                if (!!userRow) return [3 /*break*/, 5];
                return [4 /*yield*/, db_js_1.db.insert(schema_js_1.users).values({
                        id: userId,
                        email: userEmail || "".concat(userId, "@bounty.com"),
                        name: userName || userId,
                        avatar: userAvatar || "https://api.dicebear.com/7.x/bottts/svg?seed=".concat(userId)
                    })];
            case 3:
                _b.sent();
                return [4 /*yield*/, db_js_1.db.insert(schema_js_1.profiles).values({
                        id: userId,
                        lat: 59.9139, // Default Oslo coordinates
                        lng: 10.7522,
                        score: 0,
                        bountyActive: false,
                        isSpecial: false,
                        isDark: false
                    })];
            case 4:
                _b.sent();
                userRow = { id: userId, email: userEmail, name: userName, avatar: userAvatar };
                _b.label = 5;
            case 5:
                req.user = userRow;
                return [3 /*break*/, 7];
            case 6:
                err_2 = _b.sent();
                console.error('Auth DB Error:', err_2);
                return [3 /*break*/, 7];
            case 7: return [3 /*break*/, 9];
            case 8:
                // Memory DB fallback find or create
                if (!mockUsers.has(userId)) {
                    mockUsers.set(userId, {
                        id: userId,
                        email: userEmail || "".concat(userId, "@bounty.com"),
                        name: userName || userId,
                        avatar: userAvatar || "https://api.dicebear.com/7.x/bottts/svg?seed=".concat(userId)
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
                _b.label = 9;
            case 9:
                next();
                return [2 /*return*/];
        }
    });
}); });
// --- API ENDPOINTS ---
// Helper: get cookie options depending on security/protocol context (e.g. ngrok HTTPS tunnels)
function getCookieOptions(req) {
    var isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    return {
        path: '/',
        secure: isSecure,
        sameSite: isSecure ? 'none' : 'lax',
    };
}
// GET: Current user details
app.get('/api/me', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var profileRow, profileRow;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!req.user) {
                    return [2 /*return*/, res.json({ authenticated: false })];
                }
                if (!isDbConnected) return [3 /*break*/, 2];
                return [4 /*yield*/, db_js_1.db.query.profiles.findFirst({
                        where: (0, drizzle_orm_1.eq)(schema_js_1.profiles.id, req.user.id)
                    })];
            case 1:
                profileRow = _a.sent();
                return [2 /*return*/, res.json({ authenticated: true, user: req.user, profile: profileRow })];
            case 2:
                profileRow = mockProfiles.get(req.user.id);
                return [2 /*return*/, res.json({ authenticated: true, user: req.user, profile: profileRow })];
        }
    });
}); });
// POST: Dev Login route
app.post('/api/dev-login', function (req, res) {
    var username = req.body.username;
    if (!username) {
        return res.status(400).json({ error: 'Username required' });
    }
    var cleanUsername = username.trim().toLowerCase();
    res.cookie('dev-user-id', cleanUsername, getCookieOptions(req));
    res.json({ success: true, username: cleanUsername });
});
// POST: Login/Register with Username, Email or External OAuth provider (Google/Apple)
app.post('/api/auth/login', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, id, email, name, username, avatar, transferScore, rawId, cleanId, cleanName, cleanEmail, cleanAvatar, bonusScore, userRow, err_3, existingUser_1, prof;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _a = req.body, id = _a.id, email = _a.email, name = _a.name, username = _a.username, avatar = _a.avatar, transferScore = _a.transferScore;
                rawId = (id || username || name || '').trim();
                cleanId = rawId.toLowerCase().replace(/\s+/g, '_');
                cleanName = (name || username || rawId).trim();
                cleanEmail = (email || "".concat(cleanId, "@bounty.com")).trim().toLowerCase();
                cleanAvatar = avatar || "https://api.dicebear.com/7.x/bottts/svg?seed=".concat(cleanId);
                if (!cleanId || !cleanName) {
                    return [2 /*return*/, res.status(400).json({ error: 'Username or account ID is required' })];
                }
                bonusScore = (typeof transferScore === 'number' && transferScore > 0) ? Math.floor(transferScore) : 0;
                if (!isDbConnected) return [3 /*break*/, 10];
                _b.label = 1;
            case 1:
                _b.trys.push([1, 8, , 9]);
                return [4 /*yield*/, db_js_1.db.query.users.findFirst({
                        where: (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_js_1.users.id, cleanId), (0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["lower(", ") = ", ""], ["lower(", ") = ", ""])), schema_js_1.users.name, cleanName.toLowerCase()), (0, drizzle_orm_1.eq)(schema_js_1.users.email, cleanEmail))
                    })];
            case 2:
                userRow = _b.sent();
                if (!!userRow) return [3 /*break*/, 5];
                return [4 /*yield*/, db_js_1.db.insert(schema_js_1.users).values({
                        id: cleanId,
                        email: cleanEmail,
                        name: cleanName,
                        avatar: cleanAvatar
                    })];
            case 3:
                _b.sent();
                return [4 /*yield*/, db_js_1.db.insert(schema_js_1.profiles).values({
                        id: cleanId,
                        lat: 59.9139,
                        lng: 10.7522,
                        score: bonusScore,
                        bountyActive: false,
                        isSpecial: false,
                        isDark: false
                    })];
            case 4:
                _b.sent();
                userRow = { id: cleanId, email: cleanEmail, name: cleanName, avatar: cleanAvatar };
                return [3 /*break*/, 7];
            case 5:
                if (!(bonusScore > 0)) return [3 /*break*/, 7];
                return [4 /*yield*/, db_js_1.db.update(schema_js_1.profiles)
                        .set({ score: (0, drizzle_orm_1.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["", " + ", ""], ["", " + ", ""])), schema_js_1.profiles.score, bonusScore) })
                        .where((0, drizzle_orm_1.eq)(schema_js_1.profiles.id, userRow.id))];
            case 6:
                _b.sent();
                _b.label = 7;
            case 7:
                res.cookie('dev-user-id', userRow.id, getCookieOptions(req));
                return [2 /*return*/, res.json({ success: true, user: userRow })];
            case 8:
                err_3 = _b.sent();
                console.error('Auth login error:', err_3);
                return [2 /*return*/, res.status(500).json({ error: 'Database authentication failed' })];
            case 9: return [3 /*break*/, 11];
            case 10:
                existingUser_1 = null;
                mockUsers.forEach(function (u) {
                    if (u.id.toLowerCase() === cleanId ||
                        (u.name && u.name.toLowerCase() === cleanName.toLowerCase()) ||
                        (u.email && u.email.toLowerCase() === cleanEmail)) {
                        existingUser_1 = u;
                    }
                });
                if (!existingUser_1) {
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
                    existingUser_1 = mockUsers.get(cleanId);
                }
                else if (bonusScore > 0) {
                    prof = mockProfiles.get(existingUser_1.id);
                    if (prof) {
                        prof.score = (prof.score || 0) + bonusScore;
                    }
                }
                res.cookie('dev-user-id', existingUser_1.id, getCookieOptions(req));
                return [2 /*return*/, res.json({ success: true, user: existingUser_1 })];
            case 11: return [2 /*return*/];
        }
    });
}); });
// POST: Dev Logout
app.post('/api/dev-logout', function (req, res) {
    res.clearCookie('dev-user-id', getCookieOptions(req));
    res.json({ success: true });
});
// POST: Update player coordinates
app.post('/api/profile/gps', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, lat, lng, prof;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                if (!req.user)
                    return [2 /*return*/, res.status(401).json({ error: 'Unauthorized' })];
                _a = req.body, lat = _a.lat, lng = _a.lng;
                if (lat == null || lng == null)
                    return [2 /*return*/, res.status(400).json({ error: 'Invalid coordinates' })];
                if (!isDbConnected) return [3 /*break*/, 2];
                return [4 /*yield*/, db_js_1.db.update(schema_js_1.profiles).set({
                        lat: lat,
                        lng: lng,
                        updatedAt: new Date()
                    }).where((0, drizzle_orm_1.eq)(schema_js_1.profiles.id, req.user.id))];
            case 1:
                _b.sent();
                return [3 /*break*/, 3];
            case 2:
                prof = mockProfiles.get(req.user.id);
                if (prof) {
                    prof.lat = lat;
                    prof.lng = lng;
                    prof.updatedAt = new Date();
                }
                _b.label = 3;
            case 3:
                res.json({ success: true });
                return [2 /*return*/];
        }
    });
}); });
// POST: Toggle global bounty
app.post('/api/profile/bounty', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var bountyActive, prof;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!req.user)
                    return [2 /*return*/, res.status(401).json({ error: 'Unauthorized' })];
                bountyActive = req.body.bountyActive;
                if (!isDbConnected) return [3 /*break*/, 2];
                return [4 /*yield*/, db_js_1.db.update(schema_js_1.profiles).set({ bountyActive: bountyActive, isSpecial: false }).where((0, drizzle_orm_1.eq)(schema_js_1.profiles.id, req.user.id))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                prof = mockProfiles.get(req.user.id);
                if (prof) {
                    prof.bountyActive = bountyActive;
                    prof.isSpecial = false;
                }
                _a.label = 3;
            case 3:
                res.json({ success: true });
                return [2 /*return*/];
        }
    });
}); });
// POST: Toggle Go Dark status
app.post('/api/profile/dark', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var isDark, prof;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!req.user)
                    return [2 /*return*/, res.status(401).json({ error: 'Unauthorized' })];
                isDark = req.body.isDark;
                if (!isDbConnected) return [3 /*break*/, 2];
                return [4 /*yield*/, db_js_1.db.update(schema_js_1.profiles).set({ isDark: isDark }).where((0, drizzle_orm_1.eq)(schema_js_1.profiles.id, req.user.id))];
            case 1:
                _a.sent();
                return [3 /*break*/, 3];
            case 2:
                prof = mockProfiles.get(req.user.id);
                if (prof) {
                    prof.isDark = isDark;
                }
                _a.label = 3;
            case 3:
                res.json({ success: true, isDark: isDark });
                return [2 /*return*/];
        }
    });
}); });
// GET: Leaderboard
app.get('/api/leaderboard', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var leaders, leaders;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!isDbConnected) return [3 /*break*/, 2];
                return [4 /*yield*/, db_js_1.db.select({
                        id: schema_js_1.users.id,
                        name: schema_js_1.users.name,
                        avatar: schema_js_1.users.avatar,
                        score: schema_js_1.profiles.score
                    }).from(schema_js_1.profiles)
                        .innerJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.profiles.id, schema_js_1.users.id))
                        .orderBy((0, drizzle_orm_1.sql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["", " DESC"], ["", " DESC"])), schema_js_1.profiles.score))
                        .limit(20)];
            case 1:
                leaders = _a.sent();
                res.json(leaders);
                return [3 /*break*/, 3];
            case 2:
                leaders = Array.from(mockProfiles.values()).map(function (p) {
                    var u = mockUsers.get(p.id);
                    return {
                        id: p.id,
                        name: (u === null || u === void 0 ? void 0 : u.name) || p.id,
                        avatar: (u === null || u === void 0 ? void 0 : u.avatar) || '',
                        score: p.score
                    };
                }).sort(function (a, b) { return b.score - a.score; });
                res.json(leaders);
                _a.label = 3;
            case 3: return [2 /*return*/];
        }
    });
}); });
// GET: Personal profile stats (catches made, caught count, matches played, recent catches)
app.get('/api/profile/stats', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var madeRows, caughtCount, matchCount, err_4, madeList, caughtCount, matchCount;
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                if (!req.user)
                    return [2 /*return*/, res.status(401).json({ error: 'Unauthorized' })];
                if (!isDbConnected) return [3 /*break*/, 7];
                _e.label = 1;
            case 1:
                _e.trys.push([1, 5, , 6]);
                return [4 /*yield*/, db_js_1.db.select({
                        id: schema_js_1.catches.id,
                        targetId: schema_js_1.catches.targetId,
                        matchId: schema_js_1.catches.matchId,
                        timestamp: schema_js_1.catches.timestamp,
                        targetName: schema_js_1.users.name,
                        targetAvatar: schema_js_1.users.avatar
                    }).from(schema_js_1.catches)
                        .innerJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.catches.targetId, schema_js_1.users.id))
                        .where((0, drizzle_orm_1.eq)(schema_js_1.catches.hunterId, req.user.id))
                        .orderBy((0, drizzle_orm_1.sql)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["", " DESC"], ["", " DESC"])), schema_js_1.catches.timestamp))
                        .limit(10)];
            case 2:
                madeRows = _e.sent();
                return [4 /*yield*/, db_js_1.db.select({ count: (0, drizzle_orm_1.sql)(templateObject_5 || (templateObject_5 = __makeTemplateObject(["count(*)"], ["count(*)"]))) }).from(schema_js_1.catches)
                        .where((0, drizzle_orm_1.eq)(schema_js_1.catches.targetId, req.user.id))];
            case 3:
                caughtCount = _e.sent();
                return [4 /*yield*/, db_js_1.db.select({ count: (0, drizzle_orm_1.sql)(templateObject_6 || (templateObject_6 = __makeTemplateObject(["count(*)"], ["count(*)"]))) }).from(schema_js_1.matchParticipants)
                        .where((0, drizzle_orm_1.eq)(schema_js_1.matchParticipants.userId, req.user.id))];
            case 4:
                matchCount = _e.sent();
                res.json({
                    catchesMade: Number(madeRows.length),
                    timesCaught: Number((_b = (_a = caughtCount[0]) === null || _a === void 0 ? void 0 : _a.count) !== null && _b !== void 0 ? _b : 0),
                    matchesPlayed: Number((_d = (_c = matchCount[0]) === null || _c === void 0 ? void 0 : _c.count) !== null && _d !== void 0 ? _d : 0),
                    recentCatches: madeRows
                });
                return [3 /*break*/, 6];
            case 5:
                err_4 = _e.sent();
                console.error('Stats error:', err_4);
                res.status(500).json({ error: 'Failed to load stats' });
                return [3 /*break*/, 6];
            case 6: return [3 /*break*/, 8];
            case 7:
                madeList = mockCatches
                    .filter(function (c) { return c.hunterId === req.user.id; })
                    .sort(function (a, b) { return b.timestamp - a.timestamp; })
                    .slice(0, 10)
                    .map(function (c) {
                    var tUser = mockUsers.get(c.targetId);
                    return {
                        id: c.id,
                        targetId: c.targetId,
                        matchId: c.matchId,
                        timestamp: c.timestamp,
                        targetName: (tUser === null || tUser === void 0 ? void 0 : tUser.name) || c.targetId,
                        targetAvatar: (tUser === null || tUser === void 0 ? void 0 : tUser.avatar) || ''
                    };
                });
                caughtCount = mockCatches.filter(function (c) { return c.targetId === req.user.id; }).length;
                matchCount = mockParticipants.filter(function (p) { return p.userId === req.user.id; }).length;
                res.json({
                    catchesMade: madeList.length,
                    timesCaught: caughtCount,
                    matchesPlayed: matchCount,
                    recentCatches: madeList
                });
                _e.label = 8;
            case 8: return [2 /*return*/];
        }
    });
}); });
// --- MATCHES API ---
// GET: Query active match for current user
app.get('/api/matches/current', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var activePart, err_5, activePart;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!req.user)
                    return [2 /*return*/, res.status(401).json({ error: 'Unauthorized' })];
                if (!isDbConnected) return [3 /*break*/, 5];
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, db_js_1.db.select({
                        matchId: schema_js_1.matchParticipants.matchId,
                        role: schema_js_1.matchParticipants.role,
                        status: schema_js_1.matches.status
                    }).from(schema_js_1.matchParticipants)
                        .innerJoin(schema_js_1.matches, (0, drizzle_orm_1.eq)(schema_js_1.matchParticipants.matchId, schema_js_1.matches.id))
                        .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.matchParticipants.userId, req.user.id), (0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_js_1.matches.status, 'hiding'), (0, drizzle_orm_1.eq)(schema_js_1.matches.status, 'hunting'))))
                        .limit(1)];
            case 2:
                activePart = _a.sent();
                if (activePart.length > 0) {
                    return [2 /*return*/, res.json({
                            hasActiveMatch: true,
                            matchId: activePart[0].matchId,
                            role: activePart[0].role
                        })];
                }
                return [3 /*break*/, 4];
            case 3:
                err_5 = _a.sent();
                console.error('Error in /api/matches/current:', err_5);
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/, res.json({ hasActiveMatch: false })];
            case 5:
                activePart = mockParticipants.find(function (p) {
                    if (p.userId !== req.user.id)
                        return false;
                    var m = mockMatches.get(p.matchId);
                    return m && (m.status === 'hiding' || m.status === 'hunting');
                });
                if (activePart) {
                    return [2 /*return*/, res.json({
                            hasActiveMatch: true,
                            matchId: activePart.matchId,
                            role: activePart.role
                        })];
                }
                return [2 /*return*/, res.json({ hasActiveMatch: false })];
        }
    });
}); });
// Helper: Cluster dark players geographically and launch Wild Zone matches
function triggerWildZoneClusters() {
    return __awaiter(this, arguments, void 0, function (force) {
        var activeThreshold, candidates, list_1, clusters, list, _loop_1, triggeredMatches, now, _loop_2, _i, clusters_1, cluster;
        if (force === void 0) { force = false; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    activeThreshold = new Date(Date.now() - 15 * 60 * 1000);
                    candidates = [];
                    if (!isDbConnected) return [3 /*break*/, 2];
                    return [4 /*yield*/, db_js_1.db.select({
                            id: schema_js_1.profiles.id,
                            lat: schema_js_1.profiles.lat,
                            lng: schema_js_1.profiles.lng,
                            updatedAt: schema_js_1.profiles.updatedAt
                        }).from(schema_js_1.profiles)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.profiles.isDark, true), (0, drizzle_orm_1.sql)(templateObject_7 || (templateObject_7 = __makeTemplateObject(["", " >= ", ""], ["", " >= ", ""])), schema_js_1.profiles.updatedAt, activeThreshold)))];
                case 1:
                    list_1 = _a.sent();
                    candidates = list_1.map(function (p) { return ({
                        id: p.id,
                        lat: p.lat || 0,
                        lng: p.lng || 0
                    }); });
                    return [3 /*break*/, 3];
                case 2:
                    mockProfiles.forEach(function (p) {
                        if (p.isDark && p.updatedAt >= activeThreshold) {
                            candidates.push({
                                id: p.id,
                                lat: p.lat,
                                lng: p.lng
                            });
                        }
                    });
                    _a.label = 3;
                case 3:
                    if (candidates.length < 3) {
                        return [2 /*return*/, { triggeredCount: 0, matches: [] }];
                    }
                    clusters = [];
                    list = __spreadArray([], candidates, true);
                    _loop_1 = function () {
                        var p1 = list.shift();
                        var clusterMembers = [p1];
                        for (var i = 0; i < list.length; i++) {
                            var p2 = list[i];
                            var dist = getDistance(p1.lat, p1.lng, p2.lat, p2.lng);
                            if (dist <= 800) {
                                clusterMembers.push(p2);
                                list.splice(i, 1);
                                i--;
                            }
                        }
                        if (clusterMembers.length >= 3) {
                            var sumLat_1 = 0;
                            var sumLng_1 = 0;
                            clusterMembers.forEach(function (m) {
                                sumLat_1 += m.lat;
                                sumLng_1 += m.lng;
                            });
                            clusters.push({
                                centerLat: sumLat_1 / clusterMembers.length,
                                centerLng: sumLng_1 / clusterMembers.length,
                                members: clusterMembers
                            });
                        }
                    };
                    while (list.length > 0) {
                        _loop_1();
                    }
                    triggeredMatches = [];
                    now = new Date();
                    _loop_2 = function (cluster) {
                        var hour, past24hEvents, localEvents, recentEvents, localEvents, recentEvents, randIndex, hider, seekers, code, hidingDuration, matchDuration, startedAt, hidingEndsAt, huntingEndsAt, _b, seekers_1, seeker, matchObj, _c, seekers_2, seeker;
                        return __generator(this, function (_d) {
                            switch (_d.label) {
                                case 0:
                                    if (!!force) return [3 /*break*/, 3];
                                    hour = now.getHours();
                                    if (hour < 10 || hour >= 22) {
                                        return [2 /*return*/, "continue"];
                                    }
                                    if (!isDbConnected) return [3 /*break*/, 2];
                                    return [4 /*yield*/, db_js_1.db.select().from(schema_js_1.wildZoneEvents)
                                            .where((0, drizzle_orm_1.sql)(templateObject_8 || (templateObject_8 = __makeTemplateObject(["", " >= ", ""], ["", " >= ", ""])), schema_js_1.wildZoneEvents.timestamp, new Date(Date.now() - 24 * 60 * 60 * 1000)))];
                                case 1:
                                    past24hEvents = _d.sent();
                                    localEvents = past24hEvents.filter(function (e) { return getDistance(cluster.centerLat, cluster.centerLng, e.lat, e.lng) <= 1600; });
                                    if (localEvents.length >= 3)
                                        return [2 /*return*/, "continue"];
                                    recentEvents = localEvents.filter(function (e) { return now.getTime() - new Date(e.timestamp).getTime() < 90 * 60 * 1000; });
                                    if (recentEvents.length > 0)
                                        return [2 /*return*/, "continue"];
                                    return [3 /*break*/, 3];
                                case 2:
                                    localEvents = mockWildZoneEvents.filter(function (e) {
                                        return now.getTime() - new Date(e.timestamp).getTime() < 24 * 60 * 60 * 1000 &&
                                            getDistance(cluster.centerLat, cluster.centerLng, e.lat, e.lng) <= 1600;
                                    });
                                    if (localEvents.length >= 3)
                                        return [2 /*return*/, "continue"];
                                    recentEvents = localEvents.filter(function (e) { return now.getTime() - new Date(e.timestamp).getTime() < 90 * 60 * 1000; });
                                    if (recentEvents.length > 0)
                                        return [2 /*return*/, "continue"];
                                    _d.label = 3;
                                case 3:
                                    if (!isDbConnected) return [3 /*break*/, 5];
                                    return [4 /*yield*/, db_js_1.db.insert(schema_js_1.wildZoneEvents).values({
                                            lat: cluster.centerLat,
                                            lng: cluster.centerLng,
                                            timestamp: now
                                        })];
                                case 4:
                                    _d.sent();
                                    return [3 /*break*/, 6];
                                case 5:
                                    mockWildZoneEvents.push({
                                        id: mockWildZoneEvents.length + 1,
                                        lat: cluster.centerLat,
                                        lng: cluster.centerLng,
                                        timestamp: now
                                    });
                                    _d.label = 6;
                                case 6:
                                    randIndex = Math.floor(Math.random() * cluster.members.length);
                                    hider = cluster.members[randIndex];
                                    seekers = cluster.members.filter(function (_, idx) { return idx !== randIndex; });
                                    code = Math.random().toString(36).substring(2, 8).toUpperCase();
                                    hidingDuration = 180;
                                    matchDuration = 900;
                                    startedAt = now;
                                    hidingEndsAt = new Date(startedAt.getTime() + hidingDuration * 1000);
                                    huntingEndsAt = new Date(hidingEndsAt.getTime() + matchDuration * 1000);
                                    if (!isDbConnected) return [3 /*break*/, 13];
                                    return [4 /*yield*/, db_js_1.db.insert(schema_js_1.matches).values({
                                            id: code,
                                            hostId: hider.id,
                                            status: 'hiding',
                                            hidingDuration: hidingDuration,
                                            revealInterval: 120,
                                            matchDuration: matchDuration,
                                            catchRadius: 30,
                                            bombArmingTime: 60,
                                            bombBlastRadius: 25,
                                            boundaryCenterLat: cluster.centerLat,
                                            boundaryCenterLng: cluster.centerLng,
                                            boundaryRadius: 800,
                                            startedAt: startedAt,
                                            hidingEndsAt: hidingEndsAt,
                                            huntingEndsAt: huntingEndsAt
                                        })];
                                case 7:
                                    _d.sent();
                                    return [4 /*yield*/, db_js_1.db.insert(schema_js_1.matchParticipants).values({
                                            matchId: code,
                                            userId: hider.id,
                                            role: 'hider',
                                            isCaught: false
                                        })];
                                case 8:
                                    _d.sent();
                                    _b = 0, seekers_1 = seekers;
                                    _d.label = 9;
                                case 9:
                                    if (!(_b < seekers_1.length)) return [3 /*break*/, 12];
                                    seeker = seekers_1[_b];
                                    return [4 /*yield*/, db_js_1.db.insert(schema_js_1.matchParticipants).values({
                                            matchId: code,
                                            userId: seeker.id,
                                            role: 'seeker',
                                            isCaught: false
                                        })];
                                case 10:
                                    _d.sent();
                                    _d.label = 11;
                                case 11:
                                    _b++;
                                    return [3 /*break*/, 9];
                                case 12: return [3 /*break*/, 14];
                                case 13:
                                    matchObj = {
                                        id: code,
                                        hostId: hider.id,
                                        status: 'hiding',
                                        hidingDuration: hidingDuration,
                                        revealInterval: 120,
                                        matchDuration: matchDuration,
                                        catchRadius: 30,
                                        bombArmingTime: 60,
                                        bombBlastRadius: 25,
                                        boundaryCenterLat: cluster.centerLat,
                                        boundaryCenterLng: cluster.centerLng,
                                        boundaryRadius: 800,
                                        startedAt: startedAt,
                                        hidingEndsAt: hidingEndsAt,
                                        huntingEndsAt: huntingEndsAt
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
                                    for (_c = 0, seekers_2 = seekers; _c < seekers_2.length; _c++) {
                                        seeker = seekers_2[_c];
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
                                    _d.label = 14;
                                case 14:
                                    triggeredMatches.push(code);
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, clusters_1 = clusters;
                    _a.label = 4;
                case 4:
                    if (!(_i < clusters_1.length)) return [3 /*break*/, 7];
                    cluster = clusters_1[_i];
                    return [5 /*yield**/, _loop_2(cluster)];
                case 5:
                    _a.sent();
                    _a.label = 6;
                case 6:
                    _i++;
                    return [3 /*break*/, 4];
                case 7: return [2 /*return*/, { triggeredCount: triggeredMatches.length, matches: triggeredMatches }];
            }
        });
    });
}
// POST: Dev force trigger wild zone event
app.post('/api/dev/trigger-wild-zone', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var force, result, err_6;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                force = req.query.force === 'true';
                _a.label = 1;
            case 1:
                _a.trys.push([1, 3, , 4]);
                return [4 /*yield*/, triggerWildZoneClusters(force)];
            case 2:
                result = _a.sent();
                res.json(__assign({ success: true }, result));
                return [3 /*break*/, 4];
            case 3:
                err_6 = _a.sent();
                console.error('Wild Zone Trigger Error:', err_6);
                res.status(500).json({ error: err_6.message });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); });
// POST: Create a new private match
app.post('/api/matches', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var code, defaultBoundaryLat, defaultBoundaryLng, hostLat, hostLng, hostProfile, newMatch, hostProfile, matchObj;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!req.user)
                    return [2 /*return*/, res.status(401).json({ error: 'Unauthorized' })];
                code = Math.random().toString(36).substring(2, 8).toUpperCase();
                defaultBoundaryLat = 59.9139;
                defaultBoundaryLng = 10.7522;
                hostLat = defaultBoundaryLat;
                hostLng = defaultBoundaryLng;
                if (!isDbConnected) return [3 /*break*/, 4];
                return [4 /*yield*/, db_js_1.db.query.profiles.findFirst({ where: (0, drizzle_orm_1.eq)(schema_js_1.profiles.id, req.user.id) })];
            case 1:
                hostProfile = _a.sent();
                if (hostProfile) {
                    hostLat = hostProfile.lat || defaultBoundaryLat;
                    hostLng = hostProfile.lng || defaultBoundaryLng;
                }
                return [4 /*yield*/, db_js_1.db.insert(schema_js_1.matches).values({
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
                    }).returning()];
            case 2:
                newMatch = _a.sent();
                // Auto-join host as Seeker
                return [4 /*yield*/, db_js_1.db.insert(schema_js_1.matchParticipants).values({
                        matchId: code,
                        userId: req.user.id,
                        role: 'seeker'
                    })];
            case 3:
                // Auto-join host as Seeker
                _a.sent();
                res.json(newMatch[0]);
                return [3 /*break*/, 5];
            case 4:
                hostProfile = mockProfiles.get(req.user.id);
                if (hostProfile) {
                    hostLat = hostProfile.lat;
                    hostLng = hostProfile.lng;
                }
                matchObj = {
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
                _a.label = 5;
            case 5: return [2 /*return*/];
        }
    });
}); });
// GET: List active/joinable matches for the rejoin list
app.get('/api/matches', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var list, list_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!isDbConnected) return [3 /*break*/, 2];
                return [4 /*yield*/, db_js_1.db.select().from(schema_js_1.matches).where((0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_js_1.matches.status, 'hiding'), (0, drizzle_orm_1.eq)(schema_js_1.matches.status, 'hunting')))];
            case 1:
                list = _a.sent();
                res.json(list);
                return [3 /*break*/, 3];
            case 2:
                list_2 = [];
                mockMatches.forEach(function (m) {
                    if (m.status === 'hiding' || m.status === 'hunting') {
                        list_2.push(m);
                    }
                });
                res.json(list_2);
                _a.label = 3;
            case 3: return [2 /*return*/];
        }
    });
}); });
// GET: Match status
app.get('/api/matches/:id', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var matchId, requesterId, matchRow_1, participantsList, now_1, rawBombs, activeBombs, hidingEndsTime, currentZoneRadius, elapsed, intervals, matchRow_2, participantsList, now_2, rawBombs, activeBombs, hidingEndsTime, currentZoneRadius, elapsed, intervals;
    var _a, _b, _c, _d, _e, _f, _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0:
                matchId = req.params.id.toUpperCase();
                requesterId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || '';
                if (!isDbConnected) return [3 /*break*/, 4];
                return [4 /*yield*/, db_js_1.db.query.matches.findFirst({ where: (0, drizzle_orm_1.eq)(schema_js_1.matches.id, matchId) })];
            case 1:
                matchRow_1 = _h.sent();
                if (!matchRow_1)
                    return [2 /*return*/, res.status(404).json({ error: 'Match not found' })];
                return [4 /*yield*/, db_js_1.db.select({
                        id: schema_js_1.matchParticipants.id,
                        userId: schema_js_1.users.id,
                        name: schema_js_1.users.name,
                        avatar: schema_js_1.users.avatar,
                        role: schema_js_1.matchParticipants.role,
                        isCaught: schema_js_1.matchParticipants.isCaught,
                        revealedLat: schema_js_1.matchParticipants.revealedLat,
                        revealedLng: schema_js_1.matchParticipants.revealedLng,
                        revealedAt: schema_js_1.matchParticipants.revealedAt,
                        lat: schema_js_1.profiles.lat,
                        lng: schema_js_1.profiles.lng
                    }).from(schema_js_1.matchParticipants)
                        .innerJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.matchParticipants.userId, schema_js_1.users.id))
                        .innerJoin(schema_js_1.profiles, (0, drizzle_orm_1.eq)(schema_js_1.matchParticipants.userId, schema_js_1.profiles.id))
                        .where((0, drizzle_orm_1.eq)(schema_js_1.matchParticipants.matchId, matchId))];
            case 2:
                participantsList = _h.sent();
                now_1 = Date.now();
                return [4 /*yield*/, db_js_1.db.select().from(schema_js_1.bombs).where((0, drizzle_orm_1.eq)(schema_js_1.bombs.matchId, matchId))];
            case 3:
                rawBombs = _h.sent();
                activeBombs = rawBombs.map(function (b) {
                    var _a;
                    var placedAt = b.activatesAt ? new Date(b.activatesAt).getTime() - ((matchRow_1.bombArmingTime || 60) * 1000) : 0;
                    var hiddenUntil = placedAt + (((_a = matchRow_1.bombHiddenDuration) !== null && _a !== void 0 ? _a : 45) * 1000);
                    var hidden = now_1 < hiddenUntil && b.placedById !== requesterId;
                    return __assign(__assign({}, b), { hidden: hidden });
                });
                hidingEndsTime = matchRow_1.hidingEndsAt ? new Date(matchRow_1.hidingEndsAt).getTime() : null;
                currentZoneRadius = (_b = matchRow_1.boundaryRadius) !== null && _b !== void 0 ? _b : 500;
                if (matchRow_1.status === 'hunting' && hidingEndsTime) {
                    elapsed = Math.max(0, now_1 - hidingEndsTime);
                    intervals = Math.floor(elapsed / (((_c = matchRow_1.zoneShrinkInterval) !== null && _c !== void 0 ? _c : 120) * 1000));
                    currentZoneRadius = Math.max(50, currentZoneRadius - intervals * ((_d = matchRow_1.zoneShrinkAmount) !== null && _d !== void 0 ? _d : 100));
                }
                res.json({ match: __assign(__assign({}, matchRow_1), { currentZoneRadius: currentZoneRadius }), participants: participantsList, bombs: activeBombs });
                return [3 /*break*/, 5];
            case 4:
                matchRow_2 = mockMatches.get(matchId);
                if (!matchRow_2)
                    return [2 /*return*/, res.status(404).json({ error: 'Match not found' })];
                participantsList = mockParticipants.filter(function (p) { return p.matchId === matchId; }).map(function (p) {
                    var u = mockUsers.get(p.userId);
                    var prof = mockProfiles.get(p.userId);
                    return __assign(__assign({}, p), { name: (u === null || u === void 0 ? void 0 : u.name) || p.userId, avatar: (u === null || u === void 0 ? void 0 : u.avatar) || '', lat: (prof === null || prof === void 0 ? void 0 : prof.lat) || 0, lng: (prof === null || prof === void 0 ? void 0 : prof.lng) || 0 });
                });
                now_2 = Date.now();
                rawBombs = mockBombs.filter(function (b) { return b.matchId === matchId; });
                activeBombs = rawBombs.map(function (b) {
                    var _a;
                    var placedAt = b.activatesAt ? new Date(b.activatesAt).getTime() - ((matchRow_2.bombArmingTime || 60) * 1000) : 0;
                    var hiddenUntil = placedAt + (((_a = matchRow_2.bombHiddenDuration) !== null && _a !== void 0 ? _a : 45) * 1000);
                    var hidden = now_2 < hiddenUntil && b.placedById !== requesterId;
                    return __assign(__assign({}, b), { hidden: hidden });
                });
                hidingEndsTime = matchRow_2.hidingEndsAt ? new Date(matchRow_2.hidingEndsAt).getTime() : null;
                currentZoneRadius = (_e = matchRow_2.boundaryRadius) !== null && _e !== void 0 ? _e : 500;
                if (matchRow_2.status === 'hunting' && hidingEndsTime) {
                    elapsed = Math.max(0, now_2 - hidingEndsTime);
                    intervals = Math.floor(elapsed / (((_f = matchRow_2.zoneShrinkInterval) !== null && _f !== void 0 ? _f : 120) * 1000));
                    currentZoneRadius = Math.max(50, currentZoneRadius - intervals * ((_g = matchRow_2.zoneShrinkAmount) !== null && _g !== void 0 ? _g : 100));
                }
                res.json({ match: __assign(__assign({}, matchRow_2), { currentZoneRadius: currentZoneRadius }), participants: participantsList, bombs: activeBombs });
                _h.label = 5;
            case 5: return [2 /*return*/];
        }
    });
}); });
// POST: Join a match
app.post('/api/matches/:id/join', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var matchId, role, matchRow, count, existing, matchRow, parts, existingIndex;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!req.user)
                    return [2 /*return*/, res.status(401).json({ error: 'Unauthorized' })];
                matchId = req.params.id.toUpperCase();
                role = req.body.role;
                if (!isDbConnected) return [3 /*break*/, 8];
                return [4 /*yield*/, db_js_1.db.query.matches.findFirst({ where: (0, drizzle_orm_1.eq)(schema_js_1.matches.id, matchId) })];
            case 1:
                matchRow = _a.sent();
                if (!matchRow)
                    return [2 /*return*/, res.status(404).json({ error: 'Match not found' })];
                if (matchRow.status !== 'waiting')
                    return [2 /*return*/, res.status(400).json({ error: 'Match already started' })];
                return [4 /*yield*/, db_js_1.db.select({ count: (0, drizzle_orm_1.sql)(templateObject_9 || (templateObject_9 = __makeTemplateObject(["count(*)"], ["count(*)"]))) }).from(schema_js_1.matchParticipants).where((0, drizzle_orm_1.eq)(schema_js_1.matchParticipants.matchId, matchId))];
            case 2:
                count = _a.sent();
                if (Number(count[0].count) >= 10) {
                    return [2 /*return*/, res.status(400).json({ error: 'Match is full (Max 10 players)' })];
                }
                return [4 /*yield*/, db_js_1.db.query.matchParticipants.findFirst({
                        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.matchParticipants.matchId, matchId), (0, drizzle_orm_1.eq)(schema_js_1.matchParticipants.userId, req.user.id))
                    })];
            case 3:
                existing = _a.sent();
                if (!existing) return [3 /*break*/, 5];
                return [4 /*yield*/, db_js_1.db.update(schema_js_1.matchParticipants).set({ role: role }).where((0, drizzle_orm_1.eq)(schema_js_1.matchParticipants.id, existing.id))];
            case 4:
                _a.sent();
                return [3 /*break*/, 7];
            case 5: return [4 /*yield*/, db_js_1.db.insert(schema_js_1.matchParticipants).values({ matchId: matchId, userId: req.user.id, role: role })];
            case 6:
                _a.sent();
                _a.label = 7;
            case 7:
                res.json({ success: true });
                return [3 /*break*/, 9];
            case 8:
                matchRow = mockMatches.get(matchId);
                if (!matchRow)
                    return [2 /*return*/, res.status(404).json({ error: 'Match not found' })];
                if (matchRow.status !== 'waiting')
                    return [2 /*return*/, res.status(400).json({ error: 'Match already started' })];
                parts = mockParticipants.filter(function (p) { return p.matchId === matchId; });
                if (parts.length >= 10) {
                    return [2 /*return*/, res.status(400).json({ error: 'Match is full (Max 10 players)' })];
                }
                existingIndex = mockParticipants.findIndex(function (p) { return p.matchId === matchId && p.userId === req.user.id; });
                if (existingIndex > -1) {
                    mockParticipants[existingIndex].role = role;
                }
                else {
                    mockParticipants.push({
                        id: mockParticipants.length + 1,
                        matchId: matchId,
                        userId: req.user.id,
                        role: role,
                        isCaught: false,
                        revealedLat: null,
                        revealedLng: null,
                        revealedAt: null,
                        joinedAt: new Date()
                    });
                }
                res.json({ success: true });
                _a.label = 9;
            case 9: return [2 /*return*/];
        }
    });
}); });
// POST: Update match settings
app.post('/api/matches/:id/settings', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var matchId, settingsObj, matchRow, matchRow;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!req.user)
                    return [2 /*return*/, res.status(401).json({ error: 'Unauthorized' })];
                matchId = req.params.id.toUpperCase();
                settingsObj = req.body;
                if (!isDbConnected) return [3 /*break*/, 3];
                return [4 /*yield*/, db_js_1.db.query.matches.findFirst({ where: (0, drizzle_orm_1.eq)(schema_js_1.matches.id, matchId) })];
            case 1:
                matchRow = _a.sent();
                if (!matchRow)
                    return [2 /*return*/, res.status(404).json({ error: 'Match not found' })];
                if (matchRow.hostId !== req.user.id)
                    return [2 /*return*/, res.status(403).json({ error: 'Only the host can modify settings' })];
                return [4 /*yield*/, db_js_1.db.update(schema_js_1.matches).set(settingsObj).where((0, drizzle_orm_1.eq)(schema_js_1.matches.id, matchId))];
            case 2:
                _a.sent();
                res.json({ success: true });
                return [3 /*break*/, 4];
            case 3:
                matchRow = mockMatches.get(matchId);
                if (!matchRow)
                    return [2 /*return*/, res.status(404).json({ error: 'Match not found' })];
                if (matchRow.hostId !== req.user.id)
                    return [2 /*return*/, res.status(403).json({ error: 'Only the host can modify settings' })];
                Object.assign(matchRow, settingsObj);
                res.json({ success: true });
                _a.label = 4;
            case 4: return [2 /*return*/];
        }
    });
}); });
// POST: Start a match
app.post('/api/matches/:id/start', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var matchId, matchRow, startedAt, hidingEndsAt, huntingEndsAt, matchRow, startedAt, hidingEndsAt, huntingEndsAt;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!req.user)
                    return [2 /*return*/, res.status(401).json({ error: 'Unauthorized' })];
                matchId = req.params.id.toUpperCase();
                if (!isDbConnected) return [3 /*break*/, 3];
                return [4 /*yield*/, db_js_1.db.query.matches.findFirst({ where: (0, drizzle_orm_1.eq)(schema_js_1.matches.id, matchId) })];
            case 1:
                matchRow = _a.sent();
                if (!matchRow)
                    return [2 /*return*/, res.status(404).json({ error: 'Match not found' })];
                if (matchRow.hostId !== req.user.id)
                    return [2 /*return*/, res.status(403).json({ error: 'Only the host can start the match' })];
                startedAt = new Date();
                hidingEndsAt = new Date(startedAt.getTime() + matchRow.hidingDuration * 1000);
                huntingEndsAt = new Date(hidingEndsAt.getTime() + matchRow.matchDuration * 1000);
                return [4 /*yield*/, db_js_1.db.update(schema_js_1.matches).set({
                        status: 'hiding',
                        startedAt: startedAt,
                        hidingEndsAt: hidingEndsAt,
                        huntingEndsAt: huntingEndsAt
                    }).where((0, drizzle_orm_1.eq)(schema_js_1.matches.id, matchId))];
            case 2:
                _a.sent();
                res.json({ success: true });
                return [3 /*break*/, 4];
            case 3:
                matchRow = mockMatches.get(matchId);
                if (!matchRow)
                    return [2 /*return*/, res.status(404).json({ error: 'Match not found' })];
                if (matchRow.hostId !== req.user.id)
                    return [2 /*return*/, res.status(403).json({ error: 'Only the host can start the match' })];
                startedAt = new Date();
                hidingEndsAt = new Date(startedAt.getTime() + matchRow.hidingDuration * 1000);
                huntingEndsAt = new Date(hidingEndsAt.getTime() + matchRow.matchDuration * 1000);
                matchRow.status = 'hiding';
                matchRow.startedAt = startedAt;
                matchRow.hidingEndsAt = hidingEndsAt;
                matchRow.huntingEndsAt = huntingEndsAt;
                res.json({ success: true });
                _a.label = 4;
            case 4: return [2 /*return*/];
        }
    });
}); });
// POST: Catch a hider (private match) — manual fallback, auto-capture runs in server loop
app.post('/api/matches/:id/catch', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var matchId, targetId, matchRow, captureRadius, myProfile, targetPart, targetProfile, dist, matchRow, captureRadius, myProfile, targetPart, targetProfile, dist;
    var _a, _b, _c, _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                if (!req.user)
                    return [2 /*return*/, res.status(401).json({ error: 'Unauthorized' })];
                matchId = req.params.id.toUpperCase();
                targetId = req.body.targetId;
                if (!isDbConnected) return [3 /*break*/, 8];
                return [4 /*yield*/, db_js_1.db.query.matches.findFirst({ where: (0, drizzle_orm_1.eq)(schema_js_1.matches.id, matchId) })];
            case 1:
                matchRow = _e.sent();
                if (!matchRow || matchRow.status !== 'hunting') {
                    return [2 /*return*/, res.status(400).json({ error: 'Match is not in hunting phase' })];
                }
                captureRadius = (_b = (_a = matchRow.captureRadius) !== null && _a !== void 0 ? _a : matchRow.catchRadius) !== null && _b !== void 0 ? _b : 30;
                return [4 /*yield*/, db_js_1.db.query.profiles.findFirst({ where: (0, drizzle_orm_1.eq)(schema_js_1.profiles.id, req.user.id) })];
            case 2:
                myProfile = _e.sent();
                return [4 /*yield*/, db_js_1.db.query.matchParticipants.findFirst({
                        where: (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.matchParticipants.matchId, matchId), (0, drizzle_orm_1.eq)(schema_js_1.matchParticipants.userId, targetId))
                    })];
            case 3:
                targetPart = _e.sent();
                return [4 /*yield*/, db_js_1.db.query.profiles.findFirst({ where: (0, drizzle_orm_1.eq)(schema_js_1.profiles.id, targetId) })];
            case 4:
                targetProfile = _e.sent();
                if (!myProfile || !targetPart || targetPart.role !== 'hider' || targetPart.isCaught) {
                    return [2 /*return*/, res.status(400).json({ error: 'Invalid catch target' })];
                }
                if (!targetProfile || targetProfile.lat == null) {
                    return [2 /*return*/, res.status(400).json({ error: 'Hider position not available' })];
                }
                dist = getDistance(myProfile.lat || 0, myProfile.lng || 0, targetProfile.lat, targetProfile.lng);
                if (dist > captureRadius) {
                    return [2 /*return*/, res.status(400).json({ error: "Hider is too far (Distance: ".concat(Math.round(dist), "m, Limit: ").concat(captureRadius, "m)") })];
                }
                // Capture
                return [4 /*yield*/, db_js_1.db.update(schema_js_1.matchParticipants).set({ isCaught: true }).where((0, drizzle_orm_1.eq)(schema_js_1.matchParticipants.id, targetPart.id))];
            case 5:
                // Capture
                _e.sent();
                return [4 /*yield*/, db_js_1.db.insert(schema_js_1.catches).values({ hunterId: req.user.id, targetId: targetId, matchId: matchId, timestamp: new Date() })];
            case 6:
                _e.sent();
                // Reward points
                return [4 /*yield*/, db_js_1.db.update(schema_js_1.profiles).set({ score: (0, drizzle_orm_1.sql)(templateObject_10 || (templateObject_10 = __makeTemplateObject(["", " + 100"], ["", " + 100"])), schema_js_1.profiles.score) }).where((0, drizzle_orm_1.eq)(schema_js_1.profiles.id, req.user.id))];
            case 7:
                // Reward points
                _e.sent();
                res.json({ success: true });
                return [3 /*break*/, 9];
            case 8:
                matchRow = mockMatches.get(matchId);
                if (!matchRow || matchRow.status !== 'hunting') {
                    return [2 /*return*/, res.status(400).json({ error: 'Match is not in hunting phase' })];
                }
                captureRadius = (_d = (_c = matchRow.captureRadius) !== null && _c !== void 0 ? _c : matchRow.catchRadius) !== null && _d !== void 0 ? _d : 30;
                myProfile = mockProfiles.get(req.user.id);
                targetPart = mockParticipants.find(function (p) { return p.matchId === matchId && p.userId === targetId; });
                targetProfile = mockProfiles.get(targetId);
                if (!myProfile || !targetPart || targetPart.role !== 'hider' || targetPart.isCaught) {
                    return [2 /*return*/, res.status(400).json({ error: 'Invalid catch target' })];
                }
                if (!targetProfile || targetProfile.lat == null) {
                    return [2 /*return*/, res.status(400).json({ error: 'Hider position not available' })];
                }
                dist = getDistance(myProfile.lat, myProfile.lng, targetProfile.lat, targetProfile.lng);
                if (dist > captureRadius) {
                    return [2 /*return*/, res.status(400).json({ error: "Hider is too far (".concat(Math.round(dist), "m)") })];
                }
                targetPart.isCaught = true;
                myProfile.score += 100;
                mockCatches.push({
                    id: mockCatches.length + 1,
                    matchId: matchId,
                    hunterId: req.user.id,
                    targetId: targetId,
                    timestamp: new Date()
                });
                res.json({ success: true });
                _e.label = 9;
            case 9: return [2 /*return*/];
        }
    });
}); });
// POST: Place a bomb (private match)
app.post('/api/matches/:id/bomb', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var matchId, _a, lat, lng, matchRow, activatesAt, newBomb, matchRow, activatesAt, bombObj;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                if (!req.user)
                    return [2 /*return*/, res.status(401).json({ error: 'Unauthorized' })];
                matchId = req.params.id.toUpperCase();
                _a = req.body, lat = _a.lat, lng = _a.lng;
                if (!isDbConnected) return [3 /*break*/, 3];
                return [4 /*yield*/, db_js_1.db.query.matches.findFirst({ where: (0, drizzle_orm_1.eq)(schema_js_1.matches.id, matchId) })];
            case 1:
                matchRow = _b.sent();
                if (!matchRow || matchRow.status !== 'hunting') {
                    return [2 /*return*/, res.status(400).json({ error: 'Match is not in hunting phase' })];
                }
                activatesAt = new Date(Date.now() + matchRow.bombArmingTime * 1000);
                return [4 /*yield*/, db_js_1.db.insert(schema_js_1.bombs).values({
                        matchId: matchId,
                        placedById: req.user.id,
                        lat: lat,
                        lng: lng,
                        radius: matchRow.bombBlastRadius,
                        activatesAt: activatesAt,
                        isActive: false
                    }).returning()];
            case 2:
                newBomb = _b.sent();
                res.json(newBomb[0]);
                return [3 /*break*/, 4];
            case 3:
                matchRow = mockMatches.get(matchId);
                if (!matchRow || matchRow.status !== 'hunting') {
                    return [2 /*return*/, res.status(400).json({ error: 'Match is not in hunting phase' })];
                }
                activatesAt = new Date(Date.now() + matchRow.bombArmingTime * 1000);
                bombObj = {
                    id: mockBombs.length + 1,
                    matchId: matchId,
                    placedById: req.user.id,
                    lat: lat,
                    lng: lng,
                    radius: matchRow.bombBlastRadius,
                    activatesAt: activatesAt,
                    isActive: false
                };
                mockBombs.push(bombObj);
                res.json(bombObj);
                _b.label = 4;
            case 4: return [2 /*return*/];
        }
    });
}); });
// --- SOCIAL / FRIENDS API ---
// GET: Friends list
app.get('/api/social/friends', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var list, populated, list, populated;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!req.user)
                    return [2 /*return*/, res.status(401).json({ error: 'Unauthorized' })];
                if (!isDbConnected) return [3 /*break*/, 3];
                return [4 /*yield*/, db_js_1.db.select({
                        id: schema_js_1.friends.id,
                        userOneId: schema_js_1.friends.userOneId,
                        userTwoId: schema_js_1.friends.userTwoId,
                        status: schema_js_1.friends.status,
                        // Joined user info helper
                    }).from(schema_js_1.friends).where((0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_js_1.friends.userOneId, req.user.id), (0, drizzle_orm_1.eq)(schema_js_1.friends.userTwoId, req.user.id)))];
            case 1:
                list = _a.sent();
                return [4 /*yield*/, Promise.all(list.map(function (f) { return __awaiter(void 0, void 0, void 0, function () {
                        var otherId, otherUser, otherProfile;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    otherId = f.userOneId === req.user.id ? f.userTwoId : f.userOneId;
                                    return [4 /*yield*/, db_js_1.db.query.users.findFirst({ where: (0, drizzle_orm_1.eq)(schema_js_1.users.id, otherId) })];
                                case 1:
                                    otherUser = _a.sent();
                                    return [4 /*yield*/, db_js_1.db.query.profiles.findFirst({ where: (0, drizzle_orm_1.eq)(schema_js_1.profiles.id, otherId) })];
                                case 2:
                                    otherProfile = _a.sent();
                                    return [2 /*return*/, {
                                            id: f.id,
                                            status: f.status,
                                            senderId: f.userOneId, // The sender is always userOne
                                            friend: {
                                                id: otherId,
                                                name: (otherUser === null || otherUser === void 0 ? void 0 : otherUser.name) || otherId,
                                                avatar: (otherUser === null || otherUser === void 0 ? void 0 : otherUser.avatar) || '',
                                                score: (otherProfile === null || otherProfile === void 0 ? void 0 : otherProfile.score) || 0
                                            }
                                        }];
                            }
                        });
                    }); }))];
            case 2:
                populated = _a.sent();
                res.json(populated);
                return [3 /*break*/, 4];
            case 3:
                list = mockFriends.filter(function (f) { return f.userOneId === req.user.id || f.userTwoId === req.user.id; });
                populated = list.map(function (f) {
                    var otherId = f.userOneId === req.user.id ? f.userTwoId : f.userOneId;
                    var otherUser = mockUsers.get(otherId);
                    var otherProfile = mockProfiles.get(otherId);
                    return {
                        id: f.id,
                        status: f.status,
                        senderId: f.userOneId,
                        friend: {
                            id: otherId,
                            name: (otherUser === null || otherUser === void 0 ? void 0 : otherUser.name) || otherId,
                            avatar: (otherUser === null || otherUser === void 0 ? void 0 : otherUser.avatar) || '',
                            score: (otherProfile === null || otherProfile === void 0 ? void 0 : otherProfile.score) || 0
                        }
                    };
                });
                res.json(populated);
                _a.label = 4;
            case 4: return [2 /*return*/];
        }
    });
}); });
// POST: Send friend request by username, usertag (@...), player ID, or email
app.post('/api/social/friends/request', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, email, username, tag, identifier, query, rawSearch, cleanSearch, searchEmail, targetUser, existing, targetUser_1, existing;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                if (!req.user)
                    return [2 /*return*/, res.status(401).json({ error: 'Unauthorized' })];
                _a = req.body, email = _a.email, username = _a.username, tag = _a.tag, identifier = _a.identifier, query = _a.query;
                rawSearch = (query || tag || username || identifier || email || '').trim();
                if (!rawSearch) {
                    return [2 /*return*/, res.status(400).json({ error: 'Please enter a username, player tag, or email' })];
                }
                cleanSearch = rawSearch.replace(/^[@#]/, '').trim().toLowerCase();
                searchEmail = rawSearch.toLowerCase();
                if (!isDbConnected) return [3 /*break*/, 4];
                return [4 /*yield*/, db_js_1.db.query.users.findFirst({
                        where: (0, drizzle_orm_1.or)((0, drizzle_orm_1.sql)(templateObject_11 || (templateObject_11 = __makeTemplateObject(["lower(", ") = ", ""], ["lower(", ") = ", ""])), schema_js_1.users.name, cleanSearch), (0, drizzle_orm_1.sql)(templateObject_12 || (templateObject_12 = __makeTemplateObject(["lower(", ") = ", ""], ["lower(", ") = ", ""])), schema_js_1.users.id, cleanSearch), (0, drizzle_orm_1.sql)(templateObject_13 || (templateObject_13 = __makeTemplateObject(["lower(", ") = ", ""], ["lower(", ") = ", ""])), schema_js_1.users.email, searchEmail))
                    })];
            case 1:
                targetUser = _b.sent();
                if (!targetUser) {
                    return [2 /*return*/, res.status(404).json({ error: "Player \"".concat(rawSearch, "\" not found. Check the username or tag.") })];
                }
                if (targetUser.id === req.user.id) {
                    return [2 /*return*/, res.status(400).json({ error: 'You cannot add yourself as a friend' })];
                }
                return [4 /*yield*/, db_js_1.db.query.friends.findFirst({
                        where: (0, drizzle_orm_1.or)((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.friends.userOneId, req.user.id), (0, drizzle_orm_1.eq)(schema_js_1.friends.userTwoId, targetUser.id)), (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.friends.userOneId, targetUser.id), (0, drizzle_orm_1.eq)(schema_js_1.friends.userTwoId, req.user.id)))
                    })];
            case 2:
                existing = _b.sent();
                if (existing) {
                    return [2 /*return*/, res.status(400).json({
                            error: existing.status === 'accepted'
                                ? "You are already friends with ".concat(targetUser.name)
                                : 'Friend request already sent or pending approval'
                        })];
                }
                return [4 /*yield*/, db_js_1.db.insert(schema_js_1.friends).values({
                        userOneId: req.user.id,
                        userTwoId: targetUser.id,
                        status: 'pending'
                    })];
            case 3:
                _b.sent();
                res.json({ success: true, targetUser: { id: targetUser.id, name: targetUser.name } });
                return [3 /*break*/, 5];
            case 4:
                targetUser_1 = null;
                mockUsers.forEach(function (u) {
                    if ((u.name && u.name.toLowerCase() === cleanSearch) ||
                        (u.id && u.id.toLowerCase() === cleanSearch) ||
                        (u.email && u.email.toLowerCase() === searchEmail)) {
                        targetUser_1 = u;
                    }
                });
                if (!targetUser_1) {
                    return [2 /*return*/, res.status(404).json({ error: "Player \"".concat(rawSearch, "\" not found. Check the username or tag.") })];
                }
                if (targetUser_1.id === req.user.id) {
                    return [2 /*return*/, res.status(400).json({ error: 'You cannot add yourself as a friend' })];
                }
                existing = mockFriends.find(function (f) {
                    return (f.userOneId === req.user.id && f.userTwoId === targetUser_1.id) ||
                        (f.userOneId === targetUser_1.id && f.userTwoId === req.user.id);
                });
                if (existing) {
                    return [2 /*return*/, res.status(400).json({
                            error: existing.status === 'accepted'
                                ? "You are already friends with ".concat(targetUser_1.name)
                                : 'Friend request already sent or pending approval'
                        })];
                }
                mockFriends.push({
                    id: mockFriends.length + 1,
                    userOneId: req.user.id,
                    userTwoId: targetUser_1.id,
                    status: 'pending'
                });
                res.json({ success: true, targetUser: { id: targetUser_1.id, name: targetUser_1.name } });
                _b.label = 5;
            case 5: return [2 /*return*/];
        }
    });
}); });
// POST: Accept friend request
app.post('/api/social/friends/accept', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var requestId, reqObj;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!req.user)
                    return [2 /*return*/, res.status(401).json({ error: 'Unauthorized' })];
                requestId = req.body.requestId;
                if (!isDbConnected) return [3 /*break*/, 2];
                return [4 /*yield*/, db_js_1.db.update(schema_js_1.friends).set({ status: 'accepted' }).where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.friends.id, requestId), (0, drizzle_orm_1.eq)(schema_js_1.friends.userTwoId, req.user.id)))];
            case 1:
                _a.sent();
                res.json({ success: true });
                return [3 /*break*/, 3];
            case 2:
                reqObj = mockFriends.find(function (f) { return f.id === requestId && f.userTwoId === req.user.id; });
                if (!reqObj)
                    return [2 /*return*/, res.status(404).json({ error: 'Friend request not found' })];
                reqObj.status = 'accepted';
                res.json({ success: true });
                _a.label = 3;
            case 3: return [2 /*return*/];
        }
    });
}); });
// GET: Get messages (DMs or match chats)
app.get('/api/social/messages', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, receiverId, matchId, list, list;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                if (!req.user)
                    return [2 /*return*/, res.status(401).json({ error: 'Unauthorized' })];
                _a = req.query, receiverId = _a.receiverId, matchId = _a.matchId;
                if (!isDbConnected) return [3 /*break*/, 5];
                list = [];
                if (!matchId) return [3 /*break*/, 2];
                return [4 /*yield*/, db_js_1.db.select({
                        id: schema_js_1.messages.id,
                        senderId: schema_js_1.messages.senderId,
                        senderName: schema_js_1.users.name,
                        content: schema_js_1.messages.content,
                        timestamp: schema_js_1.messages.timestamp
                    }).from(schema_js_1.messages)
                        .innerJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.messages.senderId, schema_js_1.users.id))
                        .where((0, drizzle_orm_1.eq)(schema_js_1.messages.matchId, matchId))
                        .orderBy(schema_js_1.messages.timestamp)];
            case 1:
                list = _b.sent();
                return [3 /*break*/, 4];
            case 2:
                if (!receiverId) return [3 /*break*/, 4];
                return [4 /*yield*/, db_js_1.db.select({
                        id: schema_js_1.messages.id,
                        senderId: schema_js_1.messages.senderId,
                        senderName: schema_js_1.users.name,
                        content: schema_js_1.messages.content,
                        timestamp: schema_js_1.messages.timestamp
                    }).from(schema_js_1.messages)
                        .innerJoin(schema_js_1.users, (0, drizzle_orm_1.eq)(schema_js_1.messages.senderId, schema_js_1.users.id))
                        .where((0, drizzle_orm_1.or)((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.messages.senderId, req.user.id), (0, drizzle_orm_1.eq)(schema_js_1.messages.receiverId, receiverId)), (0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_js_1.messages.senderId, receiverId), (0, drizzle_orm_1.eq)(schema_js_1.messages.receiverId, req.user.id))))
                        .orderBy(schema_js_1.messages.timestamp)];
            case 3:
                list = _b.sent();
                _b.label = 4;
            case 4:
                res.json(list);
                return [3 /*break*/, 6];
            case 5:
                list = [];
                if (matchId) {
                    list = mockMessages.filter(function (m) { return m.matchId === matchId; }).map(function (m) {
                        var u = mockUsers.get(m.senderId);
                        return {
                            id: m.id,
                            senderId: m.senderId,
                            senderName: (u === null || u === void 0 ? void 0 : u.name) || m.senderId,
                            content: m.content,
                            timestamp: m.timestamp
                        };
                    });
                }
                else if (receiverId) {
                    list = mockMessages.filter(function (m) {
                        return (m.senderId === req.user.id && m.receiverId === receiverId) ||
                            (m.senderId === receiverId && m.receiverId === req.user.id);
                    }).map(function (m) {
                        var u = mockUsers.get(m.senderId);
                        return {
                            id: m.id,
                            senderId: m.senderId,
                            senderName: (u === null || u === void 0 ? void 0 : u.name) || m.senderId,
                            content: m.content,
                            timestamp: m.timestamp
                        };
                    });
                }
                res.json(list.sort(function (a, b) { return a.timestamp.getTime() - b.timestamp.getTime(); }));
                _b.label = 6;
            case 6: return [2 /*return*/];
        }
    });
}); });
// POST: Send message
app.post('/api/social/messages', function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, receiverId, matchId, content;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                if (!req.user)
                    return [2 /*return*/, res.status(401).json({ error: 'Unauthorized' })];
                _a = req.body, receiverId = _a.receiverId, matchId = _a.matchId, content = _a.content;
                if (!isDbConnected) return [3 /*break*/, 2];
                return [4 /*yield*/, db_js_1.db.insert(schema_js_1.messages).values({
                        senderId: req.user.id,
                        receiverId: receiverId || null,
                        matchId: matchId || null,
                        content: content,
                        timestamp: new Date()
                    })];
            case 1:
                _b.sent();
                res.json({ success: true });
                return [3 /*break*/, 3];
            case 2:
                mockMessages.push({
                    id: mockMessages.length + 1,
                    senderId: req.user.id,
                    receiverId: receiverId || null,
                    matchId: matchId || null,
                    content: content,
                    timestamp: new Date()
                });
                res.json({ success: true });
                _b.label = 3;
            case 3: return [2 /*return*/];
        }
    });
}); });
// --- CORE SERVER BACKGROUND LOOP (Runs every 1 second) ---
setInterval(function () { return __awaiter(void 0, void 0, void 0, function () {
    var now, activeMatches, _i, activeMatches_1, matchRow, currentStatus, parts, mockIds, _a, parts_1, p, isMock, isActiveSession, profileRow, _b, nextLat, nextLng, hidingEndsTime, elapsed, revealIntervalMs, currentCycle, hiders, seekers, _c, hiders_1, hider, lastRevealed, cycleOfLastReveal, hiderProfile, captureRadius, _d, seekers_3, seeker, seekerProfile, _e, hiders_2, hider, hiderProfile, dist, matchBombs, _f, matchBombs_1, bombRow, bombIsActive, _g, hiders_3, hider, hiderProfile, dist, updatedParts, updatedHiders, err_7;
    var _h, _j;
    return __generator(this, function (_k) {
        switch (_k.label) {
            case 0:
                now = new Date();
                if (!isDbConnected) return [3 /*break*/, 47];
                _k.label = 1;
            case 1:
                _k.trys.push([1, 45, , 46]);
                return [4 /*yield*/, db_js_1.db.select().from(schema_js_1.matches).where((0, drizzle_orm_1.or)((0, drizzle_orm_1.eq)(schema_js_1.matches.status, 'hiding'), (0, drizzle_orm_1.eq)(schema_js_1.matches.status, 'hunting')))];
            case 2:
                activeMatches = _k.sent();
                _i = 0, activeMatches_1 = activeMatches;
                _k.label = 3;
            case 3:
                if (!(_i < activeMatches_1.length)) return [3 /*break*/, 44];
                matchRow = activeMatches_1[_i];
                currentStatus = matchRow.status;
                if (!(currentStatus === 'hiding' && matchRow.hidingEndsAt && now >= matchRow.hidingEndsAt)) return [3 /*break*/, 5];
                return [4 /*yield*/, db_js_1.db.update(schema_js_1.matches).set({ status: 'hunting' }).where((0, drizzle_orm_1.eq)(schema_js_1.matches.id, matchRow.id))];
            case 4:
                _k.sent();
                currentStatus = 'hunting';
                _k.label = 5;
            case 5:
                if (!(currentStatus === 'hunting' && matchRow.huntingEndsAt && now >= matchRow.huntingEndsAt)) return [3 /*break*/, 7];
                return [4 /*yield*/, db_js_1.db.update(schema_js_1.matches).set({ status: 'finished' }).where((0, drizzle_orm_1.eq)(schema_js_1.matches.id, matchRow.id))];
            case 6:
                _k.sent();
                return [3 /*break*/, 43];
            case 7: return [4 /*yield*/, db_js_1.db.select().from(schema_js_1.matchParticipants).where((0, drizzle_orm_1.eq)(schema_js_1.matchParticipants.matchId, matchRow.id))];
            case 8:
                parts = _k.sent();
                mockIds = ['host', 'hider1', 'hider2', 'seeker1'];
                _a = 0, parts_1 = parts;
                _k.label = 9;
            case 9:
                if (!(_a < parts_1.length)) return [3 /*break*/, 13];
                p = parts_1[_a];
                isMock = mockIds.includes(p.userId);
                isActiveSession = activeUserSessions.has(p.userId) && (Date.now() - activeUserSessions.get(p.userId) < 5000);
                if (!(isMock && !isActiveSession)) return [3 /*break*/, 12];
                return [4 /*yield*/, db_js_1.db.query.profiles.findFirst({ where: (0, drizzle_orm_1.eq)(schema_js_1.profiles.id, p.userId) })];
            case 10:
                profileRow = _k.sent();
                if (!(profileRow && profileRow.lat && profileRow.lng)) return [3 /*break*/, 12];
                _b = simulateRandomWalk(profileRow.lat, profileRow.lng, matchRow.boundaryCenterLat, matchRow.boundaryCenterLng, matchRow.boundaryRadius), nextLat = _b.nextLat, nextLng = _b.nextLng;
                return [4 /*yield*/, db_js_1.db.update(schema_js_1.profiles).set({
                        lat: nextLat,
                        lng: nextLng,
                        updatedAt: now
                    }).where((0, drizzle_orm_1.eq)(schema_js_1.profiles.id, p.userId))];
            case 11:
                _k.sent();
                _k.label = 12;
            case 12:
                _a++;
                return [3 /*break*/, 9];
            case 13:
                if (!(currentStatus === 'hunting')) return [3 /*break*/, 43];
                hidingEndsTime = matchRow.hidingEndsAt ? new Date(matchRow.hidingEndsAt).getTime() : 0;
                elapsed = now.getTime() - hidingEndsTime;
                revealIntervalMs = matchRow.revealInterval * 1000;
                currentCycle = Math.floor(elapsed / revealIntervalMs);
                hiders = parts.filter(function (p) { return p.role === 'hider'; });
                seekers = parts.filter(function (p) { return p.role === 'seeker'; });
                _c = 0, hiders_1 = hiders;
                _k.label = 14;
            case 14:
                if (!(_c < hiders_1.length)) return [3 /*break*/, 18];
                hider = hiders_1[_c];
                lastRevealed = hider.revealedAt ? new Date(hider.revealedAt).getTime() : 0;
                cycleOfLastReveal = Math.floor((lastRevealed - hidingEndsTime) / revealIntervalMs);
                if (!(hider.revealedLat == null || currentCycle > cycleOfLastReveal)) return [3 /*break*/, 17];
                return [4 /*yield*/, db_js_1.db.query.profiles.findFirst({ where: (0, drizzle_orm_1.eq)(schema_js_1.profiles.id, hider.userId) })];
            case 15:
                hiderProfile = _k.sent();
                if (!hiderProfile) return [3 /*break*/, 17];
                return [4 /*yield*/, db_js_1.db.update(schema_js_1.matchParticipants).set({
                        revealedLat: hiderProfile.lat,
                        revealedLng: hiderProfile.lng,
                        revealedAt: now
                    }).where((0, drizzle_orm_1.eq)(schema_js_1.matchParticipants.id, hider.id))];
            case 16:
                _k.sent();
                _k.label = 17;
            case 17:
                _c++;
                return [3 /*break*/, 14];
            case 18:
                captureRadius = (_j = (_h = matchRow.captureRadius) !== null && _h !== void 0 ? _h : matchRow.catchRadius) !== null && _j !== void 0 ? _j : 4;
                _d = 0, seekers_3 = seekers;
                _k.label = 19;
            case 19:
                if (!(_d < seekers_3.length)) return [3 /*break*/, 28];
                seeker = seekers_3[_d];
                return [4 /*yield*/, db_js_1.db.query.profiles.findFirst({ where: (0, drizzle_orm_1.eq)(schema_js_1.profiles.id, seeker.userId) })];
            case 20:
                seekerProfile = _k.sent();
                if (!seekerProfile || !seekerProfile.lat || !seekerProfile.lng)
                    return [3 /*break*/, 27];
                _e = 0, hiders_2 = hiders;
                _k.label = 21;
            case 21:
                if (!(_e < hiders_2.length)) return [3 /*break*/, 27];
                hider = hiders_2[_e];
                if (hider.isCaught)
                    return [3 /*break*/, 26];
                return [4 /*yield*/, db_js_1.db.query.profiles.findFirst({ where: (0, drizzle_orm_1.eq)(schema_js_1.profiles.id, hider.userId) })];
            case 22:
                hiderProfile = _k.sent();
                if (!hiderProfile || !hiderProfile.lat || !hiderProfile.lng)
                    return [3 /*break*/, 26];
                dist = getDistance(seekerProfile.lat, seekerProfile.lng, hiderProfile.lat, hiderProfile.lng);
                if (!(dist <= captureRadius)) return [3 /*break*/, 26];
                return [4 /*yield*/, db_js_1.db.update(schema_js_1.matchParticipants).set({ isCaught: true }).where((0, drizzle_orm_1.eq)(schema_js_1.matchParticipants.id, hider.id))];
            case 23:
                _k.sent();
                return [4 /*yield*/, db_js_1.db.insert(schema_js_1.catches).values({ matchId: matchRow.id, hunterId: seeker.userId, targetId: hider.userId, timestamp: now })];
            case 24:
                _k.sent();
                return [4 /*yield*/, db_js_1.db.update(schema_js_1.profiles).set({ score: (0, drizzle_orm_1.sql)(templateObject_14 || (templateObject_14 = __makeTemplateObject(["", " + 100"], ["", " + 100"])), schema_js_1.profiles.score) }).where((0, drizzle_orm_1.eq)(schema_js_1.profiles.id, seeker.userId))];
            case 25:
                _k.sent();
                hider.isCaught = true; // Prevent double-processing in same tick
                _k.label = 26;
            case 26:
                _e++;
                return [3 /*break*/, 21];
            case 27:
                _d++;
                return [3 /*break*/, 19];
            case 28: return [4 /*yield*/, db_js_1.db.select().from(schema_js_1.bombs).where((0, drizzle_orm_1.eq)(schema_js_1.bombs.matchId, matchRow.id))];
            case 29:
                matchBombs = _k.sent();
                _f = 0, matchBombs_1 = matchBombs;
                _k.label = 30;
            case 30:
                if (!(_f < matchBombs_1.length)) return [3 /*break*/, 40];
                bombRow = matchBombs_1[_f];
                bombIsActive = bombRow.isActive;
                if (!(!bombIsActive && now >= bombRow.activatesAt)) return [3 /*break*/, 32];
                return [4 /*yield*/, db_js_1.db.update(schema_js_1.bombs).set({ isActive: true }).where((0, drizzle_orm_1.eq)(schema_js_1.bombs.id, bombRow.id))];
            case 31:
                _k.sent();
                bombIsActive = true;
                _k.label = 32;
            case 32:
                if (!bombIsActive) return [3 /*break*/, 39];
                _g = 0, hiders_3 = hiders;
                _k.label = 33;
            case 33:
                if (!(_g < hiders_3.length)) return [3 /*break*/, 39];
                hider = hiders_3[_g];
                if (hider.isCaught)
                    return [3 /*break*/, 38];
                return [4 /*yield*/, db_js_1.db.query.profiles.findFirst({ where: (0, drizzle_orm_1.eq)(schema_js_1.profiles.id, hider.userId) })];
            case 34:
                hiderProfile = _k.sent();
                if (!(hiderProfile && hiderProfile.lat && hiderProfile.lng)) return [3 /*break*/, 38];
                dist = getDistance(bombRow.lat, bombRow.lng, hiderProfile.lat, hiderProfile.lng);
                if (!(dist <= bombRow.radius)) return [3 /*break*/, 38];
                // Explode Catch!
                return [4 /*yield*/, db_js_1.db.update(schema_js_1.matchParticipants).set({ isCaught: true }).where((0, drizzle_orm_1.eq)(schema_js_1.matchParticipants.id, hider.id))];
            case 35:
                // Explode Catch!
                _k.sent();
                return [4 /*yield*/, db_js_1.db.insert(schema_js_1.catches).values({
                        matchId: matchRow.id,
                        hunterId: bombRow.placedById,
                        targetId: hider.userId,
                        timestamp: now
                    })];
            case 36:
                _k.sent();
                // Reward score
                return [4 /*yield*/, db_js_1.db.update(schema_js_1.profiles).set({ score: (0, drizzle_orm_1.sql)(templateObject_15 || (templateObject_15 = __makeTemplateObject(["", " + 100"], ["", " + 100"])), schema_js_1.profiles.score) }).where((0, drizzle_orm_1.eq)(schema_js_1.profiles.id, bombRow.placedById))];
            case 37:
                // Reward score
                _k.sent();
                _k.label = 38;
            case 38:
                _g++;
                return [3 /*break*/, 33];
            case 39:
                _f++;
                return [3 /*break*/, 30];
            case 40: return [4 /*yield*/, db_js_1.db.select().from(schema_js_1.matchParticipants).where((0, drizzle_orm_1.eq)(schema_js_1.matchParticipants.matchId, matchRow.id))];
            case 41:
                updatedParts = _k.sent();
                updatedHiders = updatedParts.filter(function (p) { return p.role === 'hider'; });
                if (!(updatedHiders.length > 0 && updatedHiders.every(function (h) { return h.isCaught; }))) return [3 /*break*/, 43];
                return [4 /*yield*/, db_js_1.db.update(schema_js_1.matches).set({ status: 'finished' }).where((0, drizzle_orm_1.eq)(schema_js_1.matches.id, matchRow.id))];
            case 42:
                _k.sent();
                _k.label = 43;
            case 43:
                _i++;
                return [3 /*break*/, 3];
            case 44: return [3 /*break*/, 46];
            case 45:
                err_7 = _k.sent();
                console.error('Server loop DB error:', err_7);
                return [3 /*break*/, 46];
            case 46: return [3 /*break*/, 48];
            case 47:
                // --- Mock Loop Operations ---
                mockMatches.forEach(function (matchRow) {
                    var _a, _b;
                    var currentStatus = matchRow.status;
                    if (currentStatus === 'hiding' && matchRow.hidingEndsAt && now >= matchRow.hidingEndsAt) {
                        matchRow.status = 'hunting';
                        currentStatus = 'hunting';
                    }
                    if (currentStatus === 'hunting' && matchRow.huntingEndsAt && now >= matchRow.huntingEndsAt) {
                        matchRow.status = 'finished';
                        return;
                    }
                    // --- MOCK WALK SIMULATION (Mock Database) ---
                    var parts = mockParticipants.filter(function (p) { return p.matchId === matchRow.id; });
                    var mockIds = ['host', 'hider1', 'hider2', 'seeker1'];
                    parts.forEach(function (p) {
                        var isMock = mockIds.includes(p.userId);
                        var isActiveSession = activeUserSessions.has(p.userId) && (Date.now() - activeUserSessions.get(p.userId) < 5000);
                        if (isMock && !isActiveSession) {
                            var profileRow = mockProfiles.get(p.userId);
                            if (profileRow && profileRow.lat && profileRow.lng) {
                                var _a = simulateRandomWalk(profileRow.lat, profileRow.lng, matchRow.boundaryCenterLat, matchRow.boundaryCenterLng, matchRow.boundaryRadius), nextLat = _a.nextLat, nextLng = _a.nextLng;
                                profileRow.lat = nextLat;
                                profileRow.lng = nextLng;
                                profileRow.updatedAt = now;
                            }
                        }
                    });
                    if (currentStatus === 'hunting') {
                        var hidingEndsTime_1 = matchRow.hidingEndsAt ? new Date(matchRow.hidingEndsAt).getTime() : 0;
                        var elapsed = now.getTime() - hidingEndsTime_1;
                        var revealIntervalMs_1 = matchRow.revealInterval * 1000;
                        var currentCycle_1 = Math.floor(elapsed / revealIntervalMs_1);
                        var hiders_4 = mockParticipants.filter(function (p) { return p.matchId === matchRow.id && p.role === 'hider'; });
                        hiders_4.forEach(function (hider) {
                            var lastRevealed = hider.revealedAt ? new Date(hider.revealedAt).getTime() : 0;
                            var cycleOfLastReveal = Math.floor((lastRevealed - hidingEndsTime_1) / revealIntervalMs_1);
                            if (hider.revealedLat == null || currentCycle_1 > cycleOfLastReveal) {
                                var hiderProfile = mockProfiles.get(hider.userId);
                                if (hiderProfile) {
                                    hider.revealedLat = hiderProfile.lat;
                                    hider.revealedLng = hiderProfile.lng;
                                    hider.revealedAt = now;
                                }
                            }
                        });
                        // --- AUTO-CAPTURE: Check every seeker vs every uncaught hider (live positions) ---
                        var captureRadius_1 = (_b = (_a = matchRow.captureRadius) !== null && _a !== void 0 ? _a : matchRow.catchRadius) !== null && _b !== void 0 ? _b : 4;
                        var seekers = mockParticipants.filter(function (p) { return p.matchId === matchRow.id && p.role === 'seeker'; });
                        seekers.forEach(function (seeker) {
                            var seekerProfile = mockProfiles.get(seeker.userId);
                            if (!seekerProfile)
                                return;
                            hiders_4.forEach(function (hider) {
                                if (hider.isCaught)
                                    return;
                                var hiderProfile = mockProfiles.get(hider.userId);
                                if (!hiderProfile)
                                    return;
                                var dist = getDistance(seekerProfile.lat, seekerProfile.lng, hiderProfile.lat, hiderProfile.lng);
                                if (dist <= captureRadius_1) {
                                    hider.isCaught = true;
                                    var sp = mockProfiles.get(seeker.userId);
                                    if (sp)
                                        sp.score += 100;
                                    mockCatches.push({ id: mockCatches.length + 1, matchId: matchRow.id, hunterId: seeker.userId, targetId: hider.userId, timestamp: now });
                                }
                            });
                        });
                        // Bombs in mock
                        mockBombs.filter(function (b) { return b.matchId === matchRow.id; }).forEach(function (bombRow) {
                            if (!bombRow.isActive && now >= bombRow.activatesAt) {
                                bombRow.isActive = true;
                            }
                            if (bombRow.isActive) {
                                hiders_4.forEach(function (hider) {
                                    if (hider.isCaught)
                                        return;
                                    var hiderProfile = mockProfiles.get(hider.userId);
                                    if (hiderProfile) {
                                        var dist = getDistance(bombRow.lat, bombRow.lng, hiderProfile.lat, hiderProfile.lng);
                                        if (dist <= bombRow.radius) {
                                            hider.isCaught = true;
                                            var seekerProfile = mockProfiles.get(bombRow.placedById);
                                            if (seekerProfile)
                                                seekerProfile.score += 100;
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
                        if (hiders_4.length > 0 && hiders_4.every(function (h) { return h.isCaught; })) {
                            matchRow.status = 'finished';
                        }
                    }
                });
                _k.label = 48;
            case 48: return [2 /*return*/];
        }
    });
}); }, 1000);
// Global Special Bounty Selector & Wild Zone Ambient Trigger: Run every 60 seconds
var lastBountyTick = 0;
setInterval(function () { return __awaiter(void 0, void 0, void 0, function () {
    var now, currentHour, rand, shouldTrigger;
    return __generator(this, function (_a) {
        now = Date.now();
        if (now - lastBountyTick < 60000)
            return [2 /*return*/];
        lastBountyTick = now;
        console.log('🎲 Heartbeat: Checking Wild Zone ambient trigger...');
        currentHour = new Date().getHours();
        rand = Math.random();
        shouldTrigger = false;
        if (currentHour >= 17 && currentHour < 21) {
            if (rand < 0.01)
                shouldTrigger = true; // 1% chance per minute during peak hours (17:00-21:00)
        }
        else if (currentHour >= 10 && currentHour < 22) {
            if (rand < 0.002)
                shouldTrigger = true; // 0.2% chance per minute during other active hours
        }
        if (shouldTrigger) {
            console.log('🎲 Ambient Wild Zone trigger probability hit. Executing cluster scan...');
            triggerWildZoneClusters(false).then(function (res) {
                if (res.triggeredCount > 0) {
                    console.log("\uD83D\uDCE1 Wild Zone triggered: Launched ".concat(res.triggeredCount, " matches:"), res.matches);
                }
                else {
                    console.log('📡 Wild Zone scan completed: No clusters eligible.');
                }
            }).catch(function (err) {
                console.error('Ambient Wild Zone matching error:', err);
            });
        }
        return [2 /*return*/];
    });
}); }, 1000);
// Start server
checkDbConnection().then(function () {
    app.listen(port, function () {
        console.log("\uD83D\uDE80 Express server running on http://localhost:".concat(port));
    });
});
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6, templateObject_7, templateObject_8, templateObject_9, templateObject_10, templateObject_11, templateObject_12, templateObject_13, templateObject_14, templateObject_15;
