/**
 * CoordinateConverter.test.js – Phase H
 *
 * Tests for CoordinateConverter: coordinate conversion between Three.js and LDraw,
 * rotation matrix generation, and LDraw line formatting.
 *
 * Assertions: ~30
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CoordinateConverter } from '../src/export/CoordinateConverter.js';

// ─── Helper ──────────────────────────────────────────────────────────────────

/** Assert two numbers are approximately equal within tolerance. */
function approxEqual(a, b, tolerance = 1e-9) {
    assert.ok(
        Math.abs(a - b) <= tolerance,
        `Expected ${a} ≈ ${b} (tolerance ${tolerance})`
    );
}

/** Assert two 9-element arrays are element-wise approximately equal. */
function matApproxEqual(actual, expected, tolerance = 1e-9) {
    assert.equal(actual.length, 9, 'Matrix must have 9 elements');
    for (let i = 0; i < 9; i++) {
        approxEqual(actual[i], expected[i], tolerance);
    }
}

// ─── Constants ───────────────────────────────────────────────────────────────

describe('CoordinateConverter – constants', () => {
    it('STUD_TO_LDRAW is 20', () => {
        assert.equal(CoordinateConverter.STUD_TO_LDRAW, 20);
    });

    it('MIRROR_Y has 9 elements', () => {
        assert.equal(CoordinateConverter.MIRROR_Y.length, 9);
    });

    it('MIRROR_Y diagonal is [1, -1, 1] and off-diagonals are 0', () => {
        const m = CoordinateConverter.MIRROR_Y;
        // Column-major layout: [m00,m10,m20, m01,m11,m21, m02,m12,m22]
        assert.equal(m[0],  1,  'm00');   // (row0, col0)
        assert.equal(m[4], -1,  'm11');   // (row1, col1)
        assert.equal(m[8],  1,  'm22');   // (row2, col2)
        // All off-diagonal entries
        assert.equal(m[1], 0, 'm10');
        assert.equal(m[2], 0, 'm20');
        assert.equal(m[3], 0, 'm01');
        assert.equal(m[5], 0, 'm21');
        assert.equal(m[6], 0, 'm02');
        assert.equal(m[7], 0, 'm12');
    });
});

// ─── positionToLDraw ─────────────────────────────────────────────────────────

describe('CoordinateConverter.positionToLDraw', () => {
    it('converts {x:1, y:2, z:3} → {x:20, y:-40, z:60}', () => {
        const result = CoordinateConverter.positionToLDraw({ x: 1, y: 2, z: 3 });
        assert.deepEqual(result, { x: 20, y: -40, z: 60 });
    });

    it('converts origin {x:0, y:0, z:0} → coords all equal zero', () => {
        const result = CoordinateConverter.positionToLDraw({ x: 0, y: 0, z: 0 });
        // Use numeric == to treat -0 and 0 as equal (both are "zero")
        assert.ok(result.x == 0, `x should be 0, got ${result.x}`);
        assert.ok(result.y == 0, `y should be 0 (or -0), got ${result.y}`);
        assert.ok(result.z == 0, `z should be 0, got ${result.z}`);
    });

    it('scales x by STUD_TO_LDRAW (positive)', () => {
        const result = CoordinateConverter.positionToLDraw({ x: 5, y: 0, z: 0 });
        assert.equal(result.x, 5 * 20);
    });

    it('inverts and scales y', () => {
        const result = CoordinateConverter.positionToLDraw({ x: 0, y: 3, z: 0 });
        assert.equal(result.y, -3 * 20);
    });

    it('scales z by STUD_TO_LDRAW (positive)', () => {
        const result = CoordinateConverter.positionToLDraw({ x: 0, y: 0, z: -2 });
        assert.equal(result.z, -2 * 20);
    });

    it('handles negative coordinates', () => {
        const result = CoordinateConverter.positionToLDraw({ x: -1, y: -2, z: -3 });
        assert.deepEqual(result, { x: -20, y: 40, z: -60 });
    });
});

// ─── positionFromLDraw ────────────────────────────────────────────────────────

describe('CoordinateConverter.positionFromLDraw', () => {
    it('round-trips positionToLDraw correctly for integer coords', () => {
        const original = { x: 3, y: 7, z: -2 };
        const ldraw    = CoordinateConverter.positionToLDraw(original);
        const back     = CoordinateConverter.positionFromLDraw(ldraw);
        approxEqual(back.x, original.x);
        approxEqual(back.y, original.y);
        approxEqual(back.z, original.z);
    });

    it('round-trips positionToLDraw for fractional coords', () => {
        const original = { x: 0.5, y: 1.25, z: -0.75 };
        const ldraw    = CoordinateConverter.positionToLDraw(original);
        const back     = CoordinateConverter.positionFromLDraw(ldraw);
        approxEqual(back.x, original.x);
        approxEqual(back.y, original.y);
        approxEqual(back.z, original.z);
    });

    it('round-trips origin', () => {
        const ldraw = CoordinateConverter.positionToLDraw({ x: 0, y: 0, z: 0 });
        const back  = CoordinateConverter.positionFromLDraw(ldraw);
        assert.deepEqual(back, { x: 0, y: 0, z: 0 });
    });
});

// ─── eulerToRotationMatrix ────────────────────────────────────────────────────

