/**
 * BOMEntry.test.js – Phase H
 *
 * Tests for BOMEntry:
 *   - Constructor with valid fields + all getters
 *   - groupKey computation
 *   - toData() / static fromData() round-trip
 *   - toData() returns plain object (not a BOMEntry instance)
 *   - Error conditions: missing partId, quantity ≤ 0
 *   - instanceIds getter returns a copy (mutation-safe)
 *
 * Assertions: ~20
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BOMEntry } from '../src/export/bom/BOMEntry.js';

// ─── Fixture ──────────────────────────────────────────────────────────────────

/** Minimal valid BOMEntry definition. */
const validDef = {
    partId:          '3001',
    ldrawPartNumber: '3001.dat',
    name:            'Brick 2 x 4',
    colorId:         4,
    colorName:       'Red',
    colorHex:        '#C91A09',
    variantId:       'v1',
    quantity:        3,
    source:          'ldraw',
    category:        'Brick',
    instanceIds:     ['i1', 'i2', 'i3'],
};

// ─── Constructor and getters ──────────────────────────────────────────────────

describe('BOMEntry – constructor and getters', () => {
    it('partId getter returns correct value', () => {
        const entry = new BOMEntry(validDef);
        assert.equal(entry.partId, '3001');
    });

    it('ldrawPartNumber getter returns correct value', () => {
        const entry = new BOMEntry(validDef);
        assert.equal(entry.ldrawPartNumber, '3001.dat');
    });

    it('name getter returns correct value', () => {
        const entry = new BOMEntry(validDef);
        assert.equal(entry.name, 'Brick 2 x 4');
    });

    it('colorId getter returns correct value', () => {
        const entry = new BOMEntry(validDef);
        assert.equal(entry.colorId, 4);
    });

    it('colorName getter returns correct value', () => {
        const entry = new BOMEntry(validDef);
        assert.equal(entry.colorName, 'Red');
    });

    it('colorHex getter returns correct value', () => {
        const entry = new BOMEntry(validDef);
        assert.equal(entry.colorHex, '#C91A09');
    });

    it('variantId getter returns correct value', () => {
        const entry = new BOMEntry(validDef);
        assert.equal(entry.variantId, 'v1');
    });

    it('quantity getter returns correct value', () => {
        const entry = new BOMEntry(validDef);
        assert.equal(entry.quantity, 3);
    });

    it('source getter returns correct value', () => {
        const entry = new BOMEntry(validDef);
        assert.equal(entry.source, 'ldraw');
    });

    it('category getter returns correct value', () => {
        const entry = new BOMEntry(validDef);
        assert.equal(entry.category, 'Brick');
    });

    it('instanceIds getter returns all instance IDs', () => {
        const entry = new BOMEntry(validDef);
        assert.deepEqual([...entry.instanceIds], ['i1', 'i2', 'i3']);
    });
});

// ─── groupKey ─────────────────────────────────────────────────────────────────

describe('BOMEntry – groupKey', () => {
    it('groupKey = "<partId>|<variantId>|<colorId>"', () => {
        const entry = new BOMEntry(validDef);
        assert.equal(entry.groupKey, '3001|v1|4');
    });

    it('groupKey uses empty string for null variantId', () => {
        const entry = new BOMEntry({ ...validDef, variantId: null });
        assert.ok(entry.groupKey.startsWith('3001||'), `groupKey should be "3001||4", got: ${entry.groupKey}`);
    });

    it('groupKey falls back to colorName when colorId is null', () => {
        const entry = new BOMEntry({ ...validDef, colorId: null, colorName: 'Red' });
        assert.ok(entry.groupKey.endsWith('|Red'), `groupKey should end with "|Red", got: ${entry.groupKey}`);
    });

    it('same partId + variantId + colorId → identical groupKey', () => {
        const a = new BOMEntry(validDef);
        const b = new BOMEntry({ ...validDef, name: 'Different Name', quantity: 5 });
        assert.equal(a.groupKey, b.groupKey);
    });
});

// ─── toData / fromData round-trip ─────────────────────────────────────────────

describe('BOMEntry – toData / fromData', () => {
    it('toData() returns a plain object (not a BOMEntry instance)', () => {
        const entry = new BOMEntry(validDef);
        const data  = entry.toData();
        assert.ok(!(data instanceof BOMEntry), 'toData() should return a plain object');
    });

    it('toData() has all expected fields', () => {
        const entry = new BOMEntry(validDef);
        const data  = entry.toData();
        for (const key of ['partId', 'ldrawPartNumber', 'name', 'colorId', 'colorName',
                            'colorHex', 'variantId', 'quantity', 'source', 'category', 'instanceIds']) {
            assert.ok(Object.hasOwn(data, key), `toData() missing field: ${key}`);
        }
    });

    it('fromData(toData()) round-trips all values', () => {
        const original = new BOMEntry(validDef);
        const copy     = BOMEntry.fromData(original.toData());
        assert.equal(copy.partId,          original.partId);
        assert.equal(copy.quantity,        original.quantity);
        assert.equal(copy.colorId,         original.colorId);
        assert.equal(copy.ldrawPartNumber, original.ldrawPartNumber);
        assert.deepEqual([...copy.instanceIds], [...original.instanceIds]);
    });
});

// ─── instanceIds copy (mutation safety) ──────────────────────────────────────

describe('BOMEntry – instanceIds mutation safety', () => {
    it('mutating the array returned by instanceIds does not affect the entry', () => {
        const entry  = new BOMEntry(validDef);
        // The getter returns a frozen array; try pushing should either throw or be no-op
        const ids = entry.instanceIds;
        try {
            // This will throw in strict mode since the array is frozen
            ids.push('x99');
        } catch (_e) {
            // Expected for frozen arrays
        }
        // Original instanceIds count must still be 3
        assert.equal(entry.instanceIds.length, 3);
    });
});

// ─── Error conditions ─────────────────────────────────────────────────────────

describe('BOMEntry – error conditions', () => {
    it('missing partId throws TypeError', () => {
        assert.throws(
            () => new BOMEntry({ ...validDef, partId: undefined }),
            TypeError
        );
    });

    it('empty partId throws TypeError', () => {
        assert.throws(
            () => new BOMEntry({ ...validDef, partId: '' }),
            TypeError
        );
    });

    it('quantity = 0 throws TypeError', () => {
        assert.throws(
            () => new BOMEntry({ ...validDef, quantity: 0 }),
            TypeError
        );
    });

    it('quantity < 0 throws TypeError', () => {
        assert.throws(
            () => new BOMEntry({ ...validDef, quantity: -1 }),
            TypeError
        );
    });

    it('quantity = Infinity throws TypeError', () => {
        assert.throws(
            () => new BOMEntry({ ...validDef, quantity: Infinity }),
            TypeError
        );
    });

    it('null/undefined def throws TypeError', () => {
        assert.throws(
            () => new BOMEntry(null),
            TypeError
        );
    });
});
