import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/AuthContext';
import { Trophy, Award, Star, Crown, Zap, Shield } from 'lucide-react';

const getRankTier = (score: number) => {
  if (score >= 1000) return { label: 'Apex Predator', color: 'text-cyber-red', bg: 'bg-cyber-red/5', border: 'border-cyber-red/20', icon: <Crown className="w-3 h-3" /> };
  if (score >= 500) return { label: 'Legendary Hunter', color: 'text-cyber-yellow', bg: 'bg-cyber-yellow/5', border: 'border-cyber-yellow/20', icon: <Trophy className="w-3 h-3" /> };
  if (score >= 200) return { label: 'Elite Recon', color: 'text-cyber-cyan', bg: 'bg-cyber-cyan/5', border: 'border-cyber-cyan/20', icon: <Zap className="w-3 h-3" /> };
  if (score >= 50) return { label: 'Field Operative', color: 'text-zinc-300', bg: 'bg-zinc-900/40', border: 'border-zinc-700/30', icon: <Shield className="w-3 h-3" /> };
  return { label: 'Novice Agent', color: 'text-zinc-500', bg: 'bg-zinc-900/20', border: 'border-zinc-800', icon: null };
};

const Leaderboard: React.FC = () => {
  const { user } = useAuth();

  const { data: leaders = [], isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      const res = await fetch('/api/leaderboard');
      if (!res.ok) throw new Error('Failed to load leaderboard data');
      return res.json();
    },
    refetchInterval: 10000
  });

  const myRankIndex = leaders.findIndex((l: any) => l.id === user?.id);
  const myRank = myRankIndex >= 0 ? myRankIndex + 1 : null;

  return (
    <div className="flex-1 w-full h-full grid-bg p-4 overflow-y-auto font-rajdhani flex flex-col items-center pt-8 pb-20 md:pb-8">
      <div className="w-full max-w-2xl flex flex-col gap-6">

        {/* Header */}
        <div className="text-center border-b border-cyber-border pb-3">
          <h1 className="text-2xl font-black font-orbitron text-cyber-cyan glow-cyan tracking-wider flex items-center justify-center gap-2">
            <Trophy className="w-6 h-6 text-cyber-cyan animate-bounce" />
            GLOBAL HUNT LEADERBOARD
          </h1>
          <p className="text-xs text-zinc-500 uppercase mt-0.5">
            Real-time rating registry of active grid bounty hunters
          </p>
        </div>

        {/* Your rank badge */}
        {myRank && (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-cyber-cyan/30 bg-cyber-cyan/5">
            <div className="w-10 h-10 rounded-full bg-cyber-cyan/10 border border-cyber-cyan/30 flex items-center justify-center font-black font-orbitron text-cyber-cyan text-sm">
              #{myRank}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase tracking-widest text-cyber-cyan">Your Current Rank</span>
              <span className="text-[11px] text-zinc-400 font-mono">
                {leaders[myRankIndex]?.score ?? 0} XP — {getRankTier(leaders[myRankIndex]?.score ?? 0).label}
              </span>
            </div>
            {myRank <= 3 && (
              <Crown className="w-5 h-5 text-cyber-yellow ml-auto glow-yellow" />
            )}
          </div>
        )}

        {/* Tier legend */}
        <div className="grid grid-cols-5 gap-1.5 text-center">
          {[
            { label: 'Apex', color: 'text-cyber-red', threshold: '1000+' },
            { label: 'Legend', color: 'text-cyber-yellow', threshold: '500+' },
            { label: 'Elite', color: 'text-cyber-cyan', threshold: '200+' },
            { label: 'Operative', color: 'text-zinc-300', threshold: '50+' },
            { label: 'Novice', color: 'text-zinc-500', threshold: '0+' },
          ].map(tier => (
            <div key={tier.label} className="flex flex-col items-center bg-zinc-950/40 border border-zinc-900 rounded p-1.5">
              <span className={`text-[9px] font-black uppercase ${tier.color}`}>{tier.label}</span>
              <span className="text-[8px] text-zinc-600 font-mono">{tier.threshold} XP</span>
            </div>
          ))}
        </div>

        {/* Board */}
        <div className="cyber-card p-6 border-cyber-cyan/20 flex flex-col">
          {isLoading ? (
            <div className="text-center py-20 text-zinc-500 font-mono animate-pulse">
              DOWNLINKING REGISTRY SCORES... STAND BY.
            </div>
          ) : leaders.length === 0 ? (
            <div className="text-center py-20 text-zinc-500 font-mono">
              NO ACTIVE REGISTERED HUNTERS RECORDED.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {/* Table Header */}
              <div className="grid grid-cols-12 px-3 text-[10px] text-zinc-500 uppercase font-black tracking-wider pb-1.5 border-b border-zinc-900 font-mono">
                <div className="col-span-2">Rank</div>
                <div className="col-span-6">Hunter / Agent</div>
                <div className="col-span-4 text-right">XP Pool</div>
              </div>

              {/* Rows */}
              <div className="flex flex-col gap-1.5 mt-2">
                {leaders.map((leader: any, idx: number) => {
                  const rank = idx + 1;
                  const isMe = leader.id === user?.id;
                  const tier = getRankTier(leader.score);

                  let rowClasses = `grid grid-cols-12 items-center px-3 py-3 rounded-lg border transition-all hover:scale-[1.01] ${tier.bg} ${tier.border}`;
                  if (isMe) rowClasses += ' ring-1 ring-cyber-cyan/40';

                  let rankIcon = null;
                  if (rank === 1) rankIcon = <Crown className="w-4 h-4 text-cyber-yellow" />;
                  else if (rank === 2) rankIcon = <Award className="w-3.5 h-3.5 text-zinc-300" />;
                  else if (rank === 3) rankIcon = <Star className="w-3.5 h-3.5 text-amber-600" />;

                  return (
                    <div key={leader.id} className={rowClasses}>
                      {/* Rank */}
                      <div className="col-span-2 flex items-center gap-1 font-orbitron font-bold">
                        <span className={rank <= 3 ? tier.color : 'text-zinc-500'}>#{rank}</span>
                        {rankIcon}
                      </div>

                      {/* User Capsule */}
                      <div className="col-span-6 flex items-center gap-2.5">
                        <img
                          src={leader.avatar}
                          alt=""
                          className={`w-7 h-7 rounded-full border ${rank <= 3 ? 'border-cyber-cyan/40' : 'border-zinc-700'}`}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className={`text-sm font-bold truncate ${isMe ? 'text-cyber-cyan' : rank <= 3 ? 'text-white' : 'text-zinc-400'}`}>
                            {leader.name}
                            {isMe && <span className="ml-1.5 text-[8px] bg-cyber-cyan/10 text-cyber-cyan px-1 rounded border border-cyber-cyan/30">YOU</span>}
                          </span>
                          <span className={`text-[10px] flex items-center gap-1 ${tier.color}`}>
                            {tier.icon}
                            {tier.label}
                          </span>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="col-span-4 text-right font-mono font-black text-sm tracking-wider">
                        <span className={rank <= 3 ? tier.color : 'text-zinc-500'}>
                          {leader.score.toLocaleString()} XP
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default Leaderboard;
