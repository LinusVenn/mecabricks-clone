/**
 * PhysicsMaterialManager – Phase G.2 tests
 *
 * Coverage (~20 assertions):
 *  - getDefaultMaterial('bricks') → { friction, restitution, density }
 *  - getDefaultMaterial('wheels') → higher friction/restitution than bricks
 *  - getDefaultMaterial('tiles')  → lower friction than bricks
 *  - getDefaultMaterial('unknown-category') → returns default material (no throw)
 *  - MATERIALS → object with multiple entries
 *  - instance getMaterial('bricks') === static getDefaultMaterial('bricks')
 *  - all friction/restitution values are in [0, 1] or [0, 2] reasonable range
 *  - density > 0 for all materials
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { PhysicsMaterialManager } from '../src/physics/PhysicsMaterialManager.js';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PhysicsMaterialManager', () => {

    // ── static getDefaultMaterial ────────────────────────────────────────────

    describe('static getDefaultMaterial()', () => {

        it('returns object with friction, restitution, density for "bricks"', () => {
            const mat = PhysicsMaterialManager.getDefaultMaterial('bricks');
            assert.ok(typeof mat.friction     === 'number', 'friction is number');
            assert.ok(typeof mat.restitution  === 'number', 'restitution is number');
            assert.ok(typeof mat.density      === 'number', 'density is number');
        });

        it('"bricks" friction = 0.7', () => {
            const mat = PhysicsMaterialManager.getDefaultMaterial('bricks');
            assert.strictEqual(mat.friction, 0.7);
        });

        it('"bricks" restitution = 0.05', () => {
            const mat = PhysicsMaterialManager.getDefaultMaterial('bricks');
            assert.strictEqual(mat.restitution, 0.05);
        });

        it('"wheels" friction > "bricks" friction', () => {
            const bricks = PhysicsMaterialManager.getDefaultMaterial('bricks');
            const wheels = PhysicsMaterialManager.getDefaultMaterial('wheels');
            assert.ok(wheels.friction > bricks.friction, 'wheels friction higher');
        });

        it('"wheels" restitution > "bricks" restitution', () => {
            const bricks = PhysicsMaterialManager.getDefaultMaterial('bricks');
            const wheels = PhysicsMaterialManager.getDefaultMaterial('wheels');
            assert.ok(wheels.restitution > bricks.restitution, 'wheels restitution higher');
        });

        it('"tiles" friction < "bricks" friction', () => {
            const bricks = PhysicsMaterialManager.getDefaultMaterial('bricks');
            const tiles  = PhysicsMaterialManager.getDefaultMaterial('tiles');
            assert.ok(tiles.friction < bricks.friction, 'tiles friction lower');
        });

        it('"unknown-category" returns default material (no throw)', () => {
            assert.doesNotThrow(() => {
                const mat = PhysicsMaterialManager.getDefaultMaterial('unknown-category');
                assert.ok(typeof mat.friction === 'number');
            });
        });

        it('returns a new object each call (not the frozen original)', () => {
            const a = PhysicsMaterialManager.getDefaultMaterial('bricks');
            const b = PhysicsMaterialManager.getDefaultMaterial('bricks');
            assert.notStrictEqual(a, b, 'different object references');
        });

        it('returned object is mutable (not frozen)', () => {
            const mat = PhysicsMaterialManager.getDefaultMaterial('bricks');
            assert.doesNotThrow(() => { mat.friction = 0.99; });
        });

    });

    // ── MATERIALS constant ───────────────────────────────────────────────────

    describe('static MATERIALS', () => {

        it('is an object with multiple entries', () => {
            const mats = PhysicsMaterialManager.MATERIALS;
            assert.ok(typeof mats === 'object' && mats !== null, 'is object');
            const keys = Object.keys(mats);
            assert.ok(keys.length >= 5, `at least 5 categories (got ${keys.length})`);
        });

        it('contains "bricks", "wheels", "tiles" categories', () => {
            const mats = PhysicsMaterialManager.MATERIALS;
            assert.ok('bricks' in mats, 'bricks present');
            assert.ok('wheels' in mats, 'wheels present');
            assert.ok('tiles'  in mats, 'tiles present');
        });

        it('all friction values are in [0, 2] range', () => {
            for (const [cat, mat] of Object.entries(PhysicsMaterialManager.MATERIALS)) {
                assert.ok(mat.friction >= 0 && mat.friction <= 2,
                    `${cat}.friction=${mat.friction} out of [0,2]`);
            }
        });

        it('all restitution values are in [0, 1] range', () => {
            for (const [cat, mat] of Object.entries(PhysicsMaterialManager.MATERIALS)) {
                assert.ok(mat.restitution >= 0 && mat.restitution <= 1,
                    `${cat}.restitution=${mat.restitution} out of [0,1]`);
            }
        });

        it('all density values are > 0', () => {
            for (const [cat, mat] of Object.entries(PhysicsMaterialManager.MATERIALS)) {
                assert.ok(mat.density > 0, `${cat}.density=${mat.density} must be > 0`);
            }
        });

    });

    // ── instance getMaterial ──────────────────────────────────────────────────

    describe('instance getMaterial()', () => {

        it('getMaterial("bricks") equals static getDefaultMaterial("bricks")', () => {
            const mgr    = new PhysicsMaterialManager();
            const inst   = mgr.getMaterial('bricks');
            const stat   = PhysicsMaterialManager.getDefaultMaterial('bricks');
            assert.deepEqual(inst, stat);
        });

        it('getMaterial("wheels") returns correct friction', () => {
            const mgr = new PhysicsMaterialManager();
            const mat = mgr.getMaterial('wheels');
            assert.strictEqual(mat.friction, 0.9);
        });

    });

    // ── blendMaterial ─────────────────────────────────────────────────────────

    describe('instance blendMaterial()', () => {

        it('overrides friction but keeps restitution from base', () => {
            const mgr  = new PhysicsMaterialManager();
            const base = PhysicsMaterialManager.getDefaultMaterial('bricks');
            const mat  = mgr.blendMaterial('bricks', { friction: 0.3 });
            assert.strictEqual(mat.friction,    0.3);
            assert.strictEqual(mat.restitution, base.restitution);
        });

    });

});
