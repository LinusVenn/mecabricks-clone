import { ProjectValidator } from './ProjectValidator.js';

export class ProjectSerializer {

    constructor() {
        this.format = 'mecabricks-clone';
        this.version = 3;
        this.validator = new ProjectValidator();
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
            components: componentLibrary ? componentLibrary.toData() : []
        };
    }

    toJSON(projectData) {
        if (!projectData) {
            throw new Error('Keine Projektdaten vorhanden.');
        }

        return JSON.stringify(projectData, null, 4);
    }

    // Von ProjectManager verwendete Schnittstelle.
    serialize(
        library,
        connectionManager,
        projectInfo = {},
        groupManager = null,
        componentLibrary = null
    ) {
        const projectData = this.createProject(
            library,
            connectionManager,
            projectInfo,
            groupManager,
            componentLibrary
        );

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

    deserialize(
        data,
        library,
        connectionManager,
        groupManager = null,
        componentLibrary = null
    ) {
        this.validate(data);

        library.clear();
        connectionManager.clear();
        groupManager?.clear();
        componentLibrary?.clear();

        try {
            for (const brickData of data.bricks) {
                library.addBrickFromData(brickData);
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

        } catch (error) {
            library.clear();
            connectionManager.clear();
            groupManager?.clear();
            componentLibrary?.clear();

            throw error;
        }

        return data.project;
    }
}