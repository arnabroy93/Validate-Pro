const fs = require('fs');
let code = fs.readFileSync('src/components/Insights.tsx', 'utf8');

const fetchAllTableDataRegex = /const fetchAllTableData = async \([\s\S]*?return allData;\n  \};\n/;

code = code.replace(fetchAllTableDataRegex, '');
code = code.replace(/catch \(error\)/g, 'catch (error: any)');

fs.writeFileSync('src/components/Insights.tsx', code);
