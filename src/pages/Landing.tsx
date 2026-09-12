import React, { useState } from 'react';
import { useAuth } from '../lib/AuthContext';
import { Terminal, Mail, Chrome, Apple, Fingerprint, Lock } from 'lucide-react';

const Landing: React.FC = () => {
  const { devLogin, authLogin } = useAuth();
  const [emailInput, setEmailInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Custom sign-in states to support any user joining online
  const [isGoogleCustom, setIsGoogleCustom] = useState(false);
  const [customGoogleName, setCustomGoogleName] = useState('');
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [appleEmailInput, setAppleEmailInput] = useState('joel.skoge@icloud.com');

  // Dialog overlays state
  const [activeModal, setActiveModal] = useState<'email_otp' | 'google_select' | 'apple_id' | null>(null);

  // Email Submit (First Step)
  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setError('');
    setActiveModal('email_otp');
  };

  // Email OTP Submit (Second Step)
  const handleOtpVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpInput.trim()) return;

    setLoading(true);
    setError('');
    try {
      const email = emailInput.trim();
      const username = email.split('@')[0];
      const displayName = username.charAt(0).toUpperCase() + username.slice(1);
      const cleanId = `email_${username}`;

      await authLogin({
        id: cleanId,
        email: email,
        name: displayName,
        avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanId}`
      });
      setActiveModal(null);
    } catch (err) {
      setError('Email verification failed. Try again.');
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
        avatar: `https://api.dicebear.com/7.x/adventurer/svg?seed=${cleanId}`
      });
      setActiveModal(null);
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
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${cleanId}`
      });
      setActiveModal(null);
    } catch (err) {
      setError('Apple Authorization failed.');
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
    } catch (err) {
      setError('Preset authorization failed.');
    } finally {
      setLoading(false);
    }
  };

  // Guest Login
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
    } catch (err) {
      setError('Guest access failed.');
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

        {/* Login Container */}
        <div className="w-full cyber-card border-cyber-cyan/30 rounded-2xl p-6 md:p-8 flex flex-col shadow-cyan-glow/5">
          <div className="flex items-center gap-2 border-b border-cyber-cyan/20 pb-3 mb-5">
            <Terminal className="w-4 h-4 text-cyber-cyan animate-pulse" />
            <h2 className="text-xs font-black font-orbitron text-cyber-cyan tracking-wider uppercase">
              GRID ACCESS PORTAL
            </h2>
          </div>

          {error && (
            <div className="bg-cyber-red/10 border border-cyber-red/30 text-cyber-red rounded p-2.5 mb-4 text-xs font-bold font-mono tracking-wider animate-pulse text-center">
              ERR: {error}
            </div>
          )}

          {/* Email Form */}
          <form onSubmit={handleEmailSubmit} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1 text-left">
              <label className="text-[10px] text-zinc-500 uppercase font-black tracking-wider">
                SIGN IN VIA SECURED EMAIL
              </label>
              <div className="flex gap-2 mt-1">
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="agent@domain.com"
                  className="flex-1 bg-zinc-900 border border-cyber-border rounded-lg px-3 py-2 text-zinc-300 font-mono text-xs focus:outline-none focus:border-cyber-cyan"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 bg-zinc-800 border border-zinc-700 hover:border-cyber-cyan rounded-lg text-xs font-bold text-cyber-cyan hover:bg-zinc-900 transition-colors uppercase shrink-0"
                >
                  Next
                </button>
              </div>
            </div>
          </form>

          {/* Divider */}
          <div className="flex items-center my-6 text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
            <div className="flex-1 h-[1px] bg-zinc-900"></div>
            <span className="px-3">or authorize with</span>
            <div className="flex-1 h-[1px] bg-zinc-900"></div>
          </div>

          {/* OAuth Buttons */}
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => setActiveModal('google_select')}
              disabled={loading}
              className="w-full py-2.5 rounded-lg border border-zinc-800 hover:border-cyber-cyan bg-zinc-950/40 hover:bg-zinc-900/60 text-xs font-bold text-zinc-300 hover:text-white transition-all flex items-center justify-center gap-2 uppercase font-orbitron tracking-wider"
            >
              <Chrome className="w-4 h-4 text-cyber-cyan" />
              Sign in with Google
            </button>
            <button
              onClick={() => setActiveModal('apple_id')}
              disabled={loading}
              className="w-full py-2.5 rounded-lg border border-zinc-800 hover:border-white bg-zinc-950/40 hover:bg-zinc-900/60 text-xs font-bold text-zinc-300 hover:text-white transition-all flex items-center justify-center gap-2 uppercase font-orbitron tracking-wider"
            >
              <Apple className="w-4 h-4 text-zinc-400" />
              Sign in with Apple
            </button>
            
            <button
              onClick={handleGuestLogin}
              disabled={loading}
              className="w-full py-2.5 mt-2 rounded-lg border border-cyber-cyan/40 hover:border-cyber-cyan bg-cyber-cyan/10 hover:bg-cyber-cyan/20 text-xs font-bold text-cyber-cyan hover:text-white transition-all flex items-center justify-center gap-2 uppercase font-orbitron tracking-wider shadow-cyan-glow/20"
            >
              Continue as Guest
            </button>
          </div>

          {/* Quick presets for testing */}
          <div className="mt-8 border-t border-zinc-900 pt-5">
            <span className="block text-[9px] text-zinc-600 uppercase font-black tracking-wider mb-2.5 text-center">
              Developer Quick Uplink Presets
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {['host', 'hider1', 'hider2', 'seeker1'].map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleQuickLogin(preset)}
                  disabled={loading}
                  className="py-1 rounded bg-zinc-900/60 border border-zinc-800 hover:border-cyber-cyan/50 text-[10px] font-black text-zinc-500 hover:text-cyber-cyan transition-all uppercase"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* How to Play Section */}
        <div className="w-full mt-6 bg-zinc-950/60 border border-cyber-cyan/10 rounded-xl p-5 shadow-cyan-glow/5">
          <h3 className="text-sm font-black font-orbitron text-cyber-cyan tracking-wider uppercase mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyber-cyan animate-pulse"></span>
            Agent Field Manual
          </h3>
          <div className="flex flex-col gap-3 text-xs text-zinc-400 font-mono leading-relaxed">
            <p><strong className="text-white">1. Global Bounty:</strong> Broadcasting your coordinates on the map lets others catch you for XP. High risk, high reward.</p>
            <p><strong className="text-white">2. Private Matches:</strong> Host hide & seek lobbies. Set boundary radii and countdowns.</p>
            <p><strong className="text-white">3. Catching & Bombs:</strong> In matches, Seekers get GPS radar pings of Hiders. Walk within range to capture, or deploy blast bombs at your location to trap evasive targets.</p>
          </div>
        </div>
      </div>

      {/* --- MOCK AUTHENTICATION OVERLAYS --- */}

      {/* 1. Email OTP Modal */}
      {activeModal === 'email_otp' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm cyber-card border-cyber-cyan/40 bg-zinc-950 p-6 rounded-xl shadow-cyan-glow/10 text-center relative">
            <Mail className="w-10 h-10 text-cyber-cyan mx-auto mb-3 animate-pulse" />
            <h3 className="text-sm font-black font-orbitron text-cyber-cyan tracking-wider uppercase mb-1">
              Verify OTP Transmission
            </h3>
            <p className="text-xs text-zinc-400 mb-4 leading-normal">
              A temporary passcode has been routed to <strong className="text-white">{emailInput}</strong>. Enter it below:
            </p>

            <form onSubmit={handleOtpVerify} className="flex flex-col gap-3">
              <input
                type="text"
                required
                maxLength={4}
                value={otpInput}
                onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                placeholder="4-DIGIT PIN (EX: 1234)"
                className="bg-zinc-900 border border-cyber-border rounded-lg px-4 py-2.5 text-center font-mono text-lg tracking-widest text-cyber-cyan focus:outline-none focus:border-cyber-cyan"
              />
              <div className="flex gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveModal(null);
                    setOtpInput('');
                  }}
                  className="flex-1 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-bold text-zinc-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || otpInput.length !== 4}
                  className="flex-1 py-2 bg-cyber-cyan text-zinc-950 rounded-lg text-xs font-black font-orbitron tracking-wider transition-all disabled:opacity-50"
                >
                  {loading ? 'VERIFYING...' : 'CONFIRM UPLINK'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Google Account Chooser Modal */}
      {activeModal === 'google_select' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-4 font-sans">
          <div className="w-full max-w-sm border border-zinc-800 bg-zinc-950 p-6 rounded-2xl shadow-2xl relative text-left">
            <div className="flex items-center gap-2.5 mb-4">
              <Chrome className="w-6 h-6 text-cyber-cyan" />
              <span className="text-sm font-bold text-white tracking-tight">Sign in with Google</span>
            </div>

            {isGoogleCustom ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (customGoogleName.trim() && customGoogleEmail.trim()) {
                    handleGoogleSignIn(customGoogleName.trim(), customGoogleEmail.trim());
                  }
                }}
                className="flex flex-col gap-3"
              >
                <p className="text-xs text-zinc-400 mb-2 leading-normal">
                  Enter your Google Account details:
                </p>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-500 uppercase font-black">Full Name</label>
                  <input
                    type="text"
                    required
                    value={customGoogleName}
                    onChange={(e) => setCustomGoogleName(e.target.value)}
                    placeholder="Agent Name"
                    className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300 text-xs focus:outline-none focus:border-cyber-cyan"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-500 uppercase font-black">Email Address</label>
                  <input
                    type="email"
                    required
                    value={customGoogleEmail}
                    onChange={(e) => setCustomGoogleEmail(e.target.value)}
                    placeholder="agent@gmail.com"
                    className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-300 text-xs focus:outline-none focus:border-cyber-cyan"
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setIsGoogleCustom(false)}
                    className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 rounded-lg text-xs font-bold"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2 bg-cyber-cyan text-zinc-950 rounded-lg text-xs font-bold font-orbitron uppercase"
                  >
                    {loading ? 'Authorizing...' : 'Sign In'}
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p className="text-xs text-zinc-400 mb-5 leading-normal">
                  Select an account to authorize connection to <strong className="text-cyber-cyan">BOUNTY.GRID</strong>:
                </p>

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
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-zinc-200">{acc.name}</span>
                        <span className="text-[10px] text-zinc-500">{acc.email}</span>
                      </div>
                    </button>
                  ))}

                  <button
                    onClick={() => setIsGoogleCustom(true)}
                    className="py-2.5 rounded-lg border border-zinc-800 border-dashed hover:border-cyber-cyan text-xs font-bold text-zinc-400 hover:text-white transition-all uppercase"
                  >
                    + Use Another Account
                  </button>
                </div>

                <button
                  onClick={() => {
                    setActiveModal(null);
                    setIsGoogleCustom(false);
                  }}
                  className="w-full py-2 mt-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-xs font-bold text-center transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 3. Apple ID Passcode/FaceID Modal */}
      {activeModal === 'apple_id' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-xs border border-zinc-900 bg-zinc-950 p-6 rounded-3xl shadow-2xl relative text-center flex flex-col items-center">
            <Apple className="w-10 h-10 text-white mb-2" />
            <h3 className="text-sm font-bold text-white mb-0.5">Sign in with Apple ID</h3>
            <span className="text-[10px] text-zinc-500 mb-5">BOUNTY SECURE GRID</span>

            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-5 animate-pulse">
              <Fingerprint className="w-8 h-8 text-cyber-cyan" />
            </div>

            <div className="w-full flex flex-col gap-1 text-left mb-5">
              <label className="text-[9px] text-zinc-500 uppercase font-black">Apple ID Email</label>
              <input
                type="email"
                required
                value={appleEmailInput}
                onChange={(e) => setAppleEmailInput(e.target.value)}
                placeholder="email@icloud.com"
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-zinc-300 text-xs focus:outline-none focus:border-white text-center"
              />
            </div>

            <p className="text-[11px] text-zinc-500 mb-5 leading-normal px-2">
              Confirm your credentials using Touch ID, Face ID, or biometric device authentication.
            </p>

            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={handleAppleSignIn}
                disabled={loading || !appleEmailInput.includes('@')}
                className="w-full py-2.5 bg-white text-zinc-950 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-zinc-200 transition-colors shadow-lg disabled:opacity-50"
              >
                <Lock className="w-3.5 h-3.5" />
                {loading ? 'Authorizing...' : 'Authorize with Apple'}
              </button>
              <button
                onClick={() => setActiveModal(null)}
                className="w-full py-2 text-zinc-500 hover:text-zinc-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Landing;
