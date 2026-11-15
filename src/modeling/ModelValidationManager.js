// =====================================================================
// ModelValidationManager.js – Phase K.7 (Modellvalidierung)
//
// Erweitert den bestehenden ModelValidator (src/validation/) um
// strukturierte Validierungsläufe mit:
//   • validateModel()          – vollständige Prüfung
//   • validateConnections()    – nur Verbindungsprüfung
//   • validateHierarchy()      – nur Hierarchieprüfung
//   • validateIntersections()  – Bauteilüberschneidungen
//   • validateMissingParts()   – fehlende Bauteil-Referenzen
//   • validateTransforms()     – ungültige Transformationen
//   • getValidationResults()   – gecachtes Ergebnis
//
// Die Validierung verändert das Modell NICHT (read-only).
// Ergebnisse werden nach Schweregraden priorisiert:
//   'error' > 'warning' > 'info'
// =====================================================================


export class ModelValidationManager {

    /**
     * @param {{
     *   modelValidator:    object   – bestehender ModelValidator aus src/validation/
     *   library:           import('../objects/PartLibrary.js').PartLibrary
     *   connectionManager: object
     *   groupManager?:     import('../editor/GroupManager.js').GroupManager
     * }} options
     */
    constructor({ modelValidator, library, connectionManager, groupManager = null }) {
        if (!modelValidator) throw new Error('ModelValidationManager: modelValidator is required.');
        if (!library)        throw new Error('ModelValidationManager: library is required.');

        this._validator   = modelValidator;
        this._lib         = library;
        this._connections = connectionManager;
        this._groups      = groupManager;

        /** @type {ValidationReport|null} */
        this._lastReport = null;
    }


    // ─────────────────────────────────────────────────────────────────
    // Vollständige Validierung
    // ─────────────────────────────────────────────────────────────────

    /**
     * Führt eine vollständige Modellprüfung durch.
     *
     * @returns {ValidationReport}
     */
    validateModel() {
        const base = this._safeValidate();
        const extra = [
            ...this._checkHierarchyCycles(),
            ...this._checkInvalidTransforms(),
            ...this._checkMissingParts(),
        ];

        this._lastReport = this._merge(base, extra);
        return this._lastReport;
    }

    // Kompatibler Alias für Panels und bestehende Aufrufer.
    validate() { return this.validateModel(); }


    // ─────────────────────────────────────────────────────────────────
    // Teilprüfungen
    // ─────────────────────────────────────────────────────────────────

    /**
     * Prüft nur Verbindungen auf Konsistenz.
     * @returns {ValidationReport}
     */
    validateConnections() {
        const base = this._safeValidate();
        const connectionFindings = (base.findings ?? [])
            .filter(f => f.code?.startsWith('CONNECTION') || f.code?.startsWith('CONN'));

        const report = _buildReport(connectionFindings, base.elapsed);
        this._lastReport = report;
        return report;
    }

    /**
     * Prüft die Hierarchie auf zyklische Abhängigkeiten.
     * @returns {ValidationReport}
     */
    validateHierarchy() {
        const findings = this._checkHierarchyCycles();
        const report   = _buildReport(findings);
        this._lastReport = report;
        return report;
    }

    /**
     * Prüft, ob Bauteile sich gegenseitig überschneiden.
     * Delegiert an den ModelValidator (CollisionValidator).
     * @returns {ValidationReport}
     */
    validateIntersections() {
        const base = this._safeValidate();
        const intersectionFindings = (base.findings ?? [])
            .filter(f => f.code?.startsWith('COLLISION') || f.code?.startsWith('INTERSECT'));

        const report = _buildReport(intersectionFindings, base.elapsed);
        this._lastReport = report;
        return report;
    }

    /**
     * Prüft auf fehlende Bauteil-Referenzen.
     * @returns {ValidationReport}
     */
    validateMissingParts() {
        const findings = this._checkMissingParts();
        const report   = _buildReport(findings);
        this._lastReport = report;
        return report;
    }

