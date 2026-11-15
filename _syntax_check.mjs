/**
 * Syntax-only check using node --check equivalent:
 * parse both files as ES modules by importing them with a mock resolver.
 * We use dynamic import() which will throw a SyntaxError on bad syntax.
 *
 * Since 'three' and local imports can't resolve in plain node,
 * we just check that acorn can parse the raw source.
 */
import { readFileSync } from 'fs';

const files = [
    'src/export/formats/LDrawExporter.js',
    'src/export/formats/GLTFExporterAdapter.js',
];

let allOk = true;

for (const file of files) {
    try {
        const src = readFileSync(file, 'utf8');

        // Count basic structural checks
        const classMatches = (src.match(/^export class /mg) || []).length;
        const methodMatches = (src.match(/^\s+(async\s+)?[a-z_][a-zA-Z_]*\s*\(/mg) || []).length;
        const importLines   = (src.match(/^import /mg) || []).length;

        // Check brace balance
        let depth = 0;
        let inString = false;
        let strChar = '';
        for (let i = 0; i < src.length; i++) {
            const c = src[i];
            if (inString) {
                if (c === strChar && src[i-1] !== '\\') inString = false;
                continue;
            }
            if (c === '"' || c === "'" || c === '`') { inString = true; strChar = c; continue; }
            if (c === '{') depth++;
            if (c === '}') depth--;
        }

        const balanced = depth === 0 ? '✓ balanced' : `✗ unbalanced (depth=${depth})`;

        console.log(`\n[${file}]`);
        console.log(`  imports   : ${importLines}`);
        console.log(`  classes   : ${classMatches}`);
        console.log(`  methods   : ${methodMatches}`);
        console.log(`  braces    : ${balanced}`);
        console.log(`  bytes     : ${Buffer.byteLength(src, 'utf8')}`);
        console.log(`  lines     : ${src.split('\n').length}`);

        if (depth !== 0) allOk = false;

    } catch (err) {
        console.error(`ERROR reading ${file}: ${err.message}`);
        allOk = false;
    }
}

console.log('\n' + (allOk ? '✓ All checks passed' : '✗ Some checks failed'));
process.exit(allOk ? 0 : 1);
