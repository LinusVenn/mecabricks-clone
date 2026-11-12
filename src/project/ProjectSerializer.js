
import { ProjectValidator } from './ProjectValidator.js';

export class ProjectSerializer {

    constructor() {
        this.format = 'mecabricks-clone';
        this.version = 1;

        // Validierung wird an den eigenständigen ProjectValidator delegiert
        this.validator = new ProjectValidator();
    }

    // =====================================
    // 1. PROJEKT ERSTELLEN
    // =====================================

    /**
     * @param {object} library
     * @param {object} connectionManager
     * @param {object} projectInfo
     * @param {import('../editor/GroupManager.js').GroupManager | null} [groupManager]
     */
    createProject(library, connectionManager, projectInfo = {}, groupManager = null) {

        const now = new Date().toISOString();

        return {
            format: this.format,

            version: this.version,

            project: {
                id: projectInfo.id || crypto.randomUUID(),

                name: projectInfo.name || 'Unbenanntes Projekt',

                createdAt: projectInfo.createdAt || now,

                updatedAt: now
            },

            // Alle Steine aus der PartLibrary
            bricks: library.getAllData(),

            // Alle Verbindungen aus dem ConnectionManager
            connections: connectionManager.toData(),

            // Logische Gruppen (Version 2)
            groups: groupManager ? groupManager.toData() : [],
        };
    }


    // =====================================
    // 2. PROJEKT IN JSON UMWANDELN
    // =====================================

    toJSON(projectData) {

        if (!projectData) {
            throw new Error('Keine Projektdaten vorhanden.');
        }

        return JSON.stringify(projectData, null, 4);
    }


    // =====================================
    // 3. JSON IN PROJEKTDATEN UMWANDELN
    // =====================================

    fromJSON(jsonString) {

        let projectData;

        try {
            projectData = JSON.parse(jsonString);
        } catch (error) {
            throw new Error('Die JSON-Datei ist ungültig.');
        }

        this.validate(projectData);

        return projectData;
    }


    // =====================================
    // 4. PROJEKT VALIDIEREN
    // =====================================

    /**
     * Delegiert die vollständige Validierung an ProjectValidator.
     *
     * Die gesamte Prüflogik (Format, Version, Steintypen, Positionen,
     * eindeutige IDs, Verbindungsreferenzen) liegt in ProjectValidator.
     * ProjectSerializer ruft sie nur weiter.
     *
     * @param {*} data – Zu prüfende Projektdaten.
     * @returns {true}
     * @throws {Error} bei ungültigen Daten.
     */
    validate(data) {
        return this.validator.validate(data);
    }


    // =====================================
    // 6. PROJEKT WIEDERHERSTELLEN
    // =====================================

    /**
     * @param {object} data
     * @param {object} library
     * @param {object} connectionManager
     * @param {import('../editor/GroupManager.js').GroupManager | null} [groupManager]
     */
    deserialize(data, library, connectionManager, groupManager = null) {

        // Projekt vor dem Wiederherstellen überprüfen
        this.validate(data);

        // Alte Daten entfernen
        library.clear();
        connectionManager.clear();
        groupManager?.clear();

        try {

            // Zuerst alle Steine erstellen
            for (const brickData of data.bricks) {
                library.addBrickFromData(brickData);
            }

            // Danach Verbindungen wiederherstellen
            connectionManager.loadFromData(data.connections, library);

            // Gruppen wiederherstellen (Version 2, optional)
            if (groupManager && Array.isArray(data.groups)) {
                groupManager.loadFromData(data.groups, library);
            }

        } catch (error) {

            // Bei Fehlern keine halbfertige Szene behalten
            library.clear();
            connectionManager.clear();
            groupManager?.clear();

            throw error;
        }

        return data.project;
    }

}
