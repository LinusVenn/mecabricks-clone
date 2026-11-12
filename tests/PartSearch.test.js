import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PartSearch } from '../src/library/PartSearch.js';
import { PartCatalog } from '../src/library/PartCatalog.js';

// ---------------------------------------------------------------------------
// Minimaler Mock-Katalog für deterministische Tests.
// Unabhängig von Änderungen an PART_DEFINITIONS.
// ---------------------------------------------------------------------------

const MOCK_PARTS = [
    {
        id: 'brick_2x4',   name: '2 x 4 Stein',
        category: 'bricks',  geometry: 'brick',
        width: 4, depth: 2,  studs: true,
        description: 'Klassischer Grundstein',
        tags: ['stein', 'grundstein', '2x4', 'standard']
    },
    {
        id: 'brick_2x2',   name: '2 x 2 Stein',
        category: 'bricks',  geometry: 'brick',
        width: 2, depth: 2,  studs: true,
        description: 'Quadratischer Stein',
        tags: ['stein', '2x2', 'quadrat']
    },
    {
        id: 'plate_2x4',   name: '2 x 4 Platte',
        category: 'plates',  geometry: 'plate',
        width: 4, depth: 2,  studs: true,
        description: '2×4-Platte mit acht Noppen',
        tags: ['platte', '2x4', 'flach']
    },
    {
        id: 'tile_1x2',    name: '1 x 2 Fliese',
        category: 'tiles',   geometry: 'tile',
        width: 2, depth: 1,  studs: false,
        description: 'Glatte Fliese ohne Noppen',
        tags: ['fliese', '1x2', 'glatt']
    },
    {
        id: 'slope_2x2',   name: '2 x 2 Schrägstein',
        category: 'slopes',  geometry: 'slope',
        width: 2, depth: 2,  studs: false,
        description: '45°-Schrägstein für Dächer',
        tags: ['schraeg', 'dach', '2x2']
    },
    {
        id: 'technic_beam_3', name: 'Technic Balken 3',
        category: 'technic',  geometry: 'technic',
        width: 3, depth: 1,  studs: false,
        description: 'Technic-Balken mit 3 Löchern',
        tags: ['technic', 'balken', 'loch', '3']
    },
];

class MockCatalog {
    getAllParts() { return MOCK_PARTS; }
}


