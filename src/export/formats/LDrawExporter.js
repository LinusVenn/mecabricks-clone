/**
 * LDrawExporter – Exportiert das Modell im LDraw-Format (.ldr / .mpd) (Phase H.2)
 *
 * LDraw-Format-Grundlagen:
 *   - Kommentarzeilen beginnen mit '0'
 *   - Teilreferenzen beginnen mit '1'
 *   - Format: 1 <Farbe> <x> <y> <z> <a> <b> <c> <d> <e> <f> <g> <h> <i> <Dateiname>
 *   - Koordinaten: Y zeigt nach UNTEN (invertiert zu Three.js)
 *   - Maßeinheit: 1 LDraw-Einheit ≈ 0,4 mm → 1 Stud = 20 LDraw-Einheiten
 *   - LDR: Einteilige Datei
 *   - MPD: Mehrteilige Datei mit Untermodellen für Baugruppen
 *
 * Umgang mit lokalen Bauteilen ohne LDraw-Zuordnung:
 *   → Teil wird NICHT exportiert
 *   → Wird im ValidationResult als Warnung aufgelistet
 *   → Kein falscher LDraw-Eintrag wird erzeugt
 */

import { CoordinateConverter } from '../CoordinateConverter.js';
import { ExportLogger } from '../utils/ExportLogger.js';

// ─── Constants ────────────────────────────────────────────────────────────────

/** LDraw "main color" — colour resolved from the part itself at render time. */
const LDRAW_MAIN_COLOR = 16;

/** One LDraw unit equals ~0.4 mm; one LEGO stud pitch = 20 LDU. */
const LDU_PER_UNIT = 20;

// ─── Result typedef (JSDoc only) ──────────────────────────────────────────────

/**
 * @typedef {object} LDrawExportResult
 * @property {string}         content      – Full .ldr / .mpd text
 * @property {string}         filename     – Suggested download filename
 * @property {'ldr'|'mpd'}   format       – Chosen format
 * @property {{ exported: number, skipped: number, total: number }} stats
 * @property {Array<{id: string, partId: string, reason: string}>} skippedParts
 */

// ─────────────────────────────────────────────────────────────────────────────
// LDrawExporter
// ─────────────────────────────────────────────────────────────────────────────

export class LDrawExporter {

    /**
     * @param {object}         [options]
     * @param {ExportLogger|null} [options.logger=null]  – Optional logger; a
     *   no-op stub is created when omitted so callers never need null-checks.
     */
    constructor({ logger = null } = {}) {
        this._logger = logger ?? _makeNullLogger();
    }

    // =========================================================================
    // Public API
    // =========================================================================

    /**
     * Exports a snapshot as an LDraw file (.ldr or .mpd).
     *
     * @param {object} snapshot                    – ExportSnapshot produced by ExportSnapshotBuilder
     * @param {Array<object>}  snapshot.parts      – Flat list of part descriptors
     * @param {Array<object>}  [snapshot.assemblies] – Optional assembly descriptors
     * @param {object}         [snapshot.metadata]  – Optional metadata (projectName, …)
     *
     * @param {object}  [options]
     * @param {'ldr'|'mpd'} [options.format='ldr']          – Output format
     * @param {string}  [options.projectName]                – Overrides snapshot.metadata.projectName
     * @param {boolean} [options.includeMetaHeader=true]     – Prepend 0-comment header
     * @param {number}  [options.fallbackColorId=16]         – Color when part has no colorId
     *
     * @returns {LDrawExportResult}
     */
    export(snapshot, options = {}) {
        if (!snapshot || !Array.isArray(snapshot.parts)) {
            throw new TypeError('LDrawExporter.export: snapshot.parts must be an array');
        }

        const format          = options.format          ?? 'ldr';
        const projectName     = options.projectName
            ?? snapshot.metadata?.projectName
            ?? 'Model';
        const includeMetaHeader = options.includeMetaHeader !== false;
        const fallbackColorId   = typeof options.fallbackColorId === 'number'
            ? options.fallbackColorId
            : LDRAW_MAIN_COLOR;

        /** @type {Array<{id: string, partId: string, reason: string}>} */
        const skippedParts = [];
        let exported = 0;

        let content;

        if (format === 'mpd') {
            content = this._generateMPD(snapshot, {
                projectName,
                includeMetaHeader,
                fallbackColorId,
                skippedParts,
                exportedRef: { value: 0 },
            });
            exported = snapshot.parts.length - skippedParts.length;
        } else {
            // ── LDR: single flat file ──────────────────────────────────────
            const lines = [];

            if (includeMetaHeader) {
                lines.push(this._generateHeader(projectName, `${_safeName(projectName)}.ldr`));
            }

            for (const part of snapshot.parts) {
                const line = this._generatePartLine(part, fallbackColorId);
                if (line === null) {
                    skippedParts.push({
                        id:     part.id     ?? part.instanceId ?? '?',
                        partId: part.partId ?? part.type       ?? '?',
                        reason: 'No LDraw part number',
                    });
                    this._logger.warn(
                        `LDrawExporter: Skipping part "${part.partId ?? part.type}" ` +
                        `(id=${part.id ?? part.instanceId}) — no ldrawPartNumber`
                    );
                } else {
                    lines.push(line);
                    exported++;
                }
            }

            content = lines.join('\r\n') + '\r\n';
        }

        const filename = `${_safeName(projectName)}.${format}`;
        const total    = snapshot.parts.length;

        this._logger.info(
            `LDrawExporter: ${exported}/${total} parts exported` +
            (skippedParts.length ? `, ${skippedParts.length} skipped` : '')
        );

        return {
            content,
            filename,
            format,
            stats: { exported, skipped: skippedParts.length, total },
            skippedParts,
        };
    }

