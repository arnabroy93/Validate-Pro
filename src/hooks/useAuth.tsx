import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { supabase, type Profile } from '../../supabase';
import { type User } from '@supabase/supabase-js';
import { toast } from 'react-hot-toast';

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Helper to create an immediate optimistic profile from Supabase User
function createOptimisticProfile(authUser: User): Profile {
  const metaUsername = authUser.user_metadata?.username;
  const emailUsername = authUser.email ? authUser.email.split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '') : 'user';
  const username = metaUsername || emailUsername || 'user';
  
  const isMasterAdmin = authUser.email === 'admin@validpro.internal' || 
                        username.toLowerCase() === 'admin' ||
                        authUser.user_metadata?.role === 'admin';

  return {
    id: authUser.id,
    username,
    email: authUser.email || '',
    role: isMasterAdmin ? 'admin' : ((authUser.user_metadata?.role as any) || 'user'),
    is_disabled: false,
    created_at: authUser.created_at || new Date().toISOString()
  };
}

// Timeout wrapper helper
function withTimeout<T>(promise: PromiseLike<T>, ms: number, fallbackValue: T): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      resolve(fallbackValue);
    }, ms);
  });

  return Promise.race([
    Promise.resolve(promise).then((res) => {
      clearTimeout(timer);
      return res;
    }),
    timeoutPromise
  ]);
}

// Clear all supabase tokens from localStorage
function clearLocalAuthTokens() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('supabase') || key.includes('-auth-token') || key.includes('sb-'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    console.warn('[Auth] Error clearing tokens:', e);
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  
  const activeProfilePromiseRef = useRef<Promise<Profile | null> | null>(null);
  const activeUserIdRef = useRef<string | null>(null);

  const fetchProfileAsync = useCallback(async (userId: string, authUser: User): Promise<Profile | null> => {
    // If a request is already running for this user, reuse the promise
    if (activeUserIdRef.current === userId && activeProfilePromiseRef.current) {
      return activeProfilePromiseRef.current;
    }

    activeUserIdRef.current = userId;

    const promise = (async () => {
      try {
        // Query profile from Supabase with 2.5s timeout
        const queryPromise = supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        const { data, error } = await withTimeout(
          queryPromise,
          2500,
          { data: null, error: new Error('Profile query timeout') } as any
        );

        if (error && error.message !== 'Profile query timeout') {
          console.warn('[Auth] Profiles query note:', error.message);
        }

        const isMasterAdmin = authUser.email === 'admin@validpro.internal' || 
                              authUser.user_metadata?.username?.toLowerCase() === 'admin' ||
                              data?.username?.toLowerCase() === 'admin';

        const isExemptUser = isMasterAdmin || 
                             data?.role === 'admin' || 
                             data?.username?.toLowerCase() === 'arnab.roy' ||
                             authUser.email?.toLowerCase().includes('arnab');

        // Check if regular non-admin account is disabled
        if (data && data.is_disabled) {
          if (isExemptUser) {
            data.is_disabled = false;
            // Background auto-heal
            fetch(`/api/admin/users/${userId}/toggle-status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_disabled: false })
            }).catch(() => {});
          } else {
            toast.error('This account has been disabled by the administrator.');
            await supabase.auth.signOut().catch(() => {});
            clearLocalAuthTokens();
            setUser(null);
            setProfile(null);
            setLoading(false);
            return null;
          }
        }

        if (data) {
          // If master admin role needs sync
          if (isMasterAdmin && data.role !== 'admin') {
            data.role = 'admin';
            Promise.resolve(supabase.from('profiles').update({ role: 'admin' }).eq('id', userId)).catch(() => {});
          }
          setProfile(data);
          return data;
        }

        // Profile not found in database: sync via backend API
        const sessionRes = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
        const session = sessionRes?.data?.session;
        
        if (session?.access_token) {
          const syncPromise = fetch('/api/auth/profile/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              userId,
              username: authUser.user_metadata?.username || authUser.email?.split('@')[0] || (isMasterAdmin ? 'admin' : 'user'),
              email: authUser.email || '',
              isMasterAdmin
            })
          });

          const syncRes = await withTimeout(syncPromise, 2500, null);
          if (syncRes && syncRes.ok) {
            const syncData = await syncRes.json();
            if (syncData?.profile) {
              setProfile(syncData.profile);
              return syncData.profile;
            }
          }
        }

        // Fallback to optimistic profile if database sync is pending
        const fallback = createOptimisticProfile(authUser);
        setProfile(fallback);
        return fallback;
      } catch (err) {
        console.warn('[Auth] Background profile sync completed with fallback:', err);
        const fallback = createOptimisticProfile(authUser);
        setProfile(fallback);
        return fallback;
      } finally {
        activeProfilePromiseRef.current = null;
      }
    })();

    activeProfilePromiseRef.current = promise;
    return promise;
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Safety timeout: Never let the loading screen stay stuck for more than 2 seconds
    const safetyTimer = setTimeout(() => {
      if (isMounted) {
        setLoading(false);
      }
    }, 2000);

    const initializeAuth = async () => {
      try {
        // Fast session check with 2s timeout
        const sessionPromise = supabase.auth.getSession();
        const { data, error } = await withTimeout(
          sessionPromise,
          2000,
          { data: { session: null }, error: null } as any
        );

        if (error) {
          const isRefreshTokenError = error?.message?.includes('Refresh Token') || 
                                      error?.message?.includes('refresh_token');
          if (isRefreshTokenError) {
            clearLocalAuthTokens();
            await supabase.auth.signOut().catch(() => {});
          }
        }

        const session = data?.session;
        if (!isMounted) return;

        if (session?.user) {
          setUser(session.user);
          // Set optimistic profile immediately so UI renders without delay
          const initialProfile = createOptimisticProfile(session.user);
          setProfile(initialProfile);
          setLoading(false);
          clearTimeout(safetyTimer);

          // Fetch full authoritative profile in background
          fetchProfileAsync(session.user.id, session.user);
        } else {
          setUser(null);
          setProfile(null);
          setLoading(false);
          clearTimeout(safetyTimer);
        }
      } catch (error: any) {
        console.warn('[Auth] Initialization error handled:', error);
        if (isMounted) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          clearTimeout(safetyTimer);
        }
      }
    };

    initializeAuth();

    // Listen to real-time auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;

      if (event === 'SIGNED_OUT' || !session?.user) {
        activeUserIdRef.current = null;
        activeProfilePromiseRef.current = null;
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setUser(session.user);
      // Immediately hydrate optimistic profile
      const optimistic = createOptimisticProfile(session.user);
      setProfile((prev) => prev || optimistic);
      setLoading(false);

      // Validate authoritative profile
      fetchProfileAsync(session.user.id, session.user);
    });

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, [fetchProfileAsync]);

  const signOut = async () => {
    try {
      activeUserIdRef.current = null;
      activeProfilePromiseRef.current = null;
      setUser(null);
      setProfile(null);
      setLoading(false);
      clearLocalAuthTokens();
      await supabase.auth.signOut().catch(() => {});
    } catch (err) {
      console.warn('[Auth] Sign out cleanup error:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

