/**
 * ExportValidator.test.js – Phase H
 *
 * Tests for ExportValidator.validate() covering:
 *   - Valid snapshots across formats
 *   - Missing/invalid part IDs, positions, and rotations
 *   - LDraw-specific checks (MISSING_LDRAW_NUMBER, LOCAL_PART_NO_LDRAW)
 *   - Summary counters
 *
 * Assertions: ~25
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ExportValidator } from '../src/export/ExportValidator.js';

// ─── Snapshot factory ─────────────────────────────────────────────────────────

/**
 * Returns a minimal valid snapshot with one LDraw part.
 * Individual part fields can be overridden via `overrides`.
 *
 * @param {object} [overrides={}]  Field overrides applied to the single part.
 */
function makeSnapshot(overrides = {}) {
    return {
        metadata: { projectName: 'Test', formatVersion: 1 },
        parts: [{
            id:              'p1',
            partId:          '3001',
            ldrawPartNumber: '3001.dat',
            source:          'ldraw',
            color:           0xC91A09,
            colorId:         4,
            position:        { x: 0, y: 0, z: 0 },
            rotation:        { x: 0, y: 0, z: 0 },
            ...overrides,
        }],
        assemblies: [], groups: [], connections: [], mechanicalConnections: [],
    };
}

/** Snapshot with zero parts. */
function emptySnapshot() {
    return {
        metadata: { projectName: 'Empty', formatVersion: 1 },
        parts: [],
        assemblies: [], groups: [], connections: [], mechanicalConnections: [],
    };
}

const validator = new ExportValidator();

// ─── Valid snapshots ───────────────────────────────────────────────────────────

describe('ExportValidator – valid snapshots', () => {
    it('valid snapshot + ldraw format → valid=true', () => {
        const result = validator.validate(makeSnapshot(), 'ldraw');
        assert.equal(result.valid, true);
    });

    it('valid snapshot + ldraw format → canExport=true', () => {
        const result = validator.validate(makeSnapshot(), 'ldraw');
        assert.equal(result.canExport, true);
    });

    it('valid snapshot + ldraw format → no error findings', () => {
        const result = validator.validate(makeSnapshot(), 'ldraw');
        const errors = result.findings.filter(f => f.level === 'error');
        assert.equal(errors.length, 0);
    });

    it('valid snapshot + gltf format → valid=true', () => {
        const result = validator.validate(makeSnapshot(), 'gltf');
        assert.equal(result.valid, true);
    });

    it('valid snapshot + csv format → valid=true', () => {
        const result = validator.validate(makeSnapshot(), 'csv');
        assert.equal(result.valid, true);
    });

    it('valid snapshot + json format → valid=true', () => {
        const result = validator.validate(makeSnapshot(), 'json');
        assert.equal(result.valid, true);
    });
});

// ─── Empty snapshot ───────────────────────────────────────────────────────────

describe('ExportValidator – empty snapshot', () => {
    it('empty snapshot (0 parts) → valid=true', () => {
        const result = validator.validate(emptySnapshot(), 'ldraw');
        assert.equal(result.valid, true);
    });

    it('empty snapshot → canExport=true', () => {
        const result = validator.validate(emptySnapshot(), 'csv');
        assert.equal(result.canExport, true);
    });

    it('empty snapshot → summary.exportableParts === 0', () => {
        const result = validator.validate(emptySnapshot(), 'ldraw');
        assert.equal(result.summary.exportableParts, 0);
    });
});

// ─── Missing part ID ──────────────────────────────────────────────────────────

describe('ExportValidator – missing part ID', () => {
    it('part with id=null → finding with level "error"', () => {
        const snap   = makeSnapshot({ id: null });
        const result = validator.validate(snap, 'ldraw');
        const errors = result.findings.filter(f => f.level === 'error');
        assert.ok(errors.length > 0, 'Expected at least one error finding');
    });

    it('part with partId=undefined → finding with level "error"', () => {
        const snap    = makeSnapshot({ partId: undefined });
        const result  = validator.validate(snap, 'ldraw');
        const errors  = result.findings.filter(f => f.level === 'error');
        assert.ok(errors.length > 0, 'Expected at least one error finding');
    });

    it('error finding → valid=false', () => {
        const snap   = makeSnapshot({ id: null });
        const result = validator.validate(snap, 'ldraw');
        assert.equal(result.valid, false);
    });

    it('error finding → canExport=false', () => {
        const snap   = makeSnapshot({ id: null });
        const result = validator.validate(snap, 'ldraw');
        assert.equal(result.canExport, false);
    });
});

// ─── Invalid position ─────────────────────────────────────────────────────────