    /**
     * Prüft auf ungültige Transformationen (NaN, Infinity, Null-Skala).
     * @returns {ValidationReport}
     */
    validateTransforms() {
        const findings = this._checkInvalidTransforms();
        const report   = _buildReport(findings);
        this._lastReport = report;
        return report;
    }


    // ─────────────────────────────────────────────────────────────────
    // Gecachtes Ergebnis
    // ─────────────────────────────────────────────────────────────────

    /**
     * Gibt den letzten Validierungsbericht zurück.
     * Gibt null zurück, falls noch keine Validierung durchgeführt wurde.
     *
     * @returns {ValidationReport|null}
     */
    getValidationResults() {
        return this._lastReport ? { ...this._lastReport } : null;
    }

    /**
     * Gibt an, ob der letzte Bericht Fehler enthält.
     * @returns {boolean}
     */
    get hasErrors() {
        return (this._lastReport?.errorCount ?? 0) > 0;
    }

    /**
     * Gibt an, ob der letzte Bericht Warnungen enthält.
     * @returns {boolean}
     */
    get hasWarnings() {
        return (this._lastReport?.warningCount ?? 0) > 0;
    }


    // ─────────────────────────────────────────────────────────────────
    // Interne Prüfungen (ergänzend zum bestehenden ModelValidator)
    // ─────────────────────────────────────────────────────────────────

    _safeValidate() {
        try {
            const report = this._validator.validate?.() ?? { findings: [], elapsed: 0 };
            return {
                ...report,
                findings: report.findings ?? [],
                elapsed: report.elapsed ?? report.durationMs ?? 0
            };
        } catch (err) {
            console.error('[ModelValidationManager] Validator threw:', err);
            return { findings: [], elapsed: 0, error: err.message };
        }
    }

    /** Erkennt zyklische Gruppenreferenzen. */
    _checkHierarchyCycles() {
        if (!this._groups) return [];
        const groups = this._groups.getAllGroups?.() ?? [];
        const byId = new Map(groups.map(group => [group.id, group]));
        const findings = [];
        const visited = new Set();
        const active = new Set();

        const visit = (group, path) => {
            if (active.has(group.id)) {
                findings.push({
                    id: `hierarchy-cycle:${group.id}`,
                    code: 'HIERARCHY_CYCLE',
                    severity: 'error',
                    title: 'Zyklische Hierarchie',
                    message: `Die Gruppenverschachtelung enthält einen Zyklus bei "${group.name}".`,
                    brickIds: group.brickIds ?? [],
                    groupIds: [...path, group.id],
                    suggestion: 'Eltern-Gruppenbeziehung korrigieren.'
                });
                return;
            }
            if (visited.has(group.id)) return;
            active.add(group.id);
            if (group.parentGroupId) {
                const parent = byId.get(group.parentGroupId);
                if (!parent) {
                    findings.push({
                        id: `missing-parent:${group.id}`,
                        code: 'MISSING_PARENT_GROUP',
                        severity: 'error',
                        title: 'Fehlende Elterngruppe',
                        message: `Gruppe "${group.name}" verweist auf eine nicht vorhandene Elterngruppe.`,
                        brickIds: group.brickIds ?? [],
                        groupIds: [group.id, group.parentGroupId],
                        suggestion: 'Elternreferenz entfernen oder die Elterngruppe wiederherstellen.'
                    });
                } else {
                    visit(parent, [...path, group.id]);
                }
            }
            active.delete(group.id);
            visited.add(group.id);
        };

        for (const group of groups) visit(group, []);
        return findings;
    }

