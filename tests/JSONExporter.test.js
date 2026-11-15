/**
 * JSONExporter.test.js – Phase H
 *
 * Tests for JSONExporter.export() covering:
 *   - Empty BOM → valid JSON with entries: []
 *   - result.data.format === 'technical-bom'
 *   - result.data.version === 1
 *   - summary.totalParts matches BOM summary
 *   - One entry → entries.length === 1
 *   - result.content is valid JSON (JSON.parse succeeds)
 *   - Entries have required fields (partId, colorId, quantity)
 *   - filename ends with '.json'
 *   - Indent option (default pretty / minified)
 *   - Input validation
 *
 * Assertions: ~15
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { JSONExporter } from '../src/export/formats/JSONExporter.js';
import { BOMEntry }     from '../src/export/bom/BOMEntry.js';

// ─── BOM mock ────────────────────────────────────────────────────────────────

function makeBOM(entries = [], summaryOverrides = {}) {
    return {
        entries,
        summary: {
            totalParts:     entries.reduce((s, e) => s + e.quantity, 0),
            uniqueTypes:    0,
            uniqueColors:   0,
            uniqueVariants: 0,
            ...summaryOverrides,
        },
        metadata: {
            projectName: 'TestProject',
            builtAt:     new Date().toISOString(),
        },
    };
}

function makeEntry(overrides = {}) {
    return new BOMEntry({
        partId:          '3001',
        ldrawPartNumber: '3001.dat',
        name:            'Brick 2 x 4',
        colorId:         4,
        colorName:       'Red',
        colorHex:        '#C91A09',
        variantId:       null,
        quantity:        2,
        source:          'ldraw',
        category:        'Brick',
        instanceIds:     ['i1', 'i2'],
        ...overrides,
    });
}

// ─── Empty BOM ────────────────────────────────────────────────────────────────

describe('JSONExporter – empty BOM', () => {
    it('empty BOM → data.entries is an empty array', () => {
        const exporter = new JSONExporter();
        const result   = exporter.export(makeBOM([]));
        assert.equal(result.data.entries.length, 0);
    });

    it('empty BOM → result.content is valid JSON', () => {
        const exporter = new JSONExporter();
        const result   = exporter.export(makeBOM([]));
        let parsed;
        assert.doesNotThrow(() => { parsed = JSON.parse(result.content); });
        assert.ok(Array.isArray(parsed.entries));
    });
});

// ─── Format envelope ─────────────────────────────────────────────────────────

describe('JSONExporter – format envelope', () => {
    it('data.format === "technical-bom"', () => {
        const exporter = new JSONExporter();
        const result   = exporter.export(makeBOM([]));
        assert.equal(result.data.format, 'technical-bom');
    });

    it('data.version === 1', () => {
        const exporter = new JSONExporter();
        const result   = exporter.export(makeBOM([]));
        assert.equal(result.data.version, 1);
    });

    it('data.exportedAt is a valid ISO date string', () => {
        const exporter = new JSONExporter();
        const result   = exporter.export(makeBOM([]));
        const ts = new Date(result.data.exportedAt).getTime();
        assert.ok(!isNaN(ts), 'exportedAt should be a parseable date');
    });
});

// ─── summary ─────────────────────────────────────────────────────────────────

describe('JSONExporter – summary', () => {
    it('data.summary.totalParts matches BOM summary', () => {
        const entry    = makeEntry({ quantity: 3 });
        const bom      = makeBOM([entry], { totalParts: 3 });
        const exporter = new JSONExporter();
        const result   = exporter.export(bom);
        assert.equal(result.data.summary.totalParts, 3);
    });

    it('data.summary has uniqueTypes field', () => {
        const exporter = new JSONExporter();
        const result   = exporter.export(makeBOM([]));
        assert.ok(Object.hasOwn(result.data.summary, 'uniqueTypes'));
    });
});

// ─── Entries ─────────────────────────────────────────────────────────────────

describe('JSONExporter – entries', () => {
    it('one entry → data.entries.length === 1', () => {
        const exporter = new JSONExporter();
        const result   = exporter.export(makeBOM([makeEntry()]));
        assert.equal(result.data.entries.length, 1);
    });

    it('entry has partId field', () => {
        const exporter = new JSONExporter();
        const result   = exporter.export(makeBOM([makeEntry()]));
        assert.ok(Object.hasOwn(result.data.entries[0], 'partId'));
    });

    it('entry has colorId field', () => {
        const exporter = new JSONExporter();
        const result   = exporter.export(makeBOM([makeEntry()]));
        assert.ok(Object.hasOwn(result.data.entries[0], 'colorId'));
    });

    it('entry has quantity field', () => {
        const exporter = new JSONExporter();
        const result   = exporter.export(makeBOM([makeEntry()]));
        assert.ok(Object.hasOwn(result.data.entries[0], 'quantity'));
    });

    it('entry.partId value is correct', () => {
        const exporter = new JSONExporter();
        const result   = exporter.export(makeBOM([makeEntry({ partId: '4070' })]));
        assert.equal(result.data.entries[0].partId, '4070');
    });
});

// ─── filename ─────────────────────────────────────────────────────────────────

describe('JSONExporter – filename', () => {
    it('filename ends with ".json"', () => {
        const exporter = new JSONExporter();
        const result   = exporter.export(makeBOM([]));
        assert.ok(result.filename.endsWith('.json'),
            `filename "${result.filename}" should end with ".json"`);
    });
});

// ─── indent option ────────────────────────────────────────────────────────────

describe('JSONExporter – indent option', () => {
    it('indent: 0 → minified JSON (no newlines)', () => {
        const exporter = new JSONExporter({ indent: 0 });
        const result   = exporter.export(makeBOM([]));
        assert.ok(!result.content.includes('\n'), 'Minified JSON should have no newlines');
    });

    it('indent: 2 (default) → pretty-printed JSON (contains newlines)', () => {
        const exporter = new JSONExporter();
        const result   = exporter.export(makeBOM([makeEntry()]));
        assert.ok(result.content.includes('\n'), 'Pretty-printed JSON should contain newlines');
    });
});

// ─── Input validation ─────────────────────────────────────────────────────────

describe('JSONExporter – input validation', () => {
    it('throws TypeError when bom.entries is not an array', () => {
        const exporter = new JSONExporter();
        assert.throws(
            () => exporter.export({ entries: null }),
            TypeError
        );
    });
});
