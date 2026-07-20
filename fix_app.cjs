const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Remove Moon, Sun, useTheme imports
code = code.replace(/PieChart, Moon, Sun/g, 'PieChart');
code = code.replace(/import { useTheme } from '\.\/hooks\/useTheme';\n/g, '');

// 2. Remove theme logic from Navigation
code = code.replace(/const { theme, toggleTheme } = useTheme\(\);\n/g, '');

code = code.replace(/<div className="flex gap-2">[\s\S]*?<button[\s\S]*?onClick=\{toggleTheme\}[\s\S]*?<\/button>[\s\S]*?<button[\s\S]*?onClick=\{signOut\}[\s\S]*?<\/button>[\s\S]*?<\/div>/, `<button
          onClick={signOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 transition-all font-bold text-sm"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>`);

// 3. Set initial state to insights
code = code.replace(/const \[activeTab, setActiveTab\] = useState\('dashboard'\);/, "const [activeTab, setActiveTab] = useState('insights');");

// 4. Move Insights tab button before Validation tab button
const insightsBtn = `<button
          onClick={() => setActiveTab('insights')}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-bold text-sm",
            activeTab === 'insights' 
              ? "bg-white/70 text-brand-primary shadow-sm border border-white/60" 
              : "text-slate-500 hover:bg-white/40 hover:text-brand-hover"
          )}
        >
          <PieChart size={18} />
          <span>Insights</span>
        </button>`;

code = code.replace(insightsBtn, ''); // remove from where it is

const dashboardBtnRegex = /<button[\s\S]*?onClick=\{\(\) => setActiveTab\('dashboard'\)\}[\s\S]*?<\/button>/;
code = code.replace(dashboardBtnRegex, (match) => {
    return insightsBtn + '\n        ' + match;
});

// 5. Move Global Insights tab button before Users tab button in Admin section
const globalInsightsBtn = `<button
              onClick={() => setActiveTab('global_insights')}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-bold text-sm",
                activeTab === 'global_insights' 
                  ? "bg-white/70 text-brand-primary shadow-sm border border-white/60" 
                  : "text-slate-500 hover:bg-white/40 hover:text-brand-hover"
              )}
            >
              <PieChart size={18} className="text-brand-primary" />
              <span>Global Insights</span>
            </button>`;

code = code.replace(globalInsightsBtn, '');

const usersBtnRegex = /<button[\s\S]*?onClick=\{\(\) => setActiveTab\('users'\)\}[\s\S]*?<\/button>/;
code = code.replace(usersBtnRegex, (match) => {
    return globalInsightsBtn + '\n            ' + match;
});

fs.writeFileSync('src/App.tsx', code);
