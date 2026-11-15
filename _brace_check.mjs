/**
 * Precise brace-balance checker that handles:
 *   - single-quoted strings  '...'
 *   - double-quoted strings  "..."
 *   - template literals      `...${...}...`  (with nested braces inside ${})
 *   - single-line // comments
 *   - multi-line /* */ comments
 */
import { readFileSync } from 'fs';

function checkBraces(src) {
    let i = 0;
    let depth = 0;

    while (i < src.length) {
        const c = src[i];

        // Single-line comment
        if (c === '/' && src[i + 1] === '/') {
            while (i < src.length && src[i] !== '\n') i++;
            continue;
        }

        // Multi-line comment
        if (c === '/' && src[i + 1] === '*') {
            i += 2;
            while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++;
            i += 2;
            continue;
        }

        // Single-quoted string
        if (c === "'") {
            i++;
            while (i < src.length) {
                if (src[i] === '\\') { i += 2; continue; }
                if (src[i] === "'") { i++; break; }
                i++;
            }
            continue;
        }

        // Double-quoted string
        if (c === '"') {
            i++;
            while (i < src.length) {
                if (src[i] === '\\') { i += 2; continue; }
                if (src[i] === '"') { i++; break; }
                i++;
            }
            continue;
        }

        // Template literal — skip without counting its ${ } braces
        if (c === '`') {
            i++;
            let nested = 0;
            while (i < src.length) {
                if (src[i] === '\\') { i += 2; continue; }
                if (src[i] === '`' && nested === 0) { i++; break; }
                if (src[i] === '$' && src[i + 1] === '{') { nested++; i += 2; continue; }
                if (src[i] === '}' && nested > 0) { nested--; i++; continue; }
                i++;
            }
            continue;
        }

        if (c === '{') depth++;
        if (c === '}') depth--;

        i++;
    }

    return depth;
}

const files = [
    'src/export/formats/LDrawExporter.js',
    'src/export/formats/GLTFExporterAdapter.js',
];

let allOk = true;

for (const file of files) {
    const src  = readFileSync(file, 'utf8');
    const diff = checkBraces(src);
    const ok   = diff === 0;
    if (!ok) allOk = false;

    const classNames = [...src.matchAll(/^export class (\w+)/mg)].map(m => m[1]);
    const methods    = [...src.matchAll(/^\s+(?:async\s+)?([a-z_][a-zA-Z0-9_]*)\s*\(/mg)].length;
    const imports    = (src.match(/^import /mg) || []).length;

    console.log(`\n[${file}]`);
    console.log(`  export class : ${classNames.join(', ')}`);
    console.log(`  imports      : ${imports}`);
    console.log(`  methods      : ${methods}`);
    console.log(`  brace depth  : ${diff} ${ok ? '✓' : '✗ UNBALANCED'}`);
    console.log(`  bytes / lines: ${Buffer.byteLength(src, 'utf8')} / ${src.split('\n').length}`);
}

console.log('\n' + (allOk ? '✓ All files structurally valid' : '✗ Issues found'));
process.exit(allOk ? 0 : 1);
