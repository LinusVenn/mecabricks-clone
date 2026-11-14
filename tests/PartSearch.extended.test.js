/**
 * Erweiterte Tests für PartSearch (library/PartSearch.js)
 *
 * Abdeckung von Lücken:
 *  - filterBySize() mit allowRotation: false
 *  - filterBySize() mit nur depth (width null = Wildcard)
 *  - filterBySize() mit nicht-finiten Werten
 *  - isPlaceable() – null-Eingabe, placementSupported fehlt, nicht in PART_DEFINITIONS
 *  - filter() – physicalOnly, verifiedOnly, placeableOnly
 *  - filter() – nur width (ohne depth) → kein Größenfilter
 *  - Mehrtermsuche (AND-Logik)
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PartSearch } from '../src/library/PartSearch.js';


// ─── Mock-Katalog ─────────────────────────────────────────────────────────────

const EXTENDED_PARTS = [
    {
        id: 'brick_2x4', name: '2 x 4 Stein',
        category: 'bricks', geometry: 'brick',
        width: 4, depth: 2, studs: true,
        description: 'Klassischer Grundstein',
        tags: ['stein', 'grundstein', '2x4'],
        isPhysical: true,
        isVerified: true,
        placementSupported: true   // in PART_DEFINITIONS
    },
    {
        id: 'plate_2x4', name: '2 x 4 Platte',
        category: 'plates', geometry: 'plate',
        width: 4, depth: 2, studs: true,
        description: '2×4-Platte mit acht Noppen',
        tags: ['platte', '2x4', 'flach'],
        isPhysical: true,
        isVerified: false,
        placementSupported: false
    },
    {
        id: 'tile_1x2', name: '1 x 2 Fliese',
        category: 'tiles', geometry: 'tile',
        width: 2, depth: 1, studs: false,
        description: 'Glatte Fliese',
        tags: ['fliese', '1x2'],
        isPhysical: false,
        isVerified: true,
        placementSupported: false
    },
    {
        id: 'custom_nonphysical', name: 'Virtuelles Bauteil',
        category: 'bricks', geometry: 'brick',
        width: 2, depth: 2,
        tags: ['virtual'],
        isPhysical: false,
        isVerified: false,
        placementSupported: false
    }
];

class ExtendedMockCatalog {
    getAllParts() { return EXTENDED_PARTS; }
}


// ─── filterBySize() Erweiterungen ─────────────────────────────────────────────

describe('PartSearch – filterBySize() Erweiterungen', () => {

    let search;

    beforeEach(() => {
        search = new PartSearch(new ExtendedMockCatalog());
    });

    it('findet brick_2x4 mit allowRotation: true (Standard) bei 2×4-Suche', () => {
        const results = search.filterBySize(EXTENDED_PARTS, 2, 4);  // gedreht

        const ids = results.map(p => p.id);
        assert.ok(ids.includes('brick_2x4'), '2×4 mit Rotation muss brick_2x4 (4×2) finden');
        assert.ok(ids.includes('plate_2x4'), '2×4 mit Rotation muss plate_2x4 (4×2) finden');
    });

    it('findet brick_2x4 NICHT mit allowRotation: false bei 2×4-Suche', () => {
        const results = search.filterBySize(EXTENDED_PARTS, 2, 4, false);

        const ids = results.map(p => p.id);
        assert.ok(!ids.includes('brick_2x4'), 'brick_2x4 (4×2) darf bei allowRotation:false nicht als 2×4 gefunden werden');
    });

    it('findet brick_2x4 direkt mit allowRotation: false bei 4×2-Suche', () => {
        const results = search.filterBySize(EXTENDED_PARTS, 4, 2, false);

        const ids = results.map(p => p.id);
        assert.ok(ids.includes('brick_2x4'));
    });

    it('Wildcard depth (null) → filtert nur nach width', () => {
        // Alle Teile mit width=4, egal welche depth
        const results = search.filterBySize(EXTENDED_PARTS, 4, null);

        const ids = results.map(p => p.id);
        assert.ok(ids.includes('brick_2x4'));
        assert.ok(ids.includes('plate_2x4'));
        assert.ok(!ids.includes('tile_1x2'), 'tile_1x2 hat width=2, darf nicht dabei sein');
    });

    it('Wildcard width (null) → filtert nur nach depth', () => {
        // Alle Teile mit depth=2
        const results = search.filterBySize(EXTENDED_PARTS, null, 2);

        const ids = results.map(p => p.id);
        assert.ok(ids.includes('brick_2x4'));  // depth=2
        assert.ok(ids.includes('plate_2x4')); // depth=2
        assert.ok(!ids.includes('tile_1x2'), 'tile_1x2 hat depth=1');
    });

    it('gibt leeres Array zurück für nicht-finiten width-Wert', () => {
        const results = search.filterBySize(EXTENDED_PARTS, 'abc', 2);
        assert.deepStrictEqual(results, []);
    });

    it('gibt leeres Array zurück für nicht-finiten depth-Wert', () => {
        const results = search.filterBySize(EXTENDED_PARTS, 4, 'nicht-zahl');
        assert.deepStrictEqual(results, []);
    });

    it('gibt leeres Array zurück für NaN-Wert', () => {
        const results = search.filterBySize(EXTENDED_PARTS, NaN, 2);
        assert.deepStrictEqual(results, []);
    });

    it('gibt alle Teile zurück wenn beide Dimensionen null sind', () => {
        const results = search.filterBySize(EXTENDED_PARTS, null, null);
        assert.strictEqual(results.length, EXTENDED_PARTS.length);
    });
});


// ─── isPlaceable() Erweiterungen ─────────────────────────────────────────────

describe('PartSearch – isPlaceable() Randfälle', () => {

    let search;

    beforeEach(() => {
        search = new PartSearch(new ExtendedMockCatalog());
    });

    it('gibt false zurück für null-Eingabe', () => {
        assert.strictEqual(search.isPlaceable(null), false);
    });

    it('gibt false zurück für undefined-Eingabe', () => {
        assert.strictEqual(search.isPlaceable(undefined), false);
    });

    it('gibt false zurück wenn placementSupported fehlt (undefined)', () => {
        assert.strictEqual(
            search.isPlaceable({ id: 'brick_2x4' }),
            false
        );
    });

    it('gibt false zurück wenn placementSupported: false', () => {
        assert.strictEqual(
            search.isPlaceable({ id: 'brick_2x4', placementSupported: false }),
            false
        );
    });

    it('gibt false zurück für unbekannte ID auch wenn placementSupported: true', () => {
        // 'custom_xyz_not_in_definitions' ist nicht in PART_DEFINITIONS
        assert.strictEqual(
            search.isPlaceable({ id: 'custom_xyz_not_in_definitions', placementSupported: true }),
            false
        );
    });

    it('gibt true zurück für brick_2x4 mit placementSupported: true (in PART_DEFINITIONS)', () => {
        // brick_2x4 ist in PART_DEFINITIONS (Teil der eingebauten Definitionen)
        assert.strictEqual(
            search.isPlaceable({ id: 'brick_2x4', placementSupported: true }),
            true
        );
    });
});


// ─── filter() – Flags ─────────────────────────────────────────────────────────

describe('PartSearch – filter() Flags', () => {

    let search;

    beforeEach(() => {
        search = new PartSearch(new ExtendedMockCatalog());
    });

    it('physicalOnly: true filtert auf Teile mit isPhysical: true', () => {
        const results = search.filter({ physicalOnly: true });

        assert.ok(results.every(p => p.isPhysical === true),
            'Alle Ergebnisse müssen isPhysical: true haben');
        assert.ok(results.some(p => p.id === 'brick_2x4'));
        assert.ok(results.some(p => p.id === 'plate_2x4'));
        assert.ok(!results.some(p => p.id === 'tile_1x2'));
        assert.ok(!results.some(p => p.id === 'custom_nonphysical'));
    });

    it('verifiedOnly: true filtert auf Teile mit isVerified: true', () => {
        const results = search.filter({ verifiedOnly: true });

        assert.ok(results.every(p => p.isVerified === true),
            'Alle Ergebnisse müssen isVerified: true haben');
        assert.ok(results.some(p => p.id === 'brick_2x4'));
        assert.ok(results.some(p => p.id === 'tile_1x2'));
        assert.ok(!results.some(p => p.id === 'plate_2x4'));
    });

    it('placeableOnly: true filtert auf platzierbare Teile', () => {
        const results = search.filter({ placeableOnly: true });

        // Nur brick_2x4 ist in PART_DEFINITIONS und hat placementSupported: true
        assert.ok(results.every(p => search.isPlaceable(p)),
            'Alle Ergebnisse müssen platzierbar sein');
        assert.ok(results.some(p => p.id === 'brick_2x4'));
    });

    it('Kombination: physicalOnly + verifiedOnly', () => {
        const results = search.filter({ physicalOnly: true, verifiedOnly: true });

        // Nur brick_2x4 ist physisch UND verifiziert
        for (const p of results) {
            assert.strictEqual(p.isPhysical, true);
            assert.strictEqual(p.isVerified, true);
        }
        assert.ok(results.some(p => p.id === 'brick_2x4'));
    });

    it('filter() ohne Flags gibt alle Teile zurück', () => {
        const results = search.filter({});
        assert.strictEqual(results.length, EXTENDED_PARTS.length);
    });
});


// ─── filter() – nur width ohne depth ─────────────────────────────────────────

describe('PartSearch – filter() Größenfilter nur bei BEIDEN Dimensionen', () => {

    let search;

    beforeEach(() => {
        search = new PartSearch(new ExtendedMockCatalog());
    });

    it('filter({ width: 4 }) ohne depth → kein Größenfilter → alle Teile', () => {
        // Laut Implementierung: filterBySize wird nur aufgerufen wenn width !== null && depth !== null
        const results = search.filter({ width: 4 });
        assert.strictEqual(results.length, EXTENDED_PARTS.length,
            'Ohne depth darf kein Größenfilter aktiv sein');
    });

    it('filter({ depth: 2 }) ohne width → kein Größenfilter → alle Teile', () => {
        const results = search.filter({ depth: 2 });
        assert.strictEqual(results.length, EXTENDED_PARTS.length,
            'Ohne width darf kein Größenfilter aktiv sein');
    });

    it('filter({ width: 4, depth: 2 }) → Größenfilter aktiv', () => {
        const results = search.filter({ width: 4, depth: 2 });

        // Nur 4×2 Teile (brick_2x4 und plate_2x4)
        for (const p of results) {
            const matchesDirect  = p.width === 4 && p.depth === 2;
            const matchesRotated = p.width === 2 && p.depth === 4;
            assert.ok(matchesDirect || matchesRotated,
                `${p.id}: Dimensionen ${p.width}×${p.depth} passen nicht zu 4×2`);
        }
    });
});


// ─── search() – Mehrterm-Suche ────────────────────────────────────────────────

describe('PartSearch – Mehrterm-Suche (AND-Logik)', () => {

    const MULTI_PARTS = [
        {
            id: 'brick_2x4', name: '2 x 4 Stein',
            category: 'bricks', geometry: 'brick',
            description: 'Klassischer Grundstein',
            tags: ['stein', 'grundstein', '2x4', 'standard']
        },
        {
            id: 'plate_2x4', name: '2 x 4 Platte',
            category: 'plates', geometry: 'plate',
            description: '2×4-Platte mit Noppen',
            tags: ['platte', '2x4', 'flach']
        }
    ];

    let search;

    beforeEach(() => {
        search = new PartSearch({ getAllParts: () => MULTI_PARTS });
    });

    it('mehrtermige Suche "grundstein 2x4" → nur brick_2x4 (AND-Logik)', () => {
        const results = search.search('grundstein 2x4', MULTI_PARTS);

        assert.ok(results.some(p => p.id === 'brick_2x4'), 'brick_2x4 muss gefunden werden');
        assert.ok(!results.some(p => p.id === 'plate_2x4'), 'plate_2x4 darf nicht gefunden werden');
    });

    it('mehrtermige Suche "platte 2x4" → nur plate_2x4', () => {
        const results = search.search('platte 2x4', MULTI_PARTS);

        assert.ok(results.some(p => p.id === 'plate_2x4'));
        assert.ok(!results.some(p => p.id === 'brick_2x4'));
    });

    it('mehrtermige Suche "2x4 stein" → nur brick_2x4', () => {
        const results = search.search('2x4 stein', MULTI_PARTS);

        assert.ok(results.some(p => p.id === 'brick_2x4'));
        assert.ok(!results.some(p => p.id === 'plate_2x4'));
    });

    it('mehrtermige Suche mit nicht-vorhandenem Term → kein Ergebnis', () => {
        const results = search.search('2x4 fenster', MULTI_PARTS);

        assert.strictEqual(results.length, 0, '"fenster" ist in keinem Teil enthalten');
    });

    it('einzelne Suche "2x4" → beide Teile (teilen das Tag)', () => {
        const results = search.search('2x4', MULTI_PARTS);

        assert.ok(results.some(p => p.id === 'brick_2x4'));
        assert.ok(results.some(p => p.id === 'plate_2x4'));
    });
});
