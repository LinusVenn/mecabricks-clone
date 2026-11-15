/**
 * ExportManager – Zentrale Koordination aller Export-Funktionen (Phase H.8)
 *
 * Koordiniert ExportSnapshotBuilder, alle Exporter und die BOM-Pipeline.
 * Hat keine Kenntnisse über UI-Details; die ExportPanel-Klasse ruft diesen Manager auf.
 *
 * Exportformate:
 *  - 'glb' / 'gltf'  → GLTFExporterAdapter
 *  - 'ldr' / 'mpd'   → LDrawExporter
 *  - 'csv'            → CSVExporter (via BOM)
 *  - 'json'           → JSONExporter (via BOM)
 *  - 'pdf'            → BOMPrintView
 *
 * @module ExportManager
 */

import { ExportSnapshotBuilder } from './ExportSnapshotBuilder.js';
import { ExportValidator }       from './ExportValidator.js';
import { ExportLogger }          from './utils/ExportLogger.js';
import { DownloadHelper }        from './utils/DownloadHelper.js';
import { FileNameHelper }        from './utils/FileNameHelper.js';
import { LDrawExporter }         from './formats/LDrawExporter.js';
import { GLTFExporterAdapter }   from './formats/GLTFExporterAdapter.js';
import { BillOfMaterialsBuilder } from './bom/BillOfMaterialsBuilder.js';
import { CSVExporter }           from './formats/CSVExporter.js';
import { JSONExporter }          from './formats/JSONExporter.js';
import { BOMPrintView }          from './bom/BOMPrintView.js';

// ─── Supported formats ────────────────────────────────────────────────────────

/** @type {string[]} */
const SUPPORTED_FORMATS = Object.freeze([
    'glb', 'gltf', 'ldr', 'mpd', 'csv', 'json', 'pdf',
]);

// ─── JSDoc typedefs ───────────────────────────────────────────────────────────

/**
 * @typedef {Object} ExportResult
 * @property {boolean}       success   – Whether the export completed without errors.
 * @property {string}        format    – The export format that was used.
 * @property {string|null}   filename  – Suggested/used filename, or null when not applicable.
 * @property {object}        stats     – Format-specific export statistics.
 * @property {string[]}      errors    – Human-readable error messages (non-empty → failure).
 * @property {string[]}      warnings  – Human-readable warning messages (export still succeeded).
 */

// ─────────────────────────────────────────────────────────────────────────────
// ExportManager
// ─────────────────────────────────────────────────────────────────────────────

export class ExportManager {

    /**
     * Creates a new ExportManager.
     *
     * Only `library` is mandatory. All other manager references are optional;
     * missing managers produce empty sections in the snapshot but never throw.
     *
     * @param {object}      params
     * @param {object}      params.library                       – PartLibrary (required).
     * @param {object|null} [params.partCatalog=null]            – PartCatalog instance.
     * @param {object|null} [params.assemblyManager=null]        – AssemblyManager instance.
     * @param {object|null} [params.connectionManager=null]      – ConnectionManager instance.
     * @param {object|null} [params.mechanicalManager=null]      – MechanicalManager instance.
     */
    constructor({
        library,
        partCatalog       = null,
        assemblyManager   = null,
        connectionManager = null,
        mechanicalManager = null,
    }) {
        if (!library) {
            throw new TypeError('ExportManager: library ist erforderlich.');
        }

        /** @private */
        this._library           = library;
        /** @private */
        this._partCatalog       = partCatalog;
        /** @private */
        this._assemblyManager   = assemblyManager;
        /** @private */
        this._connectionManager = connectionManager;
        /** @private */
        this._mechanicalManager = mechanicalManager;

        // Reusable stateless helpers
        /** @private */
        this._validator = new ExportValidator();

        // Logger shared across this manager's lifetime (reset per export call)
        /** @private */
        this._logger = new ExportLogger();
    }

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * Returns the list of export formats supported by this manager.
     *
     * @returns {string[]}
     */
    get supportedFormats() {
        return [...SUPPORTED_FORMATS];
    }

