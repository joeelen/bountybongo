import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../lib/AuthContext';
import { UserPlus, UserCheck, MessageSquare, Send, RefreshCw, Radio, ChevronRight, Copy, Check, Cloud } from 'lucide-react';
import { CloudAuthModal } from '../components/CloudAuthModal';

const Social: React.FC = () => {
  const { user, isGuest } = useAuth();
  const queryClient = useQueryClient();
  
  const [friendQuery, setFriendQuery] = useState('');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [copiedTag, setCopiedTag] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  
  const [activeFriendId, setActiveFriendId] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');

  // Query: Get friends list (Drizzle ORM backend)
  const { data: friendsList = [], isLoading: isLoadingFriends, refetch: refetchFriends } = useQuery({
    queryKey: ['friends'],
    queryFn: async () => {
      const res = await fetch('/api/social/friends');
      if (!res.ok) throw new Error('Failed to load friends');
      return res.json();
    },
    refetchInterval: 5000
  });

  // Query: Get messages between current user and selected friend
  const { data: messages = [], refetch: refetchMessages } = useQuery({
    queryKey: ['messages', activeFriendId],
    queryFn: async () => {
      if (!activeFriendId) return [];
      const res = await fetch(`/api/social/messages?receiverId=${activeFriendId}`);
      if (!res.ok) throw new Error('Failed to load messages');
      return res.json();
    },
    enabled: !!activeFriendId,
    refetchInterval: 1000 // Poll messages every 1 second
  });

  // Mutation: Send friend request (by username, @tag, id, or email)
  const requestMutation = useMutation({
    mutationFn: async (query: string) => {
      const res = await fetch('/api/social/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to send request');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setFriendQuery('');
      setAddSuccess(data.message || 'Friend request transmitted successfully!');
      setAddError('');
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      setTimeout(() => setAddSuccess(''), 4000);
    },
    onError: (err: any) => {
      setAddError(err.message);
      setAddSuccess('');
    }
  });

  // Mutation: Accept friend request
  const acceptMutation = useMutation({
    mutationFn: async (requestId: number) => {
      const res = await fetch('/api/social/friends/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId })
      });
      if (!res.ok) throw new Error('Failed to accept request');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
    }
  });

  // Mutation: Send chat message
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch('/api/social/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverId: activeFriendId, content })
      });
      if (!res.ok) throw new Error('Failed to transmit message');
      return res.json();
    },
    onSuccess: () => {
      setChatInput('');
      queryClient.invalidateQueries({ queryKey: ['messages', activeFriendId] });
    }
  });

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendQuery.trim()) return;
    requestMutation.mutate(friendQuery.trim());
  };

  const handleAcceptRequest = (id: number) => {
    acceptMutation.mutate(id);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendMessageMutation.mutate(chatInput.trim());
  };

  // Filter friends list
  const pendingRequests = friendsList.filter((f: any) => f.status === 'pending' && f.senderId !== user?.id);
  const acceptedFriends = friendsList.filter((f: any) => f.status === 'accepted');
  const activeFriendObj = friendsList.find((f: any) => f.friend.id === activeFriendId);

  return (
    <div className="flex-1 w-full h-full grid-bg p-4 flex flex-col items-center pt-8 overflow-y-auto md:overflow-hidden font-rajdhani pb-24 md:pb-8">
      <div className="w-full max-w-5xl h-auto md:h-[85vh] flex flex-col md:flex-row gap-6">
        
        {/* Left column: Friends List & Invites */}
        <div className="w-full md:w-80 h-full flex flex-col gap-4">

          {/* Your Player Identity & Tag */}
          <div className="cyber-card p-4 border-cyber-cyan/30 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider font-orbitron">Your Identity</span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase font-mono ${
                isGuest ? 'bg-cyber-yellow/10 border-cyber-yellow/30 text-cyber-yellow' : 'bg-cyber-green/10 border-cyber-green/30 text-cyber-green'
              }`}>
                {isGuest ? 'Guest Tag' : 'Cloud Synced'}
              </span>
            </div>
            <div className="flex items-center justify-between bg-zinc-950/80 border border-zinc-800 rounded px-3 py-2">
              <div className="flex flex-col min-w-0 pr-2">
                <span className="text-sm font-bold text-cyber-cyan truncate font-orbitron">@{user?.name}</span>
                <span className="text-[10px] text-zinc-500 font-mono truncate">ID: {user?.id}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (user?.name) {
                    navigator.clipboard.writeText(`@${user.name}`);
                    setCopiedTag(true);
                    setTimeout(() => setCopiedTag(false), 2000);
                  }
                }}
                className="min-h-[44px] px-3 py-1.5 bg-zinc-900 hover:bg-cyber-cyan hover:text-zinc-950 text-zinc-300 rounded border border-zinc-700 text-xs font-bold font-mono uppercase flex items-center gap-1.5 transition-colors shrink-0"
              >
                {copiedTag ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-cyber-green" />
                    <span className="text-cyber-green">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            {isGuest && (
              <div className="flex items-center justify-between gap-2 p-2 rounded bg-cyber-yellow/5 border border-cyber-yellow/20 mt-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Cloud className="w-3.5 h-3.5 text-cyber-yellow shrink-0 animate-pulse" />
                  <span className="text-[10px] text-zinc-400 font-mono truncate">Save friends across devices</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="px-2 py-1 bg-cyber-yellow hover:bg-white text-zinc-950 font-black text-[9px] uppercase rounded shrink-0 transition-colors"
                >
                  Sync
                </button>
              </div>
            )}
          </div>
          
          {/* Add Friend Form */}
          <div className="cyber-card p-4 border-cyber-cyan/30 flex flex-col gap-3">
            <span className="font-bold text-xs text-cyber-cyan uppercase tracking-widest flex items-center gap-1.5 font-orbitron">
              <UserPlus className="w-4 h-4 text-cyber-cyan" />
              Add Friend by Tag or Name
            </span>
            <form onSubmit={handleAddFriend} className="flex gap-2 mt-1">
              <input
                type="text"
                value={friendQuery}
                onChange={(e) => setFriendQuery(e.target.value)}
                placeholder="USERNAME, @TAG, OR EMAIL..."
                className="flex-1 bg-zinc-900 border border-cyber-border rounded px-3 py-2 text-xs text-cyber-cyan focus:outline-none focus:border-cyber-cyan font-mono min-h-[44px]"
              />
              <button
                type="submit"
                disabled={requestMutation.isPending}
                className="min-h-[44px] px-3.5 bg-cyber-cyan hover:bg-white text-zinc-950 text-xs font-bold uppercase rounded transition-colors disabled:opacity-50"
              >
                Send
              </button>
            </form>
            {addError && <span className="text-[10px] text-cyber-red font-mono font-bold">{addError}</span>}
            {addSuccess && <span className="text-[10px] text-cyber-green font-mono font-bold">{addSuccess}</span>}
          </div>

          {/* Pending Requests list */}
          {pendingRequests.length > 0 && (
            <div className="cyber-card p-4 border-cyber-orange/40 flex flex-col gap-3">
              <span className="font-bold text-xs text-cyber-orange uppercase tracking-widest flex items-center gap-1.5 font-orbitron">
                <Radio className="w-4 h-4 text-cyber-orange animate-pulse" />
                Pending Uplinks
              </span>
              <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                {pendingRequests.map((reqObj: any) => (
                  <div key={reqObj.id} className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-cyber-border">
                    <div className="flex items-center gap-2">
                      <img src={reqObj.friend.avatar} className="w-5 h-5 rounded-full" alt="" />
                      <span className="text-xs font-bold truncate max-w-[100px]">{reqObj.friend.name}</span>
                    </div>
                    <button
                      onClick={() => handleAcceptRequest(reqObj.id)}
                      className="px-2 py-0.5 bg-cyber-orange text-zinc-950 text-[10px] font-black uppercase rounded hover:bg-white transition-all"
                    >
                      Accept
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friends list */}
          <div className="cyber-card p-4 flex-1 flex flex-col gap-3 overflow-hidden">
            <div className="flex items-center justify-between border-b border-cyber-border pb-1">
              <span className="font-bold text-xs text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-cyber-cyan" />
                Linked Nodes ({acceptedFriends.length})
              </span>
              <button onClick={() => refetchFriends()} className="text-zinc-500 hover:text-cyber-cyan transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto flex flex-col gap-2 mt-1">
              {isLoadingFriends ? (
                <div className="text-zinc-600 text-xs text-center py-8 font-mono animate-pulse">SYNCHRONIZING NETWORK LIST...</div>
              ) : acceptedFriends.length === 0 ? (
                <div className="text-zinc-600 text-xs text-center py-8 font-mono">NO ACTIVE NODE CONNECTIONS.</div>
              ) : (
                acceptedFriends.map((f: any) => (
                  <button
                    key={f.id}
                    onClick={() => setActiveFriendId(f.friend.id)}
                    className={`w-full flex items-center justify-between p-2 rounded border transition-all text-left ${
                      activeFriendId === f.friend.id
                        ? 'bg-cyber-cyan/15 border-cyber-cyan text-cyber-cyan'
                        : 'bg-zinc-900/60 border-cyber-border hover:border-cyber-cyan/30 text-zinc-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <img src={f.friend.avatar} alt="" className="w-6 h-6 rounded-full border border-cyber-border" />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold leading-tight">{f.friend.name}</span>
                        <span className="text-[10px] text-zinc-500 leading-tight">XP: {f.friend.score}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                  </button>
                ))
              )}
            </div>
          </div>

        </div>

        {/* Right column: Chat Log (1-on-1 Messages) */}
        <div className="flex-1 h-full cyber-card p-4 border-cyber-cyan/20 flex flex-col gap-4 overflow-hidden">
          {activeFriendId && activeFriendObj ? (
            <>
              {/* Active Friend Header */}
              <div className="flex items-center justify-between border-b border-cyber-border pb-2.5">
                <div className="flex items-center gap-3">
                  <img src={activeFriendObj.friend.avatar} alt="" className="w-8 h-8 rounded-full border border-cyber-cyan/30" />
                  <div className="flex flex-col">
                    <span className="text-sm font-black uppercase text-cyber-cyan tracking-wider">{activeFriendObj.friend.name}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">NODE ID: {activeFriendObj.friend.id}</span>
                  </div>
                </div>
                <button
                  onClick={() => refetchMessages()}
                  className="text-zinc-500 hover:text-cyber-cyan transition-colors"
                  title="Force telemetry refresh"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Chat log messages list */}
              <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-2 font-mono text-[11px] leading-relaxed">
                {messages.length === 0 ? (
                  <div className="text-zinc-600 text-center py-20 italic">
                    Uplink cleared. Secure logs initialized. Send a transmission below.
                  </div>
                ) : (
                  messages.map((msg: any) => {
                    const isOwn = msg.senderId === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col max-w-[75%] rounded p-2.5 ${
                          isOwn
                            ? 'bg-cyber-cyan/10 border border-cyber-cyan/30 self-end text-right'
                            : 'bg-zinc-900 border border-cyber-border self-start text-left'
                        }`}
                      >
                        <span className={`text-[8px] font-black uppercase mb-1 ${isOwn ? 'text-cyber-cyan/80' : 'text-zinc-500'}`}>
                          {isOwn ? 'YOU' : activeFriendObj.friend.name}
                        </span>
                        <span className="text-zinc-300 break-words">{msg.content}</span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Message Composer form */}
              <form onSubmit={handleSendMessage} className="flex gap-2 border-t border-zinc-900 pt-3">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="TRANSMIT SECURE DATA PACKET..."
                  className="flex-1 bg-zinc-900 border border-cyber-border rounded px-4 py-2 text-xs text-cyber-cyan focus:outline-none focus:border-cyber-cyan font-mono tracking-wider"
                />
                <button
                  type="submit"
                  disabled={sendMessageMutation.isPending || !chatInput.trim()}
                  className="px-4 py-2 bg-cyber-cyan text-zinc-950 hover:bg-white text-xs font-black uppercase rounded shadow-cyan-glow transition-all duration-300 disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
              <MessageSquare className="w-12 h-12 text-zinc-700 animate-pulse mb-3" />
              <span className="font-bold text-sm text-zinc-500 uppercase tracking-widest">
                No Communication Channels Open
              </span>
              <p className="text-xs text-zinc-700 mt-1 max-w-xs leading-normal">
                Select a linked node from the left panel to establish a secure, encrypted direct transmission uplink.
              </p>
            </div>
          )}
        </div>

      </div>

      <CloudAuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
};

export default Social;
