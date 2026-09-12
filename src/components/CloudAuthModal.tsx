import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { Cloud, X, Shield, Sparkles, User, Mail, LogIn, UserPlus, CheckCircle2 } from 'lucide-react';

interface CloudAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register';
}

export const CloudAuthModal: React.FC<CloudAuthModalProps> = ({
  isOpen,
  onClose,
  defaultMode = 'register'
}) => {
  const { user, profile, isGuest, linkCloudAccount, authLogin, switchToGuest } = useAuth();
  const { success, error: toastError } = useToast();

  const [mode, setMode] = useState<'register' | 'login' | 'presets'>(defaultMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [transferXp, setTransferXp] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const currentScore = profile?.score || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanUsername = username.trim();
    if (!cleanUsername) {
      setErrorMsg('Please choose a username for your cloud account');
      return;
    }

    setIsSubmitting(true);
    try {
      await linkCloudAccount({
        username: cleanUsername,
        email: email.trim() || undefined,
        transferScore: transferXp && isGuest
      });

      success(`Connected! Logged in as ${cleanUsername}. Cloud sync active.`);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to authenticate cloud account');
      toastError(err.message || 'Authentication failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOAuthSimulated = async (provider: 'google' | 'apple') => {
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const generatedId = `${provider}_user_${Math.random().toString(36).substring(2, 8)}`;
      const displayName = provider === 'google' ? 'Google Player' : 'Apple Player';
      await authLogin({
        id: generatedId,
        name: displayName,
        email: `${generatedId}@${provider}.com`,
        transferScore: transferXp && isGuest ? currentScore : 0
      });
      success(`Signed in with ${provider.toUpperCase()}! Cloud profile active.`);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || `Failed to sign in with ${provider}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePresetLogin = async (presetId: string, presetName: string) => {
    setIsSubmitting(true);
    try {
      await authLogin({
        id: presetId,
        name: presetName,
        email: `${presetId}@bounty.com`,
        transferScore: 0
      });
      success(`Switched to preset account: ${presetName}`);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to switch preset');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-zinc-950/85 backdrop-blur-sm p-0 sm:p-4 font-rajdhani animate-fade-in">
      <div 
        className="w-full sm:max-w-md bg-zinc-950 border border-cyber-cyan/40 sm:rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cyber-border bg-zinc-900/70">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-cyber-cyan animate-pulse" />
            <div>
              <h3 className="font-orbitron font-black text-sm text-cyber-cyan tracking-wider uppercase">
                Cloud Profile & Save
              </h3>
              <span className="text-[10px] text-zinc-500 font-mono block leading-none">
                {isGuest ? 'GUEST MODE (LOCAL DEVICE)' : 'CLOUD ACCOUNT ACTIVE'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95 transition-all"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current status pill */}
        <div className="p-4 bg-zinc-900/30 border-b border-zinc-900 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img 
                src={user?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=guest`} 
                alt="" 
                className="w-8 h-8 rounded-full border border-cyber-cyan/40 bg-zinc-900" 
              />
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-zinc-200">{user?.name || 'Local Guest'}</span>
                <span className="text-[10px] text-zinc-500 font-mono">ID: {user?.id}</span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs font-mono font-black text-cyber-yellow glow-yellow">{currentScore} XP</span>
              <span className="text-[9px] text-zinc-500 uppercase font-black">Score</span>
            </div>
          </div>

          {isGuest ? (
            <div className="text-[11px] text-zinc-400 bg-zinc-900/60 border border-cyber-cyan/20 rounded p-2 flex items-start gap-2 mt-1">
              <Sparkles className="w-4 h-4 text-cyber-cyan shrink-0 mt-0.5" />
              <span>
                You are playing as a <strong>Guest</strong>. Connect a Cloud Account to save your XP permanently, keep your score on other devices, and add friends!
              </span>
            </div>
          ) : (
            <div className="text-[11px] text-cyber-green bg-cyber-green/5 border border-cyber-green/30 rounded p-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-cyber-green shrink-0" />
                <span>Account synced to Cloud</span>
              </div>
              <button
                type="button"
                onClick={switchToGuest}
                className="text-[10px] underline hover:text-white uppercase font-bold text-zinc-400"
              >
                Switch to Guest
              </button>
            </div>
          )}
        </div>

        {/* Tab selection */}
        <div className="flex border-b border-zinc-900 text-xs font-bold font-orbitron bg-zinc-950">
          <button
            type="button"
            onClick={() => { setMode('register'); setErrorMsg(''); }}
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              mode === 'register' 
                ? 'border-cyber-cyan text-cyber-cyan bg-cyber-cyan/5' 
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Cloud Login / Sync
          </button>
          <button
            type="button"
            onClick={() => { setMode('presets'); setErrorMsg(''); }}
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              mode === 'presets' 
                ? 'border-cyber-cyan text-cyber-cyan bg-cyber-cyan/5' 
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            Presets & OAuth
          </button>
        </div>

        {/* Body content */}
        <div className="p-4 overflow-y-auto flex flex-col gap-4">
          {errorMsg && (
            <div className="p-2.5 rounded bg-cyber-red/10 border border-cyber-red/40 text-cyber-red text-xs font-mono font-bold">
              {errorMsg}
            </div>
          )}

          {mode === 'register' && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1 text-left">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-cyber-cyan" />
                  Your Username / Gamer Tag:
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. Joel, ShadowHunter, NeonViper..."
                  className="w-full min-h-[44px] bg-zinc-900 border border-cyber-border rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyber-cyan font-mono"
                  required
                />
              </div>

              <div className="flex flex-col gap-1 text-left">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-zinc-500" />
                  Email Address (Optional):
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com (optional)"
                  className="w-full min-h-[44px] bg-zinc-900 border border-cyber-border rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyber-cyan font-mono"
                />
              </div>

              {isGuest && currentScore > 0 && (
                <label className="flex items-center gap-2 p-2.5 rounded bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={transferXp}
                    onChange={(e) => setTransferXp(e.target.checked)}
                    className="w-4 h-4 accent-cyber-cyan rounded"
                  />
                  <span>Transfer my current <strong>{currentScore} XP</strong> to this account</span>
                </label>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !username.trim()}
                className="w-full min-h-[44px] mt-1 bg-cyber-cyan hover:bg-white text-zinc-950 font-black text-xs uppercase rounded transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2 shadow-cyan-glow/20"
              >
                <LogIn className="w-4 h-4" />
                {isSubmitting ? 'Syncing...' : 'Save & Sync Cloud Account'}
              </button>
            </form>
          )}

          {mode === 'presets' && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleOAuthSimulated('google')}
                  disabled={isSubmitting}
                  className="min-h-[44px] p-2.5 rounded bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-xs font-bold text-zinc-200 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <span className="text-sm">G</span> Google Sign-In
                </button>
                <button
                  type="button"
                  onClick={() => handleOAuthSimulated('apple')}
                  disabled={isSubmitting}
                  className="min-h-[44px] p-2.5 rounded bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-xs font-bold text-zinc-200 flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  <span className="text-sm"></span> Apple Sign-In
                </button>
              </div>

              <div className="border-t border-zinc-900 pt-3 flex flex-col gap-2">
                <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest text-left">
                  Quick Testing Profiles:
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'host', name: 'Host' },
                    { id: 'hider1', name: 'Hider 1' },
                    { id: 'hider2', name: 'Hider 2' },
                    { id: 'seeker1', name: 'Seeker 1' }
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handlePresetLogin(preset.id, preset.name)}
                      disabled={isSubmitting}
                      className="min-h-[44px] p-2 rounded bg-zinc-900/60 border border-cyber-border hover:border-cyber-cyan/50 text-xs font-bold text-zinc-300 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                    >
                      <User className="w-3.5 h-3.5 text-cyber-cyan" />
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-zinc-900 flex justify-center">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-zinc-500 hover:text-zinc-300 underline font-mono"
            >
              Continue playing without signing in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
