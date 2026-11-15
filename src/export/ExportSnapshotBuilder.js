/**
 * ExportSnapshotBuilder – Erstellt einen unveränderlichen Export-Schnappschuss (Phase H.0)
 *
 * Sammelt alle relevanten Modellbauteile und Metadaten aus den bestehenden Managern.
 * Das Ergebnis ist ein datenbankartiges Objekt ohne Referenzen auf veränderliche
 * Three.js- oder Editor-Objekte.
 *
 * Wichtig:
 *  - Keine Veränderung des Editorzustands
 *  - Brick und PartInstance werden beide unterstützt
 *  - Fehlende Katalogdaten führen nicht zum Absturz
 *  - Exporter dürfen NICHT direkt auf den Editor zugreifen
 *
 * Typ-Erkennung:
 *  - `data.source === undefined` → Brick   (lokal, kein LDraw-Bezug)
 *  - `data.source !== undefined` → PartInstance (LDraw-Bibliotheksteil)
 *
 * @module ExportSnapshotBuilder
 */

import { ColorManager } from '../catalog/colors/ColorManager.js';

// ─────────────────────────────────────────────────────────────────────────────
// JSDoc-Typdefinitionen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {{ x: number, y: number, z: number }} Vec3
 */

/**
 * @typedef {Object} ExportPart
 * @property {string}       id               - Instanz-ID des Bauteils.
 * @property {string}       partId           - Katalogeintrag-ID (aus `data.type`).
 * @property {string|null}  ldrawPartNumber  - LDraw-Teilenummer oder `null` bei Bricks.
 * @property {string|null}  name             - Menschenlesbarer Name aus dem Katalog.
 * @property {'local'|'ldraw'} source        - Herkunft des Bauteils.
 * @property {number}       color            - Farbe als Hex-Integer.
 * @property {number|null}  colorId          - LDraw-Farb-ID oder `null`.
 * @property {string|null}  colorName        - Bezeichnung der Farbe.
 * @property {string|null}  colorHex         - Hex-String der Farbe (z.B. `'#FF0000'`).
 * @property {string|null}  variantId        - Varianten-ID (nur PartInstance).
 * @property {Vec3}         position         - Position in Three.js-Einheiten.
 * @property {Vec3}         rotation         - Euler-Rotation in Bogenmaß (XYZ).
 * @property {string|null}  category         - Kategoriebezeichnung aus dem Katalog.
 * @property {number|null}  width            - Breite aus dem Katalog.
 * @property {number|null}  depth            - Tiefe aus dem Katalog.
 * @property {number|null}  height           - Höhe aus dem Katalog.
 * @property {string|null}  geometry         - Geometriebezeichnung aus dem Katalog.
 * @property {string[]}     groupIds         - IDs aller Gruppen, die dieses Bauteil enthalten.
 * @property {string[]}     assemblyIds      - IDs aller Assemblies, die dieses Bauteil enthalten.
 */

/**
 * @typedef {Object} ExportAssembly
 * @property {string}   id                      - Gruppen-ID der Assembly.
 * @property {string[]} mechanicalConnectionIds  - Verbindungs-IDs der Assembly.
 */

/**
 * @typedef {Object} ExportGroup
 * @property {string}   id      - Gruppen-ID.
 * @property {string}   name    - Bezeichnung der Gruppe.
 * @property {string[]} partIds - Bauteil-IDs in dieser Gruppe.
 */

/**
 * @typedef {Object} ExportConnection
 * @property {string} id          - Verbindungs-ID.
 * @property {string} brickIdA    - ID des ersten Bauteils.
 * @property {string} brickIdB    - ID des zweiten Bauteils.
 * @property {*}      [meta]      - Optionale Metadaten aus dem ConnectionManager.
 */

/**
 * @typedef {Object} ExportMechanicalConnection
 * @property {string} id     - Verbindungs-ID.
 * @property {*}      [meta] - Optionale Metadaten aus dem MechanicalManager.
 */

/**
 * @typedef {Object} ExportMetadata
 * @property {string}  projectName    - Name des Projekts.
 * @property {string}  exportedAt     - ISO-8601-Zeitstempel des Exports.
 * @property {number}  formatVersion  - Versionsnummer des Snapshot-Formats (immer `1`).
 * @property {number}  partCount      - Gesamtanzahl der Bauteile.
 * @property {boolean} hasLDrawParts  - `true`, wenn mindestens ein LDraw-Teil enthalten ist.
 * @property {boolean} hasLocalParts  - `true`, wenn mindestens ein lokales Brick enthalten ist.
 */

