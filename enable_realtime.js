import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const dbUrl = process.env.VITE_SUPABASE_DB_URL || process.env.DATABASE_URL;
const sql = postgres(dbUrl, { ssl: 'require' });

async function run() {
    try {
        await sql`ALTER PUBLICATION supabase_realtime ADD TABLE public.app_settings;`;
        console.log("Realtime enabled");
    } catch(e) {
        console.error("Error:", e);
    } finally {
        process.exit(0);
    }
}
run();
