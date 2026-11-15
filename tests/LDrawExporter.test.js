/**
 * LDrawExporter.test.js – Phase H
 *
 * Tests for LDrawExporter.export() covering:
 *   - Empty snapshots
 *   - Valid part export (stats, content)
 *   - Skipping parts without ldrawPartNumber
 *   - LDR vs MPD format selection
 *   - Color ID handling (direct + fallback)
 *   - Header presence
 *   - Multiple parts
 *
 * Assertions: ~30
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { LDrawExporter } from '../src/export/formats/LDrawExporter.js';

// ─── Snapshot factory ─────────────────────────────────────────────────────────

function makeSnapshot(parts = []) {
    return {
        metadata:             { projectName: 'TestModel', formatVersion: 1 },
        parts,
        assemblies:           [],
        groups:               [],
        connections:          [],
        mechanicalConnections: [],
    };
}

/** A fully valid LDraw part descriptor. */
const validPart = {
    id:              'p1',
    partId:          '3001',
    ldrawPartNumber: '3001.dat',
    source:          'ldraw',
    color:           0xC91A09,
    colorId:         4,
    position:        { x: 0, y: 0, z: 0 },
    rotation:        { x: 0, y: 0, z: 0 },
    assemblyIds:     [],
};

/** A part that has no ldrawPartNumber → should be skipped. */
const localPart = {
    id:              'b1',
    partId:          'brick_2x4',
    ldrawPartNumber: null,
    source:          'local',
    color:           0xff0000,
    colorId:         null,
    position:        { x: 0, y: 0, z: 0 },
    rotation:        { x: 0, y: 0, z: 0 },
    assemblyIds:     [],
};

/** A second valid LDraw part at a different position. */
const validPart2 = {
    id:              'p2',
    partId:          '3003',
    ldrawPartNumber: '3003.dat',
    source:          'ldraw',
    color:           0x006CB7,
    colorId:         1,
    position:        { x: 4, y: 2, z: -1 },
    rotation:        { x: 0, y: 0, z: 0 },
    assemblyIds:     [],
};

const exporter = new LDrawExporter();

// ─── Empty snapshot ───────────────────────────────────────────────────────────

describe('LDrawExporter – empty snapshot', () => {
    it('empty snapshot → stats.exported === 0', () => {
        const result = exporter.export(makeSnapshot([]));
        assert.equal(result.stats.exported, 0);
    });

    it('empty snapshot → stats.total === 0', () => {
        const result = exporter.export(makeSnapshot([]));
        assert.equal(result.stats.total, 0);
    });

    it('empty snapshot → content is a string', () => {
        const result = exporter.export(makeSnapshot([]));
        assert.equal(typeof result.content, 'string');
    });

    it('empty snapshot → content contains header line starting with "0"', () => {
        const result = exporter.export(makeSnapshot([]));
        const firstLine = result.content.split(/\r?\n/)[0];
        assert.ok(firstLine.startsWith('0'), `First line should start with "0", got: "${firstLine}"`);
    });
});

// ─── Single valid part ─────────────────────────────────────────────────────────

describe('LDrawExporter – single valid part', () => {
    it('one valid part → stats.exported === 1', () => {
        const result = exporter.export(makeSnapshot([validPart]));
        assert.equal(result.stats.exported, 1);
    });

    it('one valid part → stats.skipped === 0', () => {
        const result = exporter.export(makeSnapshot([validPart]));
        assert.equal(result.stats.skipped, 0);
    });

    it('content contains ldrawPartNumber', () => {
        const result = exporter.export(makeSnapshot([validPart]));
        assert.ok(result.content.includes('3001.dat'),
            'Content should include the part filename "3001.dat"');
    });

    it('content includes "1 4" for colorId=4', () => {
        const result = exporter.export(makeSnapshot([validPart]));
        assert.ok(result.content.includes('1 4'),
            'Content should include type-1 line with color 4');
    });

    it('content starts with "0" (header comment)', () => {
        const result = exporter.export(makeSnapshot([validPart]));
        assert.ok(result.content.trimStart().startsWith('0'),
            'LDraw content should start with a comment line (0)');
    });
});

// ─── Skipping parts without ldrawPartNumber ───────────────────────────────────