    // =========================================================================
    // Private helpers
    // =========================================================================

    /**
     * Generates the LDraw meta-header block (0-comment lines).
     *
     * @param {string} projectName  – Human-readable model name
     * @param {string} filename     – The FILE name referenced in the header
     * @returns {string}  Multi-line string (lines joined with \r\n)
     */
    _generateHeader(projectName, filename) {
        return [
            '0 // Mecabricks Clone - LDraw Export',
            `0 FILE ${filename}`,
            `0 Name: ${projectName}`,
            '0 Author: Mecabricks Clone Editor',
            '0',
        ].join('\r\n');
    }

    /**
     * Generates a single LDraw type-1 line for one part, or null when the
     * part cannot be exported (missing ldrawPartNumber).
     *
     * LDraw line format:
     *   1 <colorId> <x> <y> <z>  <a> <b> <c>  <d> <e> <f>  <g> <h> <i>  <file>
     *
     * @param {object} part              – Part descriptor from snapshot
     * @param {number} fallbackColorId   – Used when part.colorId is absent
     * @returns {string|null}
     */
    _generatePartLine(part, fallbackColorId) {
        // ── Validate ldrawPartNumber ───────────────────────────────────────
        const partNumber = part.ldrawPartNumber ?? null;
        if (!partNumber) return null;

        const partFile = this._ldrawFilename(partNumber);

        // ── Color ──────────────────────────────────────────────────────────
        const colorId = typeof part.colorId === 'number'
            ? part.colorId
            : fallbackColorId;

        // ── Position ──────────────────────────────────────────────────────
        // snapshot.parts carry {position: {x,y,z}} in Three.js world units.
        const pos = CoordinateConverter.positionToLDraw(part.position);

        // ── Rotation matrix ────────────────────────────────────────────────
        // snapshot.parts carry {rotation: {x,y,z}} as Euler angles (XYZ, rad).
        const mat = CoordinateConverter.eulerToLDrawMatrix(part.rotation);

        // ── Assemble the line ─────────────────────────────────────────────
        return CoordinateConverter.formatLDrawLine(colorId, pos, mat, partFile);
    }

