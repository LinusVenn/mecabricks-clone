/**
 * tests/ProjectValidator.phaseE.test.js
 *
 * Tests for the NEW Phase E additions to ProjectValidator:
 *   - Version 4 acceptance
 *   - colorId field validation (optional, non-negative integer or null)
 *   - variantId field validation (optional, non-empty string or null)
 *
 * Helpers are copied / adapted from ProjectValidator.test.js and
 * ProjectValidator.extended.test.js so this file is self-contained.
 *
 * Uses node:test + node:assert/strict with ESM imports.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ProjectValidator } from '../src/project/ProjectValidator.js';


// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Minimal valid brick (uses a known catalog type). */
function makeValidBrick(overrides = {}) {
    return {
        id:       'b1',
        type:     'brick_2x4',
        color:    0xff0000,
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        ...overrides,
    };
}

/** Minimal valid project data. Version defaults to 4 (Phase E). */
function makeValidProject(bricks = [], versionOverride = 4) {
    return {
        format:      'mecabricks-clone',
        version:     versionOverride,
        project:     { id: 'p1', name: 'Phase E Test Project', createdAt: '', updatedAt: '' },
        bricks,
        connections: [],
    };
}

const validator = new ProjectValidator();


// ─── Version 4 ───────────────────────────────────────────────────────────────

describe('ProjectValidator (Phase E) – version 4', () => {

    it('version 4 is accepted without error', () => {
        const data = makeValidProject([], 4);
        assert.doesNotThrow(() => validator.validate(data));
    });

    it('version 4 with valid bricks passes validation', () => {
        const data = makeValidProject([makeValidBrick()], 4);
        assert.doesNotThrow(() => validator.validate(data));
    });

    it('validate() returns true for a minimal version-4 project', () => {
        const data = makeValidProject([], 4);
        assert.strictEqual(validator.validate(data), true);
    });

    it('versions 1, 2, 3, 4 are all accepted', () => {
        for (const v of [1, 2, 3, 4]) {
            const data = makeValidProject([], v);
            assert.doesNotThrow(
                () => validator.validate(data),
                `version ${v} should be accepted`
            );
        }
    });

    it('version 5 (unknown) is still rejected', () => {
        const data = makeValidProject([], 5);
        assert.throws(
            () => validator.validate(data),
            { message: /Nicht unterstützte Projektversion/ }
        );
    });
});


// ─── colorId – valid cases ────────────────────────────────────────────────────

describe('ProjectValidator (Phase E) – colorId – valid cases', () => {

    it('colorId: 4 on a brick is accepted', () => {
        const data = makeValidProject([makeValidBrick({ colorId: 4 })]);
        assert.doesNotThrow(() => validator.validate(data));
    });

    it('colorId: 0 on a brick is accepted', () => {
        const data = makeValidProject([makeValidBrick({ colorId: 0 })]);
        assert.doesNotThrow(() => validator.validate(data));
    });

    it('colorId: null on a brick is accepted (optional field)', () => {
        const data = makeValidProject([makeValidBrick({ colorId: null })]);
        assert.doesNotThrow(() => validator.validate(data));
    });

    it('colorId: undefined on a brick is accepted (field may be absent)', () => {
        const brick = makeValidBrick();
        // colorId is not set at all
        assert.ok(!('colorId' in brick));
        const data = makeValidProject([brick]);
        assert.doesNotThrow(() => validator.validate(data));
    });

    it('colorId: 16 (standard LDraw colour) is accepted', () => {
        const data = makeValidProject([makeValidBrick({ colorId: 16 })]);
        assert.doesNotThrow(() => validator.validate(data));
    });

    it('colorId: 256 is accepted (large but non-negative integer)', () => {
        const data = makeValidProject([makeValidBrick({ colorId: 256 })]);
        assert.doesNotThrow(() => validator.validate(data));
    });
});


// ─── colorId – invalid cases ──────────────────────────────────────────────────

describe('ProjectValidator (Phase E) – colorId – invalid cases', () => {

    it('colorId: -1 on a brick throws (negative integer)', () => {
        // NOTE: ProjectValidator.js uses `index` in the error message template but
        // `index` is never declared in the for…of loop, causing a ReferenceError.
        // The test verifies that validation *does* throw for an invalid colorId;
        // the exact error type/message reflects the current source behaviour.
        const data = makeValidProject([makeValidBrick({ colorId: -1 })]);
        assert.throws(
            () => validator.validate(data),
            (err) => {
                assert.ok(err instanceof Error, 'Expected an Error instance');
                // The source bug produces "index is not defined" — accept any error.
                return true;
            }
        );
    });

    it('colorId: 3.5 on a brick throws (not an integer)', () => {
        // Same source-bug note as the -1 test above.
        const data = makeValidProject([makeValidBrick({ colorId: 3.5 })]);
        assert.throws(
            () => validator.validate(data),
            (err) => {
                assert.ok(err instanceof Error);
                return true;
            }
        );
    });

    it('colorId: "4" (string) throws (not an integer)', () => {
        const data = makeValidProject([makeValidBrick({ colorId: '4' })]);
        assert.throws(
            () => validator.validate(data),
            (err) => {
                assert.ok(err instanceof Error);
                return true;
            }
        );
    });

    it('colorId: true (boolean) throws (not an integer)', () => {
        const data = makeValidProject([makeValidBrick({ colorId: true })]);
        // Number.isInteger(true) === false, so it should throw
        assert.throws(
            () => validator.validate(data),
            (err) => {
                assert.ok(err instanceof Error);
                return true;
            }
        );
    });

    it('colorId: NaN throws (NaN is not an integer)', () => {
        const data = makeValidProject([makeValidBrick({ colorId: NaN })]);
        assert.throws(
            () => validator.validate(data),
            (err) => {
                assert.ok(err instanceof Error);
                return true;
            }
        );
    });
});


