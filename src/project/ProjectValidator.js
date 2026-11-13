
import { PartCatalog } from '../library/PartCatalog.js';

// ========================================
// Unterstützte Projektversionen
// ========================================

const SUPPORTED_FORMAT = 'mecabricks-clone';
const SUPPORTED_VERSIONS = [1, 2, 3];

// ========================================
// ProjectValidator
// ========================================

export class ProjectValidator {

    // ========================================
    // 1. Validierung (werfend)
    // ========================================

    validate(data) {

        // ── 1. Grundstruktur ─────────────────────────────────

        if (
            !data ||
            typeof data !== 'object' ||
            Array.isArray(data)
        ) {
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

        // ── 2. Projektinformationen ──────────────────────────

        if (
            !data.project ||
            typeof data.project !== 'object' ||
            Array.isArray(data.project)
        ) {
            throw new Error('Projektinformationen fehlen.');
        }

        if (
            typeof data.project.name !== 'string' ||
            !data.project.name.trim()
        ) {
            throw new Error('Projektname fehlt oder ist leer.');
        }

        // ── 3. Steinliste ────────────────────────────────────

        if (!Array.isArray(data.bricks)) {
            throw new Error('Die Steinliste ist ungültig oder fehlt.');
        }

        const brickIds = new Set();

        for (const brick of data.bricks) {

            // Zusätzliche Prüfung: Eintrag muss ein Objekt sein.
            if (
                !brick ||
                typeof brick !== 'object' ||
                Array.isArray(brick)
            ) {
                throw new Error(
                    'Die Steinliste enthält einen ungültigen Eintrag.'
                );
            }

            if (!brick.id) {
                throw new Error('Ein Stein hat keine ID.');
            }

            if (!brick.type) {
                throw new Error(
                    `Stein "${brick.id}" hat keinen Bauteiltyp.`
                );
            }

            if (!PartCatalog.instance().hasPart(brick.type)) {
                throw new Error(
                    `Unbekannter Bauteiltyp: "${brick.type}" ` +
                    `(Stein "${brick.id}").`
                );
            }

            if (brickIds.has(brick.id)) {
                throw new Error(
                    `Doppelte Stein-ID: "${brick.id}".`
                );
            }

            brickIds.add(brick.id);

            if (
                !Number.isInteger(brick.color) ||
                brick.color < 0 ||
                brick.color > 0xffffff
            ) {
                throw new Error(
                    `Ungültige Farbe bei Stein "${brick.id}": ${brick.color}.`
                );
            }

            this._validateVector(
                brick.position,
                `Position von Stein "${brick.id}"`
            );

            this._validateVector(
                brick.rotation,
                `Rotation von Stein "${brick.id}"`
            );
        }

        // ── 4. Verbindungsliste ──────────────────────────────

        if (!Array.isArray(data.connections)) {
            throw new Error('Die Verbindungsliste ist ungültig oder fehlt.');
        }

        const connectionIds = new Set();

        for (const conn of data.connections) {

            // Zusätzliche Prüfung: Eintrag muss ein Objekt sein.
            if (
                !conn ||
                typeof conn !== 'object' ||
                Array.isArray(conn)
            ) {
                throw new Error(
                    'Die Verbindungsliste enthält einen ungültigen Eintrag.'
                );
            }

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

            if (connectionIds.has(conn.id)) {
                throw new Error(
                    `Doppelte Verbindungs-ID: "${conn.id}".`
                );
            }

            connectionIds.add(conn.id);

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

            if (conn.sourceBrickId === conn.targetBrickId) {
                throw new Error(
                    `Verbindung "${conn.id}": Ein Stein kann nicht ` +
                    `mit sich selbst verbunden sein.`
                );
            }

            if (conn.position !== null && conn.position !== undefined) {
                this._validateVector(
                    conn.position,
                    `Position von Verbindung "${conn.id}"`
                );
            }
        }

        // ── 5. Gruppen (ab Projektversion 2) ─────────────────

        if (data.version >= 2) {

            if (
                data.groups !== undefined &&
                !Array.isArray(data.groups)
            ) {
                throw new Error('Die Gruppenliste ist ungültig.');
            }

            const groupIds = new Set();
            const assignedBrickIds = new Set();

            for (const group of (data.groups ?? [])) {

                // Zusätzliche Prüfung: Gruppe muss ein Objekt sein.
                if (
                    !group ||
                    typeof group !== 'object' ||
                    Array.isArray(group)
                ) {
                    throw new Error(
                        'Die Gruppenliste enthält einen ungültigen Eintrag.'
                    );
                }

                if (
                    typeof group.id !== 'string' ||
                    !group.id.trim()
                ) {
                    throw new Error('Eine Gruppe hat keine gültige ID.');
                }

                if (groupIds.has(group.id)) {
                    throw new Error(
                        `Doppelte Gruppen-ID: "${group.id}".`
                    );
                }

                groupIds.add(group.id);

                if (
                    typeof group.name !== 'string' ||
                    !group.name.trim()
                ) {
                    throw new Error(
                        `Gruppe "${group.id}" hat keinen gültigen Namen.`
                    );
                }

                if (
                    !Array.isArray(group.brickIds) ||
                    group.brickIds.length < 1
                ) {
                    throw new Error(
                        `Gruppe "${group.id}" enthält keine Bauteile.`
                    );
                }

                const localIds = new Set();

                for (const brickId of group.brickIds) {

                    if (
                        typeof brickId !== 'string' ||
                        !brickIds.has(brickId)
                    ) {
                        throw new Error(
                            `Gruppe "${group.id}" verweist auf ein unbekanntes Bauteil.`
                        );
                    }

                    if (localIds.has(brickId)) {
                        throw new Error(
                            `Gruppe "${group.id}" enthält Bauteil "${brickId}" mehrfach.`
                        );
                    }

                    if (assignedBrickIds.has(brickId)) {
                        throw new Error(
                            `Bauteil "${brickId}" ist mehreren Gruppen zugeordnet.`
                        );
                    }

                    localIds.add(brickId);
                    assignedBrickIds.add(brickId);
                }
            }
        }

        // ── 6. Komponentenbibliothek (ab Projektversion 3) ──

        if (data.version >= 3) {

            if (
                data.components !== undefined &&
                !Array.isArray(data.components)
            ) {
                throw new Error(
                    'Die Komponentenbibliothek ist ungültig.'
                );
            }

            const componentIds = new Set();

            for (const component of (data.components ?? [])) {

                // Zusätzliche Prüfung: Komponente muss ein Objekt sein.
                if (
                    !component ||
                    typeof component !== 'object' ||
                    Array.isArray(component)
                ) {
                    throw new Error(
                        'Die Komponentenbibliothek enthält einen ungültigen Eintrag.'
                    );
                }

                if (
                    typeof component.id !== 'string' ||
                    !component.id.trim()
                ) {
                    throw new Error(
                        'Eine Komponente hat keine gültige ID.'
                    );
                }

                if (componentIds.has(component.id)) {
                    throw new Error(
                        `Doppelte Komponenten-ID: "${component.id}".`
                    );
                }

                componentIds.add(component.id);

                if (
                    typeof component.name !== 'string' ||
                    !component.name.trim()
                ) {
                    throw new Error(
                        `Komponente "${component.id}" hat keinen gültigen Namen.`
                    );
                }

                if (
                    !Array.isArray(component.bricks) ||
                    component.bricks.length === 0
                ) {
                    throw new Error(
                        `Komponente "${component.id}" enthält keine Bauteile.`
                    );
                }

                if (!Array.isArray(component.connections)) {
                    throw new Error(
                        `Komponente "${component.id}" besitzt keine gültige Verbindungsliste.`
                    );
                }

                const localBrickIds = new Set();

                for (const brick of component.bricks) {

                    // Zusätzliche Prüfung: Bauteil muss ein Objekt sein.
                    if (
                        !brick ||
                        typeof brick !== 'object' ||
                        Array.isArray(brick)
                    ) {
                        throw new Error(
                            `Komponente "${component.name}" enthält einen ungültigen Bauteileintrag.`
                        );
                    }

                    if (!brick.id || !brick.type) {
                        throw new Error(
                            `Komponente "${component.id}" enthält ungültige Bauteildaten.`
                        );
                    }

                    if (localBrickIds.has(brick.id)) {
                        throw new Error(
                            `Komponente "${component.id}" enthält die Bauteil-ID "${brick.id}" mehrfach.`
                        );
                    }

                    localBrickIds.add(brick.id);

                    if (!PartCatalog.instance().hasPart(brick.type)) {
                        throw new Error(
                            `Unbekannter Bauteiltyp "${brick.type}" ` +
                            `in Komponente "${component.name}".`
                        );
                    }

                    if (
                        !Number.isInteger(brick.color) ||
                        brick.color < 0 ||
                        brick.color > 0xffffff
                    ) {
                        throw new Error(
                            `Ungültige Farbe in Komponente "${component.name}".`
                        );
                    }

                    this._validateVector(
                        brick.position,
                        `Position eines Bauteils in Komponente "${component.name}"`
                    );

                    this._validateVector(
                        brick.rotation,
                        `Rotation eines Bauteils in Komponente "${component.name}"`
                    );
                }

                const localConnectionIds = new Set();

                for (const connection of component.connections) {

                    // Zusätzliche Prüfung: Verbindung muss ein Objekt sein.
                    if (
                        !connection ||
                        typeof connection !== 'object' ||
                        Array.isArray(connection)
                    ) {
                        throw new Error(
                            `Komponente "${component.name}" enthält einen ungültigen Verbindungseintrag.`
                        );
                    }

                    if (!connection.id || !connection.type) {
                        throw new Error(
                            `Komponente "${component.name}" enthält eine ungültige Verbindung.`
                        );
                    }

                    if (localConnectionIds.has(connection.id)) {
                        throw new Error(
                            `Doppelte Verbindungs-ID in Komponente "${component.name}".`
                        );
                    }

                    localConnectionIds.add(connection.id);

                    if (
                        !localBrickIds.has(connection.sourceBrickId) ||
                        !localBrickIds.has(connection.targetBrickId)
                    ) {
                        throw new Error(
                            `Eine Verbindung in Komponente "${component.name}" ` +
                            `verweist auf ein unbekanntes Bauteil.`
                        );
                    }

                    if (
                        connection.sourceBrickId ===
                        connection.targetBrickId
                    ) {
                        throw new Error(
                            'Eine Komponente enthält eine ungültige Selbstverbindung.'
                        );
                    }

                    if (
                        connection.position !== null &&
                        connection.position !== undefined
                    ) {
                        this._validateVector(
                            connection.position,
                            `Verbindungsposition in Komponente "${component.name}"`
                        );
                    }
                }
            }
        }

        // Alle Prüfungen erfolgreich abgeschlossen.
        return true;
    }


    // ========================================
    // 2. Validierung (nicht-werfend)
    // ========================================

    safeValidate(data) {

        try {
            this.validate(data);

            return {
                valid: true,
                error: null
            };

        } catch (error) {

            return {
                valid: false,
                error: error.message
            };
        }
    }


    // ========================================
    // 3. Interne Hilfsmethode: Vektor prüfen
    // ========================================

    _validateVector(vector, label) {

        if (
            !vector ||
            typeof vector !== 'object' ||
            Array.isArray(vector) ||
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
