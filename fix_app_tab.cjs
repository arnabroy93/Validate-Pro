const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes('FeatureControls')) {
    code = code.replace(/import \{ Insights \} from '\.\/components\/Insights';/, "import { Insights } from './components/Insights';\nimport { FeatureControls } from './components/FeatureControls';");
    
    const adminView = `          ) : activeTab === 'features_config' ? (
            <motion.div
              key="features_config"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="p-8 flex-1"
            >
              <FeatureControls />
            </motion.div>
          ) : (`;
          
    code = code.replace(/          \) : \(/, adminView);
    fs.writeFileSync('src/App.tsx', code);
}
