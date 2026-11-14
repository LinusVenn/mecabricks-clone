/**
 * Tests for PartVariantManager (Phase E.5)
 *
 * Coverage:
 *  - Constructor: empty manager, default state
 *  - registerVariant(): success, throws on duplicate, overwrite option
 *  - getVariants(): array result, empty for unknown part
 *  - getVariant(): returns def or null
 *  - getDefaultVariant(): explicit isDefault, fallback to first, null for unknown
 *  - hasVariants(): true/false
 *  - getAllBasePartIds(): correct list
 *  - removeVariant(): removes and returns true/false, cleans up empty maps
 *  - clearVariants(): empties a part's variants
 *  - getVariantCount(): correct total across all parts
 *  - importFromJSON(): JSON string, object with { variants:[] }, returns ImportResult
 *  - toData(): includes all variants
 *  - Singleton: instance() / resetInstance()
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { PartVariantManager } from '../src/catalog/variants/PartVariantManager.js';
import { PartVariantDefinition } from '../src/catalog/variants/PartVariantDefinition.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeVariant(overrides = {}) {
    return new PartVariantDefinition({
        basePartId: 'brick_2x4',
        variantId:  'with-logo',
        name:       'Mit Logo',
        isDefault:  true,
        ...overrides,
    });
}

// ─── Constructor ─────────────────────────────────────────────────────────────

describe('PartVariantManager – Constructor', () => {

    it('creates an empty manager with no variants', () => {
        const m = new PartVariantManager();
        assert.strictEqual(m.getVariantCount(), 0);
    });

    it('getAllBasePartIds() returns empty array for fresh manager', () => {
        const m = new PartVariantManager();
        assert.deepEqual(m.getAllBasePartIds(), []);
    });

    it('hasVariants() returns false for any part on empty manager', () => {
        const m = new PartVariantManager();
        assert.strictEqual(m.hasVariants('brick_2x4'), false);
    });

    it('accepts autoRegisterDefaults option without error', () => {
        assert.doesNotThrow(() => new PartVariantManager({ autoRegisterDefaults: true }));
    });

    it('autoRegisterDefaults: auto-creates standard variant on first register', () => {
        const m = new PartVariantManager({ autoRegisterDefaults: true });
        m.registerVariant(makeVariant());
        // 'standard' auto-registered + 'with-logo' explicit = 2
        assert.strictEqual(m.getVariantCount(), 2);
        const std = m.getVariant('brick_2x4', 'standard');
        assert.ok(std instanceof PartVariantDefinition);
    });
});

// ─── registerVariant() ───────────────────────────────────────────────────────

describe('PartVariantManager – registerVariant()', () => {

    it('registers a PartVariantDefinition successfully', () => {
        const m = new PartVariantManager();
        m.registerVariant(makeVariant());
        assert.strictEqual(m.getVariantCount(), 1);
    });

    it('throws TypeError for non-PartVariantDefinition argument', () => {
        const m = new PartVariantManager();
        assert.throws(() => m.registerVariant({ basePartId: 'x', variantId: 'y' }), TypeError);
        assert.throws(() => m.registerVariant(null), TypeError);
        assert.throws(() => m.registerVariant('string'), TypeError);
    });

    it('throws RangeError on duplicate without overwrite option', () => {
        const m = new PartVariantManager();
        const v = makeVariant();
        m.registerVariant(v);
        assert.throws(() => m.registerVariant(v), RangeError);
    });

    it('overwrites duplicate when { overwrite: true }', () => {
        const m = new PartVariantManager();
        m.registerVariant(makeVariant({ name: 'Original' }));
        const updated = makeVariant({ name: 'Aktualisiert' });
        assert.doesNotThrow(() => m.registerVariant(updated, { overwrite: true }));
        const stored = m.getVariant('brick_2x4', 'with-logo');
        assert.strictEqual(stored.name, 'Aktualisiert');
    });

    it('variant count stays at 1 after overwrite', () => {
        const m = new PartVariantManager();
        m.registerVariant(makeVariant());
        m.registerVariant(makeVariant({ name: 'New' }), { overwrite: true });
        assert.strictEqual(m.getVariantCount(), 1);
    });

    it('registers variants for multiple parts independently', () => {
        const m = new PartVariantManager();
        m.registerVariant(makeVariant({ basePartId: 'brick_2x4' }));
        m.registerVariant(makeVariant({ basePartId: 'plate_1x2', variantId: 'rail' }));
        assert.strictEqual(m.getVariantCount(), 2);
        assert.strictEqual(m.getAllBasePartIds().length, 2);
    });
});

// ─── getVariants() ───────────────────────────────────────────────────────────

describe('PartVariantManager – getVariants()', () => {

    it('returns an array of registered variants', () => {
        const m = new PartVariantManager();
        m.registerVariant(makeVariant());
        const variants = m.getVariants('brick_2x4');
        assert.ok(Array.isArray(variants));
        assert.strictEqual(variants.length, 1);
        assert.ok(variants[0] instanceof PartVariantDefinition);
    });

    it('returns empty array for unknown part', () => {
        const m = new PartVariantManager();
        assert.deepEqual(m.getVariants('nonexistent'), []);
    });

    it('returns empty array for non-string id', () => {
        const m = new PartVariantManager();
        assert.deepEqual(m.getVariants(null), []);
        assert.deepEqual(m.getVariants(''), []);
    });

    it('returns all variants for a part with multiple entries', () => {
        const m = new PartVariantManager();
        m.registerVariant(makeVariant({ variantId: 'v1', name: 'V1', isDefault: false }));
        m.registerVariant(makeVariant({ variantId: 'v2', name: 'V2', isDefault: false }));
        assert.strictEqual(m.getVariants('brick_2x4').length, 2);
    });
});

// ─── getVariant() ────────────────────────────────────────────────────────────

describe('PartVariantManager – getVariant()', () => {

    it('returns the correct PartVariantDefinition', () => {
        const m = new PartVariantManager();
        m.registerVariant(makeVariant());
        const v = m.getVariant('brick_2x4', 'with-logo');
        assert.ok(v instanceof PartVariantDefinition);
        assert.strictEqual(v.variantId, 'with-logo');
    });

    it('returns null for unknown variantId', () => {
        const m = new PartVariantManager();
        m.registerVariant(makeVariant());
        assert.strictEqual(m.getVariant('brick_2x4', 'nonexistent'), null);
    });

    it('returns null for unknown basePartId', () => {
        const m = new PartVariantManager();
        assert.strictEqual(m.getVariant('unknown', 'v'), null);
    });

    it('returns null for empty string ids', () => {
        const m = new PartVariantManager();
        assert.strictEqual(m.getVariant('', 'v'), null);
        assert.strictEqual(m.getVariant('bp', ''), null);
    });
});

// ─── getDefaultVariant() ─────────────────────────────────────────────────────

describe('PartVariantManager – getDefaultVariant()', () => {

    it('returns null when no variants registered', () => {
        const m = new PartVariantManager();
        assert.strictEqual(m.getDefaultVariant('brick_2x4'), null);
    });

    it('returns the variant with isDefault: true', () => {
        const m = new PartVariantManager();
        m.registerVariant(makeVariant({ variantId: 'v1', name: 'V1', isDefault: false }));
        m.registerVariant(makeVariant({ variantId: 'v2', name: 'V2', isDefault: true }));
        const def = m.getDefaultVariant('brick_2x4');
        assert.strictEqual(def.variantId, 'v2');
    });

    it('falls back to first registered variant when no isDefault', () => {
        const m = new PartVariantManager();
        m.registerVariant(makeVariant({ variantId: 'first', name: 'First', isDefault: false }));
        m.registerVariant(makeVariant({ variantId: 'second', name: 'Second', isDefault: false }));
        const def = m.getDefaultVariant('brick_2x4');
        assert.strictEqual(def.variantId, 'first');
    });

    it('returns null for unknown part', () => {
        const m = new PartVariantManager();
        assert.strictEqual(m.getDefaultVariant('unknown'), null);
    });
});

// ─── hasVariants() ───────────────────────────────────────────────────────────

describe('PartVariantManager – hasVariants()', () => {

    it('returns false before any variants are registered', () => {
        const m = new PartVariantManager();
        assert.strictEqual(m.hasVariants('brick_2x4'), false);
    });

    it('returns true after a variant is registered', () => {
        const m = new PartVariantManager();
        m.registerVariant(makeVariant());
        assert.strictEqual(m.hasVariants('brick_2x4'), true);
    });

    it('returns false for a different part', () => {
        const m = new PartVariantManager();
        m.registerVariant(makeVariant());
        assert.strictEqual(m.hasVariants('plate_1x2'), false);
    });

    it('returns false for empty string', () => {
        const m = new PartVariantManager();
        assert.strictEqual(m.hasVariants(''), false);
    });
});

// ─── getAllBasePartIds() ──────────────────────────────────────────────────────

describe('PartVariantManager – getAllBasePartIds()', () => {

    it('returns empty array when no variants registered', () => {
        const m = new PartVariantManager();
        assert.deepEqual(m.getAllBasePartIds(), []);
    });

    it('returns array with the registered part id', () => {
        const m = new PartVariantManager();
        m.registerVariant(makeVariant());
        assert.deepEqual(m.getAllBasePartIds(), ['brick_2x4']);
    });

    it('returns all unique base part ids', () => {
        const m = new PartVariantManager();
        m.registerVariant(makeVariant({ basePartId: 'brick_2x4' }));
        m.registerVariant(makeVariant({ basePartId: 'plate_1x2', variantId: 'rail' }));
        m.registerVariant(makeVariant({ basePartId: 'tile_1x1', variantId: 'round' }));
        const ids = m.getAllBasePartIds();
        assert.strictEqual(ids.length, 3);
        assert.ok(ids.includes('brick_2x4'));
        assert.ok(ids.includes('plate_1x2'));
        assert.ok(ids.includes('tile_1x1'));
    });

    it('does not duplicate same base part id', () => {
        const m = new PartVariantManager();
        m.registerVariant(makeVariant({ variantId: 'v1', name: 'V1' }));
        m.registerVariant(makeVariant({ variantId: 'v2', name: 'V2', isDefault: false }));
        assert.strictEqual(m.getAllBasePartIds().length, 1);
    });
});

// ─── removeVariant() ─────────────────────────────────────────────────────────

describe('PartVariantManager – removeVariant()', () => {

    it('removes an existing variant and returns true', () => {
        const m = new PartVariantManager();
        m.registerVariant(makeVariant());
        const result = m.removeVariant('brick_2x4', 'with-logo');
        assert.strictEqual(result, true);
        assert.strictEqual(m.getVariant('brick_2x4', 'with-logo'), null);
    });

    it('returns false for a non-existent variant', () => {
        const m = new PartVariantManager();
        assert.strictEqual(m.removeVariant('brick_2x4', 'nonexistent'), false);
    });

    it('returns false for a non-existent base part', () => {
        const m = new PartVariantManager();
        assert.strictEqual(m.removeVariant('unknown', 'v'), false);
    });

    it('removes the part entry entirely when last variant is deleted', () => {
        const m = new PartVariantManager();
        m.registerVariant(makeVariant());
        m.removeVariant('brick_2x4', 'with-logo');
        assert.strictEqual(m.hasVariants('brick_2x4'), false);
        assert.ok(!m.getAllBasePartIds().includes('brick_2x4'));
    });

    it('only removes the specified variant, leaves others intact', () => {
        const m = new PartVariantManager();
        m.registerVariant(makeVariant({ variantId: 'v1', name: 'V1', isDefault: false }));
        m.registerVariant(makeVariant({ variantId: 'v2', name: 'V2', isDefault: false }));
        m.removeVariant('brick_2x4', 'v1');
        assert.strictEqual(m.getVariantCount(), 1);
        assert.ok(m.getVariant('brick_2x4', 'v2') !== null);
    });

    it('returns false for empty string ids', () => {
        const m = new PartVariantManager();
        assert.strictEqual(m.removeVariant('', 'v'), false);
        assert.strictEqual(m.removeVariant('bp', ''), false);
    });
});

// ─── clearVariants() ─────────────────────────────────────────────────────────

describe('PartVariantManager – clearVariants()', () => {

    it('removes all variants for a part', () => {
        const m = new PartVariantManager();
        m.registerVariant(makeVariant({ variantId: 'v1', name: 'V1', isDefault: false }));
        m.registerVariant(makeVariant({ variantId: 'v2', name: 'V2', isDefault: false }));
        m.clearVariants('brick_2x4');
        assert.strictEqual(m.hasVariants('brick_2x4'), false);
        assert.strictEqual(m.getVariantCount(), 0);
    });

    it('does not affect variants of other parts', () => {
        const m = new PartVariantManager();
        m.registerVariant(makeVariant({ basePartId: 'brick_2x4' }));
        m.registerVariant(makeVariant({ basePartId: 'plate_1x2', variantId: 'rail' }));
        m.clearVariants('brick_2x4');
        assert.strictEqual(m.getVariantCount(), 1);
        assert.strictEqual(m.hasVariants('plate_1x2'), true);
    });

    it('is a no-op for unknown parts', () => {
        const m = new PartVariantManager();
        assert.doesNotThrow(() => m.clearVariants('unknown'));
    });

    it('is a no-op for empty string', () => {
        const m = new PartVariantManager();
        assert.doesNotThrow(() => m.clearVariants(''));
    });
});

// ─── getVariantCount() ───────────────────────────────────────────────────────

describe('PartVariantManager – getVariantCount()', () => {

    it('returns 0 for empty manager', () => {
        const m = new PartVariantManager();
        assert.strictEqual(m.getVariantCount(), 0);
    });

    it('returns correct count after registering variants', () => {
        const m = new PartVariantManager();
        m.registerVariant(makeVariant({ variantId: 'v1', name: 'V1', isDefault: false }));
        m.registerVariant(makeVariant({ variantId: 'v2', name: 'V2', isDefault: false }));
        m.registerVariant(makeVariant({ basePartId: 'plate_1x2', variantId: 'rail', name: 'Rail' }));
        assert.strictEqual(m.getVariantCount(), 3);
    });

    it('decrements after removeVariant', () => {
        const m = new PartVariantManager();
        m.registerVariant(makeVariant());
        m.removeVariant('brick_2x4', 'with-logo');
        assert.strictEqual(m.getVariantCount(), 0);
    });

    it('decrements after clearVariants', () => {
        const m = new PartVariantManager();
        m.registerVariant(makeVariant({ variantId: 'v1', name: 'V1' }));
        m.registerVariant(makeVariant({ variantId: 'v2', name: 'V2', isDefault: false }));
        m.clearVariants('brick_2x4');
        assert.strictEqual(m.getVariantCount(), 0);
    });
});

// ─── importFromJSON() ────────────────────────────────────────────────────────

describe('PartVariantManager – importFromJSON()', () => {

    const rawVariant = {
        basePartId: 'brick_2x4',
        variantId:  'import-v1',
        name:       'Importierte Variante',
    };

    it('imports a valid JSON string array', () => {
        const m = new PartVariantManager();
        const result = m.importFromJSON(JSON.stringify([rawVariant]));
        assert.strictEqual(result.imported, 1);
        assert.strictEqual(result.skipped, 0);
        assert.strictEqual(result.errors.length, 0);
    });

    it('imports from an object with { variants: [] }', () => {
        const m = new PartVariantManager();
        const result = m.importFromJSON({ variants: [rawVariant] });
        assert.strictEqual(result.imported, 1);
        assert.strictEqual(result.errors.length, 0);
    });

    it('imports from a direct array', () => {
        const m = new PartVariantManager();
        const result = m.importFromJSON([rawVariant]);
        assert.strictEqual(result.imported, 1);
    });

    it('skips duplicate without overwrite', () => {
        const m = new PartVariantManager();
        m.importFromJSON([rawVariant]);
        const result = m.importFromJSON([rawVariant]);
        assert.strictEqual(result.skipped, 1);
        assert.strictEqual(result.imported, 0);
    });

    it('overwrites duplicate with overwrite: true', () => {
        const m = new PartVariantManager();
        m.importFromJSON([rawVariant]);
        const updated = { ...rawVariant, name: 'Aktualisiert' };
        const result = m.importFromJSON([updated], { overwrite: true });
        assert.strictEqual(result.imported, 1);
        assert.strictEqual(result.skipped, 0);
    });

    it('returns parse error for invalid JSON string', () => {
        const m = new PartVariantManager();
        const result = m.importFromJSON('NOT_VALID_JSON{{{');
        assert.strictEqual(result.errors.length, 1);
        assert.strictEqual(result.imported, 0);
    });

    it('returns parse error for unsupported shape', () => {
        const m = new PartVariantManager();
        const result = m.importFromJSON({ not_variants: 123 });
        assert.strictEqual(result.errors.length, 1);
    });

    it('records validation error for item missing basePartId', () => {
        const m = new PartVariantManager();
        const bad = { variantId: 'v', name: 'N' }; // missing basePartId
        const result = m.importFromJSON([bad]);
        assert.ok(result.errors.length >= 1);
    });

    it('returns ImportResult shape: { imported, skipped, errors }', () => {
        const m = new PartVariantManager();
        const result = m.importFromJSON([rawVariant]);
        assert.ok('imported' in result);
        assert.ok('skipped' in result);
        assert.ok('errors' in result);
        assert.ok(Array.isArray(result.errors));
    });

    it('imports multiple variants in one call', () => {
        const m = new PartVariantManager();
        const v2 = { ...rawVariant, variantId: 'import-v2', name: 'V2' };
        const result = m.importFromJSON([rawVariant, v2]);
        assert.strictEqual(result.imported, 2);
    });
});

// ─── toData() ────────────────────────────────────────────────────────────────

describe('PartVariantManager – toData()', () => {

    it('returns object with variants array', () => {
        const m = new PartVariantManager();
        const data = m.toData();
        assert.ok('variants' in data);
        assert.ok(Array.isArray(data.variants));
    });

    it('returns empty variants array when no variants registered', () => {
        const m = new PartVariantManager();
        assert.strictEqual(m.toData().variants.length, 0);
    });

    it('includes all registered variants', () => {
        const m = new PartVariantManager();
        m.registerVariant(makeVariant({ variantId: 'v1', name: 'V1', isDefault: false }));
        m.registerVariant(makeVariant({ variantId: 'v2', name: 'V2', isDefault: false }));
        const data = m.toData();
        assert.strictEqual(data.variants.length, 2);
    });

    it('each variant in toData() has required keys', () => {
        const m = new PartVariantManager();
        m.registerVariant(makeVariant());
        const [v] = m.toData().variants;
        assert.ok('basePartId' in v);
        assert.ok('variantId' in v);
        assert.ok('name' in v);
        assert.ok('isDefault' in v);
    });

    it('toData() can be round-tripped through importFromJSON', () => {
        const m = new PartVariantManager();
        m.registerVariant(makeVariant());
        const exported = m.toData();

        const m2 = new PartVariantManager();
        const result = m2.importFromJSON(exported);
        assert.strictEqual(result.imported, 1);
        assert.strictEqual(m2.getVariantCount(), 1);
    });
});

// ─── Singleton ────────────────────────────────────────────────────────────────

describe('PartVariantManager – Singleton', () => {

    afterEach(() => {
        PartVariantManager.resetInstance();
    });

    it('instance() returns the same object on repeated calls', () => {
        const a = PartVariantManager.instance();
        const b = PartVariantManager.instance();
        assert.strictEqual(a, b);
    });

    it('instance() returns a PartVariantManager', () => {
        const m = PartVariantManager.instance();
        assert.ok(m instanceof PartVariantManager);
    });

    it('resetInstance() clears the singleton', () => {
        const a = PartVariantManager.instance();
        PartVariantManager.resetInstance();
        const b = PartVariantManager.instance();
        assert.notStrictEqual(a, b);
    });

    it('instance created after reset starts empty', () => {
        const a = PartVariantManager.instance();
        a.registerVariant(makeVariant());
        PartVariantManager.resetInstance();
        const b = PartVariantManager.instance();
        assert.strictEqual(b.getVariantCount(), 0);
    });
});
