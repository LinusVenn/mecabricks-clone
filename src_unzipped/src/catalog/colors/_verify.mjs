/**
 * Verifikationsscript für Phase E.3 – Farbsystem
 * Testet ColorDefinition, ColorPalette, ColorManager ohne Three.js-Abhängigkeit.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── ColorDefinition laden ────────────────────────────────────────────────────
import { ColorDefinition } from './ColorDefinition.js';

// ─── ColorPalette laden ───────────────────────────────────────────────────────
import { ColorPalette } from './ColorPalette.js';

// ─── ColorManager laden ───────────────────────────────────────────────────────
import { ColorManager } from './ColorManager.js';

// ─── JSON laden ───────────────────────────────────────────────────────────────
const jsonPath = join(__dirname, '../data/lego-colors.json');
const legoColorsRaw = readFileSync(jsonPath, 'utf-8');
const legoColors = JSON.parse(legoColorsRaw);

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  ✓ ${message}`);
        passed++;
    } else {
        console.error(`  ✗ FEHLER: ${message}`);
        failed++;
    }
}

function section(title) {
    console.log(`\n══ ${title} ══`);
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. JSON-Datei: Struktur und Mindestanzahl
// ═════════════════════════════════════════════════════════════════════════════
section('1. lego-colors.json – Struktur');

assert(typeof legoColors === 'object', 'JSON ist ein Objekt');
assert(legoColors.schemaVersion === 1, 'schemaVersion === 1');
assert(typeof legoColors.description === 'string', 'description ist ein String');
assert(Array.isArray(legoColors.colors), 'colors ist ein Array');
assert(legoColors.colors.length >= 60, `Mind. 60 Farben vorhanden (${legoColors.colors.length})`);

// Pflichtfarben prüfen
const requiredIds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
                     17, 18, 19, 22, 23, 24, 25, 26, 27, 28, 29,
                     32, 33, 34, 35, 36, 38, 40, 41, 44, 59, 63,
                     66, 70, 71, 72, 73, 74, 80, 87, 183, 297, 334, 383];
const jsonIds = new Set(legoColors.colors.map(c => c.id));
const missingIds = requiredIds.filter(id => !jsonIds.has(id));
assert(missingIds.length === 0, `Alle Pflicht-IDs vorhanden (fehlend: ${missingIds.join(', ') || 'keine'})`);

// Pflichtfelder jeder Farbe prüfen
const invalidColors = legoColors.colors.filter(c =>
    typeof c.id !== 'number' ||
    typeof c.name !== 'string' ||
    typeof c.displayName !== 'string' ||
    typeof c.hex !== 'string' ||
    typeof c.family !== 'string' ||
    typeof c.material !== 'object'
);
assert(invalidColors.length === 0, `Alle Farben haben Pflichtfelder (ungültig: ${invalidColors.length})`);

// Transparente Farben: opacity === 0.4
const transColors = legoColors.colors.filter(c => c.material.transparent === true);
const badTrans = transColors.filter(c => c.material.opacity !== 0.4 && c.material.opacity !== 0.3 && c.material.opacity !== 0.5);
assert(badTrans.length === 0, `Transparente Farben haben korrekte Opacity (${transColors.length} transparent)`);

// Metallic/Chrome: metalness >= 0.8
const metallicColors = legoColors.colors.filter(c =>
    ['chrome', 'metallic'].includes(c.material.type)
);
const badMetal = metallicColors.filter(c => c.material.metalness < 0.8);
assert(badMetal.length === 0, `Metallic/Chrome-Farben haben metalness >= 0.8 (${metallicColors.length} metallisch)`);

// ═════════════════════════════════════════════════════════════════════════════
// 2. ColorDefinition
// ═════════════════════════════════════════════════════════════════════════════
section('2. ColorDefinition – Grundfunktionalität');

const redDef = new ColorDefinition({
    id: 4, name: 'Red', displayName: 'Rot',
    hex: '#C91A09', family: 'red', ldrawColorId: 4,
    material: { type: 'plastic', roughness: 0.65, metalness: 0.0, transparent: false, opacity: 1.0 }
});

assert(redDef.id === 4,              'id === 4');
assert(redDef.name === 'Red',        'name === "Red"');
assert(redDef.displayName === 'Rot', 'displayName === "Rot"');
assert(redDef.hex === '#C91A09',     'hex === "#C91A09" (normalisiert)');
assert(redDef.hexNumber === 0xC91A09,'hexNumber === 0xC91A09');
assert(redDef.family === 'red',      'family === "red"');
assert(redDef.ldrawColorId === 4,    'ldrawColorId === 4');
assert(redDef.isTransparent === false, 'isTransparent === false');
assert(redDef.isMetallic === false,    'isMetallic === false');

// Transparente Farbe
const transDef = new ColorDefinition({
    id: 40, name: 'Trans-Clear', displayName: 'Transparent-Klar',
    hex: '#FCFCFC', family: 'transparent',
    material: { type: 'transparent', roughness: 0.05, metalness: 0.0, transparent: true, opacity: 0.3 }
});
assert(transDef.isTransparent === true, 'Trans-Clear: isTransparent === true');

// Metallische Farbe
const chromeDef = new ColorDefinition({
    id: 383, name: 'Chrome Silver', displayName: 'Chromsilber',
    hex: '#E0E0E0', family: 'metallic',
    material: { type: 'chrome', roughness: 0.05, metalness: 0.95, transparent: false, opacity: 1.0 }
});
assert(chromeDef.isMetallic === true, 'Chrome Silver: isMetallic === true');

// Kleinbuchstaben-Hex normalisiert
const lowerHexDef = new ColorDefinition({ id: 999, name: 'Test', displayName: 'Test', hex: '#c91a09', family: 'red' });
assert(lowerHexDef.hex === '#C91A09', 'Kleinbuchstaben-Hex wird zu Großbuchstaben normalisiert');

// Kurzschreibweise
const shortHexDef = new ColorDefinition({ id: 998, name: 'Test2', displayName: 'Test2', hex: '#FFF', family: 'white' });
assert(shortHexDef.hex === '#FFFFFF', 'Kurzschreibweise #FFF → #FFFFFF');
assert(shortHexDef.hexNumber === 0xFFFFFF, 'Kurzschreibweise hexNumber korrekt');

// Serialisierung
const data = redDef.toData();
assert(data.id === 4 && data.hex === '#C91A09', 'toData() gibt korrektes Objekt zurück');
const fromData = ColorDefinition.fromData(data);
assert(fromData.id === 4 && fromData.hex === '#C91A09', 'fromData() rekonstruiert korrekt');

// Fehlerbehandlung
let threw = false;
try { new ColorDefinition({ id: 'x' }); } catch (e) { threw = true; }
assert(threw, 'Wirft TypeError bei ungültiger id');

let threwNeg = false;
try { new ColorDefinition({ id: -1, hex: '#fff' }); } catch (e) { threwNeg = true; }
assert(threwNeg, 'Wirft RangeError bei negativer id');

// Unveränderlichkeit (frozen)
assert(Object.isFrozen(redDef), 'ColorDefinition ist eingefroren (Object.isFrozen)');
assert(Object.isFrozen(redDef.material), 'material-Objekt ist eingefroren');

// DEFAULT_MATERIAL
assert(typeof ColorDefinition.DEFAULT_MATERIAL === 'object', 'DEFAULT_MATERIAL ist ein Objekt');
assert(ColorDefinition.DEFAULT_MATERIAL.type === 'plastic', 'DEFAULT_MATERIAL.type === "plastic"');

section('2b. ColorDefinition – Standardwerte (ohne material-Objekt)');
const minDef = new ColorDefinition({ id: 1000, name: 'Min', displayName: 'Min', hex: '#112233', family: 'test' });
assert(minDef.material.type === 'plastic',  'Kein material → DEFAULT: type = plastic');
assert(minDef.material.roughness === 0.65,  'Kein material → DEFAULT: roughness = 0.65');
assert(minDef.isTransparent === false,       'Kein material → isTransparent === false');
assert(minDef.ldrawColorId === 1000,         'Kein ldrawColorId → fällt auf id zurück');

// ═════════════════════════════════════════════════════════════════════════════
// 3. ColorPalette
// ═════════════════════════════════════════════════════════════════════════════
section('3. ColorPalette – Grundfunktionalität');

const palette = ColorPalette.fromJSON(legoColors);
assert(palette instanceof ColorPalette, 'fromJSON() gibt ColorPalette-Instanz zurück');
assert(palette.getCount() === legoColors.colors.length, `getCount() === ${legoColors.colors.length}`);

// getById
const red = palette.getById(4);
assert(red !== null,            'getById(4) findet Rot');
assert(red.name === 'Red',      'getById(4).name === "Red"');
assert(palette.getById(9999) === null, 'getById(9999) → null');

// getByHex (Groß-/Kleinschreibung)
const byHexLower = palette.getByHex('#c91a09');
const byHexUpper = palette.getByHex('#C91A09');
assert(byHexLower !== null,               'getByHex Kleinbuchstaben findet Farbe');
assert(byHexUpper !== null,               'getByHex Großbuchstaben findet Farbe');
assert(byHexLower?.id === byHexUpper?.id, 'getByHex case-insensitive liefert dieselbe Farbe');

// getByFamily
const blues = palette.getByFamily('blue');
assert(blues.length > 0, `getByFamily('blue') → ${blues.length} Farben`);
assert(blues.every(c => c.family === 'blue'), 'Alle getByFamily("blue")-Farben haben family==="blue"');
assert(Array.isArray(palette.getByFamily('nicht-vorhanden')), 'getByFamily unbekannte Familie → leeres Array');

// getByName
const byEnName = palette.getByName('Red');
assert(byEnName !== null && byEnName.id === 4, 'getByName("Red") → Rot (id=4)');
const byDeName = palette.getByName('Rot');
assert(byDeName !== null && byDeName.id === 4, 'getByName("Rot") → Rot (id=4) via displayName');
assert(palette.getByName('NichtVorhanden') === null, 'getByName unbekannt → null');

// getFamilies
const families = palette.getFamilies();
assert(Array.isArray(families), 'getFamilies() gibt Array zurück');
assert(families.length > 0, `getFamilies() → ${families.length} Familien`);
assert(families.includes('red'), 'getFamilies() enthält "red"');
assert(families.includes('transparent'), 'getFamilies() enthält "transparent"');
assert(families.includes('metallic'), 'getFamilies() enthält "metallic"');
// Alphabetisch sortiert
assert(JSON.stringify(families) === JSON.stringify([...families].sort()), 'getFamilies() alphabetisch sortiert');

// hasColor
assert(palette.hasColor(4) === true,   'hasColor(4) → true');
assert(palette.hasColor(9999) === false, 'hasColor(9999) → false');

// getAll gibt Kopie zurück (kein direkter Zugriff auf internes Array)
const all1 = palette.getAll();
const all2 = palette.getAll();
assert(all1 !== all2, 'getAll() gibt neue Array-Kopie zurück (kein gleicher Referenz)');
assert(all1.length === all2.length, 'Beide Kopien haben gleiche Länge');

// addColor
const testColor = new ColorDefinition({ id: 77777, name: 'TestAdd', displayName: 'TestHinzufügen', hex: '#123456', family: 'test' });
const added = palette.addColor(testColor);
assert(added.id === 77777, 'addColor() gibt die hinzugefügte Farbe zurück');
assert(palette.hasColor(77777), 'addColor() Farbe anschließend in Palette vorhanden');
assert(palette.getCount() === legoColors.colors.length + 1, 'getCount() nach addColor +1');

let addDupThrew = false;
try { palette.addColor(testColor); } catch (e) { addDupThrew = true; }
assert(addDupThrew, 'addColor() wirft bei Duplikat-ID');

// removeColor
const removed = palette.removeColor(77777);
assert(removed === true, 'removeColor(77777) → true');
assert(!palette.hasColor(77777), 'Nach removeColor(77777) nicht mehr vorhanden');
assert(palette.getCount() === legoColors.colors.length, 'getCount() nach removeColor -1');
assert(palette.removeColor(77777) === false, 'removeColor nicht-vorhandene ID → false');

// toData
const paletteData = palette.toData();
assert(typeof paletteData === 'object', 'toData() gibt Objekt zurück');
assert(Array.isArray(paletteData.colors), 'toData().colors ist Array');
assert(paletteData.colors.length === palette.getCount(), 'toData().colors.length === getCount()');

// fromJSON mit String
const paletteFromStr = ColorPalette.fromJSON(JSON.stringify(legoColors));
assert(paletteFromStr.getCount() === legoColors.colors.length, 'fromJSON mit String-Übergabe korrekt');

// fromJSON mit rohem Array
const paletteFromArr = ColorPalette.fromJSON(legoColors.colors);
assert(paletteFromArr.getCount() === legoColors.colors.length, 'fromJSON mit Array-Übergabe korrekt');

section('3b. ColorPalette – Duplikat-Behandlung im Konstruktor');
const dupColors = [
    { id: 1, name: 'A', displayName: 'A', hex: '#111111', family: 'test' },
    { id: 1, name: 'B', displayName: 'B', hex: '#222222', family: 'test' }, // Duplikat
    { id: 2, name: 'C', displayName: 'C', hex: '#333333', family: 'test' },
];
const dupPalette = new ColorPalette(dupColors);
assert(dupPalette.getCount() === 2, 'Konstruktor: Duplikat-ID wird übersprungen (erster gewinnt)');
assert(dupPalette.getById(1)?.name === 'A', 'Erster Eintrag bei Duplikat bevorzugt');

// ═════════════════════════════════════════════════════════════════════════════
// 4. ColorManager
// ═════════════════════════════════════════════════════════════════════════════
section('4. ColorManager – Grundfunktionalität');

ColorManager.resetInstance();
const mgr = ColorManager.instance();
mgr.loadFromJSON(legoColors);

assert(mgr instanceof ColorManager, 'instance() gibt ColorManager zurück');
assert(ColorManager.instance() === mgr, 'instance() gibt dieselbe Singleton-Instanz zurück');

// Farb-Suche
assert(mgr.getColorById(4) !== null,   'getColorById(4) → Rot gefunden');
assert(mgr.getColorById(9999) === null, 'getColorById(9999) → null');
assert(mgr.getColorByHex('#C91A09') !== null, 'getColorByHex findet Farbe');
assert(mgr.getColorByName('Red') !== null, 'getColorByName("Red") → gefunden');
assert(mgr.getColorByName('Rot') !== null, 'getColorByName("Rot") → via displayName gefunden');

// Farbfamilien
const bluesMgr = mgr.getColorsByFamily('blue');
assert(bluesMgr.length > 0, `getColorsByFamily("blue") → ${bluesMgr.length} Farben`);
const allMgr = mgr.getAllColors();
assert(allMgr.length === legoColors.colors.length, 'getAllColors() hat korrekte Anzahl');
const famsMgr = mgr.getFamilies();
assert(famsMgr.includes('red'), 'getFamilies() enthält "red"');

// Konvertierungen
const hexStr = mgr.colorIdToHex(4);
assert(hexStr === '#C91A09', `colorIdToHex(4) → "${hexStr}" (erwartet "#C91A09")`);
assert(mgr.colorIdToHex(9999) === null, 'colorIdToHex(9999) → null');

const hexNum = mgr.colorIdToHexNumber(4);
assert(hexNum === 0xC91A09, `colorIdToHexNumber(4) → 0x${hexNum?.toString(16).toUpperCase()} (erwartet 0xC91A09)`);
assert(mgr.colorIdToHexNumber(9999) === null, 'colorIdToHexNumber(9999) → null');

const idFromHex = mgr.hexToColorId('#C91A09');
assert(idFromHex === 4, `hexToColorId("#C91A09") → ${idFromHex} (erwartet 4)`);
assert(mgr.hexToColorId('#000001') === null, 'hexToColorId unbekannt → null');

const idFromHexNum = mgr.hexNumberToColorId(0xC91A09);
assert(idFromHexNum === 4, `hexNumberToColorId(0xC91A09) → ${idFromHexNum} (erwartet 4)`);

// Standardfarbe
const defColor = mgr.getDefaultColor();
assert(defColor !== null, 'getDefaultColor() gibt eine Farbe zurück');
assert(defColor.id === 15, 'getDefaultColor() → Weiß (id=15) wenn vorhanden');

// Fallback
assert(mgr.getFallbackHex() === 0x4488FF, 'getFallbackHex() → 0x4488FF (Standard)');

// loadFromJSON ersetzt Palette
mgr.loadFromJSON({ colors: [{ id: 1, name: 'OnlyBlue', displayName: 'NurBlau', hex: '#0055BF', family: 'blue' }] });
assert(mgr.getAllColors().length === 1, 'loadFromJSON ersetzt Palette vollständig');
// Palette wieder zurücksetzen
mgr.loadFromJSON(legoColors);
assert(mgr.getAllColors().length === legoColors.colors.length, 'loadFromJSON mit vollständiger Palette korrekt');

// importColors
ColorManager.resetInstance();
const mgr2 = ColorManager.instance();
mgr2.loadFromJSON({ colors: [{ id: 1, name: 'Blue', displayName: 'Blau', hex: '#0055BF', family: 'blue' }] });
const result = mgr2.importColors([
    { id: 2, name: 'Green', displayName: 'Grün', hex: '#257A3E', family: 'green' },
    { id: 1, name: 'Duplicate', displayName: 'Duplikat', hex: '#000000', family: 'dark' }, // Duplikat
    { id: 3, name: 'DarkTurquoise', displayName: 'DunkelTürkis', hex: '#00838F', family: 'green' },
]);
assert(result.imported === 2 && result.skipped === 1,
    `importColors: imported=${result.imported}, skipped=${result.skipped} (erwartet 2/1)`);
assert(mgr2.getAllColors().length === 3, 'Nach importColors: 3 Farben insgesamt');

// Singleton-Reset
ColorManager.resetInstance();
assert(ColorManager.instance() !== mgr, 'Nach resetInstance() wird neue Instanz erstellt');

// ═════════════════════════════════════════════════════════════════════════════
// 5. Integrations-Schnelltest
// ═════════════════════════════════════════════════════════════════════════════
section('5. Integration – Farbsystem Ende-zu-Ende');

ColorManager.resetInstance();
const mgrFull = ColorManager.instance();
mgrFull.loadFromJSON(legoColorsRaw); // Mit String-Übergabe

// Transparente Farben identifizieren
const transColors2 = mgrFull.getAllColors().filter(c => c.isTransparent);
assert(transColors2.length >= 8, `Mindestens 8 transparente Farben (${transColors2.length})`);

// Metallische Farben identifizieren
const metalColors = mgrFull.getAllColors().filter(c => c.isMetallic);
assert(metalColors.length >= 3, `Mindestens 3 metallische Farben (${metalColors.length})`);

// Runde Reise: id → hex → id
const roundTrip = [0, 1, 4, 14, 15, 25, 71, 334, 383];
let allRoundTrip = true;
for (const id of roundTrip) {
    const hex = mgrFull.colorIdToHex(id);
    const backId = hex ? mgrFull.hexToColorId(hex) : null;
    if (backId !== id) { allRoundTrip = false; break; }
}
assert(allRoundTrip, 'Runde Reise id → hex → id für 9 Farben korrekt');

// Alle Familien-Abfragen ergeben zusammen alle Farben
const allFamilies = mgrFull.getFamilies();
let totalFromFamilies = 0;
for (const fam of allFamilies) {
    totalFromFamilies += mgrFull.getColorsByFamily(fam).length;
}
assert(totalFromFamilies === mgrFull.getAllColors().length,
    `Alle Farben sind genau einmal in einer Familie (${totalFromFamilies} === ${mgrFull.getAllColors().length})`);

// ═════════════════════════════════════════════════════════════════════════════
// Ergebnis
// ═════════════════════════════════════════════════════════════════════════════
console.log('\n' + '═'.repeat(60));
console.log(`Ergebnis: ${passed} bestanden, ${failed} fehlgeschlagen`);
if (failed > 0) {
    console.error(`\n⚠️  ${failed} Test(s) fehlgeschlagen!`);
    process.exit(1);
} else {
    console.log('\n✅ Alle Tests bestanden!');
}
