import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config();

const dbUrl = process.env.VITE_SUPABASE_DB_URL || process.env.DATABASE_URL;
const sql = postgres(dbUrl, { ssl: 'require' });

async function run() {
    try {
        await sql`
            CREATE TABLE IF NOT EXISTS public.app_settings (
                id TEXT PRIMARY KEY,
                value JSONB NOT NULL
            );
        `;
        // Insert a default row for feature flags
        const defaultFlags = {
            validation: true,
            records: true,
            reports: true,
            insights: true,
            global_insights: true,
            users: true,
            user_activity: true,
            health: true,
            powerbi: true,
            upload_logs: true
        };
        await sql`
            INSERT INTO public.app_settings (id, value)
            VALUES ('feature_flags', ${sql.json(defaultFlags)})
            ON CONFLICT (id) DO NOTHING;
        `;
        
        await sql`GRANT ALL ON TABLE public.app_settings TO postgres, anon, authenticated, service_role;`;

        console.log("Settings created successfully.");
    } catch(e) {
        console.error("Error:", e);
    } finally {
        process.exit(0);
    }
}
run();
