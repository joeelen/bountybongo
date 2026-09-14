import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { Cloud, X, Shield, Sparkles, User, Mail, LogIn, UserPlus, CheckCircle2, Lock, Eye, EyeOff } from 'lucide-react';

interface CloudAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register';
}

export const CloudAuthModal: React.FC<CloudAuthModalProps> = ({
  isOpen,
  onClose,
  defaultMode = 'login'
}) => {
  const { user, profile, isGuest, login, register, authLogin, switchToGuest } = useAuth();
  const { success, error: toastError } = useToast();

  const [mode, setMode] = useState<'login' | 'register' | 'presets'>(defaultMode);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
      setErrorMsg('Vennligst skriv inn brukernavn');
      return;
    }
    if (!password) {
      setErrorMsg('Vennligst skriv inn passord');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'register') {
        await register({
          username: cleanUsername,
          password: password,
          email: email.trim() || undefined,
          transferScore: transferXp && isGuest
        });
        success(`Konto opprettet! Logget inn som ${cleanUsername}. Sky-synk aktiv.`);
      } else {
        await login({
          username: cleanUsername,
          password: password
        });
        success(`Velkommen tilbake! Logget inn som ${cleanUsername}.`);
      }
      onClose();
    } catch (err: any) {
      const msg = err.message || 'Autentisering feilet';
      setErrorMsg(msg);
      toastError(msg);
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
              <span className="text-[10px] text-zinc-500 uppercase font-black">Score</span>
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
            onClick={() => { setMode('login'); setErrorMsg(''); }}
            className={`flex-1 py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              mode === 'login' 
                ? 'border-cyber-cyan text-cyber-cyan bg-cyber-cyan/5' 
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            Logg inn
          </button>
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
            Opprett konto
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

          {(mode === 'login' || mode === 'register') && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1 text-left">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-cyber-cyan" />
                  Brukernavn:
                </label>
                <input
                  type="text"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="f.eks. Joel, ShadowHunter..."
                  className="w-full min-h-[44px] bg-zinc-900 border border-cyber-border rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyber-cyan font-mono"
                  required
                />
              </div>

              <div className="flex flex-col gap-1 text-left">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-cyber-cyan" />
                  Passord:
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ditt passord"
                    className="w-full min-h-[44px] bg-zinc-900 border border-cyber-border rounded pl-3 pr-10 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyber-cyan font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-1"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {mode === 'register' && (
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-zinc-500" />
                    E-post (valgfritt):
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="din.epost@example.com"
                    className="w-full min-h-[44px] bg-zinc-900 border border-cyber-border rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyber-cyan font-mono"
                  />
                </div>
              )}

              {mode === 'register' && isGuest && currentScore > 0 && (
                <label className="flex items-center gap-2 p-2.5 rounded bg-zinc-900/50 border border-zinc-800 text-xs text-zinc-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={transferXp}
                    onChange={(e) => setTransferXp(e.target.checked)}
                    className="w-4 h-4 accent-cyber-cyan rounded"
                  />
                  <span>Overfør min nåværende <strong>{currentScore} XP</strong> til denne kontoen</span>
                </label>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !username.trim() || !password}
                className="w-full min-h-[44px] mt-1 bg-cyber-cyan hover:bg-white text-zinc-950 font-black text-xs uppercase rounded transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2 shadow-cyan-glow/20 font-orbitron"
              >
                {mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                {isSubmitting 
                  ? 'Behandler...' 
                  : (mode === 'login' ? 'Logg inn på konto' : 'Opprett konto & Synkroniser')
                }
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
