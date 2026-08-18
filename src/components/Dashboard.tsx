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
  Users,
  Loader2,
  Mic,
  Video,
  RefreshCcw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../utils';
import { ValidationHistoryModal } from './ValidationHistoryModal';
import { ValidationAttemptLog } from '../../supabase';

export function Dashboard() {
  const { user, profile } = useAuth();
  const [data, setData] = useState<BatchStudent[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(false);

  // Filters state
  const [alignedAe, setAlignedAe] = useState(() => sessionStorage.getItem('val_alignedAe') || '');
  const [batchRecordingLink, setBatchRecordingLink] = useState(() => sessionStorage.getItem('val_batchRecordingLink') || '');
  const [selectedCenter, setSelectedCenter] = useState(() => sessionStorage.getItem('val_selectedCenter') || '');
  const [selectedBatch, setSelectedBatch] = useState(() => sessionStorage.getItem('val_selectedBatch') || '');
  const [validationType, setValidationType] = useState(() => sessionStorage.getItem('val_validationType') || '');
  const [studentSearch, setStudentSearch] = useState('');
  const [sortField, setSortField] = useState<'student_code' | 'student_name'>('student_code');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Visit Count & Validation History Modal State
  const [currentBatchVisit, setCurrentBatchVisit] = useState<number>(1);
  const [historyModalStudent, setHistoryModalStudent] = useState<Partial<StudentValidation> | null>(null);

  const validatedBy = profile?.username || '';

  // Local validation state
  // Key: student_code, Value: validation details
  const [validations, setValidations] = useState<Record<string, Partial<StudentValidation>>>(() => {
    try {
      const saved = sessionStorage.getItem('val_validations');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [dirtyStudents, setDirtyStudents] = useState<Set<string>>(() => {
    try {
      const saved = sessionStorage.getItem('val_dirtyStudents');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  const lastFetchedBatch = React.useRef(sessionStorage.getItem('val_lastFetchedBatch') || '');

  // Live Presence Tracking State
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [showPresenceModal, setShowPresenceModal] = useState(false);

  // Heartbeat loop
  useEffect(() => {
    if (!user?.id || !validatedBy) return;

    const sendHeartbeat = async () => {
      try {
        await fetch('/api/presence/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.id,
            username: validatedBy,
            centerCode: selectedCenter || '',
            batchCode: selectedBatch || ''
          })
        });
      } catch (err) {
        console.error('Failed to send presence heartbeat:', err);
      }
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 5000);
    return () => clearInterval(interval);
  }, [user?.id, validatedBy, selectedCenter, selectedBatch]);

  // Polling active users loop
  useEffect(() => {
    const fetchActiveUsers = async () => {
      try {
        const res = await fetch('/api/presence/active');
        if (res.ok) {
          const list = await res.json();
          setActiveUsers(list);
        }
      } catch (err) {
        console.error('Failed to fetch active users:', err);
      }
    };

    fetchActiveUsers();
    const interval = setInterval(fetchActiveUsers, 5000);
    return () => clearInterval(interval);
  }, []);

  // Effects to persist state
  useEffect(() => {
    sessionStorage.setItem('val_alignedAe', alignedAe);
    sessionStorage.setItem('val_batchRecordingLink', batchRecordingLink);
    sessionStorage.setItem('val_selectedCenter', selectedCenter);
    sessionStorage.setItem('val_selectedBatch', selectedBatch);
    sessionStorage.setItem('val_validationType', validationType);
  }, [alignedAe, batchRecordingLink, selectedCenter, selectedBatch, validationType]);

  useEffect(() => {
    sessionStorage.setItem('val_validations', JSON.stringify(validations));
  }, [validations]);

  useEffect(() => {
    sessionStorage.setItem('val_dirtyStudents', JSON.stringify(Array.from(dirtyStudents)));
  }, [dirtyStudents]);

  useEffect(() => {
    sessionStorage.setItem('val_lastFetchedBatch', lastFetchedBatch.current);
  }, [lastFetchedBatch.current]);

  useEffect(() => {
    const handleReset = () => {
      setAlignedAe('');
      setBatchRecordingLink('');
      setSelectedCenter('');
      setSelectedBatch('');
      setValidationType('');
      setStudentSearch('');
      setValidations({});
      setDirtyStudents(new Set());
      lastFetchedBatch.current = '';
      
      sessionStorage.removeItem('val_alignedAe');
      sessionStorage.removeItem('val_batchRecordingLink');
      sessionStorage.removeItem('val_selectedCenter');
      sessionStorage.removeItem('val_selectedBatch');
      sessionStorage.removeItem('val_validationType');
      sessionStorage.removeItem('val_validations');
      sessionStorage.removeItem('val_dirtyStudents');
      sessionStorage.removeItem('val_lastFetchedBatch');
    };
    
    window.addEventListener('reset_validation', handleReset);
    return () => window.removeEventListener('reset_validation', handleReset);
  }, []);

  useEffect(() => {
    fetchBatchStudents();
  }, [user?.id]);

  useEffect(() => {
    const fetchExistingValidations = async () => {
      const currentBatchKey = `${selectedCenter}_${selectedBatch}`;
      
      if (!selectedBatch || !selectedCenter) {
        if (lastFetchedBatch.current !== '') {
          setValidations({});
          setBatchRecordingLink('');
          setValidationType('');
          setDirtyStudents(new Set());
          lastFetchedBatch.current = '';
        }
        return;
      }
      
      const studentsInBatch = data.filter(row => 
        String(row.batch_code) === String(selectedBatch) && 
        String(row.center_code) === String(selectedCenter) && 
        String(row.batch_status).toLowerCase() === 'running'
      );
      
      if (studentsInBatch.length === 0) {
        // Data might not be loaded yet, wait for data
        return;
      }

      // If we already fetched for this batch key today, skip it so users don't lose edits to `data` refresh
      if (lastFetchedBatch.current === currentBatchKey) return;

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
        let existingValType = '';
        let maxVisit = 1;

        existingRecords.forEach((record: any) => {
          if (!existingLink && record.recording_link && record.recording_link !== 'N.A.') {
            existingLink = record.recording_link;
          }
          if (!existingValType && record.validation_type && record.validation_type !== 'N.A.') {
            existingValType = record.validation_type;
          }
          const recVisit = Number(record.visit_count) || 1;
          if (recVisit > maxVisit) maxVisit = recVisit;

          loadedValidations[record.student_code] = {
            id: record.id,
            status: record.status as any,
            remarks: record.remarks,
            recording_link: record.recording_link || 'N.A.',
            validation_type: record.validation_type || 'N.A.',
            mic_on: record.mic_on,
            video_on: record.video_on,
            visit_count: recVisit,
            absent_count: Number(record.absent_count) || (record.status === 'Absent' ? 1 : 0),
            validation_history: Array.isArray(record.validation_history) ? record.validation_history : [],
            created_at: record.created_at,
            updated_at: record.updated_at
          };
        });
        
        setCurrentBatchVisit(maxVisit);
        // Only safely update everything since this is our first time loading this batch
        setValidations(loadedValidations);
        if (existingLink) {
          setBatchRecordingLink(existingLink);
        } else {
          setBatchRecordingLink('');
        }
        if (existingValType) {
          setValidationType(existingValType);
        } else {
          setValidationType('');
        }
        setDirtyStudents(new Set());
        
        lastFetchedBatch.current = currentBatchKey;
      }
    };
    
    fetchExistingValidations();
  }, [selectedBatch, selectedCenter, data]);

  const fetchBatchStudents = async (forceRefresh = false) => {
    if (!user) return;
    setFetchingData(true);
    try {
      const res = await fetch(`/api/batch_data${forceRefresh ? '?refresh=true' : ''}`);
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
             // Log the upload
             try {
               await supabase.from('excel_uploads').insert({
                 uploaded_by: user?.id,
                 username: profile?.username || user?.email?.split('@')[0] || 'admin',
                 filename: file.name,
                 record_count: normalizedData.length,
                 uploaded_at: new Date().toISOString()
               });
             } catch (logErr) {
               console.error('Error logging excel upload:', logErr);
             }

             toast.success(`Successfully added ${insertCount} records and updated dates for ${updateCount} records!`);
             fetchBatchStudents(true); // Refresh data and invalidate server cache
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
    "Robin",
    "Sapna Yadav",
    "Susmita Chakraborty",
    "Tanmoy Bose"
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
    let result = [...filteredStudents];
    if (studentSearch) {
      const lowerSearch = studentSearch.toLowerCase();
      result = result.filter(s => 
        (s.student_name || '').toLowerCase().includes(lowerSearch) || 
        (s.student_code || '').toLowerCase().includes(lowerSearch)
      );
    }

    result.sort((a, b) => {
      const valA = String(a[sortField] || '').trim();
      const valB = String(b[sortField] || '').trim();
      const comparison = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' });
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [filteredStudents, studentSearch, sortField, sortOrder]);

  const handleValidationChange = (studentCode: string, field: keyof StudentValidation, value: any) => {
    setDirtyStudents(prev => new Set(prev).add(studentCode));
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
      student_code: student.student_code || '',
      student_name: student.student_name || '',
      ae_name: student.ae_name || student.aligned_ae || alignedAe || '',
      center_code: student.center_code || '',
      batch_code: student.batch_code || '',
      dob: student.dob ? String(student.dob) : '',
      father_name: student.father_name || '',
      address: student.address || '',
      validated_by: validatedBy || '',
      aligned_ae: alignedAe || student.ae_name || student.aligned_ae || '',
      status: v.status || 'Pending',
      remarks: v.remarks || '',
      recording_link: validationType === 'Online' ? (batchRecordingLink || 'N.A.') : 'N.A.',
      validation_type: validationType || 'N.A.',
      mic_on: v.mic_on || false,
      video_on: v.video_on || false,
      visit_count: v.visit_count || currentBatchVisit,
      absent_count: v.absent_count || (v.status === 'Absent' ? 1 : 0),
      validation_history: v.validation_history || [],
      user_id: user.id,
      created_at: v.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
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
        setValidations(prev => ({
          ...prev,
          [studentCode]: {
            ...prev[studentCode],
            id: savedData.id,
            visit_count: savedData.visit_count || record.visit_count,
            absent_count: savedData.absent_count || record.absent_count,
            validation_history: savedData.validation_history || record.validation_history
          }
        }));
      } else {
        const err = await res.json();
        console.error('Autosave error:', err);
      }
    } catch (e) {
      console.error('Autosave failed:', e);
    }
  };

  const handleNewVisit = async () => {
    if (!selectedBatch) return;
    const nextVisit = currentBatchVisit + 1;
    setCurrentBatchVisit(nextVisit);

    const nowIso = new Date().toISOString();
    const updatedValidations: Record<string, Partial<StudentValidation>> = { ...validations };
    const recordsToSave: any[] = [];
    const dirtySet = new Set(dirtyStudents);

    filteredStudents.forEach(student => {
      const studentCode = student.student_code;
      const currentVal = updatedValidations[studentCode] || {};
      const oldStatus = currentVal.status || 'Pending';
      const oldAbsentCount = currentVal.absent_count !== undefined && currentVal.absent_count !== null
        ? Number(currentVal.absent_count)
        : (oldStatus === 'Absent' ? 1 : 0);

      let newAbsentCount = oldAbsentCount;
      // If validator didn't make any changes and student remains 'Absent', increment absent count for this new visit
      if (oldStatus === 'Absent') {
        newAbsentCount = oldAbsentCount + 1;
      }

      const existingHistory: ValidationAttemptLog[] = Array.isArray(currentVal.validation_history) 
        ? [...currentVal.validation_history] 
        : [];

      const newLogItem: ValidationAttemptLog = {
        id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        attempt_number: existingHistory.length + 1,
        visit_count: nextVisit,
        absent_count: newAbsentCount,
        status: oldStatus,
        validated_by: validatedBy,
        date: nowIso,
        remarks: currentVal.remarks || '',
        validation_type: validationType || 'N.A.',
        recording_link: batchRecordingLink || 'N.A.',
        mic_on: Boolean(currentVal.mic_on),
        video_on: Boolean(currentVal.video_on)
      };

      const updatedHistory = [...existingHistory, newLogItem];

      const studentUpdate: Partial<StudentValidation> = {
        ...currentVal,
        visit_count: nextVisit,
        absent_count: newAbsentCount,
        validation_history: updatedHistory,
        updated_at: nowIso
      };

      updatedValidations[studentCode] = studentUpdate;
      dirtySet.add(studentCode);

      const record: any = {
        student_code: student.student_code || '',
        student_name: student.student_name || '',
        ae_name: student.ae_name || student.aligned_ae || alignedAe || '',
        center_code: student.center_code || '',
        batch_code: student.batch_code || '',
        dob: student.dob ? String(student.dob) : '',
        father_name: student.father_name || '',
        address: student.address || '',
        validated_by: validatedBy || '',
        aligned_ae: alignedAe || student.ae_name || student.aligned_ae || '',
        status: oldStatus,
        remarks: currentVal.remarks || '',
        recording_link: validationType === 'Online' ? (batchRecordingLink || 'N.A.') : 'N.A.',
        validation_type: validationType || 'N.A.',
        mic_on: Boolean(currentVal.mic_on),
        video_on: Boolean(currentVal.video_on),
        visit_count: nextVisit,
        absent_count: newAbsentCount,
        validation_history: updatedHistory,
        user_id: user?.id || '',
        created_at: currentVal.created_at || nowIso,
        updated_at: nowIso
      };

      if (currentVal.id) {
        record.id = currentVal.id;
      }
      recordsToSave.push(record);
    });

    setValidations(updatedValidations);
    setDirtyStudents(dirtySet);

    if (recordsToSave.length > 0) {
      try {
        const recordsToInsert = recordsToSave.filter(r => !r.id);
        const recordsToUpdate = recordsToSave.filter(r => r.id);
        const res = await fetch('/api/validations/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ recordsToInsert, recordsToUpdate })
        });
        if (res.ok) {
          toast.success(`Started Visit #${nextVisit}. Updated visit counts & absent records for batch ${selectedBatch}.`);
        }
      } catch (e) {
        console.error('Error auto-saving new visit records:', e);
      }
    }
  };

  const handleCheckboxChange = async (studentCode: string, field: 'status' | 'mic_on' | 'video_on', value: any) => {
    setDirtyStudents(prev => new Set(prev).add(studentCode));
    
    const currentVal = validations[studentCode] || {};
    const oldStatus = currentVal.status;
    const oldAbsentCount = currentVal.absent_count || (oldStatus === 'Absent' ? 1 : 0);
    
    let updatedAbsentCount = oldAbsentCount;
    if (field === 'status') {
      if (value === 'Absent') {
        if (oldStatus !== 'Absent') {
          updatedAbsentCount = oldAbsentCount + 1;
        } else {
          updatedAbsentCount = Math.max(1, oldAbsentCount);
        }
        toast.success(`Marked absent (Visit #${currentBatchVisit}, Absent ${updatedAbsentCount}x)`);
      } else if (oldStatus === 'Absent' && value !== 'Absent') {
        updatedAbsentCount = Math.max(0, oldAbsentCount - 1);
        toast.success(`Updated status to ${value} (Visit #${currentBatchVisit}, Absent ${updatedAbsentCount}x)`);
      }
    }

    const nowIso = new Date().toISOString();
    const existingHistory: ValidationAttemptLog[] = Array.isArray(currentVal.validation_history) ? [...currentVal.validation_history] : [];
    
    const newLogItem: ValidationAttemptLog = {
      id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      attempt_number: existingHistory.length + 1,
      visit_count: currentBatchVisit,
      absent_count: updatedAbsentCount,
      status: field === 'status' ? (value || 'Pending') : (currentVal.status || 'Pending'),
      validated_by: validatedBy,
      date: nowIso,
      remarks: currentVal.remarks || '',
      validation_type: validationType || 'N.A.',
      recording_link: batchRecordingLink || 'N.A.',
      mic_on: field === 'mic_on' ? Boolean(value) : (currentVal.mic_on || false),
      video_on: field === 'video_on' ? Boolean(value) : (currentVal.video_on || false)
    };

    const updatedHistory = [...existingHistory, newLogItem];

    const optimisticUpdate: Partial<StudentValidation> = {
      [field]: value,
      visit_count: currentBatchVisit,
      absent_count: updatedAbsentCount,
      validation_history: updatedHistory,
      updated_at: nowIso
    };

    // 1. Optimistic update
    setValidations(prev => ({
      ...prev,
      [studentCode]: {
        ...prev[studentCode],
        ...optimisticUpdate
      }
    }));

    autosaveValidation(studentCode, optimisticUpdate);
  };

  const handleRemarksBlur = (studentCode: string) => {
    setDirtyStudents(prev => new Set(prev).add(studentCode));
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
      if (!dirtyStudents.has(student.student_code)) continue;

      const v = validations[student.student_code] || {};
      const status = v.status || 'Pending';
      const remarks = (v.remarks || '').trim();
      const recordingLink = (batchRecordingLink || '').trim();
      
      if (validationType === 'Online' && status !== 'Pending') {
        if (!recordingLink) {
          toast.error(`Recording link (G-Drive) is mandatory for Online Validation`);
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
      if (!dirtyStudents.has(student.student_code)) return;

      const v = validations[student.student_code] || {};
      const record: any = {
        student_code: student.student_code || '',
        student_name: student.student_name || '',
        ae_name: student.ae_name || student.aligned_ae || alignedAe || '',
        center_code: student.center_code || '',
        batch_code: student.batch_code || '',
        dob: student.dob ? String(student.dob) : '',
        father_name: student.father_name || '',
        address: student.address || '',
        validated_by: validatedBy || '',
        aligned_ae: alignedAe || student.ae_name || student.aligned_ae || '',
        status: v.status || 'Pending',
        remarks: v.remarks || '',
        recording_link: validationType === 'Online' ? (batchRecordingLink || 'N.A.') : 'N.A.',
        validation_type: validationType || 'N.A.',
        mic_on: v.mic_on || false,
        video_on: v.video_on || false,
        visit_count: v.visit_count || currentBatchVisit,
        absent_count: v.absent_count || (v.status === 'Absent' ? 1 : 0),
        validation_history: v.validation_history || [],
        user_id: user.id,
        created_at: v.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
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
      setDirtyStudents(new Set()); // Reset dirty state
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
            <motion.label 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 btn-secondary cursor-pointer shadow-sm hover:shadow transition-shadow duration-300"
            >
              <Upload className="w-4 h-4" />
              <span>{fileName || 'Upload Excel'}</span>
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
            </motion.label>
          )}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowPresenceModal(true)}
            className="btn-secondary flex items-center gap-2 glass-card border-emerald-500/20 text-slate-700 hover:bg-emerald-500/5 shadow-sm hover:shadow transition-shadow duration-300 relative"
            title="View active online validators"
          >
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Users size={16} className="text-slate-500" />
              <span className="font-semibold text-xs text-slate-600 sm:inline hidden">Online Validators</span>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {activeUsers.length}
              </span>
            </div>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => window.dispatchEvent(new CustomEvent('reset_validation'))}
            className="btn-secondary flex items-center gap-2 glass-card text-brand-primary border-brand-primary/20 hover:bg-brand-primary/5 shadow-sm hover:shadow transition-shadow duration-300"
            title="Start New Validation / Clear Form"
          >
            <RefreshCcw size={16} />
            <span className="hidden sm:inline">Start New</span>
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={loading || !selectedBatch || !validationType}
            onClick={handleSubmit}
            className="btn-primary flex items-center gap-2 disabled:opacity-50 shadow-md hover:shadow-lg transition-all duration-300"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
            Save Changes
          </motion.button>
        </div>
      </header>

      <div className="p-8 space-y-6 overflow-y-auto">
        <AnimatePresence>
          {data.length > 0 && (
            <motion.div 
              key="filters-config"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ type: "spring", stiffness: 350, damping: 28 }}
              className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 glass-card p-6 shadow-sm hover:shadow-md transition-shadow duration-300"
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

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Validation Type</label>
                <select 
                  disabled={!selectedBatch}
                  value={validationType}
                  onChange={(e) => setValidationType(e.target.value)}
                  className="input-field disabled:opacity-50"
                >
                  <option value="">Select Type...</option>
                  <option value="Offline">Offline</option>
                  <option value="Online">Online</option>
                </select>
              </div>

              {selectedBatch && validationType === 'Online' && (
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
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectedBatch && validationType && filteredStudents.length > 0 && (
            <motion.div
              key={`batch-data-${selectedBatch}`}
              initial={{ opacity: 0, scale: 0.99 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              {/* Student Details Header Banner (Gradient) */}
              <motion.div 
                whileHover={{ y: -3, boxShadow: "0 12px 24px -4px rgba(13, 148, 136, 0.25)" }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="bg-gradient-to-r from-brand-primary to-emerald-400 rounded-2xl p-6 text-white flex justify-between items-center shadow-lg shadow-brand-primary/20 backdrop-blur-md cursor-default select-none"
              >
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
                  <div className="text-right flex flex-col items-end">
                    <p className="text-[10px] opacity-80 uppercase font-bold tracking-wider text-nowrap">Validation Visit</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="font-bold text-xl bg-white/20 px-2.5 py-0.5 rounded-lg backdrop-blur-sm border border-white/30">
                        Visit #{currentBatchVisit}
                      </span>
                      <button
                        type="button"
                        onClick={handleNewVisit}
                        className="px-2.5 py-1 text-xs font-bold bg-white text-teal-800 hover:bg-teal-50 rounded-lg shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                        title="Start a new visit attempt for this batch and auto-update visit & absent counts"
                      >
                        <Plus size={12} /> New Visit
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Data Table */}
              <div className="glass-card shadow-lg flex flex-col border border-brand-border">
                <div className="px-6 py-4 border-b border-brand-border/50 flex flex-col md:flex-row md:items-center justify-between gap-4 glass-card backdrop-blur-sm z-30 relative rounded-t-2xl">
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

                  {/* Flexible Sorting Bar */}
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="text-slate-500 font-semibold select-none">Sort:</span>
                    <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                      <button
                        type="button"
                        onClick={() => {
                          if (sortField === 'student_code') {
                            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('student_code');
                            setSortOrder('asc');
                          }
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1.5",
                          sortField === 'student_code' 
                            ? "glass-card text-brand-primary shadow-sm" 
                            : "text-slate-600 hover:text-slate-800"
                        )}
                      >
                        Code
                        {sortField === 'student_code' && (
                          sortOrder === 'asc' ? <ArrowUp size={12} className="text-brand-primary" /> : <ArrowDown size={12} className="text-brand-primary" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (sortField === 'student_name') {
                            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                          } else {
                            setSortField('student_name');
                            setSortOrder('asc');
                          }
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1.5",
                          sortField === 'student_name' 
                            ? "glass-card text-brand-primary shadow-sm" 
                            : "text-slate-600 hover:text-slate-800"
                        )}
                      >
                        Name
                        {sortField === 'student_name' && (
                          sortOrder === 'asc' ? <ArrowUp size={12} className="text-brand-primary" /> : <ArrowDown size={12} className="text-brand-primary" />
                        )}
                      </button>
                    </div>

                    <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setSortOrder('asc')}
                        className={cn(
                          "px-2 py-1 rounded-md font-bold transition-all text-[10px]",
                          sortOrder === 'asc' 
                            ? "glass-card text-emerald-600 shadow-sm" 
                            : "text-slate-500 hover:text-slate-700"
                        )}
                        title="Sort Ascending (A-Z)"
                      >
                        A-Z
                      </button>
                      <button
                        type="button"
                        onClick={() => setSortOrder('desc')}
                        className={cn(
                          "px-2 py-1 rounded-md font-bold transition-all text-[10px]",
                          sortOrder === 'desc' 
                            ? "glass-card text-emerald-500 shadow-sm" 
                            : "text-slate-500 hover:text-slate-700"
                        )}
                        title="Sort Descending (Z-A)"
                      >
                        Z-A
                      </button>
                    </div>
                  </div>
                </div>
                <div className="overflow-auto max-h-[60vh] relative">
                  <table className="w-full text-left relative">
                    <thead className="bg-[#f8fafc] border-b border-brand-border/50 sticky top-0 z-20 shadow-sm">
                      <tr>
                        <th 
                          onClick={() => {
                            if (sortField === 'student_code') {
                              setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortField('student_code');
                              setSortOrder('asc');
                            }
                          }}
                          className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider bg-[#f8fafc] sticky top-0 cursor-pointer hover:bg-slate-100 transition-colors select-none group"
                        >
                          <div className="flex items-center gap-1.5">
                            Student Code
                            <ArrowUpDown size={12} className={cn(
                              "transition-opacity duration-200",
                              sortField === 'student_code' ? "text-brand-primary opacity-100" : "text-slate-300 opacity-0 group-hover:opacity-70"
                            )} />
                            {sortField === 'student_code' && (
                              sortOrder === 'asc' ? <span className="text-[9px] text-brand-primary font-bold normal-case font-mono">(A-Z)</span> : <span className="text-[9px] text-brand-primary font-bold normal-case font-mono">(Z-A)</span>
                            )}
                          </div>
                        </th>
                        <th 
                          onClick={() => {
                            if (sortField === 'student_name') {
                              setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                            } else {
                              setSortField('student_name');
                              setSortOrder('asc');
                            }
                          }}
                          className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider bg-[#f8fafc] sticky top-0 cursor-pointer hover:bg-slate-100 transition-colors select-none group"
                        >
                          <div className="flex items-center gap-1.5">
                            Student Details
                            <ArrowUpDown size={12} className={cn(
                              "transition-opacity duration-200",
                              sortField === 'student_name' ? "text-brand-primary opacity-100" : "text-slate-300 opacity-0 group-hover:opacity-70"
                            )} />
                            {sortField === 'student_name' && (
                              sortOrder === 'asc' ? <span className="text-[9px] text-brand-primary font-bold normal-case font-mono">(A-Z)</span> : <span className="text-[9px] text-brand-primary font-bold normal-case font-mono">(Z-A)</span>
                            )}
                          </div>
                        </th>
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
                          <motion.tr 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, delay: Math.min(idx * 0.05, 0.5) }}
                            key={studentKey} 
                            className={cn(idx % 2 === 0 ? "bg-white/20" : "bg-white/10", "hover-lift backdrop-blur-sm")}
                          >
                            <td className="px-6 py-4 text-sm font-mono text-brand-primary font-semibold">{student.student_code}</td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-semibold text-brand-text">{student.student_name}</p>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {(v.absent_count || (v.status === 'Absent' ? 1 : 0)) > 0 && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/10 text-amber-700 border border-amber-500/30">
                                      Absent: {v.absent_count || (v.status === 'Absent' ? 1 : 0)}x
                                    </span>
                                  )}
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-500/10 text-blue-700 border border-blue-500/30">
                                    Visit #{v.visit_count || currentBatchVisit}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setHistoryModalStudent({ ...student, ...v })}
                                    className="px-2 py-0.5 rounded-md text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors flex items-center gap-1 cursor-pointer"
                                    title="View validation attempts & history"
                                  >
                                    <Clock size={10} /> History ({(v.validation_history || []).length || (v.created_at ? 1 : 0)})
                                  </button>
                                </div>
                              </div>
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
                                <motion.input 
                                  whileHover={{ scale: 1.25 }}
                                  whileTap={{ scale: 0.8 }}
                                  type="checkbox" 
                                  className="accent-brand-primary w-4 h-4 cursor-pointer rounded transition-transform"
                                  checked={v.status === status}
                                  onChange={() => handleCheckboxChange(student.student_code, 'status', v.status === status ? null : status as any)}
                                />
                              </td>
                            ))}
                            <td className="px-4 py-4 text-center">
                              <motion.input 
                                whileHover={{ scale: 1.25 }}
                                whileTap={{ scale: 0.8 }}
                                type="checkbox" 
                                className="accent-indigo-500 w-4 h-4 cursor-pointer rounded transition-transform"
                                checked={v.mic_on || false}
                                onChange={(e) => handleCheckboxChange(student.student_code, 'mic_on', e.target.checked)}
                              />
                            </td>
                            <td className="px-4 py-4 text-center">
                              <motion.input 
                                whileHover={{ scale: 1.25 }}
                                whileTap={{ scale: 0.8 }}
                                type="checkbox" 
                                className="accent-indigo-500 w-4 h-4 cursor-pointer rounded transition-transform"
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
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="p-4 bg-white/40 border-t border-brand-border/50 flex items-center justify-between text-xs text-brand-text font-medium backdrop-blur-sm">
                    <p>Showing {searchedStudents.length} of {filteredStudents.length} students.</p>
                    <div className="flex gap-2">
                      <button className="px-3 py-1 bg-brand-light border border-brand-border rounded hover:bg-brand-muted transition-colors">Prev</button>
                      <button className="px-3 py-1 glass-card border border-brand-border rounded font-bold text-brand-hover">1</button>
                      <button className="px-3 py-1 bg-brand-light border border-brand-border rounded hover:bg-brand-muted transition-colors">Next</button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!data.length && !fetchingData && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="h-[60vh] flex flex-col items-center justify-center text-center space-y-6"
          >
            <motion.div 
              initial={{ y: 0 }}
              animate={{ y: [-5, 5, -5] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="w-20 h-20 bg-brand-light rounded-3xl flex items-center justify-center text-brand-primary shadow-sm border border-brand-border"
            >
              <FileSpreadsheet size={40} />
            </motion.div>
            <div>
              <h2 className="text-xl font-bold text-brand-text">Welcome to Validate-Pro</h2>
              <p className="text-slate-500 max-w-xs mx-auto text-sm leading-relaxed">
                {profile?.role === 'admin' 
                  ? "Select and upload an Excel data file to populate batch students." 
                  : "No batch records have been uploaded yet. Please contact your administrator."}
              </p>
            </div>
          </motion.div>
        )}

        {!data.length && fetchingData && (
          <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
            <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            <p className="text-sm text-slate-500 font-medium">Loading batch records...</p>
          </div>
        )}
      </div>

      {/* Live Presence Modal */}
      <AnimatePresence>
        {showPresenceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPresenceModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="bg-white rounded-2xl border border-slate-200/80 shadow-2xl w-full max-w-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Active Online Validators
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">See live users and their current validation activities</p>
                </div>
                <button
                  onClick={() => setShowPresenceModal(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body */}
              <div className="p-6 max-h-[60vh] overflow-y-auto">
                {activeUsers.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 space-y-2">
                    <Users size={32} className="mx-auto text-slate-300 animate-pulse" />
                    <p className="text-sm font-medium">No validators are currently active</p>
                  </div>
                ) : (
                  <div className="overflow-hidden border border-slate-100 rounded-xl shadow-sm bg-white">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Validator Name</th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Center Code</th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Batch Code</th>
                          <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {activeUsers.map((active) => {
                          const isMe = active.userId === user?.id;
                          const isWorking = active.centerCode && active.batchCode;
                          return (
                            <tr key={active.userId} className={`hover-lift ${isMe ? 'bg-amber-50/20' : ''}`}>
                              <td className="px-4 py-3.5 font-semibold text-slate-700 flex items-center gap-2">
                                {active.username}
                                {isMe && (
                                  <span className="bg-brand-light text-brand-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-brand-border">
                                    You
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3.5 font-medium text-slate-600">
                                {active.centerCode || <span className="text-slate-400 italic">N.A.</span>}
                              </td>
                              <td className="px-4 py-3.5 font-medium text-slate-600">
                                {active.batchCode || <span className="text-slate-400 italic">N.A.</span>}
                              </td>
                              <td className="px-4 py-3.5">
                                {isWorking ? (
                                  <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-xs font-bold border border-emerald-100">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                    Validating
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 bg-slate-50 text-slate-500 px-2.5 py-1 rounded-full text-xs font-medium border border-slate-100">
                                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full"></span>
                                    Idle
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
                <button
                  onClick={() => setShowPresenceModal(false)}
                  className="px-4 py-2 bg-slate-800 text-white hover:bg-slate-900 rounded-xl text-xs font-bold transition-colors shadow-sm cursor-pointer"
                >
                  Close Window
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ValidationHistoryModal 
        isOpen={!!historyModalStudent} 
        onClose={() => setHistoryModalStudent(null)} 
        student={historyModalStudent} 
      />
    </div>
  );
}
