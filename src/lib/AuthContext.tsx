import React, { createContext, useContext } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface User {
  id: string;
  email: string;
  name: string;
  avatar: string;
}

interface Profile {
  id: string;
  lat: number;
  lng: number;
  score: number;
  bountyActive: boolean;
  isSpecial: boolean;
  isDark: boolean;
  updatedAt: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  devLogin: (username: string) => Promise<any>;
  authLogin: (credentials: { id?: string; username?: string; email?: string; name?: string; avatar?: string; transferScore?: number }) => Promise<any>;
  linkCloudAccount: (credentials: { username: string; email?: string; transferScore?: boolean }) => Promise<any>;
  switchToGuest: () => void;
  logout: () => void;
  toggleDark: (active: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();

  // Query: get current user state
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/me');
        if (!res.ok) throw new Error('Failed to fetch auth state');
        return await res.json();
      } catch (err) {
        console.warn('Auth state fetch warning:', err);
        return null;
      }
    },
    refetchInterval: 5000,
    retry: 2
  });

  // Local persistent guest bootstrap fallback
  const localGuestId = (() => {
    let id = localStorage.getItem('device_player_id') || localStorage.getItem('dev_user_id');
    if (!id) {
      id = 'player_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('device_player_id', id);
      localStorage.setItem('dev_user_id', id);
    }
    return id;
  })();

  const guestFallbackUser: User = {
    id: localGuestId,
    email: `${localGuestId}@bounty.com`,
    name: localGuestId.replace(/^player_/, 'Runner_'),
    avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${localGuestId}`
  };

  const guestFallbackProfile: Profile = {
    id: localGuestId,
    lat: 59.9139,
    lng: 10.7522,
    score: 0,
    bountyActive: false,
    isSpecial: false,
    isDark: false,
    updatedAt: new Date().toISOString()
  };

  const hasServerUser = !!(data && data.authenticated && data.user);
  const user: User = hasServerUser ? data.user : guestFallbackUser;
  const profile: Profile = (hasServerUser && data.profile) ? data.profile : guestFallbackProfile;
  const isAuthenticated = true;

  const isCloudStored = localStorage.getItem('is_cloud_account') === 'true';
  const isGuest = !hasServerUser || (!isCloudStored && (user.id.startsWith('player_') || user.id.startsWith('guest_')));

  // Sync localStorage with API response
  React.useEffect(() => {
    if (data) {
      if (data.authenticated && data.user?.id) {
        localStorage.setItem('dev_user_id', data.user.id);
      }
    }
  }, [data]);

  // Mutation: Dev login
  const loginMutation = useMutation({
    mutationFn: async (username: string) => {
      const res = await fetch('/api/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      if (!res.ok) throw new Error('Dev login failed');
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.username) {
        localStorage.setItem('dev_user_id', data.username);
        localStorage.setItem('is_cloud_account', 'true');
      }
      queryClient.invalidateQueries({ queryKey: ['me'] });
    }
  });

  // Mutation: Logout
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/dev-logout', { method: 'POST' });
      if (!res.ok) throw new Error('Logout failed');
      return res.json();
    },
    onSuccess: () => {
      localStorage.removeItem('is_cloud_account');
      let guestId = localStorage.getItem('device_player_id');
      if (!guestId) {
        guestId = 'player_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('device_player_id', guestId);
      }
      localStorage.setItem('dev_user_id', guestId);
      queryClient.invalidateQueries({ queryKey: ['me'] });
    }
  });

  const toggleDarkMutation = useMutation({
    mutationFn: async (isDark: boolean) => {
      const res = await fetch('/api/profile/dark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDark })
      });
      if (!res.ok) throw new Error('Failed to toggle Go Dark status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] });
    }
  });

  // Mutation: Auth login (Google, Apple, Email, or Username Cloud Sync)
  const authLoginMutation = useMutation({
    mutationFn: async (credentials: { id?: string; username?: string; email?: string; name?: string; avatar?: string; transferScore?: number }) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Authentication failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.user?.id) {
        localStorage.setItem('dev_user_id', data.user.id);
        localStorage.setItem('is_cloud_account', 'true');
      }
      queryClient.invalidateQueries({ queryKey: ['me'] });
    }
  });

  const devLogin = async (username: string) => {
    return loginMutation.mutateAsync(username);
  };

  const authLogin = async (credentials: { id?: string; username?: string; email?: string; name?: string; avatar?: string; transferScore?: number }) => {
    return authLoginMutation.mutateAsync(credentials);
  };

  const linkCloudAccount = async ({ username, email, transferScore }: { username: string; email?: string; transferScore?: boolean }) => {
    const currentScore = transferScore ? (profile?.score || 0) : 0;
    return authLogin({
      id: username.trim().toLowerCase().replace(/\s+/g, '_'),
      name: username.trim(),
      email: email?.trim() || `${username.trim().toLowerCase().replace(/\s+/g, '_')}@bounty.com`,
      transferScore: currentScore
    });
  };

  const switchToGuest = () => {
    localStorage.removeItem('is_cloud_account');
    let guestId = localStorage.getItem('device_player_id');
    if (!guestId) {
      guestId = 'player_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('device_player_id', guestId);
    }
    localStorage.setItem('dev_user_id', guestId);
    queryClient.invalidateQueries({ queryKey: ['me'] });
  };

  const logout = () => {
    logoutMutation.mutate();
  };

  const toggleDark = (active: boolean) => {
    toggleDarkMutation.mutate(active);
  };

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      isAuthenticated,
      isGuest,
      isLoading,
      devLogin,
      authLogin,
      linkCloudAccount,
      switchToGuest,
      logout,
      toggleDark
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
