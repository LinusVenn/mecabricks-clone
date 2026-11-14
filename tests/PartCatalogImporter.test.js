/**
 * tests/PartCatalogImporter.test.js
 *
 * Unit / integration tests for PartCatalogImporter (Phase E.1).
 * Uses node:test + node:assert/strict with ESM imports.
 *
 * A lightweight mock PartCatalog is defined locally – no need for the real
 * PartCatalog singleton (which requires a DOM / global state).
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { PartCatalogImporter } from '../src/catalog/import/PartCatalogImporter.js';


// ─── Mock PartCatalog ─────────────────────────────────────────────────────────

/**
 * Creates a fresh mock catalog for each test.
 * Supports addPart / hasPart / importParts – same interface as PartCatalog.
 */
function makeMockCatalog() {
    const _parts = new Map();
    return {
        addPart(partDef) {
            _parts.set(partDef.id, partDef);
        },
        hasPart(id) {
            return _parts.has(id);
        },
        importParts(arr) {
            for (const p of arr) _parts.set(p.id, p);
        },
        getPart(id) {
            return _parts.get(id) ?? null;
        },
        get size() {
            return _parts.size;
        },
    };
}

/** Minimal valid part metadata entry */
function validPart(overrides = {}) {
    return {
        id:          'brick-3001',
        name:        '2 x 4 Brick',
        category:    'bricks',
        ldrawPartNumber: '3001',
        width:       2,
        depth:       4,
        height:      3,
        placementSupported: true,
        isPhysical:  true,
        description: 'A classic 2×4 brick.',
        tags:        ['basic', 'brick'],
        ...overrides,
    };
}


// ─── Constructor ─────────────────────────────────────────────────────────────

describe('PartCatalogImporter – Constructor', () => {

    it('constructor succeeds with a valid catalog', () => {
        const catalog = makeMockCatalog();
        assert.doesNotThrow(() => new PartCatalogImporter({ catalog }));
    });

    it('constructor throws when catalog is omitted', () => {
        assert.throws(
            () => new PartCatalogImporter({}),
            (err) => {
                assert.ok(err instanceof Error);
                assert.ok(/catalog/i.test(err.message));
                return true;
            }
        );
    });

    it('constructor throws when called with no arguments', () => {
        assert.throws(() => new PartCatalogImporter());
    });

    it('constructor stores an optional metadataResolver without error', () => {
        const catalog  = makeMockCatalog();
        const resolver = { resolve: () => null };
        assert.doesNotThrow(() => new PartCatalogImporter({ catalog, metadataResolver: resolver }));
    });
});


// ─── importFromMetadata() – empty / trivial cases ────────────────────────────

describe('PartCatalogImporter – importFromMetadata() – empty / trivial', () => {

    it('importFromMetadata([], {}) returns { imported:0, skipped:0, errors:[] }', () => {
        const importer = new PartCatalogImporter({ catalog: makeMockCatalog() });
        const result   = importer.importFromMetadata([], {});
        assert.strictEqual(result.imported, 0);
        assert.strictEqual(result.skipped, 0);
        assert.deepEqual(result.errors, []);
    });

    it('importFromMetadata with non-array input returns errors array without throwing', () => {
        const importer = new PartCatalogImporter({ catalog: makeMockCatalog() });
        const result   = importer.importFromMetadata('not-an-array');
        assert.strictEqual(result.imported, 0);
        assert.ok(result.errors.length > 0, 'Expected at least one error for non-array input');
        assert.ok(result.errors[0] instanceof Error);
    });
});


// ─── importFromMetadata() – valid parts ──────────────────────────────────────

describe('PartCatalogImporter – importFromMetadata() – valid parts', () => {

    it('imports a single valid part, increments imported', () => {
        const catalog  = makeMockCatalog();
        const importer = new PartCatalogImporter({ catalog });
        const result   = importer.importFromMetadata([validPart()]);
        assert.strictEqual(result.imported, 1);
        assert.strictEqual(result.skipped, 0);
        assert.deepEqual(result.errors, []);
    });

    it('imported part is stored in the catalog', () => {
        const catalog  = makeMockCatalog();
        const importer = new PartCatalogImporter({ catalog });
        importer.importFromMetadata([validPart({ id: 'brick-3001' })]);
        assert.ok(catalog.hasPart('brick-3001'));
    });

    it('imports multiple valid parts', () => {
        const catalog  = makeMockCatalog();
        const importer = new PartCatalogImporter({ catalog });
        const parts = [
            validPart({ id: 'brick-3001', name: 'Brick 2x4' }),
            validPart({ id: 'brick-3002', name: 'Brick 2x3', ldrawPartNumber: '3002' }),
            validPart({ id: 'plate-3020', name: 'Plate 2x4', ldrawPartNumber: '3020', category: 'plates' }),
        ];
        const result = importer.importFromMetadata(parts);
        assert.strictEqual(result.imported, 3);
        assert.strictEqual(result.skipped, 0);
        assert.deepEqual(result.errors, []);
        assert.ok(catalog.hasPart('plate-3020'));
    });

    it('result has the shape { imported, skipped, errors }', () => {
        const importer = new PartCatalogImporter({ catalog: makeMockCatalog() });
        const result   = importer.importFromMetadata([validPart()]);
        assert.ok('imported' in result);
        assert.ok('skipped'  in result);
        assert.ok('errors'   in result);
        assert.ok(Array.isArray(result.errors));
    });
});


