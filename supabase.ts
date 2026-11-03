import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your secrets.'
  );
}

export function clearLocalAuthTokens() {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('supabase') || key.includes('-auth-token') || key.startsWith('sb-'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (e) {
    console.warn('[Auth] Error clearing tokens:', e);
  }
}

const customFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (
    typeof input === 'string' &&
    input.includes('token?grant_type=refresh_token') &&
    response.status === 400
  ) {
    try {
      const clone = response.clone();
      const body = await clone.json();
      if (
        body?.error === 'invalid_grant' ||
        body?.error_description?.includes('Refresh Token') ||
        body?.msg?.includes('Refresh Token')
      ) {
        clearLocalAuthTokens();
      }
    } catch {}
  }
  return response;
};

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      fetch: customFetch,
    },
  }
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
  enrollment_status?: string;
  batch_start_date?: string;
  program_name?: string;
  education_qualification?: string;
  created_at?: string;
  uploaded_by?: string;
};

export type Profile = {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'user';
  is_disabled?: boolean;
  created_at: string;
};

export type ValidationAttemptLog = {
  id?: string;
  attempt_number: number;
  visit_count: number;
  absent_count: number;
  status: string;
  validated_by: string;
  date: string;
  remarks?: string;
  validation_type?: string;
  recording_link?: string;
  mic_on?: boolean;
  video_on?: boolean;
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
  recording_link?: string;
  validation_type?: string;
  mic_on?: boolean;
  video_on?: boolean;
  visit_count?: number;
  absent_count?: number;
  attempt_number?: number;
  validation_history?: ValidationAttemptLog[];
  created_at?: string;
  updated_at?: string;
  user_id?: string;
};
