import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, type Profile } from '../../supabase';
import { type User } from '@supabase/supabase-js';

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id, session.user);
        } else {
          setLoading(false);
        }
      } catch (error: any) {
        console.error('Auth Session Error:', error);
        
        const isRefreshTokenError = error?.message?.includes('Refresh Token Not Found') || 
                                    error?.message?.includes('Invalid Refresh Token') || 
                                    error?.message?.includes('refresh_token_not_found');

        if (retryCount < maxRetries && !isRefreshTokenError) {
          retryCount++;
          console.log(`Retrying auth initialization (${retryCount}/${maxRetries})...`);
          setTimeout(initializeAuth, 1000 * retryCount);
          return;
        }

        if (isRefreshTokenError) {
          console.warn('Invalid refresh token found. Force clearing local session.');
          try {
            // Strip any leftover tokens from localStorage that might be keeping us stuck
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.includes('-auth-token')) {
                localStorage.removeItem(key);
              }
            }
            await supabase.auth.signOut().catch(() => {});
          } catch (err) {
            console.error('Error during forced sign out:', err);
          }
          setUser(null);
          setProfile(null);
        }
        setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id, session.user);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string, authUser: User) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        throw error;
      }
      
      const isMasterAdmin = authUser.email === 'admin@validpro.internal' || authUser.user_metadata?.username === 'admin';

      if (!data) {
        // Create profile securely using backend API to bypass RLS issues completely
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No active session for profile creation');
        
        const response = await fetch('/api/auth/profile/sync', {
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
        
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to sync profile via API');
        }
        
        const { profile: newProfile } = await response.json();
        setProfile(newProfile);
      } else {
        // Force upgrade if master admin but role is user
        if (isMasterAdmin && data.role !== 'admin') {
          const { data: updatedProfile, error: updateError } = await supabase
            .from('profiles')
            .update({ role: 'admin' })
            .eq('id', userId)
            .select()
            .single();
          if (!updateError) {
            setProfile(updatedProfile);
            return;
          }
        }
        setProfile(data);
      }
    } catch (error: any) {
      console.error('Error fetching/creating profile:', error);
      // We don't throw here to avoid infinite loading, but the app might be semi-functional
    } finally {
      setLoading(false);
    }
  }

  const signOut = async () => {
    await supabase.auth.signOut();
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
