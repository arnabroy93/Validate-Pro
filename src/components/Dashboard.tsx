import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { useAuth } from '../hooks/useAuth';
import { supabase, StudentValidation, BatchStudent } from '../../supabase';
import { toast } from 'react-hot-toast';
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Filter, 
  ChevronRight,
  Database,
  User,
  Loader2,
  Mic,
  Video
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils';

export function Dashboard() {
  const { user, profile } = useAuth();
  const [data, setData] = useState<BatchStudent[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);

  // Filters state
  const [alignedAe, setAlignedAe] = useState('');
  const [batchRecordingLink, setBatchRecordingLink] = useState('');
  const [selectedCenter, setSelectedCenter] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [studentSearch, setStudentSearch] = useState('');

  const validatedBy = profile?.username || '';

  // Local validation state
  // Key: student_code, Value: validation details
  const [validations, setValidations] = useState<Record<string, Partial<StudentValidation>>>({});

  useEffect(() => {
    fetchBatchStudents();
  }, [user]);

  useEffect(() => {
    const fetchExistingValidations = async () => {
      if (!selectedBatch || !selectedCenter) {
        setValidations({});
        setBatchRecordingLink('');
        return;
      }
      
      const studentsInBatch = data.filter(row => 
        String(row.batch_code) === String(selectedBatch) && 
        String(row.center_code) === String(selectedCenter) && 
        String(row.batch_status).toLowerCase() === 'running'
      );
      
      if (studentsInBatch.length === 0) {
        setValidations({});
        setBatchRecordingLink('');
        return;
      }

      const studentCodes = studentsInBatch.map(s => s.student_code);

      const res = await fetch('/api/validations/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          studentCodes, 
          batchCode: selectedBatch, 
          centerCode: selectedCenter 
        })
      });

      if (res.ok) {
        const existingRecords = await res.json();
        const loadedValidations: Record<string, Partial<StudentValidation>> = {};
        let existingLink = '';
        existingRecords.forEach((record: any) => {
          if (!existingLink && record.recording_link && record.recording_link !== 'N.A.') {
            existingLink = record.recording_link;
          }
          loadedValidations[record.student_code] = {
            id: record.id,
            status: record.status as any,
            remarks: record.remarks,
            // Only strictly populate the existing state so we don't accidentally lose it if it was entered
            recording_link: record.recording_link || 'N.A.',
            mic_on: record.mic_on,
            video_on: record.video_on
          };
        });
        setValidations(loadedValidations);
        if (existingLink) {
          setBatchRecordingLink(existingLink);
        } else {
          setBatchRecordingLink('');
        }
      }
    };
    
    fetchExistingValidations();
  }, [selectedBatch, selectedCenter, data]);

  const fetchBatchStudents = async () => {
    if (!user) return;
    setFetchingData(true);
    try {
      const res = await fetch('/api/batch_data');
      if (!res.ok) {
        let errorMsg = 'Failed to fetch batch data from API';
        try {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await res.json();
            errorMsg = errorData.error || errorMsg;
          } else {
            const textData = await res.text();
            errorMsg = `API returned HTTP ${res.status}: ${textData.substring(0, 50)}...`;
          }
        } catch (e) {
          errorMsg = `API returned HTTP ${res.status}`;
        }
        throw new Error(errorMsg);
      }
      const allData = await res.json();
      setData(allData as BatchStudent[]);
    } catch (error: any) {
      console.error('Error fetching batch data:', error.message);
      toast.error('Failed to load batch data');
    } finally {
      setFetchingData(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setFileName(file.name);
    const reader = new FileReader();

    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const jsonData = XLSX.utils.sheet_to_json<any>(ws, { raw: false, defval: '' });
        
        // Normalize headers and values - remove spaces/special chars and lowercase
        const normalizedData: BatchStudent[] = jsonData.map(row => {
          const normalized: any = {};
          Object.keys(row).forEach(key => {
            const cleanKey = key.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            let value = row[key];
            if (typeof value === 'string') {
              value = value.trim();
            }
            normalized[cleanKey] = value;
          });
          
          return {
            ae_name: normalized['aename'] || normalized['alignedaename'] || normalized['alignedae'] || '',
            center_code: normalized['centercode'] || normalized['center'] || '',
            batch_code: normalized['batchcode'] || normalized['batch'] || '',
            student_code: normalized['studentcode'] || normalized['code'] || '',
            student_name: normalized['studentname'] || normalized['name'] || '',
            mobile_no: normalized['mobileno'] || normalized['mobile'] || normalized['phoneno'] || normalized['phone'] || '',
            dob: (normalized['dob'] || normalized['dateofbirth']) ? String(normalized['dob'] || normalized['dateofbirth']) : '',
            father_name: normalized['fathername'] || normalized['fathersname'] || '',
            address: normalized['address'] || '',
            batch_status: normalized['batchstatus'] || normalized['status'] || '',
            batch_start_date: (normalized['batchstartdate'] || normalized['startdate']) ? String(normalized['batchstartdate'] || normalized['startdate']) : '',
            program_name: normalized['programname'] || normalized['program'] || '',
            education_qualification: normalized['educationqualification'] || normalized['qualification'] || normalized['highestqualification'] || '',
            uploaded_by: user?.id
          };
        });
        
        if (normalizedData.length > 0) {
          toast.success(`Parsed ${normalizedData.length} records. Deduping...`);
          
          // Get existing records for only the batches we are importing to prevent duplicate issues
          const importedBatchCodes = Array.from(new Set(normalizedData.map(r => r.batch_code).filter(Boolean)));
          
          let existingData: any[] = [];
          
          // Process in smaller chunks to avoid URL too long issues if there are many batches
          const chunkSize = 50;
          for (let i = 0; i < importedBatchCodes.length; i += chunkSize) {
            const batchChunk = importedBatchCodes.slice(i, i + chunkSize);
            const { data: bData, error: fetchErr } = await supabase
              .from('batch_students')
              .select('id, student_code, batch_code, center_code, batch_start_date, program_name, education_qualification, student_name, mobile_no, dob, father_name, address, batch_status, ae_name')
              .in('batch_code', batchChunk);
              
            if (fetchErr) throw new Error(fetchErr.message);
            if (bData) {
               existingData = [...existingData, ...bData];
            }
          }

          const existingMap = new Map();
          (existingData || []).forEach(r => {
            const key = String(`${r.center_code}_${r.batch_code}_${r.student_code}`).toLowerCase().trim();
            existingMap.set(key, r);
          });
          const existingSet = new Set(existingMap.keys());

          const uniqueNewRecordsSet = new Set();
          const newRecordsToInsert = normalizedData.filter(newRow => {
            const key = String(`${newRow.center_code}_${newRow.batch_code}_${newRow.student_code}`).toLowerCase().trim();
            if (existingSet.has(key) || uniqueNewRecordsSet.has(key)) {
              return false;
            }
            uniqueNewRecordsSet.add(key);
            return true;
          });
          
          const recordsToUpdate = normalizedData.filter(newRow => {
             const key = String(`${newRow.center_code}_${newRow.batch_code}_${newRow.student_code}`).toLowerCase().trim();
             if (existingSet.has(key)) {
                 const existingRecord = existingMap.get(key);
                 if (newRow.batch_start_date && existingRecord.batch_start_date !== newRow.batch_start_date) return true;
                 if (newRow.program_name && existingRecord.program_name !== newRow.program_name) return true;
                 if (newRow.education_qualification && existingRecord.education_qualification !== newRow.education_qualification) return true;
                 if (newRow.student_name && existingRecord.student_name !== newRow.student_name) return true;
                 if (newRow.mobile_no && existingRecord.mobile_no !== newRow.mobile_no) return true;
                 if (newRow.dob && existingRecord.dob !== newRow.dob) return true;
                 if (newRow.father_name && existingRecord.father_name !== newRow.father_name) return true;
                 if (newRow.address && existingRecord.address !== newRow.address) return true;
                 if (newRow.batch_status && existingRecord.batch_status !== newRow.batch_status) return true;
                 if (newRow.ae_name && existingRecord.ae_name !== newRow.ae_name) return true;
             }
             return false;
          }).map(newRow => {
             const key = String(`${newRow.center_code}_${newRow.batch_code}_${newRow.student_code}`).toLowerCase().trim();
             const existingRecord = existingMap.get(key);
             return {
                 id: existingRecord.id,
                 batch_start_date: newRow.batch_start_date || existingRecord.batch_start_date,
                 program_name: newRow.program_name || existingRecord.program_name,
                 education_qualification: newRow.education_qualification || existingRecord.education_qualification,
                 student_name: newRow.student_name || existingRecord.student_name,
                 mobile_no: newRow.mobile_no || existingRecord.mobile_no,
                 dob: newRow.dob || existingRecord.dob,
                 father_name: newRow.father_name || existingRecord.father_name,
                 address: newRow.address || existingRecord.address,
                 batch_status: newRow.batch_status || existingRecord.batch_status,
                 ae_name: newRow.ae_name || existingRecord.ae_name
             };
          });

          let insertCount = 0;
          let updateCount = 0;

          if (newRecordsToInsert.length > 0) {
             const { error } = await supabase.from('batch_students').insert(newRecordsToInsert);
             if (error) {
               console.error('Supabase error inserting batch data:', error);
               throw new Error(error.message);
             }
             insertCount = newRecordsToInsert.length;
          }
          
          if (recordsToUpdate.length > 0) {
             const { error } = await supabase.from('batch_students').upsert(recordsToUpdate, { onConflict: 'id' });
             if (error) {
               console.error('Supabase error updating batch data:', error);
               throw new Error(error.message);
             }
             updateCount = recordsToUpdate.length;
          }

          if (insertCount === 0 && updateCount === 0) {
             toast.success('No new records to insert and no dates to update. Data already up to date.');
          } else {
             toast.success(`Successfully added ${insertCount} records and updated dates for ${updateCount} records!`);
             fetchBatchStudents(); // Refresh data
          }
        } else {
          toast.error("No valid records found in Excel");
        }
      } catch (error: any) {
        toast.error(error.message || 'Error processing Excel file');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const VALIDATED_BY_OPTIONS = [
    "Arnab Roy",
    "Biswajit Chakraborty",
    "Bramha Das",
    "Karishma Tiwari",
    "Madhu Soni",
    "Milan Biswas",
    "Navamita Talukdar",
    "Rashmi Mukherjee",
    "Sirivennela Gaddam",
    "Susmita Chakraborty",
    "Susmita Ghosh Dastidar",
    "Tanmoy Bose",
    "Ulfath Naaz"
  ];

  const centerCodes = useMemo(() => {
    return Array.from(new Set(
      data
        .map(row => row.center_code)
        .filter(Boolean)
    )).sort((a, b) => String(a).localeCompare(String(b)));
  }, [data]);

  const batchCodes = useMemo(() => {
    if (!selectedCenter) return [];
    return Array.from(new Set(
      data
        .filter(row => 
          String(row.center_code).trim() === String(selectedCenter).trim() && 
          String(row.batch_status).trim().toLowerCase() === 'running'
        )
        .map(row => row.batch_code)
        .filter(Boolean)
    )).sort((a, b) => String(a).localeCompare(String(b)));
  }, [data, selectedCenter]);

  const filteredStudents = useMemo(() => {
    if (!selectedBatch || !selectedCenter) return [];
    
    // Deduplicate students by student code (keeping the latest based on order encountered, which is latest created if sorted properly)
    const studentsMap = new Map();
    
    data.filter(row => 
      String(row.batch_code).trim() === String(selectedBatch).trim() && 
      String(row.center_code).trim() === String(selectedCenter).trim() && 
      String(row.batch_status).trim().toLowerCase() === 'running'
    ).forEach(student => {
      // If we haven't seen this student yet, or we want the first one encountered (which is the latest created due to backend sort)
      if (!studentsMap.has(student.student_code)) {
        studentsMap.set(student.student_code, student);
      }
    });

    return Array.from(studentsMap.values());
  }, [data, selectedBatch, selectedCenter]);

  const searchedStudents = useMemo(() => {
    if (!studentSearch) return filteredStudents;
    const lowerSearch = studentSearch.toLowerCase();
    return filteredStudents.filter(s => 
      s.student_name.toLowerCase().includes(lowerSearch) || 
      s.student_code.toLowerCase().includes(lowerSearch)
    );
  }, [filteredStudents, studentSearch]);

  const handleValidationChange = (studentCode: string, field: keyof StudentValidation, value: any) => {
    setValidations(prev => ({
      ...prev,
      [studentCode]: {
        ...prev[studentCode],
        [field]: value
      }
    }));
  };

  const autosaveValidation = async (studentCode: string, optimisticUpdate: Partial<StudentValidation> = {}) => {
    if (!validatedBy || !user) return;
    
    // 2. Prepare autosave
    const student = filteredStudents.find(s => s.student_code === studentCode);
    if (!student) return;

    // Get current state with the optimistic update
    const v = { ...(validations[studentCode] || {}), ...optimisticUpdate };

    const record: any = {
      student_code: student.student_code,
      student_name: student.student_name,
      ae_name: student.ae_name,
      center_code: student.center_code,
      batch_code: student.batch_code,
      dob: student.dob ? String(student.dob) : '',
      father_name: student.father_name,
      address: student.address,
      validated_by: validatedBy,
      aligned_ae: alignedAe || '',
      status: v.status || 'Pending',
      remarks: v.remarks || '',
      recording_link: batchRecordingLink || 'N.A.',
      mic_on: v.mic_on || false,
      video_on: v.video_on || false,
      user_id: user.id
    };
    
    if (v.id) {
      record.id = v.id;
    }

    try {
      const res = await fetch('/api/validations/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record })
      });

      if (res.ok) {
        const savedData = await res.json();
        // If it was newly inserted, update State with specific ID so future updates hit the same row
        if (v.id !== savedData.id) {
          setValidations(prev => ({
            ...prev,
            [studentCode]: {
              ...prev[studentCode],
              id: savedData.id
            }
          }));
        }
      } else {
        const err = await res.json();
        console.error('Autosave error:', err);
      }
    } catch (e) {
      console.error('Autosave failed:', e);
    }
  };

  const handleCheckboxChange = async (studentCode: string, field: 'status' | 'mic_on' | 'video_on', value: any) => {
    if (!validatedBy) {
      toast.error('User profile not fully loaded. Please reload.');
      return;
    }

    if (!alignedAe) {
      toast.error('Aligned AE is mandatory. Please select it from the dropdown first.');
      return;
    }

    if (field === 'status' && value === 'Rejected') {
      const v = validations[studentCode] || {};
      const remarks = (v.remarks || '').trim();
      if (!remarks) {
        toast.error(`Remarks are mandatory when status is Rejected. Please add a comment first.`);
        return;
      }
    }

    // 1. Optimistic update
    setValidations(prev => ({
      ...prev,
      [studentCode]: {
        ...prev[studentCode],
        [field]: value
      }
    }));

    autosaveValidation(studentCode, { [field]: value });
  };

  const handleRemarksBlur = (studentCode: string) => {
    autosaveValidation(studentCode);
  };

  const handleSubmit = async () => {
    if (!selectedBatch) return;
    if (!validatedBy) {
      toast.error('User profile not fully loaded. Please reload.');
      return;
    }
    
    setLoading(true);
    if (!user) {
      toast.error('You must be logged in to submit validations');
      setLoading(false);
      return;
    }

    if (!alignedAe) {
      toast.error('Aligned AE is mandatory. Please select it first.');
      setLoading(false);
      return;
    }

    const recordsToInsert: any[] = [];
    const recordsToUpdate: any[] = [];
    
    // Validate remarks
    for (const student of filteredStudents) {
      const v = validations[student.student_code] || {};
      const status = v.status || 'Pending';
      const remarks = (v.remarks || '').trim();
      const recordingLink = (batchRecordingLink || '').trim();
      
      if (status !== 'Pending') {
        if (!recordingLink) {
          toast.error(`Recording link (G-Drive) is mandatory`);
          setLoading(false);
          return;
        }
        if (!recordingLink.includes('drive.google.com')) {
          toast.error(`Recording link must be a valid Google Drive link (${student.student_code})`);
          setLoading(false);
          return;
        }
      }

      if (status === 'Rejected' && !remarks) {
        toast.error(`Remarks are mandatory when status is Rejected`);
        setLoading(false);
        return;
      }
    }

    filteredStudents.forEach(student => {
      const v = validations[student.student_code] || {};
      const record: any = {
        student_code: student.student_code,
        student_name: student.student_name,
        ae_name: student.ae_name,
        center_code: student.center_code,
        batch_code: student.batch_code,
        dob: student.dob ? String(student.dob) : '',
        father_name: student.father_name,
        address: student.address,
        validated_by: validatedBy,
        aligned_ae: alignedAe || '',
        status: v.status || 'Pending',
        remarks: v.remarks || '',
        recording_link: batchRecordingLink || 'N.A.',
        mic_on: v.mic_on || false,
        video_on: v.video_on || false,
        user_id: user.id
      };
      
      if (v.id) {
        record.id = v.id;
        recordsToUpdate.push(record);
      } else {
        recordsToInsert.push(record);
      }
    });

    try {
      const res = await fetch('/api/validations/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordsToInsert, recordsToUpdate })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to submit validations');
      }
      toast.success('Batch validations submitted successfully!');
    } catch (error: any) {
      let errMsg = error.message || 'Error submitting data';
      if (errMsg.includes('aligned_ae') || errMsg.includes('schema cache')) {
        errMsg = 'Database Error: Please go to Supabase SQL editor and run: ALTER TABLE public.student_validations ADD COLUMN IF NOT EXISTS aligned_ae TEXT; NOTIFY pgrst, \'reload schema\';';
      }
      toast.error(errMsg, { duration: 10000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-transparent">
      <header className="h-16 glass-panel border-x-0 border-t-0 flex items-center justify-between px-8 z-10 sticky top-0">
        <h2 className="text-lg font-semibold text-brand-text">Batch Validation Dashboard</h2>
        <div className="flex items-center gap-4">
          {profile?.role === 'admin' && (
            <label className="flex items-center gap-2 btn-secondary cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>{fileName || 'Upload Excel'}</span>
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
            </label>
          )}
          <button
            disabled={loading || !selectedBatch}
            onClick={handleSubmit}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
            Save Changes
          </button>
        </div>
      </header>

      <div className="p-8 space-y-6 overflow-y-auto">
        <AnimatePresence>
          {data.length > 0 && (
            <motion.div 
              key="filters-config"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 glass-card p-6"
            >
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Validated By</label>
                <input 
                  type="text"
                  value={validatedBy}
                  disabled
                  readOnly
                  className="input-field disabled:opacity-70 bg-slate-50/50 cursor-not-allowed font-semibold text-slate-700 select-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Aligned AE</label>
                <select 
                  value={alignedAe}
                  onChange={(e) => setAlignedAe(e.target.value)}
                  className="input-field"
                >
                  <option value="">Select Aligned AE</option>
                  {VALIDATED_BY_OPTIONS.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>

              {selectedBatch && (
                <div className="space-y-2 md:col-span-2 lg:col-span-1">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Recording Link (G-Drive)</label>
                  <input 
                    type="text"
                    value={batchRecordingLink}
                    onChange={(e) => setBatchRecordingLink(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="input-field"
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Center Code</label>
                <select 
                  value={selectedCenter}
                  onChange={(e) => {
                    setSelectedCenter(e.target.value);
                    setSelectedBatch('');
                  }}
                  className="input-field"
                >
                  <option value="">Choose Center...</option>
                  {centerCodes.map(code => <option key={code} value={code}>{code}</option>)}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Batch Code</label>
                <select 
                  disabled={!selectedCenter}
                  value={selectedBatch}
                  onChange={(e) => setSelectedBatch(e.target.value)}
                  className="input-field disabled:opacity-50"
                >
                  <option value="">Choose Batch...</option>
                  {batchCodes.map(code => <option key={code} value={code}>{code}</option>)}
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedBatch && filteredStudents.length > 0 && (
            <motion.div
              key={`batch-data-${selectedBatch}`}
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              {/* Student Details Header Banner (Gradient) */}
              <div className="bg-gradient-to-r from-brand-primary to-emerald-400 rounded-2xl p-6 text-white flex justify-between items-center shadow-lg shadow-brand-primary/20 backdrop-blur-md">
                <div>
                  <p className="text-xs uppercase opacity-80 font-bold tracking-[0.1em]">Batch Statistics</p>
                  <h3 className="text-2xl font-black mt-1 tracking-tight">{selectedBatch}</h3>
                </div>
                <div className="flex gap-8 lg:gap-12 flex-wrap justify-end">
                  <div className="text-right">
                    <p className="text-[10px] opacity-80 uppercase font-bold tracking-wider">Program Name</p>
                    <p className="font-bold text-xl truncate max-w-[200px]" title={filteredStudents[0]?.program_name || 'N/A'}>{filteredStudents[0]?.program_name || 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] opacity-80 uppercase font-bold tracking-wider">Start Date</p>
                    <p className="font-bold text-xl">{filteredStudents[0]?.batch_start_date || 'N/A'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] opacity-80 uppercase font-bold tracking-wider">Total Students</p>
                    <p className="font-bold text-xl">{filteredStudents.length}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] opacity-80 uppercase font-bold tracking-wider">Center Code</p>
                    <p className="font-bold text-xl">{selectedCenter}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] opacity-80 uppercase font-bold tracking-wider text-nowrap">Status</p>
                    <p className="font-bold text-xl text-nowrap">Running</p>
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="glass-card shadow-lg flex flex-col border border-brand-border">
                <div className="px-6 py-4 border-b border-brand-border/50 flex items-center bg-white backdrop-blur-sm z-30 relative rounded-t-2xl">
                  <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text"
                      placeholder="Search by student code or name..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-xl border border-brand-border text-sm outline-none focus:ring-2 focus:ring-brand-primary/50 transition-all bg-slate-50"
                    />
                  </div>
                </div>
                <div className="overflow-auto max-h-[60vh] relative">
                  <table className="w-full text-left relative">
                    <thead className="bg-[#f8fafc] border-b border-brand-border/50 sticky top-0 z-20 shadow-sm">
                      <tr>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider bg-[#f8fafc] sticky top-0">Student Code</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider bg-[#f8fafc] sticky top-0">Student Details</th>
                        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase text-center tracking-wider w-16 bg-[#f8fafc] sticky top-0">Val</th>
                        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase text-center tracking-wider w-16 bg-[#f8fafc] sticky top-0">Re-Val</th>
                        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase text-center tracking-wider w-16 bg-[#f8fafc] sticky top-0">Abs</th>
                        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase text-center tracking-wider w-16 bg-[#f8fafc] sticky top-0">Rej</th>
                        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase text-center tracking-wider w-16 bg-[#f8fafc] sticky top-0">
                          <Mic className="w-3.5 h-3.5 mx-auto text-slate-500" />
                        </th>
                        <th className="px-4 py-4 text-xs font-bold text-slate-500 uppercase text-center tracking-wider w-16 bg-[#f8fafc] sticky top-0">
                          <Video className="w-3.5 h-3.5 mx-auto text-slate-500" />
                        </th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider bg-[#f8fafc] sticky top-0">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-divide">
                      {searchedStudents.map((student, idx) => {
                        const studentKey = `${student.student_code || 'student'}-${idx}`;
                        const v = validations[student.student_code] || {};
                        return (
                          <tr key={studentKey} className={cn(idx % 2 === 0 ? "bg-white/20" : "bg-white/10", "hover:bg-brand-light transition-colors backdrop-blur-sm")}>
                            <td className="px-6 py-4 text-sm font-mono text-brand-primary font-semibold">{student.student_code}</td>
                            <td className="px-6 py-4">
                              <p className="text-sm font-semibold text-brand-text">{student.student_name}</p>
                              <div className="mt-1 space-y-0.5">
                                <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                                  <span className="opacity-60 text-[8px] uppercase">Mob:</span> {student.mobile_no || 'N/A'}
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                                  <span className="opacity-60 text-[8px] uppercase">Father:</span> {student.father_name || 'N/A'}
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                                  <span className="opacity-60 text-[8px] uppercase">DOB:</span> {student.dob ? String(student.dob) : 'N/A'}
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1" title={student.education_qualification || 'N/A'}>
                                  <span className="opacity-60 text-[8px] uppercase">Edu:</span> <span className="truncate max-w-[150px]">{student.education_qualification || 'N/A'}</span>
                                </p>
                                <p className="text-[10px] text-slate-400 font-medium truncate max-w-[200px] flex items-center gap-1" title={student.address}>
                                  <span className="opacity-60 text-[8px] uppercase">Addr:</span> {student.address || 'N/A'}
                                </p>
                              </div>
                            </td>
                            {['Validated', 'ReValidated', 'Absent', 'Rejected'].map((status) => (
                              <td key={status} className="px-4 py-4 text-center">
                                <input 
                                  type="checkbox" 
                                  className="accent-brand-primary w-4 h-4 cursor-pointer rounded"
                                  checked={v.status === status}
                                  onChange={() => handleCheckboxChange(student.student_code, 'status', v.status === status ? null : status as any)}
                                />
                              </td>
                            ))}
                            <td className="px-4 py-4 text-center">
                              <input 
                                type="checkbox" 
                                className="accent-indigo-500 w-4 h-4 cursor-pointer rounded"
                                checked={v.mic_on || false}
                                onChange={(e) => handleCheckboxChange(student.student_code, 'mic_on', e.target.checked)}
                              />
                            </td>
                            <td className="px-4 py-4 text-center">
                              <input 
                                type="checkbox" 
                                className="accent-indigo-500 w-4 h-4 cursor-pointer rounded"
                                checked={v.video_on || false}
                                onChange={(e) => handleCheckboxChange(student.student_code, 'video_on', e.target.checked)}
                              />
                            </td>
                            <td className="px-6 py-4">
                              <input
                                type="text"
                                value={v.remarks || ''}
                                onChange={(e) => handleValidationChange(student.student_code, 'remarks', e.target.value)}
                                onBlur={() => handleRemarksBlur(student.student_code)}
                                placeholder="Add comment..."
                                className="w-full bg-transparent border-b border-transparent focus:border-brand-primary focus:outline-none focus:ring-0 text-sm py-1 transition-all"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="p-4 bg-white/40 border-t border-brand-border/50 flex items-center justify-between text-xs text-brand-text font-medium backdrop-blur-sm">
                    <p>Showing {searchedStudents.length} of {filteredStudents.length} students.</p>
                    <div className="flex gap-2">
                      <button className="px-3 py-1 bg-brand-light border border-brand-border rounded hover:bg-brand-muted transition-colors">Prev</button>
                      <button className="px-3 py-1 bg-white border border-brand-border rounded font-bold text-brand-hover">1</button>
                      <button className="px-3 py-1 bg-brand-light border border-brand-border rounded hover:bg-brand-muted transition-colors">Next</button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!data.length && !fetchingData && (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-20 h-20 bg-brand-light rounded-3xl flex items-center justify-center text-brand-primary shadow-sm border border-brand-border">
              <FileSpreadsheet size={40} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-brand-text">Welcome to ValidatePro</h2>
              <p className="text-slate-500 max-w-xs mx-auto text-sm leading-relaxed">
                {profile?.role === 'admin' 
                  ? "Select and upload an Excel data file to populate batch students." 
                  : "No batch records have been uploaded yet. Please contact your administrator."}
              </p>
            </div>
          </div>
        )}

        {!data.length && fetchingData && (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
            <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            <p className="text-sm text-slate-500 font-medium">Loading batch records...</p>
          </div>
        )}
      </div>
    </div>
  );
}
