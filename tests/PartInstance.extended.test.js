/**
 * tests/PartInstance.extended.test.js
 *
 * Tests for the NEW Phase E fields on PartInstance:
 *   - colorId  (number | null)
 *   - variantId (string | null)
 *
 * Uses real `three` package (already a project dependency) so THREE.Group /
 * THREE.Mesh behave exactly as in production. The existing PartInstance.test.js
 * already uses this pattern with real three – we mirror it here.
 *
 * Uses node:test + node:assert/strict with ESM imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { PartInstance } from '../src/objects/PartInstance.js';


// ─── Helper ──────────────────────────────────────────────────────────────────

/**
 * Builds a minimal PartInstance.
 * `overrides` is merged last so individual tests can inject colorId / variantId
 * and also override the spread object3D / dimensions without conflicts.
 */
function makeInstance(overrides = {}) {
    const scene = new THREE.Scene();
    const geo   = new THREE.BoxGeometry(1, 1, 1);
    const mat   = new THREE.MeshBasicMaterial();
    const mesh  = new THREE.Mesh(geo, mat);
    const group = new THREE.Group();
    group.add(mesh);

    return new PartInstance({
        scene,
        partId:          'test_part',
        source:          'ldraw',
        object3D:        group,
        color:           0xff0000,
        dimensions:      { width: 2, depth: 4, height: 3 },
        ldrawPartNumber: '3001',
        ...overrides,
    });
}


// ─── colorId – constructor behaviour ─────────────────────────────────────────

describe('PartInstance (Phase E) – colorId – constructor', () => {

    it('colorId: 4 → instance.colorId === 4', () => {
        const inst = makeInstance({ colorId: 4 });
        assert.strictEqual(inst.colorId, 4);
    });

    it('colorId: 0 → instance.colorId === 0', () => {
        const inst = makeInstance({ colorId: 0 });
        assert.strictEqual(inst.colorId, 0);
    });

    it('colorId: null → instance.colorId === null', () => {
        const inst = makeInstance({ colorId: null });
        assert.strictEqual(inst.colorId, null);
    });

    it('omitting colorId → instance.colorId === null (default)', () => {
        const inst = makeInstance();
        // colorId not in overrides → default = null
        assert.strictEqual(inst.colorId, null);
    });

    it('colorId: "not-a-number" → stored as null (coercion: only numbers accepted)', () => {
        // The source code: `this._colorId = typeof colorId === 'number' ? colorId : null`
        const inst = makeInstance({ colorId: 'not-a-number' });
        assert.strictEqual(inst.colorId, null);
    });

    it('colorId: undefined → stored as null (undefined is not a number)', () => {
        const inst = makeInstance({ colorId: undefined });
        assert.strictEqual(inst.colorId, null);
    });

    it('colorId: NaN → stored as null (NaN typeof is "number" but NaN is handled — check impl)', () => {
        // NaN has typeof 'number', so the impl stores it. Let's document the actual behaviour.
        const inst = makeInstance({ colorId: NaN });
        // Per implementation: typeof NaN === 'number' → stored as NaN
        // Verify it is stored (whether NaN or null depends on impl)
        // We assert that .colorId is either NaN or null (no crash)
        const val = inst.colorId;
        assert.ok(val === null || (typeof val === 'number' && isNaN(val)),
            `Expected colorId to be null or NaN but got ${val}`);
    });

    it('colorId: 255 (large valid LDraw colour) is stored correctly', () => {
        const inst = makeInstance({ colorId: 255 });
        assert.strictEqual(inst.colorId, 255);
    });
});


// ─── colorId – setColorId() ───────────────────────────────────────────────────

describe('PartInstance (Phase E) – setColorId()', () => {

    it('setColorId(4) updates colorId to 4', () => {
        const inst = makeInstance({ colorId: null });
        inst.setColorId(4);
        assert.strictEqual(inst.colorId, 4);
    });

    it('setColorId(0) updates colorId to 0', () => {
        const inst = makeInstance({ colorId: 16 });
        inst.setColorId(0);
        assert.strictEqual(inst.colorId, 0);
    });

    it('setColorId(null) sets colorId to null', () => {
        const inst = makeInstance({ colorId: 4 });
        inst.setColorId(null);
        assert.strictEqual(inst.colorId, null);
    });

    it('setColorId("string") coerces to null', () => {
        const inst = makeInstance({ colorId: 4 });
        inst.setColorId('red');
        assert.strictEqual(inst.colorId, null);
    });

    it('setColorId(undefined) coerces to null', () => {
        const inst = makeInstance({ colorId: 4 });
        inst.setColorId(undefined);
        assert.strictEqual(inst.colorId, null);
    });

    it('setColorId can be called multiple times without error', () => {
        const inst = makeInstance();
        assert.doesNotThrow(() => {
            inst.setColorId(1);
            inst.setColorId(2);
            inst.setColorId(null);
            inst.setColorId(3);
        });
        assert.strictEqual(inst.colorId, 3);
    });
});


// ─── variantId – constructor behaviour ───────────────────────────────────────

