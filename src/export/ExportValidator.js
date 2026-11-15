/**
 * ExportValidator – Prüft Exportierbarkeit des Snapshots (Phase H.1)
 *
 * Unterscheidet:
 *  - error:   Export kann nicht durchgeführt werden
 *  - warning: Export möglich, aber Informationen gehen verloren
 *  - info:    Optionale Informationen fehlen
 *
 * NICHT dasselbe wie ModelValidator (der prüft geometrische/logische Korrektheit).
 * Dieser Validator prüft nur Exportierbarkeit für das gewählte Format.
 *
 * Unterstützte Formate: 'ldraw' | 'gltf' | 'csv' | 'json'
 *
 * @module ExportValidator
 */

// ─────────────────────────────────────────────────────────────────────────────
// JSDoc-Typdefinitionen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {'ldraw'|'gltf'|'csv'|'json'} ExportFormat
 */

/**
 * @typedef {Object} ValidationFinding
 * @property {'error'|'warning'|'info'} level  - Schweregrad des Befunds.
 * @property {string}                   code   - Maschinenlesbarer Fehlercode.
 * @property {string}                   message - Menschenlesbare Beschreibung.
 * @property {string[]}                 partIds - IDs der betroffenen Bauteile.
 * @property {number}                   count   - Anzahl der betroffenen Bauteile.
 */

/**
 * @typedef {Object} ValidationSummary
 * @property {number} errors          - Anzahl der Fehler-Befunde.
 * @property {number} warnings        - Anzahl der Warnungs-Befunde.
 * @property {number} infos           - Anzahl der Info-Befunde.
 * @property {number} exportableParts - Bauteile, die exportiert werden können.
 * @property {number} skippedParts    - Bauteile, die übersprungen würden.
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean}             valid      - `false`, wenn Fehler vorhanden sind.
 * @property {boolean}             canExport  - Identisch mit `!hasErrors` — Warnungen erlauben Export.
 * @property {ValidationFinding[]} findings   - Alle Befunde.
 * @property {ValidationSummary}   summary    - Aggregierte Zähler.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Fehlercode-Konstanten
// ─────────────────────────────────────────────────────────────────────────────

/** @enum {string} */
const CODE = Object.freeze({
    // Alle Formate
    MISSING_PART_ID:        'MISSING_PART_ID',
    INVALID_POSITION:       'INVALID_POSITION',
    INVALID_ROTATION:       'INVALID_ROTATION',

    // LDraw
    MISSING_LDRAW_NUMBER:   'MISSING_LDRAW_NUMBER',
    UNKNOWN_LDRAW_COLOR:    'UNKNOWN_LDRAW_COLOR',
    LOCAL_PART_NO_LDRAW:    'LOCAL_PART_NO_LDRAW',

    // CSV / JSON
    MISSING_NAME:           'MISSING_NAME',
    MISSING_COLOR_ID:       'MISSING_COLOR_ID',
});

// ─────────────────────────────────────────────────────────────────────────────
// Hauptklasse
// ─────────────────────────────────────────────────────────────────────────────

export class ExportValidator {

