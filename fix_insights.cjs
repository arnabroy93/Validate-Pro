const fs = require('fs');
let code = fs.readFileSync('src/components/Insights.tsx', 'utf8');

const newFetchData = `
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch validations
      let vQuery = supabase.from('student_validations').select('batch_code, center_code, student_code, status, validated_by');
      if (!isAdminView && profile?.username) {
        vQuery = vQuery.eq('validated_by', profile.username);
      }
      
      let allValidations = [];
      let vFrom = 0;
      let vLimit = 1000;
      let vHasMore = true;
      while (vHasMore) {
        const { data, error } = await vQuery.range(vFrom, vFrom + vLimit - 1);
        if (error) throw error;
        if (data && data.length > 0) {
          allValidations = [...allValidations, ...data];
          vFrom += vLimit;
          if (data.length < vLimit) vHasMore = false;
        } else {
          vHasMore = false;
        }
      }

      // Find relevant batches
      const relevantBatches = Array.from(new Set(allValidations.map(v => v.batch_code)));
      
      let allStudents = [];
      
      if (relevantBatches.length > 0) {
        // Fetch only students in relevant batches, or all if admin
        let sQuery = supabase.from('batch_students').select('batch_code, center_code, student_code');
        
        let sFrom = 0;
        let sLimit = 1000;
        let sHasMore = true;
        while (sHasMore) {
          // If not admin and batches are fewer than 100, we can use .in to optimize, otherwise just fetch all and filter locally
          let currentQuery = sQuery.range(sFrom, sFrom + sLimit - 1);
          if (!isAdminView && relevantBatches.length <= 100) {
              currentQuery = currentQuery.in('batch_code', relevantBatches);
          }
          
          const { data, error } = await currentQuery;
          if (error) throw error;
          if (data && data.length > 0) {
            allStudents = [...allStudents, ...data];
            sFrom += sLimit;
            if (data.length < sLimit) sHasMore = false;
          } else {
            sHasMore = false;
          }
        }
      } else if (isAdminView) {
        // If admin but no validations exist yet, still fetch all students
        let sQuery = supabase.from('batch_students').select('batch_code, center_code, student_code');
        let sFrom = 0;
        let sLimit = 1000;
        let sHasMore = true;
        while (sHasMore) {
          const { data, error } = await sQuery.range(sFrom, sFrom + sLimit - 1);
          if (error) throw error;
          if (data && data.length > 0) {
            allStudents = [...allStudents, ...data];
            sFrom += sLimit;
            if (data.length < sLimit) sHasMore = false;
          } else {
            sHasMore = false;
          }
        }
      }

      if (!isAdminView && relevantBatches.length > 100) {
          allStudents = allStudents.filter(s => relevantBatches.includes(s.batch_code));
      }

      const uniqueStudentsMap = new Map();
      allStudents.forEach((s) => {
        const key = \`\${s.center_code}_\${s.batch_code}_\${s.student_code}\`;
        if (!uniqueStudentsMap.has(key)) {
          uniqueStudentsMap.set(key, s);
        }
      });
      
      // For validations, keep the latest status per student
      const vDataMap = new Map();
      allValidations.forEach((v) => {
        const key = \`\${v.batch_code}_\${v.student_code}\`;
        vDataMap.set(key, v);
      });

      const summaryMap = new Map();
      
      uniqueStudentsMap.forEach((student) => {
        const sumKey = \`\${student.center_code}_\${student.batch_code}\`;
        if (!summaryMap.has(sumKey)) {
          summaryMap.set(sumKey, {
            center_code: student.center_code || '',
            batch_code: student.batch_code || '',
            total_students: 0,
            validated: 0,
            revalidated: 0,
            pending: 0,
            absent: 0,
            rejected: 0,
            validatorSet: new Set()
          });
        }
        
        const summary = summaryMap.get(sumKey);
        summary.total_students += 1;
        
        const validationRow = vDataMap.get(\`\${student.batch_code}_\${student.student_code}\`);
        
        if (validationRow?.validated_by) {
          summary.validatorSet.add(validationRow.validated_by);
        }
        
        const currentStatus = validationRow?.status || 'Pending';
        if (currentStatus === 'Validated' || currentStatus === 'Completed') summary.validated += 1;
        else if (currentStatus === 'ReValidated') summary.revalidated += 1;
        else if (currentStatus === 'Absent') summary.absent += 1;
        else if (currentStatus === 'Rejected') summary.rejected += 1;
        else summary.pending += 1;
      });
      
      let allSummaries = Array.from(summaryMap.values());
      
      if (!isAdminView && profile?.username) {
        allSummaries = allSummaries.filter(s => {
          const validators = Array.from(s.validatorSet);
          return validators.some(v => v.toLowerCase().trim() === profile.username.toLowerCase().trim());
        });
      }

      setSummaryData(allSummaries);

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
`;

const oldFetchDataRegex = /const fetchData = async \(\) => \{[\s\S]*?setSummaryData\(allSummaries\);\n\n    \} catch \(error: any\) \{\n      console\.error\(error\);\n    \} finally \{\n      setLoading\(false\);\n    \}\n  \};/;

code = code.replace(oldFetchDataRegex, newFetchData.trim());
fs.writeFileSync('src/components/Insights.tsx', code);
