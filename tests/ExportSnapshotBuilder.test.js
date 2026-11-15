/**
 * ExportSnapshotBuilder.test.js – Phase H
 *
 * Tests for ExportSnapshotBuilder.build() including Brick vs PartInstance type
 * detection, metadata computation, immutability, and graceful degradation with
 * null optional managers.
 *
 * Assertions: ~25
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ExportSnapshotBuilder } from '../src/export/ExportSnapshotBuilder.js';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/**
 * Minimal PartLibrary mock.  Parts are passed as raw data objects
 * (the same shape returned by library.getAllData()).
 *
 * @param {object[]} [parts=[]]
 */
function makeLibrary(parts = []) {
    return {
        getAll()    { return parts; },
        getAllData() { return parts.map(p => (p.toData ? p.toData() : p)); },
        hasId(id)   { return parts.some(p => (p.id ?? p._id) === id); },
    };
}

/**
 * Raw data shape for a locally-authored Brick (no `source` field).
 * @type {object}
 */
const mockBrickData = {
    id:       'b1',
    type:     'brick_2x4',
    color:    0xff0000,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    // source is intentionally absent → detected as Brick
};

/**
 * Raw data shape for a LDraw PartInstance (has `source` field).
 * @type {object}
 */
const mockInstanceData = {
    id:               'i1',
    type:             '3001',
    color:            0xC91A09,
    position:         { x: 1, y: 0, z: 0 },
    rotation:         { x: 0, y: 0, z: 0 },
    source:           'ldraw',
    colorId:          4,
    ldrawPartNumber:  '3001.dat',
};

// ─── Empty library ─────────────────────────────────────────────────────────────

describe('ExportSnapshotBuilder – empty library', () => {
    it('build() with empty library → parts array is empty', () => {
        const builder = new ExportSnapshotBuilder({ library: makeLibrary([]) });
        const snapshot = builder.build();
        assert.equal(snapshot.parts.length, 0);
    });

    it('metadata.partCount === 0 for empty library', () => {
        const builder = new ExportSnapshotBuilder({ library: makeLibrary([]) });
        const snapshot = builder.build();
        assert.equal(snapshot.metadata.partCount, 0);
    });

    it('metadata.hasLDrawParts === false for empty library', () => {
        const builder = new ExportSnapshotBuilder({ library: makeLibrary([]) });
        const snapshot = builder.build();
        assert.equal(snapshot.metadata.hasLDrawParts, false);
    });

    it('metadata.hasLocalParts === false for empty library', () => {
        const builder = new ExportSnapshotBuilder({ library: makeLibrary([]) });
        const snapshot = builder.build();
        assert.equal(snapshot.metadata.hasLocalParts, false);
    });

    it('snapshot has required top-level keys', () => {
        const builder = new ExportSnapshotBuilder({ library: makeLibrary([]) });
        const snapshot = builder.build();
        for (const key of ['metadata', 'parts', 'assemblies', 'groups', 'connections', 'mechanicalConnections']) {
            assert.ok(Object.hasOwn(snapshot, key), `snapshot missing key: ${key}`);
        }
    });
});

// ─── Brick (local) type detection ─────────────────────────────────────────────

describe('ExportSnapshotBuilder – Brick (local) parts', () => {
    it('Brick part gets source === "local"', () => {
        const builder = new ExportSnapshotBuilder({ library: makeLibrary([mockBrickData]) });
        const { parts } = builder.build();
        assert.equal(parts[0].source, 'local');
    });

    it('Brick part gets partId from data.type', () => {
        const builder = new ExportSnapshotBuilder({ library: makeLibrary([mockBrickData]) });
        const { parts } = builder.build();
        assert.equal(parts[0].partId, 'brick_2x4');
    });

    it('Brick part gets ldrawPartNumber === null', () => {
        const builder = new ExportSnapshotBuilder({ library: makeLibrary([mockBrickData]) });
        const { parts } = builder.build();
        assert.equal(parts[0].ldrawPartNumber, null);
    });

    it('metadata.hasLocalParts === true when Brick present', () => {
        const builder = new ExportSnapshotBuilder({ library: makeLibrary([mockBrickData]) });
        const { metadata } = builder.build();
        assert.equal(metadata.hasLocalParts, true);
    });

    it('metadata.hasLDrawParts === false when only Brick present', () => {
        const builder = new ExportSnapshotBuilder({ library: makeLibrary([mockBrickData]) });
        const { metadata } = builder.build();
        assert.equal(metadata.hasLDrawParts, false);
    });
});

// ─── PartInstance (LDraw) type detection ──────────────────────────────────────

