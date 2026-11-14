/**
 * build-ldraw-index.js
 *
 * Scannt public/ldraw/parts/ rekursiv, erkennt alle relevanten LDraw-Dateitypen
 * (.dat, .ldr) und erzeugt public/ldraw/parts-index.json.
 *
 * Berücksichtigt:
 *   - Groß-/Kleinschreibung (normalisiert zu Kleinbuchstaben)
 *   - Doppelte Dateinamen (unterschiedliche Verzeichnisse, gleicher Basisname)
 *   - Unterverzeichnisse (z. B. parts/s/ für Unter-Bauteile)
 *   - Relevante Dateitypen: .dat, .ldr
 *
 * Aufruf:
 *   node scripts/catalog/build-ldraw-index.js
 *
 * Optional:
 *   node scripts/catalog/build-ldraw-index.js --parts-dir public/ldraw/parts \
 *       --output public/ldraw/parts-index.json
 */

import { readdir, writeFile } from 'node:fs/promises';
import { join, extname, basename, relative } from 'node:path';

// ── Konfiguration ──────────────────────────────────────────────────────────────

const DEFAULTS = {
    partsDir: 'public/ldraw/parts',
    output:   'public/ldraw/parts-index.json',
};

const RELEVANT_EXTENSIONS = new Set(['.dat', '.ldr']);


// ── CLI-Argumente einlesen ─────────────────────────────────────────────────────

function parseArgs(argv) {
    const args = {};

    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--parts-dir')  args.partsDir = argv[++i];
        if (argv[i] === '--output')     args.output   = argv[++i];
    }

    return args;
}


// ── Verzeichnis rekursiv scannen ───────────────────────────────────────────────

/**
 * Scannt ein Verzeichnis rekursiv und sammelt alle relevanten Dateipfade.
 *
 * @param {string} dir       - Absolutes/relatives Verzeichnis
 * @param {string} baseDir   - Basisverzeichnis für relative Pfade
 * @param {string[]} entries - Akkumulator
 * @returns {Promise<string[]>} Relative Pfade aller gefundenen Dateien
 */
async function scanDirectory(dir, baseDir = dir, entries = []) {
    let items;

    try {
        items = await readdir(dir, { withFileTypes: true });
    } catch (error) {
        console.error(`Fehler beim Lesen von "${dir}": ${error.message}`);
        return entries;
    }

    for (const item of items) {
        const fullPath = join(dir, item.name);

        if (item.isDirectory()) {
            await scanDirectory(fullPath, baseDir, entries);
        } else if (item.isFile()) {
            const ext = extname(item.name).toLowerCase();

            if (RELEVANT_EXTENSIONS.has(ext)) {
                const relativePath = relative(baseDir, fullPath).replace(/\\/g, '/');
                entries.push(relativePath);
            }
        }
    }

    return entries;
}


// ── Teilenummer normalisieren ──────────────────────────────────────────────────

/**
 * Extrahiert die normalisierte Teilenummer aus einem Dateipfad.
 * Beispiele:
 *   "3001.dat"       → "3001"
 *   "s/3001s01.dat"  → "3001s01"   (nur Dateiname, ohne Unterverzeichnis)
 *   "Technic.ldr"    → "technic"
 *
 * @param {string} filePath - Relativer Dateipfad (Trennzeichen: /)
 * @returns {string} Normalisierte Teilenummer
 */
function normalizePartNumber(filePath) {
    return basename(filePath)
        .toLowerCase()
        .replace(/\.(dat|ldr)$/i, '');
}

/**
 * Extrahiert den vollständigen normlisierten Pfad ohne Erweiterung.
 * Wird für Unterverzeichnisse verwendet (s/3001s01).
 *
 * @param {string} filePath - Relativer Dateipfad
 * @returns {string}
 */
function normalizeFullPath(filePath) {
    return filePath
        .toLowerCase()
        .replace(/\.(dat|ldr)$/i, '');
}


// ── Duplikat-Erkennung ─────────────────────────────────────────────────────────

/**
 * Findet Dateien mit identischem Basisnamen (case-insensitive),
 * die in unterschiedlichen Unterverzeichnissen liegen.
 *
 * @param {string[]} files
 * @returns {{ partNumber: string, files: string[] }[]}
 */
function detectDuplicates(files) {
    const byNormalizedName = new Map();

    for (const file of files) {
        const key = normalizePartNumber(file);

        if (!byNormalizedName.has(key)) {
            byNormalizedName.set(key, []);
        }

        byNormalizedName.get(key).push(file);
    }

    const duplicates = [];

    for (const [partNumber, paths] of byNormalizedName) {
        if (paths.length > 1) {
            duplicates.push({ partNumber, files: paths });
        }
    }

    return duplicates;
}


// ── Index aufbauen ─────────────────────────────────────────────────────────────

/**
 * Baut den vollständigen Index aus einer Dateiliste auf.
 *
 * @param {string[]} files       - Relative Pfade (von baseDir aus)
 * @param {object}  [options]
 * @param {string}  [options.partsDir]
 * @returns {object} Index-Objekt
 */
function buildIndexObject(files, { partsDir = 'parts/' } = {}) {
    const duplicates = detectDuplicates(files);

    const parts = files.map(file => ({
        file:        file,
        partNumber:  normalizePartNumber(file),
        fullPath:    normalizeFullPath(file),
        extension:   extname(file).toLowerCase().replace('.', ''),
    }));

    return {
        schemaVersion: 2,
        generatedAt:   new Date().toISOString(),
        partsDir,
        totalFiles:    files.length,
        duplicateCount: duplicates.length,
        duplicates,
        parts,
    };
}


// ── Hauptfunktion ──────────────────────────────────────────────────────────────

async function main() {
    const args = parseArgs(process.argv.slice(2));

    const partsDir = args.partsDir ?? DEFAULTS.partsDir;
    const output   = args.output   ?? DEFAULTS.output;

    console.log('LDraw-Teilenummern-Index wird erstellt …');
    console.log(`Verzeichnis: ${partsDir}`);
    console.log(`Ausgabe:     ${output}`);
    console.log('');

    // Verzeichnis scannen
    console.log('Scanne Verzeichnis …');
    const files = await scanDirectory(partsDir);

    if (files.length === 0) {
        console.error(`Keine LDraw-Dateien gefunden in: ${partsDir}`);
        process.exit(1);
    }

    console.log(`  ${files.length} Dateien gefunden.`);

    // Index aufbauen
    const index = buildIndexObject(files, { partsDir });

    // Duplikate melden
    if (index.duplicates.length > 0) {
        console.warn(`\nDoppelte Dateinamen (${index.duplicates.length}):`);

        for (const dup of index.duplicates) {
            console.warn(`  ${dup.partNumber}:`);
            for (const f of dup.files) {
                console.warn(`    - ${f}`);
            }
        }

        console.warn('');
    } else {
        console.log('  Keine Duplikate gefunden.');
    }

    // JSON schreiben
    const json = JSON.stringify(index, null, 2);
    await writeFile(output, json, 'utf-8');

    console.log(`\n✓ Index erstellt: ${index.totalFiles} Bauteile → ${output}`);

    return index;
}


main().catch(error => {
    console.error('Fehler:', error.message);
    process.exit(1);
});
