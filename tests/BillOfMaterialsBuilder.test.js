/**
 * BillOfMaterialsBuilder.test.js – Phase H
 *
 * Tests for BillOfMaterialsBuilder.build() covering:
 *   - Empty snapshot
 *   - Grouping identical parts (same partId + variantId + colorId)
 *   - Different colors = separate entries
 *   - summary totals (totalParts, uniqueTypes, uniqueColors)
 *   - Entries are BOMEntry instances
 *   - Entries sorted by partId
 *   - Different variantId → separate entries
 *   - Mixed local + ldraw sources
 *   - includeLocal:false filter
 *
 * Assertions: ~25
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BillOfMaterialsBuilder } from '../src/export/bom/BillOfMaterialsBuilder.js';
import { BOMEntry }               from '../src/export/bom/BOMEntry.js';

// ─── Part factory ─────────────────────────────────────────────────────────────

/** Minimal ExportPart-shaped object compatible with BillOfMaterialsBuilder. */
function makePart(overrides = {}) {
    return {
        instanceId:      `inst-${Math.random().toString(36).slice(2)}`,
        partId:          '3001',
        ldrawPartNumber: '3001.dat',
        name:            'Brick 2 x 4',
        colorId:         4,
        colorName:       'Red',
        colorHex:        '#C91A09',
        variantId:       null,
        source:          'ldraw',
        category:        'Brick',
        ...overrides,
    };
}

function makeSnapshot(parts = []) {
    return { parts };
}

// ─── Empty snapshot ───────────────────────────────────────────────────────────

describe('BillOfMaterialsBuilder – empty snapshot', () => {
    it('empty snapshot → entries.length === 0', () => {
        const builder = new BillOfMaterialsBuilder();
        const bom     = builder.build(makeSnapshot([]));
        assert.equal(bom.entries.length, 0);
    });

    it('empty snapshot → summary.totalParts === 0', () => {
        const builder = new BillOfMaterialsBuilder();
        const bom     = builder.build(makeSnapshot([]));
        assert.equal(bom.summary.totalParts, 0);
    });

    it('empty snapshot → summary.uniqueTypes === 0', () => {
        const builder = new BillOfMaterialsBuilder();
        const bom     = builder.build(makeSnapshot([]));
        assert.equal(bom.summary.uniqueTypes, 0);
    });

    it('snapshot without parts array throws', () => {
        const builder = new BillOfMaterialsBuilder();
        assert.throws(
            () => builder.build({}),
            TypeError
        );
    });
});

// ─── Identical parts → single entry ──────────────────────────────────────────

describe('BillOfMaterialsBuilder – identical parts grouped', () => {
    it('two identical parts → one entry with quantity === 2', () => {
        const builder = new BillOfMaterialsBuilder();
        const bom     = builder.build(makeSnapshot([makePart(), makePart()]));
        assert.equal(bom.entries.length, 1);
        assert.equal(bom.entries[0].quantity, 2);
    });

    it('summary.totalParts equals snapshot.parts.length', () => {
        const builder = new BillOfMaterialsBuilder();
        const parts   = [makePart(), makePart(), makePart()];
        const bom     = builder.build(makeSnapshot(parts));
        assert.equal(bom.summary.totalParts, parts.length);
    });

    it('three identical parts → one entry with quantity === 3', () => {
        const builder = new BillOfMaterialsBuilder();
        const bom     = builder.build(makeSnapshot([makePart(), makePart(), makePart()]));
        assert.equal(bom.entries[0].quantity, 3);
    });
});

// ─── Different colors → separate entries ──────────────────────────────────────

describe('BillOfMaterialsBuilder – different colors', () => {
    it('one red + one blue same partId → two entries', () => {
        const builder = new BillOfMaterialsBuilder();
        const red     = makePart({ colorId: 4,  colorName: 'Red' });
        const blue    = makePart({ colorId: 1,  colorName: 'Blue' });
        const bom     = builder.build(makeSnapshot([red, blue]));
        assert.equal(bom.entries.length, 2);
    });

    it('summary.uniqueColors reflects both colors', () => {
        const builder = new BillOfMaterialsBuilder();
        const red     = makePart({ colorId: 4  });
        const blue    = makePart({ colorId: 1  });
        const bom     = builder.build(makeSnapshot([red, blue]));
        assert.equal(bom.summary.uniqueColors, 2);
    });
});

// ─── summary.uniqueTypes ──────────────────────────────────────────────────────

