import React, { useEffect, useState } from 'react';
import { supabase, StudentValidation } from '../../supabase';
import { toast } from 'react-hot-toast';
import { 
  Download, 
  Table as TableIcon, 
  Search,
  RefreshCcw,
  Loader2,
  Eye,
  X,
  FileText
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { cn, formatDate } from '../utils';
import { motion, AnimatePresence } from 'motion/react';

interface BatchSummary {
  center_code: string;
  batch_code: string;
  total_students: number;
  validated: number;
  revalidated: number;
  pending: number;
  absent: number;
  rejected: number;
  latest_timestamp: string;
  assigned_ae: string;
  validated_by: string;
  batch_start_date: string;
  program_name: string;
}

const calculateDaysSince = (startDateStr: string) => {
  if (!startDateStr) return 'N/A';
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return 'N/A';
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  
  const diffTime = today.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  return diffDays.toString();
};

export function ReportPanel() {
  const [validations, setValidations] = useState<StudentValidation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [summaryData, setSummaryData] = useState<BatchSummary[]>([]);
  
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [selectedBatchesForExport, setSelectedBatchesForExport] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchData();
  }, []);

  const fetchAllTableData = async (tableName: string) => {
    let allData: any[] = [];
    let from = 0;
    let limit = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, from + limit - 1);
      
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vDataRes, bDataRes] = await Promise.all([
        fetch('/api/admin/all_validations'),
        fetch('/api/batch_data')
      ]);
      
      const vData = (vDataRes.ok && vDataRes.headers.get('content-type')?.includes('application/json')) 
        ? await vDataRes.json() 
        : await fetchAllTableData('student_validations');
        
      const bData = (bDataRes.ok && bDataRes.headers.get('content-type')?.includes('application/json')) 
        ? await bDataRes.json() 
        : await fetchAllTableData('batch_students');
      
      
      // 1. Deduplicate batch students from excel
      const uniqueStudentsMap = new Map<string, any>();
      bData.forEach((s: any) => {
        const key = `${s.center_code}_${s.batch_code}_${s.student_code}`;
        // Since we ordered desc by created_at, the first one encountered is the latest
        if (!uniqueStudentsMap.has(key)) {
          uniqueStudentsMap.set(key, s);
        }
      });
      
      const vDataMap = new Map<string, any>();
      vData.forEach((v: any) => {
        const key = `${v.batch_code}_${v.student_code}`;
        // Prioritize latest validation (already ordered desc in API)
        if (!vDataMap.has(key)) {
          vDataMap.set(key, v);
        }
      });

      // 2. Build full combined validation data for "View Details"
      const combinedValidations: any[] = [];
      
      // Calculate Summary
      const summaryMap = new Map<string, BatchSummary & { validatorSet: Set<string> }>();
      
      uniqueStudentsMap.forEach((student: any) => {
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
            latest_timestamp: student.created_at || '',
            assigned_ae: student.ae_name || '',
            validated_by: '',
            batch_start_date: student.batch_start_date || '',
            program_name: student.program_name || '',
            validatorSet: new Set()
          });
        }
        
        const summary = summaryMap.get(sumKey)!;
        summary.total_students += 1;
        
        const validationRow = vDataMap.get(`${student.batch_code}_${student.student_code}`);
        
        if (validationRow?.aligned_ae || validationRow?.ae_name) {
          summary.assigned_ae = validationRow.aligned_ae || validationRow.ae_name || summary.assigned_ae;
        }
        
        if (validationRow?.validated_by) {
          summary.validatorSet.add(validationRow.validated_by);
          summary.validated_by = Array.from(summary.validatorSet).join(', ');
        }
        
        const currentStatus = validationRow?.status || 'Pending';
        
        if (currentStatus === 'Validated' || currentStatus === 'Completed') summary.validated += 1;
        else if (currentStatus === 'ReValidated') summary.revalidated += 1;
        else if (currentStatus === 'Absent') summary.absent += 1;
        else if (currentStatus === 'Rejected') summary.rejected += 1;
        else summary.pending += 1; // Default to Pending
        
        if (validationRow?.created_at && new Date(validationRow.created_at) > new Date(summary.latest_timestamp)) {
            summary.latest_timestamp = validationRow.created_at;
        }

        combinedValidations.push({
            id: validationRow?.id || `pending-${student.student_code}`,
            student_code: validationRow?.student_code || student.student_code,
            student_name: validationRow?.student_name || student.student_name,
            center_code: validationRow?.center_code || student.center_code,
            batch_code: validationRow?.batch_code || student.batch_code,
            batch_start_date: student.batch_start_date || '',
            program_name: student.program_name || '',
            education_qualification: student.education_qualification || '',
            ae_name: validationRow?.aligned_ae || validationRow?.ae_name || student.aligned_ae || student.ae_name || '',
            validated_by: validationRow?.validated_by || 'N/A',
            status: currentStatus,
            remarks: validationRow?.remarks || '',
            mic_on: validationRow?.mic_on || false,
            video_on: validationRow?.video_on || false,
            created_at: validationRow?.created_at || null
        });
      });
      
      setValidations(combinedValidations);
      setSummaryData(Array.from(summaryMap.values()).sort((a, b) => new Date(b.latest_timestamp || 0).getTime() - new Date(a.latest_timestamp || 0).getTime()));

    } catch (error: any) {
      toast.error('Error fetching data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const getFormattedData = (data: any[]) => {
    return data.map(v => ({
      'Student Code': v.student_code,
      'Student Name': v.student_name,
      'Batch Code': v.batch_code,
      'Center Code': v.center_code,
      'Program Name': v.program_name || 'N/A',
      'Education Qualification': v.education_qualification || 'N/A',
      'Batch Start Date': v.batch_start_date || 'N/A',
      'Days Since Batch Start': calculateDaysSince(v.batch_start_date),
      'Mic': v.mic_on ? 'Turned On' : 'Not Turn On',
      'Camera': v.video_on ? 'Turned On' : 'Not Turn On',
      'Validation Status': v.status,
      'Remarks': v.remarks || 'N/A',
      'Aligned AE': v.ae_name || 'N/A',
      'Validated By': v.validated_by || 'N/A',
      'Latest Timestamp': v.created_at ? formatDate(v.created_at) : 'N/A'
    }));
  };

  const handleExportExcel = (dataToExport: any[], fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(getFormattedData(dataToExport));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportCSV = (dataToExport: any[], fileName: string) => {
    const ws = XLSX.utils.json_to_sheet(getFormattedData(dataToExport));
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPDF = (dataToExport: any[], fileName: string) => {
    const doc = new jsPDF('l', 'pt');
    const tableData = dataToExport.map(v => [
      v.student_code, v.student_name, v.batch_code, v.center_code, v.program_name || 'N/A', v.education_qualification || 'N/A', v.batch_start_date || 'N/A', calculateDaysSince(v.batch_start_date), v.mic_on ? 'Turned On' : 'Not Turn On', v.video_on ? 'Turned On' : 'Not Turn On', v.status, v.remarks || 'N/A', v.ae_name || 'N/A', v.validated_by || 'N/A', v.created_at ? formatDate(v.created_at) : 'N/A'
    ]);
    
    (doc as any).autoTable({
      head: [['Student Code', 'Student Name', 'Batch Code', 'Center Code', 'Program Name', 'Education Qual.', 'Batch Start Date', 'Days Since Start', 'Mic', 'Camera', 'Validation Status', 'Remarks', 'Aligned AE', 'Validated By', 'Latest Timestamp']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: '#0d9488' }
    });
    
    doc.save(`${fileName}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const filteredSummary = summaryData.filter(s => {
    const matchesSearch = s.center_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.batch_code.toLowerCase().includes(searchTerm.toLowerCase());
                          
    if (!matchesSearch) return false;
    
    if (statusFilter === 'All') return true;
    if (statusFilter === 'Validated') return s.validated > 0;
    if (statusFilter === 'ReValidated') return s.revalidated > 0;
    if (statusFilter === 'Pending') return s.pending > 0;
    if (statusFilter === 'Absent') return s.absent > 0;
    if (statusFilter === 'Rejected') return s.rejected > 0;
    
    return true;
  });

  const selectedBatchData = selectedBatch 
    ? validations.filter(v => v.batch_code === selectedBatch)
    : [];

  const handleExportSummaryExcel = () => {
    if (selectedBatchesForExport.size === 0) {
      toast.error('Please select at least one batch to export');
      return;
    }
    const dataToExport = summaryData
      .filter(s => selectedBatchesForExport.has(s.batch_code))
      .map(s => ({
        'Center Code': s.center_code,
        'Batch Code': s.batch_code,
        'Program Name': s.program_name || 'N/A',
        'Batch Start Date': s.batch_start_date || 'N/A',
        'Days Since Batch Start': calculateDaysSince(s.batch_start_date),
        'Total Students': s.total_students,
        'Validated': s.validated,
        'Revalidated': s.revalidated,
        'Pending': s.pending,
        'Absent': s.absent,
        'Rejected': s.rejected,
        'Aligned AE': s.assigned_ae,
        'Validated By': s.validated_by,
        'Latest Timestamp': s.latest_timestamp ? formatDate(s.latest_timestamp) : 'N/A'
      }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "BatchSummary");
    XLSX.writeFile(wb, `Batch_Summary_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleExportSummaryCSV = () => {
    if (selectedBatchesForExport.size === 0) {
      toast.error('Please select at least one batch to export');
      return;
    }
    const dataToExport = summaryData
      .filter(s => selectedBatchesForExport.has(s.batch_code))
      .map(s => ({
        'Center Code': s.center_code,
        'Batch Code': s.batch_code,
        'Program Name': s.program_name || 'N/A',
        'Batch Start Date': s.batch_start_date || 'N/A',
        'Days Since Batch Start': calculateDaysSince(s.batch_start_date),
        'Total Students': s.total_students,
        'Validated': s.validated,
        'Revalidated': s.revalidated,
        'Pending': s.pending,
        'Absent': s.absent,
        'Rejected': s.rejected,
        'Aligned AE': s.assigned_ae,
        'Validated By': s.validated_by,
        'Latest Timestamp': s.latest_timestamp ? formatDate(s.latest_timestamp) : 'N/A'
      }));
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const csv = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Batch_Summary_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportSummaryPDF = () => {
    if (selectedBatchesForExport.size === 0) {
      toast.error('Please select at least one batch to export');
      return;
    }
    const dataToExport = summaryData.filter(s => selectedBatchesForExport.has(s.batch_code));
    const doc = new jsPDF('l', 'pt');
    const tableData = dataToExport.map(s => [
      s.center_code, s.batch_code, s.program_name || 'N/A', s.batch_start_date || 'N/A', calculateDaysSince(s.batch_start_date), s.total_students.toString(), s.validated.toString(), s.revalidated.toString(), s.pending.toString(), s.absent.toString(), s.rejected.toString(), s.assigned_ae, s.validated_by, formatDate(s.latest_timestamp)
    ]);
    
    (doc as any).autoTable({
      head: [['Center Code', 'Batch Code', 'Program Name', 'Batch Start Date', 'Days Since Start', 'Total Students', 'Validated', 'Revalidated', 'Pending', 'Absent', 'Rejected', 'Aligned AE', 'Validated By', 'Latest Timestamp']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: '#0d9488' }
    });
    
    doc.save(`Batch_Summary_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const toggleSelectAll = () => {
    if (selectedBatchesForExport.size === filteredSummary.length) {
      setSelectedBatchesForExport(new Set());
    } else {
      setSelectedBatchesForExport(new Set(filteredSummary.map(s => s.batch_code)));
    }
  };

  const toggleSelectBatch = (batchCode: string) => {
    const newSelected = new Set(selectedBatchesForExport);
    if (newSelected.has(batchCode)) {
      newSelected.delete(batchCode);
    } else {
      newSelected.add(batchCode);
    }
    setSelectedBatchesForExport(newSelected);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      <div className="glass-card p-8 rounded-2xl shadow-sm border border-brand-border backdrop-blur-md">
        <h1 className="text-3xl font-black text-brand-text tracking-tight uppercase italic flex items-center gap-3">
          <FileText className="text-brand-primary" size={28} />
          Batch Reports
        </h1>
        <p className="text-slate-500 text-sm mt-1 font-medium italic opacity-70">
          Aggregated batch summaries and detailed exportable reports.
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full flex items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search by Center or Batch Code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-brand-border rounded-2xl py-4 pl-12 pr-4 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-muted/50 shadow-sm transition-all"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white border border-brand-border rounded-2xl py-4 px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-brand-muted/50 shadow-sm transition-all w-48"
            >
              <option value="All">All Statuses</option>
              <option value="Validated">Validated</option>
              <option value="ReValidated">ReValidated</option>
              <option value="Pending">Pending</option>
              <option value="Absent">Absent</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>
          <div className="flex gap-2 w-full md:w-auto items-center">
            {selectedBatchesForExport.size > 0 && (
              <>
                <span className="text-sm font-bold text-slate-500 mr-2 border-r border-slate-300 pr-4">
                  {selectedBatchesForExport.size} Selected
                </span>
                <button onClick={handleExportSummaryCSV} className="btn-secondary py-2 px-3 text-xs flex items-center gap-1 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100">
                  <TableIcon size={14} /> CSV
                </button>
                <button onClick={handleExportSummaryExcel} className="btn-secondary py-2 px-3 text-xs flex items-center gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                  <TableIcon size={14} /> Excel
                </button>
                <button onClick={handleExportSummaryPDF} className="btn-secondary py-2 px-3 text-xs flex items-center gap-1 bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100">
                  <Download size={14} /> PDF
                </button>
              </>
            )}
            <button onClick={fetchData} className="p-3 bg-white text-brand-hover rounded-2xl border border-brand-border hover:bg-brand-muted transition-colors shadow-sm ml-2">
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
                      className="accent-brand-primary w-4 h-4 cursor-pointer rounded"
                      checked={filteredSummary.length > 0 && selectedBatchesForExport.size === filteredSummary.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-6 py-5">Center Code</th>
                  <th className="px-6 py-5">Batch Code</th>
                  <th className="px-6 py-5">Program Name</th>
                  <th className="px-6 py-5">Batch Start Date</th>
                  <th className="px-6 py-5">Days Since Start</th>
                  <th className="px-6 py-5">Total Students</th>
                  <th className="px-6 py-5">Validation</th>
                  <th className="px-6 py-5">Revalidation</th>
                  <th className="px-6 py-5">Pending</th>
                  <th className="px-6 py-5">Absent</th>
                  <th className="px-6 py-5">Rejected</th>
                  <th className="px-6 py-5">Aligned AE</th>
                  <th className="px-6 py-5">Validated By</th>
                  <th className="px-6 py-5">Latest Timestamp</th>
                  <th className="px-6 py-5 sticky right-0 bg-white/90 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] backdrop-blur-sm z-10">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-divide">
                {filteredSummary.length > 0 ? (
                  filteredSummary.map((s, idx) => (
                    <tr key={`${s.center_code}_${s.batch_code}`} className={cn(idx % 2 === 0 ? "bg-white/20" : "bg-white/10", "hover:bg-brand-light transition-colors group backdrop-blur-sm")}>
                      <td className="px-6 py-4 text-center">
                        <input 
                          type="checkbox" 
                          className="accent-brand-primary w-4 h-4 cursor-pointer rounded"
                          checked={selectedBatchesForExport.has(s.batch_code)}
                          onChange={() => toggleSelectBatch(s.batch_code)}
                        />
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-sm text-brand-text mb-0.5">{s.center_code}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-600 text-sm mb-0.5">{s.batch_code}</span>
                      </td>
                      <td className="px-6 py-4 max-w-[150px] truncate" title={s.program_name || 'N/A'}>
                        <span className="font-bold text-slate-600 text-xs mb-0.5">{s.program_name || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-600 text-sm mb-0.5">{s.batch_start_date || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-brand-primary text-sm mb-0.5">{calculateDaysSince(s.batch_start_date)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-black text-brand-text">{s.total_students}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-black text-emerald-600">{s.validated}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-black text-blue-600">{s.revalidated}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-black text-amber-600">{s.pending}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-black text-slate-600">{s.absent}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-black text-rose-600">{s.rejected}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                         <p className="text-[11px] font-bold text-slate-700">{s.assigned_ae}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                         <p className="text-[11px] font-bold text-slate-700">{s.validated_by || 'N/A'}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                         <p className="text-[11px] text-slate-500 font-mono font-bold">{formatDate(s.latest_timestamp)}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap sticky right-0 bg-white shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-10">
                         <button 
                           onClick={() => setSelectedBatch(s.batch_code)}
                           className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1"
                         >
                           <Eye size={14} /> View Details
                         </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={13} className="px-8 py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Search size={48} className="text-slate-200" />
                        <p className="text-slate-400 font-bold">No reports matched your criteria.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {selectedBatch && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-brand-bg w-full max-w-6xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-white/50"
            >
              <div className="p-6 border-b border-brand-border bg-white flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-brand-text">Detailed Report: {selectedBatch}</h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">Found {selectedBatchData.length} records</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => handleExportCSV(selectedBatchData, `Batch_${selectedBatch}`)} className="btn-secondary py-2 px-3 text-xs flex items-center gap-1 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100">
                    <TableIcon size={14} /> CSV
                  </button>
                  <button onClick={() => handleExportExcel(selectedBatchData, `Batch_${selectedBatch}`)} className="btn-secondary py-2 px-3 text-xs flex items-center gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100">
                    <TableIcon size={14} /> Excel
                  </button>
                  <button onClick={() => handleExportPDF(selectedBatchData, `Batch_${selectedBatch}`)} className="btn-secondary py-2 px-3 text-xs flex items-center gap-1 bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100">
                    <Download size={14} /> PDF
                  </button>
                  <div className="w-px h-6 bg-slate-200 mx-1"></div>
                  <button 
                    onClick={() => setSelectedBatch(null)}
                    className="p-2 bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600 rounded-xl transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-6 bg-brand-bg/50">
                <div className="glass-card rounded-2xl shadow-lg border border-brand-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left relative min-w-max">
                      <thead className="bg-white/90 border-b border-brand-border backdrop-blur-sm sticky top-0 z-10">
                        <tr className="text-brand-text/70 text-[10px] font-black uppercase tracking-widest">
                          <th className="px-6 py-4">Student Code</th>
                          <th className="px-6 py-4">Student Name</th>
                          <th className="px-6 py-4">Batch Code</th>
                          <th className="px-6 py-4">Center Code</th>
                          <th className="px-6 py-4">Program Name</th>
                          <th className="px-6 py-4">Education Qual.</th>
                          <th className="px-6 py-4">Batch Start Date</th>
                          <th className="px-6 py-4">Days Since Start</th>
                          <th className="px-6 py-4">Mic</th>
                          <th className="px-6 py-4">Camera</th>
                          <th className="px-6 py-4">Validation Status</th>
                          <th className="px-6 py-4">Remarks</th>
                          <th className="px-6 py-4">Aligned AE</th>
                          <th className="px-6 py-4">Validated By</th>
                          <th className="px-6 py-4">Latest Timestamp</th>
                        </tr>
                      </thead>
                    <tbody className="divide-y divide-brand-divide">
                      {selectedBatchData.map((v, idx) => (
                        <tr key={v.id} className={cn(idx % 2 === 0 ? "bg-white/60" : "bg-white/40", "hover:bg-brand-light transition-colors backdrop-blur-sm")}>
                          <td className="px-6 py-3 whitespace-nowrap">
                            <span className="text-xs bg-slate-100 text-slate-800 px-2 py-1 rounded font-mono font-bold border border-slate-200">{v.student_code}</span>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap">
                            <p className="font-bold text-sm text-brand-text mb-0.5">{v.student_name}</p>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap">
                            <span className="font-bold text-slate-600 text-xs block">{v.batch_code}</span>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap">
                            <span className="font-bold text-[10px] uppercase tracking-widest text-brand-primary">{v.center_code}</span>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap max-w-[150px] truncate" title={v.program_name || 'N/A'}>
                            <span className="font-bold text-slate-600 text-[10px] block">{v.program_name || 'N/A'}</span>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap max-w-[150px] truncate" title={v.education_qualification || 'N/A'}>
                            <span className="font-bold text-slate-600 text-[10px] block">{v.education_qualification || 'N/A'}</span>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap">
                            <span className="font-bold text-slate-600 text-[10px] block">{v.batch_start_date || 'N/A'}</span>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap">
                            <span className="font-bold text-brand-primary text-[10px] block">{calculateDaysSince(v.batch_start_date)}</span>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm",
                              v.mic_on ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                            )}>
                              {v.mic_on ? 'Turned On' : 'Not Turn On'}
                            </span>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm",
                              v.video_on ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-rose-50 text-rose-700 border-rose-200"
                            )}>
                              {v.video_on ? 'Turned On' : 'Not Turn On'}
                            </span>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border shadow-sm",
                              v.status === 'Validated' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                              v.status === 'ReValidated' ? "bg-blue-50 text-blue-700 border-blue-200" :
                              v.status === 'Absent' ? "bg-slate-50 text-slate-700 border-slate-300" :
                              v.status === 'Rejected' ? "bg-rose-50 text-rose-700 border-rose-200" :
                              "bg-amber-50 text-amber-700 border-amber-200" // Pending
                            )}>
                              {v.status || 'Pending'}
                            </span>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap">
                             <p className="text-[11px] font-bold text-slate-700">{v.remarks || 'N/A'}</p>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap">
                             <p className="text-[11px] font-bold text-slate-700">{v.ae_name || 'N/A'}</p>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap">
                             <p className="text-[11px] font-bold text-slate-700">{v.validated_by || 'N/A'}</p>
                          </td>
                          <td className="px-6 py-3 whitespace-nowrap">
                            <p className="text-[11px] text-slate-500 font-mono font-bold">{v.created_at ? formatDate(v.created_at) : 'N/A'}</p>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
