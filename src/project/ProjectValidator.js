
import { PartCatalog } from '../library/PartCatalog.js';


// ========================================
// Unterstützte Projektversionen
// ========================================

const SUPPORTED_FORMAT   = 'mecabricks-clone';
const SUPPORTED_VERSIONS = [1, 2];  // Version 2 fügt optionale Gruppen hinzu


// ========================================
// ProjectValidator
// ========================================

/**
 * Prüft Projektdaten auf Vollständigkeit und Korrektheit,
 * bevor sie geladen oder wiederhergestellt werden.
 *
 * Geprüfte Punkte:
 *   1. Dateiformat und Versionsnummer
 *   2. Projektinformationen (id, name, createdAt, updatedAt)
 *   3. Steinliste: bekannte Typen, gültige Farben, Positionen, Rotationen
 *   4. Eindeutige Stein-IDs
 *   5. Verbindungsliste: Pflichtfelder, eindeutige IDs
 *   6. Verbindungen verweisen auf vorhandene Steine
 *   7. Keine Verbindung eines Steins mit sich selbst
 *
 * Verwendung:
 *   const validator = new ProjectValidator();
 *   validator.validate(data);  // wirft Error bei Ungültigkeit
 *
 *   // Oder als nicht-werfende Variante:
 *   const result = validator.safeValidate(data);
 *   if (!result.valid) console.error(result.error);
 */
export class ProjectValidator {


    // ========================================
    // 1. Validierung (werfend)
    // ========================================

