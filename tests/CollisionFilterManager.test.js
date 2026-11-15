/**
 * CollisionFilterManager – Phase G.3 tests
 *
 * Coverage (~25 assertions):
 *  - GROUPS is a frozen object with GROUP_GROUND, GROUP_DYNAMIC etc.
 *  - All group values are distinct powers of 2
 *  - getCollisionGroups({ category:'bricks' }) → { memberships, filter } both numbers
 *  - getCollisionGroups({ category:'wheel' }) → different filter (includes ground)
 *  - encodeGroups(0x0001, 0x0002) → correct 32-bit packed value
 *  - encodeGroups(0xFFFF, 0xFFFF) → 0xFFFFFFFF
 *  - decodeGroups roundtrip
 *  - all memberships and filter values are integers
 *  - sensor has filter=0 (no collisions)
 *  - static/ground has GROUP_GROUND membership
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CollisionFilterManager } from '../src/physics/CollisionFilterManager.js';

// ─── Helper ──────────────────────────────────────────────────────────────────

function isPowerOfTwo(n) {
    return n > 0 && (n & (n - 1)) === 0;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CollisionFilterManager', () => {

    // ── GROUPS constant ──────────────────────────────────────────────────────

    describe('static GROUPS', () => {

        it('is a frozen object', () => {
            const G = CollisionFilterManager.GROUPS;
            assert.ok(Object.isFrozen(G), 'GROUPS is frozen');
        });

        it('has GROUP_GROUND, GROUP_DYNAMIC, GROUP_WHEELS, GROUP_AXLES, GROUP_TECHNIC, GROUP_SENSOR', () => {
            const G = CollisionFilterManager.GROUPS;
            assert.ok('GROUP_GROUND'  in G, 'GROUP_GROUND');
            assert.ok('GROUP_DYNAMIC' in G, 'GROUP_DYNAMIC');
            assert.ok('GROUP_WHEELS'  in G, 'GROUP_WHEELS');
            assert.ok('GROUP_AXLES'   in G, 'GROUP_AXLES');
            assert.ok('GROUP_TECHNIC' in G, 'GROUP_TECHNIC');
            assert.ok('GROUP_SENSOR'  in G, 'GROUP_SENSOR');
        });

        it('all group values are distinct powers of 2', () => {
            const G      = CollisionFilterManager.GROUPS;
            const values = Object.values(G);
            const set    = new Set(values);
            assert.strictEqual(set.size, values.length, 'all values distinct');
            for (const v of values) {
                assert.ok(isPowerOfTwo(v), `${v} is power of 2`);
            }
        });

        it('GROUP_GROUND = 0x0001', () => {
            assert.strictEqual(CollisionFilterManager.GROUPS.GROUP_GROUND, 0x0001);
        });

        it('GROUP_DYNAMIC = 0x0002', () => {
            assert.strictEqual(CollisionFilterManager.GROUPS.GROUP_DYNAMIC, 0x0002);
        });

    });

    // ── getCollisionGroups ───────────────────────────────────────────────────

    describe('getCollisionGroups()', () => {

        let mgr;
        // Use a fresh instance for each sub-test
        it('returns memberships and filter both as numbers for "bricks" (default dynamic)', () => {
            const m = new CollisionFilterManager();
            const g = m.getCollisionGroups({ category: 'bricks' });
            assert.ok(typeof g.memberships === 'number', 'memberships is number');
            assert.ok(typeof g.filter      === 'number', 'filter is number');
        });

        it('"bricks" membership = GROUP_DYNAMIC', () => {
            const m = new CollisionFilterManager();
            const g = m.getCollisionGroups({ category: 'bricks' });
            assert.strictEqual(g.memberships, CollisionFilterManager.GROUPS.GROUP_DYNAMIC);
        });

        it('"wheel" category → memberships = GROUP_WHEELS', () => {
            const m = new CollisionFilterManager();
            const g = m.getCollisionGroups({ category: 'wheel' });
            assert.strictEqual(g.memberships, CollisionFilterManager.GROUPS.GROUP_WHEELS);
        });

        it('"wheel" filter includes GROUP_GROUND', () => {
            const m = new CollisionFilterManager();
            const g = m.getCollisionGroups({ category: 'wheel' });
            assert.ok(
                (g.filter & CollisionFilterManager.GROUPS.GROUP_GROUND) !== 0,
                'wheel filter includes ground'
            );
        });

        it('"wheel" filter differs from default "bricks" filter', () => {
            const m = new CollisionFilterManager();
            const bricks = m.getCollisionGroups({ category: 'bricks' });
            const wheel  = m.getCollisionGroups({ category: 'wheel' });
            assert.notStrictEqual(bricks.filter, wheel.filter, 'filters differ');
        });

        it('sensor → filter = 0 (no physical collisions)', () => {
            const m = new CollisionFilterManager();
            const g = m.getCollisionGroups({ isSensor: true });
            assert.strictEqual(g.filter, 0);
        });

        it('isStatic → membership = GROUP_GROUND', () => {
            const m = new CollisionFilterManager();
            const g = m.getCollisionGroups({ isStatic: true });
            assert.strictEqual(g.memberships, CollisionFilterManager.GROUPS.GROUP_GROUND);
        });

        it('explicit collisionGroups override is returned as-is', () => {
            const m = new CollisionFilterManager();
            const g = m.getCollisionGroups({ collisionGroups: { memberships: 0x00FF, filter: 0xFF00 } });
            assert.strictEqual(g.memberships, 0x00FF);
            assert.strictEqual(g.filter,      0xFF00);
        });

        it('memberships and filter are non-negative integers', () => {
            const m  = new CollisionFilterManager();
            const g  = m.getCollisionGroups({ category: 'technic' });
            assert.ok(Number.isInteger(g.memberships) && g.memberships >= 0, 'memberships integer >= 0');
            assert.ok(Number.isInteger(g.filter)      && g.filter      >= 0, 'filter integer >= 0');
        });

    });

    // ── encodeGroups / decodeGroups ───────────────────────────────────────────

    describe('encodeGroups() / decodeGroups()', () => {

        let m;
        // Instantiate once for these tests
        const inst = new CollisionFilterManager();

        it('encodeGroups(0x0001, 0x0002) = 0x00020001', () => {
            const encoded = inst.encodeGroups(0x0001, 0x0002);
            // memberships in bits 0-15, filter in bits 16-31
            assert.strictEqual(encoded, (0x0001 | (0x0002 << 16)) >>> 0);
        });

        it('encodeGroups(0xFFFF, 0xFFFF) = 0xFFFFFFFF', () => {
            const encoded = inst.encodeGroups(0xFFFF, 0xFFFF);
            assert.strictEqual(encoded, 0xFFFFFFFF >>> 0);
        });

        it('encodeGroups(0, 0) = 0', () => {
            assert.strictEqual(inst.encodeGroups(0, 0), 0);
        });

        it('decodeGroups roundtrips encodeGroups', () => {
            const mem  = 0x0005;
            const filt = 0x00F0;
            const enc  = inst.encodeGroups(mem, filt);
            const dec  = inst.decodeGroups(enc);
            assert.strictEqual(dec.memberships, mem);
            assert.strictEqual(dec.filter,      filt);
        });

        it('encodeGroups result is a non-negative integer', () => {
            const enc = inst.encodeGroups(0x0003, 0x000C);
            assert.ok(Number.isInteger(enc) && enc >= 0, 'non-negative integer');
        });

    });

});