describe('CoordinateConverter.eulerToRotationMatrix', () => {
    it('zero Euler angles → 3×3 identity matrix (9 elements)', () => {
        const mat = CoordinateConverter.eulerToRotationMatrix({ x: 0, y: 0, z: 0 });
        assert.equal(mat.length, 9);
        // Column-major identity: [1,0,0, 0,1,0, 0,0,1]
        matApproxEqual(mat, [1, 0, 0,  0, 1, 0,  0, 0, 1]);
    });

    it('produces orthogonal matrix for arbitrary rotation', () => {
        const mat = CoordinateConverter.eulerToRotationMatrix({ x: 0.3, y: 0.7, z: 1.1 });
        // det(R) ≈ 1 for a proper rotation matrix; verify via one dot product
        // Column 0 · Column 1 ≈ 0 (orthogonality)
        const dot01 = mat[0] * mat[3] + mat[1] * mat[4] + mat[2] * mat[5];
        approxEqual(dot01, 0, 1e-10);
    });

    it('produces normalised columns (length ≈ 1)', () => {
        const mat = CoordinateConverter.eulerToRotationMatrix({ x: 0.5, y: -0.3, z: 0.2 });
        const len0 = Math.sqrt(mat[0] ** 2 + mat[1] ** 2 + mat[2] ** 2);
        approxEqual(len0, 1, 1e-10);
    });
});

// ─── eulerToLDrawMatrix ───────────────────────────────────────────────────────

describe('CoordinateConverter.eulerToLDrawMatrix', () => {
    it('zero Euler angles → identity (mirror_Y² = I)', () => {
        // mirror_Y * I * mirror_Y = mirror_Y² = I
        const mat = CoordinateConverter.eulerToLDrawMatrix({ x: 0, y: 0, z: 0 });
        matApproxEqual(mat, [1, 0, 0,  0, 1, 0,  0, 0, 1]);
    });

    it('returns a 9-element array', () => {
        const mat = CoordinateConverter.eulerToLDrawMatrix({ x: 0.1, y: 0.2, z: 0.3 });
        assert.equal(mat.length, 9);
    });

    it('is equivalent to rotationMatrixToLDraw(eulerToRotationMatrix(euler))', () => {
        const euler = { x: 0.4, y: -0.6, z: 0.8 };
        const direct = CoordinateConverter.eulerToLDrawMatrix(euler);
        const manual = CoordinateConverter.rotationMatrixToLDraw(
            CoordinateConverter.eulerToRotationMatrix(euler)
        );
        matApproxEqual(direct, manual, 1e-12);
    });
});

// ─── formatLDrawLine ──────────────────────────────────────────────────────────

describe('CoordinateConverter.formatLDrawLine', () => {
    const identityMat = [1, 0, 0,  0, 1, 0,  0, 0, 1];

    it('starts with "1" (type-1 line)', () => {
        const line = CoordinateConverter.formatLDrawLine(4, { x: 0, y: 0, z: 0 }, identityMat, '3001.dat');
        assert.ok(line.startsWith('1 '), `Expected line to start with "1 ", got: "${line}"`);
    });

    it('contains colorId as second token', () => {
        const line = CoordinateConverter.formatLDrawLine(4, { x: 20, y: -40, z: 60 }, identityMat, '3001.dat');
        const tokens = line.split(' ');
        assert.equal(tokens[0], '1');
        assert.equal(tokens[1], '4');
    });

    it('contains position as tokens 3-5', () => {
        const line = CoordinateConverter.formatLDrawLine(4, { x: 20, y: -40, z: 60 }, identityMat, '3001.dat');
        const tokens = line.split(' ');
        assert.equal(tokens[2], '20');
        assert.equal(tokens[3], '-40');
        assert.equal(tokens[4], '60');
    });

    it('ends with the part filename', () => {
        const line = CoordinateConverter.formatLDrawLine(4, { x: 20, y: -40, z: 60 }, identityMat, '3001.dat');
        assert.ok(line.endsWith('3001.dat'), `Line should end with "3001.dat", got: "${line}"`);
    });

    it('has 15 tokens total (1 type + 1 color + 3 pos + 9 matrix + 1 file)', () => {
        const line = CoordinateConverter.formatLDrawLine(4, { x: 20, y: -40, z: 60 }, identityMat, '3001.dat');
        assert.equal(line.split(' ').length, 15);
    });

    it('identity matrix entries are formatted as integers (no decimal point)', () => {
        const line = CoordinateConverter.formatLDrawLine(16, { x: 0, y: 0, z: 0 }, identityMat, 'test.dat');
        // All matrix tokens (positions 6–14, 0-indexed) should be "0" or "1" — no "1.0" or "0.0"
        const tokens = line.split(' ');
        for (let i = 5; i <= 13; i++) {
            assert.ok(
                !tokens[i].includes('.'),
                `Token ${i} "${tokens[i]}" should be an integer with no decimal point`
            );
        }
    });

    it('formats fractional numbers sensibly (no excessive trailing zeros)', () => {
        const mat = CoordinateConverter.eulerToLDrawMatrix({ x: 0.5, y: 0, z: 0 });
        const line = CoordinateConverter.formatLDrawLine(1, { x: 0, y: 0, z: 0 }, mat, 'part.dat');
        // Should not contain patterns like "0.50000" — at most 4 decimal places
        const tokens = line.split(' ');
        for (const tok of tokens) {
            if (tok.includes('.')) {
                const decimals = tok.split('.')[1].replace('-', '').length;
                assert.ok(
                    decimals <= 4,
                    `Token "${tok}" has more than 4 decimal places`
                );
            }
        }
    });

    it('handles colorId=16 (main color)', () => {
        const line = CoordinateConverter.formatLDrawLine(16, { x: 0, y: 0, z: 0 }, identityMat, 'part.dat');
        assert.ok(line.startsWith('1 16 '));
    });
});
