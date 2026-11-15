/**
 * CSVExporter.test.js – Phase H
 *
 * Tests for CSVExporter.export() covering:
 *   - Empty BOM → header only, rowCount=0
 *   - One entry → rowCount=1
 *   - Header content validation
 *   - CSV cell escaping (comma, double-quote)
 *   - Semicolon delimiter option
 *   - UTF-8 BOM option
 *   - mimeType and filename shape
 *
 * Assertions: ~20
 *
 * Dependencies:
 *   BOMEntry is used directly to create real entry objects compatible with
 *   the COLUMNS definitions inside CSVExporter (which call BOMFormatter helpers).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { CSVExporter } from '../src/export/formats/CSVExporter.js';
import { BOMEntry }    from '../src/export/bom/BOMEntry.js';

// ─── BOM mock ────────────────────────────────────────────────────────────────

/**
 * Creates a minimal BOM-shaped object.
 * Entries should be real BOMEntry instances (CSVExporter calls their getters).
 *
 * @param {BOMEntry[]} [entries=[]]
 * @param {object}     [summaryOverrides={}]
 */
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
            projectName: 'Test',
            builtAt:     new Date().toISOString(),
        },
    };
}

/** Factory for a single BOMEntry. */
function makeEntry(overrides = {}) {
    return new BOMEntry({
        partId:          '3001',
        ldrawPartNumber: '3001.dat',
        name:            'Brick 2 x 4',
        colorId:         4,
        colorName:       'Red',
        colorHex:        '#C91A09',
        variantId:       null,
        quantity:        1,
        source:          'ldraw',
        category:        'Brick',
        instanceIds:     [],
        ...overrides,
    });
}

// ─── Empty BOM ────────────────────────────────────────────────────────────────

describe('CSVExporter – empty BOM', () => {
    it('empty BOM → rowCount === 0', () => {
        const exporter = new CSVExporter();
        const result   = exporter.export(makeBOM([]));
        assert.equal(result.rowCount, 0);
    });

    it('empty BOM → content has exactly one line (the header)', () => {
        const exporter = new CSVExporter();
        const result   = exporter.export(makeBOM([]));
        // Split on CRLF/LF; filter empty trailing line from trailing CRLF
        const lines = result.content.split(/\r\n|\n/).filter(l => l.length > 0);
        assert.equal(lines.length, 1, 'Empty BOM should produce only the header row');
    });
});

// ─── Single entry ─────────────────────────────────────────────────────────────

describe('CSVExporter – single entry', () => {
    it('one entry → rowCount === 1', () => {
        const exporter = new CSVExporter();
        const result   = exporter.export(makeBOM([makeEntry()]));
        assert.equal(result.rowCount, 1);
    });

    it('one entry → content has two non-empty lines (header + data)', () => {
        const exporter = new CSVExporter();
        const result   = exporter.export(makeBOM([makeEntry()]));
        const lines    = result.content.split(/\r\n|\n/).filter(l => l.length > 0);
        assert.equal(lines.length, 2);
    });
});

// ─── Header content ───────────────────────────────────────────────────────────

describe('CSVExporter – header', () => {
    it('header contains "Part ID"', () => {
        const exporter = new CSVExporter();
        const result   = exporter.export(makeBOM([]));
        const header   = result.content.split(/\r\n|\n/)[0];
        assert.ok(header.includes('Part ID'), `Header line: "${header}"`);
    });

    it('header contains "Quantity"', () => {
        const exporter = new CSVExporter();
        const result   = exporter.export(makeBOM([]));
        const header   = result.content.split(/\r\n|\n/)[0];
        assert.ok(header.includes('Quantity'), `Header line: "${header}"`);
    });

    it('header contains "Name"', () => {
        const exporter = new CSVExporter();
        const result   = exporter.export(makeBOM([]));
        const header   = result.content.split(/\r\n|\n/)[0];
        assert.ok(header.includes('Name'), `Header line: "${header}"`);
    });
});

// ─── Cell escaping ────────────────────────────────────────────────────────────

describe('CSVExporter – cell escaping', () => {
    it('part name containing comma is wrapped in double-quotes', () => {
        const entry    = makeEntry({ name: 'Brick, Large' });
        const exporter = new CSVExporter();
        const result   = exporter.export(makeBOM([entry]));
        // The data row (second line) should contain a quoted field
        const dataLine = result.content.split(/\r\n|\n/)[1];
        assert.ok(dataLine.includes('"Brick, Large"'),
            `Data row should contain quoted name; got: "${dataLine}"`);
    });

    it('part name containing double-quote → quotes doubled inside quoted cell', () => {
        // name = 'He said "hello"'  →  CSV: "He said ""hello"""
        const entry    = makeEntry({ name: 'He said "hello"' });
        const exporter = new CSVExporter();
        const result   = exporter.export(makeBOM([entry]));
        const dataLine = result.content.split(/\r\n|\n/)[1];
        assert.ok(dataLine.includes('""hello""'),
            `Double-quotes in name should be doubled; got: "${dataLine}"`);
    });
});

// ─── Delimiter option ─────────────────────────────────────────────────────────

describe('CSVExporter – delimiter option', () => {
    it('delimiter: ";" → header uses semicolons', () => {
        const exporter = new CSVExporter({ delimiter: ';' });
        const result   = exporter.export(makeBOM([]));
        const header   = result.content.split(/\r\n|\n/)[0];
        assert.ok(header.includes(';'), `Header should use semicolons; got: "${header}"`);
    });

    it('delimiter: ";" → header does not use commas', () => {
        const exporter = new CSVExporter({ delimiter: ';' });
        const result   = exporter.export(makeBOM([]));
        const header   = result.content.split(/\r\n|\n/)[0];
        assert.ok(!header.includes(','), `Header should not use commas; got: "${header}"`);
    });
});

// ─── UTF-8 BOM ────────────────────────────────────────────────────────────────

describe('CSVExporter – includeBOM option', () => {
    it('includeBOM: true → content starts with \\uFEFF', () => {
        const exporter = new CSVExporter({ includeBOM: true });
        const result   = exporter.export(makeBOM([]));
        assert.ok(result.content.startsWith('\uFEFF'),
            'Content should start with UTF-8 BOM character');
    });

    it('includeBOM: false (default) → content does NOT start with \\uFEFF', () => {
        const exporter = new CSVExporter({ includeBOM: false });
        const result   = exporter.export(makeBOM([]));
        assert.ok(!result.content.startsWith('\uFEFF'),
            'Content should not start with UTF-8 BOM by default');
    });
});

// ─── mimeType and filename ────────────────────────────────────────────────────

describe('CSVExporter – mimeType and filename', () => {
    it('mimeType === "text/csv;charset=utf-8"', () => {
        const exporter = new CSVExporter();
        const result   = exporter.export(makeBOM([]));
        assert.equal(result.mimeType, 'text/csv;charset=utf-8');
    });

    it('filename ends with ".csv"', () => {
        const exporter = new CSVExporter();
        const result   = exporter.export(makeBOM([]));
        assert.ok(result.filename.endsWith('.csv'),
            `filename "${result.filename}" should end with ".csv"`);
    });
});

// ─── Input validation ─────────────────────────────────────────────────────────

describe('CSVExporter – input validation', () => {
    it('throws TypeError when bom.entries is not an array', () => {
        const exporter = new CSVExporter();
        assert.throws(
            () => exporter.export({ entries: null }),
            TypeError
        );
    });

    it('throws TypeError for unsupported delimiter', () => {
        assert.throws(
            () => new CSVExporter({ delimiter: '|' }),
            TypeError
        );
    });
});
