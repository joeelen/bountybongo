import React, { useState } from 'react';
import { useGps } from '../lib/GpsContext';
import { useAuth } from '../lib/AuthContext';
import { Shield, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, UserCheck } from 'lucide-react';

const DevGpsSimulator: React.FC = () => {
  const { lat, lng, isSimulated, setCoordinates, toggleSimulation } = useGps();
  const { user } = useAuth();
  const [minimized, setMinimized] = useState(true);

  // Quick switch mock users helper
  const handleUserSwitch = async (username: string) => {
    try {
      const res = await fetch('/api/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      if (res.ok) {
        window.location.reload();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Trigger Wild Zone Event helper
  const handleForceWildEvent = async () => {
    try {
      const res = await fetch('/api/dev/trigger-wild-zone?force=true', {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (data.triggeredCount > 0) {
          alert(`⚡ Wild Zone Event triggered! Created match: ${data.matches.join(', ')}`);
        } else {
          alert('⚠️ No eligible clusters of 3+ Active users within 800m.');
        }
      } else {
        alert(`ERR: ${data.error || 'Failed to trigger event'}`);
      }
    } catch (e: any) {
      alert(`ERR: ${e.message}`);
    }
  };

  // Adjust coordinates by a small fraction (roughly 11 meters per 0.0001 degrees)
  const step = 0.0001;
  const walk = (direction: 'N' | 'S' | 'E' | 'W') => {
    let nextLat = lat;
    let nextLng = lng;

    switch (direction) {
      case 'N': nextLat += step; break;
      case 'S': nextLat -= step; break;
      case 'E': nextLng += step; break;
      case 'W': nextLng -= step; break;
    }
    setCoordinates(nextLat, nextLng, true);
  };

  if (!user) return null;

  return (
    <div className={`fixed top-[calc(9rem+env(safe-area-inset-top,0px))] left-0 md:top-auto md:bottom-4 md:right-4 md:left-auto z-30 transition-all duration-300 font-rajdhani`}>
      {minimized ? (
        <button
          onClick={() => setMinimized(false)}
          className="h-11 min-h-[44px] px-3 rounded-r-lg rounded-l-none bg-cyber-red/90 text-white flex items-center gap-1.5 border-r border-t border-b border-l-0 border-cyber-red shadow-red-glow hover:bg-cyber-red active:scale-95 transition-all md:w-12 md:h-12 md:min-h-[48px] md:rounded-full md:px-0 md:justify-center md:border"
          title="Open Dev GPS Simulator"
          aria-label="Open Dev GPS Simulator"
        >
          <Shield className="w-4 h-4 md:w-5 md:h-5 animate-pulse" />
          <span className="text-[10px] font-bold font-orbitron tracking-wider md:hidden">DEV</span>
        </button>
      ) : (
        <div className="ml-2 md:ml-0 w-72 max-w-[calc(100vw-1rem)] bg-zinc-950/95 border border-cyber-red/50 shadow-red-glow rounded-lg p-3 text-xs flex flex-col gap-3 max-h-[calc(100vh-10rem)] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-cyber-red/20 pb-2">
            <div className="flex items-center gap-1.5 text-cyber-red font-bold font-orbitron">
              <Shield className="w-4 h-4" />
              <span>DEV GRID MATRIX</span>
            </div>
            <button
              onClick={() => setMinimized(true)}
              className="text-zinc-500 hover:text-zinc-300 font-bold px-1"
            >
              [X]
            </button>
          </div>

          {/* User switcher */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider flex items-center gap-1">
              <UserCheck className="w-3 h-3 text-cyber-cyan" />
              Switch Mock Persona
            </span>
            <div className="grid grid-cols-4 gap-1 mt-1">
              {['host', 'hider1', 'hider2', 'seeker1'].map((username) => (
                <button
                  key={username}
                  onClick={() => handleUserSwitch(username)}
                  className={`py-1 rounded text-[10px] font-bold uppercase transition-colors ${
                    user.id === username
                      ? 'bg-cyber-red/20 text-cyber-red border border-cyber-red/50'
                      : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 border border-zinc-800'
                  }`}
                >
                  {username}
                </button>
              ))}
            </div>
          </div>

          {/* Dev Trigger Wild Event */}
          <button
            onClick={handleForceWildEvent}
            className="w-full py-1.5 bg-cyber-red text-white font-black uppercase text-[10px] rounded border border-cyber-red/30 shadow-red-glow/20 hover:bg-white hover:text-zinc-950 transition-colors animate-pulse"
          >
            ⚡ Force Wild Event
          </button>

          {/* GPS Info */}
          <div className="bg-zinc-900/60 rounded p-2 border border-cyber-border/40 font-mono">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] text-zinc-500">MODE:</span>
              <button
                onClick={() => toggleSimulation(!isSimulated)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  isSimulated
                    ? 'bg-cyber-red/10 text-cyber-red border border-cyber-red/30'
                    : 'bg-cyber-green/10 text-cyber-green border border-cyber-green/30'
                }`}
              >
                {isSimulated ? 'SIMULATED GPS' : 'REAL GPS'}
              </button>
            </div>
            <div className="text-[10px] text-zinc-300">
              LAT: <span className="text-cyber-cyan">{lat.toFixed(6)}</span>
            </div>
            <div className="text-[10px] text-zinc-300">
              LNG: <span className="text-cyber-cyan">{lng.toFixed(6)}</span>
            </div>
          </div>

          {/* Directional Pad */}
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
              Simulate Movement
            </span>
            <div className="relative w-24 h-24">
              <button
                onClick={() => walk('N')}
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-8 rounded bg-zinc-900 border border-cyber-red/30 text-cyber-red flex items-center justify-center hover:bg-cyber-red/20 active:scale-95"
                title="Walk North"
              >
                <ChevronUp className="w-5 h-5" />
              </button>
              <button
                onClick={() => walk('S')}
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-8 rounded bg-zinc-900 border border-cyber-red/30 text-cyber-red flex items-center justify-center hover:bg-cyber-red/20 active:scale-95"
                title="Walk South"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
              <button
                onClick={() => walk('W')}
                className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded bg-zinc-900 border border-cyber-red/30 text-cyber-red flex items-center justify-center hover:bg-cyber-red/20 active:scale-95"
                title="Walk West"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => walk('E')}
                className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 rounded bg-zinc-900 border border-cyber-red/30 text-cyber-red flex items-center justify-center hover:bg-cyber-red/20 active:scale-95"
                title="Walk East"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-zinc-950 border border-cyber-red/10 flex items-center justify-center text-[10px] text-zinc-600 font-bold">
                PAD
              </div>
            </div>
            <span className="text-[10px] text-zinc-500 italic mt-1 text-center">
              (1 step ≈ 11m. Map clicks can also warp you!)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevGpsSimulator;
