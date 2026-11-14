/**
 * tests/PartMetadataResolver.test.js
 *
 * Unit tests for PartMetadataResolver (Phase E.1).
 * Uses node:test + node:assert/strict with ESM imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PartMetadataResolver } from '../src/catalog/import/PartMetadataResolver.js';

// ─── Constructor ─────────────────────────────────────────────────────────────

describe('PartMetadataResolver – Constructor', () => {

    it('creates an empty resolver with no arguments', () => {
        const r = new PartMetadataResolver();
        assert.strictEqual(r.getCount(), 0);
    });

    it('creates an empty resolver with explicit null', () => {
        const r = new PartMetadataResolver(null);
        assert.strictEqual(r.getCount(), 0);
    });

    it('creates an empty resolver with undefined', () => {
        const r = new PartMetadataResolver(undefined);
        assert.strictEqual(r.getCount(), 0);
    });

    it('constructor with Format B object loads entries immediately', () => {
        const r = new PartMetadataResolver({ '3001': { category: 'bricks' } });
        assert.strictEqual(r.getCount(), 1);
    });

    it('constructor with Format A { metadata: [...] } loads entries immediately', () => {
        const r = new PartMetadataResolver({
            metadata: [
                { ldrawPartNumber: '3001', category: 'bricks' },
                { ldrawPartNumber: '3020', category: 'plates' },
            ],
        });
        assert.strictEqual(r.getCount(), 2);
    });

    it('constructor with a Map loads entries immediately', () => {
        const src = new Map([
            ['3001', { category: 'bricks' }],
            ['3002', { category: 'bricks' }],
        ]);
        const r = new PartMetadataResolver(src);
        assert.strictEqual(r.getCount(), 2);
    });
});


// ─── resolve() ───────────────────────────────────────────────────────────────

describe('PartMetadataResolver – resolve()', () => {

    it('resolve() returns null for unknown part number', () => {
        const r = new PartMetadataResolver();
        assert.strictEqual(r.resolve('3001'), null);
    });

    it('resolve() returns metadata object for known part', () => {
        const r = new PartMetadataResolver({ '3001': { category: 'bricks' } });
        const meta = r.resolve('3001');
        assert.ok(meta !== null);
        assert.strictEqual(meta.category, 'bricks');
    });

    it('resolve("3001.dat") normalises ".dat" extension → same as "3001"', () => {
        const r = new PartMetadataResolver({ '3001': { category: 'bricks' } });
        const meta = r.resolve('3001.dat');
        assert.ok(meta !== null);
        assert.strictEqual(meta.category, 'bricks');
    });

    it('resolve("3001.DAT") is case-insensitive', () => {
        const r = new PartMetadataResolver({ '3001': { category: 'bricks' } });
        const meta = r.resolve('3001.DAT');
        assert.ok(meta !== null);
        assert.strictEqual(meta.category, 'bricks');
    });

    it('resolve() returns a shallow copy (mutating it does not affect internal state)', () => {
        const r = new PartMetadataResolver({ '3001': { category: 'bricks' } });
        const meta = r.resolve('3001');
        meta.category = 'plates';   // mutate the copy
        assert.strictEqual(r.resolve('3001').category, 'bricks');
    });

    it('resolve() trims leading/trailing whitespace from the key', () => {
        const r = new PartMetadataResolver({ '3001': { category: 'bricks' } });
        assert.ok(r.resolve('  3001  ') !== null);
    });

    it('resolve() normalises keys to lowercase', () => {
        const r = new PartMetadataResolver({ '3001s': { category: 'bricks' } });
        assert.ok(r.resolve('3001S') !== null);
    });
});


// ─── hasMetadata() ───────────────────────────────────────────────────────────

describe('PartMetadataResolver – hasMetadata()', () => {

    it('hasMetadata() returns false for unknown part', () => {
        const r = new PartMetadataResolver();
        assert.strictEqual(r.hasMetadata('3001'), false);
    });

    it('hasMetadata() returns true for known part', () => {
        const r = new PartMetadataResolver({ '3001': { category: 'bricks' } });
        assert.strictEqual(r.hasMetadata('3001'), true);
    });

    it('hasMetadata() respects normalisation (.dat extension)', () => {
        const r = new PartMetadataResolver({ '3001': { category: 'bricks' } });
        assert.strictEqual(r.hasMetadata('3001.dat'), true);
    });
});


// ─── getCount() ──────────────────────────────────────────────────────────────

describe('PartMetadataResolver – getCount()', () => {

    it('getCount() returns 0 for empty resolver', () => {
        const r = new PartMetadataResolver();
        assert.strictEqual(r.getCount(), 0);
    });

    it('getCount() increases after addMetadata()', () => {
        const r = new PartMetadataResolver();
        r.addMetadata('3001', { category: 'bricks' });
        assert.strictEqual(r.getCount(), 1);
        r.addMetadata('3002', { category: 'bricks' });
        assert.strictEqual(r.getCount(), 2);
    });

    it('getCount() stays same when overwriting existing key', () => {
        const r = new PartMetadataResolver({ '3001': { category: 'bricks' } });
        r.addMetadata('3001', { category: 'plates' });
        assert.strictEqual(r.getCount(), 1);
    });
});


// ─── addMetadata() ───────────────────────────────────────────────────────────

describe('PartMetadataResolver – addMetadata()', () => {

    it('addMetadata() stores metadata and subsequent resolve() returns it', () => {
        const r = new PartMetadataResolver();
        r.addMetadata('3001', { category: 'bricks', width: 2, depth: 4 });
        const meta = r.resolve('3001');
        assert.ok(meta !== null);
        assert.strictEqual(meta.category, 'bricks');
        assert.strictEqual(meta.width, 2);
        assert.strictEqual(meta.depth, 4);
    });

    it('addMetadata() overwrites existing metadata for the same key', () => {
        const r = new PartMetadataResolver({ '3001': { category: 'bricks' } });
        r.addMetadata('3001', { category: 'plates' });
        assert.strictEqual(r.resolve('3001').category, 'plates');
    });

    it('addMetadata() normalises the part number key', () => {
        const r = new PartMetadataResolver();
        r.addMetadata('3001.DAT', { category: 'bricks' });
        assert.strictEqual(r.hasMetadata('3001'), true);
    });

    it('addMetadata() throws when ldrawPartNumber is not a string', () => {
        const r = new PartMetadataResolver();
        assert.throws(() => r.addMetadata(null, { category: 'bricks' }));
    });

    it('addMetadata() throws when metadata is not an object', () => {
        const r = new PartMetadataResolver();
        assert.throws(() => r.addMetadata('3001', null));
        assert.throws(() => r.addMetadata('3001', 'oops'));
    });

    it('addMetadata() stores a shallow copy (mutating original does not change stored data)', () => {
        const r = new PartMetadataResolver();
        const src = { category: 'bricks' };
        r.addMetadata('3001', src);
        src.category = 'plates';
        assert.strictEqual(r.resolve('3001').category, 'bricks');
    });
});


// ─── resolveAll() ────────────────────────────────────────────────────────────

describe('PartMetadataResolver – resolveAll()', () => {

    it('resolveAll([]) returns an empty Map', () => {
        const r = new PartMetadataResolver({ '3001': { category: 'bricks' } });
        const result = r.resolveAll([]);
        assert.ok(result instanceof Map);
        assert.strictEqual(result.size, 0);
    });

    it('resolveAll() returns only known entries (partial results)', () => {
        const r = new PartMetadataResolver({
            '3001': { category: 'bricks' },
            '3020': { category: 'plates' },
        });
        const result = r.resolveAll(['3001', '9999', '3020']);
        assert.strictEqual(result.size, 2);
        assert.ok(result.has('3001'));
        assert.ok(result.has('3020'));
        assert.ok(!result.has('9999'));
    });

    it('resolveAll() result values match stored metadata', () => {
        const r = new PartMetadataResolver({ '3001': { category: 'bricks' } });
        const result = r.resolveAll(['3001']);
        assert.strictEqual(result.get('3001').category, 'bricks');
    });

    it('resolveAll() normalises keys in the query list', () => {
        const r = new PartMetadataResolver({ '3001': { category: 'bricks' } });
        const result = r.resolveAll(['3001.dat', '3001.DAT']);
        // Both normalise to '3001'
        assert.strictEqual(result.size, 1);
        assert.ok(result.has('3001'));
    });

    it('resolveAll() returns empty Map for non-array input (with a console.warn)', () => {
        const r = new PartMetadataResolver({ '3001': { category: 'bricks' } });
        const result = r.resolveAll('3001');
        assert.ok(result instanceof Map);
        assert.strictEqual(result.size, 0);
    });
});


// ─── static fromJSON() – Format A ────────────────────────────────────────────

describe('PartMetadataResolver – static fromJSON() – Format A', () => {

    it('fromJSON({ metadata: [...] }) loads all entries', () => {
        const r = PartMetadataResolver.fromJSON({
            metadata: [
                { ldrawPartNumber: '3001', category: 'bricks' },
                { ldrawPartNumber: '3020', category: 'plates', width: 2 },
            ],
        });
        assert.strictEqual(r.getCount(), 2);
    });

    it('fromJSON Format A: resolve("3001") returns category "bricks"', () => {
        const r = PartMetadataResolver.fromJSON({
            metadata: [{ ldrawPartNumber: '3001', category: 'bricks' }],
        });
        assert.strictEqual(r.resolve('3001').category, 'bricks');
    });

    it('fromJSON Format A: ldrawPartNumber is NOT stored inside the metadata value', () => {
        const r = PartMetadataResolver.fromJSON({
            metadata: [{ ldrawPartNumber: '3001', category: 'bricks' }],
        });
        const meta = r.resolve('3001');
        assert.ok(!('ldrawPartNumber' in meta), 'ldrawPartNumber should not be in the stored metadata');
    });

    it('fromJSON Format A: entries without ldrawPartNumber are skipped', () => {
        const r = PartMetadataResolver.fromJSON({
            metadata: [
                { category: 'bricks' },                         // no ldrawPartNumber – skip
                { ldrawPartNumber: '3001', category: 'bricks' }, // valid
            ],
        });
        assert.strictEqual(r.getCount(), 1);
    });

    it('fromJSON Format A: normalises part numbers', () => {
        const r = PartMetadataResolver.fromJSON({
            metadata: [{ ldrawPartNumber: '3001.DAT', category: 'bricks' }],
        });
        assert.ok(r.hasMetadata('3001'));
    });
});


// ─── static fromJSON() – Format B ────────────────────────────────────────────

describe('PartMetadataResolver – static fromJSON() – Format B', () => {

    it('fromJSON({ "3001": { category: "bricks" } }) loads entry', () => {
        const r = PartMetadataResolver.fromJSON({ '3001': { category: 'bricks' } });
        assert.strictEqual(r.getCount(), 1);
    });

    it('fromJSON Format B: resolve("3001") returns category "bricks"', () => {
        const r = PartMetadataResolver.fromJSON({ '3001': { category: 'bricks' } });
        assert.strictEqual(r.resolve('3001').category, 'bricks');
    });

    it('fromJSON Format B: normalises keys (.dat extension)', () => {
        const r = PartMetadataResolver.fromJSON({ '3001.dat': { category: 'bricks' } });
        assert.ok(r.hasMetadata('3001'));
    });

    it('fromJSON Format B: multiple entries all loaded', () => {
        const r = PartMetadataResolver.fromJSON({
            '3001': { category: 'bricks' },
            '3020': { category: 'plates' },
            '3003': { category: 'bricks', width: 2, depth: 2 },
        });
        assert.strictEqual(r.getCount(), 3);
    });

    it('fromJSON() throws for non-object input', () => {
        assert.throws(() => PartMetadataResolver.fromJSON(null));
        assert.throws(() => PartMetadataResolver.fromJSON('{"3001": {}}'));
    });
});


// ─── Round-trip ──────────────────────────────────────────────────────────────

describe('PartMetadataResolver – round-trip via addMetadata + resolveAll', () => {

    it('data added via addMetadata() can be fully retrieved via resolveAll()', () => {
        const r = new PartMetadataResolver();
        r.addMetadata('3001', { category: 'bricks', width: 2, depth: 4, height: 3 });
        r.addMetadata('3020', { category: 'plates', width: 2, depth: 4, height: 1 });

        const all = r.resolveAll(['3001', '3020']);
        assert.strictEqual(all.size, 2);
        assert.strictEqual(all.get('3001').category, 'bricks');
        assert.strictEqual(all.get('3020').category, 'plates');
    });

    it('fromJSON(Format A) produces the same result as fromJSON(Format B) for the same data', () => {
        const rA = PartMetadataResolver.fromJSON({
            metadata: [
                { ldrawPartNumber: '3001', category: 'bricks', width: 2 },
                { ldrawPartNumber: '3020', category: 'plates', width: 2 },
            ],
        });
        const rB = PartMetadataResolver.fromJSON({
            '3001': { category: 'bricks', width: 2 },
            '3020': { category: 'plates', width: 2 },
        });

        assert.strictEqual(rA.getCount(), rB.getCount());
        assert.deepEqual(rA.resolve('3001'), rB.resolve('3001'));
        assert.deepEqual(rA.resolve('3020'), rB.resolve('3020'));
    });

    it('constructing with Format B Map gives same metadata as plain-object Format B', () => {
        const plainObj = { '3001': { category: 'bricks' }, '3002': { category: 'plates' } };
        const map = new Map(Object.entries(plainObj));

        const rPlain = new PartMetadataResolver(plainObj);
        const rMap   = new PartMetadataResolver(map);

        assert.strictEqual(rPlain.getCount(), rMap.getCount());
        assert.deepEqual(rPlain.resolve('3001'), rMap.resolve('3001'));
    });
});
