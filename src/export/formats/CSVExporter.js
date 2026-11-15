/**
 * CSVExporter – Exportiert die Stückliste als CSV (Phase H.5)
 *
 * Kompatibel mit Excel und LibreOffice Calc.
 * Unterstützt Semikolon-Trennzeichen für deutsche Tabellenprogramme.
 *
 * Korrekte Maskierung von: Kommas, Anführungszeichen, Zeilenumbrüchen.
 */

import { BOMFormatter } from '../bom/BOMFormatter.js';

/** @typedef {import('../bom/BOMEntry.js').BOMEntry} BOMEntry */

/**
 * @typedef {object} CSVExportResult
 * @property {string} content   – complete CSV text
 * @property {string} filename
 * @property {number} rowCount  – data rows only (header excluded)
 * @property {string} mimeType
 */

// Column definitions ─────────────────────────────────────────────────────────

/** @type {Array<{header: string, value: (entry: BOMEntry) => string|number|null}>} */
const COLUMNS = [
    { header: 'Part ID',       value: e => e.partId },
    { header: 'Name',          value: e => BOMFormatter.formatPartName(e) },
    { header: 'Color',         value: e => BOMFormatter.formatColorDisplay(e) },
    { header: 'Color ID',      value: e => e.colorId },
    { header: 'Color Hex',     value: e => e.colorHex },
    { header: 'Variant',       value: e => e.variantId },
    { header: 'Category',      value: e => e.category },
    { header: 'Quantity',      value: e => e.quantity },
    { header: 'Source',        value: e => e.source },
    { header: 'LDraw Number',  value: e => e.ldrawPartNumber },
];

export class CSVExporter {
    /**
     * @param {object}        [options]
     * @param {','|';'}       [options.delimiter=',']     – field separator
     * @param {boolean}       [options.includeHeader=true]
     * @param {'utf-8'}       [options.encoding='utf-8']
     * @param {boolean}       [options.includeBOM=false]  – prepend UTF-8 BOM for Excel
     */
    constructor(options = {}) {
        const delim = options.delimiter ?? ',';
        if (delim !== ',' && delim !== ';') {
            throw new TypeError(`CSVExporter: delimiter must be ',' or ';', got '${delim}'`);
        }

        this._delimiter     = delim;
        this._includeHeader = options.includeHeader !== false;   // default true
        this._encoding      = options.encoding ?? 'utf-8';
        this._includeBOM    = options.includeBOM === true;       // default false
    }

    // ── Public ──────────────────────────────────────────────────────────────────

    /**
     * Exports the BOM as a CSV string.
     *
     * @param {import('../bom/BillOfMaterialsBuilder.js').BOM} bom
     * @param {object} [options]                  – per-call overrides (currently unused, reserved)
     * @returns {CSVExportResult}
     */
    export(bom, options = {}) {   // eslint-disable-line no-unused-vars
        if (!bom || !Array.isArray(bom.entries)) {
            throw new TypeError('CSVExporter.export: bom.entries must be an array');
        }

        const lines = [];

        // ── Header row ────────────────────────────────────────────────────────
        if (this._includeHeader) {
            const headerCells = COLUMNS.map(col => this._escapeCell(col.header));
            lines.push(headerCells.join(this._delimiter));
        }

        // ── Data rows ─────────────────────────────────────────────────────────
        for (const entry of bom.entries) {
            const cells = COLUMNS.map(col => {
                const raw = col.value(entry);
                return this._escapeCell(raw);
            });
            lines.push(cells.join(this._delimiter));
        }

        const rowCount = bom.entries.length;

        // ── Acceptance criterion ──────────────────────────────────────────────
        // Count data lines (lines array excludes nothing else)
        const dataLineCount = this._includeHeader ? lines.length - 1 : lines.length;
        if (dataLineCount !== rowCount) {
            throw new Error(
                `CSVExporter: row count mismatch — ` +
                `generated ${dataLineCount} data rows but expected ${rowCount}`
            );
        }

        // ── Assemble final string ─────────────────────────────────────────────
        const body   = lines.join('\r\n') + '\r\n';           // RFC 4180 CRLF
        const bom_   = this._includeBOM ? '\uFEFF' : '';     // UTF-8 BOM for Excel
        const content = bom_ + body;

        const filename = this._buildFilename(bom);

        return {
            content,
            filename,
            rowCount,
            mimeType: 'text/csv;charset=utf-8',
        };
    }

    // ── Private ────────────────────────────────────────────────────────────────

    /**
     * Escapes a single cell value per RFC 4180:
     *  - null / undefined → empty string
     *  - numbers / booleans → coerced to string (no quoting needed unless special)
     *  - Wrap in double-quotes if the value contains the delimiter, a double-quote,
     *    a newline (LF or CR), or leading/trailing whitespace.
     *  - Internal double-quotes are doubled ("").
     *
     * @param {string|number|boolean|null|undefined} value
     * @returns {string}
     */
    _escapeCell(value) {
        if (value === null || value === undefined) return '';

        const str = String(value);

        // Determine whether quoting is required.
        const needsQuoting =
            str.includes(this._delimiter) ||
            str.includes('"')             ||
            str.includes('\n')            ||
            str.includes('\r')            ||
            str !== str.trim();           // leading/trailing whitespace

        if (!needsQuoting) return str;

        // Double any internal double-quotes, then wrap in outer quotes.
        return `"${str.replace(/"/g, '""')}"`;
    }

    /**
     * Derives a safe filename from the BOM metadata.
     *
     * @param {import('../bom/BillOfMaterialsBuilder.js').BOM} bom
     * @returns {string}
     */
    _buildFilename(bom) {
        const rawName = bom?.metadata?.projectName ?? 'bom';
        // Strip characters that are unsafe in filenames.
        const safeName = rawName
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
            .replace(/\s+/g, '_')
            .substring(0, 64);
        return `${safeName}_bom.csv`;
    }
}