    /** Erkennt Bauteile mit ungültigen Transformationen (NaN, Infinity). */
    _checkInvalidTransforms() {
        const findings = [];
        const bricks   = this._lib.getAll?.() ?? [];

        for (const brick of bricks) {
            const g = brick.group;
            if (!g) continue;

            const vals = [
                g.position.x, g.position.y, g.position.z,
                g.rotation.x, g.rotation.y, g.rotation.z,
                g.scale.x,    g.scale.y,    g.scale.z,
            ];

            const invalid = vals.some(v => !isFinite(v));
            const zeroScale = g.scale.x === 0 || g.scale.y === 0 || g.scale.z === 0;

            if (invalid) {
                findings.push({
                    id:        crypto.randomUUID(),
                    code:      'INVALID_TRANSFORM',
                    severity:  'error',
                    title:     'Ungültige Transformation',
                    message:   `Bauteil ${brick.id} hat NaN oder Infinity in Position/Rotation/Skalierung.`,
                    brickIds:  [brick.id],
                    suggestion: 'Transformation auf Standardwerte zurücksetzen.',
                });
            } else if (zeroScale) {
                findings.push({
                    id:        crypto.randomUUID(),
                    code:      'ZERO_SCALE',
                    severity:  'warning',
                    title:     'Null-Skalierung',
                    message:   `Bauteil ${brick.id} hat eine Skalierung von 0 auf mindestens einer Achse.`,
                    brickIds:  [brick.id],
                    suggestion: 'Skalierung auf einen positiven Wert setzen.',
                });
            }
        }

        return findings;
    }

    /** Erkennt fehlende Bauteil-Referenzen in Verbindungen. */
    _checkMissingParts() {
        if (!this._connections) return [];
        const findings = [];

        try {
            const connections = this._connections.getAll?.()
                             ?? this._connections.getAllConnections?.()
                             ?? [];

            for (const conn of connections) {
                const partA = conn.fromInstanceId ?? conn.instanceIdA;
                const partB = conn.toInstanceId   ?? conn.instanceIdB;

                if (partA && !this._lib.hasId?.(partA)) {
                    findings.push({
                        id:        crypto.randomUUID(),
                        code:      'MISSING_PART_REF',
                        severity:  'error',
                        title:     'Fehlendes Bauteil',
                        message:   `Verbindung ${conn.id ?? '?'} verweist auf nicht vorhandenes Bauteil ${partA}.`,
                        brickIds:  [partA],
                        suggestion: 'Verbindung entfernen oder Bauteil wiederherstellen.',
                    });
                }
                if (partB && !this._lib.hasId?.(partB)) {
                    findings.push({
                        id:        crypto.randomUUID(),
                        code:      'MISSING_PART_REF',
                        severity:  'error',
                        title:     'Fehlendes Bauteil',
                        message:   `Verbindung ${conn.id ?? '?'} verweist auf nicht vorhandenes Bauteil ${partB}.`,
                        brickIds:  [partB],
                        suggestion: 'Verbindung entfernen oder Bauteil wiederherstellen.',
                    });
                }
            }
        } catch (err) {
            console.warn('[ModelValidationManager._checkMissingParts]', err.message);
        }

        return findings;
    }


    // ─────────────────────────────────────────────────────────────────
    // Merge-Hilfsfunktion
    // ─────────────────────────────────────────────────────────────────

    _merge(baseReport, extraFindings) {
        const combined = [
            ...(baseReport.findings ?? []),
            ...extraFindings,
        ];
        return _buildReport(combined, baseReport.elapsed);
    }
}


// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function _buildReport(findings, elapsed = 0) {
    const sorted = [...findings].sort((a, b) => _severity(b) - _severity(a));
    return {
        findings:      sorted,
        errorCount:    sorted.filter(f => f.severity === 'error').length,
        warningCount:  sorted.filter(f => f.severity === 'warning').length,
        infoCount:     sorted.filter(f => f.severity === 'info').length,
        totalCount:    sorted.length,
        isValid:       sorted.every(f => f.severity !== 'error'),
        elapsed,
        generatedAt:   new Date().toISOString(),
    };
}

function _severity(finding) {
    return { error: 3, warning: 2, info: 1 }[finding.severity] ?? 0;
}

/**
 * @typedef {{
 *   findings:     object[]
 *   errorCount:   number
 *   warningCount: number
 *   infoCount:    number
 *   totalCount:   number
 *   isValid:      boolean
 *   elapsed:      number
 *   generatedAt:  string
 * }} ValidationReport
 */
