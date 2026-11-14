import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ColorPalette }    from '../src/catalog/colors/ColorPalette.js';
import { ColorDefinition } from '../src/catalog/colors/ColorDefinition.js';

// ─── Fixture-Daten ────────────────────────────────────────────────────────────

const RED   = { id: 4,  name: 'Red',   displayName: 'Rot',   hex: '#C91A09', family: 'red'   };
const BLUE  = { id: 1,  name: 'Blue',  displayName: 'Blau',  hex: '#0055BF', family: 'blue'  };
const GREEN = { id: 2,  name: 'Green', displayName: 'Grün',  hex: '#257A3E', family: 'green' };
const WHITE = { id: 15, name: 'White', displayName: 'Weiß',  hex: '#FFFFFF', family: 'white' };

/** Transparente Farbe für Familie-Tests. */
const TRANS = {
    id: 24, name: 'Transparent', displayName: 'Transparent',
    hex: '#EEEEEE', family: 'transparent',
    material: { type: 'transparent', roughness: 0.1, metalness: 0, transparent: true, opacity: 0.4 },
};

/** Zweite Farbe in der Familie 'red'. */
const DARK_RED = { id: 59, name: 'Dark Red', displayName: 'Dunkelrot', hex: '#720E0F', family: 'red' };

/** Hilfsfunktion: Palette mit Standardfarben. */
function makeTestPalette() {
    return new ColorPalette([RED, BLUE, GREEN, WHITE, TRANS, DARK_RED]);
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ColorPalette', () => {

    // ── Konstruktor ───────────────────────────────────────────────────────────

    describe('Konstruktor', () => {

        it('erstellt eine leere Palette ohne Argumente', () => {
            const p = new ColorPalette();
            assert.equal(p.getCount(), 0);                      // 1
        });

        it('erstellt eine leere Palette mit leerem Array', () => {
            const p = new ColorPalette([]);
            assert.equal(p.getCount(), 0);                      // 2
        });

        it('erstellt eine Palette mit Rohdaten-Objekten', () => {
            const p = new ColorPalette([RED, BLUE]);
            assert.equal(p.getCount(), 2);                      // 3
        });

        it('erstellt eine Palette mit ColorDefinition-Instanzen', () => {
            const redDef  = new ColorDefinition(RED);
            const blueDef = new ColorDefinition(BLUE);
            const p = new ColorPalette([redDef, blueDef]);
            assert.equal(p.getCount(), 2);                      // 4
        });

        it('überspringt Duplikate (gleiche ID) ohne Fehler', () => {
            const p = new ColorPalette([RED, RED]);
            assert.equal(p.getCount(), 1);                      // 5
        });

        it('gibt bei Duplikat den ersten Eintrag zurück', () => {
            const red2 = { ...RED, name: 'Red2' };
            const p = new ColorPalette([RED, red2]);
            assert.equal(p.getById(4).name, 'Red');             // 6
        });
    });

    // ── getAll() ──────────────────────────────────────────────────────────────

    describe('getAll()', () => {

        it('gibt ein Array zurück', () => {
            const p = makeTestPalette();
            assert.ok(Array.isArray(p.getAll()));               // 7
        });

        it('gibt alle eingefügten Farben zurück', () => {
            const p = makeTestPalette();
            assert.equal(p.getAll().length, 6);                 // 8
        });

        it('gibt eine Kopie zurück, nicht das interne Array', () => {
            const p = makeTestPalette();
            const arr1 = p.getAll();
            const arr2 = p.getAll();
            assert.notEqual(arr1, arr2);                        // 9 – verschiedene Referenzen
        });

        it('Mutation der Kopie verändert nicht die Palette', () => {
            const p = makeTestPalette();
            const arr = p.getAll();
            arr.pop();
            assert.equal(p.getCount(), 6);                      // 10
        });

        it('gibt ColorDefinition-Instanzen zurück', () => {
            const p = makeTestPalette();
            for (const c of p.getAll()) {
                assert.ok(c instanceof ColorDefinition);        // 11 – × 6
            }
        });
    });

    // ── getById() ─────────────────────────────────────────────────────────────

    describe('getById()', () => {

        it('gibt die richtige Farbe für eine bekannte ID zurück', () => {
            const p = makeTestPalette();
            const color = p.getById(4);
            assert.equal(color.name, 'Red');                    // 12
        });

        it('gibt null zurück für eine unbekannte ID', () => {
            const p = makeTestPalette();
            assert.equal(p.getById(999), null);                 // 13
        });

        it('gibt eine ColorDefinition-Instanz zurück', () => {
            const p = makeTestPalette();
            assert.ok(p.getById(1) instanceof ColorDefinition); // 14
        });

        it('gibt null für id=0 zurück, wenn diese nicht in der Palette ist', () => {
            const p = makeTestPalette();
            assert.equal(p.getById(0), null);                   // 15
        });
    });

    // ── getByHex() ────────────────────────────────────────────────────────────

    describe('getByHex()', () => {

        it('findet Farbe mit exaktem Hex-String', () => {
            const p = makeTestPalette();
            assert.equal(p.getByHex('#C91A09').id, 4);         // 16
        });

        it('Suche ist case-insensitiv (Kleinbuchstaben)', () => {
            const p = makeTestPalette();
            assert.equal(p.getByHex('#c91a09').id, 4);         // 17
        });

        it('Suche funktioniert ohne führendes #', () => {
            const p = makeTestPalette();
            assert.equal(p.getByHex('C91A09').id, 4);          // 18
        });

        it('Suche funktioniert mit gemischter Groß-/Kleinschreibung', () => {
            const p = makeTestPalette();
            assert.equal(p.getByHex('#0055bf').id, 1);         // 19
        });

        it('gibt null zurück für einen unbekannten Hex-Wert', () => {
            const p = makeTestPalette();
            assert.equal(p.getByHex('#123456'), null);          // 20
        });
    });

    // ── getByName() ───────────────────────────────────────────────────────────

    describe('getByName()', () => {

        it('findet Farbe anhand des englischen Namens', () => {
            const p = makeTestPalette();
            assert.equal(p.getByName('Red').id, 4);             // 21
        });

        it('findet Farbe anhand des deutschen Anzeigenamens', () => {
            const p = makeTestPalette();
            assert.equal(p.getByName('Rot').id, 4);             // 22
        });

        it('Suche ist case-insensitiv', () => {
            const p = makeTestPalette();
            assert.equal(p.getByName('rot').id, 4);             // 23
        });

        it('findet deutschen displayName "Weiß"', () => {
            const p = makeTestPalette();
            assert.equal(p.getByName('Weiß').id, 15);           // 24
        });

        it('gibt null zurück wenn der Name nicht gefunden wird', () => {
            const p = makeTestPalette();
            assert.equal(p.getByName('Lila'), null);             // 25
        });

        it('gibt null zurück wenn ein Nicht-String übergeben wird', () => {
            const p = makeTestPalette();
            assert.equal(p.getByName(4), null);                  // 26
        });
    });

    // ── getByFamily() ─────────────────────────────────────────────────────────

    describe('getByFamily()', () => {

        it('gibt alle Farben einer Familie zurück', () => {
            const p = makeTestPalette();
            const reds = p.getByFamily('red');
            assert.equal(reds.length, 2);                       // 27
        });

        it('gibt ein Array zurück', () => {
            const p = makeTestPalette();
            assert.ok(Array.isArray(p.getByFamily('blue')));    // 28
        });

        it('gibt ein leeres Array zurück für unbekannte Familie', () => {
            const p = makeTestPalette();
            const result = p.getByFamily('purple');
            assert.equal(result.length, 0);                     // 29
        });

        it('die zurückgegebene Liste enthält ColorDefinition-Instanzen', () => {
            const p = makeTestPalette();
            for (const c of p.getByFamily('red')) {
                assert.ok(c instanceof ColorDefinition);        // 30 – × 2
            }
        });

        it('gibt eine Kopie zurück (nicht das interne Array)', () => {
            const p = makeTestPalette();
            const a1 = p.getByFamily('red');
            const a2 = p.getByFamily('red');
            assert.notEqual(a1, a2);                            // 31
        });
    });

    // ── getFamilies() ─────────────────────────────────────────────────────────

    describe('getFamilies()', () => {

        it('gibt ein Array zurück', () => {
            const p = makeTestPalette();
            assert.ok(Array.isArray(p.getFamilies()));          // 32
        });

        it('gibt eindeutige Familien zurück', () => {
            const p = makeTestPalette();
            const fams = p.getFamilies();
            const unique = new Set(fams);
            assert.equal(fams.length, unique.size);             // 33
        });

        it('gibt Familien in alphabetischer Reihenfolge zurück', () => {
            const p = makeTestPalette();
            const fams = p.getFamilies();
            const sorted = [...fams].sort();
            assert.deepEqual(fams, sorted);                     // 34
        });

        it('enthält alle eingefügten Familien', () => {
            const p = makeTestPalette();
            const fams = p.getFamilies();
            assert.ok(fams.includes('red'));                    // 35
            assert.ok(fams.includes('blue'));                   // 36
            assert.ok(fams.includes('green'));                  // 37
            assert.ok(fams.includes('transparent'));            // 38
        });

        it('gibt leeres Array für leere Palette zurück', () => {
            const p = new ColorPalette();
            assert.deepEqual(p.getFamilies(), []);              // 39
        });
    });

    // ── hasColor() ────────────────────────────────────────────────────────────

    describe('hasColor()', () => {

        it('gibt true zurück für eine vorhandene ID', () => {
            const p = makeTestPalette();
            assert.equal(p.hasColor(4), true);                  // 40
        });

        it('gibt false zurück für eine nicht vorhandene ID', () => {
            const p = makeTestPalette();
            assert.equal(p.hasColor(999), false);               // 41
        });

        it('gibt false zurück für leere Palette', () => {
            const p = new ColorPalette();
            assert.equal(p.hasColor(4), false);                 // 42
        });
    });

    // ── getCount() ────────────────────────────────────────────────────────────

    describe('getCount()', () => {

        it('gibt 0 für leere Palette zurück', () => {
            assert.equal(new ColorPalette().getCount(), 0);     // 43
        });

        it('gibt die korrekte Anzahl nach dem Befüllen zurück', () => {
            const p = new ColorPalette([RED, BLUE, GREEN]);
            assert.equal(p.getCount(), 3);                      // 44
        });

        it('zählt Duplikate nicht doppelt', () => {
            const p = new ColorPalette([RED, RED, BLUE]);
            assert.equal(p.getCount(), 2);                      // 45
        });
    });

    // ── addColor() ────────────────────────────────────────────────────────────

    describe('addColor()', () => {

        it('fügt eine neue Farbe erfolgreich hinzu', () => {
            const p = new ColorPalette([RED]);
            p.addColor(BLUE);
            assert.equal(p.getCount(), 2);                      // 46
        });

        it('gibt die eingefügte ColorDefinition zurück', () => {
            const p = new ColorPalette();
            const result = p.addColor(RED);
            assert.ok(result instanceof ColorDefinition);       // 47
            assert.equal(result.id, 4);                         // 48
        });

        it('akzeptiert Rohdaten-Objekte', () => {
            const p = new ColorPalette();
            p.addColor(RED);
            assert.equal(p.getById(4).name, 'Red');             // 49
        });

        it('akzeptiert ColorDefinition-Instanzen', () => {
            const p = new ColorPalette();
            p.addColor(new ColorDefinition(RED));
            assert.equal(p.hasColor(4), true);                  // 50
        });

        it('wirft einen Fehler bei doppelter ID', () => {
            const p = new ColorPalette([RED]);
            assert.throws(
                () => p.addColor(RED),
                Error,
            );                                                   // 51
        });

        it('macht die neue Farbe per getByHex auffindbar', () => {
            const p = new ColorPalette();
            p.addColor(RED);
            assert.equal(p.getByHex('#C91A09').id, 4);         // 52
        });

        it('macht die neue Farbe per getByFamily auffindbar', () => {
            const p = new ColorPalette();
            p.addColor(RED);
            assert.equal(p.getByFamily('red').length, 1);       // 53
        });
    });

    // ── removeColor() ─────────────────────────────────────────────────────────

    describe('removeColor()', () => {

        it('entfernt eine vorhandene Farbe und gibt true zurück', () => {
            const p = makeTestPalette();
            const result = p.removeColor(4);
            assert.equal(result, true);                         // 54
        });

        it('verringert die Anzahl nach dem Entfernen', () => {
            const p = makeTestPalette();
            p.removeColor(4);
            assert.equal(p.getCount(), 5);                      // 55
        });

        it('entfernte Farbe ist nicht mehr per getById auffindbar', () => {
            const p = makeTestPalette();
            p.removeColor(4);
            assert.equal(p.getById(4), null);                   // 56
        });

        it('entfernte Farbe ist nicht mehr per getByHex auffindbar', () => {
            const p = makeTestPalette();
            p.removeColor(4);
            assert.equal(p.getByHex('#C91A09'), null);         // 57
        });

        it('gibt false zurück für eine nicht vorhandene ID', () => {
            const p = makeTestPalette();
            const result = p.removeColor(999);
            assert.equal(result, false);                        // 58
        });

        it('ändert die Anzahl nicht wenn ID nicht gefunden wird', () => {
            const p = makeTestPalette();
            p.removeColor(999);
            assert.equal(p.getCount(), 6);                      // 59
        });

        it('entfernt Farbe aus dem Familien-Index', () => {
            const p = new ColorPalette([RED, DARK_RED]);
            p.removeColor(4);
            const reds = p.getByFamily('red');
            assert.equal(reds.length, 1);                       // 60
            assert.equal(reds[0].id, 59);                       // 61
        });

        it('bereinigt leere Familien-Einträge', () => {
            const p = new ColorPalette([RED]);
            p.removeColor(4);
            assert.equal(p.getByFamily('red').length, 0);       // 62
            assert.ok(!p.getFamilies().includes('red'));         // 63
        });
    });

    // ── fromJSON() ────────────────────────────────────────────────────────────

    describe('static fromJSON()', () => {

        it('parst einen JSON-String mit colors-Array', () => {
            const json = JSON.stringify({ colors: [RED, BLUE] });
            const p = ColorPalette.fromJSON(json);
            assert.equal(p.getCount(), 2);                      // 64
        });

        it('akzeptiert ein Objekt mit colors-Array (kein String)', () => {
            const p = ColorPalette.fromJSON({ colors: [RED, GREEN] });
            assert.equal(p.getCount(), 2);                      // 65
        });

        it('akzeptiert ein direktes Array', () => {
            const p = ColorPalette.fromJSON([RED, BLUE, WHITE]);
            assert.equal(p.getCount(), 3);                      // 66
        });

        it('gibt eine ColorPalette-Instanz zurück', () => {
            const p = ColorPalette.fromJSON({ colors: [RED] });
            assert.ok(p instanceof ColorPalette);               // 67
        });

        it('wirft SyntaxError für ungültigen JSON-String', () => {
            assert.throws(
                () => ColorPalette.fromJSON('{ ungültig }'),
                SyntaxError,
            );                                                   // 68
        });

        it('wirft TypeError wenn kein colors-Array vorhanden ist', () => {
            assert.throws(
                () => ColorPalette.fromJSON({ data: [] }),
                TypeError,
            );                                                   // 69
        });

        it('die geladenen Farben sind per ID auffindbar', () => {
            const p = ColorPalette.fromJSON({ colors: [RED, BLUE] });
            assert.equal(p.getById(4).name, 'Red');             // 70
            assert.equal(p.getById(1).name, 'Blue');            // 71
        });
    });
});
