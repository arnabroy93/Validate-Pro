import React, { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '../../supabase';
import { useAuth } from './useAuth';

export interface Features {
  validation: boolean;
  records: boolean;
  reports: boolean;
  insights: boolean;
  global_insights: boolean;
  users: boolean;
  user_activity: boolean;
  health: boolean;
  powerbi: boolean;
  upload_logs: boolean;
}

const defaultFeatures: Features = {
  validation: true,
  records: true,
  reports: true,
  insights: true,
  global_insights: true,
  users: true,
  user_activity: true,
  health: true,
  powerbi: true,
  upload_logs: true,
};

const FeaturesContext = createContext<{
  features: Features;
  globalFeatures: Features;
  userOverrides: Record<string, Partial<Features>>;
  updateFeature: (key: keyof Features, value: boolean) => Promise<void>;
  updateUserOverride: (username: string, key: keyof Features, value: boolean | 'default') => Promise<void>;
}>({
  features: defaultFeatures,
  globalFeatures: defaultFeatures,
  userOverrides: {},
  updateFeature: async () => {},
  updateUserOverride: async () => {},
});

export const FeaturesProvider = ({ children }: { children: React.ReactNode }) => {
  const { profile } = useAuth();
  const [globalFeatures, setGlobalFeatures] = useState<Features>(defaultFeatures);
  const [userOverrides, setUserOverrides] = useState<Record<string, Partial<Features>>>({});

  // Helper to parse features payload
  const parsePayload = (value: any) => {
    if (!value) return;
    
    const parsedGlobal: Features = {
      validation: value.validation !== undefined ? !!value.validation : defaultFeatures.validation,
      records: value.records !== undefined ? !!value.records : defaultFeatures.records,
      reports: value.reports !== undefined ? !!value.reports : defaultFeatures.reports,
      insights: value.insights !== undefined ? !!value.insights : defaultFeatures.insights,
      global_insights: value.global_insights !== undefined ? !!value.global_insights : defaultFeatures.global_insights,
      users: value.users !== undefined ? !!value.users : defaultFeatures.users,
      user_activity: value.user_activity !== undefined ? !!value.user_activity : defaultFeatures.user_activity,
      health: value.health !== undefined ? !!value.health : defaultFeatures.health,
      powerbi: value.powerbi !== undefined ? !!value.powerbi : defaultFeatures.powerbi,
      upload_logs: value.upload_logs !== undefined ? !!value.upload_logs : defaultFeatures.upload_logs,
    };

    setGlobalFeatures(parsedGlobal);
    setUserOverrides(value.user_overrides || {});
  };

  useEffect(() => {
    const fetchFeatures = async () => {
      const { data, error } = await supabase.from('app_settings').select('value').eq('id', 'feature_flags').single();
      if (!error && data?.value) {
        parsePayload(data.value);
      }
    };
    
    fetchFeatures();

    const subscription = supabase
      .channel('app_settings_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'id=eq.feature_flags' }, (payload) => {
        if (payload.new && payload.new.value) {
          parsePayload(payload.new.value);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const saveSettings = async (globalFlags: Features, overrides: Record<string, Partial<Features>>) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    
    if (token) {
      const payload = {
        ...globalFlags,
        user_overrides: overrides
      };

      try {
        const res = await fetch('/api/settings/features', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          console.error('Failed to save feature settings:', await res.text());
        }
      } catch (err) {
        console.error('Error saving feature settings:', err);
      }
    }
  };

  const updateFeature = async (key: keyof Features, value: boolean) => {
    const newGlobal = { ...globalFeatures, [key]: value };
    setGlobalFeatures(newGlobal);
    await saveSettings(newGlobal, userOverrides);
  };

  const updateUserOverride = async (username: string, key: keyof Features, value: boolean | 'default') => {
    const cleanUsername = username.toLowerCase().trim();
    const userOverride = { ...(userOverrides[cleanUsername] || {}) };

    if (value === 'default') {
      delete userOverride[key];
    } else {
      userOverride[key] = value;
    }

    const newOverrides = { ...userOverrides };
    if (Object.keys(userOverride).length === 0) {
      delete newOverrides[cleanUsername];
    } else {
      newOverrides[cleanUsername] = userOverride;
    }

    setUserOverrides(newOverrides);
    await saveSettings(globalFeatures, newOverrides);
  };

  // Compute actual features for current user
  const currentUsername = profile?.username?.toLowerCase().trim();
  const computedFeatures: Features = { ...globalFeatures };

  if (currentUsername && userOverrides[currentUsername]) {
    const overrides = userOverrides[currentUsername];
    (Object.keys(overrides) as Array<keyof Features>).forEach((key) => {
      if (overrides[key] !== undefined) {
        computedFeatures[key] = overrides[key]!;
      }
    });
  }

  return (
    <FeaturesContext.Provider value={{ 
      features: computedFeatures, 
      globalFeatures, 
      userOverrides, 
      updateFeature, 
      updateUserOverride 
    }}>
      {children}
    </FeaturesContext.Provider>
  );
};

export const useFeatures = () => useContext(FeaturesContext);

