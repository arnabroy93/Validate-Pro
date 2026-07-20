import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const dbUrl = process.env.VITE_SUPABASE_DB_URL || process.env.DATABASE_URL;
const sql = postgres(dbUrl, { ssl: 'require' });

async function run() {
    try {
        const result = await sql`SELECT * FROM public.app_settings`;
        console.log("Success:", result);
    } catch(e) {
        console.error("Error:", e);
    } finally {
        process.exit(0);
    }
}
run();
