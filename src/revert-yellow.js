import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(/amber-/g, 'yellow-');
fs.writeFileSync('src/App.tsx', code);