    /**
     * Builds a fresh ExportSnapshot from the current editor state.
     *
     * Delegates to ExportSnapshotBuilder using the managers provided at
     * construction time. A new builder is created each call so the snapshot
     * always reflects the current model state.
     *
     * @param {object} [options={}]
     * @param {string} [options.projectName]  – Override the project name embedded in the snapshot.
     * @returns {import('./ExportSnapshotBuilder.js').ExportSnapshot}
     */
    buildSnapshot(options = {}) {
        const builder = new ExportSnapshotBuilder({
            library:           this._library,
            partCatalog:       this._partCatalog,
            assemblyManager:   this._assemblyManager,
            connectionManager: this._connectionManager,
            mechanicalManager: this._mechanicalManager,
            projectName:       options.projectName ?? 'Export',
        });

        return builder.build();
    }

    /**
     * Validates an ExportSnapshot for the given target format.
     *
     * Normalises format aliases before passing to the validator
     * ('glb' → 'gltf', 'mpd' → 'ldraw', 'ldr' → 'ldraw').
     *
     * @param {import('./ExportSnapshotBuilder.js').ExportSnapshot} snapshot
     * @param {string} format
     * @returns {import('./ExportValidator.js').ValidationResult}
     */
    validate(snapshot, format) {
        const normalised = _normaliseFormatForValidator(format);
        return this._validator.validate(snapshot, normalised);
    }

    /**
     * Exports using the given format and options.
     *
     * This is the low-level export call that operates on a caller-supplied
     * snapshot. For the common case prefer {@link exportCurrentModel}.
     *
     * @param {string} format
     * @param {object} [options={}]
     * @returns {Promise<ExportResult>}
     */
    async export(format, options = {}) {
        return this.exportCurrentModel(format, options);
    }

