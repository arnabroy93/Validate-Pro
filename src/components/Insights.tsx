import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../../supabase';
import { Loader2, PieChart as PieChartIcon, BarChart3, Activity, Users, Database, Calendar } from 'lucide-react';
import { motion } from 'motion/react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList
} from 'recharts';

function AnimatedCounter({ value }: { value: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) {
      setCount(end);
      return;
    }
    
    const duration = 1200; // 1.2s for rich, visible progression
    const startTime = performance.now();
    
    let animationFrameId: number;
    
    const updateCount = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      setCount(Math.floor(easeProgress * (end - start) + start));
      
      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateCount);
      } else {
        setCount(end);
      }
    };
    
    animationFrameId = requestAnimationFrame(updateCount);
    return () => cancelAnimationFrame(animationFrameId);
  }, [value]);

  return <>{count}</>;
}

export function Insights({ isAdminView = false }: { isAdminView?: boolean }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [rawValidations, setRawValidations] = useState<any[]>([]);
  const [rawStudents, setRawStudents] = useState<any[]>([]);
  const [timeframe, setTimeframe] = useState<string>('ALL');
  const [activePieIndex, setActivePieIndex] = useState<number | null>(null);
  const [activeBarIndex, setActiveBarIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, [isAdminView, profile, user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch validations safely using API first, with SDK fallback
      let allValidations: any[] = [];
      try {
        const vRes = await fetch('/api/admin/all_validations');
        if (vRes.ok) {
          const vData = await vRes.json();
          if (Array.isArray(vData)) {
            allValidations = vData;
          }
        } else {
          throw new Error('API failed');
        }
      } catch (vErr) {
        console.warn('[Insights] All validations API fetch failed, falling back to Supabase SDK:', vErr);
        let vQuery = supabase.from('student_validations').select('batch_code, center_code, student_code, status, validated_by, user_id, ae_name, aligned_ae, created_at, updated_at');
        let vFrom = 0;
        let vLimit = 1000;
        let vHasMore = true;
        while (vHasMore) {
          const { data, error } = await vQuery.range(vFrom, vFrom + vLimit - 1);
          if (error) throw error;
          if (data && data.length > 0) {
            allValidations = [...allValidations, ...data];
            vFrom += vLimit;
            if (data.length < vLimit) vHasMore = false;
          } else {
            vHasMore = false;
          }
        }
      }

      // 2. Fetch batch students data safely using API first, with SDK fallback
      let allStudents: any[] = [];
      try {
        const sRes = await fetch('/api/batch_data');
        if (sRes.ok) {
          const sData = await sRes.json();
          if (Array.isArray(sData)) {
            allStudents = sData;
          }
        } else {
          throw new Error('API failed');
        }
      } catch (sErr) {
        console.warn('[Insights] Batch data API fetch failed, falling back to Supabase SDK:', sErr);
        let sQuery = supabase.from('batch_students').select('batch_code, center_code, student_code, ae_name, student_name, uploaded_by, created_at, batch_start_date');
        let sFrom = 0;
        let sLimit = 1000;
        let sHasMore = true;
        while (sHasMore) {
          const { data, error } = await sQuery.range(sFrom, sFrom + sLimit - 1);
          if (error) throw error;
          if (data && data.length > 0) {
            allStudents = [...allStudents, ...data];
            sFrom += sLimit;
            if (data.length < sLimit) sHasMore = false;
          } else {
            sHasMore = false;
          }
        }
      }

      setRawValidations(allValidations);
      setRawStudents(allStudents);
    } catch (error: any) {
      console.error('[Insights] Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Extract available specific months from dataset
  const availableMonths = useMemo(() => {
    const monthsSet = new Set<string>();
    const addDate = (dateStr?: string) => {
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        monthsSet.add(`${yyyy}-${mm}`);
      }
    };

    rawValidations.forEach(v => {
      addDate(v.created_at);
      addDate(v.updated_at);
    });
    rawStudents.forEach(s => {
      addDate(s.created_at);
      addDate(s.batch_start_date);
    });

    const sorted = Array.from(monthsSet).sort().reverse();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return sorted.map(m => {
      const [yyyy, mm] = m.split('-');
      const label = `${monthNames[parseInt(mm, 10) - 1]} ${yyyy}`;
      return { value: m, label };
    });
  }, [rawValidations, rawStudents]);

  // Check if date falls in timeframe
  const isDateInTimeframe = (dateStr: string | null | undefined, tf: string) => {
    if (tf === 'ALL' || !tf) return true;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return false;

    const now = new Date();
    const year = d.getFullYear();
    const month = d.getMonth();

    if (tf === 'THIS_MONTH') {
      return year === now.getFullYear() && month === now.getMonth();
    }
    if (tf === 'LAST_MONTH') {
      const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return year === lm.getFullYear() && month === lm.getMonth();
    }
    if (tf === 'LAST_3_MONTHS') {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return d >= start;
    }
    if (tf === 'LAST_6_MONTHS') {
      const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
      return d >= start;
    }
    if (tf === 'THIS_YEAR') {
      return year === now.getFullYear();
    }
    if (tf.includes('-')) {
      const [tYear, tMonth] = tf.split('-').map(Number);
      return year === tYear && (month + 1) === tMonth;
    }
    return true;
  };

  const summaryData = useMemo(() => {
    // Identify logged-in user criteria
    const myUsername = profile?.username?.toLowerCase().trim() || '';
    const myEmail = user?.email?.toLowerCase().trim() || '';
    const myUserId = user?.id || '';

    const isUserValidation = (v: any) => {
      if (!v) return false;
      if (myUserId && v.user_id === myUserId) return true;
      const valBy = v.validated_by?.toLowerCase().trim();
      if (valBy && (valBy === myUsername || valBy === myEmail)) return true;
      const ae = v.ae_name?.toLowerCase().trim();
      if (ae && (ae === myUsername || ae === myEmail)) return true;
      const aligned = v.aligned_ae?.toLowerCase().trim();
      if (aligned && (aligned === myUsername || aligned === myEmail)) return true;
      return false;
    };

    const isUserStudent = (s: any) => {
      if (!s) return false;
      if (s.uploaded_by && myUserId && s.uploaded_by === myUserId) return true;
      const ae = s.ae_name?.toLowerCase().trim();
      if (ae && (ae === myUsername || ae === myEmail)) return true;
      return false;
    };

    let activeValidations = Array.isArray(rawValidations) ? rawValidations : [];
    if (!isAdminView) {
      activeValidations = activeValidations.filter(isUserValidation);
    }
    if (timeframe !== 'ALL') {
      activeValidations = activeValidations.filter(v => isDateInTimeframe(v.created_at || v.updated_at, timeframe));
    }

    const userValidationKeys = new Set(
      activeValidations.map(v => `${v.batch_code}_${v.student_code}`)
    );

    let activeStudents = Array.isArray(rawStudents) ? rawStudents : [];
    if (!isAdminView) {
      activeStudents = activeStudents.filter(
        s => isUserStudent(s) || userValidationKeys.has(`${s.batch_code}_${s.student_code}`)
      );
    }
    if (timeframe !== 'ALL') {
      activeStudents = activeStudents.filter(
        s => isDateInTimeframe(s.created_at || s.batch_start_date, timeframe) || userValidationKeys.has(`${s.batch_code}_${s.student_code}`)
      );
    }

    // Build unique student records for the active view
    const uniqueStudentsMap = new Map<string, any>();
    activeStudents.forEach((s) => {
      const key = `${s.center_code || ''}_${s.batch_code || ''}_${s.student_code || ''}`;
      if (!uniqueStudentsMap.has(key)) {
        uniqueStudentsMap.set(key, s);
      }
    });

    // Ensure all students present in active validations are also included
    activeValidations.forEach((v) => {
      const key = `${v.center_code || ''}_${v.batch_code || ''}_${v.student_code || ''}`;
      if (!uniqueStudentsMap.has(key)) {
        uniqueStudentsMap.set(key, {
          center_code: v.center_code || '',
          batch_code: v.batch_code || '',
          student_code: v.student_code || '',
          ae_name: v.ae_name || v.aligned_ae || ''
        });
      }
    });

    // Map latest validation for each student in active view
    const vDataMap = new Map<string, any>();
    activeValidations.forEach((v) => {
      const key = `${v.batch_code}_${v.student_code}`;
      vDataMap.set(key, v);
    });

    // Compute batch summaries
    const summaryMap = new Map<string, any>();
    uniqueStudentsMap.forEach((student) => {
      const sumKey = `${student.center_code}_${student.batch_code}`;
      if (!summaryMap.has(sumKey)) {
        summaryMap.set(sumKey, {
          center_code: student.center_code || '',
          batch_code: student.batch_code || '',
          total_students: 0,
          validated: 0,
          revalidated: 0,
          pending: 0,
          absent: 0,
          rejected: 0
        });
      }

      const summary = summaryMap.get(sumKey);
      summary.total_students += 1;

      const validationRow = vDataMap.get(`${student.batch_code}_${student.student_code}`);
      const currentStatus = validationRow?.status || 'Pending';

      if (currentStatus === 'Validated' || currentStatus === 'Completed') summary.validated += 1;
      else if (currentStatus === 'ReValidated') summary.revalidated += 1;
      else if (currentStatus === 'Absent') summary.absent += 1;
      else if (currentStatus === 'Rejected') summary.rejected += 1;
      else summary.pending += 1;
    });

    return Array.from(summaryMap.values());
  }, [rawValidations, rawStudents, timeframe, isAdminView, profile, user]);

  const metrics = useMemo(() => {
    let totalBatches = summaryData.length;
    let fullyValidatedBatches = 0;
    let partiallyValidatedBatches = 0;
    let totalStudents = 0;
    let totalValidated = 0;
    let totalPending = 0;
    let totalRejected = 0;
    let totalAbsent = 0;
    let totalRevalidated = 0;

    summaryData.forEach(s => {
      totalStudents += s.total_students;
      totalValidated += s.validated;
      totalPending += s.pending;
      totalRejected += s.rejected;
      totalAbsent += s.absent;
      totalRevalidated += s.revalidated;

      // Logic for Full vs Partial
      if (s.pending === 0 && s.total_students > 0) {
        fullyValidatedBatches++;
      } else if (s.pending > 0 && (s.validated > 0 || s.revalidated > 0 || s.absent > 0 || s.rejected > 0)) {
        partiallyValidatedBatches++;
      }
    });

    return {
      totalBatches,
      fullyValidatedBatches,
      partiallyValidatedBatches,
      totalStudents,
      totalValidated,
      totalPending,
      totalRejected,
      totalAbsent,
      totalRevalidated
    };
  }, [summaryData]);

  const pieData = [
    { name: 'Fully Validated', value: metrics.fullyValidatedBatches },
    { name: 'Partially Validated', value: metrics.partiallyValidatedBatches },
    { name: 'Not Started / Pending', value: Math.max(0, metrics.totalBatches - metrics.fullyValidatedBatches - metrics.partiallyValidatedBatches) }
  ].filter(d => d.value > 0);

  const COLORS = ['#10b981', '#f59e0b', '#cbd5e1'];

  const studentStatusData = [
    { name: 'Validated', count: metrics.totalValidated, fill: '#10b981' },
    { name: 'ReValidated', count: metrics.totalRevalidated, fill: '#3b82f6' },
    { name: 'Absent', count: metrics.totalAbsent, fill: '#f59e0b' },
    { name: 'Rejected', count: metrics.totalRejected, fill: '#ef4444' },
    { name: 'Pending', count: metrics.totalPending, fill: '#cbd5e1' },
  ];

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Compiling Insights...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
            <PieChartIcon size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">{isAdminView ? 'Global Validation Insights' : 'My Validation Insights'}</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {isAdminView ? 'Activity dashboard across all users' : 'Your personal activity dashboard'}
            </p>
          </div>
        </div>

        {/* Month Timeline Range Dropdown Filter */}
        <div className="flex items-center gap-2 bg-white/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-sm self-start sm:self-auto">
          <Calendar size={16} className="text-brand-primary shrink-0" />
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Timeline:</span>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer pr-1"
          >
            <optgroup label="Range Presets">
              <option value="ALL">All Time</option>
              <option value="THIS_MONTH">This Month</option>
              <option value="LAST_MONTH">Last Month</option>
              <option value="LAST_3_MONTHS">Last 3 Months</option>
              <option value="LAST_6_MONTHS">Last 6 Months</option>
              <option value="THIS_YEAR">This Year</option>
            </optgroup>
            {availableMonths.length > 0 && (
              <optgroup label="Specific Months">
                {availableMonths.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }} 
          animate={{ opacity: 1, y: 0 }} 
          whileHover={{ y: -6, boxShadow: "0 12px 24px -4px rgba(59, 130, 246, 0.15)", borderColor: "rgba(59, 130, 246, 0.4)" }}
          transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.05 }} 
          className="glass-card rounded-2xl p-5 border border-slate-200/80 shadow-sm cursor-default select-none transition-colors duration-300"
        >
          <div className="flex items-center gap-3 mb-2.5">
            <div className="p-2.5 bg-blue-500/10 text-blue-600 rounded-xl"><Database size={18} /></div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Batches</p>
          </div>
          <p className="text-3.5xl font-black text-slate-800 tracking-tight">
            <AnimatedCounter value={metrics.totalBatches} />
          </p>
        </motion.div>

        {/* Card 2 */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }} 
          animate={{ opacity: 1, y: 0 }} 
          whileHover={{ y: -6, boxShadow: "0 12px 24px -4px rgba(16, 185, 129, 0.15)", borderColor: "rgba(16, 185, 129, 0.4)" }}
          transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.15 }} 
          className="glass-card rounded-2xl p-5 border border-slate-200/80 shadow-sm cursor-default select-none transition-colors duration-300"
        >
          <div className="flex items-center gap-3 mb-2.5">
            <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-xl"><Activity size={18} /></div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fully Validated</p>
          </div>
          <p className="text-3.5xl font-black text-slate-800 tracking-tight">
            <AnimatedCounter value={metrics.fullyValidatedBatches} />
          </p>
        </motion.div>

        {/* Card 3 */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }} 
          animate={{ opacity: 1, y: 0 }} 
          whileHover={{ y: -6, boxShadow: "0 12px 24px -4px rgba(245, 158, 11, 0.15)", borderColor: "rgba(245, 158, 11, 0.4)" }}
          transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.25 }} 
          className="glass-card rounded-2xl p-5 border border-slate-200/80 shadow-sm cursor-default select-none transition-colors duration-300"
        >
          <div className="flex items-center gap-3 mb-2.5">
            <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-xl"><Activity size={18} /></div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Partially Validated</p>
          </div>
          <p className="text-3.5xl font-black text-slate-800 tracking-tight">
            <AnimatedCounter value={metrics.partiallyValidatedBatches} />
          </p>
        </motion.div>

        {/* Card 4 */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }} 
          animate={{ opacity: 1, y: 0 }} 
          whileHover={{ y: -6, boxShadow: "0 12px 24px -4px rgba(99, 102, 241, 0.15)", borderColor: "rgba(99, 102, 241, 0.4)" }}
          transition={{ type: "spring", stiffness: 120, damping: 14, delay: 0.35 }} 
          className="glass-card rounded-2xl p-5 border border-slate-200/80 shadow-sm cursor-default select-none transition-colors duration-300"
        >
          <div className="flex items-center gap-3 mb-2.5">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl"><Users size={18} /></div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Students Validated</p>
          </div>
          <p className="text-3.5xl font-black text-slate-800 tracking-tight">
            <AnimatedCounter value={metrics.totalValidated + metrics.totalRevalidated} />
          </p>
          <p className="text-[11px] font-bold text-slate-400 mt-1">Out of {metrics.totalStudents} total students</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart Card */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ type: "spring", stiffness: 80, damping: 15, delay: 0.45 }}
          whileHover={{ y: -2, boxShadow: "0 16px 32px -4px rgba(0,0,0,0.03)" }}
          className="glass-card rounded-2xl p-6 border border-slate-200 shadow-sm transition-all duration-300"
        >
          <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
            <PieChartIcon size={16} className="text-brand-primary animate-pulse" />
            Batch Validation Status
          </h3>
          <div className="h-[300px] w-full">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={105}
                    paddingAngle={5}
                    dataKey="value"
                    onMouseEnter={(_, idx) => setActivePieIndex(idx)}
                    onMouseLeave={() => setActivePieIndex(null)}
                    isAnimationActive={true}
                    animationDuration={1300}
                    animationEasing="ease-out"
                  >
                    {pieData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]} 
                        style={{
                          transform: activePieIndex === index ? 'scale(1.04)' : 'scale(1)',
                          transformOrigin: '50% 50%',
                          transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease',
                          opacity: activePieIndex === null || activePieIndex === index ? 1 : 0.7,
                          cursor: 'pointer'
                        }}
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 8px 16px -2px rgba(0,0,0,0.05)', backgroundColor: '#ffffff', padding: '10px 14px' }}
                    itemStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                  />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm font-bold">No Data Available</div>
            )}
          </div>
        </motion.div>

        {/* Bar Chart Card */}
        <motion.div 
          initial={{ opacity: 0, y: 40 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ type: "spring", stiffness: 80, damping: 15, delay: 0.55 }}
          whileHover={{ y: -2, boxShadow: "0 16px 32px -4px rgba(0,0,0,0.03)" }}
          className="glass-card rounded-2xl p-6 border border-slate-200 shadow-sm transition-all duration-300"
        >
          <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
            <BarChart3 size={16} className="text-brand-primary" />
            Student Validations Breakdown
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={studentStatusData} 
                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
                onMouseEnter={(_, idx) => setActiveBarIndex(idx)}
                onMouseLeave={() => setActiveBarIndex(null)}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 'bold' }} dx={-10} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc', opacity: 0.5 }}
                  contentStyle={{ borderRadius: '14px', border: 'none', boxShadow: '0 8px 16px -2px rgba(0,0,0,0.05)', backgroundColor: '#ffffff', padding: '10px 14px' }}
                />
                <Bar 
                  dataKey="count" 
                  radius={[8, 8, 0, 0]}
                  isAnimationActive={true}
                  animationDuration={1300}
                  animationEasing="ease-out"
                >
                  <LabelList dataKey="count" position="top" style={{ fill: '#475569', fontSize: 11, fontWeight: 'bold' }} offset={8} />
                  {studentStatusData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.fill} 
                      opacity={activeBarIndex === null || activeBarIndex === index ? 1 : 0.65}
                      style={{
                        transition: 'opacity 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                        cursor: 'pointer'
                      }}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
