const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// I need to insert the normal 'insights' button before 'dashboard'

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

const dashboardRegex = /<button[\s\S]*?onClick=\{\(\) => \{\n\s*if \(activeTab === 'dashboard'\)/;

if (!code.includes("setActiveTab('insights')") || !code.includes("<span>Insights</span>")) {
    code = code.replace(dashboardRegex, (match) => {
        return insightsBtn + '\n        ' + match;
    });
}

// Global Insights is currently above Validation, which is weird. It should be under Administration.
const globalInsightsBtnRegex = /<button[\s\S]*?onClick=\{\(\) => setActiveTab\('global_insights'\)\}[\s\S]*?<\/button>/;

code = code.replace(globalInsightsBtnRegex, '');

const adminRegex = /<p className="text-\[10px\] font-black uppercase tracking-widest text-brand-primary\/50">Administration<\/p>\n\s*<\/div>/;

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

code = code.replace(adminRegex, (match) => {
    return match + '\n            ' + globalInsightsBtn;
});

fs.writeFileSync('src/App.tsx', code);