describe('PartSearch', () => {

    let search;

    beforeEach(() => {
        search = new PartSearch(new MockCatalog());
    });


    // ── Konstruktor ────────────────────────────────────────────────────

    describe('Konstruktor', () => {

        it('erstellt eine Instanz mit Mock-Katalog', () => {
            assert.ok(search instanceof PartSearch);
        });

        it('erstellt eine Instanz ohne Argumente (nutzt Singleton)', () => {
            // Smoke-Test – wirft nicht
            const s = new PartSearch();
            assert.ok(s instanceof PartSearch);
        });
    });


    // ── search() ──────────────────────────────────────────────────────

    describe('search()', () => {

        it('leere Suche liefert alle Bauteile', () => {
            assert.strictEqual(search.search('').length, MOCK_PARTS.length);
        });

        it('null-Suche liefert alle Bauteile', () => {
            assert.strictEqual(search.search(null).length, MOCK_PARTS.length);
        });

        it('Leerzeichen-Suche liefert alle Bauteile', () => {
            assert.strictEqual(search.search('   ').length, MOCK_PARTS.length);
        });

        it('"brick" findet brick_2x4 und brick_2x2', () => {
            const results = search.search('brick');
            assert.ok(results.some(p => p.id === 'brick_2x4'));
            assert.ok(results.some(p => p.id === 'brick_2x2'));
        });

        it('"STEIN" (Großbuchstaben) matcht trotzdem', () => {
            const results = search.search('STEIN');
            assert.ok(results.length > 0);
        });

        it('"grundstein" findet brick_2x4 über Tags', () => {
            const results = search.search('grundstein');
            assert.ok(results.some(p => p.id === 'brick_2x4'));
        });

        it('"2x4" findet brick_2x4 und plate_2x4 über Tags', () => {
            const results = search.search('2x4');
            const ids = results.map(p => p.id);
            assert.ok(ids.includes('brick_2x4'));
            assert.ok(ids.includes('plate_2x4'));
        });

        it('"noppen" findet plate_2x4 über description', () => {
            const results = search.search('noppen');
            assert.ok(results.some(p => p.id === 'plate_2x4'));
        });

        it('"dach" findet slope_2x2 über Tags', () => {
            const results = search.search('dach');
            assert.ok(results.some(p => p.id === 'slope_2x2'));
        });

        it('"technic" findet technic_beam_3', () => {
            const results = search.search('technic');
            assert.ok(results.some(p => p.id === 'technic_beam_3'));
        });

        it('"xyz_nicht_vorhanden" liefert leeres Array', () => {
            assert.deepStrictEqual(search.search('xyz_nicht_vorhanden'), []);
            assert.deepStrictEqual(search.search('xyz_nicht_vorhanden_12345'), []);
        });

        it('Suche mit optionalem Pool beschränkt sich auf den Pool', () => {
            const pool = MOCK_PARTS.filter(p => p.category === 'bricks');
            const results = search.search('platte', pool);
            // "platte" ist kein Begriff in bricks – leeres Ergebnis
            assert.strictEqual(results.length, 0);
        });

        it('Suche mit Pool: findet "grundstein" nur im bricks-Pool', () => {
            const pool = MOCK_PARTS.filter(p => p.category === 'bricks');
            const results = search.search('grundstein', pool);
            assert.ok(results.length > 0);
            for (const p of results) {
                assert.strictEqual(p.category, 'bricks');
            }
        });
    });


    // ── filterByCategory() ────────────────────────────────────────────

    describe('filterByCategory()', () => {

        it('leere Kategorie liefert alle Bauteile', () => {
            assert.strictEqual(search.filterByCategory(MOCK_PARTS, '').length, MOCK_PARTS.length);
        });

        it('null-Kategorie liefert alle Bauteile', () => {
            assert.strictEqual(search.filterByCategory(MOCK_PARTS, null).length, MOCK_PARTS.length);
        });

        it('"bricks" liefert nur Steine', () => {
            const results = search.filterByCategory(MOCK_PARTS, 'bricks');
            assert.ok(results.length > 0);
            for (const p of results) {
                assert.strictEqual(p.category, 'bricks');
            }
        });

        it('"plates" liefert nur Platten', () => {
            const results = search.filterByCategory(MOCK_PARTS, 'plates');
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].id, 'plate_2x4');
        });

        it('"unknown_xyz" liefert leeres Array', () => {
            assert.deepStrictEqual(search.filterByCategory(MOCK_PARTS, 'unknown_xyz'), []);
        });
    });


    // ── filterByGeometry() ────────────────────────────────────────────

    describe('filterByGeometry()', () => {

        it('leere Geometry liefert alle Bauteile', () => {
            assert.strictEqual(search.filterByGeometry(MOCK_PARTS, '').length, MOCK_PARTS.length);
        });

        it('null liefert alle Bauteile', () => {
            assert.strictEqual(search.filterByGeometry(MOCK_PARTS, null).length, MOCK_PARTS.length);
        });

        it('"plate" liefert nur plate_2x4', () => {
            const results = search.filterByGeometry(MOCK_PARTS, 'plate');
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].id, 'plate_2x4');
        });

        it('"technic" liefert nur technic_beam_3', () => {
            const results = search.filterByGeometry(MOCK_PARTS, 'technic');
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].id, 'technic_beam_3');
        });

        it('"unknown" liefert leeres Array', () => {
            assert.deepStrictEqual(search.filterByGeometry(MOCK_PARTS, 'unknown'), []);
        });
    });


    // ── filterBySize() ────────────────────────────────────────────────

    describe('filterBySize()', () => {

        it('width=null, depth=null liefert alle Bauteile', () => {
            assert.strictEqual(
                search.filterBySize(MOCK_PARTS, null, null).length,
                MOCK_PARTS.length
            );
        });

        it('width=4 findet brick_2x4 und plate_2x4', () => {
            const results = search.filterBySize(MOCK_PARTS, 4, null);
            const ids = results.map(p => p.id);
            assert.ok(ids.includes('brick_2x4'));
            assert.ok(ids.includes('plate_2x4'));
        });

        it('width=2, depth=1 findet tile_1x2', () => {
            const results = search.filterBySize(MOCK_PARTS, 2, 1);
            assert.ok(results.some(p => p.id === 'tile_1x2'));
        });

        it('width=99 liefert leeres Array', () => {
            assert.deepStrictEqual(search.filterBySize(MOCK_PARTS, 99, null), []);
        });
    });


    // ── filter() (kombiniert) ─────────────────────────────────────────

    describe('filter()', () => {

        it('kein Argument liefert alle Bauteile', () => {
            assert.strictEqual(search.filter().length, MOCK_PARTS.length);
        });

        it('leere Optionen liefern alle Bauteile', () => {
            assert.strictEqual(search.filter({}).length, MOCK_PARTS.length);
        });

        it('{ category: "bricks" } liefert nur Steine', () => {
            const results = search.filter({ category: 'bricks' });
            for (const p of results) {
                assert.strictEqual(p.category, 'bricks');
            }
        });

        it('{ query: "technic" } findet technic_beam_3', () => {
            const results = search.filter({ query: 'technic' });
            assert.ok(results.some(p => p.id === 'technic_beam_3'));
        });

        it('{ category: "bricks", query: "2x4" } findet brick_2x4', () => {
            const results = search.filter({ category: 'bricks', query: '2x4' });
            assert.ok(results.some(p => p.id === 'brick_2x4'));
            // plate_2x4 darf nicht erscheinen (falscher Kategorie)
            assert.ok(!results.some(p => p.id === 'plate_2x4'));
        });

        it('{ geometry: "slope" } liefert nur slope_2x2', () => {
            const results = search.filter({ geometry: 'slope' });
            assert.strictEqual(results.length, 1);
            assert.strictEqual(results[0].id, 'slope_2x2');
        });

        it('{ category: "bricks", query: "xyz_niemals_gefunden" } liefert []', () => {
            assert.deepStrictEqual(
                search.filter({ category: 'bricks', query: 'xyz_niemals_gefunden' }),
                []
            );
        });

        it('{ width: 4 } findet brick_2x4 und plate_2x4', () => {
            const results = search.filter({ width: 4 });
            const ids = results.map(p => p.id);
            assert.ok(ids.includes('brick_2x4'));
            assert.ok(ids.includes('plate_2x4'));
        });
    });
});
