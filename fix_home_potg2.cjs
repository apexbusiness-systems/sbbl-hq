const fs = require('fs');
const path = require('path');

const homePath = path.join(__dirname, 'src', 'pages', 'Home.tsx');
let homeCode = fs.readFileSync(homePath, 'utf8');

// I need to find where potgQuery is defined, or if it was removed
// It looks like it was removed or maybe inside the component. Let's see the component definition.