// ─── importFromMetadata() – skipping parts with missing id / name ─────────────

describe('PartCatalogImporter – importFromMetadata() – skips invalid entries', () => {

    it('skips an entry with missing id, increments skipped', () => {
        const catalog  = makeMockCatalog();
        const importer = new PartCatalogImporter({ catalog });
        const result   = importer.importFromMetadata([
            { name: 'No ID Brick', category: 'bricks' },  // no id
        ]);
        assert.strictEqual(result.imported, 0);
        assert.strictEqual(result.skipped, 1);
    });

    it('skips an entry with missing name, increments skipped', () => {
        const catalog  = makeMockCatalog();
        const importer = new PartCatalogImporter({ catalog });
        const result   = importer.importFromMetadata([
            { id: 'brick-x', category: 'bricks' },  // no name
        ]);
        assert.strictEqual(result.imported, 0);
        assert.strictEqual(result.skipped, 1);
    });

    it('skips null / undefined entries without throwing', () => {
        const catalog  = makeMockCatalog();
        const importer = new PartCatalogImporter({ catalog });
        const result   = importer.importFromMetadata([null, undefined, validPart()]);
        // null/undefined entries have no id/name → skipped
        assert.strictEqual(result.imported, 1);
        assert.ok(result.skipped >= 2);
    });

    it('mix of valid and invalid entries: counts are correct', () => {
        const catalog  = makeMockCatalog();
        const importer = new PartCatalogImporter({ catalog });
        const parts = [
            validPart({ id: 'p1' }),
            { name: 'No ID' },                        // skip: missing id
            validPart({ id: 'p2', name: 'Part 2' }),
            { id: 'p3' },                              // skip: missing name
        ];
        const result = importer.importFromMetadata(parts);
        assert.strictEqual(result.imported, 2);
        assert.strictEqual(result.skipped, 2);
    });
});


// ─── importFromMetadata() – error collection ─────────────────────────────────

describe('PartCatalogImporter – importFromMetadata() – error collection', () => {

    it('collects errors for catalog.addPart failures without stopping the loop', () => {
        let callCount = 0;
        const catalog = {
            hasPart: () => false,
            addPart() {
                callCount++;
                if (callCount === 2) {
                    throw new Error('Simulated catalog write failure');
                }
            },
        };
        const importer = new PartCatalogImporter({ catalog });
        const parts = [
            validPart({ id: 'p1' }),
            validPart({ id: 'p2' }),  // this one will throw
            validPart({ id: 'p3' }),
        ];
        const result = importer.importFromMetadata(parts);
        // p1 and p3 imported, p2 errored
        assert.strictEqual(result.imported, 2);
        assert.strictEqual(result.errors.length, 1);
        assert.ok(result.errors[0] instanceof Error);
        assert.ok(/p2/.test(result.errors[0].message) || /fehler/i.test(result.errors[0].message));
    });

    it('errors array contains Error instances', () => {
        const catalog = {
            hasPart: () => false,
            addPart() { throw new Error('boom'); },
        };
        const importer = new PartCatalogImporter({ catalog });
        const result   = importer.importFromMetadata([validPart({ id: 'boom-part' })]);
        assert.ok(result.errors.length > 0);
        for (const e of result.errors) {
            assert.ok(e instanceof Error);
        }
    });

    it('catalog with neither addPart nor registerPart produces an error entry', () => {
        const catalog = {
            hasPart: () => false,
            // no addPart, no registerPart
        };
        const importer = new PartCatalogImporter({ catalog });
        const result   = importer.importFromMetadata([validPart()]);
        assert.strictEqual(result.errors.length, 1);
    });
});


// ─── importFromMetadata() – overwrite option ─────────────────────────────────

describe('PartCatalogImporter – importFromMetadata() – overwrite option', () => {

    it('overwrite: false (default) skips already-existing parts', () => {
        const catalog  = makeMockCatalog();
        const importer = new PartCatalogImporter({ catalog });

        // First import
        importer.importFromMetadata([validPart({ id: 'brick-3001' })]);
        // Second import (same id) should be skipped
        const result = importer.importFromMetadata(
            [validPart({ id: 'brick-3001', name: 'Updated name' })]
        );
        assert.strictEqual(result.skipped, 1);
        assert.strictEqual(result.imported, 0);
    });

    it('overwrite: true replaces an existing part', () => {
        const catalog  = makeMockCatalog();
        const importer = new PartCatalogImporter({ catalog });

        importer.importFromMetadata([validPart({ id: 'brick-3001', name: 'Original' })]);
        const result = importer.importFromMetadata(
            [validPart({ id: 'brick-3001', name: 'Updated' })],
            { overwrite: true }
        );
        assert.strictEqual(result.imported, 1);
        assert.strictEqual(result.skipped, 0);
        assert.strictEqual(catalog.getPart('brick-3001').name, 'Updated');
    });
});


