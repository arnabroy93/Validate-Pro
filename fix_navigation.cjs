const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// First replace Navigation function parameters and hooks
const navRegex = /function Navigation\(\{ activeTab, setActiveTab \}: \{ activeTab: string, setActiveTab: \(tab: string\) => void \}\) \{\n  const \{ profile, signOut \} = useAuth\(\);\n  const isAdmin = profile\?\.role === 'admin';/;

const newNav = `function Navigation({ activeTab, setActiveTab }: { activeTab: string, setActiveTab: (tab: string) => void }) {
  const { profile, signOut } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const { features } = useFeatures();`;

code = code.replace(navRegex, newNav);

// Now conditionally wrap the buttons
// Insights
const insightsRegex = /<button\s+onClick=\{\(\) => setActiveTab\('insights'\)\}[\s\S]*?<\/button>/;
code = code.replace(insightsRegex, (match) => `{features.insights && (\n        ${match.split('\n').join('\n        ')}\n      )}`);

// Validation
const validationRegex = /<button\s+onClick=\{\(\) => \{\s+if \(activeTab === 'dashboard'\) \{\s+window.dispatchEvent\(new CustomEvent\('reset_validation'\)\);\s+\} else \{\s+setActiveTab\('dashboard'\);\s+\}\s+\}\}[\s\S]*?<\/button>/;
code = code.replace(validationRegex, (match) => `{features.validation && (\n        ${match.split('\n').join('\n        ')}\n      )}`);

// My Activity (records)
const recordsRegex = /<button\s+onClick=\{\(\) => setActiveTab\('records'\)\}[\s\S]*?<\/button>/;
code = code.replace(recordsRegex, (match) => `{features.records && (\n        ${match.split('\n').join('\n        ')}\n      )}`);

// Reports
const reportsRegex = /<button\s+onClick=\{\(\) => setActiveTab\('reports'\)\}[\s\S]*?<\/button>/;
code = code.replace(reportsRegex, (match) => `{features.reports && (\n        ${match.split('\n').join('\n        ')}\n      )}`);

// Global Insights
const globalInsightsRegex = /<button\s+onClick=\{\(\) => setActiveTab\('global_insights'\)\}[\s\S]*?<\/button>/;
code = code.replace(globalInsightsRegex, (match) => `{features.global_insights && (\n            ${match.split('\n').join('\n            ')}\n          )}`);

// Users
const usersRegex = /<button\s+onClick=\{\(\) => setActiveTab\('users'\)\}[\s\S]*?<\/button>/;
code = code.replace(usersRegex, (match) => `{features.users && (\n            ${match.split('\n').join('\n            ')}\n          )}`);

// User Activity
const userActivityRegex = /<button\s+onClick=\{\(\) => setActiveTab\('user_activity'\)\}[\s\S]*?<\/button>/;
code = code.replace(userActivityRegex, (match) => `{features.user_activity && (\n            ${match.split('\n').join('\n            ')}\n          )}`);

// Health
const healthRegex = /<button\s+onClick=\{\(\) => setActiveTab\('health'\)\}[\s\S]*?<\/button>/;
code = code.replace(healthRegex, (match) => `{features.health && (\n            ${match.split('\n').join('\n            ')}\n          )}`);

// PowerBI
const powerbiRegex = /<button\s+onClick=\{\(\) => setActiveTab\('powerbi'\)\}[\s\S]*?<\/button>/;
code = code.replace(powerbiRegex, (match) => `{features.powerbi && (\n            ${match.split('\n').join('\n            ')}\n          )}`);

// Upload Logs
const uploadLogsRegex = /<button\s+onClick=\{\(\) => setActiveTab\('upload_logs'\)\}[\s\S]*?<\/button>/;
code = code.replace(uploadLogsRegex, (match) => `{features.upload_logs && (\n            ${match.split('\n').join('\n            ')}\n          )}`);

// We need to add 'features_config' tab to the Administration section so the admin can toggle them
const featuresConfigBtn = `<button
            onClick={() => setActiveTab('features_config')}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-bold text-sm",
              activeTab === 'features_config' 
                ? "bg-white/70 text-brand-primary shadow-sm border border-white/60" 
                : "text-slate-500 hover:bg-white/40 hover:text-brand-hover"
            )}
          >
            <Settings size={18} />
            <span>Feature Controls</span>
          </button>`;

code = code.replace(/<div className="pt-4 pb-2 px-3">/, featuresConfigBtn + '\n            <div className="pt-4 pb-2 px-3">');

// Import Settings icon
if (!code.includes('Settings')) {
  code = code.replace(/import \{ LayoutDashboard, /g, "import { LayoutDashboard, Settings, ");
}

fs.writeFileSync('src/App.tsx', code);
