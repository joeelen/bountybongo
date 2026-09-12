import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '../lib/AuthContext';
import { useToast } from '../lib/ToastContext';
import { Terminal, Lock, User, Mail, Chrome, Apple, Fingerprint, Eye, EyeOff, UserPlus, LogIn, ArrowRight } from 'lucide-react';

const Landing: React.FC = () => {
  const [, setLocation] = useLocation();
  const { login, register, devLogin, authLogin, profile, isGuest } = useAuth();
  const { success: showToastSuccess, error: showToastError } = useToast();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [transferScore, setTransferScore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // OAuth modals
  const [isGoogleModal, setIsGoogleModal] = useState(false);
  const [isAppleModal, setIsAppleModal] = useState(false);
  const [appleEmailInput, setAppleEmailInput] = useState('joel.skoge@icloud.com');

  const guestScore = profile?.score || 0;

  // Handle standard Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameInput.trim()) {
      setError('Vennligst skriv inn brukernavn eller e-post');
      return;
    }
    if (!passwordInput) {
      setError('Vennligst skriv inn passord');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await login({
        username: usernameInput.trim(),
        password: passwordInput
      });
      showToastSuccess('Innlogget!', `Velkommen tilbake, ${usernameInput.trim()}!`);
      setLocation('/');
    } catch (err: any) {
      const msg = err.message || 'Innlogging feilet. Sjekk brukernavn og passord.';
      setError(msg);
      showToastError('Innlogging feilet', msg);
    } finally {
      setLoading(false);
    }
  };

  // Handle Registration
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = usernameInput.trim();
    if (!cleanUser || cleanUser.length < 2) {
      setError('Brukernavn må være minst 2 tegn langt');
      return;
    }
    if (!passwordInput || passwordInput.length < 3) {
      setError('Passord må være minst 3 tegn langt');
      return;
    }
    if (passwordInput !== confirmPasswordInput) {
      setError('Passordene matcher ikke');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await register({
        username: cleanUser,
        password: passwordInput,
        email: emailInput.trim() || undefined,
        transferScore: transferScore && isGuest
      });
      showToastSuccess('Konto opprettet!', `Velkommen til Bounty Grid, ${cleanUser}!`);
      setLocation('/');
    } catch (err: any) {
      const msg = err.message || 'Kunne ikke opprette konto. Prøv et annet brukernavn.';
      setError(msg);
      showToastError('Registrering feilet', msg);
    } finally {
      setLoading(false);
    }
  };

  // Guest Instant Entry
  const handleGuestLogin = async () => {
    setLoading(true);
    setError('');
    try {
      let id = localStorage.getItem('device_player_id');
      if (!id) {
        id = 'player_' + Math.random().toString(36).substring(2, 10);
        localStorage.setItem('device_player_id', id);
      }
      await devLogin(id);
      showToastSuccess('Gjeste-tilgang aktiv', 'Du kan spille med en gang uten passord.');
      setLocation('/');
    } catch (err) {
      setError('Gjestetilgang feilet.');
    } finally {
      setLoading(false);
    }
  };

  // Quick Preset login for developers
  const handleQuickLogin = async (preset: string) => {
    setLoading(true);
    setError('');
    try {
      await devLogin(preset);
      showToastSuccess('Preset aktivert', `Logget inn som ${preset}`);
      setLocation('/');
    } catch (err) {
      setError('Hurtigvalg feilet.');
    } finally {
      setLoading(false);
    }
  };

  // Google Simulated Sign-In
  const handleGoogleSignIn = async (name: string, email: string) => {
    setLoading(true);
    setError('');
    try {
      const username = email.split('@')[0];
      const cleanId = `google_${username}`;

      await authLogin({
        id: cleanId,
        email: email,
        name: name,
        avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${cleanId}`,
        transferScore: transferScore && isGuest ? guestScore : 0
      });
      setIsGoogleModal(false);
      showToastSuccess('Google tilkoblet', `Logget inn som ${name}`);
      setLocation('/');
    } catch (err) {
      setError('Google handshake failed.');
    } finally {
      setLoading(false);
    }
  };

  // Apple Simulated Sign-In
  const handleAppleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      const email = appleEmailInput.trim();
      const username = email.split('@')[0];
      const displayName = username.charAt(0).toUpperCase() + username.slice(1);
      const cleanId = `apple_${username}`;
      await authLogin({
        id: cleanId,
        email: email,
        name: displayName,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanId}`,
        transferScore: transferScore && isGuest ? guestScore : 0
      });
      setIsAppleModal(false);
      showToastSuccess('Apple tilkoblet', `Logget inn som ${displayName}`);
      setLocation('/');
    } catch (err) {
      setError('Apple Authorization failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid-bg flex flex-col items-center justify-center p-4 relative overflow-hidden font-rajdhani">
      {/* Decorative cyber grid lines */}
      <div className="absolute top-1/4 left-0 right-0 h-[1px] bg-cyber-cyan/10 pointer-events-none"></div>
      <div className="absolute top-2/4 left-0 right-0 h-[1px] bg-cyber-cyan/10 pointer-events-none"></div>
      <div className="absolute top-3/4 left-0 right-0 h-[1px] bg-cyber-cyan/10 pointer-events-none"></div>

      <div className="w-full max-w-md z-10 flex flex-col items-center">
        {/* Logo */}
        <div className="text-center mb-6 select-none">
          <div className="text-6xl font-black font-orbitron tracking-tighter text-cyber-cyan glow-cyan mb-1 animate-pulse">
            BOUNTY
          </div>
          <p className="text-[11px] font-bold tracking-widest text-zinc-500 uppercase font-orbitron">
            Wild Zone & Private Match Grid
          </p>
        </div>

        {/* Login / Register Container */}
        <div className="w-full cyber-card border-cyber-cyan/40 rounded-2xl p-5 md:p-7 flex flex-col shadow-cyan-glow/10 bg-zinc-950/90">
          <div className="flex items-center justify-between border-b border-cyber-cyan/20 pb-3 mb-5">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyber-cyan animate-pulse" />
              <h2 className="text-xs font-black font-orbitron text-cyber-cyan tracking-wider uppercase">
                GRID ACCESS PORTAL
              </h2>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">v2.0 CLOUD</span>
          </div>

          {/* Navigation Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-900/80 rounded-xl mb-5 border border-zinc-800">
            <button
              type="button"
              onClick={() => { setTab('login'); setError(''); }}
              className={`py-2.5 rounded-lg text-xs font-bold font-orbitron uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                tab === 'login'
                  ? 'bg-cyber-cyan text-zinc-950 shadow-cyan-glow/20'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              Logg inn
            </button>
            <button
              type="button"
              onClick={() => { setTab('register'); setError(''); }}
              className={`py-2.5 rounded-lg text-xs font-bold font-orbitron uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all ${
                tab === 'register'
                  ? 'bg-cyber-cyan text-zinc-950 shadow-cyan-glow/20'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              Opprett konto
            </button>
          </div>

          {error && (
            <div className="bg-cyber-red/10 border border-cyber-red/40 text-cyber-red rounded-lg p-3 mb-4 text-xs font-bold font-mono tracking-wider animate-pulse text-center">
              ERR: {error}
            </div>
          )}

          {/* TAB 1: LOGIN FORM */}
          {tab === 'login' && (
            <form onSubmit={handleLoginSubmit} className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1 text-left">
                <label className="text-[10px] text-zinc-400 uppercase font-black tracking-wider flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-cyber-cyan" />
                  Brukernavn eller E-post
                </label>
                <input
                  type="text"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="f.eks. Joel, ShadowHunter..."
                  className="w-full min-h-[44px] bg-zinc-900 border border-cyber-border rounded-lg px-3 py-2 text-zinc-100 font-mono text-xs focus:outline-none focus:border-cyber-cyan"
                />
              </div>

              <div className="flex flex-col gap-1 text-left">
                <label className="text-[10px] text-zinc-400 uppercase font-black tracking-wider flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-cyber-cyan" />
                  Passord
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="••••••••"
                    className="w-full min-h-[44px] bg-zinc-900 border border-cyber-border rounded-lg pl-3 pr-10 py-2 text-zinc-100 font-mono text-xs focus:outline-none focus:border-cyber-cyan"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 p-1"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !usernameInput.trim() || !passwordInput}
                className="w-full min-h-[44px] mt-2 bg-cyber-cyan hover:bg-white text-zinc-950 font-black text-xs uppercase font-orbitron tracking-wider rounded-lg transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2 shadow-cyan-glow/20"
              >
                <LogIn className="w-4 h-4" />
                {loading ? 'LOGGER INN...' : 'LOGG INN PÅ GRID'}
              </button>
            </form>
          )}

          {/* TAB 2: REGISTER FORM */}
          {tab === 'register' && (
            <form onSubmit={handleRegisterSubmit} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1 text-left">
                <label className="text-[10px] text-zinc-400 uppercase font-black tracking-wider flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-cyber-cyan" />
                  Ønsket brukernavn
                </label>
                <input
                  type="text"
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="f.eks. Joel, ShadowHunter..."
                  className="w-full min-h-[44px] bg-zinc-900 border border-cyber-border rounded-lg px-3 py-2 text-zinc-100 font-mono text-xs focus:outline-none focus:border-cyber-cyan"
                />
              </div>

              <div className="flex flex-col gap-1 text-left">
                <label className="text-[10px] text-zinc-400 uppercase font-black tracking-wider flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-cyber-cyan" />
                  Velg et passord (minst 3 tegn)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Minst 3 tegn"
                    className="w-full min-h-[44px] bg-zinc-900 border border-cyber-border rounded-lg pl-3 pr-10 py-2 text-zinc-100 font-mono text-xs focus:outline-none focus:border-cyber-cyan"
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

              <div className="flex flex-col gap-1 text-left">
                <label className="text-[10px] text-zinc-400 uppercase font-black tracking-wider flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5 text-zinc-500" />
                  Gjenta passord
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="Gjenta passordet"
                  className="w-full min-h-[44px] bg-zinc-900 border border-cyber-border rounded-lg px-3 py-2 text-zinc-100 font-mono text-xs focus:outline-none focus:border-cyber-cyan"
                />
              </div>

              <div className="flex flex-col gap-1 text-left">
                <label className="text-[10px] text-zinc-400 uppercase font-black tracking-wider flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-zinc-500" />
                  E-postadresse (valgfritt)
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="din.epost@example.com"
                  className="w-full min-h-[44px] bg-zinc-900 border border-cyber-border rounded-lg px-3 py-2 text-zinc-100 font-mono text-xs focus:outline-none focus:border-cyber-cyan"
                />
              </div>

              {isGuest && guestScore > 0 && (
                <label className="flex items-center gap-2 p-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800 text-xs text-zinc-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={transferScore}
                    onChange={(e) => setTransferScore(e.target.checked)}
                    className="w-4 h-4 accent-cyber-cyan rounded"
                  />
                  <span>Behold min gjeste-framgang (<strong>+{guestScore} XP</strong>)</span>
                </label>
              )}

              <button
                type="submit"
                disabled={loading || !usernameInput.trim() || !passwordInput}
                className="w-full min-h-[44px] mt-2 bg-cyber-green hover:bg-white text-zinc-950 font-black text-xs uppercase font-orbitron tracking-wider rounded-lg transition-all active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,255,100,0.2)]"
              >
                <UserPlus className="w-4 h-4" />
                {loading ? 'OPPRETTER KONTO...' : 'OPPRETT KONTO & SPILL'}
              </button>
            </form>
          )}

          {/* Divider */}
          <div className="flex items-center my-5 text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
            <div className="flex-1 h-[1px] bg-zinc-800"></div>
            <span className="px-3">eller spill direkte</span>
            <div className="flex-1 h-[1px] bg-zinc-800"></div>
          </div>

          {/* Guest 1-Click Access Button */}
          <button
            onClick={handleGuestLogin}
            disabled={loading}
            className="w-full min-h-[44px] py-2.5 rounded-xl border-2 border-cyber-cyan/50 hover:border-cyber-cyan bg-cyber-cyan/10 hover:bg-cyber-cyan/20 text-xs font-black text-cyber-cyan hover:text-white transition-all flex items-center justify-center gap-2 uppercase font-orbitron tracking-wider shadow-cyan-glow/20 active:scale-95"
          >
            Fortsett som gjest (Spill nå)
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* OAuth options */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              onClick={() => setIsGoogleModal(true)}
              disabled={loading}
              className="py-2 px-3 rounded-lg border border-zinc-800 hover:border-cyber-cyan bg-zinc-900/60 hover:bg-zinc-850 text-xs font-bold text-zinc-300 hover:text-white transition-all flex items-center justify-center gap-2 font-orbitron"
            >
              <Chrome className="w-3.5 h-3.5 text-cyber-cyan" />
              Google
            </button>
            <button
              onClick={() => setIsAppleModal(true)}
              disabled={loading}
              className="py-2 px-3 rounded-lg border border-zinc-800 hover:border-white bg-zinc-900/60 hover:bg-zinc-850 text-xs font-bold text-zinc-300 hover:text-white transition-all flex items-center justify-center gap-2 font-orbitron"
            >
              <Apple className="w-3.5 h-3.5 text-zinc-300" />
              Apple
            </button>
          </div>

          {/* Quick presets for developers */}
          <div className="mt-6 border-t border-zinc-900 pt-4">
            <span className="block text-[9px] text-zinc-500 uppercase font-black tracking-wider mb-2 text-center">
              Hurtigvalg for testing (Presets)
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {['host', 'hider1', 'hider2', 'seeker1'].map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleQuickLogin(preset)}
                  disabled={loading}
                  className="py-1.5 rounded bg-zinc-900/60 border border-zinc-800 hover:border-cyber-cyan/50 text-[10px] font-black text-zinc-400 hover:text-cyber-cyan transition-all uppercase font-mono"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Field Manual */}
        <div className="w-full mt-5 bg-zinc-950/60 border border-cyber-cyan/15 rounded-xl p-4 shadow-cyan-glow/5">
          <h3 className="text-xs font-black font-orbitron text-cyber-cyan tracking-wider uppercase mb-2.5 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyber-cyan animate-pulse"></span>
            Agent Field Manual
          </h3>
          <div className="flex flex-col gap-2 text-xs text-zinc-400 font-mono leading-relaxed">
            <p><strong className="text-white">1. Wild Zone:</strong> Slå på "ACTIVE" for å kringkaste posisjonen din og tjene XP mens du jakter eller gjemmer deg.</p>
            <p><strong className="text-white">2. Private Matches:</strong> Opprett eller bli med i private kamper med venner. Still inn krympende ringer og tidsfrister.</p>
            <p><strong className="text-white">3. Bomber & Radar:</strong> Legg feller og bruk radaren for å fange andre spillere før tiden går ut!</p>
          </div>
        </div>
      </div>

      {/* --- OAUTH MODALS --- */}

      {/* Google Modal */}
      {isGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-4 font-sans">
          <div className="w-full max-w-sm border border-zinc-800 bg-zinc-950 p-6 rounded-2xl shadow-2xl relative text-left">
            <div className="flex items-center gap-2.5 mb-4">
              <Chrome className="w-6 h-6 text-cyber-cyan" />
              <span className="text-sm font-bold text-white tracking-tight">Logg inn med Google</span>
            </div>

            <div className="flex flex-col gap-2">
              {[
                { name: 'Joel Skoge', email: 'joel.skoge@gmail.com' },
                { name: 'Alex Hunter', email: 'alex.hunter@bounty.com' },
                { name: 'Developer User', email: 'dev.runner@gemini.net' }
              ].map((acc) => (
                <button
                  key={acc.email}
                  onClick={() => handleGoogleSignIn(acc.name, acc.email)}
                  disabled={loading}
                  className="flex items-center gap-3 p-3 rounded-lg border border-zinc-900 bg-zinc-900/30 hover:bg-zinc-900/80 hover:border-zinc-800 transition-colors"
                >
                  <img
                    src={`https://api.dicebear.com/7.x/adventurer/svg?seed=google_${acc.name}`}
                    className="w-8 h-8 rounded-full border border-zinc-800 bg-zinc-950"
                    alt=""
                  />
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-bold text-zinc-200">{acc.name}</span>
                    <span className="text-[10px] text-zinc-500">{acc.email}</span>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setIsGoogleModal(false)}
              className="w-full py-2.5 mt-4 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white rounded-lg text-xs font-bold text-center transition-colors"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}

      {/* Apple Modal */}
      {isAppleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-4 font-sans">
          <div className="w-full max-w-xs border border-zinc-900 bg-zinc-950 p-6 rounded-3xl shadow-2xl relative text-center flex flex-col items-center">
            <Apple className="w-10 h-10 text-white mb-2" />
            <h3 className="text-sm font-bold text-white mb-0.5">Logg inn med Apple ID</h3>
            <span className="text-[10px] text-zinc-500 mb-4">BOUNTY SECURE GRID</span>

            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4 animate-pulse">
              <Fingerprint className="w-8 h-8 text-cyber-cyan" />
            </div>

            <div className="w-full flex flex-col gap-1 text-left mb-4">
              <label className="text-[9px] text-zinc-500 uppercase font-black">Apple ID E-post</label>
              <input
                type="email"
                value={appleEmailInput}
                onChange={(e) => setAppleEmailInput(e.target.value)}
                placeholder="email@icloud.com"
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-300 text-xs focus:outline-none focus:border-white text-center"
              />
            </div>

            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={handleAppleSignIn}
                disabled={loading || !appleEmailInput.includes('@')}
                className="w-full py-2.5 bg-white text-zinc-950 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-zinc-200 transition-colors shadow-lg disabled:opacity-50 font-orbitron"
              >
                <Lock className="w-3.5 h-3.5" />
                {loading ? 'Autoriserer...' : 'Godkjenn med Apple'}
              </button>
              <button
                onClick={() => setIsAppleModal(false)}
                className="w-full py-2 text-zinc-500 hover:text-zinc-300 text-xs font-semibold transition-colors"
              >
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Landing;
