
import mappingData from './data/part-mappings.json' with { type: 'json' };

import { PartMappingValidator } from './PartMappingValidator.js';
import { LDrawPartIndex } from './LDrawPartIndex.js';

export class PartMappingManager {
    constructor(options = {}) {
        this.catalog = options.catalog ?? null;

        this.ldrawIndex = options.ldrawIndex ??
            new LDrawPartIndex({
                baseUrl: options.baseUrl ?? '/ldraw/',
                manifestUrl: options.manifestUrl,
                fetchImpl: options.fetchImpl
            });

        this.mappings = new Map();
        this.listeners = new Set();

        this.initialized = false;
        this.initializationPromise = null;

        this.loadInitialData(
            options.initialData ?? mappingData
        );
    }

    loadInitialData(data) {
        if (!data || !Array.isArray(data.mappings)) {
            throw new Error(
                'Ungültige Mapping-Datei: mappings-Array fehlt.'
            );
        }

        this.mappings.clear();

        for (const mapping of data.mappings) {
            const result = PartMappingValidator.validateStructure(
                mapping
            );

            if (!result.valid) {
                console.warn(
                    'Ungültiger Mapping-Eintrag wurde übersprungen:',
                    result.reason,
                    mapping
                );

                continue;
            }

            this.#insertMapping({
                ...mapping,
                brickLinkId: result.brickLinkId,
                ldrawPartNumber: result.ldrawPartNumber,
                verified: mapping.verified === true,
                source: mapping.source ?? 'unknown'
            });
        }

        this.#notify('initial-data-loaded');

        return this.getAllMappings();
    }

    async initialize() {
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        if (this.initialized) {
            return this;
        }

        this.initializationPromise = this.#initialize();

        try {
            await this.initializationPromise;
            this.initialized = true;

            return this;
        } finally {
            this.initializationPromise = null;
        }
    }

    async #initialize() {
        await this.ldrawIndex.initialize();

        this.#notify('initialized');

        return this;
    }

    #insertMapping(mapping) {
        this.mappings.set(
            mapping.brickLinkId,
            { ...mapping }
        );
    }

    #normalizeBrickLinkId(value) {
        if (value === null || value === undefined) {
            return null;
        }

        const normalized = String(value).trim();

        return normalized || null;
    }

    #normalizeLDrawPartNumber(value) {
        return PartMappingValidator.normalizeLDrawPartNumber(
            value
        );
    }

    addMapping(mapping, options = {}) {
        const structure = PartMappingValidator.validateStructure(
            mapping
        );

        if (!structure.valid) {
            throw new Error(structure.reason);
        }

        const existing = this.mappings.get(
            structure.brickLinkId
        );

        if (existing && options.overwrite !== true) {
            throw new Error(
                `Für BrickLink-ID ${structure.brickLinkId} existiert bereits eine Zuordnung.`
            );
        }

        const normalized = {
            ...mapping,
            brickLinkId: structure.brickLinkId,
            ldrawPartNumber: structure.ldrawPartNumber,
            verified: mapping.verified === true,
            source: mapping.source ?? 'manual',
            updatedAt: new Date().toISOString()
        };

        this.#insertMapping(normalized);

        this.#notify('mapping-added', normalized);

        return { ...normalized };
    }

    updateMapping(brickLinkId, changes) {
        const id = this.#normalizeBrickLinkId(
            brickLinkId
        );

        const existing = this.mappings.get(id);

        if (!existing) {
            throw new Error(
                `Mapping für ${id} wurde nicht gefunden.`
            );
        }

        const updated = {
            ...existing,
            ...changes,
            brickLinkId: id,
            updatedAt: new Date().toISOString()
        };

        const structure = PartMappingValidator.validateStructure(
            updated
        );

        if (!structure.valid) {
            throw new Error(structure.reason);
        }

        updated.ldrawPartNumber = structure.ldrawPartNumber;

        this.#insertMapping(updated);

        this.#notify('mapping-updated', updated);

        return { ...updated };
    }

    removeMapping(brickLinkId) {
        const id = this.#normalizeBrickLinkId(
            brickLinkId
        );

        if (!id) {
            return false;
        }

        const removed = this.mappings.delete(id);

        if (removed) {
            this.#notify('mapping-removed', {
                brickLinkId: id
            });
        }

        return removed;
    }

    getMapping(brickLinkId) {
        const id = this.#normalizeBrickLinkId(
            brickLinkId
        );

        const mapping = this.mappings.get(id);

        return mapping ? { ...mapping } : null;
    }

    getAllMappings() {
        return [...this.mappings.values()].map(
            mapping => ({ ...mapping })
        );
    }

    getMappingForInternalPart(internalPartId) {
        if (
            typeof internalPartId !== 'string' ||
            !internalPartId.trim()
        ) {
            return null;
        }

        const mapping = this.getAllMappings().find(
            item => item.internalPartId === internalPartId
        );

        return mapping ?? null;
    }

    getMappingsForLDrawPart(ldrawPartNumber) {
        const normalized = this.#normalizeLDrawPartNumber(
            ldrawPartNumber
        );

        if (!normalized) {
            return [];
        }

        return this.getAllMappings().filter(
            mapping =>
                mapping.ldrawPartNumber === normalized
        );
    }

    async resolveByBrickLinkId(brickLinkId) {
        const mapping = this.getMapping(brickLinkId);

        if (!mapping) {
            return {
                found: false,
                status: 'missing',
                mapping: null,
                reason: 'Keine Zuordnung für diese BrickLink-ID vorhanden.'
            };
        }

        const validation = await PartMappingValidator.validate(
            mapping,
            this.ldrawIndex
        );

        return {
            found: true,
            status: validation.status,
            mapping,
            reason: validation.reason
        };
    }

    async resolveByInternalPartId(internalPartId) {
        const mapping = this.getMappingForInternalPart(
            internalPartId
        );

        if (!mapping) {
            return {
                found: false,
                status: 'missing',
                mapping: null,
                reason: 'Für dieses interne Bauteil existiert keine Mapping-Zuordnung.'
            };
        }

        const validation = await PartMappingValidator.validate(
            mapping,
            this.ldrawIndex
        );

        return {
            found: true,
            status: validation.status,
            mapping,
            reason: validation.reason
        };
    }

    async validateAll() {
        const results = [];

        for (const mapping of this.mappings.values()) {
            const validation = await PartMappingValidator.validate(
                mapping,
                this.ldrawIndex
            );

            results.push({
                ...mapping,
                status: validation.status,
                validationReason: validation.reason
            });
        }

        return results;
    }

    async getStatistics() {
        const results = await this.validateAll();

        const statistics = {
            total: results.length,
            available: 0,
            missing: 0,
            unverified: 0,
            invalid: 0
        };

        for (const result of results) {
            if (
                Object.prototype.hasOwnProperty.call(
                    statistics,
                    result.status
                )
            ) {
                statistics[result.status]++;
            }
        }

        return statistics;
    }

    // ------------------------------------------------------------------
    // JSON-IMPORT (erweitert)
    // ------------------------------------------------------------------

    /**
     * Importiert Mapping-Daten aus einem JSON-Objekt oder -String.
     *
     * Erkennt:
     *  - Doppelte BrickLink-IDs innerhalb des Imports (→ Warning)
     *  - Widersprüchliche Zuordnungen (gleiche LDraw-Nummer → verschiedene
     *    BrickLink-IDs bereits im Manager; → Warning)
     *  - Allgemeine Validierungsfehler (→ Error)
     *
     * @param {string|object} data
     * @param {{ overwrite?: boolean, source?: string }} [options]
     * @returns {{
     *   imported:      object[],
     *   skipped:       object[],
     *   warnings:      { index: number, mapping: object, message: string }[],
     *   errors:        { index: number, mapping: object, message: string }[],
     *   importedCount: number,
     *   skippedCount:  number,
     *   warningCount:  number,
     *   errorCount:    number
     * }}
     */
    importJSON(data, options = {}) {
        const parsed = typeof data === 'string'
            ? JSON.parse(data)
            : data;

        if (!parsed || !Array.isArray(parsed.mappings)) {
            throw new Error(
                'Ungültige JSON-Mapping-Datei: mappings-Array fehlt.'
            );
        }

        // Spaltenname-Normalisierung: unterstützt gängige Varianten
        const normalized = parsed.mappings.map(
            row => _normalizeImportRow(row)
        );

        return this.#runImport(normalized, options);
    }


    // ------------------------------------------------------------------
    // CSV-IMPORT
    // ------------------------------------------------------------------

    /**
     * Importiert Mapping-Daten aus einem CSV-Text.
     *
     * Unterstützte Spaltennamen (je Kategorie wird die erste vorhandene Spalte
     * verwendet; Groß-/Kleinschreibung spielt keine Rolle):
     *
     *   BrickLink-ID:   brickLinkId  |  bricklink_id  |  bricklink  |  bl_id  |  blid
     *   LDraw-Nummer:   ldrawPartNumber  |  ldraw_part_number  |  ldraw  |  ldraw_number  |  part
     *   Intern-ID:      internalPartId  |  internal_part_id  |  internal_id  |  id
     *   Verifiziert:    verified  |  is_verified
     *   Quelle:         source
     *   Notiz:          note  |  notes  |  comment
     *
     * @param {string} csvText
     * @param {{ overwrite?: boolean, source?: string }} [options]
     * @returns {{
     *   imported:      object[],
     *   skipped:       object[],
     *   warnings:      { row: number, message: string }[],
     *   errors:        { row: number, raw: object, message: string }[],
     *   importedCount: number,
     *   skippedCount:  number,
     *   warningCount:  number,
     *   errorCount:    number
     * }}
     */
    importCSV(csvText, options = {}) {
        if (typeof csvText !== 'string') {
            throw new Error(
                'importCSV erwartet einen String.'
            );
        }

        const rows = _parseCsv(csvText);

        if (rows.length === 0) {
            return {
                imported: [], skipped: [], warnings: [], errors: [],
                importedCount: 0, skippedCount: 0, warningCount: 0, errorCount: 0
            };
        }

        const normalized = rows.map(row => _normalizeImportRow(row));

        return this.#runImport(normalized, options);
    }


    // ------------------------------------------------------------------
    // Gemeinsame Import-Engine
    // ------------------------------------------------------------------

    /**
     * @param {object[]} rows    - Normalisierte Zeilen: { brickLinkId, ldrawPartNumber, ... }
     * @param {object}   options
     * @returns {object} Importprotokoll
     */
    #runImport(rows, options = {}) {
        const imported = [];
        const skipped  = [];
        const warnings = [];
        const errors   = [];

        // Duplikate innerhalb des Imports vorab erkennen
        const seenInBatch = new Map(); // brickLinkId → erster index

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const blId = PartMappingValidator.normalizeBrickLinkId(
                row.brickLinkId
            );

            if (!blId) continue; // Wird später als Fehler gemeldet

            if (seenInBatch.has(blId)) {
                warnings.push({
                    index: i,
                    mapping: row,
                    message: `Doppelte BrickLink-ID "${blId}" in diesem Import (erste Nennung: Zeile ${seenInBatch.get(blId)}).`
                });
            } else {
                seenInBatch.set(blId, i);
            }
        }

        // LDraw-Konflikte vorab erkennen:
        // Gleiche LDraw-Nummer → bereits im Manager unter anderer BrickLink-ID
        for (let i = 0; i < rows.length; i++) {
            const row   = rows[i];
            const ldraw = PartMappingValidator.normalizeLDrawPartNumber(
                row.ldrawPartNumber
            );

            if (!ldraw) continue;

            const existing = this.getMappingsForLDrawPart(ldraw);

            for (const ex of existing) {
                const blId = PartMappingValidator.normalizeBrickLinkId(
                    row.brickLinkId
                );

                if (ex.brickLinkId !== blId) {
                    warnings.push({
                        index: i,
                        mapping: row,
                        message: `Widersprüchliche Zuordnung: LDraw-Nr. "${ldraw}" ist bereits BrickLink-ID "${ex.brickLinkId}" zugewiesen.`
                    });
                }
            }
        }

        // Zeilen einzeln importieren
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];

            // Doppelte innerhalb des Imports überspringen (nur erste behalten)
            const blId = PartMappingValidator.normalizeBrickLinkId(
                row.brickLinkId
            );

            if (blId && seenInBatch.get(blId) !== i) {
                skipped.push({ index: i, mapping: row });
                continue;
            }

            try {
                const result = this.addMapping(
                    { ...row, source: row.source ?? options.source ?? 'import' },
                    { overwrite: options.overwrite === true }
                );

                imported.push(result);

            } catch (error) {
                errors.push({
                    index: i,
                    mapping: row,
                    message: error.message
                });
            }
        }

        this.#notify('mapping-imported', {
            imported: imported.length,
            skipped:  skipped.length,
            warnings: warnings.length,
            errors:   errors.length
        });

        return {
            imported,
            skipped,
            warnings,
            errors,
            importedCount: imported.length,
            skippedCount:  skipped.length,
            warningCount:  warnings.length,
            errorCount:    errors.length
        };
    }


    exportJSON() {
        return {
            schemaVersion: 1,
            description:
                'Zuordnung zwischen BrickLink-Teilenummern und LDraw-Dateien.',
            mappings: this.getAllMappings()
        };
    }

    exportJSONString() {
        return JSON.stringify(
            this.exportJSON(),
            null,
            2
        );
    }

    subscribe(callback) {
        if (typeof callback !== 'function') {
            throw new TypeError(
                'Der Listener muss eine Funktion sein.'
            );
        }

        this.listeners.add(callback);

        return () => {
            this.listeners.delete(callback);
        };
    }

    #notify(type, payload = null) {
        const event = {
            type,
            payload,
            manager: this
        };

        for (const listener of this.listeners) {
            try {
                listener(event);
            } catch (error) {
                console.error(
                    'Fehler in einem PartMappingManager-Listener:',
                    error
                );
            }
        }
    }
}


