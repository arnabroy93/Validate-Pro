const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const endpoints = `
  app.get('/api/settings/features', async (req, res) => {
    try {
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase admin client missing' });
      const { data, error } = await supabaseAdmin.from('app_settings').select('value').eq('id', 'feature_flags').single();
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is no rows
      res.json(data?.value || {});
    } catch(err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/settings/features', async (req, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader) return res.status(401).json({ error: 'Missing authorization' });
      const token = authHeader.replace('Bearer ', '');
      if (!supabaseAdmin) return res.status(503).json({ error: 'Supabase admin client missing' });
      
      const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
      if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });
      
      // verify admin
      const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('id', user.id).single();
      if (profile?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
      
      const features = req.body;
      const { error } = await supabaseAdmin.from('app_settings').upsert({ id: 'feature_flags', value: features });
      if (error) throw error;
      
      res.json({ success: true });
    } catch(err) {
      res.status(500).json({ error: err.message });
    }
  });
`;

code = code.replace("app.get(['/api/powerbi/summary'", endpoints + "\n  app.get(['/api/powerbi/summary'");
fs.writeFileSync('server.ts', code);
