import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(/pink-/g, 'primary-');
code = code.replace(/rose-/g, 'secondary-');
fs.writeFileSync('src/App.tsx', code);
