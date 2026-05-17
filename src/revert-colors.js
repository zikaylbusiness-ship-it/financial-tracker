import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(/primary-/g, 'pink-');
code = code.replace(/secondary-/g, 'amber-');
fs.writeFileSync('src/App.tsx', code);
