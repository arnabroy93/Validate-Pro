import React from 'react';
import { useFeatures } from '../hooks/useFeatures';
import { motion } from 'motion/react';
import { Check, X } from 'lucide-react';
import { cn } from '../utils';

export function FeatureControls() {
  const { features, updateFeature } = useFeatures();

  const toggleFeature = (key: keyof typeof features) => {
    updateFeature(key, !features[key]);
  };

  const featureLabels: Record<keyof typeof features, string> = {
    validation: 'Validation',
    records: 'My Activity',
    reports: 'Reports',
    insights: 'Insights',
    global_insights: 'Global Insights',
    users: 'User Management',
    user_activity: 'User Activity',
    health: 'System Health',
    powerbi: 'Power BI Connect',
    upload_logs: 'Excel Upload Logs'
  };

  return (
    <div className="w-full h-full p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-800">Feature Controls</h2>
        <p className="text-sm font-medium text-slate-500 mt-1">Enable or disable features for all users globally.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(Object.keys(features) as Array<keyof typeof features>).map((key) => {
          const isEnabled = features[key];
          return (
            <div 
              key={key} 
              className="bg-white/60 backdrop-blur-sm border border-slate-200/60 p-4 rounded-2xl flex items-center justify-between shadow-sm hover:shadow-md transition-all group"
            >
              <div>
                <p className="font-bold text-slate-700">{featureLabels[key]}</p>
                <p className="text-xs font-medium text-slate-400 mt-0.5">{isEnabled ? 'Visible to users' : 'Hidden from users'}</p>
              </div>
              <button
                onClick={() => toggleFeature(key)}
                className={cn(
                  "relative w-12 h-6 rounded-full transition-colors duration-300",
                  isEnabled ? "bg-emerald-500" : "bg-slate-300"
                )}
              >
                <div 
                  className={cn(
                    "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform duration-300 shadow-sm flex items-center justify-center",
                    isEnabled ? "left-7" : "left-1"
                  )}
                >
                  {isEnabled ? (
                    <Check size={10} className="text-emerald-500" strokeWidth={3} />
                  ) : (
                    <X size={10} className="text-slate-400" strokeWidth={3} />
                  )}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
