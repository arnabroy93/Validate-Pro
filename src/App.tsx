/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { FeaturesProvider, useFeatures } from './hooks/useFeatures';
import { LoginPage } from './components/LoginPage';
import { Dashboard } from './components/Dashboard';
import { AdminPanel } from './components/AdminPanel';
import { ReportPanel } from './components/ReportPanel';
import { Insights } from './components/Insights';
import { FeatureControls } from './components/FeatureControls';
import { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, Settings, Users, LogOut, Loader2, FileText, RefreshCcw, BarChart3, Upload, PieChart } from 'lucide-react';
import { cn, getAvatarUrl } from './utils';
import { Background } from './components/Background';

function Navigation({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: string) => void }) {
  const { profile, signOut } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const { features } = useFeatures();
  
  return (
    <aside className="w-64 glass-panel flex flex-col h-screen fixed left-0 top-0 z-10 !border-y-0 !border-l-0 !rounded-none">
      <motion.div 
        onClick={() => setActiveTab('dashboard')}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="p-6 flex items-center gap-3 cursor-pointer select-none group"
      >
        <motion.img 
          animate={{ rotate: [0, 8, -8, 0] }}
          transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
          src="/favicon.svg" 
          alt="Validate-Pro Logo" 
          className="w-8 h-8 rounded-lg shadow-sm" 
        />
        <span className="font-bold text-xl tracking-tight text-brand-text bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent group-hover:from-teal-500 group-hover:to-emerald-500 transition-all duration-300">Validate-Pro</span>
      </motion.div>
      
      <nav className="flex-1 px-4 space-y-1 overflow-y-auto py-2">
        {features.insights && (
          <motion.button
            onClick={() => setActiveTab('insights')}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm relative z-10 transition-colors",
              activeTab === 'insights' ? "text-brand-primary" : "text-slate-500 hover:text-brand-hover"
            )}
          >
            {activeTab === 'insights' && (
              <motion.div
                layoutId="sidebarActiveBg"
                className="absolute inset-0 bg-white/75 shadow-sm border border-white/60 rounded-xl -z-10"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <PieChart size={18} />
            <span>Insights</span>
          </motion.button>
        )}
        {features.validation && (
          <motion.button
            onClick={() => {
              if (activeTab === 'dashboard') {
                window.dispatchEvent(new CustomEvent('reset_validation'));
              } else {
                setActiveTab('dashboard');
              }
            }}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm relative z-10 transition-colors",
              activeTab === 'dashboard' ? "text-brand-primary" : "text-slate-500 hover:text-brand-hover"
            )}
          >
            {activeTab === 'dashboard' && (
              <motion.div
                layoutId="sidebarActiveBg"
                className="absolute inset-0 bg-white/75 shadow-sm border border-white/60 rounded-xl -z-10"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <LayoutDashboard size={18} />
            <span>Validation</span>
          </motion.button>
        )}

        {features.records && (
          <motion.button
            onClick={() => setActiveTab('records')}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm relative z-10 transition-colors",
              activeTab === 'records' ? "text-brand-primary" : "text-slate-500 hover:text-brand-hover"
            )}
          >
            {activeTab === 'records' && (
              <motion.div
                layoutId="sidebarActiveBg"
                className="absolute inset-0 bg-white/75 shadow-sm border border-white/60 rounded-xl -z-10"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <FileText size={18} />
            <span>My Activity</span>
          </motion.button>
        )}

        {features.reports && (
          <motion.button
            onClick={() => setActiveTab('reports')}
            whileHover={{ x: 4 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm relative z-10 transition-colors",
              activeTab === 'reports' ? "text-brand-primary" : "text-slate-500 hover:text-brand-hover"
            )}
          >
            {activeTab === 'reports' && (
              <motion.div
                layoutId="sidebarActiveBg"
                className="absolute inset-0 bg-white/75 shadow-sm border border-white/60 rounded-xl -z-10"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
            <FileText size={18} />
            <span>Reports</span>
          </motion.button>
        )}

        {isAdmin && (
          <>
            <motion.button
              onClick={() => setActiveTab('features_config')}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm relative z-10 transition-colors",
                activeTab === 'features_config' ? "text-brand-primary" : "text-slate-500 hover:text-brand-hover"
              )}
            >
              {activeTab === 'features_config' && (
                <motion.div
                  layoutId="sidebarActiveBg"
                  className="absolute inset-0 bg-white/75 shadow-sm border border-white/60 rounded-xl -z-10"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Settings size={18} />
              <span>Feature Controls</span>
            </motion.button>
            <div className="pt-4 pb-2 px-3 select-none">
              <p className="text-[10px] font-black uppercase tracking-widest text-brand-primary/50">Administration</p>
            </div>
            {features.global_insights && (
              <motion.button
                onClick={() => setActiveTab('global_insights')}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm relative z-10 transition-colors",
                  activeTab === 'global_insights' ? "text-brand-primary" : "text-slate-500 hover:text-brand-hover"
                )}
              >
                {activeTab === 'global_insights' && (
                  <motion.div
                    layoutId="sidebarActiveBg"
                    className="absolute inset-0 bg-white/75 shadow-sm border border-white/60 rounded-xl -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <PieChart size={18} className="text-brand-primary" />
                <span>Global Insights</span>
              </motion.button>
            )}

            {features.users && (
              <motion.button
                onClick={() => setActiveTab('users')}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm relative z-10 transition-colors",
                  activeTab === 'users' ? "text-brand-primary" : "text-slate-500 hover:text-brand-hover"
                )}
              >
                {activeTab === 'users' && (
                  <motion.div
                    layoutId="sidebarActiveBg"
                    className="absolute inset-0 bg-white/75 shadow-sm border border-white/60 rounded-xl -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Users size={18} />
                <span>User Management</span>
              </motion.button>
            )}

            {features.user_activity && (
              <motion.button
                onClick={() => setActiveTab('user_activity')}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm relative z-10 transition-colors",
                  activeTab === 'user_activity' ? "text-brand-primary" : "text-slate-500 hover:text-brand-hover"
                )}
              >
                {activeTab === 'user_activity' && (
                  <motion.div
                    layoutId="sidebarActiveBg"
                    className="absolute inset-0 bg-white/75 shadow-sm border border-white/60 rounded-xl -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <FileText size={18} />
                <span>User Activity</span>
              </motion.button>
            )}

            {features.health && (
              <motion.button
                onClick={() => setActiveTab('health')}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm relative z-10 transition-colors",
                  activeTab === 'health' ? "text-brand-primary" : "text-slate-500 hover:text-brand-hover"
                )}
              >
                {activeTab === 'health' && (
                  <motion.div
                    layoutId="sidebarActiveBg"
                    className="absolute inset-0 bg-white/75 shadow-sm border border-white/60 rounded-xl -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <RefreshCcw size={18} />
                <span>System Health</span>
              </motion.button>
            )}

            {features.powerbi && (
              <motion.button
                onClick={() => setActiveTab('powerbi')}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm relative z-10 transition-colors",
                  activeTab === 'powerbi' ? "text-brand-primary" : "text-slate-500 hover:text-brand-hover"
                )}
              >
                {activeTab === 'powerbi' && (
                  <motion.div
                    layoutId="sidebarActiveBg"
                    className="absolute inset-0 bg-white/75 shadow-sm border border-white/60 rounded-xl -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <BarChart3 size={18} className="text-brand-primary" />
                <span>Power BI Connect</span>
              </motion.button>
            )}

            {features.upload_logs && (
              <motion.button
                onClick={() => setActiveTab('upload_logs')}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold text-sm relative z-10 transition-colors",
                  activeTab === 'upload_logs' ? "text-brand-primary" : "text-slate-500 hover:text-brand-hover"
                )}
              >
                {activeTab === 'upload_logs' && (
                  <motion.div
                    layoutId="sidebarActiveBg"
                    className="absolute inset-0 bg-white/75 shadow-sm border border-white/60 rounded-xl -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Upload size={18} />
                <span>Excel Upload Logs</span>
              </motion.button>
            )}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-brand-border/30">
        <motion.div 
          whileHover={{ y: -2 }}
          className="flex items-center gap-3 p-3 bg-white/40 rounded-2xl mb-4 border border-white/50 backdrop-blur-md shadow-sm cursor-pointer group/profile"
        >
          <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0 border border-brand-primary/20 shadow-sm bg-brand-light transition-transform duration-300 group-hover/profile:scale-105">
            <img 
              src={getAvatarUrl(profile?.username || 'user', profile?.role)} 
              alt={profile?.username || 'User Avatar'}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-brand-text truncate leading-tight mb-0.5 group-hover/profile:text-brand-primary transition-colors duration-300">{profile?.username}</p>
            <p className="text-[10px] text-brand-text/50 font-black uppercase tracking-widest">{profile?.role}</p>
          </div>
        </motion.div>
        
        <motion.button
          onClick={signOut}
          whileHover={{ x: 4, backgroundColor: "rgba(239, 68, 68, 0.08)", color: "#f43f5e" }}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 transition-all font-bold text-sm"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </motion.button>
      </div>
    </aside>
  );
}

function MainContent() {
  const { user, loading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showEscapeHatch, setShowEscapeHatch] = useState(false);

  useEffect(() => {
    let timer: any;
    if (loading) {
      timer = setTimeout(() => {
        setShowEscapeHatch(true);
      }, 1500);
    } else {
      setShowEscapeHatch(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-transparent transition-all">
        <div className="flex flex-col items-center gap-4 text-center px-6 max-w-sm">
          <Loader2 className="w-10 h-10 text-brand-primary animate-spin" />
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-brand-primary/70">Synchronizing Session</p>
          
          {showEscapeHatch && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center gap-2 mt-2"
            >
              <p className="text-xs text-slate-500 font-medium">Taking longer than expected?</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="px-3 py-1.5 text-xs font-semibold bg-white/80 hover:bg-white text-slate-700 border border-slate-200 rounded-lg shadow-sm transition-all"
                >
                  Go to Login
                </button>
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="px-3 py-1.5 text-xs font-semibold bg-brand-primary text-white hover:bg-brand-primary/90 rounded-lg shadow-sm transition-all"
                >
                  Reload Page
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className="flex bg-transparent min-h-screen">
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 ml-64 flex flex-col relative z-20">
        <AnimatePresence mode="wait">
          {activeTab === 'dashboard' ? (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="flex-1 flex flex-col"
            >
              <Dashboard />
            </motion.div>
          ) : activeTab === 'reports' ? (
            <motion.div
              key="reports"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="p-8"
            >
              <ReportPanel />
            </motion.div>
          ) : activeTab === 'insights' ? (
            <motion.div
              key="insights"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="p-8 flex-1"
            >
              <Insights isAdminView={false} />
            </motion.div>
          ) : activeTab === 'global_insights' ? (
            <motion.div
              key="global_insights"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="p-8 flex-1"
            >
              <Insights isAdminView={true} />
            </motion.div>
          ) : activeTab === 'features_config' ? (
            <motion.div
              key="features_config"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="p-8 flex-1"
            >
              <FeatureControls />
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
              className="p-8"
            >
              <AdminPanel forcedTab={activeTab as any} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer className="mt-auto h-10 px-8 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest border-t border-brand-border bg-white/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Session Active</span>
          </div>
          <span>Supabase Cloud • Enterprise Engine v1.0</span>
          <span>Node.js v20 LTS</span>
        </footer>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <FeaturesProvider>
      <Background />
      <MainContent />
      <Toaster position="top-right" />
    </FeaturesProvider>
    </AuthProvider>
  );
}

