import express from 'express';
import { createServer as createViteServer } from 'vite';
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
    if (err.message && (err.message.includes('ECONNREFUSED') || err.message.includes('ETIMEDOUT'))) {
      console.warn('[Migration] Direct database connection blocked or timed out (likely network/IPv6 restriction). Automatic migrations skipped. Apply SUPABASE_SETUP.sql manually if needed.');
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Run migrations in background to prevent blocking server startup
  runMigrations(false).catch(err => {
    // Only log, don't crash
  });

  // Supabase Admin Client
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const dbUrl = process.env.DATABASE_URL;
  
  let preferSdk = false;

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
        connect_timeout: 5
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
          } else if (pgErr.message && (pgErr.message.includes('ECONNREFUSED') || pgErr.message.includes('ETIMEDOUT') || pgErr.message.includes('timeout'))) {
            dbReport.details.push('Postgres Connection Blocked/Timed Out (IPv6/Network Restriction).');
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

  const fetchAllFromSupabase = async (
    table: string, 
    select: string, 
    match?: Record<string, string>
  ) => {
    let allData: any[] = [];
    let from = 0;
    const limit = 1000;
    let hasMore = true;
    while (hasMore) {
      if (!supabaseAdmin) break;
      let query = supabaseAdmin.from(table).select(select).range(from, from + limit - 1);
      if (match) {
        Object.entries(match).forEach(([k, v]) => {
          query = query.ilike(k, v);
        });
      }
      const { data, error } = await query;
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

  app.get('/api/filters/options', async (req, res) => {
    try {
      if (!supabaseAdmin) {
        console.error('[Filters] Supabase admin not initialized');
        return res.status(500).json({ error: 'Supabase admin client not initialized' });
      }
      
      if (globalSql && !preferSdk) {
        try {
          const centers = await globalSql`SELECT DISTINCT center_code FROM public.batch_students ORDER BY center_code ASC`;
          const batches = await globalSql`SELECT DISTINCT batch_code, center_code FROM public.batch_students WHERE LOWER(batch_status) = 'running' ORDER BY batch_code ASC`;
          return res.json({ centers: centers.map(r => r.center_code), batches: batches });
        } catch (sqlErr: any) {
          if (sqlErr.message && (sqlErr.message.includes('ECONNREFUSED') || sqlErr.message.includes('ETIMEDOUT'))) {
            preferSdk = true;
          }
          console.error('[Filters] Postgres query failed, trying SDK:', sqlErr.message);
        }
      }

      // SDK Fallback - using limited selects to stay fast
      const [cData, bData] = await Promise.all([
        fetchAllFromSupabase('batch_students', 'center_code'),
        fetchAllFromSupabase('batch_students', 'batch_code, center_code', { batch_status: 'running' })
      ]);

      const uniqueCenters = Array.from(new Set(cData?.map(c => c.center_code))).filter(Boolean).sort();
      
      // Deduplicate batches
      const batchMap = new Map();
      bData?.forEach(b => {
        const key = `${b.batch_code}_${b.center_code}`;
        if (!batchMap.has(key)) {
          batchMap.set(key, b);
        }
      });
      const uniqueBatches = Array.from(batchMap.values()).sort((a, b) => a.batch_code.localeCompare(b.batch_code));

      res.json({ centers: uniqueCenters, batches: uniqueBatches });
    } catch (error: any) {
      console.error('[Filters] Fatal error:', error.message);
      res.status(500).json({ error: error.message || 'Failed to fetch filters' });
    }
  });

  app.get('/api/batch_students/filter', async (req, res) => {
    const { center_code, batch_code } = req.query;
    if (!center_code || !batch_code) {
      return res.status(400).json({ error: 'center_code and batch_code are required' });
    }

    try {
      if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase admin client not initialized' });

      const data = await fetchAllFromSupabase('batch_students', '*', {
        center_code: String(center_code),
        batch_code: String(batch_code),
        batch_status: 'running'
      });
      data.sort((a, b) => (a.student_name || '').localeCompare(b.student_name || ''));

      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/admin/batch_activity', async (req, res) => {
    try {
      if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase admin client not initialized' });

      if (globalSql && !preferSdk) {
        try {
          const activity = await globalSql`
            SELECT 
              v.batch_code,
              string_agg(DISTINCT v.validated_by, ', ') as validated_by,
              MAX(v.created_at) as created_at
            FROM public.student_validations v
            GROUP BY v.batch_code
            ORDER BY created_at DESC
          `;
          return res.json(activity);
        } catch (sqlErr: any) {
          if (sqlErr.message && (sqlErr.message.includes('ECONNREFUSED') || sqlErr.message.includes('ETIMEDOUT'))) {
            preferSdk = true;
          }
          console.warn('[Activity] Postgres failed, trying SDK:', sqlErr.message);
        }
      }

      // Fallback
      const data = await fetchAllFromSupabase('student_validations', 'batch_code, validated_by, created_at');

      const grouped = new Map();
      data?.forEach(v => {
        if (!grouped.has(v.batch_code)) {
          grouped.set(v.batch_code, { 
            batch_code: v.batch_code, 
            validated_by_set: new Set(v.validated_by ? [v.validated_by] : []),
            created_at: v.created_at 
          });
        } else {
          const g = grouped.get(v.batch_code);
          if (v.validated_by) g.validated_by_set.add(v.validated_by);
          if (new Date(v.created_at) > new Date(g.created_at)) g.created_at = v.created_at;
        }
      });

      const result = Array.from(grouped.values()).map(g => ({
        batch_code: g.batch_code,
        validated_by: Array.from(g.validated_by_set).join(', '),
        created_at: g.created_at
      }));

      res.json(result.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/reports/batch_summary', async (req, res) => {
    try {
      if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase admin client not initialized' });

      if (globalSql && !preferSdk) {
        // Optimized heavy lift using raw SQL
        try {
          const summary = await globalSql`
            WITH student_counts AS (
              SELECT 
                center_code, 
                batch_code, 
                COUNT(DISTINCT student_code) as total_students,
                MAX(created_at) as latest_batch_time
              FROM public.batch_students
              GROUP BY center_code, batch_code
            ),
            validation_counts AS (
              SELECT 
                center_code, 
                batch_code,
                COUNT(CASE WHEN LOWER(status) = 'validated' THEN 1 END) as validated,
                COUNT(CASE WHEN LOWER(status) = 'revalidated' THEN 1 END) as revalidated,
                COUNT(CASE WHEN LOWER(status) = 'absent' THEN 1 END) as absent,
                COUNT(CASE WHEN LOWER(status) = 'rejected' THEN 1 END) as rejected,
                MAX(created_at) as latest_val_time
              FROM public.student_validations
              GROUP BY center_code, batch_code
            )
            SELECT 
              s.center_code,
              s.batch_code,
              s.total_students::int,
              COALESCE(v.validated, 0)::int as validated,
              COALESCE(v.revalidated, 0)::int as revalidated,
              COALESCE(v.absent, 0)::int as absent,
              COALESCE(v.rejected, 0)::int as rejected,
              GREATEST(s.latest_batch_time, v.latest_val_time) as latest_timestamp
            FROM student_counts s
            LEFT JOIN validation_counts v ON s.center_code = v.center_code AND s.batch_code = v.batch_code
            ORDER BY latest_timestamp DESC NULLS LAST
          `;
          
          const finalSummary = summary.map(s => ({
            ...s,
            pending: Math.max(0, s.total_students - (s.validated + s.revalidated + s.absent + s.rejected))
          }));
          
          return res.json(finalSummary);
        } catch (sqlErr: any) {
          if (sqlErr.message && (sqlErr.message.includes('ECONNREFUSED') || sqlErr.message.includes('ETIMEDOUT'))) {
            preferSdk = true;
          }
          console.warn('[Summary] Postgres failed, trying SDK:', sqlErr.message);
        }
      }

      // Fallback: If no direct SQL, we might need a more complex SDK approach or simplified version
      // For brevity and considering the "fast" requirement, I'll recommend using direct SQL.
      // But if direct SQL is failing due to IPv6, we need a reliable fallback.
      
      const [bData, vData] = await Promise.all([
        fetchAllFromSupabase('batch_students', 'center_code, batch_code, student_code'),
        fetchAllFromSupabase('student_validations', 'center_code, batch_code, student_code, status, created_at')
      ]);

      // Grouping logic in JS (less efficient than SQL but works as fallback)
      const summaryMap = new Map<string, any>();
      
      bData?.forEach(s => {
        const key = `${s.center_code}_${s.batch_code}`;
        if (!summaryMap.has(key)) {
          summaryMap.set(key, { center_code: s.center_code, batch_code: s.batch_code, total_set: new Set(), validated: 0, revalidated: 0, absent: 0, rejected: 0, latest_timestamp: null });
        }
        summaryMap.get(key).total_set.add(s.student_code);
      });

      vData?.forEach(v => {
        const key = `${v.center_code}_${v.batch_code}`;
        if (!summaryMap.has(key)) {
          summaryMap.set(key, { center_code: v.center_code, batch_code: v.batch_code, total_set: new Set(), validated: 0, revalidated: 0, absent: 0, rejected: 0, latest_timestamp: v.created_at });
        }
        const s = summaryMap.get(key);
        const status = (v.status || '').toLowerCase();
        if (status === 'validated') s.validated++;
        else if (status === 'revalidated') s.revalidated++;
        else if (status === 'absent') s.absent++;
        else if (status === 'rejected') s.rejected++;
        
        if (!s.latest_timestamp || new Date(v.created_at) > new Date(s.latest_timestamp)) {
          s.latest_timestamp = v.created_at;
        }
      });

      const result = Array.from(summaryMap.values()).map(s => ({
        ...s,
        total_students: s.total_set.size,
        pending: Math.max(0, s.total_set.size - (s.validated + s.revalidated + s.absent + s.rejected))
      }));

      res.json(result.sort((a, b) => new Date(b.latest_timestamp).getTime() - new Date(a.latest_timestamp).getTime()));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/batch_data', async (req, res) => {
    try {
      if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Supabase client not initialized' });
      }
      
      const allData = await fetchAllFromSupabase(
        'batch_students', 
        'id, ae_name, center_code, batch_code, student_code, student_name, mobile_no, dob, father_name, address, batch_status, created_at'
      );
      
      // Ensure absolute sorting
      allData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      res.json(allData);
    } catch (error: any) {
      console.error('Error in /api/batch_data:', error.message);
      res.status(500).json({ error: error.message || 'Failed to fetch batch data' });
    }
  });

  app.get('/api/admin/all_validations', async (req, res) => {
    try {
      if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase admin SDK not available' });
      
      const data = await fetchAllFromSupabase('student_validations', '*');

      data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      res.json(data);
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
      
      const [students, validations] = await Promise.all([
        fetchAllFromSupabase('batch_students', 'batch_code, student_code, batch_status'),
        fetchAllFromSupabase('student_validations', 'batch_code, student_code, status')
      ]);

      // Group students by batch
      const batchMap: Record<string, { totalSet: Set<string>, validatedSet: Set<string> }> = {};
      
      students?.forEach((row: any) => {
        if ((row.batch_status || '').toLowerCase() === 'running') {
          if (!batchMap[row.batch_code]) {
            batchMap[row.batch_code] = { totalSet: new Set(), validatedSet: new Set() };
          }
          batchMap[row.batch_code].totalSet.add(row.student_code);
        }
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

    if (!globalSql || preferSdk) {
      try {
        const stats = await fallbackStats();
        return res.json(stats);
      } catch (err: any) {
        return res.status(500).json({ error: 'Postgres disabled/failed and fallback failed: ' + err.message });
      }
    }
    
    try {
      // Use raw SQL for lightning fast aggregation with DISTINCT to avoid duplicate counts
      const [students, validations] = await Promise.all([
        globalSql`
          SELECT batch_code, count(DISTINCT student_code)::int as total 
          FROM public.batch_students 
          WHERE LOWER(batch_status) = 'running' 
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
      // Specific handling for network, auth, or connection issues
      if (error.message && (
        error.message.includes('authentication') || 
        error.message.includes('timeout') || 
        error.message.includes('ECONNREFUSED') || 
        error.message.includes('ECONNRESET') ||
        error.message.includes('ETIMEDOUT')
      )) {
        console.warn(`[Stats] Postgres direct connection failed (${error.message}). Marking preferSdk = true.`);
        preferSdk = true;
        try {
          const stats = await fallbackStats();
          return res.json(stats);
        } catch (fallbackError: any) {
          console.error('Batch stats fallback also failed:', fallbackError.message);
          return res.status(500).json({ error: 'Postgres direct connection failed and fallback failed: ' + fallbackError.message });
        }
      }

      console.error('Error in /api/batch_stats (direct postgres):', error.message);
      res.status(500).json({ error: error.message || 'Failed to fetch batch stats' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
