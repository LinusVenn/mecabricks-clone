/**
 * Tests for PartVariantResolver (Phase E.5)
 *
 * Coverage:
 *  - Constructor: requires catalog with getPart(), requires variantManager
 *  - resolve(partId, variantId): returns merged part definition with isVariant:true
 *  - resolve(partId, null): returns default variant or base part when no variants
 *  - resolve(partId, 'nonexistent'): falls back to base part without throwing
 *  - resolve(unknown part): returns null
 *  - resolveAll(partId): returns one object per registered variant
 *  - resolveAll(unknown part): returns empty array
 *  - canResolve(partId): true if part exists in catalog, false otherwise
 *  - getResolvableVariantIds(partId): correct ordered list
 *  - Mock/stub catalog and variantManager used throughout
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PartVariantResolver } from '../src/catalog/variants/PartVariantResolver.js';
import { PartVariantManager }   from '../src/catalog/variants/PartVariantManager.js';
import { PartVariantDefinition } from '../src/catalog/variants/PartVariantDefinition.js';

// ─── Mock Catalog ─────────────────────────────────────────────────────────────

/**
 * Creates a minimal stub catalog for testing.
 * Supports getPartById AND getPart (resolver uses getPart).
 */
function makeCatalog(parts = {}) {
    return {
        getPart(id) {
            return parts[id] ?? null;
        },
        hasPart(id) {
            return id in parts;
        },
    };
}

// ─── Shared fixture data ──────────────────────────────────────────────────────

const BASE_PART = {
    id:     'brick_2x4',
    name:   'Stein 2×4',
    width:  2,
    depth:  4,
    height: 1,
    tags:   ['basic', 'brick'],
};

const ANOTHER_PART = {
    id:     'plate_1x2',
    name:   'Platte 1×2',
    width:  1,
    depth:  2,
    height: 0.3,
    tags:   ['plate'],
};

function makeManager() {
    return new PartVariantManager();
}

function makeVariantDef(overrides = {}) {
    return new PartVariantDefinition({
        basePartId: 'brick_2x4',
        variantId:  'with-logo',
        name:       'Mit Logo',
        isDefault:  true,
        ...overrides,
    });
}

// ─── Constructor ─────────────────────────────────────────────────────────────

describe('PartVariantResolver – Constructor', () => {

    it('creates instance with valid catalog and variantManager', () => {
        const catalog = makeCatalog({ brick_2x4: BASE_PART });
        const manager = makeManager();
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });
        assert.ok(resolver instanceof PartVariantResolver);
    });

    it('throws TypeError when catalog is null', () => {
        const manager = makeManager();
        assert.throws(
            () => new PartVariantResolver({ catalog: null, variantManager: manager }),
            TypeError
        );
    });

    it('throws TypeError when catalog lacks getPart method', () => {
        const manager = makeManager();
        assert.throws(
            () => new PartVariantResolver({ catalog: { hasPart: () => true }, variantManager: manager }),
            TypeError
        );
    });

    it('throws TypeError when catalog is a plain string', () => {
        const manager = makeManager();
        assert.throws(
            () => new PartVariantResolver({ catalog: 'not-a-catalog', variantManager: manager }),
            TypeError
        );
    });

    it('throws TypeError when variantManager is null', () => {
        const catalog = makeCatalog();
        assert.throws(
            () => new PartVariantResolver({ catalog, variantManager: null }),
            TypeError
        );
    });

    it('throws TypeError when variantManager is missing getVariants', () => {
        const catalog = makeCatalog();
        const badManager = { getVariant: () => null, getDefaultVariant: () => null };
        assert.throws(
            () => new PartVariantResolver({ catalog, variantManager: badManager }),
            TypeError
        );
    });

    it('throws TypeError when neither argument provided', () => {
        assert.throws(() => new PartVariantResolver({}), TypeError);
    });
});

// ─── resolve(partId, variantId) ───────────────────────────────────────────────