    /**
     * High-level convenience method:
     *  1. Builds a fresh snapshot from the current editor state.
     *  2. Validates the snapshot for the target format.
     *  3. Dispatches to the correct exporter.
     *  4. Triggers a browser download (except for 'pdf', which opens a window).
     *  5. Returns a structured ExportResult — never throws to the caller.
     *
     * @param {string} format   – One of {@link SUPPORTED_FORMATS}.
     * @param {object} [options={}]
     * @param {string} [options.projectName]       – Override snapshot project name.
     * @param {string} [options.delimiter]         – CSV delimiter (',' or ';').
     * @param {boolean} [options.includeBOM]       – Prepend UTF-8 BOM in CSV output.
     * @param {boolean} [options.includeHeader]    – Include header row in CSV.
     * @param {number}  [options.indent]           – JSON indent spaces.
     * @param {boolean} [options.groupByCategory]  – Group BOM by category in PDF.
     * @returns {Promise<ExportResult>}
     */
    async exportCurrentModel(format, options = {}) {
        // Fresh per-export logger
        const logger = new ExportLogger();

        /** @type {ExportResult} */
        const result = {
            success:  false,
            format:   String(format).toLowerCase(),
            filename: null,
            stats:    {},
            errors:   [],
            warnings: [],
        };

        try {
            // ── 1. Guard: unsupported format ──────────────────────────────────
            if (!SUPPORTED_FORMATS.includes(result.format)) {
                result.errors.push(
                    `Nicht unterstütztes Exportformat: "${format}". ` +
                    `Erlaubt sind: ${SUPPORTED_FORMATS.join(', ')}.`
                );
                logger.error(result.errors[0]);
                return result;
            }

            logger.info(`Export gestartet – Format: ${result.format}`);

            // ── 2. Build snapshot ─────────────────────────────────────────────
            const snapshot = this.buildSnapshot({
                projectName: options.projectName,
            });

            logger.info(
                `Snapshot erstellt – ${snapshot.parts.length} Bauteile, ` +
                `${snapshot.assemblies.length} Baugruppen.`
            );

            // ── 3. Validate ───────────────────────────────────────────────────
            const validation = this.validate(snapshot, result.format);

            for (const finding of validation.findings) {
                if (finding.level === 'error') {
                    result.errors.push(finding.message);
                    logger.error(finding.message, { code: finding.code });
                } else if (finding.level === 'warning') {
                    result.warnings.push(finding.message);
                    logger.warn(finding.message, { code: finding.code });
                }
            }

            if (!validation.canExport) {
                logger.error('Export abgebrochen – kritische Validierungsfehler vorhanden.');
                return result;   // errors already populated above
            }

            // ── 4. Dispatch to exporter ───────────────────────────────────────
            switch (result.format) {

                // ── GLB / GLTF ────────────────────────────────────────────────
                case 'glb':
                case 'gltf': {
                    const isBinary = result.format === 'glb';
                    const adapter  = new GLTFExporterAdapter({
                        library: this._library,
                        logger,
                    });

                    const gltfResult = await adapter.export(snapshot, {
                        binary:      isBinary,
                        projectName: options.projectName ?? snapshot.metadata?.projectName,
                    });

                    result.filename = gltfResult.filename
                        ?? FileNameHelper.forGLTF(
                            snapshot.metadata?.projectName ?? 'export',
                            isBinary
                        );
                    result.stats = gltfResult.stats ?? {};

                    // Trigger download
                    if (isBinary) {
                        DownloadHelper.downloadBinary(
                            gltfResult.data,
                            result.filename,
                            'model/gltf-binary'
                        );
                    } else {
                        DownloadHelper.downloadText(
                            JSON.stringify(gltfResult.data, null, 2),
                            result.filename,
                            'model/gltf+json'
                        );
                    }

                    result.success = true;
                    logger.info(`GLTF/GLB-Export abgeschlossen: ${result.filename}`);
                    break;
                }

                // ── LDR / MPD ─────────────────────────────────────────────────
                case 'ldr':
                case 'mpd': {
                    const ldrawExporter = new LDrawExporter({ logger });
                    const ldrResult     = ldrawExporter.export(snapshot, {
                        format:      result.format,
                        projectName: options.projectName ?? snapshot.metadata?.projectName,
                    });

                    result.filename = ldrResult.filename
                        ?? FileNameHelper.forLDraw(
                            snapshot.metadata?.projectName ?? 'export',
                            result.format === 'mpd'
                        );
                    result.stats = ldrResult.stats ?? {};

                    DownloadHelper.downloadText(
                        ldrResult.content,
                        result.filename,
                        'text/plain'
                    );

                    // Propagate per-part skip warnings
                    if (Array.isArray(ldrResult.skippedParts)) {
                        for (const skipped of ldrResult.skippedParts) {
                            const msg = `Bauteil übersprungen (${skipped.partId}): ${skipped.reason}`;
                            result.warnings.push(msg);
                            logger.warn(msg, { id: skipped.id, partId: skipped.partId });
                        }
                    }

                    result.success = true;
                    logger.info(`LDraw-Export abgeschlossen: ${result.filename}`);
                    break;
                }

                // ── CSV ───────────────────────────────────────────────────────
                case 'csv': {
                    const bom = this._buildBOM(snapshot, options);

                    const csvExporter = new CSVExporter({
                        delimiter:     options.delimiter     ?? ',',
                        includeHeader: options.includeHeader !== false,
                        includeBOM:    options.includeBOM    === true,
                    });

                    const csvResult = csvExporter.export(bom);

                    result.filename = csvResult.filename
                        ?? FileNameHelper.forCSV(
                            snapshot.metadata?.projectName ?? 'export'
                        );
                    result.stats = { rowCount: csvResult.rowCount ?? bom.entries.length };

                    DownloadHelper.downloadText(
                        csvResult.content,
                        result.filename,
                        'text/csv'
                    );

                    result.success = true;
                    logger.info(`CSV-Export abgeschlossen: ${result.filename}`);
                    break;
                }

                // ── JSON ──────────────────────────────────────────────────────
                case 'json': {
                    const bom = this._buildBOM(snapshot, options);

                    const jsonExporter = new JSONExporter({
                        indent:      options.indent ?? 2,
                        projectName: options.projectName ?? snapshot.metadata?.projectName,
                    });

                    const jsonResult = jsonExporter.export(bom, {
                        projectName: options.projectName ?? snapshot.metadata?.projectName,
                    });

                    result.filename = jsonResult.filename
                        ?? FileNameHelper.forJSON(
                            snapshot.metadata?.projectName ?? 'export'
                        );
                    result.stats = {
                        entryCount: Array.isArray(bom.entries) ? bom.entries.length : 0,
                    };

                    DownloadHelper.downloadText(
                        jsonResult.content,
                        result.filename,
                        'application/json'
                    );

                    result.success = true;
                    logger.info(`JSON-Export abgeschlossen: ${result.filename}`);
                    break;
                }

                // ── PDF (BOM print view) ───────────────────────────────────────
                case 'pdf': {
                    const bom = this._buildBOM(snapshot, options);

                    const printView = new BOMPrintView({
                        groupByCategory: options.groupByCategory === true,
                    });

                    const opened = printView.openPrintWindow(bom, {
                        projectName: options.projectName ?? snapshot.metadata?.projectName,
                    });

                    // openPrintWindow returns the popup reference or null when
                    // popups are blocked; treat either as success at this level.
                    result.filename = null;   // no file download for PDF/print
                    result.stats    = {
                        entryCount: Array.isArray(bom.entries) ? bom.entries.length : 0,
                        popupOpened: !!opened,
                    };

                    if (!opened) {
                        const msg =
                            'Das Druckfenster wurde vom Browser blockiert. ' +
                            'Bitte erlaube Pop-ups für diese Seite.';
                        result.warnings.push(msg);
                        logger.warn(msg);
                    }

                    result.success = true;
                    logger.info('PDF/Druckansicht geöffnet.');
                    break;
                }

                default:
                    // Should be unreachable due to guard above, but kept for safety.
                    result.errors.push(`Interner Fehler: unbekanntes Format "${result.format}".`);
                    return result;
            }

        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            result.errors.push(msg);
            logger.error(`Unerwarteter Exportfehler: ${msg}`, { stack: err?.stack });
            console.error('[ExportManager]', err);
        }

        // Merge any logger warnings/errors not already in result arrays
        // (e.g. from nested exporters that share the same logger instance)
        for (const entry of logger.getErrors()) {
            if (!result.errors.includes(entry.message)) {
                result.errors.push(entry.message);
            }
        }
        for (const entry of logger.getWarnings()) {
            if (!result.warnings.includes(entry.message)) {
                result.warnings.push(entry.message);
            }
        }

        return result;
    }

