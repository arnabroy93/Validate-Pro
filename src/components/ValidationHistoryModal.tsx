import React from 'react';
import { StudentValidation, ValidationAttemptLog } from '../../supabase';
import { X, Clock, Calendar, User, CheckCircle2, AlertCircle, Eye, Mic, Video, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatDate, formatTime } from '../utils';

interface ValidationHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: Partial<StudentValidation> | null;
}

export const ValidationHistoryModal: React.FC<ValidationHistoryModalProps> = ({
  isOpen,
  onClose,
  student
}) => {
  if (!isOpen || !student) return null;

  // Only display real, explicitly saved validation attempt logs
  const history: ValidationAttemptLog[] = Array.isArray(student.validation_history)
    ? student.validation_history.filter(
        h => h && h.validated_by && h.validated_by !== 'N/A' && h.remarks !== 'Initial state'
      )
    : [];

  const totalAbsentCount = student.absent_count !== undefined && student.absent_count !== null
    ? Number(student.absent_count)
    : history.filter(h => h.status === 'Absent').length || (student.status === 'Absent' ? 1 : 0);
  const totalVisitCount = student.visit_count || (history.length > 0 ? Math.max(1, ...history.map(h => h.visit_count || 1)) : 1);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[120] bg-slate-950/50 backdrop-blur-md flex items-center justify-center p-4 md:p-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.94, y: 15, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.94, y: 15, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-brand-bg w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] border border-white/50"
        >
          {/* Header */}
          <div className="p-6 border-b border-brand-border glass-card flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
                <Clock size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-brand-text">Validation History & Attempt Log</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Student: <span className="font-bold text-slate-800">{student.student_name || 'N/A'}</span> ({student.student_code}) • Batch: <span className="font-bold text-brand-primary">{student.batch_code}</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 rounded-xl transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-auto space-y-6">
            {/* Quick Stats Banner */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-white/70 border border-brand-border shadow-sm">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Total Batch Visits</p>
                <p className="text-xl font-black text-brand-primary mt-0.5">{totalVisitCount} Visit{totalVisitCount > 1 ? 's' : ''}</p>
              </div>
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-sm">
                <p className="text-[10px] uppercase tracking-wider font-bold text-amber-700">Times Marked Absent</p>
                <p className="text-xl font-black text-amber-600 mt-0.5">{totalAbsentCount} Time{totalAbsentCount !== 1 ? 's' : ''}</p>
              </div>
              <div className="p-4 rounded-2xl bg-white/70 border border-brand-border shadow-sm">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Current Status</p>
                <span className={cn(
                  "inline-block mt-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm",
                  student.status === 'Validated' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                  student.status === 'ReValidated' ? "bg-blue-500/10 text-blue-600 border-blue-500/20" :
                  student.status === 'Absent' ? "bg-slate-100 text-slate-700 border-slate-300" :
                  student.status === 'Rejected' ? "bg-rose-500/10 text-rose-600 border-rose-500/20" :
                  "bg-amber-500/10 text-amber-600 border-amber-500/20"
                )}>
                  {student.status || 'Pending'}
                </span>
              </div>
              <div className="p-4 rounded-2xl bg-white/70 border border-brand-border shadow-sm">
                <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Total Recorded Logs</p>
                <p className="text-xl font-black text-slate-700 mt-0.5">{history.length} Attempt{history.length > 1 ? 's' : ''}</p>
              </div>
            </div>

            {/* History Table */}
            <div className="glass-card rounded-2xl border border-brand-border overflow-hidden">
              <div className="px-5 py-3 border-b border-brand-border/60 bg-slate-50/70 flex justify-between items-center">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <FileText size={14} className="text-brand-primary" /> Chronological Validation Attempts
                </h4>
                <span className="text-[11px] font-medium text-slate-400">Showing {history.length} record(s)</span>
              </div>
              {history.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-[#f8fafc] border-b border-brand-border">
                      <tr className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                        <th className="px-4 py-3">Attempt #</th>
                        <th className="px-4 py-3">Visit #</th>
                        <th className="px-4 py-3">Date & Time</th>
                        <th className="px-4 py-3">Validated By</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Absent Count</th>
                        <th className="px-4 py-3">Mic / Cam</th>
                        <th className="px-4 py-3">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-divide text-xs">
                      {history.map((h, i) => (
                        <tr key={h.id || `hist-${i}`} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-brand-primary">
                            Attempt #{h.attempt_number || i + 1}
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-700">
                            Visit #{h.visit_count || 1}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="font-mono font-bold text-slate-700">{formatDate(h.date)}</p>
                            <p className="font-mono text-[10px] text-slate-400">{formatTime(h.date)}</p>
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-700">
                            {h.validated_by || 'N/A'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm",
                              h.status === 'Validated' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                              h.status === 'ReValidated' ? "bg-blue-500/10 text-blue-600 border-blue-500/20" :
                              h.status === 'Absent' ? "bg-slate-100 text-slate-800 border-slate-300" :
                              h.status === 'Rejected' ? "bg-rose-500/10 text-rose-600 border-rose-500/20" :
                              "bg-amber-500/10 text-amber-600 border-amber-500/20"
                            )}>
                              {h.status || 'Pending'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono font-bold text-slate-700">
                            <span className={cn(
                              "px-2 py-0.5 rounded border text-[10px]",
                              (h.absent_count || (h.status === 'Absent' ? 1 : 0)) > 0 ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-slate-50 text-slate-400 border-slate-200"
                            )}>
                              {h.absent_count || (h.status === 'Absent' ? 1 : 0)} x
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-[10px]">
                              <span className={cn("px-1.5 py-0.5 rounded font-bold border", h.mic_on ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-200")}>
                                Mic: {h.mic_on ? 'On' : 'Off'}
                              </span>
                              <span className={cn("px-1.5 py-0.5 rounded font-bold border", h.video_on ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-400 border-slate-200")}>
                                Cam: {h.video_on ? 'On' : 'Off'}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={h.remarks}>
                            {h.remarks || 'N/A'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center space-y-2">
                  <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <Clock size={20} />
                  </div>
                  <p className="text-sm font-bold text-slate-700">No Validation Attempts Recorded</p>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Validation logs and validator names are saved only when an active validator reviews this student and clicks <span className="font-semibold text-slate-600">"Save Changes"</span>.
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
