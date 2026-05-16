/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LoginPage } from './components/LoginPage';
import { Dashboard } from './components/Dashboard';
import { AdminPanel } from './components/AdminPanel';
import { ReportPanel } from './components/ReportPanel';
import { Toaster } from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutDashboard, Users, LogOut, Loader2, FileText, RefreshCcw } from 'lucide-react';
import { cn } from './utils';

function Navigation({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: string) => void }) {
  const { profile, signOut } = useAuth();
  const isAdmin = profile?.role === 'admin';

  return (
    <aside className="w-64 bg-white/40 backdrop-blur-xl border-r border-white/40 flex flex-col h-screen fixed left-0 top-0 z-10 shadow-[4px_0_24px_0_rgba(13,148,136,0.05)]">
      <div className="p-6 flex items-center gap-3">
        <img src="/favicon.svg" alt="Validate-Pro Logo" className="w-8 h-8 rounded-lg shadow-sm" />
        <span className="font-bold text-xl tracking-tight text-brand-text">Validate-Pro</span>
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-bold text-sm",
            activeTab === 'dashboard' 
              ? "bg-white/70 text-brand-primary shadow-sm border border-white/60" 
              : "text-slate-500 hover:bg-white/40 hover:text-brand-hover"
          )}
        >
          <LayoutDashboard size={18} />
          <span>Validation</span>
        </button>

        <button
          onClick={() => setActiveTab('records')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-bold text-sm",
            activeTab === 'records' 
              ? "bg-white/70 text-brand-primary shadow-sm border border-white/60" 
              : "text-slate-500 hover:bg-white/40 hover:text-brand-hover"
          )}
        >
          <FileText size={18} />
          <span>My Activity</span>
        </button>

        <button
          onClick={() => setActiveTab('reports')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-bold text-sm",
            activeTab === 'reports' 
              ? "bg-white/70 text-brand-primary shadow-sm border border-white/60" 
              : "text-slate-500 hover:bg-white/40 hover:text-brand-hover"
          )}
        >
          <FileText size={18} />
          <span>Reports</span>
        </button>

        {isAdmin && (
          <>
            <div className="pt-4 pb-2 px-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-brand-primary/50">Administration</p>
            </div>

            <button
              onClick={() => setActiveTab('users')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-bold text-sm",
                activeTab === 'users' 
                  ? "bg-white/70 text-brand-primary shadow-sm border border-white/60" 
                  : "text-slate-500 hover:bg-white/40 hover:text-brand-hover"
              )}
            >
              <Users size={18} />
              <span>User Management</span>
            </button>

            <button
              onClick={() => setActiveTab('user_activity')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-bold text-sm",
                activeTab === 'user_activity' 
                  ? "bg-white/70 text-brand-primary shadow-sm border border-white/60" 
                  : "text-slate-500 hover:bg-white/40 hover:text-brand-hover"
              )}
            >
              <FileText size={18} />
              <span>User Activity</span>
            </button>

            <button
              onClick={() => setActiveTab('health')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-bold text-sm",
                activeTab === 'health' 
                  ? "bg-white/70 text-brand-primary shadow-sm border border-white/60" 
                  : "text-slate-500 hover:bg-white/40 hover:text-brand-hover"
              )}
            >
              <RefreshCcw size={18} />
              <span>System Health</span>
            </button>
          </>
        )}
      </nav>

      <div className="p-4 border-t border-brand-border/30">
        <div className="flex items-center gap-3 p-3 bg-white/40 rounded-2xl mb-4 border border-white/50 backdrop-blur-md shadow-sm">
          <div className="w-10 h-10 bg-brand-primary/10 rounded-xl flex items-center justify-center font-black text-brand-primary shadow-inner shrink-0 text-sm">
            {profile?.username?.substring(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-brand-text truncate leading-tight mb-0.5">{profile?.username}</p>
            <p className="text-[10px] text-brand-text/50 font-black uppercase tracking-widest">{profile?.role}</p>
          </div>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:text-rose-500 hover:bg-rose-50/50 transition-all font-bold text-sm"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}

function MainContent() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-transparent transition-all">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-brand-primary animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-primary/60">Synchronizing Session</p>
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
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-1 flex flex-col"
            >
              <Dashboard />
            </motion.div>
          ) : activeTab === 'reports' ? (
            <motion.div
              key="reports"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="p-8"
            >
              <ReportPanel />
            </motion.div>
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
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
      <MainContent />
      <Toaster position="top-right" />
    </AuthProvider>
  );
}

