import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ColorDefinition } from '../src/catalog/colors/ColorDefinition.js';

// ─── Fixture-Daten ────────────────────────────────────────────────────────────

/** Minimale gültige Rohdaten für eine rote Farbe (LDraw-ID 4). */
const RED_DATA = {
    id:          4,
    name:        'Red',
    displayName: 'Rot',
    hex:         '#C91A09',
    family:      'red',
};

/** Transparente Farbe (id=24, aus lego-colors.json). */
const TRANSPARENT_DATA = {
    id:          24,
    name:        'Transparent',
    displayName: 'Transparent',
    hex:         '#EEEEEE',
    family:      'transparent',
    material:    { type: 'transparent', roughness: 0.1, metalness: 0, transparent: true, opacity: 0.4 },
};

/** Metallische Farbe (metalness >= 0.5). */
const METALLIC_DATA = {
    id:          66,
    name:        'Pearl Light Gray',
    displayName: 'Perlmutt-Hellgrau',
    hex:         '#9CA3A8',
    family:      'metallic',
    material:    { type: 'pearl', roughness: 0.3, metalness: 0.6, transparent: false, opacity: 1 },
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ColorDefinition', () => {

    // ── Konstruktor ───────────────────────────────────────────────────────────

    describe('Konstruktor', () => {

        it('sollte eine gültige Farbdefinition erstellen', () => {
            const def = new ColorDefinition(RED_DATA);
            assert.ok(def instanceof ColorDefinition);           // 1
        });

        it('sollte alle Pflichtfelder aus den Rohdaten übernehmen', () => {
            const def = new ColorDefinition(RED_DATA);
            assert.equal(def.id,          4);                   // 2
            assert.equal(def.name,        'Red');               // 3
            assert.equal(def.displayName, 'Rot');               // 4
            assert.equal(def.hex,         '#C91A09');           // 5
            assert.equal(def.family,      'red');               // 6
        });

        it('sollte das Objekt nach der Erstellung einfrieren (immutable)', () => {
            const def = new ColorDefinition(RED_DATA);
            assert.ok(Object.isFrozen(def));                    // 7
        });

        it('sollte displayName auf name zurückfallen, wenn nicht angegeben', () => {
            const def = new ColorDefinition({ id: 1, name: 'Blue', hex: '#0055BF' });
            assert.equal(def.displayName, 'Blue');              // 8
        });

        it('sollte family auf "unknown" setzen, wenn nicht angegeben', () => {
            const def = new ColorDefinition({ id: 1, name: 'Blue', hex: '#0055BF' });
            assert.equal(def.family, 'unknown');                // 9
        });

        it('sollte name auf String(id) setzen, wenn name nicht angegeben', () => {
            const def = new ColorDefinition({ id: 99, hex: '#AABBCC' });
            assert.equal(def.name, '99');                       // 10
        });

        it('sollte ldrawColorId auf id setzen, wenn nicht explizit angegeben', () => {
            const def = new ColorDefinition(RED_DATA);
            assert.equal(def.ldrawColorId, 4);                  // 11
        });

        it('sollte explizite ldrawColorId übernehmen', () => {
            const def = new ColorDefinition({ ...RED_DATA, ldrawColorId: 99 });
            assert.equal(def.ldrawColorId, 99);                 // 12
        });

        it('sollte Standardmaterial-Eigenschaften verwenden, wenn keine angegeben', () => {
            const def = new ColorDefinition(RED_DATA);
            assert.equal(def.material.type,        'plastic'); // 13
            assert.equal(def.material.roughness,    0.65);     // 14
            assert.equal(def.material.metalness,    0.0);      // 15
            assert.equal(def.material.transparent,  false);    // 16
            assert.equal(def.material.opacity,      1.0);      // 17
        });

        it('sollte übergebene Materialeigenschaften mit Standardwerten zusammenführen', () => {
            const def = new ColorDefinition({ ...RED_DATA, material: { roughness: 0.9 } });
            assert.equal(def.material.roughness,   0.9);       // 18  – überschrieben
            assert.equal(def.material.transparent, false);     // 19  – Standardwert behalten
        });

        it('sollte das material-Objekt einfrieren', () => {
            const def = new ColorDefinition(RED_DATA);
            assert.ok(Object.isFrozen(def.material));           // 20
        });
    });

    // ── Getter ────────────────────────────────────────────────────────────────

    describe('Getter', () => {

        it('id gibt die Farb-ID zurück', () => {
            const def = new ColorDefinition(RED_DATA);
            assert.equal(def.id, 4);                            // 21
        });

        it('name gibt den englischen Standardnamen zurück', () => {
            const def = new ColorDefinition(RED_DATA);
            assert.equal(def.name, 'Red');                      // 22
        });

        it('displayName gibt den deutschen Anzeigenamen zurück', () => {
            const def = new ColorDefinition(RED_DATA);
            assert.equal(def.displayName, 'Rot');               // 23
        });

        it('hex gibt den normalisierten Hex-String zurück', () => {
            const def = new ColorDefinition(RED_DATA);
            assert.equal(def.hex, '#C91A09');                   // 24
        });

        it('family gibt die Farbfamilie zurück', () => {
            const def = new ColorDefinition(RED_DATA);
            assert.equal(def.family, 'red');                    // 25
        });

        it('material gibt das eingefrorene Material-Objekt zurück', () => {
            const def = new ColorDefinition(RED_DATA);
            assert.equal(typeof def.material, 'object');        // 26
            assert.ok('type' in def.material);                  // 27
        });
    });

    // ── hexNumber ─────────────────────────────────────────────────────────────

    describe('hexNumber', () => {

        it('konvertiert #C91A09 korrekt zu 0xC91A09', () => {
            const def = new ColorDefinition(RED_DATA);
            assert.equal(def.hexNumber, 0xC91A09);              // 28
        });

        it('gibt einen numerischen Wert zurück', () => {
            const def = new ColorDefinition(RED_DATA);
            assert.equal(typeof def.hexNumber, 'number');       // 29
        });

        it('konvertiert #FFFFFF zu 0xFFFFFF', () => {
            const def = new ColorDefinition({ id: 15, name: 'White', hex: '#FFFFFF' });
            assert.equal(def.hexNumber, 0xFFFFFF);              // 30
        });

        it('konvertiert #000000 zu 0', () => {
            const def = new ColorDefinition({ id: 0, name: 'Black', hex: '#000000' });
            assert.equal(def.hexNumber, 0x000000);              // 31
        });

        it('konvertiert #0055BF zu 0x0055BF', () => {
            const def = new ColorDefinition({ id: 1, name: 'Blue', hex: '#0055BF' });
            assert.equal(def.hexNumber, 0x0055BF);              // 32
        });
    });

    // ── Kurzschreibweise Hex-Normalisierung ───────────────────────────────────

    describe('Kurzschreibweise Hex-Normalisierung', () => {

        it('expandiert #FFF zu #FFFFFF', () => {
            const def = new ColorDefinition({ id: 1, name: 'White', hex: '#FFF' });
            assert.equal(def.hex, '#FFFFFF');                   // 33
        });

        it('expandiert #F00 zu #FF0000', () => {
            const def = new ColorDefinition({ id: 2, name: 'Red', hex: '#F00' });
            assert.equal(def.hex, '#FF0000');                   // 34
        });

        it('hexNumber aus #FFF entspricht 0xFFFFFF', () => {
            const def = new ColorDefinition({ id: 1, name: 'White', hex: '#FFF' });
            assert.equal(def.hexNumber, 0xFFFFFF);              // 35
        });

        it('normalisiert Kleinbuchstaben zu Großbuchstaben', () => {
            const def = new ColorDefinition({ id: 3, name: 'Green', hex: '#257a3e' });
            assert.equal(def.hex, '#257A3E');                   // 36
        });
    });

    // ── isTransparent ─────────────────────────────────────────────────────────

    describe('isTransparent', () => {

        it('gibt true zurück für transparent=true im Material', () => {
            const def = new ColorDefinition(TRANSPARENT_DATA);
            assert.equal(def.isTransparent, true);              // 37
        });

        it('gibt false zurück für Standardplastik', () => {
            const def = new ColorDefinition(RED_DATA);
            assert.equal(def.isTransparent, false);             // 38
        });

        it('gibt false zurück wenn transparent explizit false ist', () => {
            const def = new ColorDefinition({ ...RED_DATA, material: { transparent: false } });
            assert.equal(def.isTransparent, false);             // 39
        });

        it('gibt true zurück wenn transparent explizit true ist', () => {
            const def = new ColorDefinition({ id: 5, name: 'T', hex: '#AABBCC', material: { transparent: true, opacity: 0.5 } });
            assert.equal(def.isTransparent, true);              // 40
        });
    });

    // ── isMetallic ────────────────────────────────────────────────────────────

    describe('isMetallic', () => {

        it('gibt true zurück wenn metalness >= 0.5', () => {
            const def = new ColorDefinition(METALLIC_DATA);
            assert.equal(def.isMetallic, true);                 // 41
        });

        it('gibt false zurück für Standardplastik (metalness=0)', () => {
            const def = new ColorDefinition(RED_DATA);
            assert.equal(def.isMetallic, false);                // 42
        });

        it('gibt false zurück bei metalness=0.49', () => {
            const def = new ColorDefinition({ ...RED_DATA, material: { metalness: 0.49 } });
            assert.equal(def.isMetallic, false);                // 43
        });

        it('gibt true zurück bei metalness=0.5 (Grenzwert)', () => {
            const def = new ColorDefinition({ ...RED_DATA, material: { metalness: 0.5 } });
            assert.equal(def.isMetallic, true);                 // 44
        });

        it('gibt true zurück bei metalness=1.0', () => {
            const def = new ColorDefinition({ ...RED_DATA, material: { metalness: 1.0 } });
            assert.equal(def.isMetallic, true);                 // 45
        });
    });

    // ── toData() / fromData() Roundtrip ───────────────────────────────────────

    describe('toData() / fromData() Roundtrip', () => {

        it('toData() gibt ein einfaches Objekt zurück', () => {
            const def = new ColorDefinition(RED_DATA);
            const data = def.toData();
            assert.equal(typeof data, 'object');                // 46
            assert.ok(!(data instanceof ColorDefinition));       // 47
        });

        it('toData() enthält alle erwarteten Felder', () => {
            const def = new ColorDefinition(RED_DATA);
            const data = def.toData();
            assert.ok('id'          in data);                   // 48
            assert.ok('name'        in data);                   // 49
            assert.ok('displayName' in data);                   // 50
            assert.ok('hex'         in data);                   // 51
            assert.ok('family'      in data);                   // 52
            assert.ok('ldrawColorId' in data);                  // 53
            assert.ok('material'    in data);                   // 54
        });

        it('fromData(toData(def)) ergibt eine äquivalente Instanz', () => {
            const original = new ColorDefinition(RED_DATA);
            const restored = ColorDefinition.fromData(original.toData());
            assert.equal(restored.id,          original.id);          // 55
            assert.equal(restored.name,        original.name);        // 56
            assert.equal(restored.displayName, original.displayName); // 57
            assert.equal(restored.hex,         original.hex);         // 58
            assert.equal(restored.family,      original.family);      // 59
            assert.equal(restored.hexNumber,   original.hexNumber);   // 60
        });

        it('fromData(toData(def)) erhält Materialeigenschaften', () => {
            const original = new ColorDefinition(METALLIC_DATA);
            const restored = ColorDefinition.fromData(original.toData());
            assert.equal(restored.material.metalness, original.material.metalness); // 61
            assert.equal(restored.isMetallic,         original.isMetallic);         // 62
        });

        it('fromData(toData(def)) erhält Transparenz', () => {
            const original = new ColorDefinition(TRANSPARENT_DATA);
            const restored = ColorDefinition.fromData(original.toData());
            assert.equal(restored.isTransparent, true);                             // 63
        });

        it('toData() gibt ein nicht-eingefrorenes material-Objekt zurück', () => {
            const def  = new ColorDefinition(RED_DATA);
            const data = def.toData();
            // Muss mutierbar sein (kein Fehler beim Schreiben)
            data.material.roughness = 0.1;
            assert.equal(data.material.roughness, 0.1);                             // 64
        });
    });

    // ── DEFAULT_MATERIAL ──────────────────────────────────────────────────────

    describe('DEFAULT_MATERIAL', () => {

        it('ist vorhanden als statische Eigenschaft', () => {
            assert.ok(ColorDefinition.DEFAULT_MATERIAL);        // 65
        });

        it('hat die erwarteten Schlüssel', () => {
            const dm = ColorDefinition.DEFAULT_MATERIAL;
            assert.ok('type'        in dm);                     // 66
            assert.ok('roughness'   in dm);                     // 67
            assert.ok('metalness'   in dm);                     // 68
            assert.ok('transparent' in dm);                     // 69
            assert.ok('opacity'     in dm);                     // 70
        });

        it('type ist "plastic"', () => {
            assert.equal(ColorDefinition.DEFAULT_MATERIAL.type, 'plastic'); // 71
        });

        it('transparent ist false', () => {
            assert.equal(ColorDefinition.DEFAULT_MATERIAL.transparent, false); // 72
        });

        it('ist eingefroren (unveränderlich)', () => {
            assert.ok(Object.isFrozen(ColorDefinition.DEFAULT_MATERIAL));       // 73
        });
    });

    // ── Fehlerfälle ───────────────────────────────────────────────────────────

    describe('Fehlerfälle', () => {

        it('wirft TypeError wenn keine Definition übergeben wird', () => {
            assert.throws(
                () => new ColorDefinition(null),
                TypeError,
            );                                                   // 74
        });

        it('wirft TypeError wenn id fehlt (undefined)', () => {
            assert.throws(
                () => new ColorDefinition({ name: 'X', hex: '#FF0000' }),
                TypeError,
            );                                                   // 75
        });

        it('wirft TypeError wenn id kein Number ist (String)', () => {
            assert.throws(
                () => new ColorDefinition({ id: '4', name: 'X', hex: '#FF0000' }),
                TypeError,
            );                                                   // 76
        });

        it('wirft TypeError wenn hex fehlt (undefined)', () => {
            assert.throws(
                () => new ColorDefinition({ id: 4, name: 'X' }),
                TypeError,
            );                                                   // 77
        });

        it('wirft TypeError wenn hex kein String ist', () => {
            assert.throws(
                () => new ColorDefinition({ id: 4, name: 'X', hex: 0xC91A09 }),
                TypeError,
            );                                                   // 78
        });

        it('wirft RangeError wenn id negativ ist', () => {
            assert.throws(
                () => new ColorDefinition({ id: -1, name: 'X', hex: '#FF0000' }),
                RangeError,
            );                                                   // 79
        });

        it('wirft TypeError wenn id Infinity ist', () => {
            assert.throws(
                () => new ColorDefinition({ id: Infinity, name: 'X', hex: '#FF0000' }),
                TypeError,
            );                                                   // 80
        });

        it('wirft TypeError wenn Definition kein Objekt ist (number)', () => {
            assert.throws(
                () => new ColorDefinition(42),
                TypeError,
            );                                                   // 81
        });
    });

    // ── toString() ────────────────────────────────────────────────────────────

    describe('toString()', () => {

        it('gibt einen lesbaren String zurück', () => {
            const def = new ColorDefinition(RED_DATA);
            const str = def.toString();
            assert.equal(typeof str, 'string');                 // 82
            assert.ok(str.includes('4'));                       // 83  enthält id
            assert.ok(str.includes('Red'));                     // 84  enthält name
            assert.ok(str.includes('#C91A09'));                 // 85  enthält hex
        });
    });
});
