import { describe, it, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { ColorManager }    from '../src/catalog/colors/ColorManager.js';
import { ColorDefinition } from '../src/catalog/colors/ColorDefinition.js';
import { ColorPalette }    from '../src/catalog/colors/ColorPalette.js';
import { readFileSync }    from 'node:fs';
import { fileURLToPath }   from 'node:url';
import path               from 'node:path';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Vollständige lego-colors.json als Objekt, geladen einmal für die gesamte Suite. */
const LEGO_COLORS_JSON = JSON.parse(
    readFileSync(path.resolve(__dirname, '../src/catalog/data/lego-colors.json'), 'utf-8'),
);

/** Minimale Test-Palette mit drei bekannten Farben. */
const MINI_PALETTE_DATA = {
    colors: [
        { id: 4,  name: 'Red',   displayName: 'Rot',  hex: '#C91A09', family: 'red'  },
        { id: 1,  name: 'Blue',  displayName: 'Blau', hex: '#0055BF', family: 'blue' },
        { id: 15, name: 'White', displayName: 'Weiß', hex: '#FFFFFF', family: 'white' },
    ],
};

/** Hilfsfunktion: frischer ColorManager mit der Mini-Palette. */
function makeMiniManager() {
    ColorManager.resetInstance();
    const mgr = ColorManager.instance();
    mgr.loadFromJSON(MINI_PALETTE_DATA);
    return mgr;
}

/** Hilfsfunktion: frischer ColorManager mit der vollständigen LEGO-Palette. */
function makeFullManager() {
    ColorManager.resetInstance();
    const mgr = ColorManager.instance();
    mgr.loadFromJSON(LEGO_COLORS_JSON);
    return mgr;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ColorManager', () => {

    // Singleton immer zurücksetzen, damit Tests sich nicht gegenseitig beeinflussen
    beforeEach(() => ColorManager.resetInstance());
    after(()      => ColorManager.resetInstance());

    // ── Singleton ─────────────────────────────────────────────────────────────

    describe('Singleton', () => {

        it('instance() gibt eine ColorManager-Instanz zurück', () => {
            const mgr = ColorManager.instance();
            assert.ok(mgr instanceof ColorManager);             // 1
        });

        it('instance() gibt beim zweiten Aufruf dieselbe Instanz zurück', () => {
            const a = ColorManager.instance();
            const b = ColorManager.instance();
            assert.strictEqual(a, b);                           // 2
        });

        it('resetInstance() setzt den Singleton zurück', () => {
            const a = ColorManager.instance();
            ColorManager.resetInstance();
            const b = ColorManager.instance();
            assert.notStrictEqual(a, b);                        // 3
        });

        it('nach resetInstance() ist die neue Instanz leer', () => {
            ColorManager.instance().loadFromJSON(MINI_PALETTE_DATA);
            ColorManager.resetInstance();
            const mgr = ColorManager.instance();
            assert.equal(mgr.getAllColors().length, 0);         // 4
        });

        it('Optionen beim ersten Aufruf werden übernommen', () => {
            const mgr = ColorManager.instance({ fallbackColor: 0x123456 });
            assert.equal(mgr.getFallbackHex(), 0x123456);       // 5
        });

        it('Optionen bei einem weiteren instance()-Aufruf werden ignoriert', () => {
            ColorManager.instance({ fallbackColor: 0x111111 });
            const mgr2 = ColorManager.instance({ fallbackColor: 0x999999 });
            assert.equal(mgr2.getFallbackHex(), 0x111111);      // 6
        });
    });

    // ── getColorById() ────────────────────────────────────────────────────────

    describe('getColorById()', () => {

        it('gibt die richtige ColorDefinition für id=4 zurück', () => {
            const mgr = makeMiniManager();
            const color = mgr.getColorById(4);
            assert.ok(color instanceof ColorDefinition);        // 7
            assert.equal(color.name, 'Red');                    // 8
        });

        it('gibt null zurück für eine unbekannte ID', () => {
            const mgr = makeMiniManager();
            assert.equal(mgr.getColorById(999), null);          // 9
        });

        it('gibt null zurück wenn die Palette leer ist', () => {
            const mgr = ColorManager.instance();
            assert.equal(mgr.getColorById(4), null);            // 10
        });

        it('id=15 (Weiß) wird korrekt aufgelöst', () => {
            const mgr = makeMiniManager();
            assert.equal(mgr.getColorById(15).name, 'White');   // 11
        });
    });

    // ── getColorByHex() ───────────────────────────────────────────────────────

    describe('getColorByHex()', () => {

        it('findet Farbe mit exaktem Hex-String', () => {
            const mgr = makeMiniManager();
            assert.equal(mgr.getColorByHex('#C91A09').id, 4);  // 12
        });

        it('Suche ist case-insensitiv', () => {
            const mgr = makeMiniManager();
            assert.equal(mgr.getColorByHex('#c91a09').id, 4);  // 13
        });

        it('gibt null zurück für unbekannten Hex-Wert', () => {
            const mgr = makeMiniManager();
            assert.equal(mgr.getColorByHex('#BADBAD'), null);   // 14
        });

        it('findet #FFFFFF (Weiß)', () => {
            const mgr = makeMiniManager();
            assert.equal(mgr.getColorByHex('#FFFFFF').id, 15); // 15
        });
    });

    // ── getAllColors() ─────────────────────────────────────────────────────────

    describe('getAllColors()', () => {

        it('gibt ein nicht-leeres Array nach dem Laden zurück', () => {
            const mgr = makeFullManager();
            const all = mgr.getAllColors();
            assert.ok(Array.isArray(all));                      // 16
            assert.ok(all.length > 0);                          // 17
        });

        it('gibt exakt 75 Farben aus lego-colors.json zurück', () => {
            const mgr = makeFullManager();
            assert.equal(mgr.getAllColors().length, 75);        // 18
        });

        it('enthält nur ColorDefinition-Instanzen', () => {
            const mgr = makeMiniManager();
            for (const c of mgr.getAllColors()) {
                assert.ok(c instanceof ColorDefinition);        // 19 – × 3
            }
        });

        it('gibt leeres Array bei leerer Palette zurück', () => {
            const mgr = ColorManager.instance();
            assert.equal(mgr.getAllColors().length, 0);         // 20
        });
    });

    // ── getFamilies() ─────────────────────────────────────────────────────────

    describe('getFamilies()', () => {

        it('gibt ein nicht-leeres Array zurück', () => {
            const mgr = makeFullManager();
            const fams = mgr.getFamilies();
            assert.ok(Array.isArray(fams));                     // 21
            assert.ok(fams.length > 0);                         // 22
        });

        it('gibt String-Werte zurück', () => {
            const mgr = makeFullManager();
            for (const f of mgr.getFamilies()) {
                assert.equal(typeof f, 'string');               // 23
            }
        });

        it('enthält bekannte Familien', () => {
            const mgr = makeFullManager();
            const fams = mgr.getFamilies();
            assert.ok(fams.includes('red'));                    // 24
            assert.ok(fams.includes('blue'));                   // 25
            assert.ok(fams.includes('transparent'));            // 26
        });

        it('Familien sind alphabetisch sortiert', () => {
            const mgr = makeFullManager();
            const fams = mgr.getFamilies();
            assert.deepEqual(fams, [...fams].sort());           // 27
        });
    });

    // ── colorIdToHex() ────────────────────────────────────────────────────────

    describe('colorIdToHex()', () => {

        it('konvertiert id=4 zu "#C91A09"', () => {
            const mgr = makeMiniManager();
            assert.equal(mgr.colorIdToHex(4), '#C91A09');      // 28
        });

        it('konvertiert id=15 zu "#FFFFFF"', () => {
            const mgr = makeMiniManager();
            assert.equal(mgr.colorIdToHex(15), '#FFFFFF');     // 29
        });

        it('gibt null zurück für unbekannte ID', () => {
            const mgr = makeMiniManager();
            assert.equal(mgr.colorIdToHex(999), null);         // 30
        });

        it('gibt einen String zurück', () => {
            const mgr = makeMiniManager();
            assert.equal(typeof mgr.colorIdToHex(4), 'string'); // 31
        });

        it('Hex-String beginnt mit "#"', () => {
            const mgr = makeMiniManager();
            assert.ok(mgr.colorIdToHex(4).startsWith('#'));    // 32
        });
    });

    // ── colorIdToHexNumber() ──────────────────────────────────────────────────

    describe('colorIdToHexNumber()', () => {

        it('konvertiert id=4 zu 0xC91A09', () => {
            const mgr = makeMiniManager();
            assert.equal(mgr.colorIdToHexNumber(4), 0xC91A09); // 33
        });

        it('konvertiert id=15 zu 0xFFFFFF', () => {
            const mgr = makeMiniManager();
            assert.equal(mgr.colorIdToHexNumber(15), 0xFFFFFF); // 34
        });

        it('gibt null zurück für unbekannte ID', () => {
            const mgr = makeMiniManager();
            assert.equal(mgr.colorIdToHexNumber(999), null);   // 35
        });

        it('gibt eine Zahl zurück', () => {
            const mgr = makeMiniManager();
            assert.equal(typeof mgr.colorIdToHexNumber(4), 'number'); // 36
        });
    });

    // ── hexToColorId() ────────────────────────────────────────────────────────

    describe('hexToColorId()', () => {

        it('gibt id=4 für "#C91A09" zurück', () => {
            const mgr = makeMiniManager();
            assert.equal(mgr.hexToColorId('#C91A09'), 4);      // 37
        });

        it('Suche ist case-insensitiv', () => {
            const mgr = makeMiniManager();
            assert.equal(mgr.hexToColorId('#c91a09'), 4);      // 38
        });

        it('gibt null zurück für unbekannten Hex-Wert', () => {
            const mgr = makeMiniManager();
            assert.equal(mgr.hexToColorId('#BADBAD'), null);   // 39
        });

        it('roundtrip: colorIdToHex → hexToColorId', () => {
            const mgr = makeMiniManager();
            const hex = mgr.colorIdToHex(4);
            assert.equal(mgr.hexToColorId(hex), 4);            // 40
        });
    });

    // ── hexNumberToColorId() ──────────────────────────────────────────────────

    describe('hexNumberToColorId()', () => {

        it('gibt id=4 für 0xC91A09 zurück', () => {
            const mgr = makeMiniManager();
            assert.equal(mgr.hexNumberToColorId(0xC91A09), 4); // 41
        });

        it('gibt id=15 für 0xFFFFFF zurück', () => {
            const mgr = makeMiniManager();
            assert.equal(mgr.hexNumberToColorId(0xFFFFFF), 15); // 42
        });

        it('gibt null zurück für unbekannten Hex-Wert', () => {
            const mgr = makeMiniManager();
            assert.equal(mgr.hexNumberToColorId(0xBADBAD), null); // 43
        });

        it('roundtrip: colorIdToHexNumber → hexNumberToColorId', () => {
            const mgr = makeMiniManager();
            const hexNum = mgr.colorIdToHexNumber(1);
            assert.equal(mgr.hexNumberToColorId(hexNum), 1);   // 44
        });
    });

    // ── getDefaultColor() ─────────────────────────────────────────────────────

    describe('getDefaultColor()', () => {

        it('gibt eine ColorDefinition zurück (nicht null)', () => {
            const mgr = makeMiniManager();
            assert.ok(mgr.getDefaultColor() instanceof ColorDefinition); // 45
        });

        it('bevorzugt Weiß (id=15)', () => {
            const mgr = makeMiniManager();
            assert.equal(mgr.getDefaultColor().id, 15);        // 46
        });

        it('gibt die erste Farbe zurück wenn Weiß nicht vorhanden', () => {
            ColorManager.resetInstance();
            const mgr = ColorManager.instance();
            mgr.loadFromJSON({ colors: [
                { id: 4, name: 'Red', hex: '#C91A09', family: 'red' },
            ]});
            assert.equal(mgr.getDefaultColor().id, 4);         // 47
        });

        it('gibt null zurück wenn die Palette leer ist', () => {
            const mgr = ColorManager.instance();
            assert.equal(mgr.getDefaultColor(), null);          // 48
        });

        it('gibt Weiß aus der vollständigen LEGO-Palette zurück', () => {
            const mgr = makeFullManager();
            assert.equal(mgr.getDefaultColor().id, 15);        // 49
        });
    });

    // ── loadFromJSON() ────────────────────────────────────────────────────────

    describe('loadFromJSON()', () => {

        it('lädt Farben aus einem Objekt mit colors-Array', () => {
            const mgr = ColorManager.instance();
            mgr.loadFromJSON(MINI_PALETTE_DATA);
            assert.equal(mgr.getAllColors().length, 3);         // 50
        });

        it('lädt Farben aus einem JSON-String', () => {
            const mgr = ColorManager.instance();
            mgr.loadFromJSON(JSON.stringify(MINI_PALETTE_DATA));
            assert.equal(mgr.getAllColors().length, 3);         // 51
        });

        it('ersetzt die vorherige Palette', () => {
            const mgr = ColorManager.instance();
            mgr.loadFromJSON(MINI_PALETTE_DATA);
            mgr.loadFromJSON({ colors: [
                { id: 7, name: 'Light Gray', hex: '#9BA19D', family: 'gray' },
            ]});
            assert.equal(mgr.getAllColors().length, 1);         // 52
            assert.equal(mgr.getColorById(4), null);            // 53 – alte Farbe weg
        });

        it('akzeptiert ein direktes Array (ohne colors-Wrapper)', () => {
            const mgr = ColorManager.instance();
            mgr.loadFromJSON(MINI_PALETTE_DATA.colors);
            assert.equal(mgr.getAllColors().length, 3);         // 54
        });

        it('wirft TypeError für unbekannte Objektstruktur', () => {
            const mgr = ColorManager.instance();
            assert.throws(
                () => mgr.loadFromJSON({ data: [] }),
                TypeError,
            );                                                   // 55
        });

        it('wirft SyntaxError für ungültigen JSON-String', () => {
            const mgr = ColorManager.instance();
            assert.throws(
                () => mgr.loadFromJSON('{]'),
                SyntaxError,
            );                                                   // 56
        });

        it('lädt alle 75 Farben aus lego-colors.json', () => {
            const mgr = makeFullManager();
            assert.equal(mgr.getAllColors().length, 75);        // 57
        });
    });

    // ── importColors() ────────────────────────────────────────────────────────

    describe('importColors()', () => {

        it('gibt ein Objekt mit imported und skipped zurück', () => {
            const mgr = ColorManager.instance();
            const result = mgr.importColors([]);
            assert.ok('imported' in result);                    // 58
            assert.ok('skipped'  in result);                    // 59
        });

        it('importiert neue Farben korrekt', () => {
            const mgr = ColorManager.instance();
            const result = mgr.importColors([
                { id: 4, name: 'Red',  hex: '#C91A09', family: 'red'  },
                { id: 1, name: 'Blue', hex: '#0055BF', family: 'blue' },
            ]);
            assert.equal(result.imported, 2);                   // 60
            assert.equal(result.skipped,  0);                   // 61
        });

        it('überspringt bereits vorhandene IDs', () => {
            const mgr = makeMiniManager();
            const result = mgr.importColors([
                { id: 4,   name: 'Red2', hex: '#FF0000', family: 'red' },  // Duplikat
                { id: 100, name: 'New',  hex: '#AABBCC', family: 'unknown' }, // Neu
            ]);
            assert.equal(result.imported, 1);                   // 62
            assert.equal(result.skipped,  1);                   // 63
        });

        it('überspringt ungültige Einträge (kein Fehler)', () => {
            const mgr = ColorManager.instance();
            const result = mgr.importColors([
                { id: 4, name: 'Red', hex: '#C91A09', family: 'red' },
                { /* kein id → ungültig */ name: 'Bad', hex: '#000000' },
            ]);
            assert.equal(result.imported, 1);                   // 64
            assert.equal(result.skipped,  1);                   // 65
        });

        it('wirft TypeError wenn kein Array übergeben wird', () => {
            const mgr = ColorManager.instance();
            assert.throws(
                () => mgr.importColors(null),
                TypeError,
            );                                                   // 66
        });

        it('importierte Farben sind danach per getColorById auffindbar', () => {
            const mgr = ColorManager.instance();
            mgr.importColors([{ id: 4, name: 'Red', hex: '#C91A09', family: 'red' }]);
            assert.equal(mgr.getColorById(4).name, 'Red');     // 67
        });

        it('akzeptiert ColorDefinition-Instanzen direkt', () => {
            const mgr = ColorManager.instance();
            const def = new ColorDefinition({ id: 4, name: 'Red', hex: '#C91A09', family: 'red' });
            const result = mgr.importColors([def]);
            assert.equal(result.imported, 1);                   // 68
        });

        it('leere Eingabe ergibt imported=0 und skipped=0', () => {
            const mgr = ColorManager.instance();
            const result = mgr.importColors([]);
            assert.equal(result.imported, 0);                   // 69
            assert.equal(result.skipped,  0);                   // 70
        });
    });

    // ── getPalette() / getFallbackHex() ───────────────────────────────────────

    describe('getPalette() / getFallbackHex()', () => {

        it('getPalette() gibt eine ColorPalette-Instanz zurück', () => {
            const mgr = ColorManager.instance();
            assert.ok(mgr.getPalette() instanceof ColorPalette); // 71
        });

        it('getFallbackHex() gibt einen numerischen Wert zurück', () => {
            const mgr = ColorManager.instance();
            assert.equal(typeof mgr.getFallbackHex(), 'number'); // 72
        });

        it('Standardwert für getFallbackHex() ist 0x4488FF', () => {
            const mgr = ColorManager.instance();
            assert.equal(mgr.getFallbackHex(), 0x4488FF);       // 73
        });

        it('benutzerdefinierter fallbackColor wird übernommen', () => {
            ColorManager.resetInstance();
            const mgr = ColorManager.instance({ fallbackColor: 0xDEADBE });
            assert.equal(mgr.getFallbackHex(), 0xDEADBE);       // 74
        });
    });
});
