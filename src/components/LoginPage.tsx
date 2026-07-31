import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../supabase';
import { cn, getAvatarUrl } from '../utils';
import { toast } from 'react-hot-toast';
import { Lock, User, Loader2, Sparkles, ShieldCheck, ArrowRight } from 'lucide-react';
import { motion, useAnimationControls, AnimatePresence } from 'motion/react';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<'username' | 'password' | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [healthStatus, setHealthStatus] = useState<{ 
    backend: boolean; 
    config: { url: boolean; serviceKey: boolean; anonKey: boolean } 
  } | null>(null);

  const controls = useAnimationControls();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (username) {
      controls.start({
        scale: [1, 1.08, 1],
        rotate: [0, -4, 4, 0],
        transition: { type: "spring", stiffness: 300, damping: 10 }
      });
    }
  }, [username, controls]);

  const checkHealth = () => {
    setHealthStatus(null);
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
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

  useEffect(() => {
    checkHealth();

    const handleMouseMove = (e: MouseEvent) => {
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect();
        // Calculate relative coordinates inside the card
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setMousePosition({ x, y });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
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

  const welcomeText = "Welcome Back";

  return (
    <div className="min-h-screen flex bg-brand-bg relative overflow-hidden font-sans">
      {/* Background Gradient Base */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#f0fdfa] via-[#f5fbfb] to-[#ecfdf5] opacity-80 pointer-events-none" />
      
      {/* High-fidelity Ambient Orbs */}
      <motion.div
        animate={{
          scale: [1, 1.25, 0.95, 1.1, 1],
          opacity: [0.35, 0.6, 0.45, 0.55, 0.35],
          x: [0, 80, -40, 60, 0],
          y: [0, -60, 50, -40, 0]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-10%] left-[-10%] w-[55vw] h-[55vw] max-w-[45rem] max-h-[45rem] bg-[#99f6e4]/40 rounded-full mix-blend-multiply filter blur-[110px] pointer-events-none"
      />
      <motion.div
        animate={{
          scale: [1, 1.15, 1.3, 0.9, 1],
          opacity: [0.25, 0.45, 0.35, 0.5, 0.25],
          x: [0, -70, 50, -60, 0],
          y: [0, 70, -40, 50, 0]
        }}
        transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[15%] right-[-10%] w-[50vw] h-[50vw] max-w-[40rem] max-h-[40rem] bg-[#a7f3d0]/35 rounded-full mix-blend-multiply filter blur-[110px] pointer-events-none"
      />
      <motion.div
        animate={{
          scale: [1, 1.35, 1.1, 1.2, 1],
          opacity: [0.25, 0.5, 0.3, 0.4, 0.25],
          x: [0, 40, -50, 30, 0],
          y: [0, -30, 60, -50, 0]
        }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-[-15%] left-[25%] w-[65vw] h-[65vw] max-w-[50rem] max-h-[50rem] bg-[#c7d2fe]/30 rounded-full mix-blend-multiply filter blur-[130px] pointer-events-none"
      />

      {/* Grid Pattern Background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#14b8a610_1px,transparent_1px),linear-gradient(to_bottom,#14b8a610_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] pointer-events-none" />

      {/* floating particle simulation */}
      {[...Array(18)].map((_, i) => {
        const randomX = Math.random() * 100;
        const randomY = Math.random() * 100;
        const randomDuration = Math.random() * 15 + 15;
        const randomScale = Math.random() * 0.6 + 0.3;
        const randomDelay = Math.random() * -20;
        return (
          <motion.div
            key={i}
            initial={{ 
              x: `${randomX}vw`, 
              y: "115vh",
              scale: randomScale,
              opacity: Math.random() * 0.3 + 0.1
            }}
            animate={{ 
              y: "-15vh",
              x: [
                `${randomX}vw`,
                `${randomX + (Math.random() * 16 - 8)}vw`,
                `${randomX - (Math.random() * 16 - 8)}vw`,
                `${randomX + (Math.random() * 12 - 6)}vw`
              ]
            }}
            transition={{ 
              duration: randomDuration, 
              repeat: Infinity, 
              ease: "linear",
              delay: randomDelay
            }}
            className="absolute w-2 h-2 rounded-full bg-teal-400 pointer-events-none filter blur-[1px] z-[5]"
          />
        );
      })}

      {/* Left Column - Dynamic Illustration */}
      <div className="hidden lg:flex flex-1 items-center justify-center relative z-10 p-12 lg:pr-8">
        <motion.div 
          initial={{ opacity: 0, y: 50 }}
          animate={{ 
            opacity: 1,
            y: [0, -18, 0],
            rotate: [0, 0.8, -0.8, 0]
          }}
          transition={{ 
            opacity: { duration: 0.9, ease: "easeOut" },
            y: { duration: 7, repeat: Infinity, ease: "easeInOut" },
            rotate: { duration: 9, repeat: Infinity, ease: "easeInOut" }
          }}
          className="w-full max-w-2xl aspect-square flex items-center justify-center relative p-8"
        >
          {/* Glass Card Container behind illustration */}
          <div className="absolute inset-4 bg-white/25 backdrop-blur-xl rounded-[3rem] border border-white/60 shadow-[0_24px_60px_rgba(13,148,136,0.12)] overflow-hidden">
            {/* Embedded glowing vector lines */}
            <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-tr from-teal-500/5 to-cyan-500/5" />
            <motion.div 
              animate={{ 
                rotate: 360,
                scale: [1, 1.1, 0.95, 1]
              }}
              transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
              className="absolute -top-1/4 -left-1/4 w-full h-full rounded-full border border-teal-500/10 border-dashed"
            />
            <motion.div 
              animate={{ 
                rotate: -360,
                scale: [1, 0.9, 1.05, 1]
              }}
              transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
              className="absolute -bottom-1/4 -right-1/4 w-full h-full rounded-full border border-emerald-500/10"
            />
          </div>
          
          <img 
            src="https://lh3.googleusercontent.com/d/1b3XcXXkSLbBzG94NHgFk1cp-nsQsdwTv" 
            alt="Validate-Pro Illustration" 
            className="relative z-10 w-full h-full object-contain transition-all duration-700 hover:scale-[1.05] drop-shadow-[0_25px_35px_rgba(13,148,136,0.22)]"
            referrerPolicy="no-referrer"
          />

          {/* Sparkles of light floating near illustration */}
          <motion.div 
            animate={{ y: [0, -12, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-12 right-12 z-20 text-teal-500/60"
          >
            <Sparkles size={32} className="animate-pulse" />
          </motion.div>
          <motion.div 
            animate={{ y: [0, 10, 0], opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-16 left-12 z-20 text-emerald-500/50"
          >
            <ShieldCheck size={28} />
          </motion.div>
        </motion.div>
      </div>

      {/* Right Column - Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 lg:px-12 relative z-10">
        <motion.div 
          initial={{ opacity: 0, scale: 0.96, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md relative"
        >
          {/* Decorative blobs behind form card */}
          <div className="absolute -top-16 -right-16 w-56 h-56 bg-teal-300 rounded-full mix-blend-multiply filter blur-[70px] opacity-25 animate-blob pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-emerald-300 rounded-full mix-blend-multiply filter blur-[70px] opacity-25 animate-blob animation-delay-2000 pointer-events-none" />
          
          <div 
            ref={cardRef}
            className="glass-card p-10 mt-8 relative z-10 overflow-hidden group/card border border-white/60 shadow-[0_20px_50px_rgba(13,148,136,0.1)] hover:shadow-[0_24px_60px_rgba(13,148,136,0.15)] transition-all duration-500"
          >
            {/* Spotlight reflection effect that tracks mouse */}
            <div 
              className="absolute pointer-events-none bg-[radial-gradient(circle_160px_at_var(--x,_0px)_var(--y,_0px),rgba(20,184,166,0.08),transparent_80%)] inset-0 z-0 transition-opacity opacity-0 group-hover/card:opacity-100 duration-300"
              style={{
                style: {
                  '--x': `${mousePosition.x}px`,
                  '--y': `${mousePosition.y}px`
                }
              } as any}
            />

            <div className="text-center mb-10 relative z-10">
              <div className="flex justify-center mb-6 h-24">
                 <motion.div
                   animate={controls}
                   whileHover={{ scale: 1.1, rotate: 3, boxShadow: "0 12px 24px rgba(13,148,136,0.4)" }}
                   whileTap={{ scale: 0.95 }}
                   className="w-24 h-24 rounded-[2.2rem] overflow-hidden border-4 border-white shadow-[0_10px_20px_rgba(13,148,136,0.25)] bg-brand-light z-10 relative cursor-pointer group/avatar"
                 >
                   <img 
                     src={getAvatarUrl(username || 'placeholder')} 
                     alt="Avatar Preview" 
                     className="w-full h-full object-cover bg-brand-light transition-transform duration-500 group-hover/avatar:scale-110" 
                   />
                   <div className="absolute inset-0 bg-gradient-to-t from-teal-500/10 to-transparent opacity-0 group-hover/avatar:opacity-100 transition-opacity" />
                 </motion.div>
              </div>

              {/* Sequential Letter-by-letter / Elegant title transition */}
              <h1 className="text-3xl font-black text-brand-text mb-2 tracking-tight overflow-hidden flex justify-center">
                {welcomeText.split("").map((letter, i) => (
                  <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ 
                      delay: 0.1 + i * 0.03, 
                      duration: 0.5,
                      type: "spring",
                      stiffness: 150
                    }}
                    className={letter === " " ? "mr-2" : ""}
                  >
                    {letter}
                  </motion.span>
                ))}
              </h1>

              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="text-brand-text/60 font-semibold text-sm flex items-center justify-center gap-1.5"
              >
                Sign in to access Validate-Pro Platform
                <Sparkles size={14} className="text-teal-500/80 animate-pulse" />
              </motion.p>
            </div>

            <form onSubmit={handleLogin} className="space-y-6 relative z-10">
              {/* Username Input Field */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="space-y-1.5"
              >
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-bold text-brand-text/90">Username</label>
                  <AnimatePresence>
                    {focusedInput === 'username' && (
                      <motion.span 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="text-[10px] text-teal-600 font-bold bg-teal-50 px-2 py-0.5 rounded-full"
                      >
                        Enter system handle
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <div className="relative group/input">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <User className={cn(
                      "h-5 w-5 transition-colors duration-300", 
                      focusedInput === 'username' ? "text-brand-primary" : "text-brand-text/30"
                    )} />
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onFocus={() => setFocusedInput('username')}
                    onBlur={() => setFocusedInput(null)}
                    onChange={(e) => setUsername(e.target.value)}
                    className="input-field pl-11 py-3.5 pr-4 shadow-sm hover:border-brand-primary/30 transition-all focus:scale-[1.01] focus:ring-2 focus:ring-brand-primary/10 relative z-0 bg-white/70"
                    placeholder="username"
                  />
                  {/* Dynamic bottom line animation */}
                  <div className={cn(
                    "absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-300 rounded-full",
                    focusedInput === 'username' ? "w-[96%]" : "w-0"
                  )} />
                </div>
              </motion.div>

              {/* Password Input Field */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="space-y-1.5"
              >
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-bold text-brand-text/90">Password</label>
                  <AnimatePresence>
                    {focusedInput === 'password' && (
                      <motion.span 
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="text-[10px] text-teal-600 font-bold bg-teal-50 px-2 py-0.5 rounded-full"
                      >
                        Secured block
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
                <div className="relative group/input">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none z-10">
                    <Lock className={cn(
                      "h-5 w-5 transition-colors duration-300", 
                      focusedInput === 'password' ? "text-brand-primary" : "text-brand-text/30"
                    )} />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onFocus={() => setFocusedInput('password')}
                    onBlur={() => setFocusedInput(null)}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-field pl-11 py-3.5 pr-4 shadow-sm hover:border-brand-primary/30 transition-all focus:scale-[1.01] focus:ring-2 focus:ring-brand-primary/10 relative z-0 bg-white/70"
                    placeholder="••••••••"
                  />
                  {/* Dynamic bottom line animation */}
                  <div className={cn(
                    "absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-300 rounded-full",
                    focusedInput === 'password' ? "w-[96%]" : "w-0"
                  )} />
                </div>
              </motion.div>

              {/* Login Button with Dynamic Hover & Sparkle */}
              <motion.button
                type="submit"
                disabled={loading}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02, y: -2 }}
                whileTap={{ scale: 0.98 }}
                transition={{ 
                  type: "spring",
                  stiffness: 400,
                  damping: 15,
                  opacity: { delay: 0.5, duration: 0.4 },
                  y: { delay: 0.5, duration: 0.4 }
                }}
                className="w-full btn-primary py-4 mt-2 text-base font-bold shadow-[0_8px_20px_rgba(13,148,136,0.22)] hover:shadow-[0_12px_28px_rgba(13,148,136,0.32)] flex items-center justify-center gap-2.5 disabled:opacity-70 disabled:pointer-events-none group/btn relative overflow-hidden rounded-2xl"
              >
                {/* Dynamic beam glow on button */}
                <div className="absolute inset-0 bg-gradient-to-r from-teal-400 via-emerald-500 to-cyan-500 opacity-0 group-hover/btn:opacity-100 transition-opacity duration-300 pointer-events-none mix-blend-overlay" />
                
                {loading ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  <>
                    <span>Secure Login</span>
                    <ArrowRight size={18} className="transition-transform duration-300 group-hover/btn:translate-x-1" />
                  </>
                )}
              </motion.button>
            </form>

            {/* Health Configuration Check block */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="mt-8 pt-8 border-t border-brand-border/30 text-center flex flex-col gap-4"
            >
              <div className="flex flex-col gap-3 items-center p-4 bg-white/45 rounded-2xl border border-white/60 shadow-sm backdrop-blur-md hover:bg-white/60 transition-all group/health relative">
                  <div className="flex items-center gap-6 w-full justify-between">
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2.5 h-2.5 rounded-full shadow-sm transition-all duration-500", healthStatus?.config.url ? "bg-emerald-500 shadow-emerald-500/50 animate-pulse" : "bg-rose-500 shadow-rose-500/50")} />
                        <span className="text-[10px] text-brand-text/70 font-black uppercase tracking-wider">URL</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2.5 h-2.5 rounded-full shadow-sm transition-all duration-500", healthStatus?.config.serviceKey ? "bg-emerald-500 shadow-emerald-500/50 animate-pulse" : "bg-rose-500 shadow-rose-500/50")} />
                        <span className="text-[10px] text-brand-text/70 font-black uppercase tracking-wider">Service Key</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2.5 h-2.5 rounded-full shadow-sm transition-all duration-500", healthStatus?.config.anonKey ? "bg-emerald-500 shadow-emerald-500/50 animate-pulse" : "bg-rose-500 shadow-rose-500/50")} />
                        <span className="text-[10px] text-brand-text/70 font-black uppercase tracking-wider">Anon Key</span>
                      </div>
                    </div>
                    <button 
                      onClick={checkHealth}
                      className="p-1 hover:bg-white/80 rounded-lg transition-colors ml-auto group/refresh"
                      title="Refresh Connection"
                    >
                      <Loader2 className={cn("w-3.5 h-3.5 text-brand-primary/60 transition-transform duration-500 group-hover/refresh:rotate-180", healthStatus === null && "animate-spin")} />
                    </button>
                  </div>
                  
                  {(!healthStatus?.config.url || !healthStatus?.config.serviceKey || !healthStatus?.config.anonKey) && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="px-3 py-2 bg-rose-500/10 border border-rose-100 rounded-xl mt-1 w-full text-left"
                    >
                      <p className="text-[10px] text-rose-600 font-bold leading-tight">
                        Missing Supabase configuration in Settings &gt; Secrets.
                      </p>
                    </motion.div>
                  )}
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}


