import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    STUD_PITCH,
    ROTATION_STEP,
    SNAP_DISTANCE,
    BRICK_HEIGHT,
    COLLISION_EPSILON
} from '../src/utils/Constants.js';

describe('Constants', () => {

    it('STUD_PITCH ist 1', () => {
        assert.strictEqual(STUD_PITCH, 1);
    });

    it('ROTATION_STEP ist Math.PI / 2 (90 Grad)', () => {
        assert.ok(Math.abs(ROTATION_STEP - Math.PI / 2) < 1e-10);
    });

    it('SNAP_DISTANCE ist 0.75', () => {
        assert.strictEqual(SNAP_DISTANCE, 0.75);
    });

    it('BRICK_HEIGHT ist 1.2', () => {
        assert.strictEqual(BRICK_HEIGHT, 1.2);
    });

    it('COLLISION_EPSILON ist ein kleiner positiver Wert', () => {
        assert.ok(COLLISION_EPSILON > 0);
        assert.ok(COLLISION_EPSILON < 0.01);
    });

});