/**
 * @typedef {Object} ExportSnapshot
 * @property {ExportMetadata}             metadata
 * @property {ExportPart[]}               parts
 * @property {ExportAssembly[]}           assemblies
 * @property {ExportGroup[]}              groups
 * @property {ExportConnection[]}         connections
 * @property {ExportMechanicalConnection[]} mechanicalConnections
 */

// ─────────────────────────────────────────────────────────────────────────────
// Hilfs-Konstanten
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fallback-Vektor für fehlende Positions-/Rotationsdaten.
 * @type {Vec3}
 */
const ZERO_VEC3 = Object.freeze({ x: 0, y: 0, z: 0 });

// ─────────────────────────────────────────────────────────────────────────────
// Hauptklasse
// ─────────────────────────────────────────────────────────────────────────────

export class ExportSnapshotBuilder {

    /**
     * Erstellt einen neuen ExportSnapshotBuilder.
     *
     * Alle Manager-Parameter außer `library` sind optional.
     * Fehlende Manager erzeugen leere Arrays im Snapshot.
     *
     * @param {object}  params
     * @param {object}  params.library                        - Pflicht. Stellt `getAllData()` bereit.
     * @param {object|null}  [params.partCatalog=null]        - Optionaler Teilekatalog.
     * @param {object|null}  [params.assemblyManager=null]    - Optionaler Assembly-Manager.
     * @param {object|null}  [params.connectionManager=null]  - Optionaler Verbindungs-Manager.
     * @param {object|null}  [params.mechanicalManager=null]  - Optionaler Mechanik-Manager.
     * @param {string}       [params.projectName='Export']    - Name des Projekts.
     */
    constructor({
        library,
        partCatalog        = null,
        assemblyManager    = null,
        connectionManager  = null,
        mechanicalManager  = null,
        projectName        = 'Export',
    }) {
        if (!library) {
            throw new Error('ExportSnapshotBuilder: library ist erforderlich.');
        }

        /** @private @type {object} */
        this._library = library;
        /** @private @type {object|null} */
        this._partCatalog = partCatalog;
        /** @private @type {object|null} */
        this._assemblyManager = assemblyManager;
        /** @private @type {object|null} */
        this._connectionManager = connectionManager;
        /** @private @type {object|null} */
        this._mechanicalManager = mechanicalManager;
        /** @private @type {string} */
        this._projectName = String(projectName);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Öffentliche API
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Erstellt und gibt den vollständigen Export-Schnappschuss zurück.
     *
     * Der Schnappschuss ist ein einfaches, serialisierbares Datenobjekt ohne
     * Verweise auf Three.js- oder Editor-Objekte.
     *
     * @returns {ExportSnapshot} Unveränderlicher Schnappschuss aller Exportdaten.
     */
    build() {
        // ── 1. Rohdaten aus der Library holen ─────────────────────────────────
        const rawParts = this._library.getAllData?.() ?? [];

        // ── 2. Gruppen und Assembly-Lookup-Maps aufbauen ─────────────────────
        const { groups,       partToGroups    } = this._buildGroups();
        const { assemblies,   partToAssemblies } = this._buildAssemblies();

        // ── 3. Alle Bauteile in ExportPart-Objekte umwandeln ─────────────────
        const parts = rawParts.map(data =>
            this._buildPart(data, partToGroups, partToAssemblies)
        );

        // ── 4. Verbindungsdaten holen ─────────────────────────────────────────
        const connections           = this._buildConnections();
        const mechanicalConnections = this._buildMechanicalConnections();

        // ── 5. Metadaten berechnen ────────────────────────────────────────────
        const hasLDrawParts = parts.some(p => p.source === 'ldraw');
        const hasLocalParts = parts.some(p => p.source === 'local');

        /** @type {ExportMetadata} */
        const metadata = {
            projectName:   this._projectName,
            exportedAt:    new Date().toISOString(),
            formatVersion: 1,
            partCount:     parts.length,
            hasLDrawParts,
            hasLocalParts,
        };

        return {
            metadata,
            parts,
            assemblies,
            groups,
            connections,
            mechanicalConnections,
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Interne Hilfsmethoden – Bauteil-Verarbeitung
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Wandelt ein serialisiertes Bauteildatenobjekt in ein {@link ExportPart} um.
     *
     * Unterscheidet anhand des `source`-Feldes zwischen Brick (lokal) und
     * PartInstance (LDraw-Bibliotheksteil).
     *
     * @param {object}              data             - Rohdate aus `library.getAllData()`.
     * @param {Map<string,string[]>} partToGroups    - Lookup: PartID → GroupIDs.
     * @param {Map<string,string[]>} partToAssemblies - Lookup: PartID → AssemblyIDs.
     * @returns {ExportPart}
     * @private
     */
    _buildPart(data, partToGroups, partToAssemblies) {
        // ── Typ-Erkennung: Brick vs. PartInstance ─────────────────────────────
        const isBrick = data.source === undefined;

        const source          = isBrick ? 'local' : 'ldraw';
        const ldrawPartNumber = isBrick ? null : (data.ldrawPartNumber ?? null);
        const colorId         = isBrick ? null : (data.colorId         ?? null);
        const variantId       = isBrick ? null : (data.variantId       ?? null);

        // ── Katalog-Lookup ────────────────────────────────────────────────────
        const catalogEntry = this._partCatalog
            ? (this._partCatalog.getPartById?.(data.type) ?? null)
            : null;

        const name     = catalogEntry?.name     ?? null;
        const category = catalogEntry?.category ?? null;
        const width    = catalogEntry?.width    ?? null;
        const depth    = catalogEntry?.depth    ?? null;
        const height   = catalogEntry?.height   ?? null;
        const geometry = catalogEntry?.geometry ?? null;

        // ── Farb-Lookup ───────────────────────────────────────────────────────
        let colorName = null;
        let colorHex  = null;

        try {
            const cm = ColorManager.instance();

            if (colorId !== null) {
                // PartInstance: LDraw-Farb-ID direkt verwenden
                const colorEntry = cm.getColorById?.(colorId) ?? null;
                if (colorEntry) {
                    colorName = colorEntry.name ?? null;
                    colorHex  = colorEntry.hex  ?? null;
                }
            } else if (data.color !== undefined && data.color !== null) {
                // Brick: Hex-Farbwert → beste Farb-ID ermitteln
                const resolvedId = cm.hexNumberToColorId?.(data.color) ?? null;
                if (resolvedId !== null) {
                    const colorEntry = cm.getColorById?.(resolvedId) ?? null;
                    if (colorEntry) {
                        colorName = colorEntry.name ?? null;
                        colorHex  = colorEntry.hex  ?? null;
                    }
                }
            }
        } catch (_err) {
            // ColorManager nicht verfügbar – graceful degradation
        }

        // ── Positions- und Rotationsdaten absichern ───────────────────────────
        const position = ExportSnapshotBuilder._safeVec3(data.position);
        const rotation = ExportSnapshotBuilder._safeVec3(data.rotation);

        // ── Gruppen- und Assembly-Zugehörigkeit ───────────────────────────────
        const groupIds    = partToGroups.get(data.id)     ?? [];
        const assemblyIds = partToAssemblies.get(data.id) ?? [];

        /** @type {ExportPart} */
        return {
            id:              String(data.id ?? ''),
            partId:          String(data.type ?? ''),
            ldrawPartNumber,
            name,
            source,
            color:           data.color  ?? 0,
            colorId,
            colorName,
            colorHex,
            variantId,
            position,
            rotation,
            category,
            width,
            depth,
            height,
            geometry,
            groupIds:    [...groupIds],
            assemblyIds: [...assemblyIds],
        };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Interne Hilfsmethoden – Gruppen
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Baut die Gruppen-Daten und eine umgekehrte Lookup-Map auf.
     *
     * Liest Gruppen aus `assemblyManager.getAll()` (GroupManager-Gruppen),
     * die Objekte mit `id`, `name` und `brickIds` (Set) besitzen.
     *
     * @returns {{ groups: ExportGroup[], partToGroups: Map<string, string[]> }}
     * @private
     */
    _buildGroups() {
        /** @type {ExportGroup[]} */
        const groups       = [];
        /** @type {Map<string, string[]>} */
        const partToGroups = new Map();

        if (!this._assemblyManager) return { groups, partToGroups };

        const rawGroups = this._assemblyManager.getAll?.() ?? [];

        for (const group of rawGroups) {
            const groupId  = String(group.id ?? '');
            const partIds  = [];

            // brickIds kann ein Set oder ein Array sein
            const brickIds = group.brickIds instanceof Set
                ? group.brickIds
                : new Set(group.brickIds ?? []);

            for (const brickId of brickIds) {
                const pid = String(brickId);
                partIds.push(pid);

                if (!partToGroups.has(pid)) {
                    partToGroups.set(pid, []);
                }
                partToGroups.get(pid).push(groupId);
            }

            groups.push({
                id:      groupId,
                name:    String(group.name ?? ''),
                partIds,
            });
        }

        return { groups, partToGroups };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Interne Hilfsmethoden – Assemblies
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Baut die Assembly-Daten und eine umgekehrte Lookup-Map auf.
     *
     * Liest Assemblies aus `assemblyManager.getAllAssemblies()`, die Wrapper-
     * Objekte mit `groupId` und `mechanicalConnectionIds` besitzen.
     * Die zugehörigen Bauteil-IDs werden über die zugehörige Gruppe ermittelt.
     *
     * @returns {{ assemblies: ExportAssembly[], partToAssemblies: Map<string, string[]> }}
     * @private
     */
    _buildAssemblies() {
        /** @type {ExportAssembly[]} */
        const assemblies        = [];
        /** @type {Map<string, string[]>} */
        const partToAssemblies  = new Map();

        if (!this._assemblyManager) return { assemblies, partToAssemblies };

        const rawAssemblies = this._assemblyManager.getAllAssemblies?.() ?? [];

        // Gruppen-Lookup für Bauteil-IDs der Assembly
        const rawGroups   = this._assemblyManager.getAll?.() ?? [];
        const groupById   = new Map(rawGroups.map(g => [String(g.id), g]));

        for (const assembly of rawAssemblies) {
            const assemblyId             = String(assembly.groupId ?? '');
            const mechanicalConnectionIds = (assembly.mechanicalConnectionIds ?? []).map(String);

            assemblies.push({
                id: assemblyId,
                mechanicalConnectionIds,
            });

            // Bauteil-IDs aus der zugehörigen Gruppe lesen
            const group   = groupById.get(assemblyId);
            const brickIds = group?.brickIds instanceof Set
                ? group.brickIds
                : new Set(group?.brickIds ?? []);

            for (const brickId of brickIds) {
                const pid = String(brickId);
                if (!partToAssemblies.has(pid)) {
                    partToAssemblies.set(pid, []);
                }
                partToAssemblies.get(pid).push(assemblyId);
            }
        }

        return { assemblies, partToAssemblies };
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Interne Hilfsmethoden – Verbindungen
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Liest Standard-Verbindungsdaten aus dem ConnectionManager.
     *
     * @returns {ExportConnection[]}
     * @private
     */
    _buildConnections() {
        if (!this._connectionManager) return [];

        try {
            const raw = this._connectionManager.getAll?.() ?? [];
            return raw.map(conn => ({
                id:       String(conn.id       ?? ''),
                brickIdA: String(conn.brickIdA ?? conn.a ?? ''),
                brickIdB: String(conn.brickIdB ?? conn.b ?? ''),
                meta:     conn.meta ?? undefined,
            }));
        } catch (_err) {
            return [];
        }
    }

    /**
     * Liest mechanische Verbindungsdaten aus dem MechanicalManager.
     *
     * @returns {ExportMechanicalConnection[]}
     * @private
     */
    _buildMechanicalConnections() {
        if (!this._mechanicalManager) return [];

        try {
            const raw = this._mechanicalManager.getAll?.() ?? [];
            return raw.map(conn => ({
                id:   String(conn.id ?? ''),
                meta: conn.meta ?? undefined,
            }));
        } catch (_err) {
            return [];
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Statische Hilfsmethoden
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Erstellt eine sichere Kopie eines Vec3-Objekts.
     *
     * Gibt `{ x: 0, y: 0, z: 0 }` zurück, wenn der Eingabewert null/undefined ist.
     * Nicht-numerische Komponenten werden auf `0` normalisiert.
     *
     * @param {*} v - Rohwert aus den Bauteildaten.
     * @returns {Vec3}
     * @private
     */
    static _safeVec3(v) {
        if (!v || typeof v !== 'object') return { ...ZERO_VEC3 };
        return {
            x: typeof v.x === 'number' && isFinite(v.x) ? v.x : 0,
            y: typeof v.y === 'number' && isFinite(v.y) ? v.y : 0,
            z: typeof v.z === 'number' && isFinite(v.z) ? v.z : 0,
        };
    }
}