describe('BillOfMaterialsBuilder – summary.uniqueTypes', () => {
    it('two different partIds → uniqueTypes === 2', () => {
        const builder = new BillOfMaterialsBuilder();
        const a       = makePart({ partId: '3001' });
        const b       = makePart({ partId: '3003' });
        const bom     = builder.build(makeSnapshot([a, b]));
        assert.equal(bom.summary.uniqueTypes, 2);
    });

    it('same partId different colors → uniqueTypes still 1', () => {
        const builder = new BillOfMaterialsBuilder();
        const red     = makePart({ partId: '3001', colorId: 4 });
        const blue    = makePart({ partId: '3001', colorId: 1 });
        const bom     = builder.build(makeSnapshot([red, blue]));
        assert.equal(bom.summary.uniqueTypes, 1);
    });
});

// ─── BOMEntry instances ───────────────────────────────────────────────────────

describe('BillOfMaterialsBuilder – BOMEntry instances', () => {
    it('entries are BOMEntry instances', () => {
        const builder = new BillOfMaterialsBuilder();
        const bom     = builder.build(makeSnapshot([makePart()]));
        assert.ok(bom.entries[0] instanceof BOMEntry, 'Entry should be a BOMEntry instance');
    });
});

// ─── Sorting ──────────────────────────────────────────────────────────────────

describe('BillOfMaterialsBuilder – entries sorted by partId', () => {
    it('entries are sorted by partId ascending', () => {
        const builder = new BillOfMaterialsBuilder();
        const b       = makePart({ partId: '3003' });
        const a       = makePart({ partId: '1001' });
        const bom     = builder.build(makeSnapshot([b, a]));
        assert.equal(bom.entries[0].partId, '1001');
        assert.equal(bom.entries[1].partId, '3003');
    });
});

// ─── Different variantId → separate entries ───────────────────────────────────

describe('BillOfMaterialsBuilder – variantId separation', () => {
    it('same partId + colorId but different variantId → two entries', () => {
        const builder = new BillOfMaterialsBuilder();
        const v1      = makePart({ variantId: 'A' });
        const v2      = makePart({ variantId: 'B' });
        const bom     = builder.build(makeSnapshot([v1, v2]));
        assert.equal(bom.entries.length, 2);
    });
});

// ─── Source filtering ─────────────────────────────────────────────────────────

describe('BillOfMaterialsBuilder – source filtering', () => {
    it('mixed local + ldraw parts → both included by default', () => {
        const builder  = new BillOfMaterialsBuilder();
        const ldrawPart = makePart({ partId: 'A', source: 'ldraw' });
        const localPart = makePart({ partId: 'B', source: 'local' });
        const bom       = builder.build(makeSnapshot([ldrawPart, localPart]));
        assert.equal(bom.summary.totalParts, 2);
    });

    it('includeLocal:false → local parts excluded', () => {
        const builder   = new BillOfMaterialsBuilder({ includeLocal: false });
        const ldrawPart = makePart({ partId: 'A', source: 'ldraw' });
        const localPart = makePart({ partId: 'B', source: 'local' });
        const bom       = builder.build(makeSnapshot([ldrawPart, localPart]));
        // Only the ldraw part should be counted
        assert.equal(bom.summary.totalParts, 1);
    });

    it('includeLDraw:false → ldraw parts excluded', () => {
        const builder   = new BillOfMaterialsBuilder({ includeLDraw: false });
        const ldrawPart = makePart({ partId: 'A', source: 'ldraw' });
        const localPart = makePart({ partId: 'B', source: 'local' });
        const bom       = builder.build(makeSnapshot([ldrawPart, localPart]));
        assert.equal(bom.summary.totalParts, 1);
    });

    it('summary.totalParts === snapshot.parts.length when all included', () => {
        const builder = new BillOfMaterialsBuilder();
        const parts   = [makePart(), makePart({ partId: 'X' }), makePart({ colorId: 99 })];
        const bom     = builder.build(makeSnapshot(parts));
        assert.equal(bom.summary.totalParts, parts.length);
    });
});

// ─── metadata ─────────────────────────────────────────────────────────────────

describe('BillOfMaterialsBuilder – metadata', () => {
    it('bom.metadata.builtAt is a valid ISO string', () => {
        const builder = new BillOfMaterialsBuilder();
        const bom     = builder.build(makeSnapshot([]));
        const ts      = new Date(bom.metadata.builtAt).getTime();
        assert.ok(!isNaN(ts), 'builtAt should be a valid ISO date string');
    });
});