// ============================================================================
// Modul-Hilfsfunktionen (CSV-Parser + Zeilen-Normalisierung)
// ============================================================================

/**
 * Normalisiert einen CSV-Spaltennamen: Kleinbuchstaben, keine Sonderzeichen.
 * @param {string} header
 * @returns {string}
 */
function _normalizeHeader(header) {
    return String(header)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}


/**
 * Liest den Wert einer Spalte aus einem normalisierten Record, indem mehrere
 * mögliche Spaltennamen probiert werden.
 *
 * @param {object}    record
 * @param {string[]}  keys   - Zu prüfende Spaltennamen (werden normalisiert)
 * @returns {string}
 */
function _getField(record, ...keys) {
    for (const key of keys) {
        const normalized = _normalizeHeader(key);
        if (Object.prototype.hasOwnProperty.call(record, normalized)) {
            return record[normalized] ?? '';
        }
    }
    return '';
}


/**
 * Normalisiert eine Import-Zeile auf das kanonische Mapping-Format,
 * unabhängig davon, ob die Daten aus JSON oder CSV stammen.
 *
 * Unterstützte Spaltennamen:
 *   BrickLink-ID : brickLinkId | bricklink_id | bricklink | bl_id | blid
 *   LDraw-Nummer : ldrawPartNumber | ldraw_part_number | ldraw | ldraw_number | part
 *   Intern-ID    : internalPartId | internal_part_id | internal_id | id
 *   Verifiziert  : verified | is_verified
 *   Quelle       : source
 *   Notiz        : note | notes | comment
 *
 * @param {object} row
 * @returns {object}
 */
