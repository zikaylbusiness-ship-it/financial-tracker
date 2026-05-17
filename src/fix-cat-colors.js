import fs from 'fs';
let code = fs.readFileSync('src/App.tsx', 'utf8');
code = code.replace(/CATEGORY_COLORS\[/g, 'getCategoryColors(theme)[');
code = code.replace(/Object.keys\(CATEGORY_COLORS\)/g, 'Object.keys(getCategoryColors(theme))');
code = code.replace(/const CATEGORY_COLORS: Record<string, string> = {[\s\S]*?};/, `const getCategoryColors = (theme: 'female' | 'male'): Record<string, string> => ({
  "Business & Content": theme === 'female' ? "#F48FB1" : "#60a5fa",
  "Education": "#FFE5B4",
  "Fixed Subscriptions": theme === 'female' ? "#E0BBE4" : "#cbd5e1",
  "Lifestyle": theme === 'female' ? "#D4F0F0" : "#e0e7ff",
  "Salary / Income": "#C5E1A5",
  "Miscellaneous": theme === 'female' ? "#FFF9C4" : "#bae6fd"
});`);

fs.writeFileSync('src/App.tsx', code);
