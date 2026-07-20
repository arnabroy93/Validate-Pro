import React, { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '../../supabase';

interface Features {
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

const FeaturesContext = createContext<{ features: Features; updateFeature: (key: keyof Features, value: boolean) => Promise<void> }>({
  features: defaultFeatures,
  updateFeature: async () => {},
});

export const FeaturesProvider = ({ children }: { children: React.ReactNode }) => {
  const [features, setFeatures] = useState<Features>(defaultFeatures);

  useEffect(() => {
    const fetchFeatures = async () => {
      const { data, error } = await supabase.from('app_settings').select('value').eq('id', 'feature_flags').single();
      if (!error && data?.value) {
        setFeatures(data.value as Features);
      }
    };
    
    fetchFeatures();

    const subscription = supabase
      .channel('app_settings_changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'app_settings', filter: 'id=eq.feature_flags' }, (payload) => {
        if (payload.new && payload.new.value) {
          setFeatures(payload.new.value as Features);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const updateFeature = async (key: keyof Features, value: boolean) => {
    const newFeatures = { ...features, [key]: value };
    // Optimistic update
    setFeatures(newFeatures);
    
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    
    if (token) {
      fetch('/api/settings/features', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newFeatures)
      }).catch(console.error);
    }
  };

  return (
    <FeaturesContext.Provider value={{ features, updateFeature }}>
      {children}
    </FeaturesContext.Provider>
  );
};

export const useFeatures = () => useContext(FeaturesContext);