function _normalizeImportRow(row) {
    if (!row || typeof row !== 'object') return {};

    // Alle Keys normalisieren für case-insensitive Suche
    const flat = {};
    for (const [k, v] of Object.entries(row)) {
        flat[_normalizeHeader(k)] = v;
    }

    const raw = s => String(s ?? '').trim();

    const brickLinkId =
        raw(_getField(flat, 'brickLinkId', 'bricklink_id', 'bricklink', 'bl_id', 'blid'))
        || null;

    const ldrawPartNumber =
        raw(_getField(flat, 'ldrawPartNumber', 'ldraw_part_number', 'ldraw', 'ldraw_number', 'part'))
        || null;

    const internalPartId =
        raw(_getField(flat, 'internalPartId', 'internal_part_id', 'internal_id', 'id'))
        || null;

    const verifiedRaw =
        raw(_getField(flat, 'verified', 'is_verified'));

    const verified =
        ['true', '1', 'yes', 'ja'].includes(verifiedRaw.toLowerCase())
            ? true
            : verifiedRaw === ''
                ? undefined
                : false;

    const source =
        raw(_getField(flat, 'source')) || undefined;

    const note =
        raw(_getField(flat, 'note', 'notes', 'comment')) || undefined;

    const result = { brickLinkId, ldrawPartNumber };

    if (internalPartId) result.internalPartId = internalPartId;
    if (verified !== undefined) result.verified = verified;
    if (source) result.source = source;
    if (note) result.note = note;

    return result;
}


