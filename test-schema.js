import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (supabaseUrl && serviceRoleKey) {
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  supabase.from('student_validations').select('*').limit(1)
    .then(({ data, error }) => {
      if (error) {
        console.error('Supabase Query Error:', error);
      } else {
        console.log('Record Sample:', data);
        if (data && data[0]) {
          console.log('Available Columns:', Object.keys(data[0]));
        } else {
          console.log('No rows exist in student_validations. Let\'s check general schema.');
        }
      }
    });
} else {
  console.log('Supabase env vars missing during test-schema');
}
