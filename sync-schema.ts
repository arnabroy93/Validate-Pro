import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.includes('your-database-url') || !dbUrl.startsWith('postgres') || dbUrl.includes('your-password')) {
    console.log("DATABASE_URL is not configured or using placeholder. Skipping automatic schema sync.");
    return;
  }

  const sql = postgres(dbUrl, { ssl: 'require' });
  try {
    console.log("Checking columns in profiles table...");
    const columns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'profiles';
    `;
    console.log("Current columns:", columns.map(c => c.column_name).join(', '));

    console.log("Adding email column if missing...");
    await sql`ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;`;
    
    console.log("Adding mobile_no column to batch_students if missing...");
    await sql`ALTER TABLE public.batch_students ADD COLUMN IF NOT EXISTS mobile_no TEXT;`;
    
    console.log("Adding mobile_no column to student_validations if missing...");
    await sql`ALTER TABLE public.student_validations ADD COLUMN IF NOT EXISTS mobile_no TEXT;`;
    
    console.log("Notifying PostgREST to reload schema...");
    await sql`NOTIFY pgrst, 'reload schema';`;
    
    console.log("Schema reload triggered successfully.");
  } catch (err: any) {
    if (err.message && (err.message.includes('password authentication failed') || err.message.includes('terminating connection due to administrator command'))) {
      console.log("Database connection could not authenticate. Please double check that password matches. Schema update skipped.");
    } else {
      console.log("Error in automatic schema sync:", err.message || err);
    }
  } finally {
    await sql.end();
  }
}

run();