describe('ExportSnapshotBuilder – PartInstance (LDraw) parts', () => {
    it('PartInstance gets source === "ldraw"', () => {
        const builder = new ExportSnapshotBuilder({ library: makeLibrary([mockInstanceData]) });
        const { parts } = builder.build();
        assert.equal(parts[0].source, 'ldraw');
    });

    it('PartInstance gets ldrawPartNumber from data', () => {
        const builder = new ExportSnapshotBuilder({ library: makeLibrary([mockInstanceData]) });
        const { parts } = builder.build();
        assert.equal(parts[0].ldrawPartNumber, '3001.dat');
    });

    it('PartInstance gets colorId from data', () => {
        const builder = new ExportSnapshotBuilder({ library: makeLibrary([mockInstanceData]) });
        const { parts } = builder.build();
        assert.equal(parts[0].colorId, 4);
    });

    it('metadata.hasLDrawParts === true when PartInstance present', () => {
        const builder = new ExportSnapshotBuilder({ library: makeLibrary([mockInstanceData]) });
        const { metadata } = builder.build();
        assert.equal(metadata.hasLDrawParts, true);
    });
});

// ─── metadata.partCount ───────────────────────────────────────────────────────

describe('ExportSnapshotBuilder – metadata.partCount', () => {
    it('partCount equals parts.length (single part)', () => {
        const builder = new ExportSnapshotBuilder({ library: makeLibrary([mockInstanceData]) });
        const snapshot = builder.build();
        assert.equal(snapshot.metadata.partCount, snapshot.parts.length);
    });

    it('partCount equals parts.length (multiple parts)', () => {
        const builder = new ExportSnapshotBuilder({
            library: makeLibrary([mockBrickData, mockInstanceData]),
        });
        const snapshot = builder.build();
        assert.equal(snapshot.metadata.partCount, 2);
        assert.equal(snapshot.metadata.partCount, snapshot.parts.length);
    });
});

// ─── Immutability: position should be copied, not referenced ──────────────────

describe('ExportSnapshotBuilder – snapshot immutability', () => {
    it('mutating original position object does not affect snapshot', () => {
        const mutableData = {
            id:       'bm1',
            type:     'test_part',
            position: { x: 1, y: 2, z: 3 },
            rotation: { x: 0, y: 0, z: 0 },
            source:   'ldraw',
            ldrawPartNumber: 'test.dat',
        };
        const builder = new ExportSnapshotBuilder({ library: makeLibrary([mutableData]) });
        const snapshot = builder.build();

        // Capture snapshot value, then mutate the original
        const snapshotX = snapshot.parts[0].position.x;
        mutableData.position.x = 999;

        assert.equal(snapshot.parts[0].position.x, snapshotX,
            'Snapshot position.x should not change after mutating the source object');
    });
});

// ─── Null optional managers ────────────────────────────────────────────────────

describe('ExportSnapshotBuilder – null optional managers', () => {
    it('null partCatalog → parts[0].name === null', () => {
        const builder = new ExportSnapshotBuilder({
            library:     makeLibrary([mockInstanceData]),
            partCatalog: null,
        });
        const { parts } = builder.build();
        assert.equal(parts[0].name, null);
    });

    it('null assemblyManager → parts[0].assemblyIds is an empty array', () => {
        const builder = new ExportSnapshotBuilder({
            library:         makeLibrary([mockInstanceData]),
            assemblyManager: null,
        });
        const { parts } = builder.build();
        assert.deepEqual(parts[0].assemblyIds, []);
    });

    it('null assemblyManager → parts[0].groupIds is an empty array', () => {
        const builder = new ExportSnapshotBuilder({
            library:         makeLibrary([mockInstanceData]),
            assemblyManager: null,
        });
        const { parts } = builder.build();
        assert.deepEqual(parts[0].groupIds, []);
    });

    it('null connectionManager → connections is empty array', () => {
        const builder = new ExportSnapshotBuilder({
            library:           makeLibrary([mockInstanceData]),
            connectionManager: null,
        });
        const snapshot = builder.build();
        assert.deepEqual(snapshot.connections, []);
    });
});

// ─── Constructor validation ────────────────────────────────────────────────────

describe('ExportSnapshotBuilder – constructor validation', () => {
    it('throws if library is missing', () => {
        assert.throws(
            () => new ExportSnapshotBuilder({ library: null }),
            /library/i
        );
    });

    it('uses projectName in metadata', () => {
        const builder = new ExportSnapshotBuilder({
            library:     makeLibrary([]),
            projectName: 'My Great Model',
        });
        const { metadata } = builder.build();
        assert.equal(metadata.projectName, 'My Great Model');
    });

    it('metadata.formatVersion is 1', () => {
        const builder = new ExportSnapshotBuilder({ library: makeLibrary([]) });
        const { metadata } = builder.build();
        assert.equal(metadata.formatVersion, 1);
    });

    it('metadata.exportedAt is a valid ISO string', () => {
        const builder = new ExportSnapshotBuilder({ library: makeLibrary([]) });
        const { metadata } = builder.build();
        const ts = new Date(metadata.exportedAt).getTime();
        assert.ok(!isNaN(ts), 'exportedAt should be a valid ISO date string');
    });
});
