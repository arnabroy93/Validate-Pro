import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (supabaseUrl && serviceRoleKey) {
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  supabase.rpc('get_tables').then(({ data, error }) => {
    if (error) {
      // Try querying information_schema.tables directly if rpc doesn't exist
      // Since supabase client doesn't support raw sql easily without rpc/edge function, let's write a node pg query or use our existing backend endpoint capability to list tables, or fetch supabaseAdmin table list
      console.log('Unable to use RPC:', error.message);
    } else {
      console.log('Tables:', data);
    }
  });
} else {
  console.log('Supabase env vars missing');
}
