import React, { useEffect, useState } from 'react';
import { supabase, StudentValidation, Profile } from '../../supabase';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-hot-toast';
import { 
  Download, 
  FileText, 
  Table as TableIcon, 
  UserPlus, 
  Trash2, 
  Search, 
  RefreshCcw,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Cloud,
  Database,
  Server,
  HardDrive,
  BarChart3,
  Copy,
  Check,
  ExternalLink,
  HelpCircle,
  Key,
  Lock,
  Terminal,
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { cn, formatDate, formatTime, getAvatarUrl } from '../utils';
import { motion, AnimatePresence } from 'motion/react';

export function AdminPanel({ forcedTab }: { forcedTab?: 'users' | 'records' | 'health' | 'user_activity' | 'powerbi' }) {
  const { profile } = useAuth();
  const [validations, setValidations] = useState<StudentValidation[]>([]);
  const [allValidations, setAllValidations] = useState<StudentValidation[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedActivities, setSelectedActivities] = useState<Set<string>>(new Set());
  const [dbStatus, setDbStatus] = useState<{ 
    healthy: boolean, 
    needsSync?: boolean, 
    sql?: string, 
    supabaseApi?: string,
    postgresDirect?: string,
    details?: string[],
    dbSizeBytes?: number,
    dbSizePretty?: string,
    dbAvailableBytes?: number,
  } | null>(null);
  const [pingStatus, setPingStatus] = useState<number | null>(null);
  const [lastBackup, setLastBackup] = useState<any>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'records' | 'health' | 'user_activity' | 'powerbi'>('records');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showToken, setShowToken] = useState<boolean>(false);

  const handleCopy = (text: string, fieldId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldId);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Update internal tab when prop changes
  useEffect(() => {
    if (forcedTab) {
      setActiveSubTab(forcedTab);
    }
  }, [forcedTab]);
  
  // New user state
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' as 'admin' | 'user' });

  useEffect(() => {
    fetchData();
    checkDbHealth();
    fetchLastBackup();
    
    let interval: number;
    // Set up polling for health check when active
    if (activeSubTab === 'health') {
      interval = window.setInterval(() => {
        checkDbHealth();
      }, 5000); // 5 seconds real-time update
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeSubTab]);

  const fetchLastBackup = async () => {
    try {
      const res = await fetch('/api/admin/last-backup');
      if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
        const data = await res.json();
        setLastBackup(data);
      }
    } catch (e) {}
  };

  const handleExportSql = async () => {
    if (!profile) return;
    setBackupLoading(true);
    try {
      const res = await fetch('/api/admin/export-sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_name: profile.username, admin_id: profile.id })
      });
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) throw new Error('Backup failed');
      const data = await res.json();
      const blob = new Blob([data.sql], { type: 'application/sql' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `database_backup_${new Date().toISOString().split('T')[0]}.sql`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Database backup exported successfully');
      fetchLastBackup();
    } catch (e: any) {
      toast.error('Failed to export backup: ' + e.message);
    } finally {
      setBackupLoading(false);
    }
  };

  const checkDbHealth = async () => {
    try {
      const startTime = Date.now();
      const res = await fetch('/api/admin/db-check');
      const endTime = Date.now();
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) {
        throw new Error('DB check failed');
      }
      const data = await res.json();
      setDbStatus(data);
      setPingStatus(endTime - startTime);
    } catch (e) {
      console.error('DB check failed', e);
      setPingStatus(null);
      // Fallback state if the backend server is dead and cannot be reached
      setDbStatus(prev => ({
        ...(prev || {}),
        healthy: false,
        supabaseApi: 'server_down',
        postgresDirect: 'server_down',
        details: ['Connection to Node.js Backend Server failed. Refresh or restart server.']
      }));
    }
  };

  const fetchAllTableData = async (tableName: string) => {
    let allData: any[] = [];
    let from = 0;
    let limit = 1000;
    let hasMore = true;
    while (hasMore) {
      let query = supabase.from(tableName).select('*');
      if (tableName === 'student_validations') {
         query = query.order('created_at', { ascending: false }).order('id', { ascending: false });
      } else {
         query = query.order('id', { ascending: false });
      }
      const { data, error } = await query.range(from, from + limit - 1);
      
      if (error) throw error;
      if (data && data.length > 0) {
        allData = [...allData, ...data];
        from += limit;
        if (data.length < limit) hasMore = false;
      } else {
        hasMore = false;
      }
    }
    return allData;
  };

  const [batchStats, setBatchStats] = useState<Record<string, { total: number, validated: number, pending: number }>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const [allValsRes, pData, batchStatsRes] = await Promise.all([
        fetch('/api/admin/all_validations'),
        fetchAllTableData('profiles'),
        fetch('/api/batch_stats')
      ]);

      const vData = (allValsRes.ok && allValsRes.headers.get('content-type')?.includes('application/json')) ? await allValsRes.json() : [];
      const stats = (batchStatsRes.ok && batchStatsRes.headers.get('content-type')?.includes('application/json')) ? await batchStatsRes.json() : {};
      
      // Deduplicate validations by student_code for admin panel (latest validation per student)
      const uniqueValsMap = new Map();
      vData.forEach(v => {
        const key = `${v.center_code}_${v.batch_code}_${v.student_code}`;
        // vData is ordered by created_at desc (newest first). 
        // We only want to keep the newest validation status per student.
        if (!uniqueValsMap.has(key)) {
           uniqueValsMap.set(key, v);
        }
      });
      const deduplicatedValidations = Array.from(uniqueValsMap.values()) as StudentValidation[];
      
      setBatchStats(stats);
      setAllValidations(vData);
      setValidations(deduplicatedValidations);
      setUsers(pData || []);
    } catch (error: any) {
      toast.error('Error fetching data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getMappedDataForExport = (data: any[], prefix: string) => {
    return data.map(v => {
      const d = new Date(v.created_at || new Date());
      const dateOnly = formatDate(d);
      const timeOnly = formatTime(d);
      
      if (prefix === 'User_Activity') {
        return {
          'Batch Code': v.batch_code,
          'Validation Status': v.status,
          'Total no. of Student': v.total,
          'No. of Validation': v.validated,
          'No. of Pending': v.pending,
          'Validated By': v.validated_by,
          'Date': dateOnly,
          'Time': timeOnly
        };
      }
      
      return {
        'Student Code': v.student_code,
        'Student Name': v.student_name,
        'Batch Code': v.batch_code,
        'Validation Status': v.status,
        'Validation Type': v.validation_type || 'N/A',
        'Recording Link': v.recording_link || 'N/A',
        'Aligned AE': v.aligned_ae || v.ae_name || 'N/A',
        'Validated By': v.validated_by,
        'Date': dateOnly,
        'Time': timeOnly
      };
    });
  };

  const handleExportExcel = (data?: any | any[], prefix?: any) => {
    const exportData = Array.isArray(data) ? data : validations;
    const exportPrefix = typeof prefix === 'string' ? prefix : 'Validations';
    const mappedData = getMappedDataForExport(exportData, exportPrefix);
    const ws = XLSX.utils.json_to_sheet(mappedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    XLSX.writeFile(wb, `${exportPrefix}_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportCSV = (data?: any | any[], prefix?: any) => {
    const exportData = Array.isArray(data) ? data : validations;
    const exportPrefix = typeof prefix === 'string' ? prefix : 'Validations';
    const mappedData = getMappedDataForExport(exportData, exportPrefix);
    const ws = XLSX.utils.json_to_sheet(mappedData);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${exportPrefix}_Export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = (data?: any | any[], prefix?: any) => {
    const exportData = Array.isArray(data) ? data : validations;
    const exportPrefix = typeof prefix === 'string' ? prefix : 'Validations';
    const doc = new jsPDF('l', 'pt');
    
    let head = [['Code', 'Name', 'Batch', 'Status', 'Validation Type', 'Recording Link', 'Aligned AE', 'Validated By', 'Date', 'Time']];
    let bodyData: any[] = [];
    
    if (exportPrefix === 'User_Activity') {
      head = [['Batch Code', 'Validation Status', 'Total no. of Student', 'No. of Validation', 'No. of Pending', 'Validated By', 'Date', 'Time']];
      bodyData = exportData.map(v => {
        const d = new Date(v.created_at || new Date());
        const dateOnly = formatDate(d);
        const timeOnly = formatTime(d);
        return [
          v.batch_code, v.status, v.total, v.validated, v.pending, v.validated_by, dateOnly, timeOnly
        ];
      });
    } else {
      bodyData = exportData.map(v => [
        v.student_code, v.student_name, v.batch_code, v.status, v.validation_type || 'N/A', v.recording_link || 'N/A', v.aligned_ae || v.ae_name || 'N/A', v.validated_by, v.created_at ? formatDate(v.created_at) : 'N/A', v.created_at ? formatTime(v.created_at) : 'N/A'
      ]);
    }
    
    autoTable(doc, {
      head: head,
      body: bodyData,
      theme: 'grid',
      headStyles: { fillColor: '#8b5cf6' }
    });
    
    doc.save(`${exportPrefix}_Export_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) throw new Error('Failed to create user');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success('User created successfully');
      setNewUser({ username: '', password: '', role: 'user' });
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete user');
      
      toast.success('User deleted');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (id: string, role: 'admin' | 'user') => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role })
      });
      if (!res.ok) throw new Error('Failed to update role');
      
      toast.success('User role updated');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredValidations = validations.filter(v => 
    (activeSubTab === 'records' ? v.validated_by?.toLowerCase().trim() === profile?.username?.toLowerCase().trim() : true) &&
    (v.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.student_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.batch_code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const batchActivityData = React.useMemo(() => {
    const grouped = new Map<string, any>();
    
    // Compute purely from deduplicated student_validations (validations)
    validations.forEach(v => {
      if (!grouped.has(v.batch_code)) {
        grouped.set(v.batch_code, {
          id: v.batch_code,
          batch_code: v.batch_code,
          validated_by: v.validated_by || 'Unknown',
          created_at: v.created_at,
          validatorSet: new Set(v.validated_by ? [v.validated_by] : []),
          totalSet: new Set([v.student_code]),
          validatedSet: new Set(
            (v.status?.toLowerCase() === 'validated' || v.status?.toLowerCase() === 'revalidated') ? [v.student_code] : []
          ),
          total: 0,
          validated: 0,
          pending: 0,
          status: 'Partial'
        });
      } else {
        const current = grouped.get(v.batch_code);
        
        current.totalSet.add(v.student_code);
        if (v.status?.toLowerCase() === 'validated' || v.status?.toLowerCase() === 'revalidated') {
          current.validatedSet.add(v.student_code);
        }

        if (v.validated_by) {
          current.validatorSet.add(v.validated_by);
          current.validated_by = Array.from(current.validatorSet).join(', ');
        }
        // Keep the latest timestamp
        if (v.created_at && (!current.created_at || new Date(v.created_at) > new Date(current.created_at))) {
          current.created_at = v.created_at;
        }
      }
    });

    return Array.from(grouped.values()).map(g => {
      g.total = g.totalSet.size;
      g.validated = g.validatedSet.size;
      g.pending = Math.max(0, g.total - g.validated);
      g.status = g.total > 0 && g.pending === 0 ? "Completed" : "Partial";
      return g;
    }).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [validations]);

  const filteredBatchActivities = batchActivityData.filter(v => 
    v.batch_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.validated_by && v.validated_by.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const toggleActivitySelection = (id: string) => {
    const newSelection = new Set(selectedActivities);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedActivities(newSelection);
  };

  const selectAllActivities = () => {
    if (selectedActivities.size === filteredBatchActivities.length && filteredBatchActivities.length > 0) {
      setSelectedActivities(new Set());
    } else {
      setSelectedActivities(new Set(filteredBatchActivities.map(v => v.id)));
    }
  };

  const getExportData = () => {
    if (selectedActivities.size === 0) return filteredBatchActivities;
    return filteredBatchActivities.filter(v => selectedActivities.has(v.id));
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="glass-card p-8 rounded-2xl shadow-sm border border-brand-border backdrop-blur-md">
        <h1 className="text-3xl font-black text-brand-text tracking-tight uppercase italic flex items-center gap-3">
          {activeSubTab === 'records' && <FileText className="text-brand-primary" size={28} />}
          {activeSubTab === 'users' && <UserPlus className="text-brand-primary" size={28} />}
          {activeSubTab === 'health' && <RefreshCcw className="text-brand-primary" size={28} />}
          {activeSubTab === 'user_activity' && <FileText className="text-brand-primary" size={28} />}
          {activeSubTab === 'powerbi' && <BarChart3 className="text-brand-primary" size={28} />}
          {activeSubTab === 'records' ? 'Validation Intelligence' : 
           activeSubTab === 'users' ? 'Account Control' : 
           activeSubTab === 'user_activity' ? 'User Activity Log' : 
           activeSubTab === 'powerbi' ? 'Power BI Integration' : 'System Integrity'}
        </h1>
        <p className="text-slate-500 text-sm mt-1 font-medium italic opacity-70">
          {activeSubTab === 'records' && "Real-time auditing and verification history."}
          {activeSubTab === 'users' && "Manage system access and specialized auditor roles."}
          {activeSubTab === 'user_activity' && "Track every single action and validation performed by users."}
          {activeSubTab === 'health' && "Deep-level diagnostics of infrastructure and database sync state."}
          {activeSubTab === 'powerbi' && "Expose and connect live auditing metrics to power-up Microsoft Power BI reports."}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === 'health' && (
          <motion.div
            key="health"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Database Health Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className={cn(
                "p-6 rounded-2xl border transition-all flex items-center justify-between shadow-sm bg-white",
                pingStatus !== null ? "border-emerald-100" : "border-red-100"
              )}>
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shadow-inner",
                    pingStatus !== null ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                  )}>
                    <Server size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Node Server</p>
                    <p className={cn(
                      "text-lg font-bold",
                      pingStatus !== null ? "text-emerald-700" : "text-red-700"
                    )}>
                      {pingStatus !== null ? `${pingStatus}ms latency` : 'Offline'}
                    </p>
                  </div>
                </div>
                {pingStatus !== null && <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />}
              </div>

              <div className={cn(
                "p-6 rounded-2xl border transition-all flex items-center justify-between shadow-sm bg-white",
                dbStatus?.supabaseApi === 'working' ? "border-emerald-100" : "border-red-100"
              )}>
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shadow-inner",
                    dbStatus?.supabaseApi === 'working' ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                  )}>
                    <Cloud size={24} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Supabase API</p>
                    <p className={cn(
                      "text-lg font-bold",
                      dbStatus?.supabaseApi === 'working' ? "text-emerald-700" : "text-red-700"
                    )}>
                      {dbStatus?.supabaseApi?.replace('_', ' ') || 'Authenticating...'}
                    </p>
                  </div>
                </div>
                {dbStatus?.supabaseApi === 'working' && <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />}
              </div>

              {/* Database Storage Stats */}
              <div className="p-6 rounded-2xl border border-slate-200 transition-all shadow-sm bg-white flex flex-col justify-center">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner bg-brand-light text-brand-primary">
                    <HardDrive size={24} />
                  </div>
                  <div className="flex-1 w-full">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Database Storage</p>
                      <span className="text-xs font-bold text-slate-700">
                        {dbStatus?.dbSizePretty || 
                          (dbStatus?.postgresDirect === 'failed' ? 'Unavailable (DB Auth Error)' : 
                           dbStatus?.postgresDirect === 'missing_env_var_or_failed' ? 'Unavailable (No DB URL)' : 
                           'Loading...')}
                      </span>
                    </div>
                    {dbStatus?.dbSizeBytes && (
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={cn("h-full rounded-full transition-all duration-1000", (dbStatus.dbSizeBytes / (dbStatus.dbAvailableBytes || 500 * 1024 * 1024)) > 0.8 ? "bg-red-500" : "bg-emerald-400")} 
                          style={{ width: `${Math.min(100, Math.max(0, (dbStatus.dbSizeBytes / (dbStatus.dbAvailableBytes || 500 * 1024 * 1024)) * 100))}%` }}
                        />
                      </div>
                    )}
                    {dbStatus?.dbAvailableBytes && (
                      <p className="text-[9px] text-right text-slate-400 uppercase mt-1 tracking-wider whitespace-nowrap">
                        <span className="font-bold">{(dbStatus.dbAvailableBytes / 1024 / 1024).toFixed(0)} MB</span> total space
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* SQL Backup Node */}
            <div className="p-6 rounded-2xl border border-slate-200 transition-all shadow-sm bg-white flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shadow-inner bg-slate-50 text-slate-600">
                  <Database size={24} />
                </div>
                <div className="text-center md:text-left">
                  <h3 className="font-bold text-slate-800">SQL Database Backup</h3>
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 mt-1">Export entire backend as SQL sequence to free up space</p>
                </div>
              </div>
              <div className="flex flex-col items-center md:items-end w-full md:w-auto">
                <button 
                  onClick={handleExportSql} 
                  disabled={backupLoading}
                  className="btn-primary py-2 px-6 shadow-sm text-sm flex items-center gap-2 mb-2 w-full md:w-auto justify-center"
                >
                  {backupLoading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  Export Complete SQL Database
                </button>
                <div className="bg-slate-50 p-2 px-4 rounded-xl border border-slate-100 text-xs text-slate-500 w-full text-center">
                  {lastBackup ? (
                    <span>Last backup: <strong className="text-slate-700">{formatDate(lastBackup.created_at)}</strong> by {lastBackup.admin_name}</span>
                  ) : (
                    <span>No previous SQL backups.</span>
                  )}
                </div>
              </div>
            </div>

            {dbStatus?.needsSync && (
              <div className="p-6 bg-amber-50 rounded-2xl border border-amber-200 shadow-sm animate-pulse-light">
                <div className="flex items-center gap-3 text-amber-800 mb-2">
                  <ShieldAlert size={20} />
                  <h3 className="font-bold">Database Schema Update Required</h3>
                </div>
                <p className="text-sm text-amber-700 mb-4">
                  It looks like the system requires a schema update (e.g. creating the backups table). Please copy the SQL below and run it in your Supabase dashboard SQL Editor.
                </p>
                <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto relative group">
                  <pre className="text-emerald-400 text-xs font-mono whitespace-pre-wrap">{dbStatus.sql}</pre>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(dbStatus.sql || '');
                      toast.success('SQL copied to clipboard');
                    }}
                    className="text-xs absolute top-2 right-2 bg-slate-800 hover:bg-slate-700 text-white px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Copy SQL
                  </button>
                </div>
              </div>
            )}
            
          </motion.div>
        )}

        {activeSubTab === 'users' && (
          <motion.div
            key="users"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-8"
          >
            <div className="lg:col-span-1 space-y-6">
              <div className="glass-card p-8 space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-light rounded-xl flex items-center justify-center text-brand-hover shadow-inner">
                    <UserPlus size={20} />
                  </div>
                  <h3 className="text-lg font-bold text-brand-text">Add New Account</h3>
                </div>
                <form onSubmit={handleCreateUser} className="space-y-5" id="create-user-form">
                  <div className="space-y-2">
                    <label htmlFor="newUser-username" className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Username</label>
                    <input 
                      id="newUser-username"
                      type="text" 
                      required
                      value={newUser.username}
                      onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                      className="input-field py-3"
                      placeholder="e.g. arnab_j"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="newUser-password" className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Password</label>
                    <input 
                      id="newUser-password"
                      type="password" 
                      required
                      value={newUser.password}
                      onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                      className="input-field py-3"
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="newUser-role" className="text-[10px] font-black text-slate-400 uppercase tracking-widest block px-1">Access Level</label>
                    <select 
                      id="newUser-role"
                      value={newUser.role}
                      onChange={(e) => setNewUser({...newUser, role: e.target.value as any})}
                      className="input-field py-3"
                    >
                      <option value="user">Standard User (Field Duty)</option>
                      <option value="admin">Administrator (Full Access)</option>
                    </select>
                  </div>
                  <button 
                    id="submit-create-user"
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full flex items-center justify-center gap-2 py-4 rounded-xl shadow-lg shadow-brand-primary/20"
                  >
                    {loading ? <Loader2 className="animate-spin h-5 w-5" /> : 'Deploy Account'}
                  </button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-white rounded-2xl shadow-sm border border-brand-border h-full flex flex-col">
                <div className="p-6 border-b border-brand-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="text-brand-primary" size={24} />
                    <h3 className="text-lg font-bold text-brand-text">Active User Directory</h3>
                  </div>
                  <div className="bg-brand-light px-3 py-1 rounded-full text-[10px] font-black text-brand-hover uppercase tracking-widest">
                    {users.length} Total
                  </div>
                </div>
                
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {users.map((u, idx) => (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2, delay: Math.min(idx * 0.05, 0.3) }}
                      key={u.id} 
                      className="p-5 bg-brand-input rounded-2xl border border-brand-border hover:border-brand-primary transition-all group space-y-4 relative"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={cn(
                            "w-12 h-12 rounded-xl overflow-hidden shadow-sm shrink-0 border relative",
                            u.role === 'admin' 
                              ? "border-brand-primary bg-brand-light" 
                              : "border-brand-border bg-slate-50"
                          )}>
                            <img 
                              src={getAvatarUrl(u.username || 'user', u.role)} 
                              alt={u.username}
                              className="w-full h-full object-cover relative z-10"
                            />
                            {u.role === 'admin' && (
                              <div className="absolute inset-0 bg-brand-primary/10 z-20 mix-blend-overlay"></div>
                            )}
                          </div>
                          <div className="truncate">
                            <p className="font-bold text-sm text-brand-text truncate leading-none mb-1">{u.username}</p>
                            <p className="text-[10px] text-slate-400 font-medium truncate">{u.email || `${u.username}@validpro.internal`}</p>
                          </div>
                        </div>
                        {u.id !== profile?.id && (
                          <button 
                            onClick={() => handleDeleteUser(u.id)} 
                            className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                            title="Delete User"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between pt-4 border-t border-brand-border/50">
                        <span className={cn(
                          "px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest",
                          u.role === 'admin' ? "bg-brand-primary/10 text-brand-primary" : "bg-slate-100 text-slate-500"
                        )}>
                          {u.role}
                        </span>
                        
                        <div className="flex bg-white rounded-xl p-1 border border-brand-border shadow-inner">
                          <button
                            onClick={() => u.role !== 'admin' && handleUpdateRole(u.id, 'admin')}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                              u.role === 'admin' ? "bg-brand-primary text-white shadow-md shadow-brand-primary/20" : "text-slate-400 hover:text-brand-text"
                            )}
                          >
                            Set Admin
                          </button>
                          <button
                            onClick={() => u.role !== 'user' && handleUpdateRole(u.id, 'user')}
                            className={cn(
                              "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                              u.role === 'user' ? "bg-brand-primary text-white shadow-md shadow-brand-primary/20" : "text-slate-400 hover:text-brand-text"
                            )}
                          >
                            Set User
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeSubTab === 'records' && (
          <motion.div
            key="records"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Universal search: Name, Code, Batch..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-brand-border rounded-2xl py-4 pl-12 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-muted/50 shadow-sm transition-all"
                />
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <button onClick={() => handleExportExcel(filteredValidations, 'Validations')} className="flex-1 md:flex-none btn-secondary bg-white py-3 border-emerald-100 text-emerald-600 hover:bg-emerald-50">
                  <TableIcon size={16} /> Excel
                </button>
                <button onClick={() => handleExportPDF(filteredValidations, 'Validations')} className="flex-1 md:flex-none btn-secondary bg-white py-3 border-red-100 text-red-600 hover:bg-red-50">
                  <Download size={16} /> PDF
                </button>
                <button onClick={fetchData} className="p-3 bg-white text-brand-hover rounded-2xl border border-brand-border hover:bg-brand-muted transition-colors shadow-sm">
                  <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            <div className="glass-card rounded-2xl shadow-lg border border-brand-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-white/40 border-b border-brand-border backdrop-blur-sm">
                    <tr className="text-brand-text/70 text-[10px] font-black uppercase tracking-widest">
                      <th className="px-8 py-5">Student Identity</th>
                      <th className="px-8 py-5">Batch & Center Code</th>
                      <th className="px-8 py-5">Validation Status</th>
                      <th className="px-8 py-5">Validation Details</th>
                      <th className="px-8 py-5">Validated By</th>
                      <th className="px-8 py-5 text-right whitespace-nowrap">Date & Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-divide">
                    {filteredValidations.length > 0 ? (
                      filteredValidations.map((v, idx) => (
                        <motion.tr 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: Math.min(idx * 0.05, 0.5) }}
                          key={v.id} 
                          className={cn(idx % 2 === 0 ? "bg-white/20" : "bg-white/10", "hover:bg-brand-light transition-colors group backdrop-blur-sm")}
                        >
                          <td className="px-8 py-5 whitespace-nowrap">
                            <p className="font-bold text-sm text-brand-text mb-0.5">{v.student_name}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] bg-slate-900 text-white px-1.5 py-0.5 rounded font-mono font-black">{v.student_code}</span>
                              <span className="text-[9px] text-slate-400 font-bold">{v.father_name}</span>
                            </div>
                          </td>
                          <td className="px-8 py-5 whitespace-nowrap">
                            <p className="font-bold text-slate-600 text-xs mb-0.5">{v.batch_code}</p>
                            <div className="flex items-center gap-1.5">
                              <p className="text-[9px] uppercase font-black text-brand-primary tracking-widest">{v.center_code}</p>
                              <span className="h-3 w-[1px] bg-slate-200" />
                              <p className="text-[9px] text-slate-400 font-bold">{v.aligned_ae || v.ae_name || 'N/A'}</p>
                            </div>
                          </td>
                          <td className="px-8 py-5 whitespace-nowrap">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm",
                              v.status === 'Validated' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                              v.status === 'ReValidated' ? "bg-blue-50 text-blue-700 border-blue-200" :
                              v.status === 'Absent' ? "bg-amber-50 text-amber-700 border-amber-200" :
                              "bg-rose-50 text-rose-700 border-rose-200"
                            )}>
                              {v.status}
                            </span>
                          </td>
                          <td className="px-8 py-5 whitespace-nowrap">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span className={cn(
                                  "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border",
                                  v.validation_type === 'Online' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                  v.validation_type === 'Offline' ? "bg-blue-50 text-blue-700 border-blue-200" :
                                  "bg-slate-50 text-slate-700 border-slate-300" 
                                )}>
                                  {v.validation_type || 'N/A'}
                                </span>
                              </div>
                              <a href={v.recording_link && v.recording_link !== 'N.A.' && v.recording_link.startsWith('http') ? v.recording_link : undefined} 
                                 target="_blank" 
                                 rel="noopener noreferrer" 
                                 className={cn("text-[10px] truncate max-w-[120px] font-bold block", v.recording_link && v.recording_link !== 'N.A.' ? "text-brand-primary underline" : "text-slate-400 pointer-events-none")}>
                                {v.recording_link || 'N/A'}
                              </a>
                            </div>
                          </td>
                          <td className="px-8 py-5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <img src={getAvatarUrl(v.validated_by || 'system')} alt={v.validated_by || 'system'} className="w-6 h-6 rounded-full border border-brand-border shadow-inner" />
                              <span className="text-[11px] text-slate-600 font-bold">
                                {v.validated_by === 'Self' ? 'Internal System' : v.validated_by}
                              </span>
                            </div>
                          </td>
                          <td className="px-8 py-5 whitespace-nowrap text-right">
                             <p className="text-[11px] text-slate-500 font-mono font-bold">{formatDate(v.created_at!)}</p>
                             <p className="text-[10px] text-slate-400 font-mono">{formatTime(v.created_at!)}</p>
                          </td>
                        </motion.tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-8 py-20 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <Search size={48} className="text-slate-200" />
                            <p className="text-slate-400 font-bold">No records matched your specific criteria.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeSubTab === 'user_activity' && (
          <motion.div
            key="user_activity"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Filter by Name, Code, Batch, or Validated By..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-brand-border rounded-2xl py-4 pl-12 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-muted/50 shadow-sm transition-all"
                />
              </div>
              <div className="flex gap-2 w-full md:w-auto">
                <div className="flex bg-slate-100 rounded-2xl p-1 gap-1 border border-slate-200 shadow-inner px-2 pt-1 pb-1">
                  <div className="flex flex-col justify-center px-2 mr-2 border-r border-slate-200">
                    <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Export</span>
                  </div>
                  <button onClick={() => handleExportExcel(getExportData(), 'User_Activity')} className="p-2.5 rounded-xl bg-white/80 text-emerald-600 hover:bg-emerald-50 hover:shadow-sm transition-all flex items-center gap-2">
                    <TableIcon size={16} /><span className="text-xs font-bold">Excel</span>
                  </button>
                  <button onClick={() => handleExportCSV(getExportData(), 'User_Activity')} className="p-2.5 rounded-xl bg-white/80 text-sky-600 hover:bg-sky-50 hover:shadow-sm transition-all flex items-center gap-2">
                    <TableIcon size={16} /><span className="text-xs font-bold">CSV</span>
                  </button>
                  <button onClick={() => handleExportPDF(getExportData(), 'User_Activity')} className="p-2.5 rounded-xl bg-white/80 text-red-600 hover:bg-red-50 hover:shadow-sm transition-all flex items-center gap-2">
                    <Download size={16} /><span className="text-xs font-bold">PDF</span>
                  </button>
                </div>
                <button onClick={fetchData} className="p-3 bg-white text-brand-hover rounded-2xl border border-brand-border hover:bg-brand-muted transition-colors shadow-sm">
                  <RefreshCcw size={16} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            </div>

            <div className="glass-card rounded-2xl shadow-lg border border-brand-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-white/40 border-b border-brand-border backdrop-blur-sm">
                    <tr className="text-brand-text/70 text-[10px] font-black uppercase tracking-widest">
                      <th className="px-6 py-5 w-12 text-center">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary w-4 h-4 cursor-pointer"
                          checked={selectedActivities.size === filteredBatchActivities.length && filteredBatchActivities.length > 0}
                          onChange={selectAllActivities}
                        />
                      </th>
                      <th className="px-6 py-5">Batch Code</th>
                      <th className="px-6 py-5">Validation Status</th>
                      <th className="px-6 py-5 text-center">Total Students</th>
                      <th className="px-6 py-5 text-center">Validated</th>
                      <th className="px-6 py-5 text-center">Pending</th>
                      <th className="px-6 py-5">Validated By</th>
                      <th className="px-6 py-5 text-right whitespace-nowrap">Date & Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-divide">
                    {filteredBatchActivities.length > 0 ? (
                      filteredBatchActivities.map((v, idx) => {
                        const d = new Date(v.created_at || new Date());
                        const dateOnly = formatDate(d);
                        return (
                        <motion.tr 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.2, delay: Math.min(idx * 0.05, 0.5) }}
                          key={`${v.id}-${idx}`} 
                          className={cn(
                            idx % 2 === 0 ? "bg-white/20" : "bg-white/10", 
                            "hover:bg-brand-light transition-colors group backdrop-blur-sm",
                            selectedActivities.has(v.id!) ? 'bg-brand-muted/40' : ''
                          )}
                        >
                          <td className="px-6 py-5 text-center cursor-pointer" onClick={(e) => { e.stopPropagation(); toggleActivitySelection(v.id!); }}>
                            <input 
                              type="checkbox"
                              className="rounded border-slate-300 text-brand-primary focus:ring-brand-primary w-4 h-4 cursor-pointer pointer-events-none"
                              checked={selectedActivities.has(v.id!)}
                              readOnly
                            />
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <p className="font-bold text-slate-600 text-xs">{v.batch_code}</p>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <span className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm",
                              v.status === 'Completed' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                              v.status === 'Partial' ? "bg-amber-50 text-amber-700 border-amber-200" :
                              "bg-rose-50 text-rose-700 border-rose-200"
                            )}>
                              {v.status}
                            </span>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-center">
                            <span className="text-xs font-bold text-slate-600">{v.total}</span>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-center">
                            <span className="text-xs font-bold text-emerald-600">{v.validated}</span>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-center">
                            <span className="text-xs font-bold text-amber-600">{v.pending}</span>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <img src={getAvatarUrl(v.validated_by || 'system')} alt={v.validated_by || 'system'} className="w-6 h-6 rounded-full border border-brand-border shadow-inner" />
                              <span className="text-[11px] text-slate-600 font-bold">
                                {v.validated_by === 'Self' ? 'Internal System' : v.validated_by}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap text-right">
                             <p className="text-[11px] text-slate-500 font-mono font-bold">{formatDate(d)}</p>
                             <p className="text-[10px] text-slate-400 font-mono">{formatTime(d)}</p>
                          </td>
                        </motion.tr>
                      )})
                    ) : (
                      <tr>
                        <td colSpan={8} className="px-8 py-20 text-center">
                          <div className="flex flex-col items-center gap-3">
                            <Search size={48} className="text-slate-200" />
                            <p className="text-slate-400 font-bold">No activities matched your specific criteria.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeSubTab === 'powerbi' && (
          <motion.div
            key="powerbi"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            {/* Banner overview */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-orange-200/50 p-6 rounded-2xl flex flex-col md:flex-row shadow-sm justify-between gap-6">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-orange-100 text-orange-600">
                    <BarChart3 size={20} />
                  </div>
                  <h3 className="font-bold text-orange-950 text-base">Direct Microsoft Power BI Integration</h3>
                </div>
                <p className="text-sm text-orange-800 max-w-3xl leading-relaxed">
                  Enhance your business intelligence by connecting this live auditing database directly to **Power BI**. 
                  Our backend feeds pre-calculated and real-time audit summaries without manual table exports or storage concerns.
                </p>
              </div>
              <div className="flex items-center shrink-0">
                <span className="text-xs bg-orange-600 text-white font-bold px-3.5 py-1.5 rounded-full uppercase tracking-wider shadow-sm">
                  Live Feed Status: Active
                </span>
              </div>
            </div>

            {/* Main grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Left Column: API URLs & Credentials (7 Columns) */}
              <div className="lg:col-span-7 space-y-6">
                
                {/* REST API Feeds */}
                <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <Terminal className="text-brand-primary" size={20} />
                    <h3 className="font-bold text-slate-800">1. REST API Web Connector Feeds</h3>
                  </div>
                  <p className="text-xs text-slate-500">
                    Copy any endpoint below. Power BI Desktop natively ingests these as flat datasets via the standard **Web** query connector.
                  </p>

                  <div className="space-y-4 pt-2">
                    
                    {/* summary Feed */}
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black uppercase tracking-wider text-brand-primary">Unified Coverage & Status Feed</span>
                        <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">Highly Recommended</span>
                      </div>
                      <p className="text-[11px] text-slate-500">Combines student demographics alongside corresponding audit validation statuses.</p>
                      
                      <div className="space-y-2.5 bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-sm">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wide">Option A: CSV Link (Recommended for Power BI)</span>
                            <span className="text-[9px] text-emerald-500 italic font-semibold">Immediate multi-column grid table</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input 
                              readOnly 
                              value={`${window.location.origin}/api/powerbi/summary?token=${'VP-PBI-Sec-9988-ABC'}&format=csv`}
                              className="flex-1 shrink text-[10px] bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 font-mono select-all truncate"
                            />
                            <button 
                              onClick={() => handleCopy(`${window.location.origin}/api/powerbi/summary?token=${'VP-PBI-Sec-9988-ABC'}&format=csv`, 'summary-csv')}
                              className="btn-secondary h-8 w-8 p-0 flex items-center justify-center shrink-0 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg shadow-sm"
                              title="Copy CSV Link"
                            >
                              {copiedField === 'summary-csv' ? <Check className="text-emerald-600" size={14} /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>

                        <div className="border-t border-slate-100 pt-2.5">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide">Option B: JSON Link</span>
                            <span className="text-[9px] text-slate-400 italic">Forces manual "Convert" steps in Power Query</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input 
                              readOnly 
                              value={`${window.location.origin}/api/powerbi/summary?token=${'VP-PBI-Sec-9988-ABC'}`}
                              className="flex-1 shrink text-[10px] bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 font-mono select-all truncate"
                            />
                            <button 
                              onClick={() => handleCopy(`${window.location.origin}/api/powerbi/summary?token=${'VP-PBI-Sec-9988-ABC'}`, 'summary-json')}
                              className="btn-secondary h-8 w-8 p-0 flex items-center justify-center shrink-0 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg shadow-sm"
                              title="Copy JSON Link"
                            >
                              {copiedField === 'summary-json' ? <Check className="text-emerald-600" size={14} /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Students Feed */}
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2.5">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-600">Raw Student Demographics Feed</span>
                      <p className="text-[11px] text-slate-500">Exposes the full unedited list of batch student codes, qualification status, and locations.</p>
                      
                      <div className="space-y-2.5 bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-sm">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wide">Option A: CSV Link (Recommended for Power BI)</span>
                            <span className="text-[9px] text-emerald-500 italic font-semibold">Immediate multi-column grid table</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input 
                              readOnly 
                              value={`${window.location.origin}/api/powerbi/students?token=${'VP-PBI-Sec-9988-ABC'}&format=csv`}
                              className="flex-1 shrink text-[10px] bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 font-mono select-all truncate"
                            />
                            <button 
                              onClick={() => handleCopy(`${window.location.origin}/api/powerbi/students?token=${'VP-PBI-Sec-9988-ABC'}&format=csv`, 'students-csv')}
                              className="btn-secondary h-8 w-8 p-0 flex items-center justify-center shrink-0 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg shadow-sm"
                              title="Copy CSV Link"
                            >
                              {copiedField === 'students-csv' ? <Check className="text-emerald-600" size={14} /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>

                        <div className="border-t border-slate-100 pt-2.5">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide">Option B: JSON Link</span>
                            <span className="text-[9px] text-slate-400 italic">Requires Power Query table conversion</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input 
                              readOnly 
                              value={`${window.location.origin}/api/powerbi/students?token=${'VP-PBI-Sec-9988-ABC'}`}
                              className="flex-1 shrink text-[10px] bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 font-mono select-all truncate"
                            />
                            <button 
                              onClick={() => handleCopy(`${window.location.origin}/api/powerbi/students?token=${'VP-PBI-Sec-9988-ABC'}`, 'students-json')}
                              className="btn-secondary h-8 w-8 p-0 flex items-center justify-center shrink-0 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg shadow-sm"
                              title="Copy JSON Link"
                            >
                              {copiedField === 'students-json' ? <Check className="text-emerald-600" size={14} /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Validations Feed */}
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2.5">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-600">Raw Audit Validation Records</span>
                      <p className="text-[11px] text-slate-500">Detailed logs specifying which auditor validated each record, remarks, and links.</p>
                      
                      <div className="space-y-2.5 bg-white p-3.5 rounded-xl border border-slate-200/60 shadow-sm">
                        <div>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wide">Option A: CSV Link (Recommended for Power BI)</span>
                            <span className="text-[9px] text-emerald-500 italic font-semibold">Immediate multi-column grid table</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input 
                              readOnly 
                              value={`${window.location.origin}/api/powerbi/validations?token=${'VP-PBI-Sec-9988-ABC'}&format=csv`}
                              className="flex-1 shrink text-[10px] bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 font-mono select-all truncate"
                            />
                            <button 
                              onClick={() => handleCopy(`${window.location.origin}/api/powerbi/validations?token=${'VP-PBI-Sec-9988-ABC'}&format=csv`, 'validations-csv')}
                              className="btn-secondary h-8 w-8 p-0 flex items-center justify-center shrink-0 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg shadow-sm"
                              title="Copy CSV Link"
                            >
                              {copiedField === 'validations-csv' ? <Check className="text-emerald-600" size={14} /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>

                        <div className="border-t border-slate-100 pt-2.5">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-wide">Option B: JSON Link</span>
                            <span className="text-[9px] text-slate-400 italic">Requires Power Query table conversion</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input 
                              readOnly 
                              value={`${window.location.origin}/api/powerbi/validations?token=${'VP-PBI-Sec-9988-ABC'}`}
                              className="flex-1 shrink text-[10px] bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 font-mono select-all truncate"
                            />
                            <button 
                              onClick={() => handleCopy(`${window.location.origin}/api/powerbi/validations?token=${'VP-PBI-Sec-9988-ABC'}`, 'validations-json')}
                              className="btn-secondary h-8 w-8 p-0 flex items-center justify-center shrink-0 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg shadow-sm"
                              title="Copy JSON Link"
                            >
                              {copiedField === 'validations-json' ? <Check className="text-emerald-600" size={14} /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Secure Access Token details */}
                <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <Key className="text-brand-primary" size={20} />
                    <h3 className="font-bold text-slate-800">2. Secure Connection Token</h3>
                  </div>
                  <p className="text-xs text-slate-500">
                    A secret security token acts as a password to protect your analytical feeds. Keep this private.
                  </p>

                  <div className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between shrink-0 gap-3 items-center">
                    <div className="w-full sm:w-auto">
                      <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Secret Token Value</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg font-mono text-xs text-slate-700 font-bold tracking-widest block min-w-[200px]">
                          {showToken ? 'VP-PBI-Sec-9988-ABC' : '•••••••••••••••••••••'}
                        </span>
                        <button 
                          onClick={() => setShowToken(!showToken)}
                          className="text-[11px] text-brand-primary font-bold hover:underline px-1"
                        >
                          {showToken ? 'Hide' : 'Reveal'}
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => handleCopy('VP-PBI-Sec-9988-ABC', 'raw-token')}
                      className="btn-secondary flex items-center gap-2 whitespace-nowrap text-xs py-1.5 px-3.5 bg-white border-slate-200 hover:bg-slate-50 w-full sm:w-auto justify-center rounded-lg shadow-sm"
                    >
                      {copiedField === 'raw-token' ? <Check className="text-emerald-600" size={12} /> : <Copy size={12} />}
                      Copy Raw Token
                    </button>
                  </div>

                  <div className="bg-slate-50 p-4 border border-slate-100 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-2 text-slate-700 font-bold text-xs">
                      <Info size={14} className="text-slate-400" />
                      <span>Advanced Configuration Tips:</span>
                    </div>
                    <p className="text-slate-500 text-[11px] leading-relaxed">
                      This token defaults to a fallback value. If you deployment demands custom token rotation, add the following setting inside your server environment variables panel (`.env` file) and restart your deployment:
                    </p>
                    <div className="font-mono text-[10px] bg-slate-900 text-emerald-400 p-2.5 rounded-lg flex justify-between items-center mt-1">
                      <span>POWERBI_TOKEN="YOUR_SUPER_SECRET_STRICT_TOKEN"</span>
                      <button 
                        onClick={() => handleCopy('POWERBI_TOKEN="YOUR_SUPER_SECRET_STRICT_TOKEN"', 'env-pbi')}
                        className="text-emerald-300 hover:text-white"
                        title="Copy ENV declaration"
                      >
                        {copiedField === 'env-pbi' ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Direct SQL Access details */}
                <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4">
                  <div className="flex items-center gap-2">
                    <Database className="text-brand-primary" size={20} />
                    <h3 className="font-bold text-slate-800">3. Direct PostgreSQL Database Connection</h3>
                  </div>
                  <p className="text-xs text-slate-500">
                    If your Power BI reports demand raw relational sql schema queries, you can bypass the server REST API entirely and link Power BI directly to your Supabase PostgreSQL.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <p className="text-[10px] uppercase font-black text-slate-400">Database Host (Server)</p>
                      <p className="text-xs font-mono font-semibold text-slate-700 truncate mt-1">db.validpro-integration.supabase.co</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <p className="text-[10px] uppercase font-black text-slate-400">Database Name</p>
                      <p className="text-xs font-mono font-semibold text-slate-700 mt-1">postgres</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <p className="text-[10px] uppercase font-black text-slate-400">Port (TCP)</p>
                      <p className="text-xs font-mono font-semibold text-slate-700 mt-1">5432</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <p className="text-[10px] uppercase font-black text-slate-400">Default Roles Master User</p>
                      <p className="text-xs font-mono font-semibold text-slate-700 mt-1">postgres</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4 flex gap-3">
                    <ShieldCheck className="text-amber-600 shrink-0 mt-0.5" size={16} />
                    <div className="text-[11px] text-amber-900 leading-relaxed space-y-1">
                      <p className="font-bold">Encryption Security Note:</p>
                      <p className="opacity-80">
                        Always toggle **Enable SSL** inside Power BI's PostgreSQL connection settings. If you do not remember your default core DB password, retrieve it via your cloud host dashboard settings.
                      </p>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Connection Guide & Steps (5 Columns) */}
              <div className="lg:col-span-5 space-y-6">
                
                {/* Visual Steps Card */}
                <div className="p-6 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-4 font-sans">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="text-brand-primary" size={20} />
                    <h3 className="font-bold text-slate-800">Connection Quick Guide</h3>
                  </div>
                  <p className="text-xs text-slate-500">
                    Follow these four direct guidelines to setup your dynamic Power BI reports in under a minute:
                  </p>

                  <div className="space-y-4 pt-1">
                    
                    {/* Step 1 */}
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-brand-light flex items-center justify-center shrink-0 border border-brand-primary/20 text-brand-primary font-black text-xs">
                        1
                      </div>
                      <div className="space-y-1 mt-0.5">
                        <p className="text-xs font-bold text-slate-700">Open Web Data Source</p>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          Inside Power BI Desktop, navigate to **Home** tab, click **Get Data** dropdown, and choose **Web** connector.
                        </p>
                      </div>
                    </div>

                    {/* Step 2 */}
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-brand-light flex items-center justify-center shrink-0 border border-brand-primary/20 text-brand-primary font-black text-xs">
                        2
                      </div>
                      <div className="space-y-1 mt-0.5">
                        <p className="text-xs font-bold text-slate-700">Provide Feed URL</p>
                        <p className="text-[11px] text-slate-500 leading-relaxed animate-pulse">
                          Select the **Basic** radio button. Copy the **Option A (CSV Link)** of your favorite feed above, paste it into the URL field, and click **OK**.
                        </p>
                      </div>
                    </div>

                    {/* Step 3 */}
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-brand-light flex items-center justify-center shrink-0 border border-brand-primary/20 text-brand-primary font-black text-xs">
                        3
                      </div>
                      <div className="space-y-1 mt-0.5">
                        <p className="text-xs font-bold text-slate-700">Choose Anonymous Access</p>
                        <p className="text-[11px] text-slate-500 leading-relaxed">
                          In the "Access Web Content" popup dialog, choose **Anonymous** access on the left sidebar. Since security token is query-provided, further credentials are NOT required. Click **Connect**.
                        </p>
                      </div>
                    </div>

                    {/* Step 4 */}
                    <div className="flex gap-3">
                      <div className="w-6 h-6 rounded-full bg-brand-light flex items-center justify-center shrink-0 border border-brand-primary/20 text-brand-primary font-black text-xs">
                        4
                      </div>
                      <div className="space-y-1 mt-0.5">
                        <p className="text-xs font-bold text-slate-700">Instant Columns & Table!</p>
                        <p className="text-[11px] text-slate-500 leading-relaxed text-slate-800">
                          Because you used **Option A (CSV Link)**, Power BI immediately builds a flat multi-column spreadsheet-like grid with all headers, and there is no need to manually convert JSON to list. You can start charting instantly!
                        </p>
                      </div>
                    </div>

                  </div>

                  {/* Desktop Preview */}
                  <div className="pt-2">
                    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Example Visual Chart Ideal Setup</p>
                      <p className="text-[11px] text-slate-500 italic">
                        "Create a doughnut chart modeling `validation_status` to visually isolate pending items, then add stacked bars charting audits grouped by center code."
                      </p>
                    </div>
                  </div>

                </div>

                {/* Helpful resources */}
                <div className="p-6 rounded-2xl border border-slate-200 bg-slate-50 shadow-inner flex flex-col justify-between">
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-800 text-xs">Looking for a ready-made template?</h4>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      You can import these feeds directly as JSON tables in your PowerBI desktop dashboard models. PowerBI Service automatically handles automated scheduled cloud data refreshes every day so you stay synced!
                    </p>
                  </div>
                  <div className="flex mt-4">
                    <a 
                      href="https://learn.microsoft.com/en-us/power-bi/connect-data/desktop-connect-to-web" 
                      target="_blank" 
                      rel="noreferrer" 
                      className="text-[11px] font-bold text-brand-primary flex items-center gap-1 hover:underline hover:text-brand-hover"
                    >
                      <span>Read official Power BI documentation</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>

              </div>

            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
