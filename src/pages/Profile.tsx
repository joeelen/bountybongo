import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/AuthContext';
import { useGps } from '../lib/GpsContext';
import { useToast } from '../lib/ToastContext';
import { GameEffects } from '../lib/GameEffects';
import { Shield, Activity, Trophy, Globe, Target, Clock, Cloud, LogIn, Flame, CheckCircle, Award, Sparkles } from 'lucide-react';
import { CloudAuthModal } from '../components/CloudAuthModal';
import { DailyQuestManager, TITLE_CATALOG, type PlayerTitle, type DailyQuest } from '../lib/dailyQuests';

const ProfilePage: React.FC = () => {
  const { user, profile, isGuest, toggleDark } = useAuth();
  const { lat, lng, isSimulated } = useGps();
  const { success } = useToast();
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [quests, setQuests] = useState<DailyQuest[]>(() => DailyQuestManager.getDailyQuests());
  const [streak, setStreak] = useState<number>(() => DailyQuestManager.getStreak());
  const [equippedTitle, setEquippedTitle] = useState<PlayerTitle>(() => DailyQuestManager.getEquippedTitle());
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const handleClaim = async (quest: DailyQuest) => {
    setClaimingId(quest.id);
    const result = await DailyQuestManager.claimQuest(quest.id, profile?.score ?? 0);
    if (result.success) {
      setQuests(DailyQuestManager.getDailyQuests());
      setStreak(DailyQuestManager.getStreak());
      GameEffects.playPickup('bounty_crystal');
      success(`+${result.rewardXp} XP Belønning!`, `Du fullførte dagens oppdrag: ${quest.title}!`);
    }
    setClaimingId(null);
  };

  const handleEquipTitle = (title: PlayerTitle) => {
    const isUnlocked = ((profile?.score ?? 0) >= (title.requiredXp || 0));
    if (!isUnlocked) return;
    const newlyEquipped = DailyQuestManager.equipTitle(title.id);
    setEquippedTitle(newlyEquipped);
    GameEffects.playPowerUp('shield');
    success('Tittel Utstyrt!', `Du bærer nå tittelen "${title.title}".`);
  };

  // Query personal stats
  const { data: stats } = useQuery({
    queryKey: ['profileStats'],
    queryFn: async () => {
      const res = await fetch('/api/profile/stats');
      if (!res.ok) throw new Error('Failed to load stats');
      return res.json();
    },
    refetchInterval: 15000
  });

  if (!user || !profile) {
    return (
      <div className="flex-1 grid-bg flex flex-col items-center justify-center font-mono text-zinc-500 animate-pulse">
        CONNECTING PROFILE UPLINK...
      </div>
    );
  }

  const getRankDesignation = (score: number) => {
    if (score >= 1000) return { label: 'APEX PREDATOR', color: 'text-cyber-red glow-red' };
    if (score >= 500) return { label: 'LEGENDARY HUNTER', color: 'text-cyber-yellow glow-yellow' };
    if (score >= 200) return { label: 'ELITE RECON', color: 'text-cyber-cyan glow-cyan' };
    if (score >= 50) return { label: 'FIELD OPERATIVE', color: 'text-zinc-300' };
    return { label: 'NOVICE AGENT', color: 'text-zinc-500' };
  };

  const rank = getRankDesignation(profile.score);

  const formatTimestamp = (ts: string | Date) => {
    const d = new Date(ts);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex-1 w-full h-full grid-bg p-4 overflow-y-auto font-rajdhani flex flex-col items-center pt-8 pb-20 md:pb-8">
      <div className="w-full max-w-3xl flex flex-col gap-6">

        {/* Header Banner */}
        <div className="border-b border-cyber-border pb-4 flex items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <img
                src={user.avatar}
                alt=""
                className="w-16 h-16 rounded-full border-2 border-cyber-cyan shadow-cyan-glow bg-zinc-950"
              />
              {profile.isDark && (
                <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-cyber-green border-2 border-zinc-950 animate-pulse shadow-[0_0_8px_rgba(0,255,100,0.5)]" />
              )}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black font-orbitron text-cyber-cyan glow-cyan tracking-wider">
                  {user.name}
                </h1>
                {isGuest ? (
                  <span className="text-[10px] bg-cyber-yellow/15 text-cyber-yellow border border-cyber-yellow/30 px-2 py-0.5 rounded font-mono font-bold uppercase">
                    Guest
                  </span>
                ) : (
                  <span className="text-[10px] bg-cyber-green/15 text-cyber-green border border-cyber-green/30 px-2 py-0.5 rounded font-mono font-bold uppercase">
                    Cloud Synced
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 uppercase font-mono mt-0.5">
                TAG: @{user.name} · ID: {user.id}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className={`text-xs font-black uppercase tracking-wide font-orbitron ${rank.color}`}>
                  ◆ {rank.label}
                </span>
                <span className="text-[10px] font-mono font-bold bg-zinc-900/90 text-cyber-yellow border border-cyber-yellow/40 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-yellow-glow/10">
                  <span>{equippedTitle.icon}</span>
                  <span>{equippedTitle.title}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Score badge */}
          <div className="flex flex-col items-center bg-zinc-900/80 border border-cyber-cyan/30 rounded-xl px-5 py-3">
            <span className="text-2xl font-black font-mono text-cyber-cyan glow-cyan">{profile.score}</span>
            <span className="text-[10px] text-zinc-500 uppercase font-black tracking-wider">XP POOL</span>
          </div>
        </div>

        {/* Cloud Account & Progression Banner */}
        <div className={`cyber-card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border transition-all ${
          isGuest 
            ? 'border-cyber-yellow/40 bg-cyber-yellow/5' 
            : 'border-cyber-green/40 bg-cyber-green/5'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-lg border shrink-0 ${
              isGuest ? 'border-cyber-yellow/40 bg-zinc-950 text-cyber-yellow' : 'border-cyber-green/40 bg-zinc-950 text-cyber-green'
            }`}>
              <Cloud className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-2">
                <span className={`text-xs font-black uppercase tracking-wider font-orbitron ${
                  isGuest ? 'text-cyber-yellow' : 'text-cyber-green'
                }`}>
                  {isGuest ? 'Local Guest Profile' : 'Cloud Account Synced'}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase font-bold ${
                  isGuest ? 'bg-cyber-yellow/10 border-cyber-yellow/30 text-cyber-yellow' : 'bg-cyber-green/10 border-cyber-green/30 text-cyber-green'
                }`}>
                  {isGuest ? 'Device Only' : 'Saved to Cloud'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-lg leading-relaxed">
                {isGuest 
                  ? 'Your progress and XP are currently saved only in this browser. Connect a Cloud Account to keep your points, access your profile anywhere, and add friends!'
                  : `Signed in as ${user.name} (${user.email}). Your rank and XP are safely stored in the cloud.`
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            {isGuest ? (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="w-full sm:w-auto min-h-[44px] px-4 py-2 bg-cyber-cyan hover:bg-white text-zinc-950 font-black text-xs uppercase rounded flex items-center justify-center gap-2 transition-all active:scale-95 shadow-cyan-glow/20"
              >
                <LogIn className="w-4 h-4" />
                Connect Cloud Account
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="w-full sm:w-auto min-h-[44px] px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-cyber-cyan text-zinc-300 font-bold text-xs uppercase rounded flex items-center justify-center gap-1.5 transition-all active:scale-95"
              >
                Manage Account
              </button>
            )}
          </div>
        </div>

        {/* Daily Operations & Streaks Section (Milestone 4) */}
        <div className="cyber-card p-5 flex flex-col gap-4 border-cyber-yellow/40 bg-zinc-950/60 shadow-yellow-glow/5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-900 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-cyber-yellow/10 border border-cyber-yellow/30 text-cyber-yellow">
                <Flame className="w-5 h-5 animate-pulse" />
              </div>
              <div className="text-left">
                <span className="font-orbitron font-black text-sm text-cyber-yellow tracking-wider uppercase block">
                  Daglige Oppdrag
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  Nye oppdrag genereres hver midnatt UTC
                </span>
              </div>
            </div>

            {/* Streak Pill */}
            <div className="flex items-center gap-2 bg-zinc-900 border border-cyber-yellow/30 px-3 py-1.5 rounded-full self-start sm:self-auto">
              <span className="text-lg">🔥</span>
              <span className="text-xs font-black font-orbitron text-cyber-yellow">
                {streak} {streak === 1 ? 'DAG STREAK' : 'DAGER STREAK'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {quests.map((quest) => (
              <div
                key={quest.id}
                className={`p-3.5 rounded-xl border flex flex-col justify-between gap-3 text-left transition-all ${
                  quest.isClaimed
                    ? 'bg-zinc-950/40 border-zinc-800 opacity-70'
                    : quest.isCompleted
                    ? 'bg-cyber-yellow/5 border-cyber-yellow/50 shadow-yellow-glow/10'
                    : 'bg-zinc-900/60 border-zinc-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl shrink-0">{quest.icon}</span>
                    <div>
                      <h3 className="font-bold text-xs text-zinc-200 font-orbitron">{quest.title}</h3>
                      <span className="text-[10px] font-mono text-cyber-yellow font-bold">+{quest.rewardXp} XP</span>
                    </div>
                  </div>
                  {quest.isClaimed && (
                    <span className="text-[10px] font-mono text-cyber-green font-bold flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-cyber-green" /> Tatt
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-zinc-400 leading-snug font-mono">
                  {quest.description}
                </p>

                {/* Progress bar */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between text-[10px] font-mono font-bold text-zinc-400">
                    <span>Framgang</span>
                    <span>{quest.current} / {quest.target}</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${
                        quest.isCompleted ? 'bg-cyber-yellow shadow-yellow-glow' : 'bg-cyber-cyan'
                      }`}
                      style={{ width: `${Math.min(100, (quest.current / quest.target) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Claim Button */}
                {quest.isCompleted && !quest.isClaimed ? (
                  <button
                    type="button"
                    onClick={() => handleClaim(quest)}
                    disabled={claimingId === quest.id}
                    className="w-full min-h-[44px] px-3 py-1.5 bg-cyber-yellow text-zinc-950 font-black font-orbitron text-xs uppercase rounded-lg hover:bg-white active:scale-95 transition-all shadow-yellow-glow flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{claimingId === quest.id ? 'Henter...' : `Krev +${quest.rewardXp} XP`}</span>
                  </button>
                ) : quest.isClaimed ? (
                  <div className="w-full min-h-[44px] px-3 py-1.5 bg-zinc-900/80 border border-zinc-800 text-zinc-500 font-bold font-mono text-[10px] uppercase rounded-lg flex items-center justify-center">
                    Fullført i dag
                  </div>
                ) : (
                  <div className="w-full min-h-[44px] px-3 py-1.5 bg-zinc-900/40 border border-zinc-800 text-zinc-500 font-mono text-[10px] uppercase rounded-lg flex items-center justify-center">
                    Pågår ({quest.current}/{quest.target})
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Player Titles & Identity Designation (Milestone 4) */}
        <div className="cyber-card p-5 flex flex-col gap-4 border-cyber-cyan/30">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-3 text-left">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-cyber-cyan" />
              <div>
                <span className="font-orbitron font-black text-sm text-cyber-cyan tracking-wider uppercase block">
                  Titler & Utmerkelser
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  Lås opp titler med XP og utstyr dem på din profil og i matcher
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono font-bold text-cyber-cyan bg-cyber-cyan/10 border border-cyber-cyan/30 px-2 py-1 rounded">
              Aktiv: {equippedTitle.icon} {equippedTitle.title}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
            {TITLE_CATALOG.map((title) => {
              const isUnlocked = ((profile?.score ?? 0) >= (title.requiredXp || 0));
              const isEquipped = equippedTitle.id === title.id;

              return (
                <div
                  key={title.id}
                  className={`p-3 rounded-xl border flex flex-col justify-between gap-2.5 text-left transition-all ${
                    isEquipped
                      ? 'border-cyber-cyan bg-cyber-cyan/10 shadow-cyan-glow/15 ring-1 ring-cyber-cyan'
                      : isUnlocked
                      ? 'border-zinc-800 bg-zinc-900/70 hover:border-zinc-700'
                      : 'border-zinc-900 bg-zinc-950/50 opacity-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xl shrink-0">{title.icon}</span>
                      <div className="min-w-0">
                        <h4 className="font-orbitron font-black text-xs text-zinc-200 truncate">{title.title}</h4>
                        <span className="text-[10px] font-mono text-zinc-500 uppercase">
                          {isUnlocked ? 'Låst opp' : `Krever ${title.requiredXp} XP`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-[10px] text-zinc-400 leading-snug font-mono">
                    {title.description}
                  </p>

                  <button
                    type="button"
                    onClick={() => handleEquipTitle(title)}
                    disabled={!isUnlocked || isEquipped}
                    className={`w-full min-h-[44px] px-3 py-1.5 rounded-lg text-xs font-orbitron font-bold uppercase transition-all flex items-center justify-center gap-1.5 ${
                      isEquipped
                        ? 'bg-cyber-cyan text-zinc-950 font-black shadow-cyan-glow'
                        : isUnlocked
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 active:scale-95 border border-zinc-700'
                        : 'bg-zinc-900/50 text-zinc-600 border border-zinc-900 cursor-not-allowed'
                    }`}
                  >
                    {isEquipped ? '✓ Utstyrt' : isUnlocked ? 'Bruk tittel' : `Låst (${title.requiredXp} XP)`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Info Grid — 3 columns on md+ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          {/* Telemetry Status */}
          <div className="cyber-card p-5 flex flex-col gap-3.5">
            <span className="font-bold text-xs text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 font-orbitron border-b border-zinc-900 pb-2">
              <Activity className="w-4 h-4 text-cyber-cyan" />
              Sensor Telemetry
            </span>

            <div className="flex flex-col gap-2.5 text-xs font-mono">
              <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                <span className="text-zinc-500">GPS LAT:</span>
                <span className="text-zinc-300 font-bold">{lat.toFixed(6)}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                <span className="text-zinc-500">GPS LNG:</span>
                <span className="text-zinc-300 font-bold">{lng.toFixed(6)}</span>
              </div>
              <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                <span className="text-zinc-500">GPS MODE:</span>
                <span className={isSimulated ? 'text-cyber-red font-bold' : 'text-cyber-green font-bold'}>
                  {isSimulated ? 'SIMULATED' : 'PHYSICAL'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">HEARTBEAT:</span>
                <span className="text-cyber-cyan animate-pulse">ACTIVE 10s</span>
              </div>
            </div>
          </div>

          {/* Wild Zone Status */}
          <div className="cyber-card p-5 flex flex-col gap-3.5">
            <span className="font-bold text-xs text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 font-orbitron border-b border-zinc-900 pb-2">
              <Shield className="w-4 h-4 text-cyber-cyan" />
              Wild Zone Control
            </span>

            <div className="flex flex-col gap-3 mt-1">
              <div className={`flex flex-col items-center gap-2 py-4 rounded-lg border transition-all duration-300 ${
                profile.isDark
                  ? 'border-cyber-green/40 bg-cyber-green/5 shadow-[0_0_10px_rgba(0,255,100,0.1)]'
                  : 'border-zinc-800 bg-zinc-950/40'
              }`}>
                <span className={`text-xs font-black uppercase tracking-widest ${profile.isDark ? 'text-cyber-green' : 'text-zinc-500'}`}>
                  {profile.isDark ? '● ACTIVE' : '○ OFFLINE'}
                </span>
                <button
                  onClick={() => toggleDark(!profile.isDark)}
                  className={`px-5 py-2 rounded text-xs font-black border uppercase transition-all duration-300 ${
                    profile.isDark
                      ? 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
                      : 'bg-cyber-green/10 text-cyber-green border-cyber-green/40 hover:bg-cyber-green/20'
                  }`}
                >
                  {profile.isDark ? 'Go Offline' : 'Go Active'}
                </button>
              </div>
              <p className="text-[10px] text-zinc-600 leading-relaxed font-mono">
                Going Active places your profile into the ambient hider pool. The server clusters active players within 800m for daily random events.
              </p>
            </div>
          </div>

          {/* Combat Stats */}
          <div className="cyber-card p-5 flex flex-col gap-3.5">
            <span className="font-bold text-xs text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 font-orbitron border-b border-zinc-900 pb-2">
              <Trophy className="w-4 h-4 text-cyber-yellow" />
              Combat Registry
            </span>

            <div className="grid grid-cols-2 gap-2 mt-1">
              <div className="flex flex-col items-center p-3 rounded-lg bg-zinc-950/60 border border-zinc-800">
                <span className="text-xl font-black text-cyber-cyan glow-cyan">{stats?.catchesMade ?? 0}</span>
                <span className="text-[10px] text-zinc-500 uppercase font-black mt-0.5 text-center">Catches Made</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-lg bg-zinc-950/60 border border-zinc-800">
                <span className="text-xl font-black text-cyber-red">{stats?.timesCaught ?? 0}</span>
                <span className="text-[10px] text-zinc-500 uppercase font-black mt-0.5 text-center">Times Caught</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-lg bg-zinc-950/60 border border-zinc-800">
                <span className="text-xl font-black text-cyber-orange">{stats?.matchesPlayed ?? 0}</span>
                <span className="text-[10px] text-zinc-500 uppercase font-black mt-0.5 text-center">Matches Joined</span>
              </div>
              <div className="flex flex-col items-center p-3 rounded-lg bg-zinc-950/60 border border-zinc-800">
                <span className="text-xl font-black text-zinc-300">{profile.score}</span>
                <span className="text-[10px] text-zinc-500 uppercase font-black mt-0.5 text-center">Total XP</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Catches */}
        <div className="cyber-card p-5 flex flex-col gap-3">
          <span className="font-bold text-xs text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 font-orbitron border-b border-zinc-900 pb-2">
            <Target className="w-4 h-4 text-cyber-red" />
            Recent Capture Log
          </span>

          {!stats || stats.recentCatches?.length === 0 ? (
            <div className="text-zinc-600 text-xs text-center font-mono py-6">
              NO CAPTURE RECORDS FOUND IN COMBAT LOG.
            </div>
          ) : (
            <div className="flex flex-col gap-2 mt-1">
              {stats.recentCatches?.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-2.5 rounded bg-zinc-900/60 border border-cyber-border hover:border-cyber-red/30 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-cyber-red shrink-0" />
                    <img src={c.targetAvatar} alt="" className="w-6 h-6 rounded-full border border-cyber-border" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-zinc-300">{c.targetName}</span>
                      {c.matchId && (
                        <span className="text-[10px] text-zinc-600 font-mono">Match: {c.matchId}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
                    <Clock className="w-3 h-3" />
                    {formatTimestamp(c.timestamp)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* GPS Disclaimer */}
        <div className="cyber-card p-4 border-cyber-cyan/10 bg-zinc-950/20 text-xs text-zinc-500 leading-relaxed font-mono flex gap-3">
          <Globe className="w-6 h-6 text-cyber-cyan shrink-0 mt-0.5" />
          <div>
            <strong className="text-zinc-400 block mb-1">GEOFENCING MATRIX WARNING</strong>
            This system tracks active coordinates relative to physical GPS sensors. In matches, ensure you stay inside the designated cyber play area circle. Placing bombs or making catches validates your coordinates directly on the host server using the Haversine equation.
          </div>
        </div>

      </div>

      <CloudAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
};

export default ProfilePage;
