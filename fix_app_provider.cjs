const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes('FeaturesProvider')) {
    code = code.replace(/import \{ AuthProvider, useAuth \} from '\.\/hooks\/useAuth';/, "import { AuthProvider, useAuth } from './hooks/useAuth';\nimport { FeaturesProvider, useFeatures } from './hooks/useFeatures';");
    
    code = code.replace(/<AuthProvider>/, "<AuthProvider>\n      <FeaturesProvider>");
    code = code.replace(/<\/AuthProvider>/, "</FeaturesProvider>\n    </AuthProvider>");
    
    fs.writeFileSync('src/App.tsx', code);
}
