/**
 * JSONExporter – Exportiert die Stückliste als JSON (Phase H.5)
 *
 * Maschinenlesbar. Enthält Metadaten, Zusammenfassung und alle Einträge.
 */

/** @typedef {import('../bom/BOMEntry.js').BOMEntry} BOMEntry */

/**
 * @typedef {object} JSONExportResult
 * @property {string} content   – JSON text (stringified)
 * @property {string} filename
 * @property {object} data      – raw object before JSON.stringify
 */

export class JSONExporter {
    /**
     * @param {object} [options]
     * @param {number} [options.indent=2]          – JSON indent spaces (0 = minified)
     * @param {string} [options.projectName]       – default project name fallback
     */
    constructor(options = {}) {
        this._defaultIndent      = options.indent      ?? 2;
        this._defaultProjectName = options.projectName ?? null;
    }

    // ── Public ──────────────────────────────────────────────────────────────────

    /**
     * Exports the BOM as a JSON string.
     *
     * @param {import('../bom/BillOfMaterialsBuilder.js').BOM} bom
     * @param {object} [options]                  – per-call overrides
     * @param {number} [options.indent]            – overrides constructor indent
     * @param {string} [options.projectName]       – overrides metadata project name
     * @returns {JSONExportResult}
     */
    export(bom, options = {}) {
        if (!bom || !Array.isArray(bom.entries)) {
            throw new TypeError('JSONExporter.export: bom.entries must be an array');
        }

        const indent      = options.indent      ?? this._defaultIndent;
        const projectName = options.projectName
            ?? this._defaultProjectName
            ?? bom.metadata?.projectName
            ?? 'Unbenannt';

        // ── Build output object ────────────────────────────────────────────────
        const data = {
            format:      'technical-bom',
            version:     1,
            project: {
                name: projectName,
            },
            exportedAt:  new Date().toISOString(),
            summary: {
                totalParts:     bom.summary.totalParts,
                uniqueTypes:    bom.summary.uniqueTypes,
                uniqueColors:   bom.summary.uniqueColors,
                uniqueVariants: bom.summary.uniqueVariants,
            },
            entries: bom.entries.map(entry => this._serializeEntry(entry)),
        };

        const content  = JSON.stringify(data, null, indent);
        const filename = this._buildFilename(projectName);

        return { content, filename, data };
    }

    // ── Private ────────────────────────────────────────────────────────────────

    /**
     * Serialises a single BOMEntry to a plain object.
     *
     * Instance IDs are intentionally omitted from the JSON output — they are an
     * internal detail and are already captured in `BOMEntry.toData()` if needed.
     * Callers that require instance IDs may call `entry.toData()` directly.
     *
     * @param {BOMEntry} entry
     * @returns {object}
     */
    _serializeEntry(entry) {
        return {
            partId:          entry.partId,
            name:            entry.name,
            colorId:         entry.colorId,
            colorName:       entry.colorName,
            colorHex:        entry.colorHex,
            variantId:       entry.variantId,
            quantity:        entry.quantity,
            source:          entry.source,
            ldrawPartNumber: entry.ldrawPartNumber,
            category:        entry.category,
        };
    }

    /**
     * Derives a safe filename from the project name.
     *
     * @param {string} projectName
     * @returns {string}
     */
    _buildFilename(projectName) {
        const safeName = projectName
            .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
            .replace(/\s+/g, '_')
            .substring(0, 64);
        return `${safeName}_bom.json`;
    }
}