/**
 * Einfacher, robuster CSV-Parser.
 * Unterstützt: Anführungszeichen, doppelte Anführungszeichen als Escape,
 * BOM-Entfernung, CRLF + LF, automatische Trennzeichen-Erkennung (,  ;  Tab).
 *
 * @param {string} text
 * @returns {object[]} Array von Records (Spaltenname → Wert)
 */
function _parseCsv(text) {
    const content = String(text).replace(/^\uFEFF/, ''); // BOM

    if (!content.trim()) return [];

    const firstLine = content.split(/\r?\n/, 1)[0];

    // Trennzeichen ermitteln: nimmt denjenigen, der die meisten Spalten ergibt
    const candidates = [',', ';', '\t'];
    let delimiter = ',';
    let bestCount = -1;

    for (const d of candidates) {
        const count = _splitCsvLine(firstLine, d).length;
        if (count > bestCount) { bestCount = count; delimiter = d; }
    }

    const rows   = [];
    let   row    = [];
    let   field  = '';
    let   inQ    = false;

    for (let i = 0; i < content.length; i++) {
        const ch   = content[i];
        const next = content[i + 1];

        if (ch === '"') {
            if (inQ && next === '"') { field += '"'; i++; }
            else { inQ = !inQ; }
            continue;
        }

        if (ch === delimiter && !inQ) {
            row.push(field.trim()); field = ''; continue;
        }

        if ((ch === '\n' || ch === '\r') && !inQ) {
            if (ch === '\r' && next === '\n') i++;
            row.push(field.trim());
            if (row.some(v => v !== '')) rows.push(row);
            row = []; field = ''; continue;
        }

        field += ch;
    }

    row.push(field.trim());
    if (row.some(v => v !== '')) rows.push(row);

    if (rows.length < 2) return [];

    const headers = rows[0].map(_normalizeHeader);

    return rows.slice(1).map(values => {
        const record = {};
        headers.forEach((h, idx) => {
            if (h) record[h] = values[idx] ?? '';
        });
        return record;
    });
}


/**
 * Zerlegt eine CSV-Zeile mit dem gegebenen Trennzeichen.
 * Nur für die Trennzeichen-Erkennung (keine Quote-Behandlung).
 *
 * @param {string} line
 * @param {string} delimiter
 * @returns {string[]}
 */
function _splitCsvLine(line, delimiter) {
    return line.split(delimiter);
}