    /**
     * Prüft die Projektdaten auf Gültigkeit.
     *
     * @param {*} data – Zu prüfende Projektdaten (beliebiger Wert).
     * @returns {true} bei Erfolg.
     * @throws {Error} mit einer verständlichen Fehlermeldung bei
     *   jedem gefundenen Validierungsfehler.
     */
    validate(data) {

        // ── 1. Grundstruktur ────────────────────────────────────────

        if (!data || typeof data !== 'object') {
            throw new Error('Ungültige Projektdatei.');
        }

        if (data.format !== SUPPORTED_FORMAT) {
            throw new Error(
                `Unbekanntes Projektformat: "${data.format}". ` +
                `Erwartet: "${SUPPORTED_FORMAT}".`
            );
        }

        if (!SUPPORTED_VERSIONS.includes(data.version)) {
            throw new Error(
                `Nicht unterstützte Projektversion: ${data.version}. ` +
                `Unterstützt: ${SUPPORTED_VERSIONS.join(', ')}.`
            );
        }


        // ── 2. Projektinformationen ─────────────────────────────────

        if (!data.project || typeof data.project !== 'object') {
            throw new Error('Projektinformationen fehlen.');
        }

        if (typeof data.project.name !== 'string' || !data.project.name.trim()) {
            throw new Error('Projektname fehlt oder ist leer.');
        }


        // ── 3. Steinliste ───────────────────────────────────────────

        if (!Array.isArray(data.bricks)) {
            throw new Error('Die Steinliste ist ungültig oder fehlt.');
        }

        const brickIds = new Set();

        for (const brick of data.bricks) {

            // Pflichtfelder
            if (!brick.id) {
                throw new Error('Ein Stein hat keine ID.');
            }

            if (!brick.type) {
                throw new Error(
                    `Stein "${brick.id}" hat keinen Bauteiltyp.`
                );
            }

            // Bekannter Bauteiltyp – Prüfung über den zentralen PartCatalog,
            // damit alle neu registrierten Typen automatisch akzeptiert werden
            if (!PartCatalog.instance().hasPart(brick.type)) {
                throw new Error(
                    `Unbekannter Bauteiltyp: "${brick.type}" ` +
                    `(Stein "${brick.id}").`
                );
            }

            // Eindeutige ID
            if (brickIds.has(brick.id)) {
                throw new Error(
                    `Doppelte Stein-ID: "${brick.id}".`
                );
            }

            brickIds.add(brick.id);

            // Gültige Farbe (ganzzahliger Hexadezimalwert 0x000000–0xffffff)
            if (
                !Number.isInteger(brick.color) ||
                brick.color < 0 ||
                brick.color > 0xffffff
            ) {
                throw new Error(
                    `Ungültige Farbe bei Stein "${brick.id}": ${brick.color}.`
                );
            }

            // Gültige Position und Rotation
            this._validateVector(brick.position, `Position von Stein "${brick.id}"`);
            this._validateVector(brick.rotation, `Rotation von Stein "${brick.id}"`);
        }


        // ── 4. Verbindungsliste ─────────────────────────────────────

        if (!Array.isArray(data.connections)) {
            throw new Error('Die Verbindungsliste ist ungültig oder fehlt.');
        }

        const connectionIds = new Set();

        for (const conn of data.connections) {

            // Pflichtfelder
            if (!conn.id) {
                throw new Error('Eine Verbindung hat keine ID.');
            }

            if (!conn.sourceBrickId || !conn.targetBrickId) {
                throw new Error(
                    `Verbindung "${conn.id}" hat keine vollständigen Steinreferenzen.`
                );
            }

            if (!conn.type) {
                throw new Error(
                    `Verbindung "${conn.id}" hat keinen Typ.`
                );
            }

            // Eindeutige ID
            if (connectionIds.has(conn.id)) {
                throw new Error(
                    `Doppelte Verbindungs-ID: "${conn.id}".`
                );
            }

            connectionIds.add(conn.id);

            // Referenzierte Steine müssen existieren
            if (!brickIds.has(conn.sourceBrickId)) {
                throw new Error(
                    `Verbindung "${conn.id}" verweist auf unbekannten ` +
                    `Quellstein: "${conn.sourceBrickId}".`
                );
            }

            if (!brickIds.has(conn.targetBrickId)) {
                throw new Error(
                    `Verbindung "${conn.id}" verweist auf unbekannten ` +
                    `Zielstein: "${conn.targetBrickId}".`
                );
            }

            // Kein Stein kann mit sich selbst verbunden sein
            if (conn.sourceBrickId === conn.targetBrickId) {
                throw new Error(
                    `Verbindung "${conn.id}": Ein Stein kann nicht ` +
                    `mit sich selbst verbunden sein.`
                );
            }

            // Optionale Verbindungsposition prüfen
            if (conn.position !== null && conn.position !== undefined) {
                this._validateVector(
                    conn.position,
                    `Position von Verbindung "${conn.id}"`
                );
            }
        }

        // ── 5. Gruppen (ab Projektversion 2) ───────────────────────────
        // Version-1-Projekte bleiben rückwärtskompatibel und haben keine Gruppen.
        if (data.version >= 2) {
            if (data.groups !== undefined && !Array.isArray(data.groups)) {
                throw new Error('Die Gruppenliste ist ungültig.');
            }

            const groupIds = new Set();
            const assignedBrickIds = new Set();

            for (const group of (data.groups ?? [])) {
                if (!group || typeof group !== 'object' || typeof group.id !== 'string' || !group.id.trim()) {
                    throw new Error('Eine Gruppe hat keine gültige ID.');
                }
                if (groupIds.has(group.id)) {
                    throw new Error(`Doppelte Gruppen-ID: "${group.id}".`);
                }
                groupIds.add(group.id);

                if (typeof group.name !== 'string' || !group.name.trim()) {
                    throw new Error(`Gruppe "${group.id}" hat keinen gültigen Namen.`);
                }
                if (!Array.isArray(group.brickIds) || group.brickIds.length < 1) {
                    throw new Error(`Gruppe "${group.id}" enthält keine Bauteile.`);
                }

                const localIds = new Set();
                for (const brickId of group.brickIds) {
                    if (typeof brickId !== 'string' || !brickIds.has(brickId)) {
                        throw new Error(`Gruppe "${group.id}" verweist auf ein unbekanntes Bauteil.`);
                    }
                    if (localIds.has(brickId)) {
                        throw new Error(`Gruppe "${group.id}" enthält Bauteil "${brickId}" mehrfach.`);
                    }
                    if (assignedBrickIds.has(brickId)) {
                        throw new Error(`Bauteil "${brickId}" ist mehreren Gruppen zugeordnet.`);
                    }
                    localIds.add(brickId);
                    assignedBrickIds.add(brickId);
                }
            }
        }

        return true;
    }


    // ========================================
    // 2. Validierung (nicht-werfend)
    // ========================================

    /**
     * Wie validate(), gibt aber ein Ergebnisobjekt zurück
     * statt eine Ausnahme zu werfen.
     *
     * Nützlich, wenn der Aufrufer den Fehler behandeln will,
     * ohne try-catch schreiben zu müssen.
     *
     * @param {*} data – Zu prüfende Projektdaten.
     * @returns {{ valid: boolean, error: string|null }}
     */
    safeValidate(data) {

        try {
            this.validate(data);
            return { valid: true, error: null };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }


    // ========================================
    // Interner Hilfsmethode: Vektor prüfen
    // ========================================

    /**
     * Prüft, ob ein Objekt ein gültiger 3D-Vektor ist
     * (x, y, z müssen endliche Zahlen sein).
     *
     * @param {*}      vector – Zu prüfendes Objekt.
     * @param {string} label  – Bezeichnung für die Fehlermeldung.
     * @throws {Error}
     */
    _validateVector(vector, label) {

        if (
            !vector ||
            !Number.isFinite(vector.x) ||
            !Number.isFinite(vector.y) ||
            !Number.isFinite(vector.z)
        ) {
            throw new Error(
                `Ungültige ${label}: Erwartet ein Objekt mit x, y, z als ` +
                `endliche Zahlen.`
            );
        }
    }
}
