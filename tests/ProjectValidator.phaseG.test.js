/**
 * ProjectValidator – Phase G tests
 *
 * Coverage (~20 assertions):
 *  - Valid project with no `physics` field → valid
 *  - Valid project with `physics: {}` (empty) → valid
 *  - Valid project with full physics object → valid
 *  - physics.gravity.y is number → valid
 *  - physics.gravity with missing axis → throws
 *  - physics.enabled: true → valid
 *  - physics.enabled: 'yes' → throws
 *  - physics.bodies: {} → valid
 *  - physics.bodies.inst1 = { type: 'dynamic' } → valid
 *  - physics.bodies.inst1 = { type: 'flying' } → throws (invalid type)
 *  - physics: "invalid" → throws
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ProjectValidator } from '../src/project/ProjectValidator.js';

// ─── Shared validator instance ────────────────────────────────────────────────

const validator = new ProjectValidator();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a minimal valid v4 project.
 * Extra fields (including physics) can be added via overrides.
 */
function makeValidV4Project(overrides = {}) {
    return {
        format:  'mecabricks-clone',
        version: 4,
        project: {
            id:        'proj-g',
            name:      'Phase-G-Test',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
        },
        bricks:      [],
        connections: [],
        groups:      [],
        components:  [],
        ...overrides,
    };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ProjectValidator – Phase G (physics field)', () => {

    // ── physics field absent ─────────────────────────────────────────────────

    it('valid project with no physics field → valid', () => {
        const project = makeValidV4Project();
        // physics key completely absent
        assert.strictEqual(validator.validate(project), true);
    });

    // ── physics: {} ──────────────────────────────────────────────────────────

    it('physics: {} (empty object) → valid', () => {
        const project = makeValidV4Project({ physics: {} });
        assert.strictEqual(validator.validate(project), true);
    });

    // ── physics.gravity ───────────────────────────────────────────────────────

    it('physics.gravity with all three axes as numbers → valid', () => {
        const project = makeValidV4Project({ physics: { gravity: { x: 0, y: -9.81, z: 0 } } });
        assert.strictEqual(validator.validate(project), true);
    });

    it('physics.gravity.y = 0 (zero gravity) → valid', () => {
        const project = makeValidV4Project({ physics: { gravity: { x: 0, y: 0, z: 0 } } });
        assert.strictEqual(validator.validate(project), true);
    });

    it('physics.gravity with missing z axis → throws', () => {
        const project = makeValidV4Project({ physics: { gravity: { x: 0, y: -9.81 } } });
        assert.throws(
            () => validator.validate(project),
            /physics\.gravity/
        );
    });

    it('physics.gravity with non-number y → throws', () => {
        const project = makeValidV4Project({ physics: { gravity: { x: 0, y: 'down', z: 0 } } });
        assert.throws(
            () => validator.validate(project),
            /physics\.gravity/
        );
    });

    it('physics.gravity as array → throws', () => {
        const project = makeValidV4Project({ physics: { gravity: [0, -9.81, 0] } });
        assert.throws(
            () => validator.validate(project),
            /physics\.gravity/
        );
    });

    // ── physics.enabled ───────────────────────────────────────────────────────

    it('physics.enabled: true → valid', () => {
        const project = makeValidV4Project({ physics: { enabled: true } });
        assert.strictEqual(validator.validate(project), true);
    });

    it('physics.enabled: false → valid', () => {
        const project = makeValidV4Project({ physics: { enabled: false } });
        assert.strictEqual(validator.validate(project), true);
    });

    it('physics.enabled: "yes" → throws', () => {
        const project = makeValidV4Project({ physics: { enabled: 'yes' } });
        assert.throws(
            () => validator.validate(project),
            /physics\.enabled/
        );
    });

    it('physics.enabled: 1 → throws (not boolean)', () => {
        const project = makeValidV4Project({ physics: { enabled: 1 } });
        assert.throws(
            () => validator.validate(project),
            /physics\.enabled/
        );
    });

    // ── physics.bodies ────────────────────────────────────────────────────────

    it('physics.bodies: {} (empty) → valid', () => {
        const project = makeValidV4Project({ physics: { bodies: {} } });
        assert.strictEqual(validator.validate(project), true);
    });

    it('physics.bodies.inst1 = { type: "dynamic" } → valid', () => {
        const project = makeValidV4Project({
            physics: { bodies: { inst1: { type: 'dynamic' } } },
        });
        assert.strictEqual(validator.validate(project), true);
    });

    it('physics.bodies.inst1 = { type: "fixed" } → valid', () => {
        const project = makeValidV4Project({
            physics: { bodies: { inst1: { type: 'fixed' } } },
        });
        assert.strictEqual(validator.validate(project), true);
    });

    it('physics.bodies.inst1 = { type: "kinematicPosition" } → valid', () => {
        const project = makeValidV4Project({
            physics: { bodies: { inst1: { type: 'kinematicPosition' } } },
        });
        assert.strictEqual(validator.validate(project), true);
    });

    it('physics.bodies.inst1 = { type: "flying" } → throws', () => {
        const project = makeValidV4Project({
            physics: { bodies: { inst1: { type: 'flying' } } },
        });
        assert.throws(
            () => validator.validate(project),
            /flying/
        );
    });

    it('physics.bodies = [] (array) → throws', () => {
        const project = makeValidV4Project({ physics: { bodies: [] } });
        assert.throws(
            () => validator.validate(project),
            /physics\.bodies/
        );
    });

    // ── physics: invalid types ────────────────────────────────────────────────

    it('physics: "invalid" (string) → throws', () => {
        const project = makeValidV4Project({ physics: 'invalid' });
        assert.throws(
            () => validator.validate(project),
            /physics/
        );
    });

    it('physics: 42 (number) → throws', () => {
        const project = makeValidV4Project({ physics: 42 });
        assert.throws(
            () => validator.validate(project),
            /physics/
        );
    });

    // ── full physics object ───────────────────────────────────────────────────

    it('full physics object with gravity + enabled + bodies → valid', () => {
        const project = makeValidV4Project({
            physics: {
                enabled: true,
                gravity: { x: 0, y: -9.81, z: 0 },
                bodies:  {
                    'brick-1': { type: 'dynamic' },
                    'brick-2': { type: 'fixed'   },
                },
            },
        });
        assert.strictEqual(validator.validate(project), true);
    });

});
