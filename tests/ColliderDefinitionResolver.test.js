/**
 * ColliderDefinitionResolver – Phase G.2 tests
 *
 * Coverage (~25 assertions):
 *  - resolve brick → box
 *  - resolve plate → box
 *  - resolve tile  → box
 *  - resolve brick_round → cylinder
 *  - resolve technic → box
 *  - resolve slope → box
 *  - resolve unknown geometry → box fallback
 *  - STUD_TO_METER constant
 *  - resolve never throws for valid part defs
 *  - resolveMultiple → array with ≥1 entry
 *  - box params are positive numbers (halfX/Y/Z)
 *  - cylinder params have halfHeight and radius
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ColliderDefinitionResolver } from '../src/physics/ColliderDefinitionResolver.js';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('ColliderDefinitionResolver', () => {

    // ── STUD_TO_METER constant ───────────────────────────────────────────────

    it('STUD_TO_METER is 0.008', () => {
        assert.strictEqual(ColliderDefinitionResolver.STUD_TO_METER, 0.008);
    });

    // ── resolve: box-based geometries ────────────────────────────────────────

    describe('static resolve() → box shapes', () => {

        it('brick → shape: box', () => {
            const def = ColliderDefinitionResolver.resolve({ geometry: 'brick', width: 2, depth: 4, height: 1.2 });
            assert.strictEqual(def.shape, 'box');
        });

        it('brick → params has halfX, halfY, halfZ', () => {
            const def = ColliderDefinitionResolver.resolve({ geometry: 'brick', width: 2, depth: 4, height: 1.2 });
            assert.ok(typeof def.params.halfX === 'number', 'halfX is number');
            assert.ok(typeof def.params.halfY === 'number', 'halfY is number');
            assert.ok(typeof def.params.halfZ === 'number', 'halfZ is number');
        });

        it('brick → halfX = (2 * STUD_TO_METER) / 2', () => {
            const def = ColliderDefinitionResolver.resolve({ geometry: 'brick', width: 2, depth: 4, height: 1.2 });
            const expected = (2 * ColliderDefinitionResolver.STUD_TO_METER) / 2;
            assert.strictEqual(def.params.halfX, expected);
        });

        it('plate → shape: box', () => {
            const def = ColliderDefinitionResolver.resolve({ geometry: 'plate', width: 2, depth: 2, height: 0.4 });
            assert.strictEqual(def.shape, 'box');
        });

        it('tile → shape: box', () => {
            const def = ColliderDefinitionResolver.resolve({ geometry: 'tile', width: 1, depth: 2, height: 0.4 });
            assert.strictEqual(def.shape, 'box');
        });

        it('technic → shape: box', () => {
            const def = ColliderDefinitionResolver.resolve({ geometry: 'technic', width: 5, depth: 1, height: 1.2 });
            assert.strictEqual(def.shape, 'box');
        });

        it('slope → shape: box (simplified)', () => {
            const def = ColliderDefinitionResolver.resolve({ geometry: 'slope', width: 2, depth: 2, height: 1.2 });
            assert.strictEqual(def.shape, 'box');
        });

        it('unknown geometry → box fallback', () => {
            const def = ColliderDefinitionResolver.resolve({ geometry: 'unknown_ldraw', width: 2, depth: 2, height: 1.2 });
            assert.strictEqual(def.shape, 'box');
        });

        it('no geometry / no category → box fallback', () => {
            const def = ColliderDefinitionResolver.resolve({ width: 1, depth: 1, height: 1 });
            assert.strictEqual(def.shape, 'box');
        });

    });

    // ── resolve: cylinder-based geometries ──────────────────────────────────

    describe('static resolve() → cylinder shapes', () => {

        it('brick_round → shape: cylinder', () => {
            const def = ColliderDefinitionResolver.resolve({ geometry: 'brick_round', width: 1, depth: 1, height: 1.2 });
            assert.strictEqual(def.shape, 'cylinder');
        });

        it('cylinder params have halfHeight and radius', () => {
            const def = ColliderDefinitionResolver.resolve({ geometry: 'brick_round', width: 1, depth: 1, height: 1.2 });
            assert.ok(typeof def.params.halfHeight === 'number', 'halfHeight is number');
            assert.ok(typeof def.params.radius     === 'number', 'radius is number');
        });

        it('cylinder params are positive', () => {
            const def = ColliderDefinitionResolver.resolve({ geometry: 'brick_round', width: 2, depth: 2, height: 2 });
            assert.ok(def.params.halfHeight > 0, 'halfHeight > 0');
            assert.ok(def.params.radius     > 0, 'radius > 0');
        });

    });

    // ── resolve never throws ─────────────────────────────────────────────────

    describe('static resolve() never throws for valid input', () => {

        const geometries = ['brick', 'plate', 'tile', 'brick_round', 'technic', 'slope', 'window', 'dome', 'axle'];

        for (const geo of geometries) {
            it(`does not throw for geometry="${geo}"`, () => {
                assert.doesNotThrow(() => {
                    ColliderDefinitionResolver.resolve({ geometry: geo, width: 2, depth: 2, height: 1.2 });
                });
            });
        }

    });

    // ── resolveMultiple ──────────────────────────────────────────────────────

    describe('static resolveMultiple()', () => {

        it('returns an array with at least one entry for a brick', () => {
            const defs = ColliderDefinitionResolver.resolveMultiple({ geometry: 'brick', width: 2, depth: 4, height: 1.2 });
            assert.ok(Array.isArray(defs), 'returns array');
            assert.ok(defs.length >= 1, 'at least one entry');
        });

        it('returns one entry for standard brick', () => {
            const defs = ColliderDefinitionResolver.resolveMultiple({ geometry: 'brick', width: 2, depth: 4, height: 1.2 });
            assert.strictEqual(defs.length, 1);
        });

        it('technic_pin returns two entries (compound collider)', () => {
            const defs = ColliderDefinitionResolver.resolveMultiple({ geometry: 'technic_pin', width: 1, depth: 1, height: 1.2 });
            assert.strictEqual(defs.length, 2);
        });

    });

    // ── getHalfExtentsFromPartDef ─────────────────────────────────────────────

    describe('static getHalfExtentsFromPartDef()', () => {

        it('returns correct half-extents for 2×4 brick', () => {
            const he = ColliderDefinitionResolver.getHalfExtentsFromPartDef({ width: 2, depth: 4, height: 1.2 });
            const S = ColliderDefinitionResolver.STUD_TO_METER;
            assert.strictEqual(he.halfX, (2 * S) / 2);
            assert.strictEqual(he.halfZ, (4 * S) / 2);
        });

    });

});
