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
    <div className="w-full h-full p-8 max-w-4xl mx-auto space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h2 className="text-2xl font-bold tracking-tight text-slate-800">Feature Controls</h2>
        <p className="text-sm font-medium text-slate-500 mt-1">Enable or disable features for all users globally.</p>
      </motion.div>

      <motion.div 
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: {
            opacity: 1,
            transition: {
              staggerChildren: 0.04
            }
          }
        }}
      >
        {(Object.keys(features) as Array<keyof typeof features>).map((key) => {
          const isEnabled = features[key];
          return (
            <motion.div 
              key={key} 
              variants={{
                hidden: { opacity: 0, y: 12, scale: 0.98 },
                visible: { opacity: 1, y: 0, scale: 1 }
              }}
              whileHover={{ y: -2, boxShadow: "0 10px 20px -3px rgba(0,0,0,0.04)", borderColor: "rgba(16, 185, 129, 0.2)" }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="bg-white/60 backdrop-blur-sm border border-slate-200/60 p-4 rounded-2xl flex items-center justify-between shadow-sm transition-all group"
            >
              <div>
                <p className="font-bold text-slate-700">{featureLabels[key]}</p>
                <p className="text-xs font-medium text-slate-400 mt-0.5">{isEnabled ? 'Visible to users' : 'Hidden from users'}</p>
              </div>
              <motion.button
                onClick={() => toggleFeature(key)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "relative w-12 h-6 rounded-full transition-colors duration-300 outline-none",
                  isEnabled ? "bg-emerald-500" : "bg-slate-300"
                )}
              >
                <motion.div 
                  animate={{ x: isEnabled ? 24 : 0 }}
                  transition={{ type: "spring", stiffness: 450, damping: 25 }}
                  className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm flex items-center justify-center"
                >
                  {isEnabled ? (
                    <Check size={10} className="text-emerald-500" strokeWidth={3} />
                  ) : (
                    <X size={10} className="text-slate-400" strokeWidth={3} />
                  )}
                </motion.div>
              </motion.button>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