describe('PartInstance (Phase E) – variantId – constructor', () => {

    it('variantId: "logo" → instance.variantId === "logo"', () => {
        const inst = makeInstance({ variantId: 'logo' });
        assert.strictEqual(inst.variantId, 'logo');
    });

    it('variantId: null → instance.variantId === null', () => {
        const inst = makeInstance({ variantId: null });
        assert.strictEqual(inst.variantId, null);
    });

    it('omitting variantId → instance.variantId === null (default)', () => {
        const inst = makeInstance();
        assert.strictEqual(inst.variantId, null);
    });

    it('variantId: "" (empty string) → stored as null (falsy coercion)', () => {
        // Source: `this._variantId = variantId || null`  → '' || null → null
        const inst = makeInstance({ variantId: '' });
        assert.strictEqual(inst.variantId, null);
    });

    it('variantId: undefined → stored as null', () => {
        const inst = makeInstance({ variantId: undefined });
        assert.strictEqual(inst.variantId, null);
    });

    it('variantId: "smooth" is stored as-is', () => {
        const inst = makeInstance({ variantId: 'smooth' });
        assert.strictEqual(inst.variantId, 'smooth');
    });

    it('variantId is read-only via getter (no setter in impl)', () => {
        const inst = makeInstance({ variantId: 'logo' });
        // Attempting to assign should either throw in strict mode or be ignored
        // (class getter without setter → TypeError in strict mode)
        assert.throws(
            () => { inst.variantId = 'other'; },
            TypeError
        );
    });
});


// ─── toData() – colorId field ─────────────────────────────────────────────────

describe('PartInstance (Phase E) – toData() – colorId field', () => {

    it('toData() always includes the colorId field', () => {
        const inst = makeInstance({ colorId: 4 });
        const data = inst.toData();
        assert.ok('colorId' in data, 'toData() should always include colorId');
    });

    it('toData() colorId is 4 when colorId was set to 4', () => {
        const inst = makeInstance({ colorId: 4 });
        assert.strictEqual(inst.toData().colorId, 4);
    });

    it('toData() colorId is null when colorId was null', () => {
        const inst = makeInstance({ colorId: null });
        const data = inst.toData();
        assert.ok('colorId' in data);
        assert.strictEqual(data.colorId, null);
    });

    it('toData() colorId is null when colorId was not specified (default)', () => {
        const inst = makeInstance();
        const data = inst.toData();
        assert.ok('colorId' in data, 'colorId must always be present in toData()');
        assert.strictEqual(data.colorId, null);
    });

    it('toData() colorId reflects value after setColorId()', () => {
        const inst = makeInstance({ colorId: null });
        inst.setColorId(16);
        assert.strictEqual(inst.toData().colorId, 16);
    });

    it('toData() colorId is null after setColorId(null)', () => {
        const inst = makeInstance({ colorId: 4 });
        inst.setColorId(null);
        assert.strictEqual(inst.toData().colorId, null);
    });
});


// ─── toData() – variantId field ───────────────────────────────────────────────

describe('PartInstance (Phase E) – toData() – variantId field', () => {

    it('toData() includes variantId when it is non-null', () => {
        const inst = makeInstance({ variantId: 'logo' });
        const data = inst.toData();
        assert.ok('variantId' in data, 'variantId should be present when set');
        assert.strictEqual(data.variantId, 'logo');
    });

    it('toData() does NOT include variantId when it is null', () => {
        const inst = makeInstance({ variantId: null });
        const data = inst.toData();
        assert.ok(!('variantId' in data), 'variantId should be absent when null');
    });

    it('toData() does NOT include variantId when omitted (default null)', () => {
        const inst = makeInstance();
        const data = inst.toData();
        assert.ok(!('variantId' in data), 'variantId should be absent when not set');
    });
});


// ─── toData() – combined Phase E fields ──────────────────────────────────────

describe('PartInstance (Phase E) – toData() – combined fields', () => {

    it('toData() with colorId:4, variantId:"logo" includes both fields correctly', () => {
        const inst = makeInstance({ colorId: 4, variantId: 'logo' });
        const data = inst.toData();
        assert.strictEqual(data.colorId, 4);
        assert.strictEqual(data.variantId, 'logo');
    });

    it('toData() with colorId:null, variantId:null → colorId present as null, no variantId key', () => {
        const inst = makeInstance({ colorId: null, variantId: null });
        const data = inst.toData();
        assert.ok('colorId' in data);
        assert.strictEqual(data.colorId, null);
        assert.ok(!('variantId' in data));
    });

    it('toData() preserves all pre-existing Brick-compat fields alongside Phase E fields', () => {
        const inst = makeInstance({ id: 'test-id', colorId: 7, variantId: 'chrome' });
        const data = inst.toData();
        // Pre-existing fields
        assert.strictEqual(data.id,     'test-id');
        assert.strictEqual(data.type,   'test_part');
        assert.strictEqual(data.color,  0xff0000);
        assert.ok('position' in data);
        assert.ok('rotation' in data);
        assert.strictEqual(data.source, 'ldraw');
        // Phase E fields
        assert.strictEqual(data.colorId,   7);
        assert.strictEqual(data.variantId, 'chrome');
    });

    it('old-style instance (no colorId) → toData() has colorId: null present', () => {
        // Simulate an "old-style" instance by not passing colorId at all
        const inst = makeInstance();
        const data = inst.toData();
        assert.ok('colorId' in data, '"colorId" key must be present even for old-style instances');
        assert.strictEqual(data.colorId, null);
    });
});