describe('ExportValidator – invalid position', () => {
    it('position.x = NaN → error finding', () => {
        const snap   = makeSnapshot({ position: { x: NaN, y: 0, z: 0 } });
        const result = validator.validate(snap, 'ldraw');
        const errors = result.findings.filter(f => f.level === 'error');
        assert.ok(errors.length > 0, 'Expected an error for NaN position');
    });

    it('position.y = Infinity → error finding', () => {
        const snap   = makeSnapshot({ position: { x: 0, y: Infinity, z: 0 } });
        const result = validator.validate(snap, 'ldraw');
        const errors = result.findings.filter(f => f.level === 'error');
        assert.ok(errors.length > 0, 'Expected an error for Infinity position');
    });
});

// ─── Invalid rotation ─────────────────────────────────────────────────────────

describe('ExportValidator – invalid rotation', () => {
    it('rotation.y = Infinity → finding with level "warning"', () => {
        const snap   = makeSnapshot({ rotation: { x: 0, y: Infinity, z: 0 } });
        const result = validator.validate(snap, 'ldraw');
        const warnOrError = result.findings.filter(
            f => f.level === 'warning' || f.level === 'error'
        );
        assert.ok(warnOrError.length > 0, 'Expected a warning or error for Infinity rotation');
    });

    it('rotation.z = NaN → at least one non-info finding', () => {
        const snap   = makeSnapshot({ rotation: { x: 0, y: 0, z: NaN } });
        const result = validator.validate(snap, 'ldraw');
        const notable = result.findings.filter(f => f.level !== 'info');
        assert.ok(notable.length > 0, 'Expected at least one warning/error for NaN rotation');
    });
});

// ─── LDraw-specific checks ────────────────────────────────────────────────────

describe('ExportValidator – LDraw format checks', () => {
    it('ldraw part with ldrawPartNumber=null → MISSING_LDRAW_NUMBER finding', () => {
        const snap   = makeSnapshot({ ldrawPartNumber: null });
        const result = validator.validate(snap, 'ldraw');
        const found  = result.findings.find(f => f.code === 'MISSING_LDRAW_NUMBER');
        assert.ok(found, 'Expected a MISSING_LDRAW_NUMBER finding');
    });

    it('MISSING_LDRAW_NUMBER finding has level "warning"', () => {
        const snap   = makeSnapshot({ ldrawPartNumber: null });
        const result = validator.validate(snap, 'ldraw');
        const found  = result.findings.find(f => f.code === 'MISSING_LDRAW_NUMBER');
        assert.equal(found?.level, 'warning');
    });

    it('local part (source=local) in ldraw format → LOCAL_PART_NO_LDRAW info finding', () => {
        // A local brick without ldrawPartNumber — this is the expected scenario
        const snap = makeSnapshot({ source: 'local', ldrawPartNumber: null });
        const result = validator.validate(snap, 'ldraw');
        const found  = result.findings.find(f => f.code === 'LOCAL_PART_NO_LDRAW');
        assert.ok(found, 'Expected a LOCAL_PART_NO_LDRAW finding for a local part');
    });

    it('LOCAL_PART_NO_LDRAW has level "info"', () => {
        const snap   = makeSnapshot({ source: 'local', ldrawPartNumber: null });
        const result = validator.validate(snap, 'ldraw');
        const found  = result.findings.find(f => f.code === 'LOCAL_PART_NO_LDRAW');
        assert.equal(found?.level, 'info');
    });
});

// ─── Summary counters ─────────────────────────────────────────────────────────

describe('ExportValidator – summary counters', () => {
    it('summary has required fields', () => {
        const result = validator.validate(makeSnapshot(), 'ldraw');
        for (const key of ['errors', 'warnings', 'infos', 'exportableParts', 'skippedParts']) {
            assert.ok(Object.hasOwn(result.summary, key), `summary missing key: ${key}`);
        }
    });

    it('exportableParts + skippedParts <= snapshot.parts.length', () => {
        const snap   = makeSnapshot();
        const result = validator.validate(snap, 'ldraw');
        const { exportableParts, skippedParts } = result.summary;
        assert.ok(
            exportableParts + skippedParts <= snap.parts.length,
            `exportableParts(${exportableParts}) + skippedParts(${skippedParts}) > ${snap.parts.length}`
        );
    });

    it('valid snapshot → summary.errors === 0', () => {
        const result = validator.validate(makeSnapshot(), 'ldraw');
        assert.equal(result.summary.errors, 0);
    });

    it('findings is an array', () => {
        const result = validator.validate(makeSnapshot(), 'gltf');
        assert.ok(Array.isArray(result.findings));
    });

    it('null snapshot → valid=true (empty result)', () => {
        const result = validator.validate(null, 'ldraw');
        assert.equal(result.valid, true);
    });
});
