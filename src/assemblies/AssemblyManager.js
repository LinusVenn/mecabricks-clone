import { Assembly } from './Assembly.js';
import { MechanicalConnectionManager } from '../connections/MechanicalConnectionManager.js';

// ---------------------------------------------------------------------------
// AssemblyManager
//
// Phase F.6 – erweitert den bisherigen GroupManager-Wrapper um:
//   • Assembly-Wrapperklasse (domain object)
//   • Verwaltung mechanischer Verbindungen innerhalb von Baugruppen
//   • Erweiterte Serialisierung / Deserialisierung
//
// ALLE bisherigen Methoden (getAll, get, rename, addBrick, removeBrick,
// dissolve, duplicate) sind unverändert erhalten.
// ---------------------------------------------------------------------------

export class AssemblyManager {

    /**
     * @param {import('../editor/GroupManager.js').GroupManager}              groupManager
     * @param {import('../library/PartLibrary.js').PartLibrary}               library
     * @param {import('../editor/ConnectionManager.js').ConnectionManager}     connectionManager
     * @param {object|null}                                                    historyManager
     * @param {MechanicalConnectionManager|null}                               mechanicalManager
     */
    constructor(
        groupManager,
        library,
        connectionManager,
        historyManager = null,
        mechanicalManager = null
    ) {
        this.groupManager       = groupManager;
        this.library            = library;
        this.connectionManager  = connectionManager;
        this.historyManager     = historyManager;
        this.mechanicalManager  = mechanicalManager;

        /**
         * Interne Assembly-Registry.
         * Schlüssel: assemblyId  →  Wert: Assembly-Instanz
         * @type {Map<string, Assembly>}
         */
        this._assemblies = new Map();
    }


    // ======================================================================
    // ── BESTEHENDE METHODEN (unverändert) ──────────────────────────────────
    // ======================================================================

    getAll() {
        return this.groupManager.getAllGroups();
    }

    get(groupId) {
        return this.groupManager.getGroup(groupId);
    }

    rename(groupId, name) {
        const success = this.groupManager.renameGroup(groupId, name);

        if (success) {
            this.historyManager?.saveState();
        }

        return success;
    }

    addBrick(groupId, brickId) {
        const brick = this.library.getById(brickId);

        if (!brick) {
            throw new Error('Bauteil wurde nicht gefunden.');
        }

        const existingGroup = this.groupManager.getGroupByBrickId(brickId);

        if (existingGroup?.id === groupId) {
            return false;
        }

        // Ein Bauteil darf nur einer Gruppe angehören.
        if (existingGroup) {
            this.groupManager.removeBrickFromGroup(
                existingGroup.id,
                brickId
            );
        }

        const success = this.groupManager.addBrickToGroup(
            groupId,
            brickId
        );

        if (success) {
            this.historyManager?.saveState();
        }

        return success;
    }

    removeBrick(groupId, brickId) {
        const success = this.groupManager.removeBrickFromGroup(
            groupId,
            brickId
        );

        if (success) {
            this.historyManager?.saveState();
        }

        return success;
    }

    dissolve(groupId) {
        const result = this.groupManager.ungroup(groupId);

        if (result !== null) {
            this.historyManager?.saveState();
        }

        return result;
    }

    duplicate(groupId, offset = { x: 1, y: 0, z: 1 }) {
        const group = this.groupManager.getGroup(groupId);

        if (!group) {
            throw new Error('Baugruppe wurde nicht gefunden.');
        }

        const sourceBricks = group.brickIds
            .map(id => this.library.getById(id))
            .filter(Boolean);

        if (sourceBricks.length !== group.brickIds.length) {
            throw new Error('Die Baugruppe enthält ungültige Bauteile.');
        }

        const sourceIds = new Set(sourceBricks.map(brick => brick.id));
        const createdBricks = [];
        const idMap = new Map();
        let newGroup = null;

        try {
            for (const source of sourceBricks) {
                const position = {
                    x: source.group.position.x + offset.x,
                    y: source.group.position.y + offset.y,
                    z: source.group.position.z + offset.z
                };

                const clone = this.library.addBrick(
                    position.x,
                    position.y,
                    position.z,
                    source.color,
                    source.type
                );

                clone.setTransform(position, {
                    x: source.group.rotation.x,
                    y: source.group.rotation.y,
                    z: source.group.rotation.z
                });

                createdBricks.push(clone);
                idMap.set(source.id, clone.id);
            }

            const internalConnections = this.connectionManager
                .getConnections()
                .filter(connection =>
                    sourceIds.has(connection.sourceBrickId) &&
                    sourceIds.has(connection.targetBrickId)
                );

            for (const connection of internalConnections) {
                const position = connection.position
                    ? {
                        x: connection.position.x + offset.x,
                        y: connection.position.y + offset.y,
                        z: connection.position.z + offset.z
                    }
                    : null;

                this.connectionManager.createConnection(
                    idMap.get(connection.sourceBrickId),
                    idMap.get(connection.targetBrickId),
                    position,
                    connection.type
                );
            }

            newGroup = this.groupManager.createGroup(
                createdBricks,
                `${group.name} (Kopie)`
            );

            this.historyManager?.saveState();

            return {
                group: newGroup,
                bricks: createdBricks
            };

        } catch (error) {
            for (const brick of createdBricks) {
                this.connectionManager.removeConnections(brick.id);
            }

            if (newGroup) {
                this.groupManager.deleteGroup(newGroup.id);
            }

            for (const brick of createdBricks) {
                this.library.removeBrick(brick);
            }

            throw error;
        }
    }