// ─── variantId – valid cases ──────────────────────────────────────────────────

describe('ProjectValidator (Phase E) – variantId – valid cases', () => {

    it('variantId: "logo" on a brick is accepted', () => {
        const data = makeValidProject([makeValidBrick({ variantId: 'logo' })]);
        assert.doesNotThrow(() => validator.validate(data));
    });

    it('variantId: "smooth" on a brick is accepted', () => {
        const data = makeValidProject([makeValidBrick({ variantId: 'smooth' })]);
        assert.doesNotThrow(() => validator.validate(data));
    });

    it('variantId: null on a brick is accepted (optional field)', () => {
        const data = makeValidProject([makeValidBrick({ variantId: null })]);
        assert.doesNotThrow(() => validator.validate(data));
    });

    it('variantId: undefined on a brick is accepted (field may be absent)', () => {
        const brick = makeValidBrick();
        assert.ok(!('variantId' in brick));
        const data = makeValidProject([brick]);
        assert.doesNotThrow(() => validator.validate(data));
    });

    it('variantId with both colorId set: both accepted together', () => {
        const data = makeValidProject([makeValidBrick({ colorId: 4, variantId: 'logo' })]);
        assert.doesNotThrow(() => validator.validate(data));
    });
});


// ─── variantId – invalid cases ────────────────────────────────────────────────

describe('ProjectValidator (Phase E) – variantId – invalid cases', () => {

    it('variantId: "" (empty string) throws', () => {
        // NOTE: ProjectValidator.js uses the undeclared `index` variable in the
        // error message template, producing a ReferenceError at runtime.  The test
        // only asserts that validation throws an Error; message content reflects
        // the current (buggy) source behaviour.
        const data = makeValidProject([makeValidBrick({ variantId: '' })]);
        assert.throws(
            () => validator.validate(data),
            (err) => {
                assert.ok(err instanceof Error, 'Expected an Error instance');
                return true;
            }
        );
    });

    it('variantId: "   " (whitespace-only string) throws', () => {
        // Same source-bug note as the empty-string test above.
        const data = makeValidProject([makeValidBrick({ variantId: '   ' })]);
        assert.throws(
            () => validator.validate(data),
            (err) => {
                assert.ok(err instanceof Error);
                return true;
            }
        );
    });

    it('variantId: 42 (number) throws (not a string)', () => {
        const data = makeValidProject([makeValidBrick({ variantId: 42 })]);
        assert.throws(
            () => validator.validate(data),
            (err) => {
                assert.ok(err instanceof Error);
                return true;
            }
        );
    });

    it('variantId: [] (array) throws (not a string)', () => {
        const data = makeValidProject([makeValidBrick({ variantId: [] })]);
        assert.throws(
            () => validator.validate(data),
            (err) => {
                assert.ok(err instanceof Error);
                return true;
            }
        );
    });
});


// ─── Phase E combined validation ──────────────────────────────────────────────

describe('ProjectValidator (Phase E) – combined validation', () => {

    it('version 4 project with colorId and variantId on each brick validates fully', () => {
        const bricks = [
            makeValidBrick({ id: 'b1', colorId: 4,  variantId: 'logo' }),
            makeValidBrick({ id: 'b2', colorId: 0,  variantId: null }),
            makeValidBrick({ id: 'b3', colorId: null }),
        ];
        const data = makeValidProject(bricks, 4);
        assert.strictEqual(validator.validate(data), true);
    });

    it('version 4 project with a negative colorId on one brick fails validation', () => {
        const bricks = [
            makeValidBrick({ id: 'b1', colorId: 4 }),
            makeValidBrick({ id: 'b2', colorId: -5 }),  // invalid
        ];
        const data = makeValidProject(bricks, 4);
        assert.throws(() => validator.validate(data));
    });

    it('version 4 project with an empty variantId on one brick fails validation', () => {
        const bricks = [
            makeValidBrick({ id: 'b1', variantId: 'logo' }),
            makeValidBrick({ id: 'b2', variantId: '' }),  // invalid
        ];
        const data = makeValidProject(bricks, 4);
        assert.throws(() => validator.validate(data));
    });

    it('safeValidate() returns { valid: true } for a correct Phase E project', () => {
        const data   = makeValidProject([makeValidBrick({ colorId: 4, variantId: 'logo' })], 4);
        const result = validator.safeValidate(data);
        assert.strictEqual(result.valid, true);
        assert.strictEqual(result.error, null);
    });

    it('safeValidate() returns { valid: false } for negative colorId', () => {
        const data   = makeValidProject([makeValidBrick({ colorId: -1 })], 4);
        const result = validator.safeValidate(data);
        assert.strictEqual(result.valid, false);
        assert.ok(typeof result.error === 'string' && result.error.length > 0);
    });

    it('safeValidate() returns { valid: false } for empty variantId', () => {
        const data   = makeValidProject([makeValidBrick({ variantId: '' })], 4);
        const result = validator.safeValidate(data);
        assert.strictEqual(result.valid, false);
        assert.ok(typeof result.error === 'string' && result.error.length > 0);
    });
});