describe('PartVariantResolver – resolve(partId, variantId)', () => {

    it('returns merged part with isVariant: true for known variant', () => {
        const catalog = makeCatalog({ brick_2x4: BASE_PART });
        const manager = makeManager();
        manager.registerVariant(makeVariantDef({ overrides: { width: 99 } }));
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });

        const result = resolver.resolve('brick_2x4', 'with-logo');
        assert.ok(result !== null);
        assert.strictEqual(result.isVariant, true);
    });

    it('applies overrides over base part fields', () => {
        const catalog = makeCatalog({ brick_2x4: BASE_PART });
        const manager = makeManager();
        manager.registerVariant(makeVariantDef({ overrides: { width: 99 } }));
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });

        const result = resolver.resolve('brick_2x4', 'with-logo');
        assert.strictEqual(result.width, 99);
    });

    it('sets variantId on merged result', () => {
        const catalog = makeCatalog({ brick_2x4: BASE_PART });
        const manager = makeManager();
        manager.registerVariant(makeVariantDef());
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });

        const result = resolver.resolve('brick_2x4', 'with-logo');
        assert.strictEqual(result.variantId, 'with-logo');
    });

    it('preserves base part fields not covered by overrides', () => {
        const catalog = makeCatalog({ brick_2x4: BASE_PART });
        const manager = makeManager();
        manager.registerVariant(makeVariantDef());
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });

        const result = resolver.resolve('brick_2x4', 'with-logo');
        assert.strictEqual(result.id, 'brick_2x4');
        assert.strictEqual(result.depth, 4);
    });

    it('falls back to base part when variantId not found (no throw)', () => {
        const catalog = makeCatalog({ brick_2x4: BASE_PART });
        const manager = makeManager();
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });

        const result = resolver.resolve('brick_2x4', 'nonexistent');
        assert.strictEqual(result, BASE_PART);
    });

    it('returns null for unknown part id', () => {
        const catalog = makeCatalog({});
        const manager = makeManager();
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });

        assert.strictEqual(resolver.resolve('unknown', 'with-logo'), null);
    });

    it('returns null for invalid (empty) partId', () => {
        const catalog = makeCatalog({ brick_2x4: BASE_PART });
        const manager = makeManager();
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });

        assert.strictEqual(resolver.resolve(''), null);
        assert.strictEqual(resolver.resolve(null), null);
    });
});

// ─── resolve(partId, null) – default variant or base ─────────────────────────

describe('PartVariantResolver – resolve(partId, null)', () => {

    it('returns the default variant when one exists', () => {
        const catalog = makeCatalog({ brick_2x4: BASE_PART });
        const manager = makeManager();
        manager.registerVariant(makeVariantDef({ isDefault: true }));
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });

        const result = resolver.resolve('brick_2x4', null);
        assert.strictEqual(result.isVariant, true);
        assert.strictEqual(result.variantId, 'with-logo');
    });

    it('returns base part when no variants registered', () => {
        const catalog = makeCatalog({ brick_2x4: BASE_PART });
        const manager = makeManager();
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });

        const result = resolver.resolve('brick_2x4', null);
        assert.strictEqual(result, BASE_PART);
    });

    it('omitting variantId defaults to null resolution path', () => {
        const catalog = makeCatalog({ brick_2x4: BASE_PART });
        const manager = makeManager();
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });

        // resolve() with no second arg defaults to null → returns base part
        const result = resolver.resolve('brick_2x4');
        assert.strictEqual(result, BASE_PART);
    });

    it('returns base part when catalog returns null for part', () => {
        const catalog = makeCatalog({});
        const manager = makeManager();
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });

        assert.strictEqual(resolver.resolve('brick_2x4', null), null);
    });
});

// ─── resolveAll() ─────────────────────────────────────────────────────────────

