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

        // Multi-line comment  (slash-star to star-slash)
        if (c === '/' && src[i + 1] === '*') {
            i += 2;
            while (i < src.length) {
                if (src[i] === '*' && src[i + 1] === '/') { i += 2; break; }
                i++;
            }
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

        // Template literal — skip inner braces
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

    const classNames = [];
    const classRe = /^export class (\w+)/mg;
    let m;
    while ((m = classRe.exec(src)) !== null) classNames.push(m[1]);

    const importCount = (src.split('\n').filter(l => l.startsWith('import ')).length);

    console.log('\n[' + file + ']');
    console.log('  export class : ' + classNames.join(', '));
    console.log('  imports      : ' + importCount);
    console.log('  brace depth  : ' + diff + ' ' + (ok ? 'OK' : 'UNBALANCED'));
    console.log('  bytes / lines: ' + Buffer.byteLength(src, 'utf8') + ' / ' + src.split('\n').length);
}

console.log('\n' + (allOk ? 'All files structurally valid' : 'Issues found'));
process.exit(allOk ? 0 : 1);
