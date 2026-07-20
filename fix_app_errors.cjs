const fs = require('fs');

let featuresCode = fs.readFileSync('src/hooks/useFeatures.tsx', 'utf8');
featuresCode = featuresCode.replace(/from '\.\.\/supabase'/, "from '../../supabase'");
fs.writeFileSync('src/hooks/useFeatures.tsx', featuresCode);

let appCode = fs.readFileSync('src/App.tsx', 'utf8');
const navStart = `function Navigation({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: string) => void }) {
  const { profile, signOut } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const { features } = useFeatures();`;
  
appCode = appCode.replace(/function Navigation\(\{ activeTab, setActiveTab \}: \{ activeTab: string, setActiveTab: \(tab: string\) => void \}\) \{\n\s*const \{ profile, signOut \} = useAuth\(\);\n\s*const isAdmin = profile\?\.role === 'admin';/, navStart);

appCode = appCode.replace(/import \{ LayoutDashboard, /, "import { LayoutDashboard, Settings, ");

fs.writeFileSync('src/App.tsx', appCode);
