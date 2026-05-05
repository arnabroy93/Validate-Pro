-- 1. Profiles Table (Linked to Auth Users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Ensure email column exists if the table was created previously without it
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;


-- 2. Student Validations Table
ALTER TABLE IF EXISTS public.student_validations DROP CONSTRAINT IF EXISTS student_validations_id_fkey;

CREATE TABLE IF NOT EXISTS public.student_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_code TEXT,
  student_name TEXT,
  mobile_no TEXT,
  ae_name TEXT,
  center_code TEXT,
  batch_code TEXT,
  dob TEXT,
  father_name TEXT,
  address TEXT,
  aligned_ae TEXT,
  validated_by TEXT,
  status TEXT DEFAULT 'Pending',
  remarks TEXT,
  mic_on BOOLEAN DEFAULT false,
  video_on BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  UNIQUE(batch_code, student_code)
);

-- 3. Batch Students Table
CREATE TABLE IF NOT EXISTS public.batch_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ae_name TEXT,
  center_code TEXT,
  batch_code TEXT,
  student_code TEXT,
  student_name TEXT,
  mobile_no TEXT,
  dob TEXT,
  father_name TEXT,
  address TEXT,
  batch_status TEXT,
  batch_start_date TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 4. System Backups Table
CREATE TABLE IF NOT EXISTS public.system_backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_name TEXT NOT NULL,
  admin_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow admins to see everything, allow users to see their own entries
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_students ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 4. Policies
-- Profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile." ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile." ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Service role bypass" ON public.profiles
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Batch Students Policies
DROP POLICY IF EXISTS "Anyone can view batch students" ON public.batch_students;
CREATE POLICY "Anyone can view batch students" ON public.batch_students FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage batch students" ON public.batch_students;
CREATE POLICY "Admins can manage batch students" ON public.batch_students FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 5. Trigger for automatic profile creation
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Student Validations Policies
CREATE POLICY "Users can view validations" ON public.student_validations
  FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can insert validations" ON public.student_validations
  FOR INSERT WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Users can update validations" ON public.student_validations
  FOR UPDATE USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins manage all" ON public.student_validations
  FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
