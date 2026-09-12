import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/AuthContext';
import { useGps } from '../lib/GpsContext';
import { useToast } from '../lib/ToastContext';
import { GameEffects } from '../lib/GameEffects';
import CustomMapContainer from '../components/MapContainer';
import { 
  Plus, LogIn, Settings, Users, Shield, 
  AlertCircle, Bomb, Copy, Award, Home, MessageSquare, Crosshair, Clock, X
} from 'lucide-react';

const Matches: React.FC = () => {
  const { user, profile } = useAuth();
  const { lat, lng, isSimulated, accuracy } = useGps();
  const { success, error: toastError, warn, info } = useToast();
  const queryClient = useQueryClient();

  const chatEndRef = useRef<HTMLDivElement>(null);
  const prevStatusRef = useRef<string | null>(null);

  const [activeMatchId, setActiveMatchId] = useState<string | null>(() => {
    return sessionStorage.getItem('active_match_id');
  });

  const [joinCode, setJoinCode] = useState('');
  const [matchError, setMatchError] = useState('');
  const [hostSettingsOpen, setHostSettingsOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [lastSeenMessageCount, setLastSeenMessageCount] = useState(0);
  const [mapRecenterCount, setMapRecenterCount] = useState(0);
  const [isRadarScanning, setIsRadarScanning] = useState(false);

  // Host settings state
  const [hidingDuration, setHidingDuration] = useState(120);
  const [revealInterval, setRevealInterval] = useState(120);
  const [matchDuration, setMatchDuration] = useState(900);
  const [catchRadius, setCatchRadius] = useState(30);
  const [captureRadius, setCaptureRadius] = useState(4);
  const [bombArmingTime, setBombArmingTime] = useState(60);
  const [bombBlastRadius, setBombBlastRadius] = useState(25);
  const [bombHiddenDuration, setBombHiddenDuration] = useState(45);
  const [boundaryRadius, setBoundaryRadius] = useState(500);
  const [zoneShrinkInterval, setZoneShrinkInterval] = useState(120);
  const [zoneShrinkAmount, setZoneShrinkAmount] = useState(100);

  // Poll current active match state (every 1 second)
  const { data: matchData } = useQuery({
    queryKey: ['match', activeMatchId],
    queryFn: async () => {
      if (!activeMatchId) return null;
      const res = await fetch(`/api/matches/${activeMatchId}`);
      if (!res.ok) {
        sessionStorage.removeItem('active_match_id');
        setActiveMatchId(null);
        throw new Error('Match not found');
      }
      return res.json();
    },
    enabled: !!activeMatchId,
    refetchInterval: 1000 // Poll active match states every 1 second
  });

  // Query server for rejoinable matches in progress
  const { data: rejoinableMatches = [] } = useQuery({
    queryKey: ['rejoinableMatches'],
    queryFn: async () => {
      const res = await fetch('/api/matches');
      if (!res.ok) throw new Error('Failed to load active matches');
      return res.json();
    },
    refetchInterval: 5000
  });

  // Query match chat messages
  const { data: chatMessages = [] } = useQuery({
    queryKey: ['matchChat', activeMatchId],
    queryFn: async () => {
      if (!activeMatchId) return [];
      const res = await fetch(`/api/social/messages?matchId=${activeMatchId}`);
      if (!res.ok) throw new Error('Failed to load chat messages');
      return res.json();
    },
    enabled: !!activeMatchId,
    refetchInterval: 1000
  });

  // Save active match ID to session storage
  useEffect(() => {
    if (activeMatchId) {
      sessionStorage.setItem('active_match_id', activeMatchId);
    } else {
      sessionStorage.removeItem('active_match_id');
    }
  }, [activeMatchId]);

  // Auto-scroll chat when new messages arrive or chat is opened
  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isChatOpen]);

  // Synchronize lastSeenMessageCount when chat is expanded
  useEffect(() => {
    if (isChatOpen && chatMessages.length > 0) {
      setLastSeenMessageCount(chatMessages.length);
    }
  }, [isChatOpen, chatMessages.length]);

  // Detect phase transitions and fire toasts
  const currentStatus = matchData?.match?.status;
  useEffect(() => {
    if (!currentStatus || !prevStatusRef.current) {
      prevStatusRef.current = currentStatus ?? null;
      return;
    }
    if (prevStatusRef.current === 'waiting' && currentStatus === 'hiding') {
      info('Match Started!', 'Hiding phase has begun — find your hiding spot!');
    } else if (prevStatusRef.current === 'hiding' && currentStatus === 'hunting') {
      warn('Hunting Phase Begins!', 'GPS reveals are now active. Seekers, hunt your targets!');
    } else if (prevStatusRef.current === 'hunting' && currentStatus === 'finished') {
      success('Match Over!', 'The operation has concluded. Check the results screen.');
    }
    prevStatusRef.current = currentStatus;
  }, [currentStatus]);

  // Mutations
  const createMatchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/matches', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to create match');
      return res.json();
    },
    onSuccess: (data) => {
      setActiveMatchId(data.id);
      queryClient.invalidateQueries({ queryKey: ['match', data.id] });
      info('Match Created', `Code: ${data.id} — Share it with friends!`);
    },
    onError: () => toastError('Match creation failed', 'Check server connection.')
  });

  const joinMatchMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: 'hider' | 'seeker' }) => {
      const res = await fetch(`/api/matches/${id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to join match');
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      setActiveMatchId(variables.id);
      setJoinCode('');
      setMatchError('');
      queryClient.invalidateQueries({ queryKey: ['match', variables.id] });
      info('Joined Match', `You joined as ${variables.role}. Awaiting host to start.`);
    },
    onError: (err: any) => {
      setMatchError(err.message);
      toastError('Join Failed', err.message);
    }
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: any) => {
      const res = await fetch(`/api/matches/${activeMatchId}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      if (!res.ok) throw new Error('Failed to update settings');
      return res.json();
    },
    onSuccess: () => {
      setHostSettingsOpen(false);
      queryClient.invalidateQueries({ queryKey: ['match', activeMatchId] });
    }
  });

  const startMatchMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/matches/${activeMatchId}/start`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start match');
      return res.json();
    },
    onSuccess: () => {
      GameEffects.playRadarPing();
      queryClient.invalidateQueries({ queryKey: ['match', activeMatchId] });
      info('Operation Deployed!', 'Hiding phase has started. Everyone scatter!');
    },
    onError: () => toastError('Could not start match')
  });

  const placeBombMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/matches/${activeMatchId}/bomb`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng })
      });
      if (!res.ok) throw new Error('Failed to place bomb');
      return res.json();
    },
    onSuccess: () => {
      GameEffects.playBombDeployed();
      queryClient.invalidateQueries({ queryKey: ['match', activeMatchId] });
    }
  });


  const sendChatMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch('/api/social/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId: activeMatchId, content })
      });
      if (!res.ok) throw new Error('Failed to send message');
      return res.json();
    },
    onSuccess: () => {
      setChatInput('');
      queryClient.invalidateQueries({ queryKey: ['matchChat', activeMatchId] });
    },
    onError: () => toastError('Message failed', 'Could not send your transmission.')
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChatMessageMutation.mutate(chatInput.trim());
  };

  // UI action handlers
  const handleCreateMatch = () => {
    createMatchMutation.mutate();
  };

  const handleJoinByCode = (role: 'hider' | 'seeker') => {
    if (!joinCode.trim()) return;
    joinMatchMutation.mutate({ id: joinCode.trim().toUpperCase(), role });
  };

  const handleSwitchRole = (role: 'hider' | 'seeker') => {
    if (!activeMatchId) return;
    joinMatchMutation.mutate({ id: activeMatchId, role });
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettingsMutation.mutate({
      hidingDuration,
      revealInterval,
      matchDuration,
      catchRadius,
      captureRadius,
      bombArmingTime,
      bombBlastRadius,
      bombHiddenDuration,
      boundaryRadius,
      zoneShrinkInterval,
      zoneShrinkAmount
    });
  };

  const handleStartMatch = () => {
    startMatchMutation.mutate();
  };

  const handlePlaceBomb = () => {
    placeBombMutation.mutate();
  };


  const handleExitMatch = () => {
    setIsChatOpen(false);
    sessionStorage.removeItem('active_match_id');
    setActiveMatchId(null);
  };

  const handleRadarScan = () => {
    GameEffects.playRadarPing();
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(50);
      } catch (e) {}
    }
    setIsRadarScanning(true);
    setTimeout(() => setIsRadarScanning(false), 600);
  };

  const copyInviteCode = () => {
    if (!activeMatchId) return;
    navigator.clipboard.writeText(activeMatchId);
    alert(`Invite Code: ${activeMatchId} copied to clipboard!`);
  };

  // Helper getters
  const match = matchData?.match;
  const participants = matchData?.participants || [];
  const bombsList = matchData?.bombs || [];
  const myParticipant = participants.find((p: any) => p.userId === user?.id);
  const isHost = match?.hostId === user?.id;

  // Active game timers calculation
  const getTimers = () => {
    if (!match || match.status === 'waiting' || match.status === 'finished') {
      return { phase: '', timeStr: '', secondsLeft: 0 };
    }

    const now = Date.now();
    const hidingEnds = new Date(match.hidingEndsAt).getTime();
    const huntingEnds = new Date(match.huntingEndsAt).getTime();

    if (now < hidingEnds) {
      const left = Math.max(0, Math.floor((hidingEnds - now) / 1000));
      const mins = Math.floor(left / 60);
      const secs = left % 60;
      return { 
        phase: 'HIDING PHASE', 
        timeStr: `${mins}:${secs.toString().padStart(2, '0')}`,
        secondsLeft: left
      };
    } else {
      const left = Math.max(0, Math.floor((huntingEnds - now) / 1000));
      const mins = Math.floor(left / 60);
      const secs = left % 60;

      // Calculate reveal interval countdown
      const huntingElapsed = now - hidingEnds;
      const intervalMs = match.revealInterval * 1000;
      const revealSecondsLeft = Math.max(0, Math.floor((intervalMs - (huntingElapsed % intervalMs)) / 1000));
      const rMins = Math.floor(revealSecondsLeft / 60);
      const rSecs = revealSecondsLeft % 60;

      return {
        phase: 'HUNTING PHASE',
        timeStr: `${mins}:${secs.toString().padStart(2, '0')}`,
        secondsLeft: left,
        revealTimeStr: `${rMins}:${rSecs.toString().padStart(2, '0')}`,
        revealSecondsLeft
      };
    }
  };

  const timers = getTimers();

  // Find nearest uncaught hider (for proximity indicator — auto-capture runs on server)
  const getNearestHider = () => {
    if (!myParticipant || myParticipant.role !== 'seeker' || match?.status !== 'hunting') return null;
    const capRadius = match.captureRadius ?? match.catchRadius ?? 4;
    let nearest: any = null;
    let nearestDist = Infinity;
    participants.forEach((p: any) => {
      if (p.role !== 'hider' || p.isCaught || p.lat == null) return;
      const dist = getDistance(lat, lng, p.lat, p.lng);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = { ...p, distance: dist };
      }
    });
    if (!nearest) return null;
    return { ...nearest, captureRadius: capRadius, inRange: nearestDist <= capRadius };
  };

  const nearestHider = getNearestHider();

  // Haversine helper
  function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // --- RENDERING VIEWS ---

  // 1. OUT OF MATCH VIEW (Dashboard Lobby joiner)
  if (!activeMatchId) {
    return (
      <div className="flex-1 w-full h-full grid-bg p-4 overflow-y-auto font-rajdhani flex flex-col items-center pt-8">
        <div className="w-full max-w-2xl flex flex-col gap-6">
          <div className="text-center md:text-left border-b border-cyber-border pb-3 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black font-orbitron text-cyber-cyan glow-cyan tracking-wider">
                MATCH CONTROL GRID
              </h1>
              <p className="text-xs text-zinc-500 uppercase mt-0.5">
                Join private matches or initialize custom hide & seek instances
              </p>
            </div>
            <button
              onClick={handleCreateMatch}
              disabled={createMatchMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-cyber-cyan text-zinc-950 hover:bg-white text-xs font-black uppercase rounded shadow-cyan-glow transition-all duration-300"
            >
              <Plus className="w-4 h-4" />
              Create Match
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Join Match panel */}
            <div className="cyber-card p-6 flex flex-col gap-4 border-cyber-cyan/30">
              <span className="font-bold text-sm text-cyber-cyan tracking-wider uppercase font-orbitron border-b border-cyber-border pb-2 flex items-center gap-2">
                <LogIn className="w-4 h-4" />
                Secure Uplink Entry
              </span>

              <div className="flex flex-col gap-1.5 mt-2">
                <label className="text-[10px] text-zinc-500 uppercase font-black tracking-wider">
                  Invite Code (6 characters)
                </label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="EX: A1B2C3"
                  maxLength={6}
                  className="bg-zinc-900 border border-cyber-border rounded px-4 py-2.5 text-cyber-cyan font-mono text-center text-lg tracking-widest focus:outline-none focus:border-cyber-cyan"
                />
              </div>

              {matchError && (
                <span className="text-xs text-cyber-red font-mono font-bold animate-pulse">
                  ERR: {matchError}
                </span>
              )}

              <div className="grid grid-cols-2 gap-3 mt-2">
                <button
                  onClick={() => handleJoinByCode('hider')}
                  disabled={joinMatchMutation.isPending || !joinCode}
                  className="py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-cyber-green/40 text-cyber-green hover:border-cyber-green text-xs font-black uppercase rounded transition-all active:scale-95"
                >
                  Join as Hider
                </button>
                <button
                  onClick={() => handleJoinByCode('seeker')}
                  disabled={joinMatchMutation.isPending || !joinCode}
                  className="py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-cyber-cyan/40 text-cyber-cyan hover:border-cyber-cyan text-xs font-black uppercase rounded transition-all active:scale-95"
                >
                  Join as Seeker
                </button>
              </div>
            </div>

            {/* Rejoin / Active Matches */}
            <div className="cyber-card p-6 flex flex-col gap-4">
              <span className="font-bold text-sm text-zinc-400 tracking-wider uppercase font-orbitron border-b border-cyber-border pb-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-cyber-orange" />
                Active Grids Radar
              </span>

              {rejoinableMatches.length === 0 ? (
                <div className="text-zinc-600 text-xs text-center font-mono py-8">
                  NO ACTIVE GAME GRIDS ENCOUNTERED.
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                  {rejoinableMatches.map((m: any) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 rounded bg-zinc-900/60 border border-cyber-border hover:border-cyber-orange/40 transition-colors"
                    >
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-zinc-300">MATCH: {m.id}</span>
                        <span className="text-[10px] text-cyber-orange uppercase font-black tracking-wide flex items-center gap-1 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyber-orange animate-ping"></span>
                          Status: {m.status}
                        </span>
                      </div>
                      <button
                        onClick={() => setActiveMatchId(m.id)}
                        className="px-3 py-1 bg-cyber-orange text-zinc-950 text-xs font-black uppercase rounded hover:bg-white transition-all active:scale-95 shadow-orange-glow/20"
                      >
                        Rejoin
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading Match details state
  if (!match) {
    return (
      <div className="flex-1 grid-bg flex flex-col items-center justify-center font-mono text-zinc-500 animate-pulse">
        DOWNLINKING MATCH PACKETS... STAND BY.
      </div>
    );
  }

  // 2. LOBBY VIEW (status === 'waiting')
  if (match.status === 'waiting') {
    return (
      <div className="flex-1 w-full h-full grid-bg p-4 overflow-y-auto font-rajdhani flex flex-col items-center pt-8">
        <div className="w-full max-w-3xl flex flex-col gap-6">
          
          {/* Header */}
          <div className="border-b border-cyber-border pb-3 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xs text-cyber-cyan uppercase font-bold tracking-widest flex items-center gap-1">
                LOBBY SECURED
              </span>
              <h1 className="text-2xl font-black font-orbitron text-cyber-cyan tracking-wider flex items-center gap-2 mt-0.5">
                MATCH INSTANCE: {match.id}
                <button onClick={copyInviteCode} className="text-zinc-500 hover:text-cyber-cyan transition-colors" title="Copy code">
                  <Copy className="w-4 h-4" />
                </button>
              </h1>
            </div>
            <button
              onClick={handleExitMatch}
              className="text-zinc-500 hover:text-cyber-red text-xs uppercase font-bold font-orbitron border border-zinc-700/60 hover:border-cyber-red/50 rounded px-3 py-1.5 transition-all"
            >
              Exit Lobby
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Joined Players */}
            <div className="cyber-card p-4 md:col-span-2 flex flex-col gap-4">
              <span className="font-bold text-xs text-zinc-400 uppercase tracking-widest flex items-center gap-1.5 border-b border-cyber-border pb-2">
                <Users className="w-4 h-4 text-cyber-cyan" />
                Joined Agents ({participants.length}/10)
              </span>

              <div className="flex flex-col gap-2 mt-1">
                {participants.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-cyber-border">
                    <div className="flex items-center gap-2">
                      <img src={p.avatar} alt={p.name} className="w-6 h-6 rounded-full border border-cyber-border" />
                      <span className="text-xs font-bold">{p.name}</span>
                      {p.userId === match.hostId && (
                        <span className="text-[10px] bg-cyber-cyan/10 text-cyber-cyan px-1.5 py-0.5 rounded border border-cyber-cyan/30">
                          HOST
                        </span>
                      )}
                    </div>
                    
                    <div>
                      {p.userId === user?.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleSwitchRole('hider')}
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-all ${
                              p.role === 'hider'
                                ? 'bg-cyber-green text-zinc-950 border border-cyber-green shadow-green-glow/30'
                                : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:text-zinc-400'
                            }`}
                          >
                            Hider
                          </button>
                          <button
                            onClick={() => handleSwitchRole('seeker')}
                            className={`px-2 py-0.5 rounded text-[10px] font-black uppercase transition-all ${
                              p.role === 'seeker'
                                ? 'bg-cyber-cyan text-zinc-950 border border-cyber-cyan shadow-cyan-glow/30'
                                : 'bg-zinc-800 text-zinc-500 border border-zinc-700 hover:text-zinc-400'
                            }`}
                          >
                            Seeker
                          </button>
                        </div>
                      ) : (
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          p.role === 'hider' ? 'bg-cyber-green/10 text-cyber-green border border-cyber-green/20' : 'bg-cyber-cyan/10 text-cyber-cyan border border-cyber-cyan/20'
                        }`}>
                          {p.role}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Host Start controls */}
              <div className="mt-4 border-t border-cyber-border pt-4 flex flex-col gap-2">
                {isHost ? (
                  <button
                    onClick={handleStartMatch}
                    disabled={startMatchMutation.isPending}
                    className="w-full py-3 bg-cyber-cyan text-zinc-950 font-black font-orbitron tracking-widest text-sm rounded shadow-cyan-glow hover:bg-white hover:scale-[1.01] active:scale-95 transition-all"
                  >
                    DEPLOY OPERATION (START MATCH)
                  </button>
                ) : (
                  <div className="text-center text-xs text-zinc-500 font-mono animate-pulse py-2">
                    AWAITING HOST UPLINK INITIATION...
                  </div>
                )}
              </div>
            </div>

            {/* Match Configurations */}
            <div className="cyber-card p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-cyber-border pb-2">
                <span className="font-bold text-xs text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Settings className="w-4 h-4 text-cyber-cyan" />
                  Parameters
                </span>
                {isHost && (
                  <button
                    onClick={() => {
                      setHidingDuration(match.hidingDuration);
                      setRevealInterval(match.revealInterval);
                      setMatchDuration(match.matchDuration);
                      setCatchRadius(match.catchRadius);
                      setCaptureRadius(match.captureRadius ?? 4);
                      setBombArmingTime(match.bombArmingTime);
                      setBombBlastRadius(match.bombBlastRadius);
                      setBombHiddenDuration(match.bombHiddenDuration ?? 45);
                      setBoundaryRadius(match.boundaryRadius || 500);
                      setZoneShrinkInterval(match.zoneShrinkInterval ?? 120);
                      setZoneShrinkAmount(match.zoneShrinkAmount ?? 100);
                      setHostSettingsOpen(!hostSettingsOpen);
                    }}
                    className="text-cyber-cyan hover:text-white text-xs font-bold"
                  >
                    {hostSettingsOpen ? 'Cancel' : 'Edit'}
                  </button>
                )}
              </div>

              {hostSettingsOpen ? (
                <form onSubmit={handleSaveSettings} className="flex flex-col gap-3.5 mt-1 font-mono text-[10px]">
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 uppercase font-black">Hiding Duration (s)</label>
                    <input type="number" value={hidingDuration} onChange={(e) => setHidingDuration(Number(e.target.value))} className="bg-zinc-900 border border-cyber-border rounded px-2 py-1 text-cyber-cyan focus:outline-none focus:border-cyber-cyan" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 uppercase font-black">Reveal Interval (s)</label>
                    <input type="number" value={revealInterval} onChange={(e) => setRevealInterval(Number(e.target.value))} className="bg-zinc-900 border border-cyber-border rounded px-2 py-1 text-cyber-cyan focus:outline-none focus:border-cyber-cyan" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 uppercase font-black">Match Duration (s)</label>
                    <input type="number" value={matchDuration} onChange={(e) => setMatchDuration(Number(e.target.value))} className="bg-zinc-900 border border-cyber-border rounded px-2 py-1 text-cyber-cyan focus:outline-none focus:border-cyber-cyan" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 uppercase font-black">Auto-Capture Radius (m)</label>
                    <input type="number" min={1} max={50} value={captureRadius} onChange={(e) => setCaptureRadius(Number(e.target.value))} className="bg-zinc-900 border border-cyber-border rounded px-2 py-1 text-cyber-cyan focus:outline-none focus:border-cyber-cyan" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 uppercase font-black">Bomb Arming Time (s)</label>
                    <input type="number" value={bombArmingTime} onChange={(e) => setBombArmingTime(Number(e.target.value))} className="bg-zinc-900 border border-cyber-border rounded px-2 py-1 text-cyber-cyan focus:outline-none focus:border-cyber-cyan" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 uppercase font-black">Bomb Blast Radius (m)</label>
                    <input type="number" value={bombBlastRadius} onChange={(e) => setBombBlastRadius(Number(e.target.value))} className="bg-zinc-900 border border-cyber-border rounded px-2 py-1 text-cyber-cyan focus:outline-none focus:border-cyber-cyan" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 uppercase font-black">Bomb Hidden Duration (s)</label>
                    <input type="number" min={0} max={120} value={bombHiddenDuration} onChange={(e) => setBombHiddenDuration(Number(e.target.value))} className="bg-zinc-900 border border-cyber-border rounded px-2 py-1 text-cyber-cyan focus:outline-none focus:border-cyber-cyan" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 uppercase font-black">Boundary Radius (m)</label>
                    <input type="number" value={boundaryRadius} onChange={(e) => setBoundaryRadius(Number(e.target.value))} className="bg-zinc-900 border border-cyber-border rounded px-2 py-1 text-cyber-cyan focus:outline-none focus:border-cyber-cyan" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 uppercase font-black">Zone Shrink Every (s)</label>
                    <input type="number" min={30} value={zoneShrinkInterval} onChange={(e) => setZoneShrinkInterval(Number(e.target.value))} className="bg-zinc-900 border border-cyber-border rounded px-2 py-1 text-cyber-cyan focus:outline-none focus:border-cyber-cyan" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-zinc-500 uppercase font-black">Zone Shrink Amount (m)</label>
                    <input type="number" min={0} value={zoneShrinkAmount} onChange={(e) => setZoneShrinkAmount(Number(e.target.value))} className="bg-zinc-900 border border-cyber-border rounded px-2 py-1 text-cyber-cyan focus:outline-none focus:border-cyber-cyan" />
                  </div>

                  <button type="submit" disabled={updateSettingsMutation.isPending} className="w-full py-2 bg-cyber-cyan text-zinc-950 font-bold uppercase rounded mt-2 hover:bg-white transition-all active:scale-95">
                    Commit Settings
                  </button>
                </form>
              ) : (
                <div className="flex flex-col gap-2.5 mt-1 text-xs">
                  <div className="flex justify-between border-b border-zinc-900 pb-1">
                    <span className="text-zinc-500">Hiding Phase:</span>
                    <span className="font-bold">{match.hidingDuration} s</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900 pb-1">
                    <span className="text-zinc-500">Reveal Interval:</span>
                    <span className="font-bold">{match.revealInterval} s</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900 pb-1">
                    <span className="text-zinc-500">Match Limit:</span>
                    <span className="font-bold">{Math.round(match.matchDuration / 60)} min</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900 pb-1">
                    <span className="text-zinc-500">Auto-Capture:</span>
                    <span className="font-bold text-cyber-red">{match.captureRadius ?? 4} m</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900 pb-1">
                    <span className="text-zinc-500">Bomb Fuse:</span>
                    <span className="font-bold">{match.bombArmingTime} s</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900 pb-1">
                    <span className="text-zinc-500">Bomb Blast:</span>
                    <span className="font-bold">{match.bombBlastRadius} m</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900 pb-1">
                    <span className="text-zinc-500">Bomb Hidden:</span>
                    <span className="font-bold">{match.bombHiddenDuration ?? 45} s</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900 pb-1">
                    <span className="text-zinc-500">Boundary Area:</span>
                    <span className="font-bold text-cyber-cyan">{match.boundaryRadius || 500} m</span>
                  </div>
                  <div className="flex justify-between border-b border-zinc-900 pb-1">
                    <span className="text-zinc-500">Zone Shrinks:</span>
                    <span className="font-bold">every {match.zoneShrinkInterval ?? 120} s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Shrink Amount:</span>
                    <span className="font-bold">{match.zoneShrinkAmount ?? 100} m</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. GAME RUNNING VIEWS (status === 'hiding' or 'hunting')
  if (match.status === 'hiding' || match.status === 'hunting') {
    return (
      <div className="flex-1 w-full h-full relative overflow-hidden flex flex-col font-rajdhani">
        {/* Full screen Map in background */}
        <div className="absolute inset-0 z-0">
          <CustomMapContainer
            recenterTrigger={mapRecenterCount}
            showRecenterButton={false}
            markers={participants
              .filter((p: any) => p.userId !== user?.id)
              .map((p: any) => {
                const isCurrentSeeker = myParticipant?.role === 'seeker';
                if (p.role === 'seeker') {
                  return {
                    id: p.userId,
                    name: p.name,
                    lat: p.lat,
                    lng: p.lng,
                    role: p.role,
                    isSpecial: false
                  };
                } else {
                  return {
                    id: p.userId,
                    name: p.name,
                    lat: isCurrentSeeker ? p.revealedLat : p.lat,
                    lng: isCurrentSeeker ? p.revealedLng : p.lng,
                    role: p.role,
                    isSpecial: false
                  };
                }
              })}
            bombs={bombsList.filter((b: any) => !b.hidden).map((b: any) => ({
              id: b.id,
              lat: b.lat,
              lng: b.lng,
              radius: b.radius,
              isActive: b.isActive
            }))}
            boundary={{
              lat: match.boundaryCenterLat || 59.9139,
              lng: match.boundaryCenterLng || 10.7522,
              radius: match.currentZoneRadius ?? match.boundaryRadius ?? 500
            }}
          />
        </div>

        {/* Elevated Map Recenter Button (Lifted out of z-0 stacking context into HUD z-30) */}
        <button
          onClick={() => setMapRecenterCount(c => c + 1)}
          className="absolute top-20 right-2 z-30 w-11 h-11 rounded-full bg-zinc-950/90 border border-cyber-cyan text-cyber-cyan shadow-cyan-glow hover:bg-cyber-cyan hover:text-zinc-950 transition-all active:scale-95 flex items-center justify-center pointer-events-auto"
          title="Center Map on Me"
          aria-label="Center Map on My Location"
        >
          <Crosshair className="w-5 h-5" />
        </button>

        {/* Full-Width Responsive Top Telemetry Header (Feature F2) */}
        <div className="absolute top-2 left-2 right-2 z-20 pointer-events-auto">
          <div className="cyber-card bg-zinc-950/95 backdrop-blur-md border border-cyber-cyan/40 px-2.5 py-1.5 shadow-cyan-glow/10 flex flex-col justify-between h-[58px] max-h-[64px] overflow-hidden">
            {/* Row 1: Phase Badge, Match ID, Next GPS Reveal, Match Clock */}
            <div className="flex items-center justify-between gap-2 h-[21px]">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-black text-cyber-cyan glow-cyan flex items-center gap-1 uppercase font-orbitron text-[11px] md:text-xs truncate">
                  <Shield className="w-3 h-3 md:w-3.5 md:h-3.5 text-cyber-cyan shrink-0" />
                  {timers.phase === 'HUNTING PHASE' ? 'HUNTING' : timers.phase === 'HIDING PHASE' ? 'HIDING' : (timers.phase || match.status?.toUpperCase())}
                </span>
                <span className="font-mono text-zinc-400 font-bold uppercase tracking-widest text-[10px] md:text-xs bg-zinc-900 border border-zinc-800 px-1 py-0.5 rounded shrink-0">
                  ID:{match.id.substring(0, 4).toUpperCase()}
                </span>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {match.status === 'hunting' && timers.revealTimeStr && (
                  <div className="flex items-center gap-1 text-[10px] md:text-xs font-mono font-bold text-cyber-yellow glow-yellow bg-cyber-yellow/10 border border-cyber-yellow/30 px-1 py-0.5 rounded">
                    <span className="text-[10px] uppercase tracking-wider text-cyber-yellow/80">GPS:</span>
                    <span>{timers.revealTimeStr}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 font-mono font-black text-white text-xs md:text-sm tracking-wider">
                  <Clock className="w-3 h-3 text-zinc-400 shrink-0" />
                  <span>{timers.timeStr}</span>
                </div>
              </div>
            </div>

            {/* Row 2: Role Badge & Status, GPS Accuracy Indicator, Score/XP Counter */}
            <div className="flex items-center justify-between gap-1.5 h-[21px] border-t border-zinc-900/80 pt-1">
              <div className="flex items-center gap-1 min-w-0">
                <span className={`font-black uppercase text-[10px] md:text-xs px-1.5 py-0.5 rounded border truncate ${
                  myParticipant?.isCaught
                    ? 'bg-zinc-800/80 text-zinc-400 border-zinc-700 line-through'
                    : myParticipant?.role === 'seeker'
                      ? 'bg-cyber-cyan/10 text-cyber-cyan border-cyber-cyan/30'
                      : 'bg-cyber-green/10 text-cyber-green border-cyber-green/30'
                }`}>
                  {myParticipant?.role} {myParticipant?.isCaught ? '(CAPTURED)' : '(ACTIVE)'}
                </span>
              </div>

              <div className="flex items-center gap-1 text-[10px] md:text-xs font-mono shrink-0">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isSimulated || accuracy == null ? 'bg-cyber-yellow' : 'bg-cyber-green shadow-green-glow animate-pulse'}`} />
                <span className={`font-bold ${isSimulated || accuracy == null ? 'text-cyber-yellow' : 'text-cyber-green'}`}>
                  {isSimulated || accuracy == null ? 'GPS: SIMULATED' : `±${Math.round(accuracy)}m`}
                </span>
              </div>

              <div className="flex items-center gap-1 font-mono font-bold text-cyber-yellow text-[10px] md:text-xs shrink-0">
                <Award className="w-3 h-3 text-cyber-yellow shrink-0" />
                <span>{(myParticipant?.score ?? profile?.score ?? 0).toLocaleString()} XP</span>
              </div>
            </div>
          </div>
        </div>

        {/* Thumb-Friendly Slide-Over Chat Drawer (F3) */}
        {isChatOpen && (
          <div className="fixed inset-x-0 bottom-0 z-40 max-h-[60vh] flex flex-col bg-zinc-950/95 border-t border-cyber-cyan/50 backdrop-blur-md transition-transform shadow-2xl pointer-events-auto">
            {/* Drawer Header */}
            <div className="border-b border-cyber-border/80 px-3 py-2 flex items-center justify-between bg-zinc-900/60">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-cyber-cyan shrink-0" />
                <span className="font-orbitron font-black text-xs md:text-sm text-cyber-cyan tracking-wider uppercase">
                  Grid Comms
                </span>
                <span className="text-[10px] font-mono text-zinc-500">
                  ({chatMessages.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                className="w-11 h-11 flex items-center justify-center rounded text-zinc-400 hover:text-cyber-cyan hover:bg-zinc-900 active:scale-95 transition-all pointer-events-auto"
                title="Dismiss Comms"
                aria-label="Dismiss Comms"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Message Scroll Container */}
            <div className="flex-1 overflow-y-auto flex flex-col gap-1 pr-1 font-mono text-xs md:text-sm text-zinc-400 p-3 scrollbar-thin">
              {chatMessages.length === 0 ? (
                <div className="text-zinc-600 text-center italic py-8">No comms.</div>
              ) : (
                chatMessages.map((msg: any) => (
                  <div key={msg.id} className="break-words overflow-hidden leading-tight bg-zinc-900/40 p-1.5 rounded border border-zinc-900/80">
                    <strong className="text-cyber-cyan mr-1.5">{msg.senderName}:</strong>
                    <span className="text-zinc-200">{msg.content}</span>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Thumb-Friendly Chat Input Bar */}
            <form onSubmit={handleSendMessage} className="flex gap-2 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] bg-zinc-950 border-t border-cyber-border/60">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="TRANSMIT MESSAGE..."
                className="flex-1 min-h-[44px] text-base bg-zinc-900 border border-cyber-border rounded px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyber-cyan font-mono"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || sendChatMessageMutation.isPending}
                className="min-h-[44px] min-w-[48px] px-4 bg-cyber-cyan text-zinc-950 text-xs md:text-sm font-black uppercase rounded hover:bg-white active:scale-95 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center justify-center shrink-0 shadow-cyan-glow/20"
              >
                Send
              </button>
            </form>
          </div>
        )}

        {/* Bottom Game HUD Controller strip (Feature F5 & Contract Compliance) */}
        <div className="absolute bottom-2 left-2 right-2 md:bottom-4 md:left-4 md:right-4 z-20 pointer-events-none flex flex-col items-center">
          <div className="w-full max-w-2xl cyber-card p-2 md:p-3 pointer-events-auto border-cyber-cyan/30 flex flex-col sm:flex-row gap-2 md:gap-3 items-center justify-between shadow-cyan-glow/10">
            
            {/* Left/Middle: Game details and participants status */}
            <div className="flex-1 w-full text-left overflow-x-auto">
              <span className="block text-[10px] md:text-xs text-zinc-500 uppercase font-black tracking-wider border-b border-zinc-950 pb-1">
                ROSTER ({participants.length})
              </span>
              <div className="flex gap-1.5 md:gap-2 mt-1 md:mt-1.5 pb-0.5 overflow-x-auto scrollbar-thin">
                {participants.map((p: any) => (
                  <div key={p.id} className="flex items-center gap-1.5 bg-zinc-900/60 border border-cyber-border rounded-full pl-1.5 pr-2.5 py-0.5 shrink-0 min-w-[70px]">
                    <div className="relative">
                      <img src={p.avatar} className="w-4 h-4 md:w-5 md:h-5 rounded-full border border-cyber-border bg-zinc-950" alt="" />
                      <span className={`absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 md:w-2 md:h-2 rounded-full border border-zinc-950 ${
                        p.role === 'seeker'
                          ? 'bg-cyber-cyan shadow-cyan-glow/20'
                          : p.isCaught
                          ? 'bg-zinc-600'
                          : 'bg-cyber-green shadow-green-glow/20'
                      }`} />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-[10px] md:text-xs font-bold leading-tight max-w-[75px] md:max-w-[90px] truncate">{p.name}</span>
                      <span className={`text-[10px] leading-none uppercase ${p.isCaught ? 'text-zinc-500' : p.role === 'seeker' ? 'text-cyber-cyan' : 'text-cyber-green'}`}>
                        {p.role === 'seeker' ? 'Seeker' : p.isCaught ? 'Caught' : 'Active'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Side: Quick Action buttons (Drop Bomb, Radar Scanner, Comms Toggle, Exit Match) */}
            <div className="flex flex-row items-center gap-2 w-full sm:w-auto md:min-w-[200px]">
              {myParticipant?.role === 'seeker' && !myParticipant.isCaught && match.status === 'hunting' && (
                <>
                  <button
                    onClick={handlePlaceBomb}
                    disabled={placeBombMutation.isPending}
                    title="Drop Proximity Bomb"
                    aria-label="Drop Proximity Bomb"
                    className="flex-1 sm:w-auto min-h-[44px] px-3 md:px-4 py-1.5 bg-cyber-orange text-zinc-950 font-black text-[10px] md:text-xs uppercase rounded flex items-center justify-center gap-1.5 md:gap-2 shadow-orange-glow/20 hover:bg-white transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                  >
                    <Bomb className="w-3.5 h-3.5 md:w-4 md:h-4 animate-bounce shrink-0" />
                    <span className="tracking-wider truncate">{placeBombMutation.isPending ? 'ARMING...' : 'DROP 💣'}</span>
                  </button>

                  {/* Interactive Proximity Radar Scanner Button */}
                  <button
                    onClick={handleRadarScan}
                    type="button"
                    title="Scan Proximity Radar"
                    aria-label="Scan Proximity Radar"
                    className={`flex-1 sm:w-auto min-h-[44px] px-2 py-1 rounded border flex flex-col justify-center items-center text-center transition-all active:scale-95 cursor-pointer select-none ${
                      nearestHider?.inRange
                        ? 'border-cyber-red/70 bg-cyber-red/15 text-cyber-red shadow-red-glow/20 animate-pulse'
                        : nearestHider
                        ? 'border-cyber-cyan/50 bg-cyber-cyan/10 text-cyber-cyan shadow-cyan-glow/15 hover:border-cyber-cyan'
                        : 'border-zinc-800 bg-zinc-900/60 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400'
                    } ${isRadarScanning ? 'ring-2 ring-cyber-cyan shadow-cyan-glow scale-95' : ''}`}
                  >
                    {nearestHider ? (
                      <>
                        <div className="flex items-center gap-1 leading-tight">
                          <Crosshair className={`w-3 h-3 shrink-0 ${isRadarScanning ? 'animate-spin' : ''}`} />
                          <span className="text-[10px] md:text-xs font-mono font-black tracking-wider uppercase">
                            {Math.round(nearestHider.distance)}m
                          </span>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-tight truncate mt-0.5">
                          {nearestHider.inRange
                            ? '⚡ CAPTURING...'
                            : `▸ ${Math.round(nearestHider.captureRadius)} m capture`}
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1 leading-tight">
                          <Crosshair className={`w-3 h-3 shrink-0 ${isRadarScanning ? 'animate-spin' : ''}`} />
                          <span className="text-[10px] md:text-xs font-mono font-black tracking-wider uppercase">RADAR</span>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-tight truncate mt-0.5">TAP TO PING</span>
                      </>
                    )}
                  </button>
                </>
              )}

              {myParticipant?.role === 'seeker' && !myParticipant.isCaught && match.status === 'hiding' && (
                <div className="flex-1 min-h-[44px] px-3 py-1 flex items-center justify-center text-center bg-zinc-900/40 border border-cyber-cyan/20 rounded">
                  <span className="text-cyber-cyan font-black text-[10px] md:text-xs uppercase tracking-wider animate-pulse">
                    PREPARING HUNT...
                  </span>
                </div>
              )}

              {myParticipant?.role === 'hider' && (
                <div className="flex-1 min-h-[44px] px-3 py-1 flex items-center justify-center text-center">
                  {myParticipant.isCaught ? (
                    <span className="text-zinc-500 font-black text-[10px] md:text-xs uppercase">
                      CAPTURED & DESYNCED
                    </span>
                  ) : (
                    <span className="text-cyber-green font-black text-[10px] md:text-xs glow-green uppercase animate-pulse">
                      EVADING RADAR
                    </span>
                  )}
                </div>
              )}

              {/* Dedicated Comms Toggle Button (Feature F4) */}
              <button
                type="button"
                onClick={() => setIsChatOpen((prev) => !prev)}
                className="w-11 h-11 md:w-12 md:h-12 rounded bg-zinc-900 border border-cyber-cyan/40 flex items-center justify-center relative hover:border-cyber-cyan transition-colors shrink-0 active:scale-95 pointer-events-auto"
                title={isChatOpen ? 'Close Grid Comms' : 'Open Grid Comms'}
                aria-label="Toggle Grid Comms"
              >
                <MessageSquare className="w-4 h-4 md:w-5 md:h-5 text-cyber-cyan" />
                {!isChatOpen && (chatMessages.length - lastSeenMessageCount > 0) && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-cyber-red text-white text-[10px] font-black flex items-center justify-center animate-pulse">
                    {(chatMessages.length - lastSeenMessageCount) > 99
                      ? '99+'
                      : (chatMessages.length - lastSeenMessageCount)}
                  </span>
                )}
              </button>

              {/* Exit Match button (Feature F5) */}
              <button
                type="button"
                onClick={handleExitMatch}
                title="Exit Match"
                aria-label="Exit Match"
                className="min-w-[64px] min-h-[44px] px-3 md:px-4 py-1.5 bg-zinc-900/90 border border-zinc-800 text-zinc-400 hover:text-cyber-red hover:border-cyber-red/50 text-[10px] md:text-xs font-black uppercase rounded transition-all active:scale-95 flex items-center justify-center shrink-0 shadow-sm"
              >
                <span className="tracking-wider">Exit</span>
              </button>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // 4. MATCH FINISHED SCREEN (status === 'finished')
  if (match.status === 'finished') {
    const hiders = participants.filter((p: any) => p.role === 'hider');
    const hidersSurvived = hiders.filter((h: any) => !h.isCaught);
    const hidersWon = hidersSurvived.length > 0;

    return (
      <div className="flex-1 w-full h-full grid-bg p-4 overflow-y-auto font-rajdhani flex flex-col items-center pt-8">
        <div className="w-full max-w-xl flex flex-col gap-6">
          
          <div className="text-center border-b border-cyber-border pb-3 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-black font-orbitron text-cyber-cyan tracking-wider">
                GRID REPORT METRICS
              </h1>
              <span className="text-xs text-zinc-500 uppercase mt-0.5">Match {match.id} terminated.</span>
            </div>
            <button
              onClick={handleExitMatch}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-cyber-border text-zinc-400 hover:text-cyber-cyan text-xs font-black uppercase rounded transition-colors"
            >
              <Home className="w-4 h-4" />
              Lobby
            </button>
          </div>

          <div className="cyber-card p-6 flex flex-col items-center gap-6 text-center border-cyber-cyan/30">
            <Award className="w-16 h-16 text-cyber-yellow glow-yellow animate-bounce" />
            
            <div className="flex flex-col">
              <span className="text-3xl font-black font-orbitron text-cyber-cyan glow-cyan tracking-widest uppercase">
                {hidersWon ? 'HIDERS SECURED VICTORY' : 'SEEKERS DOMINATED'}
              </span>
              <p className="text-sm text-zinc-500 mt-2 max-w-sm">
                {hidersWon 
                  ? `Match duration elapsed. Hiders survived network detection scans: (${hidersSurvived.map((h: any) => h.name).join(', ')})`
                  : 'All hiders successfully targeted, captured, and neutralized inside play boundaries.'
                }
              </p>
            </div>

            <div className="w-full border-t border-zinc-900 pt-4 text-left">
              <span className="block text-[10px] text-zinc-500 uppercase font-black tracking-wider mb-2 text-center">
                Match Stats
              </span>
              <div className="flex flex-col gap-2 font-mono text-xs">
                <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                  <span className="text-zinc-500">PLAYERS:</span>
                  <span className="font-bold text-zinc-300">{participants.length}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                  <span className="text-zinc-500">TOTAL HIDERS:</span>
                  <span className="font-bold text-zinc-300">{hiders.length}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                  <span className="text-zinc-500">HIDERS CAPTURED:</span>
                  <span className="font-bold text-cyber-red font-bold">{hiders.length - hidersSurvived.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">SURVIVAL RATE:</span>
                  <span className="font-bold text-cyber-green">
                    {hiders.length > 0 ? Math.round((hidersSurvived.length / hiders.length) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
            
            <button
              onClick={handleExitMatch}
              className="w-full py-2.5 bg-cyber-cyan hover:bg-white text-zinc-950 font-black font-orbitron tracking-widest text-sm rounded shadow-cyan-glow transition-all active:scale-95"
            >
              RETURN TO CONTROL GRID
            </button>
          </div>

        </div>
      </div>
    );
  }

  return null;
};

export default Matches;