    /**
     * Builds a BOM from the current model state.
     *
     * Convenience wrapper: builds a snapshot, then runs BillOfMaterialsBuilder.
     *
     * @param {object} [options={}]
     * @param {boolean} [options.includeLocal=true]
     * @param {boolean} [options.includeLDraw=true]
     * @param {string}  [options.projectName]
     * @returns {import('./bom/BillOfMaterialsBuilder.js').BOM}
     */
    buildBOM(options = {}) {
        const snapshot = this.buildSnapshot({ projectName: options.projectName });
        return this._buildBOM(snapshot, options);
    }

    // =========================================================================
    // Private helpers
    // =========================================================================

    /**
     * Internal helper: builds a BOM from an already-constructed snapshot.
     *
     * @private
     * @param {import('./ExportSnapshotBuilder.js').ExportSnapshot} snapshot
     * @param {object} [options={}]
     * @returns {import('./bom/BillOfMaterialsBuilder.js').BOM}
     */
    _buildBOM(snapshot, options = {}) {
        const bomBuilder = new BillOfMaterialsBuilder({
            includeLocal: options.includeLocal !== false,
            includeLDraw: options.includeLDraw !== false,
        });
        return bomBuilder.build(snapshot);
    }
}

// ─── Module-private helpers ───────────────────────────────────────────────────

/**
 * Maps user-facing format strings to the ExportValidator's internal format keys.
 *
 * ExportValidator knows: 'ldraw' | 'gltf' | 'csv' | 'json'
 * (it has no 'glb', 'mpd', 'ldr', or 'pdf' keys).
 *
 * @param {string} format
 * @returns {string}
 */
function _normaliseFormatForValidator(format) {
    switch (format) {
        case 'glb':  return 'gltf';
        case 'ldr':  return 'ldraw';
        case 'mpd':  return 'ldraw';
        case 'pdf':  return 'csv';   // BOM-based, use CSV rules as proxy
        default:     return format;  // 'gltf', 'csv', 'json' pass through
    }
}
