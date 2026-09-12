import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { useAuth } from '../lib/AuthContext';
import CustomMapContainer from '../components/MapContainer';
import { Info, RefreshCw, AlertTriangle, Radio } from 'lucide-react';

const LiveMap: React.FC = () => {
  const { profile, toggleDark } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  // Query active match for this user (Wild Zone sudden event polling)
  const { data: currentMatchData } = useQuery({
    queryKey: ['currentMatch'],
    queryFn: async () => {
      const res = await fetch('/api/matches/current');
      if (!res.ok) throw new Error('Failed to check current match');
      return res.json();
    },
    refetchInterval: 3000 // Poll every 3 seconds for Wild Zone matches
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['me'] });
    queryClient.invalidateQueries({ queryKey: ['currentMatch'] });
  };

  return (
    <div className="relative flex-1 w-full h-full overflow-hidden">
      {/* Full screen Map (Only showing the player) */}
      <div className="absolute inset-0 z-0">
        <CustomMapContainer markers={[]} />
      </div>

      {/* Floating HUD panels */}
      <div className="absolute top-4 left-4 z-10 flex flex-col gap-3 font-rajdhani max-w-sm w-80 pointer-events-none">
        {/* Profile Card Overlay */}
        <div className="cyber-card p-4 flex flex-col gap-2.5 pointer-events-auto shadow-cyan-glow/5">
          <div className="flex items-center justify-between border-b border-cyber-border pb-2">
            <span className="font-bold text-xs text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
              <Radio className={`w-3.5 h-3.5 ${profile?.isDark ? 'text-cyber-green animate-pulse' : 'text-zinc-500'}`} />
              WILD ZONE TELEMETRY
            </span>
            <button
              onClick={handleRefresh}
              className="text-zinc-500 hover:text-cyber-cyan transition-colors"
              title="Refresh telemetry"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>

          <div className="flex justify-between items-center text-sm">
            <span className="text-zinc-400">XP Pool:</span>
            <span className="text-cyber-cyan font-bold glow-cyan">{profile?.score ?? 0}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-zinc-400 text-xs">SYSTEM STATUS:</span>
            <button
              onClick={() => toggleDark(!profile?.isDark)}
              className={`px-2.5 py-0.5 rounded text-[10px] font-bold border uppercase transition-all duration-300 ${
                profile?.isDark
                  ? 'bg-cyber-green/10 text-cyber-green border-cyber-green/50 shadow-[0_0_10px_rgba(0,255,100,0.2)] animate-pulse'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white'
              }`}
            >
              {profile?.isDark ? '● ACTIVE' : '○ OFFLINE'}
            </button>
          </div>

          {profile?.isDark ? (
            <div className="text-[10px] text-cyber-green bg-cyber-green/5 border border-cyber-green/20 rounded p-1.5 flex items-center gap-1.5 leading-tight">
              <Radio className="w-3.5 h-3.5 shrink-0 animate-pulse" />
              <span>Active in pool. Awaiting daily ambient event triggers...</span>
            </div>
          ) : (
            <div className="text-[10px] text-zinc-500 bg-zinc-900/50 border border-zinc-800 rounded p-1.5 flex items-center gap-1.5 leading-tight">
              <Info className="w-3.5 h-3.5 shrink-0" />
              <span>Offline. Tap status to go Active for sector matching.</span>
            </div>
          )}
        </div>
      </div>

      {/* Wild Zone Auto-Match Cyberpunk Warning Modal */}
      {currentMatchData?.hasActiveMatch && (
        <div className="absolute inset-0 z-[50] flex items-center justify-center bg-zinc-950/80 backdrop-blur-md p-4 font-rajdhani">
          <div className="w-full max-w-md border-2 border-cyber-red bg-zinc-950 p-6 rounded-lg shadow-red-glow/20 flex flex-col items-center gap-4 text-center relative overflow-hidden">
            <div className="absolute -top-10 -left-10 w-28 h-28 bg-cyber-red/10 rounded-full blur-2xl"></div>
            <div className="absolute -bottom-10 -right-10 w-28 h-28 bg-cyber-cyan/10 rounded-full blur-2xl"></div>
            
            <AlertTriangle className="w-12 h-12 text-cyber-red animate-pulse" />
            
            <div className="flex flex-col gap-1">
              <span className="text-xs text-cyber-red font-black tracking-widest uppercase font-orbitron animate-pulse">
                CRITICAL UPLINK INITIATED
              </span>
              <h2 className="text-2xl font-black font-orbitron text-white tracking-wide uppercase">
                {currentMatchData.role === 'hider' ? "YOU'VE BEEN TAGGED" : "WILD ZONE ALERT"}
              </h2>
              <p className="text-sm text-zinc-400 mt-2">
                {currentMatchData.role === 'hider'
                  ? "You have been randomly selected as the local sector Hider. You have 3 minutes to disappear from the radar!"
                  : "An active hider has been detected within 800m of your location. Intercept coordinates immediately!"
                }
              </p>
            </div>

            <button
              onClick={() => {
                sessionStorage.setItem('active_match_id', currentMatchData.matchId);
                setLocation('/matches');
              }}
              className="w-full py-3 mt-2 bg-cyber-red hover:bg-white hover:text-zinc-950 text-white font-black font-orbitron tracking-widest text-sm rounded shadow-red-glow hover:scale-[1.01] active:scale-95 transition-all"
            >
              {currentMatchData.role === 'hider' ? "START EVASION ROUTINE" : "ENGAGE HUNTER SCAN"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveMap;
