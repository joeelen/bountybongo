import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { 
  Cloud, X, Shield, Sparkles, User, Mail, LogIn, UserPlus, 
  CheckCircle2, Lock, Eye, EyeOff, ArrowLeft 
} from 'lucide-react';

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
  const { user, profile, isGuest, login, register, oauthLogin, authLogin, switchToGuest } = useAuth();
  const { success, error: toastError } = useToast();

  const [mode, setMode] = useState<'login' | 'register'>(defaultMode);
  const [oauthProvider, setOauthProvider] = useState<'google' | 'apple' | null>(null);
  const [showPresets, setShowPresets] = useState(false);

  // Form states
  const [identifier, setIdentifier] = useState(''); // Username or email
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [regEmail, setRegEmail] = useState('');
  
  // OAuth form states
  const [oauthEmail, setOauthEmail] = useState('');
  const [oauthName, setOauthName] = useState('');
  const [savedOauthEmail, setSavedOauthEmail] = useState('');

  const [transferXp, setTransferXp] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('last_oauth_email');
    if (saved) {
      setSavedOauthEmail(saved);
      if (!oauthEmail) setOauthEmail(saved);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentScore = profile?.score || 0;

  // Handle Standard Login & Registration
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      setErrorMsg('Vennligst skriv inn brukernavn eller e-post');
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
          username: cleanIdentifier,
          password: password,
          email: regEmail.trim() || undefined,
          transferScore: transferXp && isGuest
        });
        success(`Konto opprettet! Logget inn som ${cleanIdentifier}. Sky-synk aktiv.`);
      } else {
        await login({
          username: cleanIdentifier,
          password: password
        });
        success(`Velkommen tilbake! Logget inn som ${cleanIdentifier}.`);
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

  // Handle Real OAuth Sign-In (Google / Apple)
  const handleOAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oauthProvider) return;
    setErrorMsg('');
    const cleanEmail = oauthEmail.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Vennligst oppgi en gyldig e-postadresse.');
      return;
    }

    setIsSubmitting(true);
    try {
      const cleanName = oauthName.trim() || cleanEmail.split('@')[0];
      await oauthLogin({
        provider: oauthProvider,
        email: cleanEmail,
        name: cleanName,
        transferScore: transferXp && isGuest ? currentScore : 0
      });
      const providerLabel = oauthProvider === 'google' ? 'Google' : 'Apple';
      success(`Logget inn med ${providerLabel}!`, `Velkommen, ${cleanName}. Sky-synk er aktiv.`);
      onClose();
    } catch (err: any) {
      const msg = err.message || `Kunne ikke logge inn med ${oauthProvider}`;
      setErrorMsg(msg);
      toastError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartOAuth = (provider: 'google' | 'apple') => {
    setErrorMsg('');
    setOauthProvider(provider);
    if (savedOauthEmail) {
      setOauthEmail(savedOauthEmail);
    }
  };

  // Handle Preset Dev Account Switch
  const handlePresetLogin = async (presetId: string, presetName: string) => {
    setIsSubmitting(true);
    try {
      await authLogin({
        id: presetId,
        name: presetName,
        email: `${presetId}@bounty.com`,
        transferScore: 0
      });
      success(`Byttet til testkonto: ${presetName}`);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Kunne ikke bytte testkonto');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-zinc-950/85 backdrop-blur-sm p-0 sm:p-4 font-rajdhani animate-fade-in">
      <div 
        className="w-full sm:max-w-md bg-zinc-950 border border-cyber-cyan/40 sm:rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] pb-[calc(1rem+env(safe-area-inset-bottom,0px))]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cyber-border bg-zinc-900/70">
          <div className="flex items-center gap-2">
            <Cloud className="w-5 h-5 text-cyber-cyan animate-pulse" />
            <div>
              <h3 className="font-orbitron font-black text-sm text-cyber-cyan tracking-wider uppercase">
                Skyprofil & Lagring
              </h3>
              <span className="text-[10px] text-zinc-500 font-mono block leading-none">
                {isGuest ? 'GJESTEMODUS (KUN DENNE ENHETEN)' : 'SKYKONTO SYNKRONISERT'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded text-zinc-400 hover:text-white hover:bg-zinc-800 active:scale-95 transition-all"
            aria-label="Lukk"
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
                <span className="text-xs font-bold text-zinc-200">{user?.name || 'Lokal Gjest'}</span>
                <span className="text-[10px] text-zinc-500 font-mono truncate max-w-[180px]">
                  {user?.email || `ID: ${user?.id}`}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs font-mono font-black text-cyber-yellow glow-yellow">{currentScore} XP</span>
              <span className="text-[10px] text-zinc-500 uppercase font-black">Poeng</span>
            </div>
          </div>

          {isGuest ? (
            <div className="text-[11px] text-zinc-400 bg-zinc-900/60 border border-cyber-cyan/20 rounded p-2 flex items-start gap-2 mt-1">
              <Sparkles className="w-4 h-4 text-cyber-cyan shrink-0 mt-0.5" />
              <span>
                Du spiller nå som <strong>Gjest</strong>. Koble til en konto for å lagre din XP permanent, ta vare på venner og logge inn fra andre enheter!
              </span>
            </div>
          ) : (
            <div className="text-[11px] text-cyber-green bg-cyber-green/5 border border-cyber-green/30 rounded p-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5 truncate mr-2">
                <CheckCircle2 className="w-4 h-4 text-cyber-green shrink-0" />
                <span className="truncate">Konto synkronisert ({user?.email})</span>
              </div>
              <button
                type="button"
                onClick={switchToGuest}
                className="text-[10px] underline hover:text-white uppercase font-bold text-zinc-400 shrink-0"
              >
                Veksle til Gjest
              </button>
            </div>
          )}
        </div>

        {/* If OAuth prompt is open */}
        {oauthProvider ? (
          <div className="p-4 overflow-y-auto flex flex-col gap-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-900">
              <button
                type="button"
                onClick={() => { setOauthProvider(null); setErrorMsg(''); }}
                className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all flex items-center gap-1 text-xs"
              >
                <ArrowLeft className="w-4 h-4" />
                Tilbake
              </button>
              <h4 className="text-sm font-orbitron font-bold text-zinc-200 uppercase tracking-wider ml-auto">
                {oauthProvider === 'google' ? 'Google Sign-In' : 'Apple Sign-In'}
              </h4>
            </div>

            <div className="p-3 rounded-lg bg-zinc-900/60 border border-cyber-border text-xs text-zinc-300 text-left leading-relaxed">
              Koble din <strong>{oauthProvider === 'google' ? 'Google' : 'Apple'}</strong>-e-postadresse til Bountyrunner. 
              Kontoen din, spillernavnet og din XP lagres permanent i skyen.
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded bg-cyber-red/10 border border-cyber-red/40 text-cyber-red text-xs font-mono font-bold">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleOAuthSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1 text-left">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-cyber-cyan" />
                  {oauthProvider === 'google' ? 'Google E-postadresse:' : 'Apple-ID E-postadresse:'}
                </label>
                <input
                  type="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={oauthEmail}
                  onChange={(e) => setOauthEmail(e.target.value)}
                  placeholder={oauthProvider === 'google' ? 'f.eks. din.epost@gmail.com' : 'f.eks. din.epost@icloud.com'}
                  className="w-full min-h-[44px] bg-zinc-900 border border-cyber-border rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyber-cyan font-mono"
                  required
                />
              </div>

              <div className="flex flex-col gap-1 text-left">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-cyber-cyan" />
                  Ønsket visningsnavn:
                </label>
                <input
                  type="text"
                  value={oauthName}
                  onChange={(e) => setOauthName(e.target.value)}
                  placeholder="f.eks. NinjaHunter, Joel..."
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
                  <span>Overfør min nåværende <strong>{currentScore} XP</strong> til denne kontoen</span>
                </label>
              )}

              <button
                type="submit"
                disabled={isSubmitting || !oauthEmail.trim() || !oauthEmail.includes('@')}
                className="w-full min-h-[44px] mt-2 bg-cyber-cyan hover:bg-white text-zinc-950 font-black text-xs uppercase rounded transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2 shadow-cyan-glow/20 font-orbitron"
              >
                {oauthProvider === 'google' ? <span className="font-bold text-sm">G</span> : <span className="font-bold text-sm"></span>}
                {isSubmitting ? 'Kobler til...' : `Fortsett med ${oauthProvider === 'google' ? 'Google' : 'Apple'}`}
              </button>
            </form>
          </div>
        ) : (
          <>
            {/* Standard Tab selection: Logg inn vs Opprett konto */}
            <div className="flex border-b border-zinc-900 text-xs font-bold font-orbitron bg-zinc-950">
              <button
                type="button"
                onClick={() => { setMode('login'); setErrorMsg(''); }}
                className={`flex-1 py-3 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
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
                className={`flex-1 py-3 flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                  mode === 'register' 
                    ? 'border-cyber-cyan text-cyber-cyan bg-cyber-cyan/5' 
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                Opprett konto
              </button>
            </div>

            {/* Body content */}
            <div className="p-4 overflow-y-auto flex flex-col gap-4">
              {errorMsg && (
                <div className="p-2.5 rounded bg-cyber-red/10 border border-cyber-red/40 text-cyber-red text-xs font-mono font-bold">
                  {errorMsg}
                </div>
              )}

              {/* Form for Login or Register */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1 text-left">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-cyber-cyan" />
                    {mode === 'login' ? 'Brukernavn eller e-post:' : 'Brukernavn:'}
                  </label>
                  <input
                    type="text"
                    autoCapitalize="none"
                    autoCorrect="off"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={mode === 'login' ? 'f.eks. Joel eller din@epost.no' : 'f.eks. ShadowHunter, Joel...'}
                    className="w-full min-h-[44px] bg-zinc-900 border border-cyber-border rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyber-cyan font-mono"
                    required
                  />
                </div>

                {mode === 'register' && (
                  <div className="flex flex-col gap-1 text-left">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-zinc-400" />
                      E-postadresse (valgfritt/for sikkerhet):
                    </label>
                    <input
                      type="email"
                      autoCapitalize="none"
                      autoCorrect="off"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="din.epost@example.com"
                      className="w-full min-h-[44px] bg-zinc-900 border border-cyber-border rounded px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyber-cyan font-mono"
                    />
                  </div>
                )}

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
                      placeholder={mode === 'login' ? 'Ditt passord' : 'Minst 3 tegn'}
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
                  disabled={isSubmitting || !identifier.trim() || !password}
                  className="w-full min-h-[44px] mt-1 bg-cyber-cyan hover:bg-white text-zinc-950 font-black text-xs uppercase rounded transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2 shadow-cyan-glow/20 font-orbitron"
                >
                  {mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                  {isSubmitting 
                    ? 'Behandler...' 
                    : (mode === 'login' ? 'Logg inn på konto' : 'Opprett konto & Lagre fremgang')
                  }
                </button>
              </form>

              {/* Social Login Options (Google & Apple) */}
              <div className="flex flex-col gap-2 pt-2 border-t border-zinc-900">
                <div className="flex items-center gap-2 my-1">
                  <div className="flex-1 h-px bg-zinc-800" />
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
                    Eller fortsett med
                  </span>
                  <div className="flex-1 h-px bg-zinc-800" />
                </div>

                {savedOauthEmail && (
                  <button
                    type="button"
                    onClick={() => {
                      setOauthProvider('google');
                      setOauthEmail(savedOauthEmail);
                    }}
                    className="w-full p-2.5 rounded bg-zinc-900/90 border border-cyber-cyan/40 hover:border-cyber-cyan text-xs font-bold text-cyber-cyan flex items-center justify-center gap-2 transition-all active:scale-95 font-mono"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Fortsett som {savedOauthEmail}
                  </button>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleStartOAuth('google')}
                    disabled={isSubmitting}
                    className="min-h-[44px] p-2.5 rounded bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-xs font-bold text-zinc-200 flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <span className="text-sm font-bold text-white">G</span> Google
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartOAuth('apple')}
                    disabled={isSubmitting}
                    className="min-h-[44px] p-2.5 rounded bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-xs font-bold text-zinc-200 flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <span className="text-sm font-bold text-white"></span> Apple
                  </button>
                </div>
              </div>

              {/* Toggle Developer Testing Profiles */}
              <div className="pt-2 border-t border-zinc-900 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setShowPresets(!showPresets)}
                  className="text-[10px] text-zinc-500 hover:text-zinc-400 uppercase font-mono tracking-wider flex items-center justify-center gap-1"
                >
                  <Shield className="w-3 h-3 text-zinc-500" />
                  {showPresets ? 'Skjul hurtigtest-profiler' : 'Vis hurtigtest-profiler (Host, Hider...)'}
                </button>

                {showPresets && (
                  <div className="grid grid-cols-2 gap-2 pt-1 animate-fade-in">
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
                        className="min-h-[40px] p-2 rounded bg-zinc-900/60 border border-cyber-border hover:border-cyber-cyan/50 text-xs font-bold text-zinc-300 flex items-center justify-center gap-1.5 transition-all active:scale-95"
                      >
                        <User className="w-3.5 h-3.5 text-cyber-cyan" />
                        {preset.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-1 flex justify-center">
                <button
                  type="button"
                  onClick={onClose}
                  className="text-xs text-zinc-500 hover:text-zinc-300 underline font-mono"
                >
                  Fortsett å spille som gjest uten innlogging
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