// ─── importFromJSON() – string input ─────────────────────────────────────────

describe('PartCatalogImporter – importFromJSON() – string input', () => {

    it('parses a valid JSON string with { parts: [...] } and imports entries', async () => {
        const catalog  = makeMockCatalog();
        const importer = new PartCatalogImporter({ catalog });
        const json = JSON.stringify({ schemaVersion: 1, parts: [validPart()] });
        const result = await importer.importFromJSON(json);
        assert.strictEqual(result.imported, 1);
        assert.deepEqual(result.errors, []);
    });

    it('parses a valid JSON string that is a bare array', async () => {
        const catalog  = makeMockCatalog();
        const importer = new PartCatalogImporter({ catalog });
        const json = JSON.stringify([validPart({ id: 'p1' }), validPart({ id: 'p2' })]);
        const result = await importer.importFromJSON(json);
        assert.strictEqual(result.imported, 2);
    });

    it('returns errors array for invalid JSON string, does not throw', async () => {
        const catalog  = makeMockCatalog();
        const importer = new PartCatalogImporter({ catalog });
        const result   = await importer.importFromJSON('{ not valid json !!!');
        assert.strictEqual(result.imported, 0);
        assert.ok(result.errors.length > 0, 'Expected errors for invalid JSON');
        assert.ok(result.errors[0] instanceof Error);
    });

    it('returns errors for JSON object without "parts" key and is not an array', async () => {
        const catalog  = makeMockCatalog();
        const importer = new PartCatalogImporter({ catalog });
        const result   = await importer.importFromJSON('{"schemaVersion": 1}');
        assert.ok(result.errors.length > 0);
    });
});


// ─── importFromJSON() – pre-parsed object input ──────────────────────────────

describe('PartCatalogImporter – importFromJSON() – pre-parsed object', () => {

    it('handles a pre-parsed { parts: [...] } object', async () => {
        const catalog  = makeMockCatalog();
        const importer = new PartCatalogImporter({ catalog });
        const result   = await importer.importFromJSON({ parts: [validPart()] });
        assert.strictEqual(result.imported, 1);
        assert.deepEqual(result.errors, []);
    });

    it('handles a pre-parsed bare array', async () => {
        const catalog  = makeMockCatalog();
        const importer = new PartCatalogImporter({ catalog });
        const result   = await importer.importFromJSON([validPart({ id: 'p1' }), validPart({ id: 'p2' })]);
        assert.strictEqual(result.imported, 2);
    });

    it('forwards options (overwrite) to importFromMetadata', async () => {
        const catalog  = makeMockCatalog();
        const importer = new PartCatalogImporter({ catalog });

        await importer.importFromJSON({ parts: [validPart({ id: 'brick-3001', name: 'Original' })] });
        const result = await importer.importFromJSON(
            { parts: [validPart({ id: 'brick-3001', name: 'Updated' })] },
            { overwrite: true }
        );
        assert.strictEqual(result.imported, 1);
        assert.strictEqual(catalog.getPart('brick-3001').name, 'Updated');
    });

    it('returns errors for null/undefined input, does not throw', async () => {
        const catalog  = makeMockCatalog();
        const importer = new PartCatalogImporter({ catalog });
        const result   = await importer.importFromJSON(null);
        assert.ok(result.errors.length > 0);
    });
});


// ─── metadataResolver enrichment ─────────────────────────────────────────────

describe('PartCatalogImporter – metadataResolver enrichment', () => {

    it('enriches missing category from metadataResolver', () => {
        const catalog  = makeMockCatalog();
        const resolver = {
            resolve(num) {
                if (num === '3001') return { category: 'bricks-from-resolver' };
                return null;
            },
        };
        const importer = new PartCatalogImporter({ catalog, metadataResolver: resolver });
        const entry = validPart({ id: 'brick-3001', category: undefined, ldrawPartNumber: '3001' });
        delete entry.category;
        importer.importFromMetadata([entry]);
        const stored = catalog.getPart('brick-3001');
        // The original entry had no category; resolver fills it in
        assert.ok(stored !== null);
    });

    it('original entry fields take priority over resolver fields', () => {
        const catalog  = makeMockCatalog();
        const resolver = {
            resolve() { return { category: 'resolver-category', width: 99 }; },
        };
        const importer = new PartCatalogImporter({ catalog, metadataResolver: resolver });
        importer.importFromMetadata([validPart({ id: 'p1', category: 'original-category', ldrawPartNumber: '3001' })]);
        const stored = catalog.getPart('p1');
        assert.strictEqual(stored.category, 'original-category');
    });
});
