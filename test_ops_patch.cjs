const fs = require('fs');
const path = require('path');
const opsCode = fs.readFileSync(path.join(__dirname, 'src/pages/Ops.tsx'), 'utf8');

if (opsCode.includes('editMutation = useMutation')) {
  console.log('editMutation exists');
} else {
  console.log('editMutation NOT FOUND');
}

if (opsCode.includes('deleteMutation = useMutation')) {
  console.log('deleteMutation exists');
} else {
  console.log('deleteMutation NOT FOUND');
}
