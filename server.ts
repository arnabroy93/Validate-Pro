import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations(isManual = false) {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('[Migration] DATABASE_URL not found. Skipping automatic schema updates.');
    return;
  }

  const sql = postgres(dbUrl, { ssl: 'require' });

  try {
    console.log('[Migration] Starting automatic schema sync...');
    // 0. Set Search Path
    await sql`SET search_path TO public, auth;`;

    // 1. Ensure profiles table exists
    await sql`
      CREATE TABLE IF NOT EXISTS public.profiles (
        id UUID PRIMARY KEY,
        username TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        email TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;
    await sql`ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;`;
    await sql`ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_key;`;
    
    // 2. Ensure student_validations table exists
    await sql`
      CREATE TABLE IF NOT EXISTS public.student_validations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `;

    // Add columns if they missed the boat
    await sql`ALTER TABLE public.student_validations ADD COLUMN IF NOT EXISTS student_code TEXT;`;
    await sql`ALTER TABLE public.student_validations ADD COLUMN IF NOT EXISTS student_name TEXT;`;
    await sql`ALTER TABLE public.student_validations ADD COLUMN IF NOT EXISTS ae_name TEXT;`;
    await sql`ALTER TABLE public.student_validations ADD COLUMN IF NOT EXISTS center_code TEXT;`;
    await sql`ALTER TABLE public.student_validations ADD COLUMN IF NOT EXISTS batch_code TEXT;`;
    await sql`ALTER TABLE public.student_validations ADD COLUMN IF NOT EXISTS validated_by TEXT;`;
    await sql`ALTER TABLE public.student_validations ADD COLUMN IF NOT EXISTS remarks TEXT;`;
    await sql`ALTER TABLE public.student_validations ADD COLUMN IF NOT EXISTS dob TEXT;`;
    await sql`ALTER TABLE public.student_validations ADD COLUMN IF NOT EXISTS father_name TEXT;`;
    await sql`ALTER TABLE public.student_validations ADD COLUMN IF NOT EXISTS address TEXT;`;
    await sql`ALTER TABLE public.student_validations ADD COLUMN IF NOT EXISTS mic_on BOOLEAN DEFAULT false;`;
    await sql`ALTER TABLE public.student_validations ADD COLUMN IF NOT EXISTS video_on BOOLEAN DEFAULT false;`;

    // 3. Permissions & RLS
    await sql`ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;`;
    await sql`ALTER TABLE public.student_validations ENABLE ROW LEVEL SECURITY;`;
    
    await sql`GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;`;
    await sql`GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;`;
    await sql`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;`;
    await sql`GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;`;

    // 4. Policies
    // Profiles
    await sql`DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;`;
    await sql`DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;`;
    await sql`CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);`;
    
    await sql`DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;`;
    await sql`DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;`;
    await sql`CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);`;

    await sql`DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;`;
    await sql`DROP POLICY IF EXISTS "Users can insert own profile." ON public.profiles;`;
    await sql`CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);`;

    // Service role bypass
    await sql`DROP POLICY IF EXISTS "Service role bypass" ON public.profiles;`;
    await sql`CREATE POLICY "Service role bypass" ON public.profiles FOR ALL TO service_role USING (true) WITH CHECK (true);`;

    // Validations
    await sql`DROP POLICY IF EXISTS "Users can view own validations" ON public.student_validations;`;
    await sql`CREATE POLICY "Users can view own validations" ON public.student_validations FOR SELECT USING (auth.uid() = user_id OR (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')));`;

    await sql`DROP POLICY IF EXISTS "Users can insert own validations" ON public.student_validations;`;
    await sql`CREATE POLICY "Users can insert own validations" ON public.student_validations FOR INSERT WITH CHECK (
      auth.uid() = user_id OR 
      (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
    );`;

    await sql`DROP POLICY IF EXISTS "Admins can manage all validations" ON public.student_validations;`;
    await sql`CREATE POLICY "Admins can manage all validations" ON public.student_validations FOR ALL USING (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );`;

    // 5. Trigger for automatic profile creation
    await sql`
      CREATE OR REPLACE FUNCTION public.handle_new_user()
      RETURNS trigger AS $$
      BEGIN
        INSERT INTO public.profiles (id, username, email, role)
        VALUES (
          new.id, 
          COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)), 
          new.email, 
          CASE WHEN new.email = 'admin@validpro.internal' THEN 'admin' ELSE 'user' END
        )
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email;
        RETURN new;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `;

    try {
      await sql`DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;`;
      await sql`
        CREATE TRIGGER on_auth_user_created
          AFTER INSERT ON auth.users
          FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
      `;
    } catch (e) {
      console.log('[Migration] Note: Trigger creation failed (permission check). Using client fallback.');
    }

    // 6. Add Indexes for performance
    await sql`CREATE INDEX IF NOT EXISTS idx_batch_students_batch_code ON public.batch_students(batch_code);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_batch_students_status ON public.batch_students(batch_status);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_student_validations_batch_code ON public.student_validations(batch_code);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_student_validations_status ON public.student_validations(status);`;

    // 7. Force Schema Reload
    await sql`NOTIFY pgrst, 'reload schema';`;
    
    await sql`GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;`;
    console.log('[Migration] Database synchronization complete.');
    
    // Force a dummy query via Supabase SDK to potentially trigger cache refresh
    if (process.env.VITE_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { createClient } = await import('@supabase/supabase-js');
      const tempClient = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
      await tempClient.from('student_validations').select('id').limit(1);
      await tempClient.from('profiles').select('id').limit(1);
    }
  } catch (err: any) {
    if (err.message && err.message.includes('ECONNREFUSED')) {
      console.warn('[Migration] Direct database connection blocked (IPv6). Automatic migrations skipped. Please apply SUPABASE_SETUP.sql manually in your Supabase dashboard.');
      if (isManual) {
        throw new Error("Direct database connection blocked. Please copy the contents of SUPABASE_SETUP.sql and run it manually in the Supabase dashboard SQL editor.");
      }
      return;
    }
    
    if (err.message && (err.message.includes('password authentication failed') || err.message.includes('terminating connection due to administrator command'))) {
      console.error('[Migration] Authentication failed for DATABASE_URL. Please verify your Supabase database password is correct.');
      console.error('[Migration] Tip: If your password contains special characters like @, #, or :, ensure it is URL-encoded in the connection string.');
    } else {
      console.error('[Migration] Failed to execute migrations:', err.message);
    }
    
    if (isManual) throw err;
  } finally {
    try {
      await sql.end();
    } catch (e) {
      // Ignore end errors
    }
  }
}