describe('LDrawExporter – skipping parts without ldrawPartNumber', () => {
    it('local part without ldrawPartNumber → stats.skipped === 1', () => {
        const result = exporter.export(makeSnapshot([localPart]));
        assert.equal(result.stats.skipped, 1);
    });

    it('local part without ldrawPartNumber → stats.exported === 0', () => {
        const result = exporter.export(makeSnapshot([localPart]));
        assert.equal(result.stats.exported, 0);
    });

    it('skipped part appears in result.skippedParts array', () => {
        const result = exporter.export(makeSnapshot([localPart]));
        assert.equal(result.skippedParts.length, 1);
        assert.equal(result.skippedParts[0].id, 'b1');
    });

    it('mixed: one valid + one local → exported=1, skipped=1', () => {
        const result = exporter.export(makeSnapshot([validPart, localPart]));
        assert.equal(result.stats.exported, 1);
        assert.equal(result.stats.skipped, 1);
    });
});

// ─── Format: LDR ──────────────────────────────────────────────────────────────

describe('LDrawExporter – LDR format', () => {
    it('default format is "ldr"', () => {
        const result = exporter.export(makeSnapshot([validPart]));
        assert.equal(result.format, 'ldr');
    });

    it('LDR filename ends with ".ldr"', () => {
        const result = exporter.export(makeSnapshot([validPart]));
        assert.ok(result.filename.endsWith('.ldr'),
            `filename "${result.filename}" should end with ".ldr"`);
    });

    it('explicit format: ldr → result.format === "ldr"', () => {
        const result = exporter.export(makeSnapshot([validPart]), { format: 'ldr' });
        assert.equal(result.format, 'ldr');
    });
});

// ─── Format: MPD ──────────────────────────────────────────────────────────────

describe('LDrawExporter – MPD format', () => {
    it('MPD format → result.format === "mpd"', () => {
        const result = exporter.export(makeSnapshot([validPart]), { format: 'mpd' });
        assert.equal(result.format, 'mpd');
    });

    it('MPD filename ends with ".mpd"', () => {
        const result = exporter.export(makeSnapshot([validPart]), { format: 'mpd' });
        assert.ok(result.filename.endsWith('.mpd'),
            `filename "${result.filename}" should end with ".mpd"`);
    });
});

// ─── Two parts at different positions ─────────────────────────────────────────

describe('LDrawExporter – multiple parts', () => {
    it('two valid parts → both filenames appear in content', () => {
        const result = exporter.export(makeSnapshot([validPart, validPart2]));
        assert.ok(result.content.includes('3001.dat'), 'Should contain 3001.dat');
        assert.ok(result.content.includes('3003.dat'), 'Should contain 3003.dat');
    });

    it('two valid parts → stats.exported === 2', () => {
        const result = exporter.export(makeSnapshot([validPart, validPart2]));
        assert.equal(result.stats.exported, 2);
    });
});

// ─── Color fallback ───────────────────────────────────────────────────────────

describe('LDrawExporter – color fallback', () => {
    it('part with colorId=null → uses fallback colorId (16 by default)', () => {
        const noColorPart = { ...validPart, colorId: null };
        const result = exporter.export(makeSnapshot([noColorPart]));
        // Default fallback is 16 (LDRAW_MAIN_COLOR)
        assert.ok(result.content.includes('1 16'),
            'Content should use fallback colorId 16 when colorId is null');
    });

    it('custom fallbackColorId option is respected', () => {
        const noColorPart = { ...validPart, colorId: null };
        const result = exporter.export(
            makeSnapshot([noColorPart]),
            { fallbackColorId: 7 }
        );
        assert.ok(result.content.includes('1 7'),
            'Content should use custom fallback colorId 7');
    });
});

// ─── Snapshot validation ──────────────────────────────────────────────────────

describe('LDrawExporter – input validation', () => {
    it('throws TypeError when snapshot.parts is not an array', () => {
        assert.throws(
            () => exporter.export({ parts: null }),
            TypeError
        );
    });

    it('stats object has exported, skipped, total keys', () => {
        const result = exporter.export(makeSnapshot([]));
        assert.ok(Object.hasOwn(result.stats, 'exported'));
        assert.ok(Object.hasOwn(result.stats, 'skipped'));
        assert.ok(Object.hasOwn(result.stats, 'total'));
    });
});
