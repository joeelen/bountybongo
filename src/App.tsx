import React, { useState } from 'react';
import { Route, Switch, Link, useLocation } from 'wouter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './lib/AuthContext';
import { GpsProvider } from './lib/GpsContext';
import { ToastProvider } from './lib/ToastContext';
import Landing from './pages/Landing';
import LiveMap from './pages/LiveMap';
import Matches from './pages/Matches';
import Social from './pages/Social';
import Leaderboard from './pages/Leaderboard';
import ProfilePage from './pages/Profile';
import DevGpsSimulator from './components/DevGpsSimulator';
import { CloudAuthModal } from './components/CloudAuthModal';
import { Sun, Moon } from 'lucide-react';
import { ThemeProvider, useTheme } from './lib/ThemeContext';

const queryClient = new QueryClient();

const Navigation: React.FC = () => {
  const { user, profile, isGuest, toggleDark, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [location] = useLocation();
  const [cloudModalOpen, setCloudModalOpen] = useState(false);

  // Detect active match to prevent chat occlusion and accidental navigation
  const hasActiveMatch = typeof window !== 'undefined' && !!sessionStorage.getItem('active_match_id');
  const isMatchActive = location === '/matches' && hasActiveMatch;

  if (!user) return null;

  return (
    <>
      {/* Top navigation header with safe-area notch padding */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-cyber-cyan/20 bg-cyber-bg/90 backdrop-blur-md px-4 pl-[calc(1rem+env(safe-area-inset-left,0px))] pr-[calc(1rem+env(safe-area-inset-right,0px))] pt-[calc(0.5rem+env(safe-area-inset-top,0px))] pb-2 min-h-[calc(3.5rem+env(safe-area-inset-top,0px))] flex items-center justify-between shadow-cyan-glow/10">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xl font-black font-orbitron tracking-tighter text-cyber-cyan glow-cyan cursor-pointer">
            BOUNTY
          </Link>
          
          <div className="hidden md:flex items-center gap-4 text-sm font-semibold tracking-wider font-rajdhani">
            <Link href="/" className={`hover:text-cyber-cyan transition-colors uppercase ${location === '/' ? 'text-cyber-cyan border-b border-cyber-cyan/50' : 'text-cyber-muted'}`}>
              Wild Zone
            </Link>
            <Link href="/matches" className={`hover:text-cyber-cyan transition-colors uppercase ${location === '/matches' ? 'text-cyber-cyan border-b border-cyber-cyan/50' : 'text-cyber-muted'}`}>
              Matches
            </Link>
            <Link href="/social" className={`hover:text-cyber-cyan transition-colors uppercase ${location === '/social' ? 'text-cyber-cyan border-b border-cyber-cyan/50' : 'text-cyber-muted'}`}>
              Social
            </Link>
            <Link href="/leaderboard" className={`hover:text-cyber-cyan transition-colors uppercase ${location === '/leaderboard' ? 'text-cyber-cyan border-b border-cyber-cyan/50' : 'text-cyber-muted'}`}>
              Rankings
            </Link>
            <Link href="/profile" className={`hover:text-cyber-cyan transition-colors uppercase ${location === '/profile' ? 'text-cyber-cyan border-b border-cyber-cyan/50' : 'text-cyber-muted'}`}>
              Profile
            </Link>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 font-rajdhani">
          {/* Outdoor Bright / Cyberpunk Dark Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center border transition-all active:scale-95 bg-zinc-900/80 border-cyber-yellow/40 hover:border-cyber-yellow hover:bg-cyber-yellow/10 text-cyber-yellow shadow-yellow-glow/20 shrink-0"
            title={theme === 'bright' ? 'Switch to Cyberpunk Dark Mode' : 'Switch to Outdoor Bright Mode'}
            aria-label={theme === 'bright' ? 'Switch to Dark Mode' : 'Switch to Bright Mode'}
          >
            {theme === 'bright' ? (
              <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-amber-500" />
            ) : (
              <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-cyber-yellow animate-pulse" />
            )}
          </button>

          {/* Wild Zone Active / Offline Toggle */}
          <button
            onClick={() => toggleDark(!profile?.isDark)}
            className={`px-3 py-1 rounded text-xs font-bold border uppercase transition-all duration-300 ${
              profile?.isDark
                ? 'bg-cyber-green/10 text-cyber-green border-cyber-green/50 shadow-[0_0_10px_rgba(0,255,100,0.2)] animate-pulse'
                : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-white'
            }`}
          >
            {profile?.isDark ? '● ACTIVE' : '○ OFFLINE'}
          </button>

          {/* Cloud save button / Profile capsule */}
          <button
            onClick={() => setCloudModalOpen(true)}
            className="flex items-center gap-2 bg-zinc-900/80 hover:bg-zinc-800 border border-cyber-border hover:border-cyber-cyan/40 rounded-full pl-2 pr-3 py-1 transition-all active:scale-95 text-left"
            title={isGuest ? 'Playing as Guest — Click to Save to Cloud' : 'Cloud Account Active — Click to Manage'}
          >
            <div className="relative">
              <img src={user.avatar} alt={user.name} className="w-6 h-6 rounded-full border border-cyber-cyan/30 bg-zinc-950" />
              {isGuest ? (
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyber-yellow border border-zinc-950" title="Guest Account" />
              ) : (
                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-cyber-green border border-zinc-950" title="Cloud Verified" />
              )}
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold leading-tight max-w-[85px] truncate">{user.name}</span>
                {isGuest && (
                  <span className="text-[10px] bg-cyber-yellow/15 text-cyber-yellow px-1.5 py-0.5 rounded uppercase font-black">Guest</span>
                )}
              </div>
              <span className="text-[10px] text-cyber-cyan leading-tight">{profile?.score ?? 0} XP</span>
            </div>
          </button>

          {/* Dev Logout / Switch */}
          <button 
            onClick={logout} 
            className="hover:text-cyber-red text-cyber-muted text-xs font-bold uppercase transition-colors hidden sm:block"
            title="Log out or switch account"
          >
            Exit
          </button>
        </div>
      </header>
      
      {/* Mobile nav bar floating bottom with home-indicator safe-area padding (z-30 ensures in-match chat drawer z-40 has priority; hidden during active match) */}
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-cyber-cyan/20 bg-cyber-bg/95 backdrop-blur-md items-center justify-around px-2 pl-[calc(0.5rem+env(safe-area-inset-left,0px))] pr-[calc(0.5rem+env(safe-area-inset-right,0px))] pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] min-h-[calc(3.5rem+env(safe-area-inset-bottom,0px))] font-semibold text-xs font-rajdhani tracking-wider ${
        isMatchActive ? 'hidden' : 'flex'
      }`}>
        <Link href="/" className={`${location === '/' ? 'text-cyber-cyan' : 'text-cyber-muted'}`}>Wild Zone</Link>
        <Link href="/matches" className={`${location === '/matches' ? 'text-cyber-cyan' : 'text-cyber-muted'}`}>Matches</Link>
        <Link href="/social" className={`${location === '/social' ? 'text-cyber-cyan' : 'text-cyber-muted'}`}>Social</Link>
        <Link href="/leaderboard" className={`${location === '/leaderboard' ? 'text-cyber-cyan' : 'text-cyber-muted'}`}>Rank</Link>
        <Link href="/profile" className={`${location === '/profile' ? 'text-cyber-cyan' : 'text-cyber-muted'}`}>Profile</Link>
      </nav>

      {/* Cloud Account Modal */}
      <CloudAuthModal 
        isOpen={cloudModalOpen} 
        onClose={() => setCloudModalOpen(false)} 
      />
    </>
  );
};

const MainRoutes: React.FC = () => {
  const { isLoading, user } = useAuth();

  if (isLoading && !user) {
    return (
      <div className="min-h-screen bg-cyber-bg flex items-center justify-center font-orbitron">
        <div className="text-cyber-cyan text-[11px] tracking-widest uppercase animate-pulse">
          Connecting to Grid...
        </div>
      </div>
    );
  }

  return (
    <div className="pt-[calc(4rem+env(safe-area-inset-top,0px))] pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:pb-0 h-screen h-[100dvh] w-screen overflow-hidden flex flex-col relative">
      <Navigation />
      <Switch>
        <Route path="/" component={LiveMap} />
        <Route path="/matches" component={Matches} />
        <Route path="/social" component={Social} />
        <Route path="/leaderboard" component={Leaderboard} />
        <Route path="/profile" component={ProfilePage} />
        <Route path="/login" component={Landing} />
        <Route>
          <div className="flex flex-col items-center justify-center flex-1 font-orbitron">
            <h2 className="text-2xl text-cyber-red glow-red">404 - Grid Segment Lost</h2>
            <Link href="/" className="mt-4 text-cyber-cyan hover:underline">Re-route to Base</Link>
          </div>
        </Route>
      </Switch>
      
      {/* Floating developer coordinates simulator */}
      <DevGpsSimulator />
    </div>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ThemeProvider>
          <AuthProvider>
            <GpsProvider>
              <div className="relative min-h-screen bg-cyber-bg overflow-x-hidden">
                <div className="scanlines"></div>
                <MainRoutes />
              </div>
            </GpsProvider>
          </AuthProvider>
        </ThemeProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
