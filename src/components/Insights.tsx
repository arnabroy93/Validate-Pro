import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../../supabase';
import { Loader2, PieChart as PieChartIcon, BarChart3, Activity, Users, Database } from 'lucide-react';
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
  ResponsiveContainer
} from 'recharts';

export function Insights({ isAdminView = false }: { isAdminView?: boolean }) {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [isAdminView, profile]);

  
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch validations
      let vQuery = supabase.from('student_validations').select('batch_code, center_code, student_code, status, validated_by');
      if (!isAdminView && profile?.username) {
        vQuery = vQuery.eq('validated_by', profile.username);
      }
      
      let allValidations = [];
      
      if (isAdminView) {
        try {
          const vRes = await fetch('/api/admin/all_validations');
          if (vRes.ok) {
            allValidations = await vRes.json();
          } else {
            throw new Error('API failed');
          }
        } catch (vErr) {
          console.warn('[Insights] All validations API fetch failed, falling back to Supabase SDK:', vErr);
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
      } else {
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

      // Find relevant batches
      const relevantBatches = Array.from(new Set(allValidations.map(v => v.batch_code)));
      
      let allStudents = [];
      
      try {
        const sRes = await fetch('/api/batch_data');
        if (sRes.ok) {
          allStudents = await sRes.json();
        } else {
          throw new Error('API failed');
        }
      } catch (sErr) {
        console.warn('[Insights] Batch data API fetch failed, falling back to Supabase SDK:', sErr);
        if (relevantBatches.length > 0) {
          // Fetch only students in relevant batches, or all if admin
          let sQuery = supabase.from('batch_students').select('batch_code, center_code, student_code');
          
          let sFrom = 0;
          let sLimit = 1000;
          let sHasMore = true;
          while (sHasMore) {
            // If not admin and batches are fewer than 100, we can use .in to optimize, otherwise just fetch all and filter locally
            let currentQuery = sQuery.range(sFrom, sFrom + sLimit - 1);
            if (!isAdminView && relevantBatches.length <= 100) {
                currentQuery = currentQuery.in('batch_code', relevantBatches);
            }
            
            const { data, error } = await currentQuery;
            if (error) throw error;
            if (data && data.length > 0) {
              allStudents = [...allStudents, ...data];
              sFrom += sLimit;
              if (data.length < sLimit) sHasMore = false;
            } else {
              sHasMore = false;
            }
          }
        } else if (isAdminView) {
          // If admin but no validations exist yet, still fetch all students
          let sQuery = supabase.from('batch_students').select('batch_code, center_code, student_code');
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
      }

      if (!isAdminView && relevantBatches.length > 100) {
          allStudents = allStudents.filter(s => relevantBatches.includes(s.batch_code));
      }

      const uniqueStudentsMap = new Map();
      allStudents.forEach((s) => {
        const key = `${s.center_code}_${s.batch_code}_${s.student_code}`;
        if (!uniqueStudentsMap.has(key)) {
          uniqueStudentsMap.set(key, s);
        }
      });
      
      // For validations, keep the latest status per student
      const vDataMap = new Map();
      allValidations.forEach((v) => {
        const key = `${v.batch_code}_${v.student_code}`;
        vDataMap.set(key, v);
      });

      const summaryMap = new Map();
      
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
            rejected: 0,
            validatorSet: new Set<string>()
          });
        }
        
        const summary = summaryMap.get(sumKey);
        summary.total_students += 1;
        
        const validationRow = vDataMap.get(`${student.batch_code}_${student.student_code}`);
        
        if (validationRow?.validated_by) {
          summary.validatorSet.add(validationRow.validated_by);
        }
        
        const currentStatus = validationRow?.status || 'Pending';
        if (currentStatus === 'Validated' || currentStatus === 'Completed') summary.validated += 1;
        else if (currentStatus === 'ReValidated') summary.revalidated += 1;
        else if (currentStatus === 'Absent') summary.absent += 1;
        else if (currentStatus === 'Rejected') summary.rejected += 1;
        else summary.pending += 1;
      });
      
      let allSummaries = Array.from(summaryMap.values());
      
      if (!isAdminView && profile?.username) {
        allSummaries = allSummaries.filter(s => {
          const validators = Array.from(s.validatorSet);
          return validators.some(v => (v as string).toLowerCase().trim() === profile.username.toLowerCase().trim());
        });
      }

      setSummaryData(allSummaries);

    } catch (error: any) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

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
      <div className="flex items-center gap-3 mb-6">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          whileHover={{ y: -4, boxShadow: "0 10px 20px -3px rgba(59, 130, 246, 0.15)", borderColor: "rgba(59, 130, 246, 0.3)" }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }} 
          className="glass-card rounded-2xl p-5 border border-slate-200 shadow-sm cursor-default select-none"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg"><Database size={18} /></div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Batches</p>
          </div>
          <p className="text-3xl font-black text-slate-800">{metrics.totalBatches}</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          whileHover={{ y: -4, boxShadow: "0 10px 20px -3px rgba(16, 185, 129, 0.15)", borderColor: "rgba(16, 185, 129, 0.3)" }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }} 
          className="glass-card rounded-2xl p-5 border border-slate-200 shadow-sm cursor-default select-none"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg"><Activity size={18} /></div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fully Validated</p>
          </div>
          <p className="text-3xl font-black text-slate-800">{metrics.fullyValidatedBatches}</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          whileHover={{ y: -4, boxShadow: "0 10px 20px -3px rgba(245, 158, 11, 0.15)", borderColor: "rgba(245, 158, 11, 0.3)" }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }} 
          className="glass-card rounded-2xl p-5 border border-slate-200 shadow-sm cursor-default select-none"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg"><Activity size={18} /></div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Partially Validated</p>
          </div>
          <p className="text-3xl font-black text-slate-800">{metrics.partiallyValidatedBatches}</p>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          whileHover={{ y: -4, boxShadow: "0 10px 20px -3px rgba(99, 102, 241, 0.15)", borderColor: "rgba(99, 102, 241, 0.3)" }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }} 
          className="glass-card rounded-2xl p-5 border border-slate-200 shadow-sm cursor-default select-none"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-50 text-indigo-500 rounded-lg"><Users size={18} /></div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Students Validated</p>
          </div>
          <p className="text-3xl font-black text-slate-800">{metrics.totalValidated + metrics.totalRevalidated}</p>
          <p className="text-xs text-slate-400 mt-1">Out of {metrics.totalStudents} total</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }} className="glass-card rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
            <PieChartIcon size={16} className="text-brand-primary" />
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
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ fontWeight: 'bold' }}
                  />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-sm font-bold">No Data Available</div>
            )}
          </div>
        </motion.div>

        {/* Bar Chart */}
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6 }} className="glass-card rounded-2xl p-6 border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-6 flex items-center gap-2">
            <BarChart3 size={16} className="text-brand-primary" />
            Student Validations Breakdown
          </h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={studentStatusData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {studentStatusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
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
