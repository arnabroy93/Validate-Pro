import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const dbUrl = process.env.VITE_SUPABASE_DB_URL || process.env.DATABASE_URL;
const sql = postgres(dbUrl, { ssl: 'require' });

async function run() {
    try {
        await sql`ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;`;
        await sql`
            CREATE POLICY "Allow public read access" ON public.app_settings
            FOR SELECT USING (true);
        `;
        console.log("RLS policy created");
    } catch(e) {
        console.error("Error:", e);
    } finally {
        process.exit(0);
    }
}
run();