export const app = express();

  // Run migrations in background to prevent blocking server startup
  runMigrations(false).catch(err => {
    // Only log, don't crash
  });

  // Supabase Admin Client
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.DATABASE_URL;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('CRITICAL: Supabase environment variables missing (VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
  }

  // Global Postgres Pool (Singleton)
  // We initialize this once to avoid "Too many connections" errors upon rapid refresh
  const globalSql = (dbUrl && !dbUrl.includes('your-database-url') && (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')))
    ? postgres(dbUrl, { 
        ssl: 'require', 
        max: 5, // Small pool for stability
        idle_timeout: 20,
        connect_timeout: 10
      })
    : null;

  const supabaseAdmin = (supabaseUrl && serviceRoleKey) 
    ? createClient(supabaseUrl, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      })
    : null;

  app.use(express.json());

  app.post('/api/admin/refresh-schema', async (req, res) => {
    if (!globalSql) return res.status(503).json({ error: 'Postgres direct connection not configured or unavailable' });
    
    try {
      await globalSql`NOTIFY pgrst, 'reload schema';`;
      res.json({ message: 'Success: Schema reload signal sent to PostgREST' });
    } catch (err: any) {
      if (err.message && err.message.includes('authentication')) {
        res.status(401).json({ error: 'Postgres authentication failed. Check your password.' });
      } else {
        res.status(500).json({ error: err.message });
      }
    }
  });

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      backend: !!supabaseAdmin,
      config: {
        url: !!supabaseUrl,
        serviceKey: !!serviceRoleKey,
        anonKey: !!process.env.VITE_SUPABASE_ANON_KEY
      }
    });
  });

  // User Profile Sync (Bypasses Client RLS using Admin SDK)
  app.post('/api/auth/profile/sync', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing auth header' });
    const token = authHeader.split(' ')[1];
    
    if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase admin SDK not available' });

    try {
      // Verify token
      const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: 'Invalid auth token' });

      const { userId, username, email, isMasterAdmin } = req.body;
      
      // Ensure users can only sync their own profile
      if (user.id !== userId) return res.status(403).json({ error: 'User ID mismatch' });

      // Upsert profile - using service role key, this will ignore RLS!
      const { data: newProfile, error: upsertError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          username,
          email: email || '',
          role: isMasterAdmin ? 'admin' : 'user'
        }, { onConflict: 'id' })
        .select()
        .single();
        
      if (upsertError) {
        // Fallback if email column missing
        if (upsertError.code === 'PGRST204') {
          const { data: fallback, error: fallbackErr } = await supabaseAdmin
            .from('profiles')
            .upsert({
              id: userId,
              username,
              role: isMasterAdmin ? 'admin' : 'user'
            }, { onConflict: 'id' })
            .select()
            .single();
          if (fallbackErr) throw fallbackErr;
          return res.json({ profile: fallback });
        }
        throw upsertError;
      }
      
      res.json({ profile: newProfile });
    } catch (e: any) {
      console.error('Profile sync error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/admin/sync-db', async (req, res) => {
    try {
      await runMigrations(true);
      res.json({ message: 'Database sync and schema reload completed' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin User Management Routes
  app.post('/api/login', async (req, res) => {
    if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase backend not configured. Check secrets.' });
    const { username } = req.body;
    try {
      // Try to select email, but fallback if column is missing
      let { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('email, id')
        .eq('username', username)
        .maybeSingle();
      
      if (error && error.message.includes('column') && error.message.includes('email')) {
        // Fallback for older schema
        const { data: fallback, error: fallbackErr } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('username', username)
          .maybeSingle();
        
        if (fallbackErr || !fallback) {
          return res.status(404).json({ error: `User profile not found for "${username}".` });
        }

        // Get email from Auth
        const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.getUserById(fallback.id);
        if (authErr || !authUser.user) {
          return res.status(404).json({ error: 'Auth user not found.' });
        }
        
        return res.json({ email: authUser.user.email });
      }

      if (error || !profile) {
        console.error(`[Login] Profile search failed for "${username}":`, error?.message || 'Not found');
        return res.status(404).json({ error: `User profile not found for "${username}". Did you run Setup?` });
      }

      // If email is null in DB (older rows but column exists), grab it from auth
      if (!profile.email && profile.id) {
        const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.getUserById(profile.id);
        if (authErr || !authUser.user) {
          return res.status(404).json({ error: 'Auth user not found (missing email).' });
        }
        return res.json({ email: authUser.user.email });
      }

      res.json({ email: profile.email });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/setup/admin', async (req, res) => {
    console.log('[Setup] Starting Master Admin setup...');
    
    // Check if variables are truly present
    const sUrl = process.env.VITE_SUPABASE_URL;
    const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!sUrl || !sKey || !supabaseAdmin) {
      return res.status(503).json({ error: 'Supabase URL or Service Role Key missing in environment variables.' });
    }
    
    try {
      const username = 'admin';
      const password = 'admin123';
      const email = `admin@validpro.internal`;

      // 1. Diagnostics
      const { error: tableError } = await supabaseAdmin.from('profiles').select('id').limit(1);
      if (tableError && tableError.message.includes('profiles') && tableError.message.includes('exist')) {
        return res.status(500).json({ error: `Table "profiles" missing. Run SQL setup.` });
      }

      // 2. Create/Get Auth User
      let userId: string;
      const { data: newUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

      if (authError) {
        const isConflict = authError.status === 422 || authError.message.toLowerCase().includes('registered');
        if (isConflict) {
          const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
          if (listErr) throw listErr;
          
          const match = list.users.find(u => (u as any).email === email);
          if (!match) throw new Error('Auth conflict but user not found in list.');
          
          userId = match.id;
          await supabaseAdmin.auth.admin.updateUserById(userId, { password });
        } else {
          throw authError;
        }
      } else {
        userId = newUser.user.id;
      }

      // 3. Profiles Cleanup (Crucial)
      // Delete any profile using our username but a DIFFERENT ID
      const { error: cleanupErr } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('username', username)
        .neq('id', userId);
      
      if (cleanupErr) console.warn('[Setup] Cleanup warning:', cleanupErr.message);

      // 4. Upsert Profile
      // Check if email column exists (backward compatibility for different template versions)
      const { error: checkEmailErr } = await supabaseAdmin.from('profiles').select('email').limit(1);
      
      const payload: any = { id: userId, username, role: 'admin' };
      if (!checkEmailErr) payload.email = email;

      console.log('[Setup] Persisting profile for ID:', userId);
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .maybeSingle();

      if (profileError) {
        console.error('[Setup] Profile persistence failed:', profileError);
        throw profileError;
      }

      // Final Verification
      const { data: verify, error: verifyError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle();
      
      if (verifyError || !verify) {
        throw new Error('Profile was saved but retrieval failed during verification.');
      }

      console.log('[Setup] Successfully set up admin profile:', verify.id);
      return res.json({ message: 'Master Admin account is ready!' });

    } catch (error: any) {
      console.error('[Setup] Failure:', error);
      return res.status(error.status || 400).json({ error: error.message || 'Setup failed' });
    }
  });

  app.post('/api/admin/users', async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase admin client not initialized' });
    
    const { username, password, role, email } = req.body;
    
    try {
      // 1. Create Auth User
      // Sanitize username for email if no email provided
      const sanitizedUsername = username.toLowerCase().replace(/[^a-z0-9]/g, '');
      const userEmail = email || `${sanitizedUsername}@validpro.internal`;

      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: userEmail,
        password: password,
        email_confirm: true,
        user_metadata: { username }
      });

      if (authError) {
        console.error('[Admin] Auth User creation failed:', authError);
        throw authError;
      }

      // 2. Create/Update Profile
      // Using upsert instead of insert because a trigger on auth.users might have already created it
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: authUser.user.id,
          username,
          email: userEmail,
          role: role || 'user'
        }, { onConflict: 'id' });

      if (profileError) {
        console.error('[Admin] Profile creation failed:', profileError);
        if (profileError.code === 'PGRST204') {
          // Schema cache stale, fallback
          const { error: fallbackErr } = await supabaseAdmin
            .from('profiles')
            .upsert({
              id: authUser.user.id,
              username,
              role: role || 'user'
            }, { onConflict: 'id' });
          if (fallbackErr) throw fallbackErr;
        } else {
          throw profileError;
        }
      }

      res.json({ message: 'User created successfully', user: authUser.user });
    } catch (error: any) {
      console.error('[Admin] Create user internal error:', error);
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/admin/users/:id', async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase admin client not initialized' });
    
    const { id } = req.params;
    
    try {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (error) throw error;
      
      // Profiles table should have Cascade delete or manual cleanup
      await supabaseAdmin.from('profiles').delete().eq('id', id);

      res.json({ message: 'User deleted successfully' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch('/api/admin/users/:id/role', async (req, res) => {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase admin client not initialized' });
    
    const { id } = req.params;
    const { role } = req.body;
    
    try {
      const { error } = await supabaseAdmin
        .from('profiles')
        .update({ role })
        .eq('id', id);
        
      if (error) throw error;
      res.json({ message: 'User role updated successfully' });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/admin/db-check', async (req, res) => {
    if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase admin client missing' });
    
    const dbReport: any = {
      supabaseApi: 'checking',
      postgresDirect: 'checking',
      healthy: true,
      needsSync: false,
      details: []
    };

    try {
      // 1. Test Supabase API
      const { data: apiTest, error: apiError } = await supabaseAdmin.from('profiles').select('id').limit(1);
      if (apiError && !apiError.message.includes('JSON object')) {
        dbReport.supabaseApi = 'failed';
        dbReport.healthy = false;
        dbReport.details.push(`Supabase API Error: ${apiError.message}`);
      } else {
        dbReport.supabaseApi = 'working';
      }

      // 2. Test Direct Postgres
      if (!globalSql) {
        dbReport.postgresDirect = 'missing_env_var_or_failed';
        dbReport.healthy = false;
      } else {
        try {
          await globalSql`SELECT 1`;
          dbReport.postgresDirect = 'working';
        } catch (pgErr: any) {
          dbReport.postgresDirect = 'failed';
          dbReport.healthy = false;
          if (pgErr.message && pgErr.message.includes('authentication')) {
            dbReport.details.push('Postgres Auth Failed: Check your DATABASE_URL password.');
            dbReport.details.push('Tip: URL-encode special characters in your password.');
          } else {
            dbReport.details.push(`Postgres Connection Error: ${pgErr.message}`);
          }
        }
      }

      // 3. Schema Check logic
      const sqlToRun: string[] = [];
      const { error: valError } = await supabaseAdmin
        .from('student_validations')
        .select('id, dob, address, father_name, status, mic_on, video_on, student_code, student_name, ae_name, center_code, batch_code, validated_by, remarks')
        .limit(1);
      
      if (valError && (valError.message.includes('column') || valError.message.includes('exist'))) {
        dbReport.needsSync = true;
        sqlToRun.push(`ALTER TABLE public.student_validations ADD COLUMN IF NOT EXISTS student_code TEXT;
ALTER TABLE public.student_validations ADD COLUMN IF NOT EXISTS student_name TEXT;
ALTER TABLE public.student_validations ADD COLUMN IF NOT EXISTS ae_name TEXT;
ALTER TABLE public.student_validations ADD COLUMN IF NOT EXISTS center_code TEXT;
ALTER TABLE public.student_validations ADD COLUMN IF NOT EXISTS batch_code TEXT;
ALTER TABLE public.student_validations ADD COLUMN IF NOT EXISTS validated_by TEXT;
ALTER TABLE public.student_validations ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.student_validations ADD COLUMN IF NOT EXISTS dob TEXT;
ALTER TABLE public.student_validations ADD COLUMN IF NOT EXISTS father_name TEXT;
ALTER TABLE public.student_validations ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.student_validations ADD COLUMN IF NOT EXISTS mic_on BOOLEAN DEFAULT false;
ALTER TABLE public.student_validations ADD COLUMN IF NOT EXISTS video_on BOOLEAN DEFAULT false;
ALTER TABLE public.student_validations ALTER COLUMN status TYPE TEXT;
ALTER TABLE public.student_validations ALTER COLUMN validated_by TYPE TEXT USING validated_by::TEXT;`);
      }

      const { error: profError } = await supabaseAdmin.from('profiles').select('email').limit(1);
      if (profError && (profError.message.includes('column') || profError.message.includes('exist'))) {
        dbReport.needsSync = true;
        sqlToRun.push(`ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
UPDATE public.profiles SET email = 'admin@validpro.internal' WHERE username = 'admin' AND email IS NULL;`);
      }

      dbReport.sql = sqlToRun.join('\n\n');
      res.json(dbReport);
    } catch (error: any) {
      res.status(500).json({ healthy: false, error: error.message, report: dbReport });
    }
  });

  app.get('/api/batch_data', async (req, res) => {
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Supabase client not initialized' });
      }
      
      const limit = 1000;
      const pages = [0, 1, 2, 3, 4, 5, 6, 7]; // Up to 8000 records
      
      const results = await Promise.all(pages.map(page => {
        const from = page * limit;
        return supabaseAdmin
          .from('batch_students')
          .select('id, ae_name, center_code, batch_code, student_code, student_name, mobile_no, dob, father_name, address, batch_status, created_at')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, from + limit - 1);
      }));

      let allData: any[] = [];
      for (const res of results) {
        if (res.error) throw res.error;
        if (res.data) allData = [...allData, ...res.data];
        if (res.data && res.data.length < limit) break;
      }
      
      // Ensure absolute sorting after parallel fetch combining
      allData.sort((a, b) => {
        const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (timeDiff !== 0) return timeDiff;
        return (b.id || 0) - (a.id || 0); // fallback to id desc
      });
      
      res.json(allData);
    } catch (error: any) {
      console.error('Error in /api/batch_data:', error.message);
      res.status(500).json({ error: error.message || 'Failed to fetch batch data' });
    }
  });

  app.get('/api/admin/all_validations', async (req, res) => {
    try {
      if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase admin SDK not available' });
      
      const limit = 1000;
      const pages = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; // Up to 10k validations
      
      const results = await Promise.all(pages.map(page => {
        const from = page * limit;
        return supabaseAdmin
          .from('student_validations')
          .select('*')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, from + limit - 1);
      }));

      let allData: any[] = [];
      for (const res of results) {
        if (res.error) throw res.error;
        if (res.data) allData = [...allData, ...res.data];
        if (res.data && res.data.length < limit) break;
      }

      allData.sort((a, b) => {
        const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        if (timeDiff !== 0) return timeDiff;
        return (b.id || 0) - (a.id || 0);
      });
      res.json(allData);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/batch_stats', async (req, res) => {
    const dbUrl = process.env.DATABASE_URL;
    
    // Fallback logic using Supabase Admin SDK if Postgres Direct is unavailable/failed
    const fallbackStats = async () => {
      if (!supabaseAdmin) throw new Error('Supabase admin client not initialized');
      
      console.log('[Stats] Using Supabase SDK fallback for batch_stats...');
      
      // Fetch data in batches if needed
      const { data: students, error: sErr } = await supabaseAdmin
        .from('batch_students')
        .select('batch_code, student_code, batch_status');
      
      if (sErr) throw sErr;

      const { data: validations, error: vErr } = await supabaseAdmin
        .from('student_validations')
        .select('batch_code, student_code, status');
      
      if (vErr) throw vErr;

      // Group students by batch
      const batchMap: Record<string, { totalSet: Set<string>, validatedSet: Set<string> }> = {};
      
      students?.forEach((row: any) => {
        if (!batchMap[row.batch_code]) {
          batchMap[row.batch_code] = { totalSet: new Set(), validatedSet: new Set() };
        }
        batchMap[row.batch_code].totalSet.add(row.student_code);
      });

      validations?.forEach((row: any) => {
        // We only care about validated statuses
        if (!batchMap[row.batch_code]) {
           batchMap[row.batch_code] = { totalSet: new Set(), validatedSet: new Set() };
        }
        
        const status = (row.status || '').toLowerCase();
        if (status === 'validated' || status === 'revalidated') {
          batchMap[row.batch_code].validatedSet.add(row.student_code);
        }
      });

      const stats: Record<string, { total: number, validated: number, pending: number }> = {};
      
      Object.keys(batchMap).forEach(code => {
        const total = batchMap[code].totalSet.size;
        const validated = batchMap[code].validatedSet.size;
        stats[code] = {
          total: total,
          validated: validated,
          pending: Math.max(0, total - validated)
        };
      });

      return stats;
    };

    if (!globalSql) {
      try {
        const stats = await fallbackStats();
        return res.json(stats);
      } catch (err: any) {
        return res.status(500).json({ error: 'DATABASE_URL is not configured and fallback failed: ' + err.message });
      }
    }
    
    try {
      // Use raw SQL for lightning fast aggregation with DISTINCT to avoid duplicate counts
      const [students, validations] = await Promise.all([
        globalSql`
          SELECT batch_code, count(DISTINCT student_code)::int as total 
          FROM public.batch_students 
          GROUP BY batch_code
        `,
        globalSql`
          SELECT batch_code, count(DISTINCT student_code)::int as validated
          FROM public.student_validations 
          WHERE LOWER(status) IN ('validated', 'revalidated')
          GROUP BY batch_code
        `
      ]);

      const stats: Record<string, { total: number, validated: number, pending: number }> = {};
      
      students.forEach((row: any) => {
        stats[row.batch_code] = { total: row.total, validated: 0, pending: row.total };
      });

      validations.forEach((row: any) => {
        if (!stats[row.batch_code]) {
          // If a batch has validations but isn't marked as "running" in batch_students, 
          // we should still reflect its validated count
          stats[row.batch_code] = { total: row.validated, validated: row.validated, pending: 0 };
        } else {
          stats[row.batch_code].validated = row.validated;
          stats[row.batch_code].pending = Math.max(0, stats[row.batch_code].total - row.validated);
        }
      });

      res.json(stats);
    } catch (error: any) {
      console.error('Error in /api/batch_stats (direct postgres):', error.message);
      
      // Specific handling for auth failure or connection issues
      if (error.message && (error.message.includes('authentication') || error.message.includes('timeout') || error.message.includes('ECONNREFUSED'))) {
        try {
          const stats = await fallbackStats();
          return res.json(stats);
        } catch (fallbackError: any) {
          console.error('Batch stats fallback also failed:', fallbackError.message);
          return res.status(500).json({ error: 'Postgres failed and fallback failed: ' + fallbackError.message });
        }
      }
      
      res.status(500).json({ error: error.message || 'Failed to fetch batch stats' });
    }
  });

  // Vite middleware for development or fallback static serving
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Check missing paths and serve index.html (SPA fallback)
    app.get('*', (req, res) => {
      // Only serve index.html for non-API routes
      if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(distPath, 'index.html'));
      } else {
        res.status(404).json({ error: 'API route not found' });
      }
    });
  }

  // Only listen to port if not running in Vercel. Vercel provides process.env.VERCEL
  if (!process.env.VERCEL) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
}

setupServer();

export default app;
