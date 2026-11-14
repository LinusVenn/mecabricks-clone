
import { ProjectValidator } from './ProjectValidator.js';
import { MechanicalConnectionManager } from '../connections/MechanicalConnectionManager.js';

export class ProjectSerializer {

    constructor(options = {}) {
        this.format = 'mecabricks-clone';
        this.version = 4;
        this.validator = new ProjectValidator();
        this.geometryProvider = options.geometryProvider ?? null;
    }

    createProject(
        library,
        connectionManager,
        projectInfo = {},
        groupManager = null,
        componentLibrary = null
    ) {
        const now = new Date().toISOString();

        return {
            format: this.format,
            version: this.version,

            project: {
                id: projectInfo.id || (
                    typeof crypto !== 'undefined' && crypto.randomUUID
                        ? crypto.randomUUID()
                        : `project-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
                ),

                name: projectInfo.name || 'Unbenanntes Projekt',
                createdAt: projectInfo.createdAt || now,
                updatedAt: now
            },

            bricks: library.getAllData(),
            connections: connectionManager.toData(),
            groups: groupManager ? groupManager.toData() : [],
            components: componentLibrary ? componentLibrary.toData() : [],
            mechanicalConnections: []
        };
    }

    toJSON(projectData) {
        if (!projectData) {
            throw new Error('Keine Projektdaten vorhanden.');
        }

        return JSON.stringify(projectData, null, 4);
    }

    serialize(
        library,
        connectionManager,
        projectInfo = {},
        groupManager = null,
        componentLibrary = null,
        mechanicalManager = null
    ) {
        const projectData = this.createProject(
            library,
            connectionManager,
            projectInfo,
            groupManager,
            componentLibrary
        );

        if (mechanicalManager) {
            projectData.mechanicalConnections =
                mechanicalManager?.toData()?.mechanicalConnections ?? [];
        }

        return this.toJSON(projectData);
    }

    fromJSON(jsonString) {
        let projectData;

        try {
            projectData = JSON.parse(jsonString);
        } catch {
            throw new Error('Die JSON-Datei ist ungültig.');
        }

        this.validate(projectData);

        return projectData;
    }

    validate(data) {
        return this.validator.validate(data);
    }

    /**
     * Lädt die übergebenen Daten in die Manager.
     *
     * Diese Methode verändert den Zustand der Manager.
     * Der Aufrufer muss deshalb bei Bedarf vorher eine
     * Sicherung des aktuellen Zustands erstellen.
     *
     * LDraw-Bauteile (source === 'ldraw') werden über den
     * geometryProvider geladen, sofern dieser konfiguriert ist.
     */
    async _applyData(
        data,
        library,
        connectionManager,
        groupManager = null,
        componentLibrary = null,
        mechanicalManager = null
    ) {
        library.clear();
        connectionManager.clear();
        groupManager?.clear();
        componentLibrary?.clear();
        mechanicalManager?.clear();

        for (const brickData of data.bricks) {
            if (brickData.source === 'ldraw' && this.geometryProvider) {
                await library.addInstanceFromData(brickData, this.geometryProvider);
            } else {
                library.addBrickFromData(brickData);
            }
        }

        connectionManager.loadFromData(
            data.connections,
            library
        );

        if (groupManager && Array.isArray(data.groups)) {
            groupManager.loadFromData(
                data.groups,
                library
            );
        }

        if (componentLibrary) {
            componentLibrary.loadFromData(
                data.components ?? []
            );
        }

        if (mechanicalManager && Array.isArray(data.mechanicalConnections)) {
            const instanceIds = new Set(data.bricks.map(b => b.id));
            mechanicalManager.loadFromData(
                data.mechanicalConnections,
                instanceIds
            );
        }
    }

    /**
     * Lädt ein Projekt transaktional.
     *
     * Falls das Laden fehlschlägt, wird versucht,
     * den vorherigen Zustand wiederherzustellen.
     *
     * Die Methode ist async, da LDraw-Bauteile asynchron
     * über den geometryProvider geladen werden können.
     */
    async deserialize(
        data,
        library,
        connectionManager,
        groupManager = null,
        componentLibrary = null,
        mechanicalManager = null
    ) {
        // Zuerst die eingehenden Daten vollständig validieren.
        this.validate(data);

        // Aktuellen Zustand sichern.
        const backup = this.createProject(
            library,
            connectionManager,
            {
                id: 'temporary-backup',
                name: 'Temporäre Sicherung'
            },
            groupManager,
            componentLibrary
        );

        if (mechanicalManager) {
            backup.mechanicalConnections =
                mechanicalManager?.toData()?.mechanicalConnections ?? [];
        }

        try {
            // Neues Projekt laden.
            await this._applyData(
                data,
                library,
                connectionManager,
                groupManager,
                componentLibrary,
                mechanicalManager
            );

        } catch (loadError) {

            try {
                // Teilweise geladene Daten entfernen
                // und vorherigen Zustand wiederherstellen.
                await this._applyData(
                    backup,
                    library,
                    connectionManager,
                    groupManager,
                    componentLibrary,
                    mechanicalManager
                );

            } catch (restoreError) {

                throw new Error(
                    'Das Projekt konnte nicht geladen werden. ' +
                    'Zusätzlich ist die Wiederherstellung des vorherigen ' +
                    'Projektzustands fehlgeschlagen. ' +
                    `Ladefehler: ${loadError.message}. ` +
                    `Wiederherstellungsfehler: ${restoreError.message}`
                );
            }

            throw new Error(
                'Das Projekt konnte nicht geladen werden. ' +
                'Der vorherige Projektzustand wurde wiederhergestellt. ' +
                `Ursache: ${loadError.message}`
            );
        }

        return data.project;
    }
}