    /**
     * Generates a multi-part document (.mpd).
     *
     * Parts that belong to an assembly are grouped under a sub-file named after
     * the assembly.  Parts with no assemblyId go into the main file directly.
     *
     * @param {object} snapshot
     * @param {object} ctx                    – Mutable context object
     * @param {string} ctx.projectName
     * @param {boolean} ctx.includeMetaHeader
     * @param {number}  ctx.fallbackColorId
     * @param {Array}   ctx.skippedParts      – Accumulator for skipped parts
     * @param {{value: number}} ctx.exportedRef
     * @returns {string}
     */
    _generateMPD(snapshot, ctx) {
        const {
            projectName,
            includeMetaHeader,
            fallbackColorId,
            skippedParts,
        } = ctx;

        const mainFilename = `${_safeName(projectName)}.ldr`;

        // ── Partition parts by first assembly ID ──────────────────────────
        /** @type {Map<string|null, object[]>} */
        const groups = new Map();
        groups.set(null, []);   // root-level parts

        for (const part of snapshot.parts) {
            const assemblyId = Array.isArray(part.assemblyIds) && part.assemblyIds.length > 0
                ? part.assemblyIds[0]
                : null;

            if (!groups.has(assemblyId)) {
                groups.set(assemblyId, []);
            }
            groups.get(assemblyId).push(part);
        }

        // ── Build a lookup for assembly metadata ──────────────────────────
        const assemblyMeta = new Map();
        if (Array.isArray(snapshot.assemblies)) {
            for (const asm of snapshot.assemblies) {
                assemblyMeta.set(asm.id ?? asm.assemblyId, asm);
            }
        }

        const fileSections = [];

        // ── Main file section ─────────────────────────────────────────────
        {
            const mainLines = [];

            if (includeMetaHeader) {
                mainLines.push(this._generateHeader(projectName, mainFilename));
            }

            // Root-level parts (no assembly)
            for (const part of (groups.get(null) ?? [])) {
                const line = this._generatePartLine(part, fallbackColorId);
                if (line === null) {
                    skippedParts.push({
                        id:     part.id     ?? part.instanceId ?? '?',
                        partId: part.partId ?? part.type       ?? '?',
                        reason: 'No LDraw part number',
                    });
                    this._logger.warn(
                        `LDrawExporter (MPD): Skipping part "${part.partId}" — no ldrawPartNumber`
                    );
                } else {
                    mainLines.push(line);
                }
            }

            // References to assembly sub-files
            for (const [asmId] of groups) {
                if (asmId === null) continue;
                const meta     = assemblyMeta.get(asmId);
                const asmName  = meta?.name ?? asmId ?? 'assembly';
                const asmFile  = `${_safeName(asmName)}.ldr`;
                // Reference the sub-model as a type-1 line with identity matrix
                mainLines.push(
                    `1 16 0 0 0 1 0 0 0 1 0 0 0 1 ${asmFile}`
                );
            }

            fileSections.push(mainLines.join('\r\n'));
        }

        // ── Assembly sub-file sections ────────────────────────────────────
        for (const [asmId, parts] of groups) {
            if (asmId === null) continue;

            const meta    = assemblyMeta.get(asmId);
            const asmName = meta?.name ?? asmId ?? 'assembly';
            const asmFile = `${_safeName(asmName)}.ldr`;

            const asmLines = [
                `0 FILE ${asmFile}`,
                `0 Name: ${asmName}`,
                '0',
            ];

            for (const part of parts) {
                const line = this._generatePartLine(part, fallbackColorId);
                if (line === null) {
                    skippedParts.push({
                        id:     part.id     ?? part.instanceId ?? '?',
                        partId: part.partId ?? part.type       ?? '?',
                        reason: 'No LDraw part number',
                    });
                    this._logger.warn(
                        `LDrawExporter (MPD): Skipping part "${part.partId}" ` +
                        `in assembly "${asmName}" — no ldrawPartNumber`
                    );
                } else {
                    asmLines.push(line);
                }
            }

            fileSections.push(asmLines.join('\r\n'));
        }

        return fileSections.join('\r\n\r\n') + '\r\n';
    }

    /**
     * Normalises a raw LDraw part-number string so it always ends with `.dat`.
     *
     * @param {string} partNumber  – e.g. '3001', '3001.dat', 's/3001s01.dat'
     * @returns {string}           – e.g. '3001.dat'
     */
    _ldrawFilename(partNumber) {
        const trimmed = String(partNumber).trim();
        // If the string already contains a recognised LDraw extension, keep it.
        if (/\.(dat|ldr|mpd)$/i.test(trimmed)) {
            return trimmed;
        }
        return `${trimmed}.dat`;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-private helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a filesystem-safe version of a project name.
 * Replaces spaces and illegal filename characters with underscores.
 *
 * @param {string} name
 * @returns {string}
 */
function _safeName(name) {
    return String(name)
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
        .replace(/\s+/g, '_')
        .substring(0, 64)
        || 'model';
}

/**
 * Creates a lightweight no-op logger so internal code never needs null-checks.
 *
 * @returns {{ info: Function, warn: Function, error: Function }}
 */
function _makeNullLogger() {
    const noop = () => {};
    return { info: noop, warn: noop, error: noop };
}
