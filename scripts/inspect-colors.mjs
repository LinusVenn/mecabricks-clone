import { readFileSync } from 'node:fs';
const raw = readFileSync(new URL('../src/catalog/data/lego-colors.json', import.meta.url), 'utf-8');
const { colors } = JSON.parse(raw);
const red     = colors.find(c => c.id === 4);
const white   = colors.find(c => c.id === 15);
const trans   = colors.find(c => c.material?.transparent === true);
const metal   = colors.find(c => (c.material?.metalness ?? 0) >= 0.5);
console.log('total colors:', colors.length);
console.log('red (id=4):', JSON.stringify(red));
console.log('white (id=15):', JSON.stringify(white));
console.log('first transparent:', JSON.stringify(trans));
console.log('first metallic:', JSON.stringify(metal));
// Show a handful of families
const families = [...new Set(colors.map(c => c.family))].sort();
console.log('families:', families);