describe('PartVariantResolver – resolveAll(partId)', () => {

    it('returns one resolved object per registered variant', () => {
        const catalog = makeCatalog({ brick_2x4: BASE_PART });
        const manager = makeManager();
        manager.registerVariant(makeVariantDef({ variantId: 'v1', name: 'V1', isDefault: false }));
        manager.registerVariant(makeVariantDef({ variantId: 'v2', name: 'V2', isDefault: false }));
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });

        const all = resolver.resolveAll('brick_2x4');
        assert.strictEqual(all.length, 2);
    });

    it('each resolved object has isVariant: true', () => {
        const catalog = makeCatalog({ brick_2x4: BASE_PART });
        const manager = makeManager();
        manager.registerVariant(makeVariantDef({ variantId: 'v1', name: 'V1', isDefault: false }));
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });

        const all = resolver.resolveAll('brick_2x4');
        assert.strictEqual(all[0].isVariant, true);
    });

    it('returns empty array for unknown part', () => {
        const catalog = makeCatalog({});
        const manager = makeManager();
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });

        assert.deepEqual(resolver.resolveAll('unknown'), []);
    });

    it('returns empty array when no variants registered for known part', () => {
        const catalog = makeCatalog({ brick_2x4: BASE_PART });
        const manager = makeManager();
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });

        assert.deepEqual(resolver.resolveAll('brick_2x4'), []);
    });

    it('returns empty array for invalid partId', () => {
        const catalog = makeCatalog({ brick_2x4: BASE_PART });
        const manager = makeManager();
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });

        assert.deepEqual(resolver.resolveAll(''), []);
        assert.deepEqual(resolver.resolveAll(null), []);
    });

    it('resolves variants for multiple different parts', () => {
        const catalog = makeCatalog({ brick_2x4: BASE_PART, plate_1x2: ANOTHER_PART });
        const manager = makeManager();
        manager.registerVariant(makeVariantDef());
        manager.registerVariant(new PartVariantDefinition({
            basePartId: 'plate_1x2',
            variantId:  'rail',
            name:       'Mit Schiene',
        }));
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });

        assert.strictEqual(resolver.resolveAll('brick_2x4').length, 1);
        assert.strictEqual(resolver.resolveAll('plate_1x2').length, 1);
    });
});

// ─── canResolve() ─────────────────────────────────────────────────────────────

describe('PartVariantResolver – canResolve(partId)', () => {

    it('returns true when part is in catalog', () => {
        const catalog = makeCatalog({ brick_2x4: BASE_PART });
        const manager = makeManager();
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });
        assert.strictEqual(resolver.canResolve('brick_2x4'), true);
    });

    it('returns false when part is not in catalog', () => {
        const catalog = makeCatalog({});
        const manager = makeManager();
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });
        assert.strictEqual(resolver.canResolve('unknown'), false);
    });

    it('returns false for empty string', () => {
        const catalog = makeCatalog({ brick_2x4: BASE_PART });
        const manager = makeManager();
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });
        assert.strictEqual(resolver.canResolve(''), false);
    });

    it('returns false for null', () => {
        const catalog = makeCatalog({ brick_2x4: BASE_PART });
        const manager = makeManager();
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });
        assert.strictEqual(resolver.canResolve(null), false);
    });

    it('does not require variants to be registered – only catalog membership', () => {
        const catalog = makeCatalog({ brick_2x4: BASE_PART });
        const manager = makeManager(); // no variants registered
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });
        assert.strictEqual(resolver.canResolve('brick_2x4'), true);
    });
});

// ─── getResolvableVariantIds() ────────────────────────────────────────────────

describe('PartVariantResolver – getResolvableVariantIds(partId)', () => {

    it('returns empty array when no variants registered', () => {
        const catalog = makeCatalog({ brick_2x4: BASE_PART });
        const manager = makeManager();
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });
        assert.deepEqual(resolver.getResolvableVariantIds('brick_2x4'), []);
    });

    it('returns correct list of variant ids in insertion order', () => {
        const catalog = makeCatalog({ brick_2x4: BASE_PART });
        const manager = makeManager();
        manager.registerVariant(makeVariantDef({ variantId: 'v1', name: 'V1', isDefault: false }));
        manager.registerVariant(makeVariantDef({ variantId: 'v2', name: 'V2', isDefault: false }));
        manager.registerVariant(makeVariantDef({ variantId: 'v3', name: 'V3', isDefault: false }));
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });

        const ids = resolver.getResolvableVariantIds('brick_2x4');
        assert.deepEqual(ids, ['v1', 'v2', 'v3']);
    });

    it('returns empty array for unknown part', () => {
        const catalog = makeCatalog({});
        const manager = makeManager();
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });
        assert.deepEqual(resolver.getResolvableVariantIds('unknown'), []);
    });

    it('returns empty array for empty string partId', () => {
        const catalog = makeCatalog({ brick_2x4: BASE_PART });
        const manager = makeManager();
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });
        assert.deepEqual(resolver.getResolvableVariantIds(''), []);
    });

    it('contains only string variant ids', () => {
        const catalog = makeCatalog({ brick_2x4: BASE_PART });
        const manager = makeManager();
        manager.registerVariant(makeVariantDef());
        const resolver = new PartVariantResolver({ catalog, variantManager: manager });

        const ids = resolver.getResolvableVariantIds('brick_2x4');
        for (const id of ids) {
            assert.strictEqual(typeof id, 'string');
        }
    });
});
