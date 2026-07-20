const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

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

const validationBtn = `<button
          onClick={() => {
            if (activeTab === 'dashboard') {
              window.dispatchEvent(new CustomEvent('reset_validation'));
            } else {
              setActiveTab('dashboard');
            }
          }}`;

if (!code.includes("<span>Insights</span>")) {
    code = code.replace(validationBtn, insightsBtn + '\n        ' + validationBtn);
    fs.writeFileSync('src/App.tsx', code);
}