    /**
     * Erstellt einen neuen ExportValidator.
     *
     * Die Klasse ist zustandslos; jeder Aufruf von {@link validate} ist unabhängig.
     */
    constructor() {
        // Keine Instanz-Konfiguration erforderlich
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Öffentliche API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Prüft den Snapshot auf Exportierbarkeit für das angegebene Format.
     *
     * @param {import('./ExportSnapshotBuilder.js').ExportSnapshot} snapshot
     *   Der zu prüfende Schnappschuss.
     * @param {ExportFormat} format
     *   Das Zielformat des Exports.
     * @returns {ValidationResult}
     */
    validate(snapshot, format) {
        if (!snapshot || !snapshot.parts) {
            return this._emptyResult(true);
        }

        /** @type {Map<string, ValidationFinding>} */
        const findingMap = new Map();

        const parts = snapshot.parts;

        // ── Gemeinsame Prüfungen (alle Formate) ───────────────────────────────
        this._checkMissingPartIds(parts, findingMap);
        this._checkInvalidPositions(parts, findingMap);
        this._checkInvalidRotations(parts, findingMap);

        // ── Format-spezifische Prüfungen ─────────────────────────────────────
        switch (format) {
            case 'ldraw':
                this._checkLDraw(parts, findingMap);
                break;
            case 'gltf':
                // Keine zusätzlichen Prüfungen — Geometrie kommt direkt aus Three.js
                break;
            case 'csv':
            case 'json':
                this._checkBomFormat(parts, findingMap);
                break;
            default:
                // Unbekanntes Format — nur allgemeine Prüfungen
                break;
        }

        // ── Ergebnis zusammenstellen ──────────────────────────────────────────
        return this._buildResult(parts, findingMap);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Gemeinsame Prüfungen
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Fehler: Fehlende Bauteil-ID.
     *
     * Ein Bauteil ohne ID kann in keinem Format korrekt exportiert werden.
     *
     * @param {import('./ExportSnapshotBuilder.js').ExportPart[]} parts
     * @param {Map<string, ValidationFinding>} findings
     * @private
     */
    _checkMissingPartIds(parts, findings) {
        const affected = parts.filter(p => !p.id || !p.partId);
        if (affected.length === 0) return;

        this._addFinding(findings, {
            level:   'error',
            code:    CODE.MISSING_PART_ID,
            message: `${affected.length} Bauteil(e) haben keine gültige ID oder keinen Teiletyp und können nicht exportiert werden.`,
            partIds: affected.map(p => p.id || '(unbekannt)'),
        });
    }

    /**
     * Fehler: Ungültige Position (NaN oder Infinity).
     *
     * Bauteile mit ungültiger Position können in keinem Format korrekt exportiert werden.
     *
     * @param {import('./ExportSnapshotBuilder.js').ExportPart[]} parts
     * @param {Map<string, ValidationFinding>} findings
     * @private
     */
    _checkInvalidPositions(parts, findings) {
        const affected = parts.filter(p => !ExportValidator._isValidVec3(p.position));
        if (affected.length === 0) return;

        this._addFinding(findings, {
            level:   'error',
            code:    CODE.INVALID_POSITION,
            message: `${affected.length} Bauteil(e) haben eine ungültige Position (NaN oder Infinity) und können nicht exportiert werden.`,
            partIds: affected.map(p => p.id),
        });
    }

    /**
     * Warnung: Ungültige Rotation (NaN oder Infinity).
     *
     * Bauteile mit ungültiger Rotation werden mit Nullrotation exportiert (Datenverlust).
     *
     * @param {import('./ExportSnapshotBuilder.js').ExportPart[]} parts
     * @param {Map<string, ValidationFinding>} findings
     * @private
     */
    _checkInvalidRotations(parts, findings) {
        const affected = parts.filter(p => !ExportValidator._isValidVec3(p.rotation));
        if (affected.length === 0) return;

        this._addFinding(findings, {
            level:   'warning',
            code:    CODE.INVALID_ROTATION,
            message: `${affected.length} Bauteil(e) haben eine ungültige Rotation (NaN oder Infinity). Die Rotation wird beim Export auf 0 gesetzt.`,
            partIds: affected.map(p => p.id),
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // LDraw-spezifische Prüfungen
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Führt alle LDraw-spezifischen Prüfungen durch.
     *
     * @param {import('./ExportSnapshotBuilder.js').ExportPart[]} parts
     * @param {Map<string, ValidationFinding>} findings
     * @private
     */
    _checkLDraw(parts, findings) {
        this._checkMissingLDrawNumber(parts, findings);
        this._checkUnknownLDrawColor(parts, findings);
        this._checkLocalPartsWithoutLDraw(parts, findings);
    }

    /**
     * Warnung: Fehlende LDraw-Teilenummer.
     *
     * Bauteile ohne LDraw-Nummer werden beim Export übersprungen, was zu
     * einem unvollständigen Modell führt.
     *
     * @param {import('./ExportSnapshotBuilder.js').ExportPart[]} parts
     * @param {Map<string, ValidationFinding>} findings
     * @private
     */
    _checkMissingLDrawNumber(parts, findings) {
        // Nur LDraw-Teile prüfen — lokale Bricks sind in _checkLocalPartsWithoutLDraw
        const affected = parts.filter(
            p => p.source === 'ldraw' && !p.ldrawPartNumber
        );
        if (affected.length === 0) return;

        this._addFinding(findings, {
            level:   'warning',
            code:    CODE.MISSING_LDRAW_NUMBER,
            message: `${affected.length} LDraw-Bauteil(e) haben keine LDraw-Teilenummer und werden beim Export übersprungen.`,
            partIds: affected.map(p => p.id),
        });
    }

    /**
     * Warnung: Unbekannte LDraw-Farb-ID.
     *
     * Bauteile ohne bekannte LDraw-Farb-ID werden mit Farbe 16 ("Main Colour") exportiert.
     *
     * @param {import('./ExportSnapshotBuilder.js').ExportPart[]} parts
     * @param {Map<string, ValidationFinding>} findings
     * @private
     */
    _checkUnknownLDrawColor(parts, findings) {
        const affected = parts.filter(
            p => p.ldrawPartNumber && (p.colorId === null || p.colorId === undefined)
        );
        if (affected.length === 0) return;

        this._addFinding(findings, {
            level:   'warning',
            code:    CODE.UNKNOWN_LDRAW_COLOR,
            message: `${affected.length} Bauteil(e) haben keine bekannte LDraw-Farb-ID. Beim Export wird Farbe 16 (Main Colour) verwendet.`,
            partIds: affected.map(p => p.id),
        });
    }

    /**
     * Info: Lokale Bauteile ohne LDraw-Nummer.
     *
     * Für lokale Bricks (source='local') ist das Fehlen einer LDraw-Nummer
     * erwartet und kein Problem per se — informativer Hinweis für den Benutzer.
     *
     * @param {import('./ExportSnapshotBuilder.js').ExportPart[]} parts
     * @param {Map<string, ValidationFinding>} findings
     * @private
     */
    _checkLocalPartsWithoutLDraw(parts, findings) {
        const affected = parts.filter(
            p => p.source === 'local' && !p.ldrawPartNumber
        );
        if (affected.length === 0) return;

        this._addFinding(findings, {
            level:   'info',
            code:    CODE.LOCAL_PART_NO_LDRAW,
            message: `${affected.length} lokale Bauteile (Bricks) haben keine LDraw-Teilenummer. Diese Bauteile werden beim LDraw-Export übersprungen.`,
            partIds: affected.map(p => p.id),
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // CSV/JSON-spezifische Prüfungen
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Führt alle Stücklisten-spezifischen Prüfungen durch (CSV und JSON).
     *
     * @param {import('./ExportSnapshotBuilder.js').ExportPart[]} parts
     * @param {Map<string, ValidationFinding>} findings
     * @private
     */
    _checkBomFormat(parts, findings) {
        this._checkMissingNames(parts, findings);
        this._checkMissingColorIds(parts, findings);
    }

    /**
     * Info: Fehlende Bauteilbezeichnung.
     *
     * Stücklisten ohne Namen sind weniger aussagekräftig, aber technisch exportierbar.
     *
     * @param {import('./ExportSnapshotBuilder.js').ExportPart[]} parts
     * @param {Map<string, ValidationFinding>} findings
     * @private
     */
    _checkMissingNames(parts, findings) {
        const affected = parts.filter(p => !p.name);
        if (affected.length === 0) return;

        this._addFinding(findings, {
            level:   'info',
            code:    CODE.MISSING_NAME,
            message: `${affected.length} Bauteil(e) haben keinen Katalognamen. In der Stückliste erscheinen stattdessen die Teile-IDs.`,
            partIds: affected.map(p => p.id),
        });
    }

    /**
     * Info: Fehlende Farb-ID.
     *
     * Stücklisten ohne Farb-ID können keine Farbbeschriftung ausgeben.
     *
     * @param {import('./ExportSnapshotBuilder.js').ExportPart[]} parts
     * @param {Map<string, ValidationFinding>} findings
     * @private
     */
    _checkMissingColorIds(parts, findings) {
        const affected = parts.filter(
            p => p.colorId === null || p.colorId === undefined
        );
        if (affected.length === 0) return;

        this._addFinding(findings, {
            level:   'info',
            code:    CODE.MISSING_COLOR_ID,
            message: `${affected.length} Bauteil(e) haben keine LDraw-Farb-ID. Die Farbangabe in der Stückliste ist möglicherweise unvollständig.`,
            partIds: affected.map(p => p.id),
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Ergebnis-Zusammensteller
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Erstellt das finale {@link ValidationResult} aus der Befund-Map.
     *
     * @param {import('./ExportSnapshotBuilder.js').ExportPart[]} parts
     * @param {Map<string, ValidationFinding>} findingMap
     * @returns {ValidationResult}
     * @private
     */
    _buildResult(parts, findingMap) {
        const findings = [...findingMap.values()];

        const errorCount   = findings.filter(f => f.level === 'error')  .length;
        const warningCount = findings.filter(f => f.level === 'warning').length;
        const infoCount    = findings.filter(f => f.level === 'info')   .length;

        // Übersprungene Bauteile = Vereinigung aller von Fehlern betroffenen IDs
        const skippedIds = new Set(
            findings
                .filter(f => f.level === 'error')
                .flatMap(f => f.partIds)
        );
        // Warnungen, die zum Überspringen führen (fehlende LDraw-Nummer)
        const skippedByWarning = new Set(
            findings
                .filter(f => f.code === CODE.MISSING_LDRAW_NUMBER || f.code === CODE.LOCAL_PART_NO_LDRAW)
                .flatMap(f => f.partIds)
        );

        const totalSkipped   = new Set([...skippedIds, ...skippedByWarning]);
        const exportable     = parts.length - totalSkipped.size;
        const hasErrors      = errorCount > 0;

        return {
            valid:     !hasErrors,
            canExport: !hasErrors,
            findings,
            summary: {
                errors:          errorCount,
                warnings:        warningCount,
                infos:           infoCount,
                exportableParts: Math.max(0, exportable),
                skippedParts:    totalSkipped.size,
            },
        };
    }

    /**
     * Erstellt ein leeres (gültiges) Ergebnis ohne Befunde.
     *
     * Wird verwendet, wenn kein Snapshot vorhanden ist oder er leer ist.
     *
     * @param {boolean} [empty=false] - Wenn `true`, werden alle Zähler auf 0 gesetzt.
     * @returns {ValidationResult}
     * @private
     */
    _emptyResult(empty = false) {
        return {
            valid:     true,
            canExport: true,
            findings:  [],
            summary: {
                errors:          0,
                warnings:        0,
                infos:           0,
                exportableParts: 0,
                skippedParts:    0,
            },
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Hilfsmethoden
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Fügt einen neuen Befund zur Befund-Map hinzu oder zusammenführt ihn mit
     * einem bestehenden Befund gleichen Codes.
     *
     * Dadurch werden mehrere Prüfungen, die denselben Code erzeugen könnten,
     * zu einem einzigen Befund zusammengefasst.
     *
     * @param {Map<string, ValidationFinding>} findingMap
     * @param {{ level: string, code: string, message: string, partIds: string[] }} raw
     * @private
     */
    _addFinding(findingMap, raw) {
        if (findingMap.has(raw.code)) {
            // Bestehenden Befund erweitern
            const existing = findingMap.get(raw.code);
            existing.partIds = [...new Set([...existing.partIds, ...raw.partIds])];
            existing.count   = existing.partIds.length;
        } else {
            findingMap.set(raw.code, {
                level:   raw.level,
                code:    raw.code,
                message: raw.message,
                partIds: [...raw.partIds],
                count:   raw.partIds.length,
            });
        }
    }

    /**
     * Prüft, ob ein Vec3-Objekt gültige (endliche, reelle) Zahlen enthält.
     *
     * @param {*} v - Zu prüfendes Objekt.
     * @returns {boolean} `true`, wenn alle drei Komponenten finite Zahlen sind.
     * @private
     */
    static _isValidVec3(v) {
        if (!v || typeof v !== 'object') return false;
        return (
            typeof v.x === 'number' && isFinite(v.x) &&
            typeof v.y === 'number' && isFinite(v.y) &&
            typeof v.z === 'number' && isFinite(v.z)
        );
    }
}