    // ======================================================================
    // ── NEUE METHODEN (Phase F.6) ──────────────────────────────────────────
    // ======================================================================

    // ----------------------------------------------------------------------
    // Assembly CRUD
    // ----------------------------------------------------------------------

    /**
     * Erstellt eine neue GroupManager-Gruppe UND einen Assembly-Wrapper.
     *
     * @param {string}   name      – Name der Baugruppe
     * @param {import('../objects/Brick.js').Brick[]} bricks
     *   – Liste von Brick-Objekten (benötigt für GroupManager.createGroup)
     * @param {{
     *   description?:    string,
     *   subAssemblyIds?: string[],
     * }} [options]
     * @returns {Assembly}
     */
    createAssembly(name, bricks, options = {}) {
        if (!name || typeof name !== 'string') {
            throw new Error('AssemblyManager.createAssembly: name ist erforderlich.');
        }

        if (!Array.isArray(bricks) || bricks.length === 0) {
            throw new Error(
                'AssemblyManager.createAssembly: mindestens ein Bauteil erforderlich.'
            );
        }

        // GroupManager-Gruppe anlegen (wirft selbst, falls bricks leer)
        const group = this.groupManager.createGroup(bricks, name);

        const assembly = new Assembly({
            name,
            groupId:        group.id,
            description:    options.description    ?? '',
            subAssemblyIds: options.subAssemblyIds ?? [],
        });

        this._assemblies.set(assembly.id, assembly);

        this.historyManager?.saveState();

        return assembly;
    }

    /**
     * Gibt den Assembly-Wrapper für eine Assembly-ID zurück.
     *
     * @param {string} assemblyId
     * @returns {Assembly | null}
     */
    getAssembly(assemblyId) {
        return this._assemblies.get(assemblyId) ?? null;
    }

    /**
     * Gibt alle Assembly-Wrapper zurück.
     *
     * @returns {Assembly[]}
     */
    getAllAssemblies() {
        return [...this._assemblies.values()];
    }


    // ----------------------------------------------------------------------
    // Mechanische Verbindungen
    // ----------------------------------------------------------------------

    /**
     * Fügt eine mechanische Verbindung (Gelenk) zur Baugruppe hinzu.
     *
     * Der jointDef wird an MechanicalConnectionManager.createConnection()
     * weitergegeben, falls ein mechanicalManager gesetzt ist.  Die neu
     * erzeugte Verbindungs-ID wird im Assembly-Wrapper registriert.
     *
     * @param {string} assemblyId
     * @param {object} jointDef   – Übergabe an mechanicalManager (Typ, Achsen …)
     * @returns {object | null}   – MechanicalConnection oder null wenn kein Manager
     */
    addMechanicalConnection(assemblyId, jointDef) {
        const assembly = this._assemblies.get(assemblyId);

        if (!assembly) {
            throw new Error(
                `AssemblyManager.addMechanicalConnection: Assembly "${assemblyId}" nicht gefunden.`
            );
        }

        if (!this.mechanicalManager) {
            // Kein MechanicalManager konfiguriert – ID direkt übernehmen, falls vorhanden
            if (jointDef?.id) {
                assembly.addMechanicalConnection(jointDef.id);
                this.historyManager?.saveState();
                return jointDef;
            }
            return null;
        }

        const joint = this.mechanicalManager.addConnection(jointDef);

        assembly.addMechanicalConnection(joint.id);

        this.historyManager?.saveState();

        return joint;
    }

    /**
     * Entfernt eine mechanische Verbindung aus der Baugruppe UND aus dem
     * MechanicalConnectionManager (falls gesetzt).
     *
     * @param {string} assemblyId
     * @param {string} jointId
     * @returns {boolean}  true wenn die Verbindung entfernt wurde
     */
    removeMechanicalConnection(assemblyId, jointId) {
        const assembly = this._assemblies.get(assemblyId);

        if (!assembly) return false;

        const removed = assembly.removeMechanicalConnection(jointId);

        if (!removed) return false;

        this.mechanicalManager?.removeConnection?.(jointId);

        this.historyManager?.saveState();

        return true;
    }

