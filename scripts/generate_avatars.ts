import * as fs from 'fs';
import * as path from 'path';

const outDir = path.resolve(process.cwd(), 'public/avatars');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

interface CatStyle {
  id: string;
  name: string;
  bg: string;
  catColor: string;
  earColor: string;
  eyeColor: string;
  accessory?: string;
}

const CATS: CatStyle[] = [
  { id: 'cat-01', name: 'Ginger Champ', bg: '#F97316', catColor: '#FFEDD5', earColor: '#FDBA74', eyeColor: '#1E293B', accessory: 'bandana' },
  { id: 'cat-02', name: 'Cool Shadow', bg: '#0EA5E9', catColor: '#334155', earColor: '#475569', eyeColor: '#38BDF8', accessory: 'shades' },
  { id: 'cat-03', name: 'Golden Ace', bg: '#EAB308', catColor: '#FEF08A', earColor: '#FDE047', eyeColor: '#713F12', accessory: 'headband' },
  { id: 'cat-04', name: 'Emerald Whiskers', bg: '#10B981', catColor: '#D1FAE5', earColor: '#6EE7B7', eyeColor: '#065F46' },
  { id: 'cat-05', name: 'Purple Smash', bg: '#8B5CF6', catColor: '#EDE9FE', earColor: '#C4B5FD', eyeColor: '#4C1D95', accessory: 'cap' },
  { id: 'cat-06', name: 'Coral Shuttle', bg: '#F43F5E', catColor: '#FFE4E6', earColor: '#FDA4AF', eyeColor: '#881337', accessory: 'bandana' },
  { id: 'cat-07', name: 'Cyan Drop', bg: '#06B6D4', catColor: '#CFFAFE', earColor: '#67E8F9', eyeColor: '#164E63' },
  { id: 'cat-08', name: 'Midnight Net', bg: '#6366F1', catColor: '#1E1B4B', earColor: '#312E81', eyeColor: '#A5B4FC', accessory: 'shades' },
  { id: 'cat-09', name: 'Peach Rally', bg: '#FB923C', catColor: '#FFEDD5', earColor: '#FED7AA', eyeColor: '#9A3412', accessory: 'headband' },
  { id: 'cat-10', name: 'Teal Spin', bg: '#14B8A6', catColor: '#CCFBF1', earColor: '#5EEAD4', eyeColor: '#134E4A' },
  { id: 'cat-11', name: 'Ruby Victor', bg: '#E11D48', catColor: '#FFE4E6', earColor: '#FECDD3', eyeColor: '#4C0519', accessory: 'crown' },
  { id: 'cat-12', name: 'Cosmic Star', bg: '#A855F7', catColor: '#F3E8FF', earColor: '#D8B4FE', eyeColor: '#3B0764', accessory: 'shades' },
];

function generateSvg(cat: CatStyle): string {
  let accessorySvg = '';

  if (cat.accessory === 'shades') {
    accessorySvg = `
      <rect x="26" y="44" width="20" height="12" rx="3" fill="#0F172A" />
      <rect x="54" y="44" width="20" height="12" rx="3" fill="#0F172A" />
      <line x1="46" y1="48" x2="54" y2="48" stroke="#0F172A" stroke-width="3" stroke-linecap="round" />
      <line x1="28" y1="47" x2="38" y2="47" stroke="#38BDF8" stroke-width="1.5" stroke-linecap="round" />
      <line x1="56" y1="47" x2="66" y2="47" stroke="#38BDF8" stroke-width="1.5" stroke-linecap="round" />
    `;
  } else if (cat.accessory === 'bandana' || cat.accessory === 'headband') {
    accessorySvg = `
      <path d="M 22 36 Q 50 32 78 36" stroke="#EF4444" stroke-width="7" stroke-linecap="round" fill="none" />
      <circle cx="50" cy="34" r="3" fill="#FFFFFF" />
    `;
  } else if (cat.accessory === 'cap') {
    accessorySvg = `
      <path d="M 25 36 Q 50 20 75 36 Z" fill="#3B82F6" />
      <path d="M 20 36 Q 50 32 85 34" stroke="#1D4ED8" stroke-width="5" stroke-linecap="round" fill="none" />
    `;
  } else if (cat.accessory === 'crown') {
    accessorySvg = `
      <polygon points="36,26 42,16 50,23 58,16 64,26" fill="#FBBF24" stroke="#B45309" stroke-width="1.5" />
    `;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <!-- Background Circle -->
  <circle cx="50" cy="50" r="48" fill="${cat.bg}" />

  <!-- Left Ear -->
  <polygon points="26,45 18,18 42,32" fill="${cat.catColor}" />
  <polygon points="26,40 22,23 38,32" fill="${cat.earColor}" />

  <!-- Right Ear -->
  <polygon points="74,45 82,18 58,32" fill="${cat.catColor}" />
  <polygon points="74,40 78,23 62,32" fill="${cat.earColor}" />

  <!-- Cat Head -->
  <ellipse cx="50" cy="56" rx="28" ry="24" fill="${cat.catColor}" />

  <!-- Eyes (if not covered by shades) -->
  ${
    cat.accessory === 'shades'
      ? ''
      : `
  <ellipse cx="40" cy="52" rx="4" ry="5" fill="${cat.eyeColor}" />
  <ellipse cx="60" cy="52" rx="4" ry="5" fill="${cat.eyeColor}" />
  <circle cx="41.5" cy="50" r="1.5" fill="#FFFFFF" />
  <circle cx="61.5" cy="50" r="1.5" fill="#FFFFFF" />
  `
  }

  <!-- Nose & Mouth -->
  <polygon points="48,60 52,60 50,63" fill="#F43F5E" />
  <path d="M 46 64 Q 50 67 54 64" stroke="#475569" stroke-width="1.5" stroke-linecap="round" fill="none" />

  <!-- Whiskers -->
  <line x1="24" y1="58" x2="38" y2="60" stroke="#64748B" stroke-width="1.5" stroke-linecap="round" />
  <line x1="23" y1="64" x2="37" y2="63" stroke="#64748B" stroke-width="1.5" stroke-linecap="round" />
  <line x1="62" y1="60" x2="76" y2="58" stroke="#64748B" stroke-width="1.5" stroke-linecap="round" />
  <line x1="63" y1="63" x2="77" y2="64" stroke="#64748B" stroke-width="1.5" stroke-linecap="round" />

  <!-- Accessories -->
  ${accessorySvg}
</svg>`;
}

for (const cat of CATS) {
  const svg = generateSvg(cat);
  const filePath = path.join(outDir, `${cat.id}.svg`);
  fs.writeFileSync(filePath, svg, 'utf-8');
}

console.log(`Generated 12 cat avatars in ${outDir}`);
