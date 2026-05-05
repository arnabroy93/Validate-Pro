import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your secrets.'
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

export type BatchStudent = {
  id?: string;
  ae_name: string;
  center_code: string;
  batch_code: string;
  student_code: string;
  student_name: string;
  mobile_no?: string;
  dob: string;
  father_name: string;
  address: string;
  batch_status: string;
  batch_start_date?: string;
  created_at?: string;
  uploaded_by?: string;
};

export type Profile = {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  created_at: string;
};

export type StudentValidation = {
  id?: string;
  student_code: string;
  student_name: string;
  mobile_no?: string;
  ae_name: string;
  center_code: string;
  batch_code: string;
  dob: string;
  father_name: string;
  address: string;
  validated_by: string;
  aligned_ae?: string;
  status: 'Validated' | 'ReValidated' | 'Absent' | 'Rejected' | 'Pending';
  remarks: string;
  mic_on?: boolean;
  video_on?: boolean;
  created_at?: string;
  user_id?: string;
};