    /**
     * Gibt alle MechanicalConnections zurück, die zu einer Baugruppe gehören.
     *
     * @param {string} assemblyId
     * @returns {object[]}  – MechanicalConnection-Objekte (aus mechanicalManager)
     *                        oder leere ID-Wrapper, falls kein Manager gesetzt
     */
    getMechanicalConnections(assemblyId) {
        const assembly = this._assemblies.get(assemblyId);

        if (!assembly) return [];

        const ids = assembly.mechanicalConnectionIds;

        if (!this.mechanicalManager) {
            // Gib einfache ID-Objekte zurück, falls kein Manager verfügbar
            return ids.map(id => ({ id }));
        }

        return ids
            .map(id => this.mechanicalManager.getConnection?.(id) ?? null)
            .filter(Boolean);
    }


    // ----------------------------------------------------------------------
    // Erweiterte dissolve-Variante
    // ----------------------------------------------------------------------

    /**
     * Löst eine Baugruppe auf — entfernt dabei auch alle dazugehörigen
     * mechanischen Verbindungen.  Gibt die Brick-IDs der aufgelösten Gruppe
     * zurück (oder null, wenn die Assembly/Gruppe nicht gefunden wurde).
     *
     * Diese Methode ist ein Obermenge der bestehenden `dissolve(groupId)`-
     * Methode.  Sie arbeitet auf Assembly-IDs, nicht auf Group-IDs.
     *
     * @param {string} assemblyId
     * @returns {string[] | null}  – brickIds der aufgelösten Gruppe
     */
    dissolveAssembly(assemblyId) {
        const assembly = this._assemblies.get(assemblyId);

        if (!assembly) return null;

        // Mechanische Verbindungen bereinigen
        for (const jointId of assembly.mechanicalConnectionIds) {
            this.mechanicalManager?.removeConnection?.(jointId);
        }

        // GroupManager-Gruppe auflösen
        const brickIds = this.groupManager.ungroup(assembly.groupId);

        // Assembly-Wrapper entfernen
        this._assemblies.delete(assemblyId);

        if (brickIds !== null) {
            this.historyManager?.saveState();
        }

        return brickIds;
    }


    // ----------------------------------------------------------------------
    // Serialisierung / Deserialisierung
    // ----------------------------------------------------------------------

    /**
     * Serialisiert alle Assembly-Wrapper und alle bekannten mechanischen
     * Verbindungen zu einem einfachen Datenobjekt.
     *
     * @returns {{
     *   assemblies:            object[],
     *   mechanicalConnections: object[],
     * }}
     */
    toData() {
        const assemblies = [...this._assemblies.values()]
            .map(a => a.toData());

        const mechanicalConnections = this.mechanicalManager
            ? (this.mechanicalManager.toData?.() ?? [])
            : [];

        return { assemblies, mechanicalConnections };
    }

    /**
     * Lädt Assemblies und mechanische Verbindungen aus serialisierten Daten.
     *
     * Unbekannte groupIds und ungültige Einträge werden als Fehler gemeldet,
     * brechen den Ladevorgang aber nicht ab (tolerantes Laden).
     *
     * @param {{
     *   assemblies?:            object[],
     *   mechanicalConnections?: object[],
     * }} data
     * @param {{
     *   knownGroupIds?:    Set<string> | string[],
     *   knownInstanceIds?: Set<string> | string[],
     * }} [context]
     * @returns {{ loaded: number, errors: string[] }}
     */
    loadFromData(data, context = {}) {
        this._assemblies.clear();

        const errors  = [];
        let   loaded  = 0;

        // Bekannte IDs normalisieren
        const knownGroupIds = context.knownGroupIds
            ? new Set(context.knownGroupIds)
            : null;

        // ── Mechanische Verbindungen zuerst laden ─────────────────────────
        if (
            this.mechanicalManager &&
            Array.isArray(data?.mechanicalConnections) &&
            data.mechanicalConnections.length > 0
        ) {
            try {
                this.mechanicalManager.loadFromData?.(
                    data.mechanicalConnections,
                    context
                );
            } catch (err) {
                errors.push(
                    `MechanicalConnectionManager.loadFromData: ${err.message}`
                );
            }
        }

        // ── Assembly-Wrapper laden ─────────────────────────────────────────
        if (!Array.isArray(data?.assemblies)) {
            return { loaded, errors };
        }

        for (const item of data.assemblies) {
            try {
                // Grundvalidierung – fromData wirft bei fehlenden Pflichtfeldern
                const assembly = Assembly.fromData(item);

                // Optionale Konsistenzprüfung gegen bekannte GroupIds
                if (knownGroupIds && !knownGroupIds.has(assembly.groupId)) {
                    errors.push(
                        `Assembly "${assembly.id}": groupId "${assembly.groupId}" nicht bekannt – übersprungen.`
                    );
                    continue;
                }

                this._assemblies.set(assembly.id, assembly);
                loaded++;

            } catch (err) {
                errors.push(
                    `Assembly-Eintrag übersprungen: ${err.message}`
                );
            }
        }

        return { loaded, errors };
    }
}