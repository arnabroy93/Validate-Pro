import React, { useState, useEffect } from 'react';
import { useFeatures, type Features } from '../hooks/useFeatures';
import { supabase } from '../../supabase';
import { motion, AnimatePresence } from 'motion/react';
import { Check, X, Globe, UserCog, Search, RotateCcw, ShieldAlert, Sliders, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '../utils';
import { toast } from 'react-hot-toast';

export function FeatureControls() {
  const { globalFeatures, userOverrides, updateFeature, updateUserOverride } = useFeatures();
  const [activeTab, setActiveTab] = useState<'global' | 'user'>('global');
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Fetch users from database
  useEffect(() => {
    if (activeTab === 'user') {
      const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, username, role')
            .order('username', { ascending: true });
          
          if (!error && data) {
            setUsers(data);
          } else if (error) {
            console.error('Error fetching profiles:', error);
          }
        } catch (err) {
          console.error('Failed to load profiles:', err);
        } finally {
          setLoadingUsers(false);
        }
      };
      fetchUsers();
    }
  }, [activeTab]);

  const toggleGlobalFeature = (key: keyof Features) => {
    updateFeature(key, !globalFeatures[key]);
    toast.success(`Global ${featureLabels[key]} feature toggled.`);
  };

  const featureLabels: Record<keyof Features, string> = {
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

  const featureDescriptions: Record<keyof Features, string> = {
    validation: 'Direct validation interface and data processing panel.',
    records: 'Self-auditing and individual activity tracking records.',
    reports: 'Detailed exporting, filtering, and certification reports.',
    insights: 'Smart AI analytical summaries and statistics charts.',
    global_insights: 'Global validation analytics across all centers.',
    users: 'Role configuration, registration, and credential actions.',
    user_activity: 'Historical logs and timing patterns of all validators.',
    health: 'Database, storage, and platform core health metrics.',
    powerbi: 'Power BI dynamic endpoint extraction configuration.',
    upload_logs: 'Excel bulk operations, schema matching, and parsing history.'
  };

  // Filter users based on search
  const filteredUsers = users.filter((u) => 
    u.username?.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  // Check if a user has any active overrides
  const getUserOverrideSummary = (username: string) => {
    const cleanUser = username.toLowerCase().trim();
    const overrides = userOverrides[cleanUser];
    if (!overrides || Object.keys(overrides).length === 0) return null;
    return overrides;
  };

  // Get active computed state for a feature of a user
  const computedUserFeatureState = (username: string, key: keyof Features) => {
    const cleanUser = username.toLowerCase().trim();
    const overrides = userOverrides[cleanUser];
    if (overrides && overrides[key] !== undefined) {
      return { val: overrides[key]!, isOverride: true };
    }
    return { val: globalFeatures[key], isOverride: false };
  };

  // Clear all overrides for a user
  const handleClearAllOverrides = async (username: string) => {
    const cleanUser = username.toLowerCase().trim();
    const overrides = userOverrides[cleanUser];
    if (overrides) {
      const keys = Object.keys(overrides) as Array<keyof Features>;
      for (const key of keys) {
        await updateUserOverride(cleanUser, key, 'default');
      }
      toast.success(`Cleared all custom overrides for ${username}`);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-100 pb-5 gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <Sliders className="text-brand-primary" size={24} />
            Feature Controls Manager
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Configure system capabilities globally or tailor visibility individually per validator.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="bg-slate-100 p-1 rounded-xl flex self-start md:self-center">
          <button
            onClick={() => setActiveTab('global')}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
              activeTab === 'global' ? "bg-white text-brand-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Globe size={14} />
            Global Settings
          </button>
          <button
            onClick={() => setActiveTab('user')}
            className={cn(
              "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
              activeTab === 'user' ? "bg-white text-brand-primary shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <UserCog size={14} />
            User Overrides
          </button>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'global' ? (
          <motion.div
            key="global"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-amber-50/50 border border-amber-200/50 rounded-2xl p-4 flex gap-3 text-amber-800">
              <ShieldAlert size={20} className="shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider">Global System Rule</p>
                <p className="text-xs font-medium mt-1 text-amber-700/90 leading-relaxed">
                  Toggling these switches controls features for all users instantly unless they have user-specific overrides. Users who are currently online will receive live updates instantly.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(Object.keys(globalFeatures) as Array<keyof Features>).map((key) => {
                const isEnabled = globalFeatures[key];
                return (
                  <motion.div
                    key={key}
                    whileHover={{ y: -1, boxShadow: "0 8px 16px -3px rgba(0,0,0,0.03)" }}
                    className="bg-white border border-slate-100 p-5 rounded-2xl flex items-center justify-between shadow-sm transition-all"
                  >
                    <div className="space-y-1 pr-4">
                      <p className="font-bold text-slate-800 text-sm md:text-base">{featureLabels[key]}</p>
                      <p className="text-xs font-medium text-slate-400 leading-normal">{featureDescriptions[key]}</p>
                      <span className={cn(
                        "inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-2",
                        isEnabled ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-slate-50 text-slate-500 border border-slate-100"
                      )}>
                        {isEnabled ? "Globally Visible" : "Globally Hidden"}
                      </span>
                    </div>

                    <motion.button
                      onClick={() => toggleGlobalFeature(key)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={cn(
                        "relative w-12 h-6 rounded-full transition-colors duration-300 outline-none shrink-0",
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
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="user"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            {/* User Search & Selection Panel */}
            <div className="lg:col-span-4 space-y-4">
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Select Validator</h3>
                
                {/* Search Input */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by username..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-brand-primary/40 focus:border-brand-primary"
                  />
                </div>

                {/* User List */}
                <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
                  {loadingUsers ? (
                    <div className="text-center py-8 text-xs text-slate-400">Loading user profiles...</div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400">No users found</div>
                  ) : (
                    filteredUsers.map((u) => {
                      const overrides = getUserOverrideSummary(u.username);
                      const isSelected = selectedUser?.id === u.id;
                      return (
                        <button
                          key={u.id}
                          onClick={() => setSelectedUser(u)}
                          className={cn(
                            "w-full text-left px-3.5 py-3 rounded-xl flex items-center justify-between transition-all border text-xs",
                            isSelected 
                              ? "bg-brand-primary text-white border-brand-primary shadow-sm font-bold" 
                              : "bg-slate-50 hover:bg-slate-100/80 border-transparent text-slate-700"
                          )}
                        >
                          <div>
                            <p className="font-bold leading-none">{u.username}</p>
                            <p className={cn("text-[10px] mt-1 font-medium", isSelected ? "text-emerald-100" : "text-slate-400")}>
                              Role: {u.role}
                            </p>
                          </div>
                          {overrides && (
                            <span className={cn(
                              "text-[9px] font-bold px-2 py-0.5 rounded-full",
                              isSelected ? "bg-white text-brand-primary" : "bg-indigo-50 text-indigo-700 border border-indigo-100"
                            )}>
                              {Object.keys(overrides).length} customized
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Overridden Users Summary */}
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">Active Customizations</h3>
                
                {Object.keys(userOverrides).length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No user-specific overrides configured currently.</p>
                ) : (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto">
                    {Object.keys(userOverrides).map((username) => {
                      const userObj = users.find(u => u.username?.toLowerCase() === username);
                      const ovCount = Object.keys(userOverrides[username] || {}).length;
                      if (ovCount === 0) return null;
                      return (
                        <div key={username} className="flex items-center justify-between bg-indigo-50/20 border border-indigo-100/50 p-2.5 rounded-xl text-xs">
                          <div>
                            <span className="font-bold text-slate-700">{username}</span>
                            <p className="text-[10px] text-slate-400 mt-0.5">{ovCount} custom switches</p>
                          </div>
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => {
                                if (userObj) setSelectedUser(userObj);
                              }}
                              className="text-[10px] font-bold text-brand-primary hover:underline px-1.5 py-1"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleClearAllOverrides(username)}
                              title="Reset all overrides"
                              className="text-[10px] font-bold text-red-600 hover:text-red-700 px-1.5 py-1 rounded-lg hover:bg-red-50"
                            >
                              Reset
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Feature Override Controls Panel */}
            <div className="lg:col-span-8">
              {selectedUser ? (
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-6">
                  {/* Selected User Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-800">
                        Feature Overrides for <span className="text-brand-primary font-black underline decoration-2">{selectedUser.username}</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">Configure user-specific feature levels or inherit global rules.</p>
                    </div>

                    <button
                      onClick={() => handleClearAllOverrides(selectedUser.username)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors flex items-center gap-1 text-xs font-bold"
                    >
                      <RotateCcw size={12} />
                      Inherit All
                    </button>
                  </div>

                  {/* Overrides List */}
                  <div className="divide-y divide-slate-100">
                    {(Object.keys(globalFeatures) as Array<keyof Features>).map((key) => {
                      const { val: activeVal, isOverride } = computedUserFeatureState(selectedUser.username, key);
                      const currentOverride = userOverrides[selectedUser.username.toLowerCase().trim()]?.[key];
                      const triStateValue: 'default' | boolean = currentOverride === undefined ? 'default' : currentOverride;

                      return (
                        <div key={key} className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                          <div className="space-y-0.5 max-w-md">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-700 text-sm">{featureLabels[key]}</span>
                              
                              {/* Computed Status Badge */}
                              <span className={cn(
                                "text-[9px] font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1",
                                activeVal 
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                                  : "bg-slate-100 text-slate-500 border border-slate-200"
                              )}>
                                {activeVal ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                                {activeVal ? "Active" : "Disabled"}
                                {isOverride && " (Custom)"}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5 leading-normal">{featureDescriptions[key]}</p>
                          </div>

                          {/* Tri-state Control Group */}
                          <div className="bg-slate-100 p-1 rounded-xl flex self-start md:self-center shrink-0">
                            <button
                              onClick={() => updateUserOverride(selectedUser.username, key, 'default')}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap",
                                triStateValue === 'default' 
                                  ? "bg-white text-slate-800 shadow-sm" 
                                  : "text-slate-500 hover:text-slate-700"
                              )}
                            >
                              Inherit ({globalFeatures[key] ? 'ON' : 'OFF'})
                            </button>
                            <button
                              onClick={() => updateUserOverride(selectedUser.username, key, true)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap flex items-center gap-1",
                                triStateValue === true 
                                  ? "bg-emerald-500 text-white shadow-sm" 
                                  : "text-slate-500 hover:text-emerald-600"
                              )}
                            >
                              Force ON
                            </button>
                            <button
                              onClick={() => updateUserOverride(selectedUser.username, key, false)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap flex items-center gap-1",
                                triStateValue === false 
                                  ? "bg-slate-700 text-white shadow-sm" 
                                  : "text-slate-500 hover:text-red-500"
                              )}
                            >
                              Force OFF
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl p-16 text-center space-y-3">
                  <UserCog className="mx-auto text-slate-300 animate-pulse" size={44} />
                  <div>
                    <h4 className="text-sm font-bold text-slate-700">No Validator Selected</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      Select a validator from the list on the left to customize their feature accessibility and access.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
