import React, { useState } from 'react';
import { supabase } from '../../supabase';
import { cn } from '../utils';
import { toast } from 'react-hot-toast';
import { Lock, User, Loader2, Image as ImageIcon } from 'lucide-react';
import { motion } from 'motion/react';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [healthStatus, setHealthStatus] = useState<{ 
    backend: boolean; 
    config: { url: boolean; serviceKey: boolean; anonKey: boolean } 
  } | null>(null);

  const checkHealth = () => {
    setHealthStatus(null);
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        // Also check client-side keys
        const clientAnonKey = !!import.meta.env.VITE_SUPABASE_ANON_KEY;
        const clientUrl = !!import.meta.env.VITE_SUPABASE_URL;

        setHealthStatus({
          ...data,
          config: {
            ...data.config,
            anonKey: data.config.anonKey || clientAnonKey,
            url: data.config.url || clientUrl
          }
        });
        
        if (!data.backend) {
          toast.error("Backend connection failed. Check your Supabase Service Key in Settings > Secrets.");
        }
      })
      .catch(() => {
        setHealthStatus(null);
        toast.error("Could not reach backend server.");
      });
  };

  React.useEffect(() => {
    checkHealth();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }
      
      const loginData = await res.json();
      
      if (!res.ok) {
        throw new Error(loginData.error || 'Invalid credentials');
      }

      if (!loginData.email) {
        throw new Error('No user email associated with this username. Please contact support.');
      }

      const { error: authError } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: password,
      });

      if (authError) throw authError;
      toast.success('Welcome back!');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-brand-bg relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#f0fdfa] to-[#ccfbf1] opacity-50 pointer-events-none" />
      
      {/* Left Column - Illustration */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative z-10 p-12 lg:pr-6">
        <motion.div 
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="w-full max-w-2xl aspect-square flex items-center justify-center relative p-8"
        >
          {/* Glass border container for the image */}
          <div className="absolute inset-4 bg-white/20 backdrop-blur-md rounded-[3rem] border border-white/50 shadow-[0_20px_50px_rgba(13,148,136,0.15)] overflow-hidden" />
          
          <img 
            src="https://lh3.googleusercontent.com/d/1b3XcXXkSLbBzG94NHgFk1cp-nsQsdwTv" 
            alt="ValidatePro Illustration" 
            className="relative z-10 w-full h-full object-contain transition-all duration-500 hover:scale-[1.02] drop-shadow-xl"
            referrerPolicy="no-referrer"
          />
        </motion.div>
      </div>

      {/* Right Column - Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-12 relative z-10">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md relative"
        >
          {/* decorative blobs behind card */}
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-teal-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-emerald-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
          
          <div className="glass-card p-10 mt-8 relative z-10">
            <div className="text-center mb-10">
              <div className="w-16 h-16 bg-gradient-to-br from-brand-primary to-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_8px_16px_rgba(13,148,136,0.3)] border border-white/20">
                <Lock className="text-white w-8 h-8" />
              </div>
              <h1 className="text-3xl font-black text-brand-text mb-2 tracking-tight">Welcome Back</h1>
              <p className="text-brand-text/60 font-medium">Sign in to access ValidatePro Platform</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-brand-text">Username</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-brand-primary">
                    <User className="h-5 w-5 text-brand-primary/40 group-focus-within:text-brand-primary transition-colors" />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="input-field pl-11 py-3.5 shadow-sm"
                    placeholder="username"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-brand-text">Password</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none transition-colors group-focus-within:text-brand-primary">
                    <Lock className="h-5 w-5 text-brand-primary/40 group-focus-within:text-brand-primary transition-colors" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pl-11 py-3.5 shadow-sm"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-primary py-4 mt-2 text-base shadow-[0_8px_16px_rgba(13,148,136,0.2)] flex items-center justify-center gap-2 disabled:opacity-70 disabled:pointer-events-none group"
              >
                {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Secure Login'}
              </button>
            </form>

            <div className="mt-8 pt-8 border-t border-brand-border/30 text-center flex flex-col gap-4">
              <div className="flex flex-col gap-3 items-center p-4 bg-white/40 rounded-2xl border border-white/50 shadow-sm backdrop-blur-md">
                  <div className="flex items-center gap-6">
                   <div className="flex items-center gap-2">
                     <div className={cn("w-2.5 h-2.5 rounded-full shadow-sm", healthStatus?.config.url ? "bg-emerald-500 shadow-emerald-500/50" : "bg-rose-500 shadow-rose-500/50")} />
                     <span className="text-[10px] text-brand-text/70 font-black uppercase tracking-wider">URL</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <div className={cn("w-2.5 h-2.5 rounded-full shadow-sm", healthStatus?.config.serviceKey ? "bg-emerald-500 shadow-emerald-500/50" : "bg-rose-500 shadow-rose-500/50")} />
                     <span className="text-[10px] text-brand-text/70 font-black uppercase tracking-wider">Service Key</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <div className={cn("w-2.5 h-2.5 rounded-full shadow-sm", healthStatus?.config.anonKey ? "bg-emerald-500 shadow-emerald-500/50" : "bg-rose-500 shadow-rose-500/50")} />
                     <span className="text-[10px] text-brand-text/70 font-black uppercase tracking-wider">Anon Key</span>
                   </div>
                   <button 
                     onClick={checkHealth}
                     className="p-1 hover:bg-white/60 rounded-lg transition-colors ml-auto"
                     title="Refresh Connection"
                   >
                     <Loader2 className={cn("w-3.5 h-3.5 text-brand-primary/60", healthStatus === null && "animate-spin")} />
                   </button>
                 </div>
                 
                 {(!healthStatus?.config.url || !healthStatus?.config.serviceKey || !healthStatus?.config.anonKey) && (
                   <div className="px-3 py-2 bg-rose-50 border border-rose-100 rounded-xl mt-1">
                     <p className="text-[10px] text-rose-600 font-bold leading-tight">
                       Missing Supabase configuration in Settings &gt; Secrets.
                     </p>
                   </div>
                 )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

